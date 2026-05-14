-- name: CreateCaptcha :one
INSERT INTO captcha (answer, expires_at)
VALUES ($1, $2)
RETURNING *;

-- name: GetAndMarkCaptchaUsed :one
UPDATE captcha
SET used = TRUE
WHERE id = $1
  AND used = FALSE
  AND expires_at > now()
RETURNING *;

-- name: DeleteExpiredCaptchas :exec
DELETE FROM captcha
WHERE expires_at < now() - interval '10 minutes';