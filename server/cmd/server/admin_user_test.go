package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/multica-ai/multica/server/internal/util"
	"github.com/multica-ai/multica/server/pkg/db/generated"
	excelize "github.com/xuri/excelize/v2"
	"golang.org/x/crypto/bcrypt"
)

func TestAdminListUsers(t *testing.T) {
	_, adminToken := ensureTestAdmin(t)

	req, _ := http.NewRequest("GET", testServer.URL+"/api/admin/users", nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(b))
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	users, ok := result["users"].([]interface{})
	if !ok {
		t.Fatal("expected users array in response")
	}
	if len(users) == 0 {
		t.Error("expected at least one user in list")
	}

	if total, ok := result["total"].(float64); !ok || total < 1 {
		t.Error("expected total >= 1")
	}
	if page, ok := result["page"].(float64); !ok || page != 1 {
		t.Error("expected page = 1")
	}
	if perPage, ok := result["per_page"].(float64); !ok || perPage != 20 {
		t.Error("expected per_page = 20")
	}
}

func TestAdminListUsersPagination(t *testing.T) {
	_, adminToken := ensureTestAdmin(t)

	req, _ := http.NewRequest("GET", testServer.URL+"/api/admin/users?page=1&per_page=2", nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(b))
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	users := result["users"].([]interface{})
	if len(users) > 2 {
		t.Errorf("expected at most 2 users, got %d", len(users))
	}
	if perPage, ok := result["per_page"].(float64); !ok || perPage != 2 {
		t.Error("expected per_page = 2")
	}
}

func TestAdminListUsersSortByName(t *testing.T) {
	_, adminToken := ensureTestAdmin(t)

	req, _ := http.NewRequest("GET", testServer.URL+"/api/admin/users?sort=name&order=asc", nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(b))
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	if _, ok := result["users"]; !ok {
		t.Fatal("expected users array in response")
	}
}

func TestAdminListUsersInvalidSort(t *testing.T) {
	_, adminToken := ensureTestAdmin(t)

	req, _ := http.NewRequest("GET", testServer.URL+"/api/admin/users?sort=password&order=asc", nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusBadRequest {
		b, _ := io.ReadAll(resp.Body)
		t.Errorf("expected 400 for invalid sort, got %d: %s", resp.StatusCode, string(b))
	}
}

func TestAdminListUsersSearch(t *testing.T) {
	_, adminToken := ensureTestAdmin(t)

	req, _ := http.NewRequest("GET", testServer.URL+"/api/admin/users?search=admin", nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(b))
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	users := result["users"].([]interface{})
	if len(users) < 1 {
		t.Error("expected at least 1 user matching 'admin'")
	}
}

func TestAdminListUsersDisabledFilter(t *testing.T) {
	_, adminToken := ensureTestAdmin(t)

	req, _ := http.NewRequest("GET", testServer.URL+"/api/admin/users?disabled=true", nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(b))
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	users := result["users"].([]interface{})
	for _, u := range users {
		m := u.(map[string]interface{})
		if m["disabled"] != true {
			t.Error("expected all users to be disabled")
		}
	}
}

func TestAdminListUsersCombined(t *testing.T) {
	_, adminToken := ensureTestAdmin(t)

	req, _ := http.NewRequest("GET", testServer.URL+"/api/admin/users?search=admin&sort=name&order=asc&page=1&per_page=10", nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(b))
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	if _, ok := result["users"]; !ok {
		t.Fatal("expected users array in response")
	}
	if _, ok := result["total"]; !ok {
		t.Fatal("expected total in response")
	}
}

func TestAdminListUsersMaxPerPage(t *testing.T) {
	_, adminToken := ensureTestAdmin(t)

	req, _ := http.NewRequest("GET", testServer.URL+"/api/admin/users?per_page=999", nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(b))
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	if perPage, ok := result["per_page"].(float64); !ok || perPage != 100 {
		t.Errorf("expected per_page capped at 100, got %v", perPage)
	}
}

func TestAdminCreateUser(t *testing.T) {
	_, adminToken := ensureTestAdmin(t)

	ts := time.Now().Format("150405")
	email := "newuser-" + ts + "@test.com"

	body := `{"email":"` + email + `","name":"New User"}`
	req, _ := http.NewRequest("POST", testServer.URL+"/api/admin/users", strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		b, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 201, got %d: %s", resp.StatusCode, string(b))
	}

	var user map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&user)

	if user["role"] != "user" {
		t.Errorf("expected role 'user', got %v", user["role"])
	}
	if user["disabled"] != false {
		t.Errorf("expected disabled false, got %v", user["disabled"])
	}
	if user["password_change_required"] != true {
		t.Errorf("expected password_change_required true, got %v", user["password_change_required"])
	}

	t.Cleanup(func() {
		testPool.Exec(context.Background(), `DELETE FROM member WHERE user_id IN (SELECT id FROM "user" WHERE email = $1)`, email)
		testPool.Exec(context.Background(), `DELETE FROM "user" WHERE email = $1`, email)
	})
}

