export interface Group {
  id: string;
  workspace_id: string;
  name: string;
  avatar_url: string | null;
  announcement: string;
  created_by_type: "member" | "agent";
  created_by_id: string;
  status: "active" | "dissolved";
  member_count: number;
  members?: GroupMember[];
  created_at: string;
  updated_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  member_type: "member" | "agent";
  member_id: string;
  role: "owner" | "member";
  joined_at: string;
  name?: string;
  avatar_url?: string;
}

export interface GroupMessage {
  id: string;
  group_id: string;
  sender_type: "member" | "agent";
  sender_id: string;
  sender_name: string;
  content: string;
  mentions_type: string[];
  mentions_id: string[];
  created_at: string;
}

export interface GroupTaskStatus {
  task_id: string;
  group_id: string;
  message_id: string;
  agent_id: string;
  agent_name: string;
  content: string;
  status: string;
  error?: string;
}

export interface CreateGroupRequest {
  name: string;
  announcement?: string;
}

export interface UpdateGroupRequest {
  name?: string;
  announcement?: string;
}

export interface InviteMemberRequest {
  member_type: "member" | "agent";
  member_id: string;
}

export interface BatchInviteMembersRequest {
  members: InviteMemberRequest[];
}

export interface BatchInviteMemberResult {
  member_type: "member" | "agent";
  member_id: string;
  status: "success" | "error";
  error?: string;
  member?: GroupMember;
}

export interface CreateGroupResponse extends Group {}

export interface ListMessagesResponse {
  messages: GroupMessage[];
  next_cursor?: string;
}

export interface GroupTask {
  id: string;
  agent_id: string;
  agent_name: string;
  group_id: string;
  message_id: string;
  status: string;
  context: string | null;
  error: string | null;
  created_at: string;
  dispatched_at: string | null;
  started_at: string | null;
  completed_at: string | null;
}
