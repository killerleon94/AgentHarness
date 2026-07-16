package main

import (
	"context"
	"log/slog"
	"os"

	"github.com/jackc/pgx/v5/pgtype"
	"golang.org/x/crypto/bcrypt"

	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

// ensureAdminUser checks if an active admin exists. If not, it creates one
// from environment variables.
func ensureAdminUser(ctx context.Context, queries *db.Queries) {
	hasAdmin, err := queries.HasAdminUser(ctx)
	if err != nil {
		slog.Error("failed to check for admin user", "error", err)
		os.Exit(1)
	}

	if hasAdmin {
		slog.Info("admin user already exists, skipping initialization")
		return
	}

	email := os.Getenv("ADMIN_EMAIL")
	if email == "" {
		email = "admin@agent.com"
	}

	password := os.Getenv("ADMIN_PASSWORD")
	if password == "" {
		password = "admin@agent"
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		slog.Error("failed to hash admin password", "error", err)
		os.Exit(1)
	}

	_, err = queries.CreateAdminUser(ctx, db.CreateAdminUserParams{
		Name:         "Admin",
		Email:        email,
		PasswordHash: pgtype.Text{String: string(hash), Valid: true},
	})
	if err != nil {
		slog.Error("failed to create admin user", "error", err)
		os.Exit(1)
	}

	slog.Info("admin user created", "email", email)
}
