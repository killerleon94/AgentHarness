package agent

import (
	"bufio"
	"bytes"
	"context"
	"crypto/md5"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

type kimiBackend struct {
	cfg Config
}

func (b *kimiBackend) Execute(ctx context.Context, prompt string, opts ExecOptions) (*Session, error) {
	execPath := b.cfg.ExecutablePath
	if execPath == "" {
		execPath = "kimi"
	}
	if _, err := exec.LookPath(execPath); err != nil {
		return nil, fmt.Errorf("kimi executable not found at %q: %w", execPath, err)
	}

	timeout := opts.Timeout
	if timeout == 0 {
		timeout = 20 * time.Minute
	}
	runCtx, cancel := context.WithTimeout(ctx, timeout)

	args := []string{
		"--print",
		"--output-format", "stream-json",
		"--yolo",
	}
	if opts.Cwd != "" {
		args = append(args, "--work-dir", opts.Cwd)
	}
	if opts.Model != "" {
		args = append(args, "--model", opts.Model)
	}
	if opts.MaxTurns > 0 {
		args = append(args, "--max-steps-per-turn", fmt.Sprintf("%d", opts.MaxTurns))
	}
	if opts.ResumeSessionID != "" {
		args = append(args, "--session", opts.ResumeSessionID)
	}
	args = append(args, "--prompt", prompt)

	cmd := exec.CommandContext(runCtx, execPath, args...)
	cmd.Env = buildEnv(b.cfg.Env)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		cancel()
		return nil, fmt.Errorf("kimi stdout pipe: %w", err)
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		cancel()
		return nil, fmt.Errorf("kimi stderr pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		cancel()
		return nil, fmt.Errorf("start kimi: %w", err)
	}

	b.cfg.Logger.Info("kimi started", "pid", cmd.Process.Pid, "cwd", opts.Cwd, "model", opts.Model)

	msgCh := make(chan Message, 256)
	resCh := make(chan Result, 1)

	go func() {
		defer cancel()
		defer close(msgCh)
		defer close(resCh)

		startTime := time.Now()
		scanResult := b.processOutput(stdout, msgCh)

		var stderrSessionID string
		var wg sync.WaitGroup
		wg.Add(1)
		go func() {
			defer wg.Done()
			var errBuf bytes.Buffer
			io.Copy(&errBuf, stderr)
			stderrData := errBuf.Bytes()
			if b.cfg.Logger != nil && len(stderrData) > 0 {
				b.cfg.Logger.Debug("[kimi:stderr]", "stderr", string(stderrData))
			}
			if scanResult.sessionID == "" {
				stderrSessionID = parseSessionFromTrailer(stderrData)
			}
		}()
		wg.Wait()

		if scanResult.sessionID == "" {
			scanResult.sessionID = stderrSessionID
		}

		exitErr := cmd.Wait()
		duration := time.Since(startTime)

		// Extract token usage from kimi's session wire.jsonl.
		// The stream-json stdout does not include usage data; it is only
		// written to ~/.kimi/sessions/{md5(cwd)}/{sessionID}/wire.jsonl
		// as StatusUpdate events with token_usage fields.
		// Must read after cmd.Wait() to ensure all data is flushed.
		if scanResult.sessionID != "" && opts.Cwd != "" {
			if wireUsage := extractKimiWireUsage(opts.Cwd, scanResult.sessionID); wireUsage != nil {
				scanResult.usage = *wireUsage
			}
		}

		if runCtx.Err() == context.DeadlineExceeded {
			scanResult.status = "timeout"
			scanResult.errMsg = fmt.Sprintf("kimi timed out after %s", timeout)
		} else if runCtx.Err() == context.Canceled {
			scanResult.status = "aborted"
			scanResult.errMsg = "execution cancelled"
		} else if exitErr != nil && scanResult.status == "completed" {
			scanResult.status = "failed"
			scanResult.errMsg = fmt.Sprintf("kimi exited with error: %v", exitErr)
		}

		b.cfg.Logger.Info("kimi finished", "pid", cmd.Process.Pid, "status", scanResult.status, "duration", duration.Round(time.Millisecond).String(), "usage", scanResult.usage)

		var usage map[string]TokenUsage
		u := scanResult.usage
		if u.InputTokens > 0 || u.OutputTokens > 0 {
			model := opts.Model
			if model == "" {
				model = "kimi-for-coding"
			}
			usage = map[string]TokenUsage{model: u}
		}

		resCh <- Result{
			Status:     scanResult.status,
			Output:     scanResult.output,
			Error:      scanResult.errMsg,
			DurationMs: duration.Milliseconds(),
			SessionID:  scanResult.sessionID,
			Usage:      usage,
		}
	}()

	return &Session{Messages: msgCh, Result: resCh}, nil
}

func (b *kimiBackend) processOutput(r io.Reader, ch chan<- Message) eventResult {
	var output strings.Builder
	var sessionID string
	var usage TokenUsage
	finalStatus := "completed"
	var finalError string
	var rawOutput []byte

	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 0, 1024*1024), 10*1024*1024)

	lineNum := 0
	for scanner.Scan() {
		lineNum++
		rawLine := scanner.Text()
		rawOutput = append(rawOutput, rawLine...)
		rawOutput = append(rawOutput, '\n')
		if b.cfg.Logger != nil {
			b.cfg.Logger.Info("kimi stdout line", "line_num", lineNum, "line_len", len(rawLine), "line_preview", truncateString(rawLine, 200))
		}

		line := strings.TrimSpace(rawLine)
		if line == "" {
			continue
		}

		var resp kimiResponse
		if err := json.Unmarshal([]byte(line), &resp); err != nil {
			if b.cfg.Logger != nil {
				b.cfg.Logger.Warn("kimi json parse error", "line_num", lineNum, "error", err)
			}
			continue
		}

		if resp.SessionID != "" {
			sessionID = resp.SessionID
		}

		for _, item := range resp.Content {
			switch item.Type {
			case "think":
				if item.Thinking != "" {
					trySend(ch, Message{Type: MessageThinking, Content: item.Thinking})
				}
			case "text":
				if item.Text != "" {
					if b.cfg.Logger != nil {
						b.cfg.Logger.Info("kimi text content before strip", "text_len", len(item.Text), "text_preview", truncateString(item.Text, 300))
					}
					cleanText := stripSystemTags(item.Text)
					if b.cfg.Logger != nil {
						b.cfg.Logger.Info("kimi text content after strip", "text_len", len(cleanText), "text_preview", truncateString(cleanText, 300))
					}
					if cleanText != "" && !isPureAPINoise(cleanText) {
						output.WriteString(cleanText)
						trySend(ch, Message{Type: MessageText, Content: cleanText})
					}
				}
			case "tool_use":
				var input map[string]any
				if item.Input != nil {
					_ = json.Unmarshal(item.Input, &input)
				}
				trySend(ch, Message{
					Type:   MessageToolUse,
					Tool:   item.ToolName,
					CallID: item.ID,
					Input:  input,
				})
			case "tool_result":
				outputStr := ""
				if item.Content != nil {
					outputStr = string(item.Content)
				}
				outputStr = stripSystemTags(outputStr)
				if outputStr != "" && !isPureAPINoise(outputStr) {
					output.WriteString(outputStr)
					trySend(ch, Message{
						Type:   MessageToolResult,
						Tool:   item.ToolName,
						CallID: item.ToolUseID,
						Output: outputStr,
					})
				} else {
					trySend(ch, Message{
						Type:   MessageToolResult,
						Tool:   item.ToolName,
						CallID: item.ToolUseID,
						Output: "",
					})
				}
			}
		}
	}

	if sessionID == "" {
		sessionID = parseSessionFromTrailer(rawOutput)
	}

	if scanErr := scanner.Err(); scanErr != nil {
		b.cfg.Logger.Warn("kimi stdout scanner error", "error", scanErr)
		if finalStatus == "completed" {
			finalStatus = "failed"
			finalError = fmt.Sprintf("stdout read error: %v", scanErr)
		}
	}

	if output.Len() == 0 {
		finalStatus = "no-output"
		finalError = "kimi returned empty output"
	}

	if b.cfg.Logger != nil {
		b.cfg.Logger.Info("kimi processOutput result", "status", finalStatus, "output_len", output.Len(), "output_preview", truncateString(output.String(), 500))
	}

	return eventResult{
		status:    finalStatus,
		errMsg:    finalError,
		output:    output.String(),
		sessionID: sessionID,
		usage:     usage,
	}
}