func TestAdminDisableAndEnableUser(t *testing.T) {
	_, adminToken := ensureTestAdmin(t)

	ts := time.Now().Format("150405")
	email := "toggler-" + ts + "@test.com"

	// Create user via API
	body := `{"email":"` + email + `","name":"Toggle User"}`
	req, _ := http.NewRequest("POST", testServer.URL+"/api/admin/users", strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")
	resp, _ := http.DefaultClient.Do(req)
	resp.Body.Close()

	// Find the user ID
	var userID string
	db.New(testPool).GetUserByEmail(context.Background(), email)
	userRow, _ := db.New(testPool).GetUserByEmail(context.Background(), email)
	userID = util.UUIDToString(userRow.ID)

	t.Cleanup(func() {
		testPool.Exec(context.Background(), `DELETE FROM member WHERE user_id = $1`, userRow.ID)
		testPool.Exec(context.Background(), `DELETE FROM "user" WHERE email = $1`, email)
	})

	// Disable
	req2, _ := http.NewRequest("POST", testServer.URL+"/api/admin/users/"+userID+"/disable", nil)
	req2.Header.Set("Authorization", "Bearer "+adminToken)
	resp2, _ := http.DefaultClient.Do(req2)
	if resp2.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp2.Body)
		t.Fatalf("expected 200 on disable, got %d: %s", resp2.StatusCode, string(b))
	}
	resp2.Body.Close()

	// Verify disabled in DB
	var disabled bool
	testPool.QueryRow(context.Background(), `SELECT disabled FROM "user" WHERE id = $1`, userRow.ID).Scan(&disabled)
	if !disabled {
		t.Error("expected user to be disabled")
	}

	// Enable
	req3, _ := http.NewRequest("POST", testServer.URL+"/api/admin/users/"+userID+"/enable", nil)
	req3.Header.Set("Authorization", "Bearer "+adminToken)
	resp3, _ := http.DefaultClient.Do(req3)
	if resp3.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp3.Body)
		t.Fatalf("expected 200 on enable, got %d: %s", resp3.StatusCode, string(b))
	}
	resp3.Body.Close()

	// Verify enabled in DB
	testPool.QueryRow(context.Background(), `SELECT disabled FROM "user" WHERE id = $1`, userRow.ID).Scan(&disabled)
	if disabled {
		t.Error("expected user to be enabled")
	}
}

