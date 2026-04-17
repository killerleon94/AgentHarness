package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/multica-ai/multica/server/internal/auth"
	"github.com/multica-ai/multica/server/internal/cli"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

// MulticaRequest represents the request body for multica CLI commands
type MulticaRequest struct {
	Command string `json:"command"`
}

// MulticaResponse represents the response from multica CLI commands
type MulticaResponse struct {
	Status string      `json:"status"`
	Output interface{} `json:"output,omitempty"`
	Error  string      `json:"error,omitempty"`
}

// DaemonStatus represents parsed daemon status
type DaemonStatus struct {
	Status     string `json:"status"` // "running", "stopped"
	PID        int    `json:"pid,omitempty"`
	Uptime     string `json:"uptime,omitempty"`
	Agents     string `json:"agents,omitempty"`
	Workspaces int    `json:"workspaces,omitempty"`
}

// Per-user mutex map for user isolation
var userMutexes sync.Map // map[string]*sync.Mutex

func getUserMutex(userID string) *sync.Mutex {
	mu, _ := userMutexes.LoadOrStore(userID, &sync.Mutex{})
	return mu.(*sync.Mutex)
}

// runMulticaCommand executes a multica CLI command and returns the result
func runMulticaCommand(command string, userID string, queries *db.Queries) (map[string]interface{}, error) {
	// Get per-user mutex for isolation
	userMu := getUserMutex(userID)
	userMu.Lock()
	defer userMu.Unlock()

	// If command is "login" and we have a userID, automatically create a PAT and login
	if strings.TrimSpace(command) == "login" && userID != "" && queries != nil {
		return runMulticaAutoLogin(queries, userID)
	}

	// Handle daemon commands - use ctrl for user isolation if available, fallback to direct
	if strings.HasPrefix(strings.TrimSpace(command), "daemon start") {
		slog.Info("handling daemon start", "userID", userID[:8])
		return runDaemonStart(command, userID, queries)
	}
	if strings.HasPrefix(strings.TrimSpace(command), "daemon stop") {
		slog.Info("handling daemon stop", "userID", userID[:8])
		return runDaemonStop(command, userID)
	}
	if strings.HasPrefix(strings.TrimSpace(command), "daemon status") {
		slog.Info("handling daemon status", "userID", userID[:8])
		// Use profile-based daemon status for user isolation
		profile := "user-" + userID[:8]
		serverURL := os.Getenv("MULTICA_SERVER_URL")
		env := os.Environ()
		if serverURL != "" {
			env = append(env, "MULTICA_SERVER_URL="+serverURL)
		}
		cmd := exec.Command("sh", "-c", fmt.Sprintf(
			"MULTICA_SERVER_URL=%s /home/ubuntu/dongxianzhi/AgentHarness/server/bin/multica --profile %s daemon status 2>&1",
			serverURL, profile,
		))
		cmd.Env = env
		output, err := cmd.CombinedOutput()
		slog.Info("daemon status output", "output", string(output), "error", err, "profile", profile)
		if err != nil {
			return map[string]interface{}{
				"stdout": string(output),
				"stderr": err.Error(),
			}, fmt.Errorf("daemon status failed: %w", err)
		}
		// Parse and return structured status
		daemonStatus := parseDaemonStatus(string(output))
		slog.Info("parsed daemon status", "status", daemonStatus, "profile", profile)
		return map[string]interface{}{
			"status": daemonStatus.Status,
			"pid":    daemonStatus.PID,
			"uptime": daemonStatus.Uptime,
			"agents": daemonStatus.Agents,
		}, nil
	}

	// Use sh -c to properly parse compound commands like "daemon start"
	// Also pass MULTICA_SERVER_URL to the subprocess via environment
	serverURL := os.Getenv("MULTICA_SERVER_URL")
	env := os.Environ()
	if serverURL != "" {
		env = append(env, "MULTICA_SERVER_URL="+serverURL)
	}
	cmd := exec.Command("sh", "-c", "/home/ubuntu/dongxianzhi/AgentHarness/server/bin/multica "+command+" 2>&1")
	cmd.Env = env

	// Get output pipes
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, fmt.Errorf("failed to get stdout pipe: %w", err)
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		return nil, fmt.Errorf("failed to get stderr pipe: %w", err)
	}

	// Start the process
	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("failed to start multica command: %w", err)
	}

	// Wait for completion and collect output
	var stdoutBuf, stderrBuf strings.Builder

	// Copy stdout and stderr in goroutines
	done := make(chan struct{}, 2)

	go func() {
		io.Copy(&stdoutBuf, stdout)
		done <- struct{}{}
	}()

	go func() {
		io.Copy(&stderrBuf, stderr)
		done <- struct{}{}
	}()

	// Wait for process to finish
	if err := cmd.Wait(); err != nil {
		// Wait for output copying to finish
		<-done
		<-done

		// Close pipes
		stdout.Close()
		stderr.Close()

		// Return error with captured output
		return map[string]interface{}{
			"stdout": stdoutBuf.String(),
			"stderr": stderrBuf.String(),
		}, fmt.Errorf("multica command failed: %w %s", err, stderrBuf.String())
	}

	// Wait for output copying to finish
	<-done
	<-done

	// Close pipes
	stdout.Close()
	stderr.Close()

	// Return result
	return map[string]interface{}{
		"stdout": stdoutBuf.String(),
		"stderr": stderrBuf.String(),
	}, nil
}

