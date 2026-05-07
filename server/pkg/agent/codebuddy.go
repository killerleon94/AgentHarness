package agent

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os/exec"
	"strings"
	"time"
)

type codebuddyBackend struct {
	cfg Config
}

func (b *codebuddyBackend) Execute(ctx context.Context, prompt string, opts ExecOptions) (*Session, error) {
	execPath := b.cfg.ExecutablePath
	if execPath == "" {
		execPath = "codebuddy"
	}
	if _, err := exec.LookPath(execPath); err != nil {
		return nil, fmt.Errorf("codebuddy executable not found at %q: %w", execPath, err)
	}

	timeout := opts.Timeout
	if timeout == 0 {
		timeout = 20 * time.Minute
	}
	runCtx, cancel := context.WithTimeout(ctx, timeout)

	args := []string{"-p", "--output-format", "stream-json", "-y"}
	if opts.Model != "" {
		args = append(args, "--model", opts.Model)
	}
	if opts.SystemPrompt != "" {
		args = append(args, "--append-system-prompt", opts.SystemPrompt)
	}
	if opts.MaxTurns > 0 {
		args = append(args, "--max-turns", fmt.Sprintf("%d", opts.MaxTurns))
	}
	if opts.ResumeSessionID != "" {
		args = append(args, "--resume", opts.ResumeSessionID)
	}
	args = append(args, prompt)

	cmd := exec.CommandContext(runCtx, execPath, args...)
	if opts.Cwd != "" {
		cmd.Dir = opts.Cwd
	}

	cmd.Env = buildEnv(b.cfg.Env)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		cancel()
		return nil, fmt.Errorf("codebuddy stdout pipe: %w", err)
	}
	cmd.Stderr = newLogWriter(b.cfg.Logger, "[codebuddy:stderr] ")

	if err := cmd.Start(); err != nil {
		cancel()
		return nil, fmt.Errorf("start codebuddy: %w", err)
	}

	b.cfg.Logger.Info("codebuddy started", "pid", cmd.Process.Pid, "cwd", opts.Cwd, "model", opts.Model)

	msgCh := make(chan Message, 256)
	resCh := make(chan Result, 1)

	go func() {
		defer cancel()
		defer close(msgCh)
		defer close(resCh)

		startTime := time.Now()
		scanResult := b.processEvents(stdout, msgCh)

		exitErr := cmd.Wait()
		duration := time.Since(startTime)

		if runCtx.Err() == context.DeadlineExceeded {
			scanResult.status = "timeout"
			scanResult.errMsg = fmt.Sprintf("codebuddy timed out after %s", timeout)
		} else if runCtx.Err() == context.Canceled {
			scanResult.status = "aborted"
			scanResult.errMsg = "execution cancelled"
		} else if exitErr != nil && scanResult.status == "completed" {
			scanResult.status = "failed"
			scanResult.errMsg = fmt.Sprintf("codebuddy exited with error: %v", exitErr)
		}

		b.cfg.Logger.Info("codebuddy finished", "pid", cmd.Process.Pid, "status", scanResult.status, "duration", duration.Round(time.Millisecond).String(), "usage", scanResult.usage)

		var usage map[string]TokenUsage
		u := scanResult.usage
		if u.InputTokens > 0 || u.OutputTokens > 0 || u.CacheReadTokens > 0 || u.CacheWriteTokens > 0 {
			model := opts.Model
			if model == "" {
				model = "unknown"
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

type codebuddyEventResult struct {
	status    string
	errMsg    string
	output    string
	sessionID string
	usage     TokenUsage
}

func (b *codebuddyBackend) processEvents(r io.Reader, ch chan<- Message) codebuddyEventResult {
	var output strings.Builder
	var sessionID string
	var usage TokenUsage
	finalStatus := "completed"
	var finalError string

	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 0, 1024*1024), 10*1024*1024)

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}

		var event codebuddyEvent
		if err := json.Unmarshal([]byte(line), &event); err != nil {
			continue
		}

		if event.SessionID != "" {
			sessionID = event.SessionID
		}

		switch event.Type {
		case "init":
			trySend(ch, Message{Type: MessageStatus, Status: "running"})
		case "user":
			b.handleUserMessage(event, ch)
		case "assistant":
			b.handleAssistantMessage(event, ch, &output, &usage)
		case "result":
			if event.Result != "" {
				output.Reset()
				output.WriteString(event.Result)
			}
			if event.TotalCost > 0 || event.InputTokens > 0 || event.OutputTokens > 0 {
				usage.InputTokens += event.InputTokens
				usage.OutputTokens += event.OutputTokens
			}
			if event.IsError {
				finalStatus = "failed"
				finalError = event.Result
			}
		case "error":
			b.handleErrorEvent(event, ch, &finalStatus, &finalError)
		}
	}

	if scanErr := scanner.Err(); scanErr != nil {
		b.cfg.Logger.Warn("codebuddy stdout scanner error", "error", scanErr)
		if finalStatus == "completed" {
			finalStatus = "failed"
			finalError = fmt.Sprintf("stdout read error: %v", scanErr)
		}
	}

	return codebuddyEventResult{
		status:    finalStatus,
		errMsg:    finalError,
		output:    output.String(),
		sessionID: sessionID,
		usage:     usage,
	}
}

