import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type RecentIssueEntry,
  useRecentIssuesStore,
} from "./recent-issues-store";

const get = () => useRecentIssuesStore.getState();

function entry(n: number): Omit<RecentIssueEntry, "visitedAt"> {
  return {
    id: `id-${n}`,
    identifier: `ISS-${n}`,
    title: `Issue ${n}`,
    status: "todo",
  };
}

beforeEach(() => {
  useRecentIssuesStore.setState({ items: [] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("recent issues store", () => {
  it("records a visit, stamping visitedAt", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));
    get().recordVisit(entry(1));
    expect(get().items).toHaveLength(1);
    expect(get().items[0]).toMatchObject({ id: "id-1", identifier: "ISS-1" });
    expect(get().items[0]?.visitedAt).toBe(Date.parse("2024-01-01T00:00:00Z"));
  });

  it("puts the most recently visited issue first", () => {
    get().recordVisit(entry(1));
    get().recordVisit(entry(2));
    expect(get().items.map((i) => i.id)).toEqual(["id-2", "id-1"]);
  });

  it("moves a re-visited issue to the front without duplicating", () => {
    get().recordVisit(entry(1));
    get().recordVisit(entry(2));
    get().recordVisit(entry(1));
    expect(get().items.map((i) => i.id)).toEqual(["id-1", "id-2"]);
    expect(get().items).toHaveLength(2);
  });

  it("caps the list at 20 entries, dropping the oldest", () => {
    for (let n = 1; n <= 25; n++) get().recordVisit(entry(n));
    expect(get().items).toHaveLength(20);
    expect(get().items[0]?.id).toBe("id-25");
    expect(get().items.at(-1)?.id).toBe("id-6");
  });
});
