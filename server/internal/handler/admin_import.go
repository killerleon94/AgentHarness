package handler

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"

	"github.com/extrame/xls"
	"github.com/jackc/pgx/v5/pgtype"
	excelize "github.com/xuri/excelize/v2"
	"golang.org/x/crypto/bcrypt"

	"github.com/multica-ai/multica/server/internal/logger"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

type importUser struct {
	Name     string
	Email    string
	Password string
}

type ImportUsersResponse struct {
	Total   int             `json:"total"`
	Created int             `json:"created"`
	Failed  int             `json:"failed"`
	Results []ImportUserRow `json:"results"`
}

type ImportUserRow struct {
	Email   string `json:"email"`
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

var supportedExts = []string{".xls", ".xlsx", ".csv", ".md"}

func getExt(filename string) string {
	lower := strings.ToLower(filename)
	for _, ext := range supportedExts {
		if strings.HasSuffix(lower, ext) {
			return ext
		}
	}
	return ""
}

func parseUsers(content []byte, ext string) ([]importUser, error) {
	switch ext {
	case ".xlsx":
		return parseUsersFromXLSX(content)
	case ".xls":
		return parseUsersFromXLS(content)
	case ".csv":
		return parseUsersFromCSV(content)
	case ".md":
		return parseUsersFromMarkdown(content)
	default:
		return nil, fmt.Errorf("unsupported format: %s", ext)
	}
}

func parseUsersFromXLSX(data []byte) ([]importUser, error) {
	f, err := excelize.OpenReader(bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("failed to open xlsx: %w", err)
	}
	defer f.Close()

	rows, err := f.GetRows(f.GetSheetName(0))
	if err != nil {
		return nil, fmt.Errorf("failed to read sheet: %w", err)
	}
	if len(rows) < 2 {
		return nil, fmt.Errorf("file must have a header row and at least one data row")
	}

	return parseRows(rows)
}

func parseUsersFromXLS(data []byte) ([]importUser, error) {
	wb, err := xls.OpenReader(bytes.NewReader(data), "utf-8")
	if err != nil {
		return nil, fmt.Errorf("failed to open xls: %w", err)
	}

	sheet := wb.GetSheet(0)
	if sheet == nil {
		return nil, fmt.Errorf("no sheet found in xls file")
	}
	if sheet.MaxRow < 2 {
		return nil, fmt.Errorf("file must have a header row and at least one data row")
	}

	rows := make([][]string, 0, sheet.MaxRow+1)
	for i := 0; i <= int(sheet.MaxRow); i++ {
		row := sheet.Row(i)
		if row == nil {
			continue
		}
		cells := make([]string, 0, row.LastCol()+1)
		for j := 0; j <= row.LastCol(); j++ {
			cells = append(cells, row.Col(j))
		}
		rows = append(rows, cells)
	}

	return parseRows(rows)
}

func parseUsersFromCSV(data []byte) ([]importUser, error) {
	r := csv.NewReader(bytes.NewReader(data))
	r.TrimLeadingSpace = true

	records, err := r.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("failed to read csv: %w", err)
	}
	if len(records) < 2 {
		return nil, fmt.Errorf("csv must have a header row and at least one data row")
	}

	return parseRows(records)
}

func parseUsersFromMarkdown(data []byte) ([]importUser, error) {
	lines := strings.Split(string(data), "\n")

	// find the table
	var headerIdx int = -1
	for i, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "|") && strings.Contains(trimmed, "name") {
			headerIdx = i
			break
		}
	}
	if headerIdx == -1 {
		return nil, fmt.Errorf("no markdown table header found")
	}

	rows := make([][]string, 0)
	rows = append(rows, parseMarkdownRow(lines[headerIdx]))

	for i := headerIdx + 1; i < len(lines); i++ {
		trimmed := strings.TrimSpace(lines[i])
		if trimmed == "" || !strings.HasPrefix(trimmed, "|") {
			continue
		}
		if isMarkdownSeparator(trimmed) {
			continue
		}
		rows = append(rows, parseMarkdownRow(trimmed))
	}

	return parseRows(rows)
}

func isMarkdownSeparator(line string) bool {
	trimmed := strings.TrimSpace(line)
	if !strings.HasPrefix(trimmed, "|") {
		return false
	}
	parts := strings.Split(trimmed, "|")
	allSeparator := true
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		for _, ch := range p {
			if ch != '-' && ch != ':' {
				allSeparator = false
				break
			}
		}
		if !allSeparator {
			break
		}
	}
	return allSeparator
}

func parseMarkdownRow(line string) []string {
	parts := strings.Split(line, "|")
	cells := make([]string, 0, len(parts))
	for _, p := range parts {
		cells = append(cells, strings.TrimSpace(p))
	}
	return cells
}

