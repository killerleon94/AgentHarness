-- name: CreateGroup :one
INSERT INTO "group" (workspace_id, name, avatar_url, announcement, created_by_type, created_by_id)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetGroup :one
SELECT * FROM "group" WHERE id = $1;

-- name: GetGroupInWorkspace :one
SELECT * FROM "group" WHERE id = $1 AND workspace_id = $2;

-- name: ListGroupsByMember :many
SELECT g.* FROM "group" g
JOIN group_member gm ON gm.group_id = g.id
WHERE gm.member_type = $1 AND gm.member_id = $2 AND g.workspace_id = $3 AND g.status = 'active'
ORDER BY g.updated_at DESC;

-- name: ListAllGroupsInWorkspace :many
SELECT * FROM "group" WHERE workspace_id = $1 AND status = 'active' ORDER BY updated_at DESC;

-- name: UpdateGroup :one
UPDATE "group" SET
    name = COALESCE(sqlc.narg('name'), name),
    announcement = COALESCE(sqlc.narg('announcement'), announcement),
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: DissolveGroup :exec
UPDATE "group" SET status = 'dissolved', updated_at = now() WHERE id = $1;

-- name: CreateGroupMember :one
INSERT INTO group_member (group_id, member_type, member_id, role)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: DeleteGroupMember :exec
DELETE FROM group_member WHERE id = $1;

-- name: DeleteGroupMemberByGroupAndMember :exec
DELETE FROM group_member WHERE group_id = $1 AND member_type = $2 AND member_id = $3;

-- name: GetGroupMember :one
SELECT * FROM group_member WHERE id = $1;

-- name: GetGroupMemberByGroupAndMember :one
SELECT * FROM group_member WHERE group_id = $1 AND member_type = $2 AND member_id = $3;

-- name: ListGroupMembers :many
SELECT * FROM group_member WHERE group_id = $1 ORDER BY role ASC, joined_at ASC;

-- name: CountGroupMembers :one
SELECT count(*) FROM group_member WHERE group_id = $1;

-- name: IsGroupMember :one
SELECT count(*) > 0 AS is_member FROM group_member WHERE group_id = $1 AND member_type = $2 AND member_id = $3;

-- name: CreateGroupMessage :one
INSERT INTO group_message (group_id, sender_type, sender_id, content, mentions_type, mentions_id, search_vector)
VALUES ($1, $2, $3, $4, $5, $6, to_tsvector('simple', $4))
RETURNING *;

-- name: GetGroupMessage :one
SELECT * FROM group_message WHERE id = $1;

-- name: ListGroupMessagesBefore :many
SELECT * FROM group_message
WHERE group_id = $1 AND created_at < $2
ORDER BY created_at DESC
LIMIT $3;

-- name: ListGroupMessagesAfter :many
SELECT * FROM group_message
WHERE group_id = $1 AND created_at > $2
ORDER BY created_at ASC
LIMIT $3;

-- name: ListLatestGroupMessages :many
SELECT * FROM group_message
WHERE group_id = $1
ORDER BY created_at DESC
LIMIT $2;

-- name: CreateGroupTask :one
INSERT INTO agent_task_queue (agent_id, runtime_id, issue_id, status, priority, context, group_id, group_message_id, delegation_depth)
VALUES ($1, $2, NULL, 'queued', $3, $4, $5, $6, $7)
RETURNING *;

-- name: ListGroupTasks :many
SELECT atq.*, a.name AS agent_name FROM agent_task_queue atq
JOIN agent a ON a.id = atq.agent_id
WHERE atq.group_id = $1
ORDER BY atq.created_at DESC;

-- name: CountGroupActiveTasks :one
SELECT count(*) FROM agent_task_queue
WHERE group_id = $1 AND status IN ('queued', 'dispatched', 'running');

-- name: CancelGroupTasks :exec
UPDATE agent_task_queue
SET status = 'cancelled', completed_at = now()
WHERE group_id = $1 AND status IN ('queued', 'dispatched', 'running');

-- name: ListGroupActiveTasks :many
SELECT atq.*, a.name AS agent_name FROM agent_task_queue atq
JOIN agent a ON a.id = atq.agent_id
WHERE atq.group_id = $1 AND atq.status IN ('queued', 'dispatched', 'running')
ORDER BY atq.created_at DESC;

-- name: GetGroupTask :one
SELECT * FROM agent_task_queue WHERE id = $1;

-- name: HasPendingGroupTask :one
SELECT count(*) > 0 AS has_pending FROM agent_task_queue
WHERE group_id = $1 AND agent_id = $2 AND status IN ('queued', 'dispatched', 'running');