func TestAdminCannotDisableAdmin(t *testing.T) {
	_, adminToken := ensureTestAdmin(t)

	// Try to disable the admin user themselves
	adminUser, _ := db.New(testPool).GetUserByEmail(context.Background(), "sync-admin-test@agent.com")
	adminID := util.UUIDToString(adminUser.ID)

	req, _ := http.NewRequest("POST", testServer.URL+"/api/admin/users/"+adminID+"/disable", nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	resp, _ := http.DefaultClient.Do(req)
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusBadRequest {
		b, _ := io.ReadAll(resp.Body)
		t.Errorf("expected 400 when disabling admin, got %d: %s", resp.StatusCode, string(b))
	}
}

func TestNonAdminCannotAccessAdminAPI(t *testing.T) {
	ts := time.Now().Format("150405")
	email := "nonadmin-" + ts + "@test.com"
	userID := createAuthTestUser(t, email, "user", false, false)
	token := authToken(userID, email)

	t.Cleanup(func() {
		testPool.Exec(context.Background(), `DELETE FROM member WHERE user_id IN (SELECT id FROM "user" WHERE email = $1)`, email)
		testPool.Exec(context.Background(), `DELETE FROM "user" WHERE email = $1`, email)
	})

	req, _ := http.NewRequest("GET", testServer.URL+"/api/admin/users", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, _ := http.DefaultClient.Do(req)
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusForbidden {
		b, _ := io.ReadAll(resp.Body)
		t.Errorf("expected 403 for non-admin, got %d: %s", resp.StatusCode, string(b))
	}
}

func TestDisabledUserCannotLogin(t *testing.T) {
	ts := time.Now().Format("150405")
	email := "disabled-login-" + ts + "@test.com"
	userID := createAuthTestUser(t, email, "user", false, false)

	t.Cleanup(func() {
		testPool.Exec(context.Background(), `DELETE FROM member WHERE user_id IN (SELECT id FROM "user" WHERE email = $1)`, email)
		testPool.Exec(context.Background(), `DELETE FROM "user" WHERE email = $1`, email)
	})

	// Disable the user
	testPool.Exec(context.Background(), `UPDATE "user" SET disabled = true WHERE id = $1`, util.ParseUUID(userID))

	// Create a captcha for login
	var captchaID string
	testPool.QueryRow(context.Background(),
		`INSERT INTO captcha (answer, expires_at) VALUES ($1, NOW() + INTERVAL '5 minutes') RETURNING id`,
		"ABCD",
	).Scan(&captchaID)

	// Try to log in with correct password and captcha
	body := fmt.Sprintf(`{"email":"%s","password":"test-password","captcha_id":"%s","captcha_answer":"ABCD"}`, email, captchaID)
	req, _ := http.NewRequest("POST", testServer.URL+"/auth/login", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, _ := http.DefaultClient.Do(req)
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusForbidden {
		b, _ := io.ReadAll(resp.Body)
		t.Errorf("expected 403 for disabled user login, got %d: %s", resp.StatusCode, string(b))
	}
}

func TestCreateUserPasswordPolicy(t *testing.T) {
	_, adminToken := ensureTestAdmin(t)

	ts := time.Now().Format("150405")
	email := "pwpolicy-" + ts + "@company.com"

	t.Cleanup(func() {
		testPool.Exec(context.Background(), `DELETE FROM member WHERE user_id IN (SELECT id FROM "user" WHERE email = $1)`, email)
		testPool.Exec(context.Background(), `DELETE FROM "user" WHERE email = $1`, email)
	})

	body := fmt.Sprintf(`{"email":"%s","name":"PW Test"}`, email)
	req, _ := http.NewRequest("POST", testServer.URL+"/api/admin/users", strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")
	resp, _ := http.DefaultClient.Do(req)
	if resp.StatusCode != http.StatusCreated {
		b, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 201, got %d: %s", resp.StatusCode, string(b))
	}
	resp.Body.Close()

	// Verify password hash matches new policy
	var passwordHash string
	testPool.QueryRow(context.Background(), `SELECT password_hash FROM "user" WHERE email = $1`, email).Scan(&passwordHash)

	expectedPassword := "pwpolicy-" + ts + "@company"
	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(expectedPassword)); err != nil {
		t.Errorf("password hash does not match new default policy (TLD prefix): %v", err)
	}
}

func multipartFileForm(filename, content string) (*bytes.Buffer, string) {
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	part, _ := w.CreateFormFile("file", filename)
	io.WriteString(part, content)
	w.Close()
	return &buf, w.FormDataContentType()
}

func TestImportCSV(t *testing.T) {
	_, adminToken := ensureTestAdmin(t)
	ts := time.Now().Format("150405")
	email := "imp-csv-" + ts + "@test.com"

	t.Cleanup(func() {
		testPool.Exec(context.Background(), `DELETE FROM member WHERE user_id IN (SELECT id FROM "user" WHERE email = $1)`, email)
		testPool.Exec(context.Background(), `DELETE FROM "user" WHERE email = $1`, email)
	})

	csvContent := fmt.Sprintf("name,email\nImport CSV,%s\n", email)
	body, ct := multipartFileForm("users.csv", csvContent)
	req, _ := http.NewRequest("POST", testServer.URL+"/api/admin/users/import", body)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", ct)
	resp, _ := http.DefaultClient.Do(req)
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(b))
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	if v, _ := result["created"].(float64); v != 1 {
		t.Errorf("expected created=1, got %v", result["created"])
	}
}

func TestImportXLSX(t *testing.T) {
	_, adminToken := ensureTestAdmin(t)
	ts := time.Now().Format("150405")
	email := "imp-xlsx-" + ts + "@test.com"

	t.Cleanup(func() {
		testPool.Exec(context.Background(), `DELETE FROM member WHERE user_id IN (SELECT id FROM "user" WHERE email = $1)`, email)
		testPool.Exec(context.Background(), `DELETE FROM "user" WHERE email = $1`, email)
	})

	f := excelize.NewFile()
	f.SetCellValue("Sheet1", "A1", "name")
	f.SetCellValue("Sheet1", "B1", "email")
	f.SetCellValue("Sheet1", "A2", "Import XLSX")
	f.SetCellValue("Sheet1", "B2", email)
	var xlsxBuf bytes.Buffer
	f.Write(&xlsxBuf)
	f.Close()

	body, ct := multipartFileForm("users.xlsx", xlsxBuf.String())
	req, _ := http.NewRequest("POST", testServer.URL+"/api/admin/users/import", body)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", ct)
	resp, _ := http.DefaultClient.Do(req)
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(b))
	}
}

