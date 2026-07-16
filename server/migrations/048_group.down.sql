DROP INDEX IF EXISTS idx_group_message_search;
DROP INDEX IF EXISTS idx_group_message_group_time;
DROP INDEX IF EXISTS idx_group_member_member;
DROP INDEX IF EXISTS idx_group_workspace;

ALTER TABLE agent_task_queue DROP COLUMN IF EXISTS group_message_id;
ALTER TABLE agent_task_queue DROP COLUMN IF EXISTS group_id;

DROP TABLE IF EXISTS group_message;
DROP TABLE IF EXISTS group_member;
DROP TABLE IF EXISTS "group";
