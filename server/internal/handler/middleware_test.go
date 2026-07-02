package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/multica-ai/multica/server/internal/middleware"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

func TestWorkspaceMiddleware_DisabledCheck(t *testing.T) {
	queries := db.New(testPool)
	disabledWS := setupAdminTestWorkspace(t, "Mid Disabled", "mid-disabled")
	enabledWS := setupAdminTestWorkspace(t, "Mid Enabled", "mid-enabled")
	ctx := context.Background()
	testPool.Exec(ctx, `UPDATE workspace SET disabled = true WHERE id = $1`, disabledWS)
	setupAdminTestMember(t, enabledWS, testUserID, "member")
	setupAdminTestMember(t, disabledWS, testUserID, "member")

	// Helper: create a request with the middleware and check the response.
	callWithMiddleware := func(wsID string, role string) int {
		handler := middleware.RequireWorkspaceMemberFromURL(queries, "id")(
			http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			}),
		)

		req := httptest.NewRequest("GET", "/api/workspaces/"+wsID, nil)
		req.Header.Set("X-User-ID", testUserID)
		if role != "" {
			req.Header.Set("X-User-Role", role)
		}
		rctx := chi.NewRouteContext()
		rctx.URLParams.Add("id", wsID)
		req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		return w.Code
	}

	t.Run("non-admin member blocked from disabled workspace", func(t *testing.T) {
		code := callWithMiddleware(disabledWS, "")
		if code != http.StatusForbidden {
			t.Fatalf("expected 403, got %d", code)
		}
	})

	t.Run("non-admin member can access enabled workspace", func(t *testing.T) {
		code := callWithMiddleware(enabledWS, "")
		if code != http.StatusOK {
			t.Fatalf("expected 200, got %d", code)
		}
	})

	t.Run("admin bypasses disabled check", func(t *testing.T) {
		code := callWithMiddleware(disabledWS, "admin")
		if code != http.StatusOK {
			t.Fatalf("expected 200, got %d", code)
		}
	})

	t.Run("non-member cannot access workspace", func(t *testing.T) {
		nonMemberWS := setupAdminTestWorkspace(t, "Mid NonMember", "mid-nonmember")
		code := callWithMiddleware(nonMemberWS, "")
		if code != http.StatusNotFound {
			t.Fatalf("expected 404, got %d", code)
		}
	})
}