func stripSystemTags(text string) string {
	result := text
	for {
		start := strings.Index(result, "<system>")
		if start < 0 {
			break
		}
		end := strings.Index(result[start:], "</system>")
		if end < 0 {
			break
		}
		end += start + len("</system>")
		result = result[:start] + result[end:]
	}
	result = strings.TrimSpace(result)

	result = stripAPINoise(result)
	result = strings.TrimSpace(result)
	return result
}

func stripAPINoise(text string) string {
	if text == "" {
		return ""
	}
	text = removeJSONObjects(text)
	lines := strings.Split(text, "\n")
	var cleaned []string
	taskPattern := []string{"# Task Assignment", "## Quick Start", "Run multica issue get", "Issue ID:", "Trigger:", "multica issue get", "**Issue ID:**", "**Triggering comment ID:**", "**Trigger:**", "Triggering comment ID:"}

	for _, line := range lines {
		line = strings.TrimRight(line, " \t")
		if line == "" {
			continue
		}
		if isLineNumber(line) {
			continue
		}
		taskCount := 0
		for _, pattern := range taskPattern {
			if strings.Contains(line, pattern) {
				taskCount++
			}
		}
		if taskCount >= 1 {
			continue
		}
		cleaned = append(cleaned, line)
	}
	return strings.Join(cleaned, "\n")
}

