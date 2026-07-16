package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func setupAdminTestWorkspace(t *testing.T, name, slug string) string {
	t.Helper()
	ctx := context.Background()
	var workspaceID string
	err := testPool.QueryRow(ctx, `
		INSERT INTO workspace (name, slug, description, issue_prefix)
		VALUES ($1, $2, $3, $4)
		RETURNING id
	`, name, slug, "workspace for admin tests", "ADM").Scan(&workspaceID)
	if err != nil {
		t.Fatalf("failed to create test workspace: %v", err)
	}
	t.Cleanup(func() {
		testPool.Exec(context.Background(), `DELETE FROM workspace WHERE id = $1`, workspaceID)
	})
	return workspaceID
}

func setupAdminTestMember(t *testing.T, workspaceID, userID, role string) {
	t.Helper()
	ctx := context.Background()
	_, err := testPool.Exec(ctx, `
		INSERT INTO member (workspace_id, user_id, role)
		VALUES ($1, $2, $3)
	`, workspaceID, userID, role)
	if err != nil {
		t.Fatalf("failed to create test member: %v", err)
	}
	t.Cleanup(func() {
		testPool.Exec(context.Background(), `DELETE FROM member WHERE workspace_id = $1 AND user_id = $2`, workspaceID, userID)
	})
}

