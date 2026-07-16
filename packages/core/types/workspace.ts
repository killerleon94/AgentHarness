export type MemberRole = "owner" | "admin" | "member";

export interface WorkspaceRepo {
  url: string;
  description: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  context: string | null;
  settings: Record<string, unknown>;
  repos: WorkspaceRepo[];
  issue_prefix: string;
  disabled?: boolean;
  owner_name?: string;
  created_at: string;
  updated_at: string;
}

export interface Member {
  id: string;
  workspace_id: string;
  user_id: string;
  role: MemberRole;
  created_at: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  has_password?: boolean;
  role?: string;
  disabled?: boolean;
  password_change_required?: boolean;
  created_at: string;
  updated_at: string;
}

export interface MemberWithUser {
  id: string;
  workspace_id: string;
  user_id: string;
  role: MemberRole;
  created_at: string;
  name: string;
  email: string;
  avatar_url: string | null;
  user_role?: string;
  user_disabled?: boolean;
}

export interface BatchCreateUserResult {
  email: string;
  success: boolean;
  error?: string;
}

export interface PaginatedUsersResponse {
  users: User[];
  total: number;
  page: number;
  per_page: number;
}

export interface ImportUsersResult {
  total: number;
  created: number;
  failed: number;
  results: ImportUserRow[];
}

export interface ImportUserRow {
  email: string;
  success: boolean;
  error?: string;
}

export interface RegistrationSettings {
  enabled: boolean;
}
