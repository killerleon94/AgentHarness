package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"golang.org/x/crypto/bcrypt"

	"github.com/multica-ai/multica/server/internal/logger"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

type CreateUserRequest struct {
	Email string `json:"email"`
	Name  string `json:"name"`
}

type BatchCreateUserRequest struct {
	Users []CreateUserRequest `json:"users"`
}

type BatchCreateUserResult struct {
	Email   string `json:"email"`
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

func defaultPassword(email string) string {
	if idx := strings.LastIndex(email, "."); idx > 0 {
		return email[:idx]
	}
	return email
}

var emailRegex = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)

func isValidEmail(email string) bool {
	return emailRegex.MatchString(email)
}

func (h *Handler) CreateUser(w http.ResponseWriter, r *http.Request) {
	var req CreateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	if req.Email == "" {
		writeError(w, http.StatusBadRequest, "email is required")
		return
	}
	if !isValidEmail(req.Email) {
		writeError(w, http.StatusBadRequest, "invalid email format")
		return
	}

	// Generate default password
	password := defaultPassword(req.Email)

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to generate password")
		return
	}

	user, err := h.Queries.CreateUserWithPassword(r.Context(), db.CreateUserWithPasswordParams{
		Name:                   req.Name,
		Email:                  req.Email,
		PasswordHash:           pgtype.Text{String: string(hash), Valid: true},
		PasswordChangeRequired: true,
	})
	if err != nil {
		if isUniqueViolation(err) {
			writeError(w, http.StatusConflict, "user with this email already exists")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to create user: "+err.Error())
		return
	}

	// Ensure the user has a personal workspace
	if err := h.ensureUserWorkspace(r.Context(), user); err != nil {
		slog.Warn("failed to create personal workspace", append(logger.RequestAttrs(r), "error", err, "user_id", uuidToString(user.ID))...)
	}

	slog.Info("admin created user", append(logger.RequestAttrs(r), "user_id", uuidToString(user.ID), "email", req.Email)...)
	writeJSON(w, http.StatusCreated, userToResponse(user))
}

func (h *Handler) BatchCreateUsers(w http.ResponseWriter, r *http.Request) {
	var req BatchCreateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	results := make([]BatchCreateUserResult, 0, len(req.Users))
	for _, u := range req.Users {
		u.Email = strings.ToLower(strings.TrimSpace(u.Email))
		if u.Email == "" {
			results = append(results, BatchCreateUserResult{Email: u.Email, Error: "email is required"})
			continue
		}
		if !isValidEmail(u.Email) {
			results = append(results, BatchCreateUserResult{Email: u.Email, Error: "invalid email format"})
			continue
		}

		password := defaultPassword(u.Email)

		hash, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		user, err := h.Queries.CreateUserWithPassword(r.Context(), db.CreateUserWithPasswordParams{
			Name:                   u.Name,
			Email:                  u.Email,
			PasswordHash:           pgtype.Text{String: string(hash), Valid: true},
			PasswordChangeRequired: true,
		})
		if err != nil {
			if isUniqueViolation(err) {
				results = append(results, BatchCreateUserResult{Email: u.Email, Error: "email already exists"})
			} else {
				results = append(results, BatchCreateUserResult{Email: u.Email, Error: err.Error()})
			}
			continue
		}

		// Best-effort: create personal workspace
		if err := h.ensureUserWorkspace(r.Context(), user); err != nil {
			slog.Warn("batch create: failed to create personal workspace", "user_id", uuidToString(user.ID), "error", err)
		}

		results = append(results, BatchCreateUserResult{Email: u.Email, Success: true})
	}

	writeJSON(w, http.StatusOK, results)
}

func (h *Handler) DisableUser(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "id")
	uid := parseUUID(userID)

	user, err := h.Queries.GetUser(r.Context(), uid)
	if err != nil {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}

	if user.Role == "admin" {
		writeError(w, http.StatusBadRequest, "cannot disable admin users")
		return
	}

	if err := h.Queries.UpdateUserDisabled(r.Context(), db.UpdateUserDisabledParams{
		ID:       uid,
		Disabled: true,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to disable user")
		return
	}

	slog.Info("admin disabled user", "user_id", userID)
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) EnableUser(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "id")
	uid := parseUUID(userID)

	if err := h.Queries.UpdateUserDisabled(r.Context(), db.UpdateUserDisabledParams{
		ID:       uid,
		Disabled: false,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to enable user")
		return
	}

	slog.Info("admin enabled user", "user_id", userID)
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

type AdminUpdateUserNameRequest struct {
	Name string `json:"name"`
}

func (h *Handler) AdminUpdateUserName(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "id")
	uid := parseUUID(userID)

	var req AdminUpdateUserNameRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "name cannot be empty")
		return
	}

	user, err := h.Queries.GetUser(r.Context(), uid)
	if err != nil {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}

	if user.Role == "admin" {
		writeError(w, http.StatusBadRequest, "cannot modify admin user")
		return
	}

	updated, err := h.Queries.AdminUpdateUserName(r.Context(), db.AdminUpdateUserNameParams{
		ID:   uid,
		Name: req.Name,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update user name")
		return
	}

	slog.Info("admin updated user name", "user_id", userID)
	writeJSON(w, http.StatusOK, userToResponse(updated))
}