func TestDisableWorkspace(t *testing.T) {
	wsID := setupAdminTestWorkspace(t, "Disable Test", "disable-test")
	req := newRequest("POST", "/api/admin/workspaces/"+wsID+"/disable", nil)
	req = withURLParam(req, "id", wsID)
	req.Header.Set("X-User-Role", "admin")
	w := httptest.NewRecorder()

	testHandler.DisableWorkspace(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("DisableWorkspace: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp WorkspaceResponse
	json.NewDecoder(w.Body).Decode(&resp)
	if !resp.Disabled {
		t.Fatal("DisableWorkspace: expected disabled=true")
	}
}

func TestDisableWorkspace_NonAdmin(t *testing.T) {
	wsID := setupAdminTestWorkspace(t, "Disable NonAdmin", "disable-nonadmin")
	req := newRequest("POST", "/api/admin/workspaces/"+wsID+"/disable", nil)
	req = withURLParam(req, "id", wsID)
	w := httptest.NewRecorder()

	// RequireAdmin middleware checks X-User-Role; without it handler has no role check
	// but workspace middleware will still block non-admin access to disabled workspaces.
	// This test verifies the handler returns 200 when called directly (middleware does the enforcement).
	testHandler.DisableWorkspace(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("DisableWorkspace non-admin handler: expected 200 (middleware enforces admin), got %d: %s", w.Code, w.Body.String())
	}
}

func TestDisableWorkspace_NotFound(t *testing.T) {
	req := newRequest("POST", "/api/admin/workspaces/00000000-0000-0000-0000-000000000000/disable", nil)
	req = withURLParam(req, "id", "00000000-0000-0000-0000-000000000000")
	req.Header.Set("X-User-Role", "admin")
	w := httptest.NewRecorder()

	testHandler.DisableWorkspace(w, req)
	if w.Code != http.StatusNotFound {
		t.Fatalf("DisableWorkspace not found: expected 404, got %d: %s", w.Code, w.Body.String())
	}
}

func TestDisableWorkspace_AlreadyDisabled(t *testing.T) {
	ctx := context.Background()
	wsID := setupAdminTestWorkspace(t, "Disable Already", "disable-already")
	_, err := testPool.Exec(ctx, `UPDATE workspace SET disabled = true WHERE id = $1`, wsID)
	if err != nil {
		t.Fatalf("failed to pre-disable workspace: %v", err)
	}

	req := newRequest("POST", "/api/admin/workspaces/"+wsID+"/disable", nil)
	req = withURLParam(req, "id", wsID)
	req.Header.Set("X-User-Role", "admin")
	w := httptest.NewRecorder()

	testHandler.DisableWorkspace(w, req)
	if w.Code != http.StatusConflict {
		t.Fatalf("DisableWorkspace already disabled: expected 409, got %d: %s", w.Code, w.Body.String())
	}
}

func TestEnableWorkspace(t *testing.T) {
	ctx := context.Background()
	wsID := setupAdminTestWorkspace(t, "Enable Test", "enable-test")
	_, err := testPool.Exec(ctx, `UPDATE workspace SET disabled = true WHERE id = $1`, wsID)
	if err != nil {
		t.Fatalf("failed to pre-disable workspace: %v", err)
	}

	req := newRequest("POST", "/api/admin/workspaces/"+wsID+"/enable", nil)
	req = withURLParam(req, "id", wsID)
	req.Header.Set("X-User-Role", "admin")
	w := httptest.NewRecorder()

	testHandler.EnableWorkspace(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("EnableWorkspace: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp WorkspaceResponse
	json.NewDecoder(w.Body).Decode(&resp)
	if resp.Disabled {
		t.Fatal("EnableWorkspace: expected disabled=false")
	}
}

func TestEnableWorkspace_NotDisabled(t *testing.T) {
	wsID := setupAdminTestWorkspace(t, "Enable NotDisabled", "enable-notdisabled")
	req := newRequest("POST", "/api/admin/workspaces/"+wsID+"/enable", nil)
	req = withURLParam(req, "id", wsID)
	req.Header.Set("X-User-Role", "admin")
	w := httptest.NewRecorder()

	testHandler.EnableWorkspace(w, req)
	if w.Code != http.StatusConflict {
		t.Fatalf("EnableWorkspace not disabled: expected 409, got %d: %s", w.Code, w.Body.String())
	}
}

func TestListWorkspaces_DisabledFiltering(t *testing.T) {
	enabledWS := setupAdminTestWorkspace(t, "List Enabled", "list-enabled")
	disabledWS := setupAdminTestWorkspace(t, "List Disabled", "list-disabled")
	ctx := context.Background()
	_, err := testPool.Exec(ctx, `UPDATE workspace SET disabled = true WHERE id = $1`, disabledWS)
	if err != nil {
		t.Fatalf("failed to pre-disable workspace: %v", err)
	}
	setupAdminTestMember(t, enabledWS, testUserID, "member")
	setupAdminTestMember(t, disabledWS, testUserID, "member")

	req := newRequest("GET", "/api/workspaces", nil)
	w := httptest.NewRecorder()

	testHandler.ListWorkspaces(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("ListWorkspaces: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp []WorkspaceResponse
	json.NewDecoder(w.Body).Decode(&resp)

	for _, ws := range resp {
		if ws.ID == disabledWS {
			t.Fatal("ListWorkspaces: non-admin user should not see disabled workspace")
		}
	}
}

func TestListWorkspaces_AdminSeesAll(t *testing.T) {
	enabledWS := setupAdminTestWorkspace(t, "Admin List Enabled", "admin-list-enabled")
	disabledWS := setupAdminTestWorkspace(t, "Admin List Disabled", "admin-list-disabled")
	ctx := context.Background()
	_, err := testPool.Exec(ctx, `UPDATE workspace SET disabled = true WHERE id = $1`, disabledWS)
	if err != nil {
		t.Fatalf("failed to pre-disable workspace: %v", err)
	}

	req := newRequest("GET", "/api/workspaces", nil)
	req.Header.Set("X-User-Role", "admin")
	w := httptest.NewRecorder()

	testHandler.ListWorkspaces(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("ListWorkspaces admin: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp []WorkspaceResponse
	json.NewDecoder(w.Body).Decode(&resp)

	seen := map[string]bool{enabledWS: false, disabledWS: false}
	for _, ws := range resp {
		if ws.ID == enabledWS || ws.ID == disabledWS {
			seen[ws.ID] = true
		}
	}
	for id, found := range seen {
		if !found {
			t.Fatalf("ListWorkspaces admin: missing workspace %s", id)
		}
	}
}
