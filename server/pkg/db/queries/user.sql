-- name: GetUser :one
SELECT * FROM "user"
WHERE id = $1;

-- name: GetUserByEmail :one
SELECT * FROM "user"
WHERE email = $1;

-- name: CreateUser :one
INSERT INTO "user" (name, email, avatar_url)
VALUES ($1, $2, $3)
RETURNING *;

-- name: UpdateUser :one
UPDATE "user" SET
    name = COALESCE($2, name),
    avatar_url = COALESCE($3, avatar_url),
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: CreateUserWithPassword :one
INSERT INTO "user" (name, email, password_hash, password_change_required)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: UpdateUserPassword :exec
UPDATE "user" SET
    password_hash = $2,
    password_change_required = false,
    updated_at = now()
WHERE id = $1;

-- name: SetPasswordChangeRequired :exec
UPDATE "user" SET
    password_change_required = true,
    updated_at = now()
WHERE id = $1;

-- name: HasAdminUser :one
SELECT EXISTS(SELECT 1 FROM "user" WHERE role = 'admin' AND disabled = false) AS exists;

-- name: CreateAdminUser :one
INSERT INTO "user" (name, email, password_hash, role, password_change_required)
VALUES ($1, $2, $3, 'admin', false)
RETURNING *;

-- name: ListAllUsers :many
SELECT * FROM "user" ORDER BY created_at DESC;

-- name: UpdateUserDisabled :exec
UPDATE "user" SET disabled = $2 WHERE id = $1;

-- name: BatchUpdateUserDisabled :exec
UPDATE "user" SET disabled = $2 WHERE id = ANY($1::uuid[]) AND role != 'admin';

-- name: ListUsersPage :many
SELECT * FROM "user"
WHERE (sqlc.arg('search') = '' OR name ILIKE '%' || sqlc.arg('search') || '%' OR email ILIKE '%' || sqlc.arg('search') || '%')
  AND (sqlc.arg('disabled') = '' OR disabled = (sqlc.arg('disabled') = 't')::boolean)
ORDER BY created_at DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: AdminUpdateUserName :one
UPDATE "user" SET name = $2, updated_at = now() WHERE id = $1 RETURNING *;

-- name: CountUsers :one
SELECT COUNT(*) FROM "user"
WHERE (sqlc.arg('search') = '' OR name ILIKE '%' || sqlc.arg('search') || '%' OR email ILIKE '%' || sqlc.arg('search') || '%')
  AND (sqlc.arg('disabled') = '' OR disabled = (sqlc.arg('disabled') = 't')::boolean);