// parseDaemonStatus parses the output of "daemon status" command
func parseDaemonStatus(output string) DaemonStatus {
	status := DaemonStatus{Status: "stopped"}

	// Check for "running" in output
	if strings.Contains(output, "running") {
		status.Status = "running"
	}

	// Parse PID: "running (pid 1234, uptime 1m30s)"
	pidRegex := regexp.MustCompile(`pid (\d+)`)
	matches := pidRegex.FindStringSubmatch(output)
	if len(matches) > 1 {
		pid, _ := strconv.Atoi(matches[1])
		status.PID = pid
	}

	// Parse uptime: "(pid 1234, uptime 1m30s)"
	uptimeRegex := regexp.MustCompile(`uptime ([^,)]+)`)
	matches = uptimeRegex.FindStringSubmatch(output)
	if len(matches) > 1 {
		status.Uptime = matches[1]
	}

	// Parse agents: "Agents: claude-code, codex"
	agentsRegex := regexp.MustCompile(`Agents:\s*(.+)`)
	matches = agentsRegex.FindStringSubmatch(output)
	if len(matches) > 1 {
		status.Agents = matches[1]
	}

	// Parse workspaces: "Workspaces: 2"
	wsRegex := regexp.MustCompile(`Workspaces:\s*(\d+)`)
	matches = wsRegex.FindStringSubmatch(output)
	if len(matches) > 1 {
		ws, _ := strconv.Atoi(matches[1])
		status.Workspaces = ws
	}

	return status
}

// runDaemonStart starts the daemon for a specific user using ctrl start
// as per the multica_ctrl.md spec: multica ctrl start --user <user> --workspace <workspace-id> --profile <profile>
func runDaemonStart(command string, userID string, queries *db.Queries) (map[string]interface{}, error) {
	serverURL := os.Getenv("MULTICA_SERVER_URL")
	env := os.Environ()
	if serverURL != "" {
		env = append(env, "MULTICA_SERVER_URL="+serverURL)
	}

	// Get workspace ID for the user
	ctx := context.Background()
	wsResp, err := queries.ListWorkspaces(ctx, parseUUID(userID))
	if err != nil || len(wsResp) == 0 {
		return nil, fmt.Errorf("no workspaces found for user")
	}
	wsID := uuidToString(wsResp[0].ID)

	// Use profile for user isolation (userID[:8] for safety)
	profile := "user-" + userID[:8]

	// First, ensure we have a valid PAT for this user
	patToken, err := ensureUserPAT(userID, profile, wsID, serverURL, queries)
	if err != nil {
		slog.Warn("failed to get PAT, ctrl start may fail", "error", err)
		// Continue anyway - ctrl start will try its own auth
	}

	// Build ctrl start command with token if available
	// multica ctrl start --user <user> --workspace <workspace-id> --profile <profile> --token <pat>
	var ctrlCmd *exec.Cmd
	if patToken != "" {
		ctrlCmd = exec.Command("sh", "-c", fmt.Sprintf(
			"MULTICA_SERVER_URL=%s /home/ubuntu/dongxianzhi/AgentHarness/server/bin/multica ctrl start --user %s --workspace %s --profile %s --token %s 2>&1",
			serverURL, userID, wsID, profile, patToken,
		))
	} else {
		ctrlCmd = exec.Command("sh", "-c", fmt.Sprintf(
			"MULTICA_SERVER_URL=%s /home/ubuntu/dongxianzhi/AgentHarness/server/bin/multica ctrl start --user %s --workspace %s --profile %s 2>&1",
			serverURL, userID, wsID, profile,
		))
	}
	ctrlCmd.Env = env

	slog.Info("starting ctrl for user", "userID", userID[:8], "workspace", wsID, "profile", profile)

	// Run and wait for result - ctrl start should complete quickly
	output, err := ctrlCmd.CombinedOutput()
	slog.Info("ctrl start output", "output", string(output), "error", err)

	// Even if err, check if daemon is actually running
	time.Sleep(1 * time.Second)

	// Check if daemon is now running for this profile
	checkCmd := exec.Command("sh", "-c", fmt.Sprintf(
		"MULTICA_SERVER_URL=%s /home/ubuntu/dongxianzhi/AgentHarness/server/bin/multica --profile %s daemon status 2>&1",
		serverURL, profile,
	))
	checkCmd.Env = env
	checkOutput, _ := checkCmd.CombinedOutput()

	if strings.Contains(string(checkOutput), "running") {
		return map[string]interface{}{
			"stdout": fmt.Sprintf("Daemon started via ctrl for profile %s", profile),
			"stderr": "",
		}, nil
	}

	// If ctrl start didn't work, try direct daemon start as fallback
	slog.Warn("ctrl start didn't start daemon, trying direct daemon start")
	return runDaemonStartDirect(userID, wsID, serverURL, env, patToken)
}