func TestImportMarkdown(t *testing.T) {
	_, adminToken := ensureTestAdmin(t)
	ts := time.Now().Format("150405")
	email := "imp-md-" + ts + "@test.com"

	t.Cleanup(func() {
		testPool.Exec(context.Background(), `DELETE FROM member WHERE user_id IN (SELECT id FROM "user" WHERE email = $1)`, email)
		testPool.Exec(context.Background(), `DELETE FROM "user" WHERE email = $1`, email)
	})

	mdContent := fmt.Sprintf("| name | email |\n|------|-------|\n| Import MD | %s |\n", email)
	body, ct := multipartFileForm("users.md", mdContent)
	req, _ := http.NewRequest("POST", testServer.URL+"/api/admin/users/import", body)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", ct)
	resp, _ := http.DefaultClient.Do(req)
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(b))
	}
}

func TestImportUnsupportedFormat(t *testing.T) {
	_, adminToken := ensureTestAdmin(t)

	body, ct := multipartFileForm("file.txt", "hello")
	req, _ := http.NewRequest("POST", testServer.URL+"/api/admin/users/import", body)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", ct)
	resp, _ := http.DefaultClient.Do(req)
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400 for unsupported format, got %d", resp.StatusCode)
	}
}

func TestImportTooLarge(t *testing.T) {
	_, adminToken := ensureTestAdmin(t)

	big := strings.Repeat("a", 11<<20)
	body, ct := multipartFileForm("big.csv", big)
	req, _ := http.NewRequest("POST", testServer.URL+"/api/admin/users/import", body)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", ct)
	resp, _ := http.DefaultClient.Do(req)
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusRequestEntityTooLarge {
		t.Errorf("expected 413 for oversized file, got %d", resp.StatusCode)
	}
}

