package main

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgtype"
	"golang.org/x/crypto/bcrypt"

	"github.com/multica-ai/multica/server/internal/util"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

func TestChangePassword_FirstTimeNoOldPassword(t *testing.T) {
	ctx := context.Background()
	email := "pwm-ff-" + authMiddlewareTestEmail
	t.Cleanup(func() {
		testPool.Exec(context.Background(), `DELETE FROM "user" WHERE email = $1`, email)
	})

	hash, _ := bcrypt.GenerateFromPassword([]byte("default-pass"), bcrypt.DefaultCost)
	user, _ := db.New(testPool).CreateUserWithPassword(ctx, db.CreateUserWithPasswordParams{
		Name: "PWM", Email: email, PasswordHash: pgtype.Text{String: string(hash), Valid: true},
		PasswordChangeRequired: true,
	})

	userID := util.UUIDToString(user.ID)
	token := authToken(userID, email)

	// Change without old password → should succeed
	body := `{"password":"new-strong-pass123"}`
	req, _ := http.NewRequest("POST", testServer.URL+"/auth/change-password", strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	resp, _ := http.DefaultClient.Do(req)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(b))
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	if result["token"] == nil {
		t.Error("expected new token in response")
	}

	var pcr bool
	testPool.QueryRow(context.Background(), `SELECT password_change_required FROM "user" WHERE id = $1`, user.ID).Scan(&pcr)
	if pcr {
		t.Error("password_change_required should be false after change")
	}
}

func TestChangePassword_NormalUserRequiresOldPassword(t *testing.T) {
	ctx := context.Background()
	email := "pwm-norm-" + authMiddlewareTestEmail
	t.Cleanup(func() {
		testPool.Exec(context.Background(), `DELETE FROM "user" WHERE email = $1`, email)
	})

	hash, _ := bcrypt.GenerateFromPassword([]byte("correct-old"), bcrypt.DefaultCost)
	user, _ := db.New(testPool).CreateUserWithPassword(ctx, db.CreateUserWithPasswordParams{
		Name: "Normal", Email: email, PasswordHash: pgtype.Text{String: string(hash), Valid: true},
		PasswordChangeRequired: false,
	})

	userID := util.UUIDToString(user.ID)
	token := authToken(userID, email)

	// Without current_password → fail
	body := `{"password":"new-pass"}`
	req, _ := http.NewRequest("POST", testServer.URL+"/auth/change-password", strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	resp, _ := http.DefaultClient.Do(req)
	resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", resp.StatusCode)
	}

	// Wrong current → fail
	body2 := `{"current_password":"wrong","password":"new-pass"}`
	req2, _ := http.NewRequest("POST", testServer.URL+"/auth/change-password", strings.NewReader(body2))
	req2.Header.Set("Authorization", "Bearer "+token)
	req2.Header.Set("Content-Type", "application/json")
	resp2, _ := http.DefaultClient.Do(req2)
	resp2.Body.Close()
	if resp2.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", resp2.StatusCode)
	}

	// Correct → success
	body3 := `{"current_password":"correct-old","password":"new-pass"}`
	req3, _ := http.NewRequest("POST", testServer.URL+"/auth/change-password", strings.NewReader(body3))
	req3.Header.Set("Authorization", "Bearer "+token)
	req3.Header.Set("Content-Type", "application/json")
	resp3, _ := http.DefaultClient.Do(req3)
	resp3.Body.Close()
	if resp3.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp3.Body)
		t.Errorf("expected 200, got %d: %s", resp3.StatusCode, string(b))
	}
}