// ensureUserPAT creates or retrieves a PAT for the user and saves it to the profile config
func ensureUserPAT(userID, profile, wsID, serverURL string, queries *db.Queries) (string, error) {
	ctx := context.Background()

	// Check if there's already a valid PAT in the profile config
	cfgPath := filepath.Join(os.Getenv("HOME"), ".multica", "profiles", profile, "config.json")
	if data, err := os.ReadFile(cfgPath); err == nil {
		var cfg struct {
			Token string `json:"token"`
		}
		if json.Unmarshal(data, &cfg) == nil && cfg.Token != "" {
			// Verify the token is still valid
			if token := verifyToken(cfg.Token, serverURL); token != "" {
				return token, nil
			}
		}
	}

	// Need to create a new PAT - use server-side PAT creation
	patToken, err := auth.GeneratePATToken()
	if err != nil {
		return "", fmt.Errorf("failed to generate PAT: %w", err)
	}

	prefix := patToken
	if len(prefix) > 12 {
		prefix = prefix[:12]
	}

	// Create the PAT in the database
	_, err = queries.CreatePersonalAccessToken(ctx, db.CreatePersonalAccessTokenParams{
		UserID:      parseUUID(userID),
		Name:        fmt.Sprintf("Daemon profile %s", profile),
		TokenHash:   auth.HashToken(patToken),
		TokenPrefix: prefix,
		ExpiresAt: pgtype.Timestamptz{
			Time:  time.Now().Add(90 * 24 * time.Hour),
			Valid: true,
		},
	})
	if err != nil {
		slog.Warn("failed to create PAT in DB", "error", err)
		// Continue anyway - CLI will try its own auth
	}

	// Save the PAT to the user's profile config using proper CLI config structure
	profileDir := filepath.Join(os.Getenv("HOME"), ".multica", "profiles", profile)
	os.MkdirAll(profileDir, 0755)

	cfg, err := cli.LoadCLIConfigForProfile(profile)
	if err != nil {
		cfg = cli.CLIConfig{}
	}
	cfg.Token = patToken
	cfg.ServerURL = serverURL
	cfg.WorkspaceID = wsID
	cfg.AddWatchedWorkspace(wsID, "")

	if err := cli.SaveCLIConfigForProfile(cfg, profile); err != nil {
		slog.Warn("failed to save PAT to profile config", "error", err)
	}

	cfgPath = filepath.Join(profileDir, "config.json")
	slog.Info("saved PAT to profile config", "profile", profile, "path", cfgPath)
	return patToken, nil
}

// verifyToken checks if a token is valid by calling /api/me
func verifyToken(token, serverURL string) string {
	if token == "" {
		return ""
	}

	// Add mul_ prefix if missing
	if !strings.HasPrefix(token, "mul_") {
		token = "mul_" + token
	}

	// Convert ws:// to http:// for API calls
	httpURL := strings.Replace(serverURL, "ws://", "http://", 1)
	httpURL = strings.TrimSuffix(httpURL, "/ws")

	client := &http.Client{Timeout: 10 * time.Second}
	req, _ := http.NewRequest("GET", httpURL+"/api/me", nil)
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := client.Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()

	if resp.StatusCode == 200 {
		return token
	}
	return ""
}