func TestDownloadTemplate(t *testing.T) {
	_, adminToken := ensureTestAdmin(t)

	// XLSX format (default)
	req, _ := http.NewRequest("GET", testServer.URL+"/api/admin/users/template", nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	resp, _ := http.DefaultClient.Do(req)
	if resp.StatusCode != http.StatusOK {
		t.Errorf("xlsx: expected 200, got %d", resp.StatusCode)
	} else if ct := resp.Header.Get("Content-Type"); !strings.Contains(ct, "spreadsheet") {
		t.Errorf("xlsx: expected spreadsheet content type, got %s", ct)
	}
	resp.Body.Close()

	// Markdown format
	req, _ = http.NewRequest("GET", testServer.URL+"/api/admin/users/template?format=md", nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	resp, _ = http.DefaultClient.Do(req)
	if resp.StatusCode != http.StatusOK {
		t.Errorf("md: expected 200, got %d", resp.StatusCode)
	} else if ct := resp.Header.Get("Content-Type"); !strings.Contains(ct, "text/plain") {
		t.Errorf("md: expected text/plain content type, got %s", ct)
	} else {
		body, _ := io.ReadAll(resp.Body)
		if !strings.Contains(string(body), "| name | email | password |") {
			t.Error("md: expected table header in body")
		}
	}
	resp.Body.Close()
}

func TestAdminUpdateUserName(t *testing.T) {
	_, adminToken := ensureTestAdmin(t)
	ts := time.Now().Format("150405")
	email := "update-name-" + ts + "@test.com"

	// Create a non-admin user
	body := fmt.Sprintf(`{"email":"%s","name":"Original Name"}`, email)
	req, _ := http.NewRequest("POST", testServer.URL+"/api/admin/users", strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")
	resp, _ := http.DefaultClient.Do(req)
	if resp.StatusCode != http.StatusCreated {
		b, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 201, got %d: %s", resp.StatusCode, string(b))
	}
	resp.Body.Close()

	// Get userID
	userRow, _ := db.New(testPool).GetUserByEmail(context.Background(), email)
	userID := util.UUIDToString(userRow.ID)

	t.Cleanup(func() {
		testPool.Exec(context.Background(), `DELETE FROM member WHERE user_id = $1`, userRow.ID)
		testPool.Exec(context.Background(), `DELETE FROM "user" WHERE email = $1`, email)
	})

	// Test: normal update
	updateBody := `{"name":"Updated Name"}`
	req2, _ := http.NewRequest("PATCH", testServer.URL+"/api/admin/users/"+userID, strings.NewReader(updateBody))
	req2.Header.Set("Authorization", "Bearer "+adminToken)
	req2.Header.Set("Content-Type", "application/json")
	resp2, _ := http.DefaultClient.Do(req2)
	defer resp2.Body.Close()
	if resp2.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp2.Body)
		t.Fatalf("expected 200, got %d: %s", resp2.StatusCode, string(b))
	}
	var updated map[string]interface{}
	json.NewDecoder(resp2.Body).Decode(&updated)
	if updated["name"] != "Updated Name" {
		t.Errorf("expected name 'Updated Name', got %v", updated["name"])
	}
}

func TestAdminUpdateUserNameEmptyName(t *testing.T) {
	_, adminToken := ensureTestAdmin(t)
	ts := time.Now().Format("150405")
	email := "update-empty-" + ts + "@test.com"

	// Create a non-admin user
	body := fmt.Sprintf(`{"email":"%s","name":"Name"}`, email)
	req, _ := http.NewRequest("POST", testServer.URL+"/api/admin/users", strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")
	resp, _ := http.DefaultClient.Do(req)
	resp.Body.Close()

	userRow, _ := db.New(testPool).GetUserByEmail(context.Background(), email)
	userID := util.UUIDToString(userRow.ID)

	t.Cleanup(func() {
		testPool.Exec(context.Background(), `DELETE FROM member WHERE user_id = $1`, userRow.ID)
		testPool.Exec(context.Background(), `DELETE FROM "user" WHERE email = $1`, email)
	})

	// Send empty name
	req2, _ := http.NewRequest("PATCH", testServer.URL+"/api/admin/users/"+userID, strings.NewReader(`{"name":""}`))
	req2.Header.Set("Authorization", "Bearer "+adminToken)
	req2.Header.Set("Content-Type", "application/json")
	resp2, _ := http.DefaultClient.Do(req2)
	defer resp2.Body.Close()
	if resp2.StatusCode != http.StatusBadRequest {
		b, _ := io.ReadAll(resp2.Body)
		t.Errorf("expected 400 for empty name, got %d: %s", resp2.StatusCode, string(b))
	}
}

func TestAdminUpdateUserNameAdminUser(t *testing.T) {
	adminID, adminToken := ensureTestAdmin(t)

	// Try to update the admin user's name
	req, _ := http.NewRequest("PATCH", testServer.URL+"/api/admin/users/"+adminID, strings.NewReader(`{"name":"Hacker"}`))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")
	resp, _ := http.DefaultClient.Do(req)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		b, _ := io.ReadAll(resp.Body)
		t.Errorf("expected 400 when editing admin, got %d: %s", resp.StatusCode, string(b))
	}
}

func TestAdminUpdateUserNameNotFound(t *testing.T) {
	_, adminToken := ensureTestAdmin(t)

	req, _ := http.NewRequest("PATCH", testServer.URL+"/api/admin/users/00000000-0000-0000-0000-000000000000", strings.NewReader(`{"name":"Test"}`))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")
	resp, _ := http.DefaultClient.Do(req)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNotFound {
		b, _ := io.ReadAll(resp.Body)
		t.Errorf("expected 404 for non-existent user, got %d: %s", resp.StatusCode, string(b))
	}
}

func TestAdminListUsersSortByPasswordChangeRequired(t *testing.T) {
	_, adminToken := ensureTestAdmin(t)

	req, _ := http.NewRequest("GET", testServer.URL+"/api/admin/users?sort=password_change_required&order=desc", nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	resp, _ := http.DefaultClient.Do(req)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(b))
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	if _, ok := result["users"]; !ok {
		t.Fatal("expected users array in response")
	}
}

func TestImportNameEmptyDefaultsToEmail(t *testing.T) {
	_, adminToken := ensureTestAdmin(t)
	ts := time.Now().Format("150405")
	email := "imp-empty-name-" + ts + "@test.com"

	t.Cleanup(func() {
		testPool.Exec(context.Background(), `DELETE FROM member WHERE user_id IN (SELECT id FROM "user" WHERE email = $1)`, email)
		testPool.Exec(context.Background(), `DELETE FROM "user" WHERE email = $1`, email)
	})

	csvContent := fmt.Sprintf("name,email\n,%s\n", email)
	body, ct := multipartFileForm("users.csv", csvContent)
	req, _ := http.NewRequest("POST", testServer.URL+"/api/admin/users/import", body)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", ct)
	resp, _ := http.DefaultClient.Do(req)
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(b))
	}

	// Verify name in DB equals email
	var name string
	testPool.QueryRow(context.Background(), `SELECT name FROM "user" WHERE email = $1`, email).Scan(&name)
	if name != email {
		t.Errorf("expected name=%q (defaulted from email), got %q", email, name)
	}
}

