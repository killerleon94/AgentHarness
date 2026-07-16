import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { mockWS, mockGetGroup, mockListGroupMessages, mockListGroupTasks, mockUpdateGroup, mockLeaveGroup, mockRemoveMember, mockBatchInvite, mockListMembers, mockListAgents, mockCancelTaskById } = vi.hoisted(() => ({
  mockWS: { send: vi.fn(), subscribe: vi.fn().mockReturnValue(vi.fn()), onReconnect: vi.fn().mockReturnValue(vi.fn()) },
  mockGetGroup: vi.fn(),
  mockListGroupMessages: vi.fn(),
  mockListGroupTasks: vi.fn(),
  mockUpdateGroup: vi.fn(),
  mockLeaveGroup: vi.fn(),
  mockRemoveMember: vi.fn(),
  mockBatchInvite: vi.fn(),
  mockListMembers: vi.fn(),
  mockListAgents: vi.fn(),
  mockCancelTaskById: vi.fn(),
}));

vi.mock("@multica/core/api", () => ({
  api: {
    getGroup: (...args: any[]) => mockGetGroup(...args),
    listGroupMessages: (...args: any[]) => mockListGroupMessages(...args),
    listGroupTasks: (...args: any[]) => mockListGroupTasks(...args),
    updateGroup: (...args: any[]) => mockUpdateGroup(...args),
    listMembers: (...args: any[]) => mockListMembers(...args),
    listAgents: (...args: any[]) => mockListAgents(...args),
    cancelTaskById: (...args: any[]) => mockCancelTaskById(...args),
  },
}));

vi.mock("@multica/core/groups/queries", () => ({
  groupKeys: {
    all: (wsId: string) => ["groups", wsId],
    lists: (wsId: string) => ["groups", wsId, "list"],
    detail: (wsId: string, id: string) => ["groups", wsId, "detail", id],
    messages: (groupId: string) => ["groups", "messages", groupId],
    tasks: (groupId: string) => ["groups", "tasks", groupId],
  },
}));

vi.mock("@multica/core/groups/mutations", () => ({
  useUpdateGroup: () => ({ mutateAsync: mockUpdateGroup, isPending: false }),
  useLeaveGroup: () => ({ mutate: mockLeaveGroup }),
  useRemoveMember: () => ({ mutate: mockRemoveMember }),
  useBatchInviteMember: () => ({ mutateAsync: mockBatchInvite, isPending: false }),
}));

vi.mock("@multica/core/realtime", () => ({
  useWS: () => mockWS,
  useWSEvent: vi.fn(),
  useWSReconnect: vi.fn(),
}));

vi.mock("@multica/views/navigation", () => ({
  useNavigation: () => ({ push: vi.fn() }),
}));

vi.mock("@multica/core", () => ({
  useTranslation: () => {
    const translations: Record<string, string> = {
      "groups.groupNotFound": "Group not found",
      "groups.memberCount": "3 members",
      "groups.inviteMember": "Invite",
      "groups.announcement": "Announcement",
      "groups.noAnnouncement": "No announcement yet.",
      "groups.save": "Save",
      "groups.members": "Members",
      "groups.owner": "owner",
      "groups.you": "You",
      "groups.messagePlaceholder": "Type a message...",
      "groups.taskStatus.queued": "Queued",
      "groups.taskStatus.running": "Running",
      "groups.taskStatus.completed": "Completed",
      "groups.taskStatus.failed": "Failed",
      "groups.cancel": "Cancel",
      "groups.leaveGroup": "Leave Group",
      "groups.leaveWarning": "Are you sure?",
      "groups.removeMember": "Remove",
      "groups.removeMemberWarning": "Remove this member?",
      "groups.inviteSearchPlaceholder": "Search members...",
      "groups.inviteAgentSearchPlaceholder": "Search agents...",
      "groups.noMembersToInvite": "No members to invite",
      "groups.noAgentsToInvite": "No agents to invite",
      "groups.inviteSelected": "Invite {count} selected",
      "groups.member_plural": "members",
      "common.members": "Members",
      "common.agents": "Agents",
    };
    return { t: (key: string) => translations[key] || key };
  },
}));

import { GroupChat } from "./group-chat";

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const mockGroup = {
  id: "g1",
  name: "Design Team",
  member_count: 3,
  announcement: "Weekly sync every Monday",
  members: [
    { id: "m1", member_id: "user-1", member_type: "member", role: "owner", name: "Alice" },
    { id: "m2", member_id: "user-2", member_type: "member", role: "member", name: "Bob" },
    { id: "m3", member_id: "agent-1", member_type: "agent", role: "member", name: "Codex" },
  ],
};