func (h *Handler) ListUsers(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()

	page, _ := strconv.Atoi(q.Get("page"))
	if page < 1 {
		page = 1
	}
	perPage, _ := strconv.Atoi(q.Get("per_page"))
	if perPage < 1 {
		perPage = 20
	}
	if perPage > 100 {
		perPage = 100
	}

	sort := strings.ToLower(q.Get("sort"))
	if sort == "" {
		sort = "created_at"
	}
	order := strings.ToLower(q.Get("order"))
	if order != "asc" && order != "desc" {
		order = "desc"
	}

	allowedSorts := map[string]bool{
		"name": true, "email": true, "created_at": true,
		"role": true, "disabled": true,
		"password_change_required": true,
	}
	if !allowedSorts[sort] {
		writeError(w, http.StatusBadRequest, "invalid sort field: "+sort)
		return
	}

	search := strings.TrimSpace(q.Get("search"))

	disabledFilter := q.Get("disabled")
	var disabledParam string
	if disabledFilter == "true" {
		disabledParam = "t"
	} else if disabledFilter == "false" {
		disabledParam = "f"
	}

	offset := int32((page - 1) * perPage)
	limit := int32(perPage)

	count, err := h.Queries.CountUsers(r.Context(), db.CountUsersParams{
		Search:   search,
		Disabled: disabledParam,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to count users")
		return
	}

	users, err := h.listUsersPageRaw(r.Context(), search, disabledParam, sort, order, limit, offset)
	if err != nil {
		slog.Error("listUsersPageRaw failed", "error", err)
		writeError(w, http.StatusInternalServerError, "failed to list users")
		return
	}

	response := make([]UserResponse, 0, len(users))
	for _, u := range users {
		response = append(response, userToResponse(u))
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"users":    response,
		"total":    count,
		"page":     page,
		"per_page": perPage,
	})
}

const listUsersPageQuery = `SELECT id, name, email, avatar_url, created_at, updated_at, password_hash, password_change_required, role, disabled FROM "user"
WHERE ($1 = '' OR name ILIKE '%%' || $1 || '%%' OR email ILIKE '%%' || $1 || '%%')
  AND ($2 = '' OR (($2 = 't' AND disabled) OR ($2 = 'f' AND NOT disabled)))
ORDER BY %s %s
LIMIT $3 OFFSET $4`

func (h *Handler) listUsersPageRaw(ctx context.Context, search, disabled, sort, order string, limit, offset int32) ([]db.User, error) {
	query := fmt.Sprintf(listUsersPageQuery, sort, order)
	rows, err := h.DB.Query(ctx, query, search, disabled, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []db.User
	for rows.Next() {
		var u db.User
		if err := rows.Scan(
			&u.ID, &u.Name, &u.Email, &u.AvatarUrl,
			&u.CreatedAt, &u.UpdatedAt, &u.PasswordHash,
			&u.PasswordChangeRequired, &u.Role, &u.Disabled,
		); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

type BatchUserIDsRequest struct {
	UserIDs []string `json:"user_ids"`
}

func (h *Handler) BatchDisableUsers(w http.ResponseWriter, r *http.Request) {
	var req BatchUserIDsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if len(req.UserIDs) == 0 {
		writeError(w, http.StatusBadRequest, "user_ids is required")
		return
	}

	ids := make([]pgtype.UUID, 0, len(req.UserIDs))
	for _, s := range req.UserIDs {
		uid := parseUUID(s)
		ids = append(ids, uid)
	}

	err := h.Queries.BatchUpdateUserDisabled(r.Context(), db.BatchUpdateUserDisabledParams{
		Column1:  ids,
		Disabled: true,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to disable users")
		return
	}

	slog.Info("admin batch disabled users", "count", len(ids))
	writeJSON(w, http.StatusOK, map[string]interface{}{"count": len(ids)})
}

func (h *Handler) BatchEnableUsers(w http.ResponseWriter, r *http.Request) {
	var req BatchUserIDsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if len(req.UserIDs) == 0 {
		writeError(w, http.StatusBadRequest, "user_ids is required")
		return
	}

	ids := make([]pgtype.UUID, 0, len(req.UserIDs))
	for _, s := range req.UserIDs {
		uid := parseUUID(s)
		ids = append(ids, uid)
	}

	err := h.Queries.BatchUpdateUserDisabled(r.Context(), db.BatchUpdateUserDisabledParams{
		Column1:  ids,
		Disabled: false,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to enable users")
		return
	}

	slog.Info("admin batch enabled users", "count", len(ids))
	writeJSON(w, http.StatusOK, map[string]interface{}{"count": len(ids)})
}