func TestImportMDPasswordTrimmed(t *testing.T) {
	ts := time.Now().Format("150405")
	email := "trim-" + ts + "@test.com"
	password := "mypassword"

	t.Cleanup(func() {
		testPool.Exec(context.Background(), `DELETE FROM member WHERE user_id IN (SELECT id FROM "user" WHERE email = $1)`, email)
		testPool.Exec(context.Background(), `DELETE FROM "user" WHERE email = $1`, email)
	})

	// MD file with trailing spaces on password column
	mdContent := fmt.Sprintf("| name | email | password |\n|------|-------|----------|\n| TrimTest | %s | %s   |\n", email, password)
	_, adminToken := ensureTestAdmin(t)
	body, ct := multipartFileForm("users.md", mdContent)
	req, _ := http.NewRequest("POST", testServer.URL+"/api/admin/users/import", body)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", ct)
	resp, _ := http.DefaultClient.Do(req)
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		t.Fatalf("import failed: %d: %s", resp.StatusCode, string(b))
	}
	resp.Body.Close()

	// Verify password hash in DB matches trimmed password
	var pwHash string
	testPool.QueryRow(context.Background(), `SELECT password_hash FROM "user" WHERE email = $1`, email).Scan(&pwHash)
	if err := bcrypt.CompareHashAndPassword([]byte(pwHash), []byte(password)); err != nil {
		t.Errorf("password hash does NOT match trimmed password '%s': %v", password, err)
		t.Log("The hash was likely generated with trailing whitespace in the password")
	}
	// Also verify the hash does NOT match the password WITH trailing space
	if bcrypt.CompareHashAndPassword([]byte(pwHash), []byte(password+" ")) == nil {
		t.Error("password hash matches password WITH trailing space — trimming is NOT working")
	}
}

