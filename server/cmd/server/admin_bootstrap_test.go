package main

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5/pgtype"
	"golang.org/x/crypto/bcrypt"

	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

const adminTestEmail = "admin-test@agent.com"

// cleanupAdminTest removes admin data created during tests and restores original state.
func cleanupAdminTest(t *testing.T) {
	t.Helper()
	ctx := context.Background()
	// Restore any disabled admins and delete test admin users
	testPool.Exec(ctx, `UPDATE "user" SET disabled = false WHERE role = 'admin'`)
	testPool.Exec(ctx, `DELETE FROM "user" WHERE email = $1`, adminTestEmail)
	// Clean up member records for test admin
	testPool.Exec(ctx, `DELETE FROM member WHERE user_id IN (SELECT id FROM "user" WHERE email = $1)`, adminTestEmail)
}

func TestEnsureAdminUser_FirstBoot(t *testing.T) {
	ctx := context.Background()
	queries := db.New(testPool)

	// Simulate no admin exists: disable all existing admins and delete test user
	testPool.Exec(ctx, `UPDATE "user" SET disabled = true WHERE role = 'admin'`)
	testPool.Exec(ctx, `DELETE FROM "user" WHERE email = $1`, adminTestEmail)
	t.Cleanup(func() { cleanupAdminTest(t) })

	// Set test env vars
	t.Setenv("ADMIN_EMAIL", adminTestEmail)
	t.Setenv("ADMIN_PASSWORD", "test-password")

	// Run the function
	ensureAdminUser(ctx, queries)

	// Verify admin was created
	admin, err := queries.GetUserByEmail(ctx, adminTestEmail)
	if err != nil {
		t.Fatalf("expected admin user to be created, got error: %v", err)
	}
	if admin.Role != "admin" {
		t.Errorf("expected role 'admin', got %q", admin.Role)
	}
	if admin.Disabled {
		t.Error("expected admin not to be disabled")
	}
	if admin.PasswordChangeRequired {
		t.Error("expected admin password_change_required to be false")
	}
}

func TestEnsureAdminUser_AlreadyExists(t *testing.T) {
	ctx := context.Background()
	queries := db.New(testPool)

	t.Setenv("ADMIN_EMAIL", adminTestEmail)
	t.Setenv("ADMIN_PASSWORD", "test-password")
	t.Cleanup(func() { cleanupAdminTest(t) })

	// Create an admin user explicitly so we know one exists
	hash, _ := bcrypt.GenerateFromPassword([]byte("test-password"), bcrypt.DefaultCost)
	_, err := queries.CreateAdminUser(ctx, db.CreateAdminUserParams{
		Name:         "Existing Admin",
		Email:        adminTestEmail,
		PasswordHash: pgtype.Text{String: string(hash), Valid: true},
	})
	if err != nil {
		t.Fatalf("failed to create pre-existing admin: %v", err)
	}

	// Count active admins before
	var countBefore int
	testPool.QueryRow(ctx, `SELECT COUNT(*) FROM "user" WHERE role = 'admin' AND disabled = false`).Scan(&countBefore)

	// Run the function — should skip because admin already exists
	ensureAdminUser(ctx, queries)

	// Verify no new admin was created
	var countAfter int
	testPool.QueryRow(ctx, `SELECT COUNT(*) FROM "user" WHERE role = 'admin' AND disabled = false`).Scan(&countAfter)
	if countAfter != countBefore {
		t.Errorf("expected %d active admins, got %d", countBefore, countAfter)
	}
}

func TestEnsureAdminUser_RecreateAfterAllDisabled(t *testing.T) {
	ctx := context.Background()
	queries := db.New(testPool)

	t.Cleanup(func() { cleanupAdminTest(t) })

	// Disable ALL admins to simulate all-being-disabled scenario
	testPool.Exec(ctx, `UPDATE "user" SET disabled = true WHERE role = 'admin'`)
	testPool.Exec(ctx, `DELETE FROM "user" WHERE email = $1`, adminTestEmail)

	t.Setenv("ADMIN_EMAIL", adminTestEmail)
	t.Setenv("ADMIN_PASSWORD", "recovery-password")

	// Run the function — should create a new admin because all are disabled
	ensureAdminUser(ctx, queries)

	// Verify new admin was created
	admin, err := queries.GetUserByEmail(ctx, adminTestEmail)
	if err != nil {
		t.Fatalf("expected new admin to be created after all were disabled, got error: %v", err)
	}
	if admin.Role != "admin" {
		t.Errorf("expected role 'admin', got %q", admin.Role)
	}
	if admin.Disabled {
		t.Error("expected new admin not to be disabled")
	}
}

func TestEnsureAdminUser_DefaultCredentials(t *testing.T) {
	ctx := context.Background()
	queries := db.New(testPool)

	testPool.Exec(ctx, `UPDATE "user" SET disabled = true WHERE role = 'admin'`)
	testPool.Exec(ctx, `DELETE FROM "user" WHERE email = $1`, "admin@agent.com")
	t.Cleanup(func() {
		cleanupAdminTest(t)
		testPool.Exec(ctx, `DELETE FROM "user" WHERE email = $1`, "admin@agent.com")
	})

	// Unset env vars so defaults are used
	t.Setenv("ADMIN_EMAIL", "")
	t.Setenv("ADMIN_PASSWORD", "")

	ensureAdminUser(ctx, queries)

	// Verify admin created with default email
	admin, err := queries.GetUserByEmail(ctx, "admin@agent.com")
	if err != nil {
		t.Fatalf("expected admin with default email, got error: %v", err)
	}
	if admin.Role != "admin" {
		t.Errorf("expected role 'admin', got %q", admin.Role)
	}
}

// TestEnsureAdminUser_AdminCreatedWithCorrectFields verifies the admin user
// is created with all expected database field values.
func TestEnsureAdminUser_AdminCreatedWithCorrectFields(t *testing.T) {
	ctx := context.Background()
	queries := db.New(testPool)

	testPool.Exec(ctx, `UPDATE "user" SET disabled = true WHERE role = 'admin'`)
	testPool.Exec(ctx, `DELETE FROM "user" WHERE email = $1`, adminTestEmail)
	t.Cleanup(func() { cleanupAdminTest(t) })

	t.Setenv("ADMIN_EMAIL", adminTestEmail)
	t.Setenv("ADMIN_PASSWORD", "test-password")

	ensureAdminUser(ctx, queries)

	admin, err := queries.GetUserByEmail(ctx, adminTestEmail)
	if err != nil {
		t.Fatalf("failed to get admin: %v", err)
	}

	if admin.Name != "Admin" {
		t.Errorf("expected name 'Admin', got %q", admin.Name)
	}
	if admin.Email != adminTestEmail {
		t.Errorf("expected email %q, got %q", adminTestEmail, admin.Email)
	}
	if !admin.PasswordHash.Valid || len(admin.PasswordHash.String) == 0 {
		t.Error("expected password_hash to be set")
	}
	// Verify password hash is bcrypt (starts with $2a$)
	if len(admin.PasswordHash.String) > 0 && admin.PasswordHash.String[:4] != "$2a$" {
		t.Error("expected bcrypt password hash")
	}
}

// Ensure the helper compiles and the test package is valid
var _ = pgtype.Text{String: "sentinel", Valid: true}
