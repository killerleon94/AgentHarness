import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { mockPush, mockListGroups, mockCreateGroup } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockListGroups: vi.fn(),
  mockCreateGroup: vi.fn(),
}));

vi.mock("@multica/core/api", () => ({
  api: {
    listGroups: (...args: any[]) => mockListGroups(...args),
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
  useCreateGroup: () => ({ mutateAsync: mockCreateGroup, isPending: false }),
}));

vi.mock("@multica/views/navigation", () => ({
  useNavigation: () => ({ push: mockPush }),
}));

vi.mock("@multica/core", () => ({
  useTranslation: () => {
    const translations: Record<string, string> = {
      "common.loading": "Loading...",
      "groups.title": "Groups",
      "groups.createGroup": "Create Group",
      "groups.groupName": "Group name",
      "groups.announcementPlaceholder": "Announcement (optional)",
      "common.create": "Create",
      "groups.noGroups": "No groups yet",
      "groups.noGroupsDescription": "Create your first group to get started.",
    };
    return { t: (key: string) => translations[key] || key };
  },
}));

import { GroupList } from "./group-list";

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const mockGroups = [
  { id: "g1", name: "Design Team", member_count: 4, announcement: "Weekly sync every Monday" },
  { id: "g2", name: "Dev Chat", member_count: 6, announcement: null },
  { id: "g3", name: "Random", member_count: 2, announcement: "No spam please" },
];

describe("GroupList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state", () => {
    mockListGroups.mockReturnValue(new Promise(() => {}));
    renderWithQuery(<GroupList wsId="ws-1" />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows empty state when no groups exist", async () => {
    mockListGroups.mockResolvedValue([]);
    renderWithQuery(<GroupList wsId="ws-1" />);
    await screen.findByText("No groups yet");
    expect(
      screen.getByText("Create your first group to get started."),
    ).toBeInTheDocument();
  });

  it("renders group cards with data", async () => {
    mockListGroups.mockResolvedValue(mockGroups);
    renderWithQuery(<GroupList wsId="ws-1" />);
    await screen.findByText("Design Team");
    expect(screen.getByText("Dev Chat")).toBeInTheDocument();
    expect(screen.getByText("Random")).toBeInTheDocument();
  });

  it("opens create dialog on button click", async () => {
    mockListGroups.mockResolvedValue([]);
    const user = userEvent.setup();
    renderWithQuery(<GroupList wsId="ws-1" />);
    await screen.findByText("No groups yet");

    await user.click(screen.getByText("Create Group"));

    expect(screen.getByPlaceholderText("Group name")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Announcement (optional)"),
    ).toBeInTheDocument();
  });

  it("calls create mutation on form submit", async () => {
    mockListGroups.mockResolvedValue([]);
    mockCreateGroup.mockResolvedValue({ id: "g4" });
    const user = userEvent.setup();
    renderWithQuery(<GroupList wsId="ws-1" />);
    await screen.findByText("No groups yet");

    await user.click(screen.getByText("Create Group"));
    await user.type(screen.getByPlaceholderText("Group name"), "New Group");
    await user.click(screen.getByText("Create"));

    await waitFor(() => {
      expect(mockCreateGroup).toHaveBeenCalledWith({
        name: "New Group",
        announcement: "",
      });
    });
  });

  it("navigates to group detail on card click", async () => {
    mockListGroups.mockResolvedValue(mockGroups);
    const user = userEvent.setup();
    renderWithQuery(<GroupList wsId="ws-1" />);
    await screen.findByText("Design Team");

    await user.click(screen.getByText("Design Team"));

    expect(mockPush).toHaveBeenCalledWith("/groups/g1");
  });
});
