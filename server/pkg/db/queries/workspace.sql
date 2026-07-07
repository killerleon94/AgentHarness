-- name: ListAllWorkspaces :many
SELECT * FROM workspace ORDER BY created_at ASC;

-- name: ListWorkspaces :many
SELECT w.* FROM workspace w
JOIN member m ON m.workspace_id = w.id
WHERE m.user_id = $1 AND w.disabled = false
ORDER BY w.created_at ASC;

-- name: ListAllWorkspacesPage :many
SELECT * FROM workspace
WHERE (sqlc.arg('search') = '' OR name ILIKE '%' || sqlc.arg('search') || '%'
                            OR slug ILIKE '%' || sqlc.arg('search') || '%')
ORDER BY created_at ASC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountAllWorkspaces :one
SELECT COUNT(*) FROM workspace
WHERE (sqlc.arg('search') = '' OR name ILIKE '%' || sqlc.arg('search') || '%'
                            OR slug ILIKE '%' || sqlc.arg('search') || '%');


-- name: ListWorkspaces :many
SELECT w.* FROM workspace w
JOIN member m ON m.workspace_id = w.id
WHERE m.user_id = $1 AND w.disabled = false
ORDER BY w.created_at ASC;

-- name: GetWorkspace :one
SELECT * FROM workspace
WHERE id = $1;

-- name: GetWorkspaceBySlug :one
SELECT * FROM workspace
WHERE slug = $1;

-- name: CreateWorkspace :one
INSERT INTO workspace (name, slug, description, context, issue_prefix)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: UpdateWorkspace :one
UPDATE workspace SET
    name = COALESCE(sqlc.narg('name'), name),
    description = COALESCE(sqlc.narg('description'), description),
    context = COALESCE(sqlc.narg('context'), context),
    settings = COALESCE(sqlc.narg('settings'), settings),
    repos = COALESCE(sqlc.narg('repos'), repos),
    issue_prefix = COALESCE(sqlc.narg('issue_prefix'), issue_prefix),
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: IncrementIssueCounter :one
UPDATE workspace SET issue_counter = issue_counter + 1
WHERE id = $1
RETURNING issue_counter;

-- name: UpdateWorkspaceDisabled :exec
UPDATE workspace SET disabled = $2 WHERE id = $1;


-- name: DeleteWorkspace :exec
DELETE FROM workspace WHERE id = $1;
