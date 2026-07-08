import { beforeEach, describe, expect, it } from "vitest";
import { useIssueDraftStore } from "./draft-store";

const get = () => useIssueDraftStore.getState();

beforeEach(() => {
  get().clearDraft();
});

describe("issue draft store", () => {
  it("starts empty with sensible defaults", () => {
    expect(get().draft).toMatchObject({
      title: "",
      description: "",
      status: "todo",
      priority: "none",
      dueDate: null,
    });
    expect(get().hasDraft()).toBe(false);
  });

  it("setDraft merges a partial patch", () => {
    get().setDraft({ title: "Hello" });
    get().setDraft({ priority: "high" });
    expect(get().draft.title).toBe("Hello");
    expect(get().draft.priority).toBe("high");
    // Untouched fields keep their defaults.
    expect(get().draft.status).toBe("todo");
  });

  it("hasDraft is true when title or description is set", () => {
    get().setDraft({ title: "x" });
    expect(get().hasDraft()).toBe(true);

    get().clearDraft();
    get().setDraft({ description: "notes" });
    expect(get().hasDraft()).toBe(true);
  });

  it("hasDraft stays false when only non-text fields change", () => {
    get().setDraft({ priority: "urgent", status: "in_progress" });
    expect(get().hasDraft()).toBe(false);
  });

  it("clearDraft resets everything back to empty", () => {
    get().setDraft({ title: "x", description: "y", assigneeId: "u1" });
    get().clearDraft();
    expect(get().draft.title).toBe("");
    expect(get().draft.description).toBe("");
    expect(get().draft.assigneeId).toBeUndefined();
    expect(get().hasDraft()).toBe(false);
  });
});
