package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"golang.org/x/crypto/bcrypt"

	"github.com/multica-ai/multica/server/internal/util"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

func TestRegistrationClosed_RegisterRejected(t *testing.T) {
	ctx := context.Background()
	t.Cleanup(func() { cleanupAuthTestData(t) })

	hash, _ := bcrypt.GenerateFromPassword([]byte("admin-pass"), bcrypt.DefaultCost)
	admin, _ := db.New(testPool).CreateAdminUser(ctx, db.CreateAdminUserParams{
		Name: "Admin", Email: "admin-for-reg-test@agent.com",
		PasswordHash: pgtype.Text{String: string(hash), Valid: true},
	})
	t.Cleanup(func() {
		testPool.Exec(context.Background(), `DELETE FROM "user" WHERE id = $1`, admin.ID)
		testPool.Exec(context.Background(), `DELETE FROM member WHERE user_id = $1`, admin.ID)
	})

	body := `{"email":"newuser@test.com","password":"test123456"}`
	req, _ := http.NewRequest("POST", testServer.URL+"/auth/register", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, _ := http.DefaultClient.Do(req)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusForbidden {
		b, _ := io.ReadAll(resp.Body)
		t.Errorf("expected 403, got %d: %s", resp.StatusCode, string(b))
	}
}

func TestRegistrationClosed_VerifyCodeNoAutoCreate(t *testing.T) {
	ctx := context.Background()
	t.Cleanup(func() { cleanupAuthTestData(t) })
	const testEmail = "nonexistent-for-reg-test@test.com"

	hash, _ := bcrypt.GenerateFromPassword([]byte("admin-pass"), bcrypt.DefaultCost)
	admin, _ := db.New(testPool).CreateAdminUser(ctx, db.CreateAdminUserParams{
		Name: "Admin", Email: "admin-for-verify2@agent.com",
		PasswordHash: pgtype.Text{String: string(hash), Valid: true},
	})
	t.Cleanup(func() {
		testPool.Exec(context.Background(), `DELETE FROM "user" WHERE id = $1`, admin.ID)
		testPool.Exec(context.Background(), `DELETE FROM member WHERE user_id = $1`, admin.ID)
		testPool.Exec(context.Background(), `DELETE FROM verification_code WHERE email = $1`, testEmail)
	})

	testPool.Exec(ctx, `INSERT INTO verification_code (email, code, expires_at) VALUES ($1, '123456', NOW() + INTERVAL '5 minutes')`, testEmail)

	body := `{"email":"` + testEmail + `","code":"123456"}`
	req, _ := http.NewRequest("POST", testServer.URL+"/auth/verify-code", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, _ := http.DefaultClient.Do(req)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusForbidden {
		b, _ := io.ReadAll(resp.Body)
		t.Errorf("expected 403, got %d: %s", resp.StatusCode, string(b))
	}
}

func TestRegistrationClosed_AdminCanStillUseAPIs(t *testing.T) {
	ctx := context.Background()
	hash, _ := bcrypt.GenerateFromPassword([]byte("admin-pass"), bcrypt.DefaultCost)
	admin, _ := db.New(testPool).CreateAdminUser(ctx, db.CreateAdminUserParams{
		Name: "Admin", Email: "admin-api-test@agent.com",
		PasswordHash: pgtype.Text{String: string(hash), Valid: true},
	})
	t.Cleanup(func() {
		testPool.Exec(context.Background(), `DELETE FROM "user" WHERE id = $1`, admin.ID)
		testPool.Exec(context.Background(), `DELETE FROM member WHERE user_id = $1`, admin.ID)
	})

	adminID := util.UUIDToString(admin.ID)
	token, _ := generateTestJWT(adminID, "admin-api-test@agent.com", "Admin")

	req, _ := http.NewRequest("GET", testServer.URL+"/api/me", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, _ := http.DefaultClient.Do(req)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		t.Errorf("expected 200, got %d: %s", resp.StatusCode, string(b))
	}
}

func TestRegistrationToggle_EnableAndRegister(t *testing.T) {
	ctx := context.Background()
	t.Cleanup(func() { cleanupAuthTestData(t) })

	// Admin exists (created by ensureTestAdmin), registration_enabled = false by default
	_, adminToken := ensureTestAdmin(t)

	// Enable registration
	body := `{"enabled":true}`
	req, _ := http.NewRequest("POST", testServer.URL+"/api/admin/settings/registration", strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")
	resp, _ := http.DefaultClient.Do(req)
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		t.Fatalf("failed to enable registration: %d: %s", resp.StatusCode, string(b))
	}
	resp.Body.Close()

	// Now a new user should be able to register via verify-code
	testEmail := fmt.Sprintf("newreg-%d@test.com", time.Now().UnixNano())
	t.Cleanup(func() {
		testPool.Exec(context.Background(), `DELETE FROM verification_code WHERE email = $1`, testEmail)
		testPool.Exec(context.Background(), `DELETE FROM member WHERE user_id IN (SELECT id FROM "user" WHERE email = $1)`, testEmail)
		testPool.Exec(context.Background(), `DELETE FROM "user" WHERE email = $1`, testEmail)
	})

	testPool.Exec(ctx, `INSERT INTO verification_code (email, code, expires_at) VALUES ($1, '654321', NOW() + INTERVAL '5 minutes')`, testEmail)

	verifyBody := fmt.Sprintf(`{"email":"%s","code":"654321"}`, testEmail)
	req, _ = http.NewRequest("POST", testServer.URL+"/auth/verify-code", strings.NewReader(verifyBody))
	req.Header.Set("Content-Type", "application/json")
	resp, _ = http.DefaultClient.Do(req)
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		t.Errorf("expected 200 after enabling registration, got %d: %s", resp.StatusCode, string(bodyBytes))
	}

	// Reset registration to closed
	testPool.Exec(ctx, `UPDATE system_settings SET value = 'false' WHERE key = 'registration_enabled'`)
}

func TestRegistrationToggle_DisableRejects(t *testing.T) {
	ctx := context.Background()
	_, _ = ensureTestAdmin(t)

	// Ensure registration is disabled
	testPool.Exec(ctx, `UPDATE system_settings SET value = 'false' WHERE key = 'registration_enabled'`)

	testEmail := fmt.Sprintf("rejected-%d@test.com", time.Now().UnixNano())
	t.Cleanup(func() {
		testPool.Exec(context.Background(), `DELETE FROM verification_code WHERE email = $1`, testEmail)
	})

	testPool.Exec(ctx, `INSERT INTO verification_code (email, code, expires_at) VALUES ($1, '111111', NOW() + INTERVAL '5 minutes')`, testEmail)

	verifyBody := fmt.Sprintf(`{"email":"%s","code":"111111"}`, testEmail)
	req, _ := http.NewRequest("POST", testServer.URL+"/auth/verify-code", strings.NewReader(verifyBody))
	req.Header.Set("Content-Type", "application/json")
	resp, _ := http.DefaultClient.Do(req)
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusForbidden {
		b, _ := io.ReadAll(resp.Body)
		t.Errorf("expected 403 when disabled, got %d: %s", resp.StatusCode, string(b))
	}
}

func TestRegistrationToggle_GetStatus(t *testing.T) {
	_, adminToken := ensureTestAdmin(t)

	req, _ := http.NewRequest("GET", testServer.URL+"/api/admin/settings/registration", nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	resp, _ := http.DefaultClient.Do(req)
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	if _, ok := result["enabled"]; !ok {
		t.Error("expected enabled field in response")
	}
}
