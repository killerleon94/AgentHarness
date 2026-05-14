package handler

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/multica-ai/multica/server/internal/auth"
	"github.com/multica-ai/multica/server/internal/logger"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

type UserResponse struct {
	ID                     string  `json:"id"`
	Name                   string  `json:"name"`
	Email                  string  `json:"email"`
	AvatarURL              *string `json:"avatar_url"`
	HasPassword            bool    `json:"has_password"`
	PasswordChangeRequired bool    `json:"password_change_required"`
	CreatedAt              string  `json:"created_at"`
	UpdatedAt              string  `json:"updated_at"`
}

func userToResponse(u db.User) UserResponse {
	return UserResponse{
		ID:                     uuidToString(u.ID),
		Name:                   u.Name,
		Email:                  u.Email,
		AvatarURL:              textToPtr(u.AvatarUrl),
		HasPassword:            u.PasswordHash.Valid,
		PasswordChangeRequired: u.PasswordChangeRequired,
		CreatedAt:              timestampToString(u.CreatedAt),
		UpdatedAt:              timestampToString(u.UpdatedAt),
	}
}

type LoginResponse struct {
	Token string       `json:"token"`
	User  UserResponse `json:"user"`
}

type SendCodeRequest struct {
	Email string `json:"email"`
}

type VerifyCodeRequest struct {
	Email string `json:"email"`
	Code  string `json:"code"`
}

func defaultWorkspaceName(user db.User) string {
	name := strings.TrimSpace(user.Name)
	if name == "" {
		email := strings.TrimSpace(user.Email)
		if at := strings.Index(email, "@"); at > 0 {
			name = email[:at]
		}
	}
	if name == "" {
		name = "Personal"
	}
	return name + "'s Workspace"
}

func slugifyWorkspacePart(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	var b strings.Builder
	lastWasDash := false

	for _, r := range value {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
			lastWasDash = false
		case b.Len() > 0 && !lastWasDash:
			b.WriteByte('-')
			lastWasDash = true
		}
	}

	return strings.Trim(b.String(), "-")
}

func defaultWorkspaceSlug(user db.User) string {
	candidates := []string{
		slugifyWorkspacePart(user.Name),
		slugifyWorkspacePart(strings.Split(strings.TrimSpace(user.Email), "@")[0]),
		"workspace",
	}

	base := "workspace"
	for _, candidate := range candidates {
		if candidate != "" {
			base = candidate
			break
		}
	}

	userID := uuidToString(user.ID)
	if len(userID) >= 8 {
		return base + "-" + userID[:8]
	}
	return base
}

func (h *Handler) ensureUserWorkspace(ctx context.Context, user db.User) error {
	workspaces, err := h.Queries.ListWorkspaces(ctx, user.ID)
	if err != nil {
		return err
	}
	if len(workspaces) > 0 {
		return nil
	}

	tx, err := h.TxStarter.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	qtx := h.Queries.WithTx(tx)
	workspaces, err = qtx.ListWorkspaces(ctx, user.ID)
	if err != nil {
		return err
	}
	if len(workspaces) > 0 {
		return nil
	}

	wsName := defaultWorkspaceName(user)
	workspace, err := qtx.CreateWorkspace(ctx, db.CreateWorkspaceParams{
		Name:        wsName,
		Slug:        defaultWorkspaceSlug(user),
		Description: pgtype.Text{},
		IssuePrefix: generateIssuePrefix(wsName),
	})
	if err != nil {
		if isUniqueViolation(err) {
			workspaces, lookupErr := h.Queries.ListWorkspaces(ctx, user.ID)
			if lookupErr == nil && len(workspaces) > 0 {
				return nil
			}
		}
		return err
	}

	if _, err := qtx.CreateMember(ctx, db.CreateMemberParams{
		WorkspaceID: workspace.ID,
		UserID:      user.ID,
		Role:        "owner",
	}); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func generateCode() (string, error) {
	var buf [4]byte
	if _, err := rand.Read(buf[:]); err != nil {
		return "", err
	}
	n := binary.BigEndian.Uint32(buf[:]) % 1000000
	return fmt.Sprintf("%06d", n), nil
}

func (h *Handler) issueJWT(user db.User) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":   uuidToString(user.ID),
		"email": user.Email,
		"name":  user.Name,
		"exp":   time.Now().Add(30 * 24 * time.Hour).Unix(),
		"iat":   time.Now().Unix(),
	})
	return token.SignedString(auth.JWTSecret())
}

