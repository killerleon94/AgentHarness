package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

const (
	captchaChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	captchaLen   = 4
)

type CaptchaResponse struct {
	ID        string `json:"id"`
	ImageData string `json:"image_data"`
}

func init() {
	rand.Seed(time.Now().UnixNano())
}

func randomChars() string {
	b := make([]byte, captchaLen)
	for i := range b {
		b[i] = captchaChars[rand.Intn(len(captchaChars))]
	}
	return string(b)
}

func buildSVG(code string) string {
	type charStyle struct {
		x, y     int
		size     int
		rotation int
		color    string
		char     string
	}
	w, h := 128, 40
	chars := make([]charStyle, len(code))
	charWidth := w / (captchaLen + 1)

	colors := []string{
		"#1e40af", "#b91c1c", "#15803d", "#7c3aed",
		"#c2410c", "#0369a1", "#a21caf", "#047857",
	}

	for i := range code {
		chars[i] = charStyle{
			x:        (i + 1) * charWidth,
			y:        h/2 + 6,
			size:     22 + rand.Intn(6),
			rotation: -15 + rand.Intn(30),
			color:    colors[rand.Intn(len(colors))],
			char:     string(code[i]),
		}
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf(
		`<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">`,
		w, h, w, h,
	))
	sb.WriteString(fmt.Sprintf(`<rect width="%d" height="%d" fill="#f8fafc"/>`, w, h))

	for i := 0; i < 30; i++ {
		sb.WriteString(fmt.Sprintf(
			`<circle cx="%d" cy="%d" r="%d" fill="%s" opacity="0.3"/>`,
			rand.Intn(w), rand.Intn(h), rand.Intn(2)+1, colors[rand.Intn(len(colors))],
		))
	}

	for i := 0; i < 3; i++ {
		sb.WriteString(fmt.Sprintf(
			`<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="#94a3b8" stroke-width="1" opacity="0.3"/>`,
			rand.Intn(w), rand.Intn(h), rand.Intn(w), rand.Intn(h),
		))
	}

	for _, ch := range chars {
		sb.WriteString(fmt.Sprintf(
			`<text x="%d" y="%d" font-family="Arial, Helvetica, sans-serif" font-size="%d" font-weight="bold" fill="%s" text-anchor="middle" dominant-baseline="middle" transform="rotate(%d %d %d)">%s</text>`,
			ch.x, ch.y, ch.size, ch.color, ch.rotation, ch.x, ch.y, ch.char,
		))
	}

	sb.WriteString("</svg>")
	return sb.String()
}

func (h *Handler) NewCaptcha(w http.ResponseWriter, r *http.Request) {
	code := randomChars()

	captcha, err := h.Queries.CreateCaptcha(r.Context(), db.CreateCaptchaParams{
		Answer:    code,
		ExpiresAt: pgtype.Timestamptz{Time: time.Now().Add(5 * time.Minute), Valid: true},
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create captcha")
		return
	}

	svgData := buildSVG(code)
	imageData := "data:image/svg+xml;base64," + base64Encode([]byte(svgData))

	writeJSON(w, http.StatusOK, CaptchaResponse{
		ID:        uuidToString(captcha.ID),
		ImageData: imageData,
	})
}

type VerifyCaptchaRequest struct {
	ID     string `json:"id"`
	Answer string `json:"answer"`
}

func (h *Handler) VerifyCaptcha(w http.ResponseWriter, r *http.Request) {
	var req VerifyCaptchaRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	id := parseUUID(req.ID)

	captcha, err := h.Queries.GetAndMarkCaptchaUsed(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid or expired captcha")
		return
	}

	if strings.EqualFold(captcha.Answer, req.Answer) {
		writeJSON(w, http.StatusOK, map[string]bool{"valid": true})
	} else {
		writeError(w, http.StatusBadRequest, "incorrect captcha answer")
	}
}

func (h *Handler) verifyCaptchaOnce(ctx context.Context, captchaID, answer string) error {
	id := parseUUID(captchaID)
	captcha, err := h.Queries.GetCaptchaForCheck(ctx, id)
	if err != nil {
		return err
	}
	if !strings.EqualFold(captcha.Answer, answer) {
		return fmt.Errorf("incorrect captcha")
	}
	return nil
}

func (h *Handler) checkCaptcha(ctx context.Context, captchaID, answer string) error {
	id := parseUUID(captchaID)
	captcha, err := h.Queries.GetCaptchaForCheck(ctx, id)
	if err != nil {
		return err
	}
	if !strings.EqualFold(captcha.Answer, answer) {
		return fmt.Errorf("incorrect captcha")
	}
	return nil
}

func base64Encode(b []byte) string {
	const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
	var sb strings.Builder
	for i := 0; i < len(b); i += 3 {
		n := len(b) - i
		var block [4]byte
		block[0] = b[i] >> 2
		if n == 1 {
			block[1] = (b[i] & 0x03) << 4
			sb.WriteByte(alphabet[block[0]])
			sb.WriteByte(alphabet[block[1]])
			sb.WriteString("==")
			break
		}
		block[1] = (b[i]&0x03)<<4 | b[i+1]>>4
		if n == 2 {
			block[2] = (b[i+1] & 0x0f) << 2
			sb.WriteByte(alphabet[block[0]])
			sb.WriteByte(alphabet[block[1]])
			sb.WriteByte(alphabet[block[2]])
			sb.WriteByte('=')
			break
		}
		block[2] = (b[i+1]&0x0f)<<2 | b[i+2]>>6
		block[3] = b[i+2] & 0x3f
		sb.WriteByte(alphabet[block[0]])
		sb.WriteByte(alphabet[block[1]])
		sb.WriteByte(alphabet[block[2]])
		sb.WriteByte(alphabet[block[3]])
	}
	return sb.String()
}