func TestAdminAccessNonMemberWorkspace(t *testing.T) {
	_, adminToken := ensureTestAdmin(t)
	ts := time.Now().Format("150405")

	// Create a workspace owned by a regular user
	var wsID string
	email := "nonmember-ws-" + ts + "@test.com"
	userID := createAuthTestUser(t, email, "user", false, false)

	t.Cleanup(func() {
		testPool.Exec(context.Background(), `DELETE FROM workspace WHERE name LIKE 'test-nonmember-%'`)
		testPool.Exec(context.Background(), `DELETE FROM member WHERE user_id IN (SELECT id FROM "user" WHERE email = $1)`, email)
		testPool.Exec(context.Background(), `DELETE FROM "user" WHERE email = $1`, email)
	})

	testPool.QueryRow(context.Background(), `
		INSERT INTO workspace (name, slug, issue_prefix)
		VALUES ('test-nonmember-`+ts+`', 'test-nonmember-`+ts+`', 'TST')
		RETURNING id`).Scan(&wsID)
	testPool.Exec(context.Background(),
		`INSERT INTO member (workspace_id, user_id, role) VALUES ($1, $2, 'owner')`,
		parseUUID(wsID), parseUUID(userID))

	// Admin (not a member) should still be able to access workspace members
	req, _ := http.NewRequest("GET", testServer.URL+"/api/workspaces/"+wsID+"/members", nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	resp, _ := http.DefaultClient.Do(req)
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		t.Errorf("admin should access non-member workspace, got %d: %s", resp.StatusCode, string(b))
	}
}

func TestAdminListWorkspacesReturnsAll(t *testing.T) {
	_, adminToken := ensureTestAdmin(t)
	ts := time.Now().Format("150405")

	// Create a workspace as a regular user (admin is not a member)
	email := "listws-" + ts + "@test.com"
	createAuthTestUser(t, email, "user", false, false)
	slug := "test-listws-" + ts

	t.Cleanup(func() {
		testPool.Exec(context.Background(), `DELETE FROM workspace WHERE slug = $1`, slug)
		testPool.Exec(context.Background(), `DELETE FROM member WHERE user_id IN (SELECT id FROM "user" WHERE email = $1)`, email)
		testPool.Exec(context.Background(), `DELETE FROM "user" WHERE email = $1`, email)
	})

	_, err := testPool.Exec(context.Background(),
		`INSERT INTO workspace (name, slug, issue_prefix) VALUES ($1, $2, 'TST')`,
		"Test ListWS "+ts, slug)
	if err != nil {
		t.Fatalf("failed to create workspace: %v", err)
	}

	// Admin should see the workspace even though not a member
	req, _ := http.NewRequest("GET", testServer.URL+"/api/workspaces", nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	resp, _ := http.DefaultClient.Do(req)
	defer resp.Body.Close()

	var workspaces []map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&workspaces)

	found := false
	for _, ws := range workspaces {
		if ws["slug"] == slug {
			found = true
			break
		}
	}
	if !found {
		t.Error("admin should see all workspaces including non-member ones")
	}
}

func TestAdminNotInMemberList(t *testing.T) {
	_, adminToken := ensureTestAdmin(t)
	ts := time.Now().Format("150405")

	email := "nomember-" + ts + "@test.com"
	userID := createAuthTestUser(t, email, "user", false, false)
	slug := "test-nomember-" + ts
	var wsID string

	t.Cleanup(func() {
		testPool.Exec(context.Background(), `DELETE FROM workspace WHERE slug = $1`, slug)
		testPool.Exec(context.Background(), `DELETE FROM member WHERE user_id IN (SELECT id FROM "user" WHERE email = $1)`, email)
		testPool.Exec(context.Background(), `DELETE FROM "user" WHERE email = $1`, email)
	})

	testPool.QueryRow(context.Background(),
		`INSERT INTO workspace (name, slug, issue_prefix) VALUES ($1, $2, 'TST') RETURNING id`,
		"Test NoMember "+ts, slug).Scan(&wsID)
	testPool.Exec(context.Background(),
		`INSERT INTO member (workspace_id, user_id, role) VALUES ($1, $2, 'owner')`,
		parseUUID(wsID), parseUUID(userID))

	// Get members as admin — should not include admin in list
	req, _ := http.NewRequest("GET", testServer.URL+"/api/workspaces/"+wsID+"/members", nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	resp, _ := http.DefaultClient.Do(req)
	defer resp.Body.Close()

	var members []map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&members)

	for _, m := range members {
		email, _ := m["email"].(string)
		if email == "admin@agent.com" {
			t.Error("admin should not appear in workspace member list")
		}
	}
}

