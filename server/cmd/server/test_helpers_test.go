package main

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5/pgtype"
	"golang.org/x/crypto/bcrypt"

	"github.com/multica-ai/multica/server/internal/util"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

const authMiddlewareTestEmail = "auth-test@agent.com"

func ensureTestAdmin(t *testing.T) (string, string) {
	t.Helper()
	ctx := context.Background()
	const adminEmail = "sync-admin-test@agent.com"

	admin, err := db.New(testPool).GetUserByEmail(ctx, adminEmail)
	if err == nil {
		return util.UUIDToString(admin.ID), authToken(util.UUIDToString(admin.ID), adminEmail)
	}

	hash, _ := bcrypt.GenerateFromPassword([]byte("admin-pass"), bcrypt.DefaultCost)
	admin, err = db.New(testPool).CreateAdminUser(ctx, db.CreateAdminUserParams{
		Name:         "Test Admin",
		Email:        adminEmail,
		PasswordHash: pgtype.Text{String: string(hash), Valid: true},
	})
	if err != nil {
		t.Fatalf("failed to create test admin: %v", err)
	}

	adminID := util.UUIDToString(admin.ID)
	t.Cleanup(func() {
		testPool.Exec(context.Background(), `DELETE FROM member WHERE user_id = $1`, admin.ID)
		testPool.Exec(context.Background(), `DELETE FROM "user" WHERE id = $1`, admin.ID)
	})

	return adminID, authToken(adminID, adminEmail)
}

func createAuthTestUser(t *testing.T, email string, role string, disabled bool, pcr bool) string {
	t.Helper()
	ctx := context.Background()

	hash, _ := bcrypt.GenerateFromPassword([]byte("test-password"), bcrypt.DefaultCost)
	user, err := db.New(testPool).CreateUserWithPassword(ctx, db.CreateUserWithPasswordParams{
		Name:                   "Auth Test User",
		Email:                  email,
		PasswordHash:           pgtype.Text{String: string(hash), Valid: true},
		PasswordChangeRequired: pcr,
	})
	if err != nil {
		t.Fatalf("failed to create test user: %v", err)
	}

	testPool.Exec(ctx, `UPDATE "user" SET role = $2, disabled = $3 WHERE id = $1`, user.ID, role, disabled)

	return util.UUIDToString(user.ID)
}

func authToken(userID, email string) string {
	token, _ := generateTestJWT(userID, email, "Test User")
	return token
}

func cleanupAuthTestData(t *testing.T) {
	t.Helper()
	ctx := context.Background()
	testPool.Exec(ctx, `DELETE FROM "user" WHERE email = $1`, authMiddlewareTestEmail)
	testPool.Exec(ctx, `DELETE FROM member WHERE user_id IN (SELECT id FROM "user" WHERE email = $1)`, authMiddlewareTestEmail)
}