// runDaemonStartDirect is the fallback direct daemon start method
func runDaemonStartDirect(userID, wsID, serverURL string, env []string, token string) (map[string]interface{}, error) {
	profile := "user-" + userID[:8]

	// If we have a token, save it to profile config
	if token != "" {
		cfg := struct {
			Token       string `json:"token"`
			ServerURL   string `json:"server_url"`
			WorkspaceID string `json:"workspace_id"`
		}{
			Token:       token,
			ServerURL:   serverURL,
			WorkspaceID: wsID,
		}
		cfgData, _ := json.Marshal(cfg)
		profileDir := filepath.Join(os.Getenv("HOME"), ".multica", "profiles", profile)
		os.MkdirAll(profileDir, 0755)
		cfgPath := filepath.Join(profileDir, "config.json")
		os.WriteFile(cfgPath, cfgData, 0644)
	}

	// Watch the workspace for this profile
	watchCmd := exec.Command("sh", "-c", fmt.Sprintf(
		"MULTICA_SERVER_URL=%s MULTICA_WORKSPACE_ID=%s /home/ubuntu/dongxianzhi/AgentHarness/server/bin/multica --profile %s workspace watch %s 2>&1",
		serverURL, wsID, profile, wsID,
	))
	watchCmd.Env = env
	watchOutput, watchErr := watchCmd.CombinedOutput()
	if watchErr != nil {
		slog.Warn("workspace watch failed", "output", string(watchOutput), "error", watchErr)
	}

	// Start daemon directly with setsid for process isolation
	wrapperScript := fmt.Sprintf(`
		export MULTICA_SERVER_URL=%s
		export MULTICA_USER=%s
		export MULTICA_WORKSPACE_ID=%s
		exec /home/ubuntu/dongxianzhi/AgentHarness/server/bin/multica --profile %s daemon start --foreground
	`, serverURL, userID, wsID, profile)

	startCmd := exec.Command("sh", "-c", fmt.Sprintf(
		"setsid sh -c '%s' > /dev/null 2>&1 &",
		wrapperScript,
	))
	startCmd.Env = env

	startErr := startCmd.Start()
	if startErr != nil {
		return nil, fmt.Errorf("failed to start daemon: %w", startErr)
	}

	// Wait a bit for daemon to initialize
	time.Sleep(2 * time.Second)

	// Check if daemon is now running
	checkCmd := exec.Command("sh", "-c", fmt.Sprintf(
		"MULTICA_SERVER_URL=%s /home/ubuntu/dongxianzhi/AgentHarness/server/bin/multica --profile %s daemon status 2>&1",
		serverURL, profile,
	))
	checkCmd.Env = env
	checkOutput, _ := checkCmd.CombinedOutput()

	if strings.Contains(string(checkOutput), "running") {
		return map[string]interface{}{
			"stdout": fmt.Sprintf("Daemon started for profile %s", profile),
			"stderr": "",
		}, nil
	}

	return map[string]interface{}{
		"stdout": fmt.Sprintf("Started daemon for profile %s, check status: %s", profile, string(checkOutput)),
		"stderr": "",
	}, nil
}

// runDaemonStop stops the daemon for a specific user
func runDaemonStop(command string, userID string) (map[string]interface{}, error) {
	serverURL := os.Getenv("MULTICA_SERVER_URL")
	env := os.Environ()
	if serverURL != "" {
		env = append(env, "MULTICA_SERVER_URL="+serverURL)
	}

	// Use profile-based daemon stop for user isolation
	profile := "user-" + userID[:8]
	cmd := exec.Command("sh", "-c", fmt.Sprintf(
		"MULTICA_SERVER_URL=%s /home/ubuntu/dongxianzhi/AgentHarness/server/bin/multica --profile %s daemon stop 2>&1",
		serverURL, profile,
	))
	cmd.Env = env

	// Run in background to avoid hanging - daemon stop can take up to 10 seconds
	go func() {
		cmd.Run()
	}()

	// Return immediately - the stop is happening in background
	return map[string]interface{}{
		"stdout": "Daemon stop command sent",
		"stderr": "",
	}, nil
}

