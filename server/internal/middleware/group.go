package middleware

import (
	"context"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

type groupContextKey int

const (
	ctxKeyGroupID groupContextKey = iota
	ctxKeyGroupMemberRole
)

func GroupIDFromContext(ctx context.Context) string {
	id, _ := ctx.Value(ctxKeyGroupID).(string)
	return id
}

func GroupMemberRoleFromContext(ctx context.Context) string {
	role, _ := ctx.Value(ctxKeyGroupMemberRole).(string)
	return role
}

// RequireGroupMember checks that the requesting user is a member of the group.
// It injects the group ID and member role into the context.
func RequireGroupMember(queries *db.Queries) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			groupID := chi.URLParam(r, "id")
			if groupID == "" {
				writeError(w, http.StatusBadRequest, "group_id is required")
				return
			}

			userID := r.Header.Get("X-User-ID")
			if userID == "" {
				writeError(w, http.StatusUnauthorized, "user not authenticated")
				return
			}

			// System admins bypass group membership check
			userRole := r.Header.Get("X-User-Role")
			if userRole == "admin" {
				ctx := context.WithValue(r.Context(), ctxKeyGroupID, groupID)
				ctx = context.WithValue(ctx, ctxKeyGroupMemberRole, "admin")
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}

			// Workspace admins/owners bypass membership check
			workspaceID := WorkspaceIDFromContext(r.Context())
			if workspaceID != "" {
				member, err := queries.GetMemberByUserAndWorkspace(r.Context(), db.GetMemberByUserAndWorkspaceParams{
					UserID:      parseUUID(userID),
					WorkspaceID: parseUUID(workspaceID),
				})
				if err == nil && (member.Role == "owner" || member.Role == "admin") {
					ctx := context.WithValue(r.Context(), ctxKeyGroupID, groupID)
					ctx = context.WithValue(ctx, ctxKeyGroupMemberRole, member.Role)
					next.ServeHTTP(w, r.WithContext(ctx))
					return
				}
			}

			// Check group membership
			gm, err := queries.GetGroupMemberByGroupAndMember(r.Context(), db.GetGroupMemberByGroupAndMemberParams{
				GroupID:    parseUUID(groupID),
				MemberType: "member",
				MemberID:   parseUUID(userID),
			})
			if err != nil {
				writeError(w, http.StatusForbidden, "access denied")
				return
			}

			ctx := context.WithValue(r.Context(), ctxKeyGroupID, groupID)
			ctx = context.WithValue(ctx, ctxKeyGroupMemberRole, gm.Role)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func parseUUID(s string) pgtype.UUID {
	var u pgtype.UUID
	u.Scan(s)
	return u
}
