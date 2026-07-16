package middleware

import (
	"context"
	"log/slog"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/multica-ai/multica/server/internal/auth"
	"github.com/multica-ai/multica/server/internal/util"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

func uuidToString(u pgtype.UUID) string { return util.UUIDToString(u) }

// Auth middleware validates JWT tokens or Personal Access Tokens from the Authorization header.
// Sets X-User-ID, X-User-Role, X-User-Disabled headers on the request for downstream handlers.
// Rejects disabled users and users who must change their password (except on /auth/change-password).
func Auth(queries *db.Queries) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				slog.Debug("auth: missing authorization header", "path", r.URL.Path)
				http.Error(w, `{"error":"missing authorization header"}`, http.StatusUnauthorized)
				return
			}

			tokenString := strings.TrimPrefix(authHeader, "Bearer ")
			if tokenString == authHeader {
				slog.Debug("auth: invalid format", "path", r.URL.Path)
				http.Error(w, `{"error":"invalid authorization format"}`, http.StatusUnauthorized)
				return
			}

			if queries == nil {
				http.Error(w, `{"error":"invalid token"}`, http.StatusUnauthorized)
				return
			}

			// PAT: tokens starting with "mul_"
			if strings.HasPrefix(tokenString, "mul_") {
				hash := auth.HashToken(tokenString)
				pat, err := queries.GetPersonalAccessTokenByHash(r.Context(), hash)
				if err != nil {
					slog.Warn("auth: invalid PAT", "path", r.URL.Path, "error", err)
					http.Error(w, `{"error":"invalid token"}`, http.StatusUnauthorized)
					return
				}

				userID := uuidToString(pat.UserID)
				r.Header.Set("X-User-ID", userID)

				// Best-effort: update last_used_at
				go queries.UpdatePersonalAccessTokenLastUsed(context.Background(), pat.ID)

				// Look up user state
				if !checkUserState(w, r, queries, userID) {
					return
				}

				next.ServeHTTP(w, r)
				return
			}

			// JWT
			token, err := jwt.Parse(tokenString, func(token *jwt.Token) (any, error) {
				if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, jwt.ErrSignatureInvalid
				}
				return auth.JWTSecret(), nil
			})
			if err != nil || !token.Valid {
				slog.Warn("auth: invalid token", "path", r.URL.Path, "error", err)
				http.Error(w, `{"error":"invalid token"}`, http.StatusUnauthorized)
				return
			}

			claims, ok := token.Claims.(jwt.MapClaims)
			if !ok {
				slog.Warn("auth: invalid claims", "path", r.URL.Path)
				http.Error(w, `{"error":"invalid claims"}`, http.StatusUnauthorized)
				return
			}

			sub, ok := claims["sub"].(string)
			if !ok || strings.TrimSpace(sub) == "" {
				slog.Warn("auth: invalid claims", "path", r.URL.Path)
				http.Error(w, `{"error":"invalid claims"}`, http.StatusUnauthorized)
				return
			}
			r.Header.Set("X-User-ID", sub)
			if email, ok := claims["email"].(string); ok {
				r.Header.Set("X-User-Email", email)
			}

			// Look up user state
			if !checkUserState(w, r, queries, sub) {
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// checkUserState queries the user record for role, disabled, and password_change_required.
// Returns false (and writes error response) if the user is disabled or must change password.
// On success, sets X-User-Role and X-User-Disabled headers.
func checkUserState(w http.ResponseWriter, r *http.Request, queries *db.Queries, userID string) bool {
	var uid pgtype.UUID
	if err := uid.Scan(userID); err != nil {
		slog.Warn("auth: invalid user ID format", "user_id", userID)
		http.Error(w, `{"error":"invalid user ID"}`, http.StatusInternalServerError)
		return false
	}

	user, err := queries.GetUser(r.Context(), uid)
	if err != nil {
		slog.Warn("auth: user not found", "user_id", userID, "error", err)
		http.Error(w, `{"error":"invalid token"}`, http.StatusUnauthorized)
		return false
	}

	if user.Disabled {
		slog.Warn("auth: disabled user", "user_id", userID)
		http.Error(w, `{"error":"account disabled"}`, http.StatusForbidden)
		return false
	}

	if user.PasswordChangeRequired && r.URL.Path != "/auth/change-password" && r.URL.Path != "/api/me" {
		slog.Warn("auth: password change required", "user_id", userID)
		http.Error(w, `{"error":"password change required"}`, http.StatusForbidden)
		return false
	}

	r.Header.Set("X-User-Role", user.Role)

	return true
}