func isLineNumber(line string) bool {
	trimmed := strings.TrimSpace(line)
	if trimmed == "" {
		return false
	}
	for _, c := range trimmed {
		if c < '0' || c > '9' {
			return false
		}
	}
	return len(trimmed) <= 4
}

func removeJSONObjects(text string) string {
	if text == "" {
		return ""
	}
	result := text
	for {
		obj, startIdx, endIdx := findLargestJSONObject(result)
		if obj == "" {
			break
		}
		if isAPIJSONObject(obj) {
			result = result[:startIdx] + result[endIdx:]
		} else {
			break
		}
	}
	return result
}

func findLargestJSONObject(s string) (string, int, int) {
	start := -1
	depth := 0
	inString := false
	escapeNext := false
	for i := 0; i < len(s); i++ {
		c := s[i]
		if escapeNext {
			escapeNext = false
			continue
		}
		if c == '\\' && inString {
			escapeNext = true
			continue
		}
		if c == '"' {
			inString = !inString
			continue
		}
		if inString {
			continue
		}
		if c == '{' || c == '[' {
			if start == -1 {
				start = i
			}
			if c == '{' {
				depth++
			}
		} else if c == '}' || c == ']' {
			if c == '}' {
				depth--
			}
			if depth == 0 && start != -1 {
				return s[start : i+1], start, i + 1
			}
		}
	}
	return "", -1, -1
}

func isAPIJSONObject(jsonStr string) bool {
	if jsonStr == "" {
		return false
	}
	if !strings.HasPrefix(strings.TrimSpace(jsonStr), "{") {
		return false
	}
	apiFields := []string{"\"assignee_id\"", "\"workspace_id\"", "\"creator_id\"", "\"issue_id\"", "\"task_id\"", "\"session_id\""}
	matchCount := 0
	for _, field := range apiFields {
		if strings.Contains(jsonStr, field) {
			matchCount++
		}
	}
	return matchCount >= 2
}

