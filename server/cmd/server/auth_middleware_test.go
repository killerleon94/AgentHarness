package main

import (
	"context"
	"io"
	"net/http"
	"testing"

	"github.com/multica-ai/multica/server/internal/util"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

func TestAuthMiddleware_NormalUser(t *testing.T) {
	t.Cleanup(func() { cleanupAuthTestData(t) })
	userID := createAuthTestUser(t, authMiddlewareTestEmail, "user", false, false)
	token := authToken(userID, authMiddlewareTestEmail)

	req, _ := http.NewRequest("GET", testServer.URL+"/api/workspaces", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, _ := http.DefaultClient.Do(req)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		t.Errorf("expected 200, got %d: %s", resp.StatusCode, string(b))
	}
}

func TestAuthMiddleware_DisabledUser(t *testing.T) {
	t.Cleanup(func() { cleanupAuthTestData(t) })
	userID := createAuthTestUser(t, authMiddlewareTestEmail, "user", true, false)
	token := authToken(userID, authMiddlewareTestEmail)

	req, _ := http.NewRequest("GET", testServer.URL+"/api/workspaces", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, _ := http.DefaultClient.Do(req)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusForbidden {
		b, _ := io.ReadAll(resp.Body)
		t.Errorf("expected 403 for disabled, got %d: %s", resp.StatusCode, string(b))
	}
}

func TestAuthMiddleware_PasswordChangeRequired(t *testing.T) {
	t.Cleanup(func() { cleanupAuthTestData(t) })
	userID := createAuthTestUser(t, authMiddlewareTestEmail, "user", false, true)
	token := authToken(userID, authMiddlewareTestEmail)

	req, _ := http.NewRequest("GET", testServer.URL+"/api/workspaces", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, _ := http.DefaultClient.Do(req)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusForbidden {
		b, _ := io.ReadAll(resp.Body)
		t.Errorf("expected 403, got %d: %s", resp.StatusCode, string(b))
	}
}

func TestAuthMiddleware_AdminPasses(t *testing.T) {
	t.Cleanup(func() { cleanupAuthTestData(t) })
	userID := createAuthTestUser(t, authMiddlewareTestEmail, "admin", false, false)
	token := authToken(userID, authMiddlewareTestEmail)

	req, _ := http.NewRequest("GET", testServer.URL+"/api/workspaces", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, _ := http.DefaultClient.Do(req)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		t.Errorf("expected 200 for admin, got %d: %s", resp.StatusCode, string(b))
	}
}

var _ = util.UUIDToString
var _ = db.User{}
var _ = context.Background