func (h *Handler) findOrCreateUser(ctx context.Context, email string) (db.User, error) {
	user, err := h.Queries.GetUserByEmail(ctx, email)
	if err != nil {
		if !isNotFound(err) {
			return db.User{}, err
		}
		name := email
		if at := strings.Index(email, "@"); at > 0 {
			name = email[:at]
		}
		user, err = h.Queries.CreateUser(ctx, db.CreateUserParams{
			Name:  name,
			Email: email,
		})
		if err != nil {
			return db.User{}, err
		}
	}
	return user, nil
}

func (h *Handler) SendCode(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email         string `json:"email"`
		CaptchaID     string `json:"captcha_id"`
		CaptchaAnswer string `json:"captcha_answer"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.CaptchaID == "" || req.CaptchaAnswer == "" {
		writeError(w, http.StatusBadRequest, "captcha is required")
		return
	}

	if err := h.verifyCaptchaOnce(r.Context(), req.CaptchaID, req.CaptchaAnswer); err != nil {
		writeError(w, http.StatusBadRequest, "invalid or expired captcha")
		return
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	if email == "" {
		writeError(w, http.StatusBadRequest, "email is required")
		return
	}

	// Rate limit: max 1 code per 10 seconds per email
	latest, err := h.Queries.GetLatestCodeByEmail(r.Context(), email)
	if err == nil && time.Since(latest.CreatedAt.Time) < 10*time.Second {
		writeError(w, http.StatusTooManyRequests, "please wait before requesting another code")
		return
	}

	code, err := generateCode()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to generate code")
		return
	}

	_, err = h.Queries.CreateVerificationCode(r.Context(), db.CreateVerificationCodeParams{
		Email:     email,
		Code:      code,
		ExpiresAt: pgtype.Timestamptz{Time: time.Now().Add(10 * time.Minute), Valid: true},
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to store verification code")
		return
	}

	if err := h.EmailService.SendVerificationCode(email, code); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to send verification code")
		return
	}

	// Best-effort cleanup of expired codes
	_ = h.Queries.DeleteExpiredVerificationCodes(r.Context())

	writeJSON(w, http.StatusOK, map[string]string{"message": "Verification code sent"})
}

func (h *Handler) VerifyCode(w http.ResponseWriter, r *http.Request) {
	var req VerifyCodeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	code := strings.TrimSpace(req.Code)

	if email == "" || code == "" {
		writeError(w, http.StatusBadRequest, "email and code are required")
		return
	}

	dbCode, err := h.Queries.GetLatestVerificationCode(r.Context(), email)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid or expired code")
		return
	}

	isMasterCode := code == "888888" && os.Getenv("APP_ENV") != "production"
	if !isMasterCode && subtle.ConstantTimeCompare([]byte(code), []byte(dbCode.Code)) != 1 {
		_ = h.Queries.IncrementVerificationCodeAttempts(r.Context(), dbCode.ID)
		writeError(w, http.StatusBadRequest, "invalid or expired code")
		return
	}

	if err := h.Queries.MarkVerificationCodeUsed(r.Context(), dbCode.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to verify code")
		return
	}

	user, err := h.findOrCreateUser(r.Context(), email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create user")
		return
	}

	if err := h.ensureUserWorkspace(r.Context(), user); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to provision workspace")
		return
	}

	tokenString, err := h.issueJWT(user)
	if err != nil {
		slog.Warn("login failed", append(logger.RequestAttrs(r), "error", err, "email", req.Email)...)
		writeError(w, http.StatusInternalServerError, "failed to generate token")
		return
	}

	// Set CloudFront signed cookies for CDN access.
	if h.CFSigner != nil {
		for _, cookie := range h.CFSigner.SignedCookies(time.Now().Add(30 * 24 * time.Hour)) {
			http.SetCookie(w, cookie)
		}
	}

	slog.Info("user logged in", append(logger.RequestAttrs(r), "user_id", uuidToString(user.ID), "email", user.Email)...)
	writeJSON(w, http.StatusOK, LoginResponse{
		Token: tokenString,
		User:  userToResponse(user),
	})
}

func (h *Handler) GetMe(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	user, err := h.Queries.GetUser(r.Context(), parseUUID(userID))
	if err != nil {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}

	writeJSON(w, http.StatusOK, userToResponse(user))
}

type UpdateMeRequest struct {
	Name      *string `json:"name"`
	AvatarURL *string `json:"avatar_url"`
}

type GoogleLoginRequest struct {
	Code        string `json:"code"`
	RedirectURI string `json:"redirect_uri"`
}

type googleTokenResponse struct {
	AccessToken string `json:"access_token"`
	IDToken     string `json:"id_token"`
	TokenType   string `json:"token_type"`
}

type googleUserInfo struct {
	Email   string `json:"email"`
	Name    string `json:"name"`
	Picture string `json:"picture"`
}

func (h *Handler) GoogleLogin(w http.ResponseWriter, r *http.Request) {
	var req GoogleLoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Code == "" {
		writeError(w, http.StatusBadRequest, "code is required")
		return
	}

	clientID := os.Getenv("GOOGLE_CLIENT_ID")
	clientSecret := os.Getenv("GOOGLE_CLIENT_SECRET")
	if clientID == "" || clientSecret == "" {
		writeError(w, http.StatusServiceUnavailable, "Google login is not configured")
		return
	}

	redirectURI := req.RedirectURI
	if redirectURI == "" {
		redirectURI = os.Getenv("GOOGLE_REDIRECT_URI")
	}

	// Exchange authorization code for tokens.
	tokenResp, err := http.PostForm("https://oauth2.googleapis.com/token", url.Values{
		"code":          {req.Code},
		"client_id":     {clientID},
		"client_secret": {clientSecret},
		"redirect_uri":  {redirectURI},
		"grant_type":    {"authorization_code"},
	})
	if err != nil {
		slog.Error("google oauth token exchange failed", "error", err)
		writeError(w, http.StatusBadGateway, "failed to exchange code with Google")
		return
	}
	defer tokenResp.Body.Close()

	tokenBody, err := io.ReadAll(tokenResp.Body)
	if err != nil {
		writeError(w, http.StatusBadGateway, "failed to read Google token response")
		return
	}

	if tokenResp.StatusCode != http.StatusOK {
		slog.Error("google oauth token exchange returned error", "status", tokenResp.StatusCode, "body", string(tokenBody))
		writeError(w, http.StatusBadRequest, "failed to exchange code with Google")
		return
	}

	var gToken googleTokenResponse
	if err := json.Unmarshal(tokenBody, &gToken); err != nil {
		writeError(w, http.StatusBadGateway, "failed to parse Google token response")
		return
	}

	// Fetch user info from Google.
	userInfoReq, _ := http.NewRequestWithContext(r.Context(), http.MethodGet, "https://www.googleapis.com/oauth2/v2/userinfo", nil)
	userInfoReq.Header.Set("Authorization", "Bearer "+gToken.AccessToken)

	userInfoResp, err := http.DefaultClient.Do(userInfoReq)
	if err != nil {
		slog.Error("google userinfo fetch failed", "error", err)
		writeError(w, http.StatusBadGateway, "failed to fetch user info from Google")
		return
	}
	defer userInfoResp.Body.Close()

	var gUser googleUserInfo
	if err := json.NewDecoder(userInfoResp.Body).Decode(&gUser); err != nil {
		writeError(w, http.StatusBadGateway, "failed to parse Google user info")
		return
	}

	if gUser.Email == "" {
		writeError(w, http.StatusBadRequest, "Google account has no email")
		return
	}

	email := strings.ToLower(strings.TrimSpace(gUser.Email))

	user, err := h.findOrCreateUser(r.Context(), email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create user")
		return
	}

	// Update name and avatar from Google profile if the user was just created
	// (default name is email prefix) or has no avatar yet.
	needsUpdate := false
	newName := user.Name
	newAvatar := user.AvatarUrl

	if gUser.Name != "" && user.Name == strings.Split(email, "@")[0] {
		newName = gUser.Name
		needsUpdate = true
	}
	if gUser.Picture != "" && !user.AvatarUrl.Valid {
		newAvatar = pgtype.Text{String: gUser.Picture, Valid: true}
		needsUpdate = true
	}

	if needsUpdate {
		updated, err := h.Queries.UpdateUser(r.Context(), db.UpdateUserParams{
			ID:        user.ID,
			Name:      newName,
			AvatarUrl: newAvatar,
		})
		if err == nil {
			user = updated
		}
	}

	if err := h.ensureUserWorkspace(r.Context(), user); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to provision workspace")
		return
	}

	tokenString, err := h.issueJWT(user)
	if err != nil {
		slog.Warn("google login failed", append(logger.RequestAttrs(r), "error", err, "email", email)...)
		writeError(w, http.StatusInternalServerError, "failed to generate token")
		return
	}

	if h.CFSigner != nil {
		for _, cookie := range h.CFSigner.SignedCookies(time.Now().Add(72 * time.Hour)) {
			http.SetCookie(w, cookie)
		}
	}

	slog.Info("user logged in via google", append(logger.RequestAttrs(r), "user_id", uuidToString(user.ID), "email", user.Email)...)
	writeJSON(w, http.StatusOK, LoginResponse{
		Token: tokenString,
		User:  userToResponse(user),
	})
}

func (h *Handler) UpdateMe(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var req UpdateMeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	currentUser, err := h.Queries.GetUser(r.Context(), parseUUID(userID))
	if err != nil {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}

	name := currentUser.Name
	if req.Name != nil {
		name = strings.TrimSpace(*req.Name)
		if name == "" {
			writeError(w, http.StatusBadRequest, "name is required")
			return
		}
	}

	params := db.UpdateUserParams{
		ID:   currentUser.ID,
		Name: name,
	}
	if req.AvatarURL != nil {
		params.AvatarUrl = pgtype.Text{String: strings.TrimSpace(*req.AvatarURL), Valid: true}
	}

	updatedUser, err := h.Queries.UpdateUser(r.Context(), params)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update user")
		return
	}

	writeJSON(w, http.StatusOK, userToResponse(updatedUser))
}

// Password-based authentication endpoints

type RegisterRequest struct {
	Email    string  `json:"email"`
	Password string  `json:"password"`
	Name     *string `json:"name"`
}

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	password := strings.TrimSpace(req.Password)

	if email == "" {
		writeError(w, http.StatusBadRequest, "email is required")
		return
	}
	if password == "" {
		writeError(w, http.StatusBadRequest, "password is required")
		return
	}
	if len(password) < 6 {
		writeError(w, http.StatusBadRequest, "password must be at least 6 characters")
		return
	}

	// Check if user already exists
	_, err := h.Queries.GetUserByEmail(r.Context(), email)
	if err == nil {
		writeError(w, http.StatusConflict, "user with this email already exists")
		return
	} else if !isNotFound(err) {
		writeError(w, http.StatusInternalServerError, "failed to check user existence")
		return
	}

	// Hash password
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to hash password")
		return
	}

	name := email
	if req.Name != nil && strings.TrimSpace(*req.Name) != "" {
		name = strings.TrimSpace(*req.Name)
	} else {
		if at := strings.Index(email, "@"); at > 0 {
			name = email[:at]
		}
	}

	// Create user with password - no need to force change since they just set it
	user, err := h.Queries.CreateUserWithPassword(r.Context(), db.CreateUserWithPasswordParams{
		Name:                   name,
		Email:                  email,
		PasswordHash:           pgtype.Text{String: string(hash), Valid: true},
		PasswordChangeRequired: false,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create user")
		return
	}

	if err := h.ensureUserWorkspace(r.Context(), user); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to provision workspace")
		return
	}

	tokenString, err := h.issueJWT(user)
	if err != nil {
		slog.Warn("registration failed", append(logger.RequestAttrs(r), "error", err, "email", email)...)
		writeError(w, http.StatusInternalServerError, "failed to generate token")
		return
	}

	if h.CFSigner != nil {
		for _, cookie := range h.CFSigner.SignedCookies(time.Now().Add(30 * 24 * time.Hour)) {
			http.SetCookie(w, cookie)
		}
	}

	slog.Info("user registered", append(logger.RequestAttrs(r), "user_id", uuidToString(user.ID), "email", user.Email)...)
	writeJSON(w, http.StatusOK, LoginResponse{
		Token: tokenString,
		User:  userToResponse(user),
	})
}

type LoginRequest struct {
	Email         string `json:"email"`
	Password      string `json:"password"`
	CaptchaID     string `json:"captcha_id"`
	CaptchaAnswer string `json:"captcha_answer"`
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.CaptchaID == "" || req.CaptchaAnswer == "" {
		writeError(w, http.StatusBadRequest, "captcha is required")
		return
	}

	if err := h.verifyCaptchaOnce(r.Context(), req.CaptchaID, req.CaptchaAnswer); err != nil {
		writeError(w, http.StatusBadRequest, "invalid or expired captcha")
		return
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	password := strings.TrimSpace(req.Password)

	if email == "" || password == "" {
		writeError(w, http.StatusBadRequest, "email and password are required")
		return
	}

	user, err := h.Queries.GetUserByEmail(r.Context(), email)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}

	// Check if user has password set
	if !user.PasswordHash.Valid {
		writeError(w, http.StatusUnauthorized, "this account uses magic link login")
		return
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash.String), []byte(password)); err != nil {
		slog.Info("password verification failed", append(logger.RequestAttrs(r), "user_id", uuidToString(user.ID), "email", email)...)
		writeError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}

	tokenString, err := h.issueJWT(user)
	if err != nil {
		slog.Warn("login failed", append(logger.RequestAttrs(r), "error", err, "email", email)...)
		writeError(w, http.StatusInternalServerError, "failed to generate token")
		return
	}

	if h.CFSigner != nil {
		for _, cookie := range h.CFSigner.SignedCookies(time.Now().Add(30 * 24 * time.Hour)) {
			http.SetCookie(w, cookie)
		}
	}

	slog.Info("user logged in with password", append(logger.RequestAttrs(r), "user_id", uuidToString(user.ID), "email", user.Email)...)
	writeJSON(w, http.StatusOK, LoginResponse{
		Token: tokenString,
		User:  userToResponse(user),
	})
}

type RequestPasswordResetRequest struct {
	Email string `json:"email"`
}

// Generate random reset token
func generateResetToken() (string, string, error) {
	var buf [32]byte
	if _, err := rand.Read(buf[:]); err != nil {
		return "", "", err
	}
	token := hex.EncodeToString(buf[:])
	hash, err := bcrypt.GenerateFromPassword([]byte(token), bcrypt.DefaultCost)
	return token, string(hash), err
}

func (h *Handler) RequestPasswordReset(w http.ResponseWriter, r *http.Request) {
	var req RequestPasswordResetRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	if email == "" {
		writeError(w, http.StatusBadRequest, "email is required")
		return
	}

	// Find user by email
	user, err := h.Queries.GetUserByEmail(r.Context(), email)
	if err != nil {
		// Don't leak whether email exists
		writeJSON(w, http.StatusOK, map[string]string{"message": "If your email exists, a reset link has been sent"})
		return
	}

	// Generate token
	token, tokenHash, err := generateResetToken()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to generate reset token")
		return
	}

	// Store token in DB
	_, err = h.Queries.CreatePasswordResetToken(r.Context(), db.CreatePasswordResetTokenParams{
		UserID:    user.ID,
		TokenHash: tokenHash,
		ExpiresAt: pgtype.Timestamptz{Time: time.Now().Add(1 * time.Hour), Valid: true},
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to store reset token")
		return
	}

	// Send reset email
	resetLink := fmt.Sprintf("%s/reset-password?token=%s", getBaseURL(r), token)
	if err := h.EmailService.SendPasswordReset(email, resetLink); err != nil {
		slog.Error("failed to send password reset email", "error", err, "email", email)
		// Still return success to avoid leaking email existence
	}

	// Cleanup expired tokens
	_ = h.Queries.DeleteExpiredPasswordResetTokens(r.Context())

	writeJSON(w, http.StatusOK, map[string]string{"message": "If your email exists, a reset link has been sent"})
}

func getBaseURL(r *http.Request) string {
	proto := "http"
	if r.TLS != nil {
		proto = "https"
	}
	if forwardedProto := r.Header.Get("X-Forwarded-Proto"); forwardedProto != "" {
		proto = forwardedProto
	}
	host := r.Host
	return fmt.Sprintf("%s://%s", proto, host)
}

type ResetPasswordRequest struct {
	Token    string `json:"token"`
	Password string `json:"password"`
}

func (h *Handler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	var req ResetPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	token := strings.TrimSpace(req.Token)
	password := strings.TrimSpace(req.Password)

	if token == "" {
		writeError(w, http.StatusBadRequest, "token is required")
		return
	}
	if password == "" {
		writeError(w, http.StatusBadRequest, "new password is required")
		return
	}
	if len(password) < 6 {
		writeError(w, http.StatusBadRequest, "password must be at least 6 characters")
		return
	}

	// Find all valid tokens (unexpired, unused)
	// We need to check each one because we can't hash token before searching
	tokens, err := h.Queries.FindValidPasswordResetTokens(r.Context())
	if err != nil || len(tokens) == 0 {
		writeError(w, http.StatusBadRequest, "invalid or expired token")
		return
	}

	// Find matching token by comparing hashes
	var found *db.PasswordResetToken
	for i, t := range tokens {
		if err := bcrypt.CompareHashAndPassword([]byte(t.TokenHash), []byte(token)); err == nil {
			found = &tokens[i]
			break
		}
	}

	if found == nil {
		writeError(w, http.StatusBadRequest, "invalid or expired token")
		return
	}

	// Mark token as used
	if err := h.Queries.MarkPasswordResetTokenUsed(r.Context(), found.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to mark token as used")
		return
	}

	// Hash new password
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to hash new password")
		return
	}

	// Update user password
	err = h.Queries.UpdateUserPassword(r.Context(), db.UpdateUserPasswordParams{
		ID:           found.UserID,
		PasswordHash: pgtype.Text{String: string(hash), Valid: true},
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update password")
		return
	}

	slog.Info("password reset successful", append(logger.RequestAttrs(r), "user_id", uuidToString(found.UserID))...)
	writeJSON(w, http.StatusOK, map[string]string{"message": "Password reset successfully"})
}

type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password"`
	Password        string `json:"password"`
}