func (b *codebuddyBackend) handleUserMessage(event codebuddyEvent, ch chan<- Message) {
	if event.Message == nil {
		return
	}

	for _, block := range event.Message.Content {
		if block.Type == "tool_result" {
			resultStr := ""
			if block.Content != nil {
				resultStr = string(block.Content)
			}
			trySend(ch, Message{
				Type:   MessageToolResult,
				CallID: block.ToolUseID,
				Output: resultStr,
			})
		}
	}
}

func (b *codebuddyBackend) handleAssistantMessage(event codebuddyEvent, ch chan<- Message, output *strings.Builder, usage *TokenUsage) {
	if event.Message == nil {
		return
	}

	if event.Message.Usage != nil && event.Message.Model != "" {
		usage.InputTokens += event.Message.Usage.InputTokens
		usage.OutputTokens += event.Message.Usage.OutputTokens
		usage.CacheReadTokens += event.Message.Usage.CacheReadInputTokens
		usage.CacheWriteTokens += event.Message.Usage.CacheCreationInputTokens
	}

	for _, block := range event.Message.Content {
		switch block.Type {
		case "text":
			if block.Text != "" {
				output.WriteString(block.Text)
				trySend(ch, Message{Type: MessageText, Content: block.Text})
			}
		case "thinking":
			if block.Text != "" {
				trySend(ch, Message{Type: MessageThinking, Content: block.Text})
			}
		case "tool_use":
			var input map[string]any
			if block.Input != nil {
				_ = json.Unmarshal(block.Input, &input)
			}
			trySend(ch, Message{
				Type:   MessageToolUse,
				Tool:   block.Name,
				CallID: block.ID,
				Input:  input,
			})
		}
	}
}

func (b *codebuddyBackend) handleErrorEvent(event codebuddyEvent, ch chan<- Message, finalStatus, finalError *string) {
	errMsg := "unknown codebuddy error"
	if event.Result != "" {
		errMsg = event.Result
	} else if event.Message != nil {
		for _, block := range event.Message.Content {
			if block.Type == "text" && block.Text != "" {
				errMsg = block.Text
				break
			}
		}
	}

	b.cfg.Logger.Warn("codebuddy error event", "error", errMsg)
	trySend(ch, Message{Type: MessageError, Content: errMsg})

	*finalStatus = "failed"
	*finalError = errMsg
}

type codebuddyEvent struct {
	Type         string            `json:"type"`
	SessionID    string            `json:"session_id,omitempty"`
	Message      *codebuddyMessage `json:"message,omitempty"`
	Result       string            `json:"result,omitempty"`
	IsError      bool              `json:"is_error,omitempty"`
	InputTokens  int64             `json:"input_tokens,omitempty"`
	OutputTokens int64             `json:"output_tokens,omitempty"`
	TotalCost    float64           `json:"total_cost_usd,omitempty"`
}

type codebuddyMessage struct {
	Role    string                  `json:"role"`
	Model   string                  `json:"model"`
	Content []codebuddyContentBlock `json:"content"`
	Usage   *codebuddyUsage         `json:"usage,omitempty"`
}

type codebuddyUsage struct {
	InputTokens              int64 `json:"input_tokens"`
	OutputTokens             int64 `json:"output_tokens"`
	CacheReadInputTokens     int64 `json:"cache_read_input_tokens,omitempty"`
	CacheCreationInputTokens int64 `json:"cache_creation_input_tokens,omitempty"`
}

type codebuddyContentBlock struct {
	Type      string          `json:"type"`
	Text      string          `json:"text,omitempty"`
	ID        string          `json:"id,omitempty"`
	Name      string          `json:"name,omitempty"`
	Input     json.RawMessage `json:"input,omitempty"`
	ToolUseID string          `json:"tool_use_id,omitempty"`
	Content   json.RawMessage `json:"content,omitempty"`
}
