CREATE TABLE "group" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    avatar_url TEXT,
    announcement TEXT NOT NULL DEFAULT '',
    created_by_type TEXT NOT NULL CHECK (created_by_type IN ('member', 'agent')),
    created_by_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dissolved')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE group_member (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES "group"(id) ON DELETE CASCADE,
    member_type TEXT NOT NULL CHECK (member_type IN ('member', 'agent')),
    member_id UUID NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(group_id, member_type, member_id)
);

CREATE TABLE group_message (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES "group"(id) ON DELETE CASCADE,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('member', 'agent')),
    sender_id UUID NOT NULL,
    content TEXT NOT NULL,
    mentions_type TEXT[] NOT NULL DEFAULT '{}',
    mentions_id UUID[] NOT NULL DEFAULT '{}',
    search_vector tsvector,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE agent_task_queue ADD COLUMN group_id UUID REFERENCES "group"(id) ON DELETE SET NULL;
ALTER TABLE agent_task_queue ADD COLUMN group_message_id UUID REFERENCES group_message(id) ON DELETE SET NULL;

CREATE INDEX idx_group_workspace ON "group"(workspace_id);
CREATE INDEX idx_group_member_member ON group_member(member_type, member_id);
CREATE INDEX idx_group_message_group_time ON group_message(group_id, created_at DESC);
CREATE INDEX idx_group_message_search ON group_message USING GIN (search_vector);
