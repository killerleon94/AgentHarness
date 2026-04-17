ALTER TABLE agent_runtime ADD COLUMN health_port INTEGER;
UPDATE agent_runtime SET health_port = 19514 WHERE daemon_id IS NOT NULL;
ALTER TABLE agent_runtime ALTER COLUMN health_port SET NOT NULL;
