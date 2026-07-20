package main

import (
	"context"
	"encoding/json"
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

func TestAdminProtection_AdminCanRemoveNonAdmin(t *testing.T) {
	_, adminToken := ensureTestAdmin(t)
	ts := time.Now().Format("150405")
	slug := "arm-" + ts
	body := `{"name":"ARM","slug":"` + slug + `"}`
	req, _ := http.NewRequest("POST", testServer.URL+"/api/workspaces", strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")
	resp, _ := http.DefaultClient.Do(req)
	defer resp.Body.Close()
	var ws struct{ ID string }
	json.NewDecoder(resp.Body).Decode(&ws)
	time.Sleep(150 * time.Millisecond)
	hash, _ := bcrypt.GenerateFromPassword([]byte("p"), bcrypt.DefaultCost)
	target, _ := db.New(testPool).CreateUserWithPassword(context.Background(), db.CreateUserWithPasswordParams{
		Name: "T", Email: "tgt-" + ts + "@a.com", PasswordHash: pgtype.Text{String: string(hash), Valid: true},
	})
	t.Cleanup(func() {
		bg := context.Background()
		testPool.Exec(bg, `DELETE FROM member WHERE workspace_id=$1`, ws.ID)
		testPool.Exec(bg, `DELETE FROM workspace WHERE slug=$1`, slug)
		testPool.Exec(bg, `DELETE FROM member WHERE user_id=$1`, target.ID)
		testPool.Exec(bg, `DELETE FROM "user" WHERE id=$1`, target.ID)
	})
	var memberID string
	testPool.QueryRow(context.Background(), `INSERT INTO member (workspace_id,user_id,role) VALUES ($1,$2,'member') RETURNING id`, ws.ID, util.UUIDToString(target.ID)).Scan(&memberID)
	req2, _ := http.NewRequest("DELETE", testServer.URL+"/api/workspaces/"+ws.ID+"/members/"+memberID, nil)
	req2.Header.Set("Authorization", "Bearer "+adminToken)
	resp2, _ := http.DefaultClient.Do(req2)
	defer resp2.Body.Close()
	if resp2.StatusCode != http.StatusNoContent {
		b, _ := io.ReadAll(resp2.Body)
		t.Errorf("expected 204, got %d: %s", resp2.StatusCode, string(b))
	}
}