// runMulticaAutoLogin creates a PAT for the user and saves it to the multica config
func runMulticaAutoLogin(queries *db.Queries, userID string) (map[string]interface{}, error) {
	ctx := context.Background()

	// Generate a new PAT
	rawToken, err := auth.GeneratePATToken()
	if err != nil {
		return nil, fmt.Errorf("failed to generate token: %w", err)
	}

	prefix := rawToken
	if len(prefix) > 12 {
		prefix = prefix[:12]
	}

	// Create the PAT in the database
	_, err = queries.CreatePersonalAccessToken(ctx, db.CreatePersonalAccessTokenParams{
		UserID:      parseUUID(userID),
		Name:        "Auto-generated for daemon",
		TokenHash:   auth.HashToken(rawToken),
		TokenPrefix: prefix,
		ExpiresAt: pgtype.Timestamptz{
			Time:  time.Now().Add(90 * 24 * time.Hour),
			Valid: true,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create PAT: %w", err)
	}

	// Save the PAT to multica config using the CLI
	// Use echo + pipe instead of here-string for better compatibility
	cmdStr := fmt.Sprintf("echo '%s' | MULTICA_SERVER_URL=%s /home/ubuntu/dongxianzhi/AgentHarness/server/bin/multica auth login --token",
		rawToken, os.Getenv("MULTICA_SERVER_URL"))
	cmd := exec.Command("sh", "-c", cmdStr)
	output, err := cmd.CombinedOutput()
	if err != nil {
		slog.Error("failed to save PAT to multica config", "output", string(output), "error", err)
		return map[string]interface{}{
			"stdout": string(output),
			"stderr": err.Error(),
		}, nil // Still return success since PAT was created
	}

	// Get user's workspaces and watch the first one
	wsResp, err := queries.ListWorkspaces(ctx, parseUUID(userID))
	if err != nil || len(wsResp) == 0 {
		slog.Warn("no workspaces found for user", "user_id", userID)
		return map[string]interface{}{
			"stdout": fmt.Sprintf("Created PAT for user %s, but no workspaces found to watch", userID),
			"stderr": "",
		}, nil
	}

	// Watch the first workspace
	wsID := uuidToString(wsResp[0].ID)
	watchCmd := exec.Command("sh", "-c", fmt.Sprintf(
		"MULTICA_SERVER_URL=%s /home/ubuntu/dongxianzhi/AgentHarness/server/bin/multica workspace watch %s",
		os.Getenv("MULTICA_SERVER_URL"), wsID,
	))
	watchOutput, err := watchCmd.CombinedOutput()
	if err != nil {
		slog.Error("failed to watch workspace", "output", string(watchOutput), "error", err)
	}

	return map[string]interface{}{
		"stdout": fmt.Sprintf("Created PAT and watching workspace %s for user %s", wsID, userID),
		"stderr": "",
	}, nil
}

// MulticaHandler handles requests to execute multica CLI commands
func (h *Handler) MulticaHandler(w http.ResponseWriter, r *http.Request) {
	// Set content type to JSON explicitly
	w.Header().Set("Content-Type", "application/json")

	var req MulticaRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Command == "" {
		writeError(w, http.StatusBadRequest, "command is required")
		return
	}

	// Get userID from request (set by auth middleware)
	userID := requestUserID(r)

	// Execute the multica command
	result, err := runMulticaCommand(req.Command, userID, h.Queries)
	if err != nil {
		stdout, _ := result["stdout"].(string)
		stderr, _ := result["stderr"].(string)
		slog.Error("multica command failed", "command", req.Command, "stdout", stdout, "stderr", stderr)
		errMsg := fmt.Sprintf("multica command failed: %v | stdout: %s | stderr: %s", err, stdout, stderr)
		writeError(w, http.StatusInternalServerError, errMsg)
		return
	}

	// For daemon status commands, return the already parsed status
	if strings.HasPrefix(strings.TrimSpace(req.Command), "daemon status") {
		daemonStatus := DaemonStatus{
			Status: "stopped",
		}
		if status, ok := result["status"].(string); ok {
			daemonStatus.Status = status
		}
		if pid, ok := result["pid"].(int); ok {
			daemonStatus.PID = pid
		}
		if uptime, ok := result["uptime"].(string); ok {
			daemonStatus.Uptime = uptime
		}
		if agents, ok := result["agents"].(string); ok {
			daemonStatus.Agents = agents
		}

		writeJSON(w, http.StatusOK, MulticaResponse{
			Status: "success",
			Output: daemonStatus,
		})
		return
	}

	// Return success response
	slog.Info("multica command result", "command", req.Command, "stdout", result["stdout"], "stderr", result["stderr"])
	writeJSON(w, http.StatusOK, MulticaResponse{
		Status: "success",
		Output: result,
	})
}
