package middleware

import (
	"log/slog"
	"net/http"
)

// RequireAdmin is a middleware that checks X-User-Role header for 'admin' role.
// It must run after Auth middleware which sets X-User-Role.
func RequireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		role := r.Header.Get("X-User-Role")
		if role != "admin" {
			slog.Warn("admin: access denied", "path", r.URL.Path, "role", role)
			http.Error(w, `{"error":"admin access required"}`, http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}
