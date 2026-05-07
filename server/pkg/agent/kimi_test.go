package agent

import (
	"crypto/md5"
	"encoding/json"
	"fmt"
	"testing"
)

func TestExtractKimiWireUsage_NonExistentPath(t *testing.T) {
	usage := extractKimiWireUsage("/nonexistent/path", "nonexistent-session")
	if usage != nil {
		t.Errorf("expected nil for nonexistent path, got %+v", usage)
	}
}

func TestKimiWireTokenUsageParsing(t *testing.T) {
	// Test the JSON parsing types directly
	input := `{"input_other": 2580, "output": 75, "input_cache_read": 9216, "input_cache_creation": 100}`

	var tu kimiWireTokenUsage
	if err := json.Unmarshal([]byte(input), &tu); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}

	if tu.InputOther != 2580 {
		t.Errorf("InputOther = %d, want 2580", tu.InputOther)
	}
	if tu.Output != 75 {
		t.Errorf("Output = %d, want 75", tu.Output)
	}
	if tu.InputCacheRead != 9216 {
		t.Errorf("InputCacheRead = %d, want 9216", tu.InputCacheRead)
	}
	if tu.InputCacheCreation != 100 {
		t.Errorf("InputCacheCreation = %d, want 100", tu.InputCacheCreation)
	}
}

func TestKimiWireEntryParsing(t *testing.T) {
	input := `{"timestamp": 1777363578.141, "message": {"type": "StatusUpdate", "payload": {"token_usage": {"input_other": 2580, "output": 75, "input_cache_read": 9216, "input_cache_creation": 0}}}}`

	var entry kimiWireEntry
	if err := json.Unmarshal([]byte(input), &entry); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}

	if entry.Message.Type != "StatusUpdate" {
		t.Errorf("type = %q, want StatusUpdate", entry.Message.Type)
	}
	if entry.Message.Payload.TokenUsage == nil {
		t.Fatal("TokenUsage should not be nil")
	}
	if entry.Message.Payload.TokenUsage.InputOther != 2580 {
		t.Errorf("InputOther = %d, want 2580", entry.Message.Payload.TokenUsage.InputOther)
	}
}

func TestKimiSessionHashConsistency(t *testing.T) {
	cwd := "/home/ubuntu/multica_workspaces_user-ffd8723e/e36eef34-fc31-4591-8a55-0e955676e981/23f78b4b/workdir"
	hash := fmt.Sprintf("%x", md5.Sum([]byte(cwd)))

	expectedHash := "03f789b96bf2ae2e21c664d899c51fc5"
	if hash != expectedHash {
		t.Errorf("hash = %q, want %q", hash, expectedHash)
	}
}