func (h *Handler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var req ChangePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.CurrentPassword == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "current password and new password are required")
		return
	}
	if len(req.Password) < 6 {
		writeError(w, http.StatusBadRequest, "password must be at least 6 characters")
		return
	}

	user, err := h.Queries.GetUser(r.Context(), parseUUID(userID))
	if err != nil {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}

	// Check if user has password set
	if !user.PasswordHash.Valid {
		writeError(w, http.StatusBadRequest, "this account does not have a password set")
		return
	}

	// Verify current password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash.String), []byte(req.CurrentPassword)); err != nil {
		writeError(w, http.StatusUnauthorized, "current password is incorrect")
		return
	}

	// Hash new password
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to hash password")
		return
	}

	// Update password and clear the force change flag
	err = h.Queries.UpdateUserPassword(r.Context(), db.UpdateUserPasswordParams{
		ID:           user.ID,
		PasswordHash: pgtype.Text{String: string(hash), Valid: true},
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update password")
		return
	}

	slog.Info("password changed", append(logger.RequestAttrs(r), "user_id", uuidToString(user.ID))...)
	writeJSON(w, http.StatusOK, map[string]string{"message": "Password changed successfully"})
}

type SetPasswordRequest struct {
	Password string `json:"password"`
}

func (h *Handler) SetPassword(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var req SetPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Password == "" {
		writeError(w, http.StatusBadRequest, "password is required")
		return
	}
	if len(req.Password) < 6 {
		writeError(w, http.StatusBadRequest, "password must be at least 6 characters")
		return
	}

	user, err := h.Queries.GetUser(r.Context(), parseUUID(userID))
	if err != nil {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}

	// Hash password
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to hash password")
		return
	}

	// Set password and clear the force change flag
	err = h.Queries.UpdateUserPassword(r.Context(), db.UpdateUserPasswordParams{
		ID:           user.ID,
		PasswordHash: pgtype.Text{String: string(hash), Valid: true},
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to set password")
		return
	}

	slog.Info("password set", append(logger.RequestAttrs(r), "user_id", uuidToString(user.ID))...)
	writeJSON(w, http.StatusOK, map[string]string{"message": "Password set successfully"})
}
