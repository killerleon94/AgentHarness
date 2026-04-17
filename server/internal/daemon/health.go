package daemon

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/multica-ai/multica/server/internal/daemon/repocache"
)

// HealthResponse is returned by the daemon's local health endpoint.
type HealthResponse struct {
	Status     string            `json:"status"`
	PID        int               `json:"pid"`
	Uptime     string            `json:"uptime"`
	DaemonID   string            `json:"daemon_id"`
	DeviceName string            `json:"device_name"`
	ServerURL  string            `json:"server_url"`
	Agents     []string          `json:"agents"`
	Workspaces []healthWorkspace `json:"workspaces"`
}

type healthWorkspace struct {
	ID       string   `json:"id"`
	Runtimes []string `json:"runtimes"`
}

// listenHealth binds the health port. Returns the listener or an error if
// another daemon is already running (port taken).
func (d *Daemon) listenHealth() (net.Listener, error) {
	addr := fmt.Sprintf("127.0.0.1:%d", d.cfg.HealthPort)
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return nil, fmt.Errorf("another daemon is already running on %s: %w", addr, err)
	}
	return ln, nil
}

// repoCheckoutRequest is the body of a POST /repo/checkout request.
type repoCheckoutRequest struct {
	URL         string `json:"url"`
	WorkspaceID string `json:"workspace_id"`
	WorkDir     string `json:"workdir"`
	AgentName   string `json:"agent_name"`
	TaskID      string `json:"task_id"`
}

// serveHealth runs the health HTTP server on the given listener.
// Blocks until ctx is cancelled.
func (d *Daemon) serveHealth(ctx context.Context, ln net.Listener, startedAt time.Time) {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		d.mu.Lock()
		var wsList []healthWorkspace
		for id, ws := range d.workspaces {
			wsList = append(wsList, healthWorkspace{
				ID:       id,
				Runtimes: ws.runtimeIDs,
			})
		}
		d.mu.Unlock()

		agents := make([]string, 0, len(d.cfg.Agents))
		for name := range d.cfg.Agents {
			agents = append(agents, name)
		}

		resp := HealthResponse{
			Status:     "running",
			PID:        os.Getpid(),
			Uptime:     time.Since(startedAt).Truncate(time.Second).String(),
			DaemonID:   d.cfg.DaemonID,
			DeviceName: d.cfg.DeviceName,
			ServerURL:  d.cfg.ServerBaseURL,
			Agents:     agents,
			Workspaces: wsList,
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	})

	mux.HandleFunc("/repo/checkout", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req repoCheckoutRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body: "+err.Error(), http.StatusBadRequest)
			return
		}
		if req.URL == "" {
			http.Error(w, "url is required", http.StatusBadRequest)
			return
		}
		if req.WorkDir == "" {
			http.Error(w, "workdir is required", http.StatusBadRequest)
			return
		}

		if d.repoCache == nil {
			http.Error(w, "repo cache not initialized", http.StatusInternalServerError)
			return
		}

		result, err := d.repoCache.CreateWorktree(repocache.WorktreeParams{
			WorkspaceID: req.WorkspaceID,
			RepoURL:     req.URL,
			WorkDir:     req.WorkDir,
			AgentName:   req.AgentName,
			TaskID:      req.TaskID,
		})
		if err != nil {
			d.logger.Error("repo checkout failed", "url", req.URL, "error", err)
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
	})

	// File endpoint: GET /files/{workspace_id}?path=...&ls=1
	// path is relative to the workspace's root directory.
	// If ls=1 is set, returns JSON directory listing instead of file download.
	mux.HandleFunc("/files/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Extract workspace_id from URL path: /files/{workspace_id}
		path := r.URL.Path
		if !strings.HasPrefix(path, "/files/") {
			http.Error(w, "invalid path", http.StatusBadRequest)
			return
		}
		workspaceID := strings.TrimPrefix(path, "/files/")
		if workspaceID == "" || strings.Contains(workspaceID, "/") {
			http.Error(w, "workspace_id is required", http.StatusBadRequest)
			return
		}

		// Get the requested file path relative to workspace root
		filePath := r.URL.Query().Get("path")
		if filePath == "" {
			http.Error(w, "path is required", http.StatusBadRequest)
			return
		}

		// Build the absolute path and validate it's within the workspace directory
		workspaceRoot := filepath.Join(d.cfg.WorkspacesRoot, workspaceID)
		filePath = filepath.Clean(filePath)
		absPath := filepath.Join(workspaceRoot, filePath)
		absPath = filepath.Clean(absPath)

		slog.Info("files endpoint", "workspace_root", workspaceRoot, "abs_path", absPath, "file_path", filePath)

		// Validate: absPath must be inside workspaceRoot
		if !strings.HasPrefix(absPath, workspaceRoot) {
			slog.Warn("path outside workspace", "abs_path", absPath, "workspace_root", workspaceRoot)
			http.Error(w, "path outside workspace", http.StatusForbidden)
			return
		}

		// Check if listing directory
		if r.URL.Query().Get("ls") == "1" {
			entries, err := os.ReadDir(absPath)
			if err != nil {
				if os.IsNotExist(err) {
					http.Error(w, "directory not found", http.StatusNotFound)
					return
				}
				http.Error(w, "failed to read directory", http.StatusInternalServerError)
				return
			}
			type FileEntry struct {
				Name  string `json:"name"`
				IsDir bool   `json:"is_dir"`
				Size  int64  `json:"size"`
			}
			var files []FileEntry
			for _, entry := range entries {
				info, err := entry.Info()
				if err != nil {
					continue
				}
				files = append(files, FileEntry{
					Name:  entry.Name(),
					IsDir: entry.IsDir(),
					Size:  info.Size(),
				})
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(files)
			return
		}

		// Open the file
		file, err := os.Open(absPath)
		if err != nil {
			if os.IsNotExist(err) {
				http.Error(w, "file not found", http.StatusNotFound)
				return
			}
			http.Error(w, "failed to open file", http.StatusInternalServerError)
			return
		}
		defer file.Close()

		// Get file info for Content-Disposition
		info, err := file.Stat()
		if err != nil {
			http.Error(w, "failed to stat path", http.StatusInternalServerError)
			return
		}
		if info.IsDir() {
			http.Error(w, "directory listing not supported", http.StatusForbidden)
			return
		}

		// Serve the file
		w.Header().Set("Content-Type", "application/octet-stream")
		w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, info.Name()))
		w.Header().Set("Content-Length", fmt.Sprintf("%d", info.Size()))
		io.Copy(w, file)
	})

	srv := &http.Server{Handler: mux}

	go func() {
		<-ctx.Done()
		srv.Close()
	}()

	d.logger.Info("health server listening", "addr", ln.Addr().String())
	if err := srv.Serve(ln); err != nil && err != http.ErrServerClosed {
		d.logger.Warn("health server error", "error", err)
	}
}