func TestCreateWorkspaceDoesNotSyncAdmin(t *testing.T) {
	ts := time.Now().Format("150405")

	// Create a regular user
	email := "nosync-" + ts + "@test.com"
	userID := createAuthTestUser(t, email, "user", false, false)
	userToken, _ := generateTestJWT(userID, email, "TestUser")
	slug := "nosync-" + ts

	t.Cleanup(func() {
		testPool.Exec(context.Background(), `DELETE FROM workspace WHERE slug = $1`, slug)
		testPool.Exec(context.Background(), `DELETE FROM member WHERE user_id IN (SELECT id FROM "user" WHERE email = $1)`, email)
		testPool.Exec(context.Background(), `DELETE FROM "user" WHERE email = $1`, email)
	})

	// Regular user creates a workspace
	body := fmt.Sprintf(`{"name":"NoSync%s","slug":"%s","issue_prefix":"NSY"}`, ts, slug)
	req, _ := http.NewRequest("POST", testServer.URL+"/api/workspaces", strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+userToken)
	req.Header.Set("Content-Type", "application/json")
	resp, _ := http.DefaultClient.Do(req)
	if resp.StatusCode != http.StatusCreated {
		b, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 201, got %d: %s", resp.StatusCode, string(b))
	}
	resp.Body.Close()

	// Admin should NOT be a member of the newly created workspace
	var count int
	testPool.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM member m JOIN "user" u ON m.user_id = u.id WHERE m.workspace_id = (SELECT id FROM workspace WHERE slug = $1) AND u.role = 'admin'`,
		slug).Scan(&count)
	if count > 0 {
		t.Errorf("admin should not be auto-added to new workspace, found %d admin member(s)", count)
	}
}

func TestAdminCanRemoveNonAdminMember(t *testing.T) {
	_, adminToken := ensureTestAdmin(t)
	ts := time.Now().Format("150405")

	email := "rm-member-" + ts + "@test.com"
	userID := createAuthTestUser(t, email, "user", false, false)
	slug := "test-rm-" + ts

	t.Cleanup(func() {
		testPool.Exec(context.Background(), `DELETE FROM workspace WHERE slug = $1`, slug)
		testPool.Exec(context.Background(), `DELETE FROM member WHERE user_id IN (SELECT id FROM "user" WHERE email = $1)`, email)
		testPool.Exec(context.Background(), `DELETE FROM "user" WHERE email = $1`, email)
	})

	var wsID string
	testPool.QueryRow(context.Background(),
		`INSERT INTO workspace (name, slug, issue_prefix) VALUES ($1, $2, 'TST') RETURNING id`,
		"Test Remove "+ts, slug).Scan(&wsID)
	var memberID string
	testPool.QueryRow(context.Background(),
		`INSERT INTO member (workspace_id, user_id, role) VALUES ($1, $2, 'member') RETURNING id`,
		parseUUID(wsID), parseUUID(userID)).Scan(&memberID)

	// Admin (not a workspace member) removes a regular member
	req, _ := http.NewRequest("DELETE", testServer.URL+"/api/workspaces/"+wsID+"/members/"+memberID, nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	resp, _ := http.DefaultClient.Do(req)
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		b, _ := io.ReadAll(resp.Body)
		t.Errorf("admin should be able to remove non-admin member, got %d: %s", resp.StatusCode, string(b))
	}
}