const mockMessages = {
  messages: [
    { id: "msg-1", content: "Hello!", sender_id: "user-2", sender_name: "Bob", sender_type: "member", created_at: "2026-07-03T10:00:00Z" },
    { id: "msg-2", content: "Hey Bob!", sender_id: "user-1", sender_name: "Alice", sender_type: "member", created_at: "2026-07-03T10:01:00Z" },
  ],
};

const mockTasks = [
  { id: "task-1", agent_name: "Codex", status: "running", context: "Working on it...", error: null, message_id: "msg-1", created_at: "2026-07-03T10:02:00Z", dispatched_at: "2026-07-03T10:02:01Z", started_at: "2026-07-03T10:02:05Z", completed_at: null },
  { id: "task-2", agent_name: "Claude", status: "completed", context: "Done!", error: null, message_id: "msg-2", created_at: "2026-07-03T10:03:00Z", dispatched_at: "2026-07-03T10:03:01Z", started_at: "2026-07-03T10:03:05Z", completed_at: "2026-07-03T10:05:00Z" },
];

describe("GroupChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
    mockGetGroup.mockResolvedValue(mockGroup);
    mockListGroupMessages.mockResolvedValue(mockMessages);
    mockListGroupTasks.mockResolvedValue(mockTasks);
  });

  it("shows loading state", () => {
    mockGetGroup.mockReturnValue(new Promise(() => {}));
    const { container } = renderWithQuery(
      <GroupChat groupId="g1" wsId="ws-1" currentUserId="user-1" />,
    );
    expect(container.querySelector(".lucide-loader-circle")).toBeInTheDocument();
  });

  it("shows group not found when group is null", async () => {
    mockGetGroup.mockResolvedValue(null);
    renderWithQuery(
      <GroupChat groupId="g1" wsId="ws-1" currentUserId="user-1" />,
    );
    await screen.findByText("Group not found");
  });

  it("renders group name and member count in header", async () => {
    renderWithQuery(
      <GroupChat groupId="g1" wsId="ws-1" currentUserId="user-1" />,
    );
    await screen.findByText("Design Team");
    expect(screen.getByText("3 members")).toBeInTheDocument();
  });

  it("shows invite button for owner and does not show leave button", async () => {
    renderWithQuery(
      <GroupChat groupId="g1" wsId="ws-1" currentUserId="user-1" />,
    );
    await screen.findByText("Design Team");
    expect(screen.getByText("Invite")).toBeInTheDocument();
    expect(screen.queryByTitle("Leave Group")).not.toBeInTheDocument();
  });

  it("shows leave button for non-owner and does not show invite button", async () => {
    renderWithQuery(
      <GroupChat groupId="g1" wsId="ws-1" currentUserId="user-2" />,
    );
    await screen.findByText("Design Team");
    expect(screen.queryByText("Invite")).not.toBeInTheDocument();
  });

  it("renders messages with sender info", async () => {
    renderWithQuery(
      <GroupChat groupId="g1" wsId="ws-1" currentUserId="user-1" />,
    );
    await screen.findByText("Hello!");
    expect(screen.getByText("Hey Bob!")).toBeInTheDocument();
    expect(screen.getAllByText("Bob").length).toBeGreaterThanOrEqual(1);
  });

  it("renders task cards with status badges", async () => {
    renderWithQuery(
      <GroupChat groupId="g1" wsId="ws-1" currentUserId="user-1" />,
    );
    expect(await screen.findByText("Running")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getAllByText("Claude").length).toBeGreaterThanOrEqual(1);
  });

  it("renders announcement section", async () => {
    renderWithQuery(
      <GroupChat groupId="g1" wsId="ws-1" currentUserId="user-1" />,
    );
    await screen.findByText("Announcement");
    expect(
      screen.getByText("Weekly sync every Monday"),
    ).toBeInTheDocument();
  });

  it("shows no announcement placeholder when none set", async () => {
    mockGetGroup.mockResolvedValue({
      ...mockGroup,
      announcement: null,
    });
    renderWithQuery(
      <GroupChat groupId="g1" wsId="ws-1" currentUserId="user-1" />,
    );
    await screen.findByText("No announcement yet.");
  });

  it("renders member list", async () => {
    renderWithQuery(
      <GroupChat groupId="g1" wsId="ws-1" currentUserId="user-1" />,
    );
    await screen.findByText(/Members/);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getAllByText("Bob").length).toBeGreaterThanOrEqual(1);
  });

  it("registers to group room on mount", async () => {
    renderWithQuery(
      <GroupChat groupId="g1" wsId="ws-1" currentUserId="user-1" />,
    );
    await screen.findByText("Design Team");
    expect(mockWS.send).toHaveBeenCalledWith({
      type: "group:register",
      payload: { group_id: "g1" },
    });
  });
});