func parseRows(rows [][]string) ([]importUser, error) {
	if len(rows) < 2 {
		return nil, fmt.Errorf("file must have a header row and at least one data row")
	}

	header := make(map[string]int)
	for i, col := range rows[0] {
		key := strings.TrimSpace(col)
		switch key {
		case "name", "email", "password":
			header[key] = i
		}
	}

	nameIdx, hasName := header["name"]
	emailIdx, hasEmail := header["email"]
	passwordIdx := -1
	if pIdx, ok := header["password"]; ok {
		passwordIdx = pIdx
	}

	if !hasEmail {
		return nil, fmt.Errorf("missing required column: email")
	}

	var users []importUser
	for i := 1; i < len(rows); i++ {
		row := rows[i]

		email := ""
		if emailIdx < len(row) {
			email = strings.TrimSpace(row[emailIdx])
		}
		if email == "" {
			continue
		}

		name := email
		if hasName && nameIdx < len(row) {
			n := strings.TrimSpace(row[nameIdx])
			if n != "" {
				name = n
			}
		}

		password := ""
		if passwordIdx >= 0 && passwordIdx < len(row) {
			password = strings.TrimSpace(row[passwordIdx])
		}

		users = append(users, importUser{
			Name:     name,
			Email:    email,
			Password: password,
		})
	}

	if len(users) == 0 {
		return nil, fmt.Errorf("no valid user rows found")
	}

	return users, nil
}

func (h *Handler) ImportUsers(w http.ResponseWriter, r *http.Request) {
	const maxSize = 10 << 20
	r.Body = http.MaxBytesReader(w, r.Body, maxSize)
	if err := r.ParseMultipartForm(maxSize); err != nil {
		writeError(w, http.StatusRequestEntityTooLarge, "file too large (max 10MB)")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "missing file field")
		return
	}
	defer file.Close()

	ext := getExt(header.Filename)
	if ext == "" {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("unsupported format, use: %s", strings.Join(supportedExts, ", ")))
		return
	}

	content, err := io.ReadAll(file)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to read file")
		return
	}

	parsedUsers, err := parseUsers(content, ext)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	result := ImportUsersResponse{
		Total:   len(parsedUsers),
		Results: make([]ImportUserRow, 0, len(parsedUsers)),
	}

	for _, u := range parsedUsers {
		email := strings.ToLower(strings.TrimSpace(u.Email))
		if email == "" {
			result.Results = append(result.Results, ImportUserRow{Email: email, Error: "email is required"})
			result.Failed++
			continue
		}
		if !isValidEmail(email) {
			result.Results = append(result.Results, ImportUserRow{Email: email, Error: "invalid email format"})
			result.Failed++
			continue
		}

		name := u.Name
		if name == "" {
			name = email
		}

		password := u.Password
		if password == "" {
			password = defaultPassword(email)
		}

		hash, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		user, err := h.Queries.CreateUserWithPassword(r.Context(), db.CreateUserWithPasswordParams{
			Name:                   name,
			Email:                  email,
			PasswordHash:           pgtype.Text{String: string(hash), Valid: true},
			PasswordChangeRequired: true,
		})
		if err != nil {
			errMsg := err.Error()
			if isUniqueViolation(err) {
				errMsg = "email already exists"
			}
			result.Results = append(result.Results, ImportUserRow{Email: email, Error: errMsg})
			result.Failed++
			continue
		}

		if err := h.ensureUserWorkspace(r.Context(), user); err != nil {
			slog.Warn("import: failed to create personal workspace", "user_id", uuidToString(user.ID), "error", err)
		}

		result.Results = append(result.Results, ImportUserRow{Email: email, Success: true})
		result.Created++
	}

	slog.Info("admin imported users", append(logger.RequestAttrs(r),
		"total", result.Total, "created", result.Created, "failed", result.Failed, "ext", ext)...)
	writeJSON(w, http.StatusOK, result)
}

func (h *Handler) DownloadUserTemplate(w http.ResponseWriter, r *http.Request) {
	format := strings.ToLower(r.URL.Query().Get("format"))
	if format == "" {
		format = "xlsx"
	}

	switch format {
	case "md":
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.Header().Set("Content-Disposition", "attachment; filename=user-import-template.md")
		w.Write([]byte("| name | email | password |\n|------|-------|----------|\n| | | |\n"))
	case "xlsx":
		f := excelize.NewFile()
		defer f.Close()
		f.SetCellValue("Sheet1", "A1", "name")
		f.SetCellValue("Sheet1", "B1", "email")
		f.SetCellValue("Sheet1", "C1", "password")
		buf, err := f.WriteToBuffer()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to generate template")
			return
		}
		w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
		w.Header().Set("Content-Disposition", "attachment; filename=user-import-template.xlsx")
		w.Write(buf.Bytes())
	default:
		writeError(w, http.StatusBadRequest, "unsupported template format, use: xlsx, md")
	}
}
