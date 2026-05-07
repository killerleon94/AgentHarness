package usage

import (
	"log/slog"
	"os"
	"path/filepath"
	"testing"
)

func TestParseKimiFile(t *testing.T) {
	tmp := t.TempDir()
	sessionDir := filepath.Join(tmp, "aabbccdd", "session-123")
	if err := os.MkdirAll(sessionDir, 0o755); err != nil {
		t.Fatal(err)
	}

	// Real wire.jsonl format with StatusUpdate events
	content := `{"type": "metadata", "protocol_version": "1.9"}
{"timestamp": 1777363573.847, "message": {"type": "TurnBegin", "payload": {"user_input": "hello"}}}
{"timestamp": 1777363578.141, "message": {"type": "StatusUpdate", "payload": {"context_usage": 0.044, "context_tokens": 11796, "max_context_tokens": 262144, "token_usage": {"input_other": 2580, "output": 75, "input_cache_read": 9216, "input_cache_creation": 0}, "message_id": "chatcmpl-abc"}}}
{"timestamp": 1777363584.028, "message": {"type": "StatusUpdate", "payload": {"context_usage": 0.046, "context_tokens": 12156, "max_context_tokens": 262144, "token_usage": {"input_other": 380, "output": 129, "input_cache_read": 11776, "input_cache_creation": 0}, "message_id": "chatcmpl-def"}}}
`
	wirePath := filepath.Join(sessionDir, "wire.jsonl")
	if err := os.WriteFile(wirePath, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}

	s := NewScanner(slog.Default())
	record := s.parseKimiFile(wirePath)

	if record == nil {
		t.Fatal("expected non-nil record")
	}

	// Date should be extracted from timestamp
	if record.Date == "" {
		t.Error("date should not be empty")
	}

	if record.Provider != "kimi" {
		t.Errorf("provider = %q, want %q", record.Provider, "kimi")
	}
	if record.Model != "kimi-for-coding" {
		t.Errorf("model = %q, want %q", record.Model, "kimi-for-coding")
	}

	// input_other(2580+380) + input_cache_read(9216+11776) + input_cache_creation(0)
	expectedInput := int64(2580 + 380 + 9216 + 11776)
	if record.InputTokens != expectedInput {
		t.Errorf("input_tokens = %d, want %d", record.InputTokens, expectedInput)
	}

	expectedOutput := int64(75 + 129)
	if record.OutputTokens != expectedOutput {
		t.Errorf("output_tokens = %d, want %d", record.OutputTokens, expectedOutput)
	}

	expectedCacheRead := int64(9216 + 11776)
	if record.CacheReadTokens != expectedCacheRead {
		t.Errorf("cache_read_tokens = %d, want %d", record.CacheReadTokens, expectedCacheRead)
	}

	if record.CacheWriteTokens != 0 {
		t.Errorf("cache_write_tokens = %d, want 0", record.CacheWriteTokens)
	}
}

func TestParseKimiFile_WithCacheCreation(t *testing.T) {
	tmp := t.TempDir()
	sessionDir := filepath.Join(tmp, "aabbccdd", "session-456")
	if err := os.MkdirAll(sessionDir, 0o755); err != nil {
		t.Fatal(err)
	}

	content := `{"timestamp": 1777363578.141, "message": {"type": "StatusUpdate", "payload": {"token_usage": {"input_other": 1000, "output": 200, "input_cache_read": 500, "input_cache_creation": 300}}}}
`
	wirePath := filepath.Join(sessionDir, "wire.jsonl")
	if err := os.WriteFile(wirePath, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}

	s := NewScanner(slog.Default())
	record := s.parseKimiFile(wirePath)

	if record == nil {
		t.Fatal("expected non-nil record")
	}

	expectedInput := int64(1000 + 500 + 300)
	if record.InputTokens != expectedInput {
		t.Errorf("input_tokens = %d, want %d", record.InputTokens, expectedInput)
	}
	if record.CacheWriteTokens != 300 {
		t.Errorf("cache_write_tokens = %d, want 300", record.CacheWriteTokens)
	}
}

func TestParseKimiFile_NoUsage(t *testing.T) {
	tmp := t.TempDir()
	sessionDir := filepath.Join(tmp, "aabbccdd", "session-789")
	if err := os.MkdirAll(sessionDir, 0o755); err != nil {
		t.Fatal(err)
	}

	content := `{"type": "metadata", "protocol_version": "1.9"}
{"timestamp": 1777363573.847, "message": {"type": "TurnBegin", "payload": {"user_input": "hello"}}}
`
	wirePath := filepath.Join(sessionDir, "wire.jsonl")
	if err := os.WriteFile(wirePath, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}

	s := NewScanner(slog.Default())
	record := s.parseKimiFile(wirePath)

	if record != nil {
		t.Errorf("expected nil record for no usage, got %+v", record)
	}
}

func TestParseKimiFile_NonExistent(t *testing.T) {
	s := NewScanner(slog.Default())
	record := s.parseKimiFile("/nonexistent/path/wire.jsonl")

	if record != nil {
		t.Errorf("expected nil for non-existent file, got %+v", record)
	}
}

func TestKimiWireDate(t *testing.T) {
	// 1777363573.847 ≈ 2026-04-28 (Unix timestamp)
	got := kimiWireDate(1777363573.847)
	if got == "" {
		t.Error("expected non-empty date")
	}
	// Just verify it returns a valid date format
	if len(got) != 10 || got[4] != '-' || got[7] != '-' {
		t.Errorf("date format = %q, want YYYY-MM-DD", got)
	}
}
