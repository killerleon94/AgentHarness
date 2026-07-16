package handler

import (
	"strings"
	"testing"
)

func TestParseRows_ColumnsCaseSensitive(t *testing.T) {
	rows := [][]string{
		{"name", "email", "Password"},
		{"Alice", "a@c.com", "secret"},
	}
	users, err := parseRows(rows)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(users) != 1 {
		t.Fatalf("expected 1 user, got %d", len(users))
	}
	if users[0].Name != "Alice" {
		t.Errorf("name = %q, want Alice", users[0].Name)
	}
	if users[0].Email != "a@c.com" {
		t.Errorf("email = %q, want a@c.com", users[0].Email)
	}
	// Password column is "Password" (capital P), should NOT match "password" (lowercase)
	if users[0].Password != "" {
		t.Errorf("password = %q, want empty (case-sensitive mismatch)", users[0].Password)
	}
}

func TestParseRows_NameEmptyDefaultsToEmail(t *testing.T) {
	rows := [][]string{
		{"name", "email"},
		{"", "user@c.com"},
	}
	users, err := parseRows(rows)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if users[0].Name != "user@c.com" {
		t.Errorf("name = %q, want user@c.com", users[0].Name)
	}
}

func TestParseRows_MissingEmailColumn(t *testing.T) {
	rows := [][]string{
		{"name", "password"},
		{"Alice", "secret"},
	}
	_, err := parseRows(rows)
	if err == nil || !strings.Contains(err.Error(), "email") {
		t.Errorf("expected error about missing email column, got: %v", err)
	}
}

func TestParseRows_EmptyRowsSkipped(t *testing.T) {
	rows := [][]string{
		{"name", "email"},
		{"Alice", "a@c.com"},
		{"", ""},
	}
	users, err := parseRows(rows)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(users) != 1 {
		t.Errorf("expected 1 user (skipped empty row), got %d", len(users))
	}
}

func TestCSVParsing(t *testing.T) {
	content := "name,email,password\n张三,zs@c.com,mypass\n李四,ls@c.com,\n"
	users, err := parseUsersFromCSV([]byte(content))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(users) != 2 {
		t.Fatalf("expected 2 users, got %d", len(users))
	}
	if users[0].Password != "mypass" {
		t.Errorf("password = %q, want mypass", users[0].Password)
	}
	if users[1].Password != "" {
		t.Errorf("expected empty password for unset column")
	}
}

func TestMarkdownParsing(t *testing.T) {
	content := "| name | email | password |\n|------|-------|----------|\n| 张三 | zs@c.com | mypass |\n| 李四 | ls@c.com | |\n"
	users, err := parseUsersFromMarkdown([]byte(content))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(users) != 2 {
		t.Fatalf("expected 2 users, got %d", len(users))
	}
	if users[0].Name != "张三" {
		t.Errorf("name = %q, want 张三", users[0].Name)
	}
}

func TestMarkdownParsing_AlignedColumns(t *testing.T) {
	content := "| name | email | password |\n|:-----|:------|:---------|\n| Alice | a@c.com | secret |\n"
	users, err := parseUsersFromMarkdown([]byte(content))
	if err != nil {
		t.Fatalf("unexpected error for aligned columns: %v", err)
	}
	if len(users) != 1 {
		t.Fatalf("expected 1 user, got %d", len(users))
	}
}

func TestParseRows_TrimsWhitespace(t *testing.T) {
	rows := [][]string{
		{" name ", " email ", " password "},
		{" Alice ", " a@c.com ", " mypass  "},
	}
	users, err := parseRows(rows)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if users[0].Name != "Alice" {
		t.Errorf("name = %q, want Alice", users[0].Name)
	}
	if users[0].Password != "mypass" {
		t.Errorf("password = %q, want mypass", users[0].Password)
	}
}

func TestMarkdownParsing_TrailingSpaces(t *testing.T) {
	content := "| name | email | password |\n|------|-------|----------|\n| Alice | a@c.com | mypass   |\n"
	users, err := parseUsersFromMarkdown([]byte(content))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if users[0].Password != "mypass" {
		t.Errorf("password = %q, want mypass (trailing spaces should be trimmed)", users[0].Password)
	}
}

func TestMarkdownParsing_CRLF(t *testing.T) {
	content := "| name | email |\r\n|------|-------|\r\n| Alice | a@c.com |\r\n"
	users, err := parseUsersFromMarkdown([]byte(content))
	if err != nil {
		t.Fatalf("unexpected error with CRLF: %v", err)
	}
	if len(users) != 1 || users[0].Name != "Alice" {
		t.Errorf("CRLF parsing failed: got %+v", users)
	}
}

func TestCSVParsing_Spaces(t *testing.T) {
	content := " name , email , password \n Alice , a@c.com , mypass  \n"
	users, err := parseUsersFromCSV([]byte(content))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if users[0].Name != "Alice" || users[0].Password != "mypass" {
		t.Errorf("name=%q password=%q, want Alice/mypass", users[0].Name, users[0].Password)
	}
}
