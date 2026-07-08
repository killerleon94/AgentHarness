package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestWriteJSONEncodesBody(t *testing.T) {
	rec := httptest.NewRecorder()
	writeJSON(rec, http.StatusCreated, map[string]string{"hello": "world"})

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusCreated)
	}
	var got map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("unmarshal body: %v", err)
	}
	if got["hello"] != "world" {
		t.Fatalf("body = %v, want hello=world", got)
	}
}

func TestWriteJSONUnencodableValueReturns500(t *testing.T) {
	rec := httptest.NewRecorder()
	// Channels cannot be JSON-encoded; previously this silently produced a
	// 200 with an empty body. It should now report a 500 error instead.
	writeJSON(rec, http.StatusOK, map[string]any{"bad": make(chan int)})

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
	}
	var got map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("unmarshal body: %v", err)
	}
	if got["error"] == "" {
		t.Fatalf("expected error field in body, got %v", got)
	}
}
