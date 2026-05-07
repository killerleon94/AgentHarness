package usage

import (
	"bufio"
	"encoding/json"
	"os"
	"path/filepath"
	"time"
)

// scanKimi reads Kimi CLI session logs from ~/.kimi/sessions/{hash}/{sessionID}/wire.jsonl
// and extracts token usage from StatusUpdate events.
func (s *Scanner) scanKimi() []Record {
	root := kimiLogRoot()
	if root == "" {
		return nil
	}

	// Glob for wire.jsonl files: ~/.kimi/sessions/*/*/wire.jsonl
	pattern := filepath.Join(root, "*", "*", "wire.jsonl")
	files, err := filepath.Glob(pattern)
	if err != nil {
		s.logger.Debug("kimi glob error", "error", err)
		return nil
	}

	var allRecords []Record
	for _, f := range files {
		record := s.parseKimiFile(f)
		if record != nil {
			allRecords = append(allRecords, *record)
		}
	}

	return mergeRecords(allRecords)
}

// kimiLogRoot returns the Kimi sessions directory.
func kimiLogRoot() string {
	if kimiHome := os.Getenv("KIMI_HOME"); kimiHome != "" {
		dir := filepath.Join(kimiHome, "sessions")
		if info, err := os.Stat(dir); err == nil && info.IsDir() {
			return dir
		}
	}

	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}

	dir := filepath.Join(home, ".kimi", "sessions")
	if info, err := os.Stat(dir); err == nil && info.IsDir() {
		return dir
	}
	return ""
}

// kimiWireLine represents a line in wire.jsonl.
type kimiWireLine struct {
	Timestamp float64     `json:"timestamp"`
	Message   kimiWireMsg `json:"message"`
}

type kimiWireMsg struct {
	Type    string          `json:"type"`
	Payload kimiWirePayload `json:"payload"`
}

type kimiWirePayload struct {
	TokenUsage *kimiTokenUsage `json:"token_usage,omitempty"`
}

type kimiTokenUsage struct {
	InputOther         int64 `json:"input_other"`
	Output             int64 `json:"output"`
	InputCacheRead     int64 `json:"input_cache_read"`
	InputCacheCreation int64 `json:"input_cache_creation"`
}

// parseKimiFile extracts token usage from a Kimi wire.jsonl session file.
// It sums all StatusUpdate token_usage entries (each is per-step, not cumulative).
func (s *Scanner) parseKimiFile(path string) *Record {
	f, err := os.Open(path)
	if err != nil {
		return nil
	}
	defer f.Close()

	date := ""
	var total TokenUsageAccum
	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 0, 256*1024), 1024*1024)

	for scanner.Scan() {
		line := scanner.Bytes()
		if !bytesContains(line, `"StatusUpdate"`) || !bytesContains(line, `"token_usage"`) {
			// Also check for timestamp in non-StatusUpdate lines to get the date
			if date == "" && bytesContains(line, `"timestamp"`) {
				var entry kimiWireLine
				if json.Unmarshal(line, &entry) == nil && entry.Timestamp > 0 {
					date = kimiWireDate(entry.Timestamp)
				}
			}
			continue
		}

		var entry kimiWireLine
		if err := json.Unmarshal(line, &entry); err != nil {
			continue
		}
		if date == "" && entry.Timestamp > 0 {
			date = kimiWireDate(entry.Timestamp)
		}
		if entry.Message.Type != "StatusUpdate" || entry.Message.Payload.TokenUsage == nil {
			continue
		}

		tu := entry.Message.Payload.TokenUsage
		total.inputOther += tu.InputOther
		total.output += tu.Output
		total.cacheRead += tu.InputCacheRead
		total.cacheWrite += tu.InputCacheCreation
	}

	if date == "" {
		if info, err := os.Stat(path); err == nil {
			date = info.ModTime().Local().Format("2006-01-02")
		}
	}
	if date == "" || (total.inputOther+total.cacheRead+total.cacheWrite == 0 && total.output == 0) {
		return nil
	}

	return &Record{
		Date:             date,
		Provider:         "kimi",
		Model:            "kimi-for-coding",
		InputTokens:      total.inputOther + total.cacheRead + total.cacheWrite,
		OutputTokens:     total.output,
		CacheReadTokens:  total.cacheRead,
		CacheWriteTokens: total.cacheWrite,
	}
}

// TokenUsageAccum accumulates token usage across steps.
type TokenUsageAccum struct {
	inputOther int64
	output     int64
	cacheRead  int64
	cacheWrite int64
}

// kimiWireDate extracts the date from a wire.jsonl Unix timestamp.
func kimiWireDate(ts float64) string {
	if ts == 0 {
		return ""
	}
	t := time.Unix(int64(ts), int64((ts-float64(int64(ts)))*1e9))
	return t.UTC().Format("2006-01-02")
}
