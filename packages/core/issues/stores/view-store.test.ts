import { beforeEach, describe, expect, it } from "vitest";
import type { StoreApi } from "zustand/vanilla";
import { ALL_STATUSES } from "../config";
import {
  createIssueViewStore,
  type IssueViewState,
} from "./view-store";

let store: StoreApi<IssueViewState>;
const get = () => store.getState();

beforeEach(() => {
  // A fresh isolated store per test avoids shared singleton/persist state.
  store = createIssueViewStore(`test_view_${Math.random()}`);
});

describe("view mode and sorting", () => {
  it("defaults to a board view sorted manually", () => {
    expect(get().viewMode).toBe("board");
    expect(get().sortBy).toBe("position");
    expect(get().sortDirection).toBe("asc");
  });

  it("updates view mode, sort field and direction", () => {
    get().setViewMode("list");
    get().setSortBy("priority");
    get().setSortDirection("desc");
    expect(get().viewMode).toBe("list");
    expect(get().sortBy).toBe("priority");
    expect(get().sortDirection).toBe("desc");
  });
});

describe("toggle filters", () => {
  it("adds then removes a status filter", () => {
    get().toggleStatusFilter("todo");
    expect(get().statusFilters).toEqual(["todo"]);
    get().toggleStatusFilter("todo");
    expect(get().statusFilters).toEqual([]);
  });

  it("adds then removes a priority filter", () => {
    get().togglePriorityFilter("high");
    expect(get().priorityFilters).toEqual(["high"]);
    get().togglePriorityFilter("high");
    expect(get().priorityFilters).toEqual([]);
  });

  it("toggles assignee filters by matching type AND id", () => {
    get().toggleAssigneeFilter({ type: "member", id: "u1" });
    get().toggleAssigneeFilter({ type: "agent", id: "u1" });
    expect(get().assigneeFilters).toEqual([
      { type: "member", id: "u1" },
      { type: "agent", id: "u1" },
    ]);
    // Same type+id removes only that one.
    get().toggleAssigneeFilter({ type: "member", id: "u1" });
    expect(get().assigneeFilters).toEqual([{ type: "agent", id: "u1" }]);
  });

  it("toggles creator filters by matching type AND id", () => {
    get().toggleCreatorFilter({ type: "member", id: "c1" });
    expect(get().creatorFilters).toEqual([{ type: "member", id: "c1" }]);
    get().toggleCreatorFilter({ type: "member", id: "c1" });
    expect(get().creatorFilters).toEqual([]);
  });

  it("toggles project filters", () => {
    get().toggleProjectFilter("p1");
    get().toggleProjectFilter("p2");
    expect(get().projectFilters).toEqual(["p1", "p2"]);
    get().toggleProjectFilter("p1");
    expect(get().projectFilters).toEqual(["p2"]);
  });

  it("toggles the no-assignee and no-project flags", () => {
    expect(get().includeNoAssignee).toBe(false);
    get().toggleNoAssignee();
    expect(get().includeNoAssignee).toBe(true);

    expect(get().includeNoProject).toBe(false);
    get().toggleNoProject();
    expect(get().includeNoProject).toBe(true);
  });
});

describe("hideStatus / showStatus", () => {
  it("hideStatus with no active filter selects all statuses except the hidden one", () => {
    get().hideStatus("done");
    expect(get().statusFilters).toEqual(
      ALL_STATUSES.filter((s) => s !== "done"),
    );
  });

  it("hideStatus with an active filter removes just that status", () => {
    get().toggleStatusFilter("todo");
    get().toggleStatusFilter("done");
    get().hideStatus("todo");
    expect(get().statusFilters).toEqual(["done"]);
  });

  it("showStatus is a no-op when no filter is active", () => {
    get().showStatus("todo");
    expect(get().statusFilters).toEqual([]);
  });

  it("showStatus adds a missing status and ignores duplicates", () => {
    get().toggleStatusFilter("todo");
    get().showStatus("done");
    expect(get().statusFilters).toEqual(["todo", "done"]);
    get().showStatus("done");
    expect(get().statusFilters).toEqual(["todo", "done"]);
  });
});

describe("clearFilters", () => {
  it("resets every filter but preserves view mode and sorting", () => {
    get().setViewMode("list");
    get().setSortBy("title");
    get().toggleStatusFilter("todo");
    get().togglePriorityFilter("high");
    get().toggleAssigneeFilter({ type: "member", id: "u1" });
    get().toggleNoAssignee();
    get().toggleCreatorFilter({ type: "agent", id: "a1" });
    get().toggleProjectFilter("p1");
    get().toggleNoProject();

    get().clearFilters();

    expect(get().statusFilters).toEqual([]);
    expect(get().priorityFilters).toEqual([]);
    expect(get().assigneeFilters).toEqual([]);
    expect(get().includeNoAssignee).toBe(false);
    expect(get().creatorFilters).toEqual([]);
    expect(get().projectFilters).toEqual([]);
    expect(get().includeNoProject).toBe(false);
    // Untouched by clearFilters.
    expect(get().viewMode).toBe("list");
    expect(get().sortBy).toBe("title");
  });
});

describe("card properties and collapsed columns", () => {
  it("toggles a single card property without touching the others", () => {
    get().toggleCardProperty("priority");
    expect(get().cardProperties).toEqual({
      priority: false,
      description: true,
      assignee: true,
      dueDate: true,
    });
  });

  it("toggles list-collapsed statuses on and off", () => {
    get().toggleListCollapsed("done");
    expect(get().listCollapsedStatuses).toEqual(["done"]);
    get().toggleListCollapsed("done");
    expect(get().listCollapsedStatuses).toEqual([]);
  });
});