func isPureAPINoise(text string) bool {
	if text == "" {
		return false
	}
	text = strings.TrimSpace(text)
	cleaned := removeJSONObjects(text)
	if cleaned == "" {
		return true
	}
	lines := strings.Split(cleaned, "\n")
	if len(lines) == 0 {
		return true
	}
	noiseLineCount := 0
	validLineCount := 0
	taskPatterns := []string{"# Task Assignment", "## Quick Start", "Run multica issue get", "Issue ID:", "Trigger:", "multica issue get", "**Issue ID:**", "**Triggering comment ID:**", "**Trigger:**", "Triggering comment ID:"}
	pureContentPatterns := []string{"你好", "我是", "能力", "可以", "代码", "开发", "调试", "帮助", "工作", "任务", "问题", "解决", "请", "已", "完成", "进行", "中", "的了", "吗", "是"}
	_ = noiseLineCount // kept for future use
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if isLineNumber(line) {
			continue
		}
		taskCount := 0
		for _, pattern := range taskPatterns {
			if strings.Contains(line, pattern) {
				taskCount++
			}
		}
		if taskCount >= 1 {
			continue
		}
		hasPureContent := false
		for _, pattern := range pureContentPatterns {
			if strings.Contains(line, pattern) {
				hasPureContent = true
				break
			}
		}
		if !hasPureContent && len(line) < 5 {
			continue
		}
		validLineCount++
	}
	if validLineCount == 0 {
		return true
	}
	return false
}

type kimiResponse struct {
	Role      string        `json:"role"`
	Content   []kimiContent `json:"content"`
	SessionID string        `json:"session_id,omitempty"`
}

type kimiContent struct {
	Type      string          `json:"type"`
	ID        string          `json:"id,omitempty"`
	ToolName  string          `json:"tool_name,omitempty"`
	ToolUseID string          `json:"tool_use_id,omitempty"`
	Thinking  string          `json:"think,omitempty"`
	Text      string          `json:"text,omitempty"`
	Input     json.RawMessage `json:"input,omitempty"`
	Content   json.RawMessage `json:"content,omitempty"`
}

func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}

var sessionIDRegex = regexp.MustCompile(`kimi -r ([a-f0-9-]+)`)

func parseSessionFromTrailer(data []byte) string {
	matches := sessionIDRegex.FindSubmatch(data)
	if len(matches) >= 2 {
		return string(matches[1])
	}
	return ""
}

// extractKimiWireUsage reads the wire.jsonl from the kimi session directory
// and extracts cumulative token usage from StatusUpdate events.
//
// Kimi stores session data at: ~/.kimi/sessions/{md5(cwd)}/{sessionID}/wire.jsonl
// Each StatusUpdate event contains a token_usage field with:
//   - input_other:         non-cached input tokens
//   - output:              output tokens
//   - input_cache_read:    tokens read from prompt cache
//   - input_cache_creation: tokens written to prompt cache
func extractKimiWireUsage(cwd, sessionID string) *TokenUsage {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil
	}
	hash := fmt.Sprintf("%x", md5.Sum([]byte(cwd)))
	wirePath := filepath.Join(homeDir, ".kimi", "sessions", hash, sessionID, "wire.jsonl")

	f, err := os.Open(wirePath)
	if err != nil {
		return nil
	}
	defer f.Close()

	var total TokenUsage
	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 0, 1024*1024), 10*1024*1024)
	for scanner.Scan() {
		var entry kimiWireEntry
		if err := json.Unmarshal(scanner.Bytes(), &entry); err != nil {
			continue
		}
		if entry.Message.Type != "StatusUpdate" {
			continue
		}
		tu := entry.Message.Payload.TokenUsage
		if tu == nil {
			continue
		}
		total.InputTokens += tu.InputOther + tu.InputCacheRead + tu.InputCacheCreation
		total.OutputTokens += tu.Output
		total.CacheReadTokens += tu.InputCacheRead
		total.CacheWriteTokens += tu.InputCacheCreation
	}

	if total.InputTokens == 0 && total.OutputTokens == 0 {
		return nil
	}
	return &total
}

// kimiWireEntry represents a single line in wire.jsonl.
type kimiWireEntry struct {
	Message kimiWireMessage `json:"message"`
}

type kimiWireMessage struct {
	Type    string          `json:"type"`
	Payload kimiWirePayload `json:"payload"`
}

type kimiWirePayload struct {
	TokenUsage *kimiWireTokenUsage `json:"token_usage,omitempty"`
}

type kimiWireTokenUsage struct {
	InputOther         int64 `json:"input_other"`
	Output             int64 `json:"output"`
	InputCacheRead     int64 `json:"input_cache_read"`
	InputCacheCreation int64 `json:"input_cache_creation"`
}
