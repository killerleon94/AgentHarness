import { beforeEach, describe, expect, it } from "vitest";
import { useIssueSelectionStore } from "./selection-store";

const get = () => useIssueSelectionStore.getState();
const ids = () => [...get().selectedIds];

beforeEach(() => {
  useIssueSelectionStore.setState({ selectedIds: new Set<string>() });
});

describe("issue selection store", () => {
  it("toggle adds an id and toggling again removes it", () => {
    get().toggle("a");
    expect(ids()).toEqual(["a"]);
    get().toggle("a");
    expect(ids()).toEqual([]);
  });

  it("select adds multiple ids and dedupes existing ones", () => {
    get().select(["a", "b"]);
    get().select(["b", "c"]);
    expect(ids().sort()).toEqual(["a", "b", "c"]);
  });

  it("deselect removes only the given ids", () => {
    get().select(["a", "b", "c"]);
    get().deselect(["a", "c"]);
    expect(ids()).toEqual(["b"]);
  });

  it("clear empties the selection", () => {
    get().select(["a", "b"]);
    get().clear();
    expect(ids()).toEqual([]);
  });

  it("produces a new Set reference on change", () => {
    const before = get().selectedIds;
    get().toggle("a");
    expect(get().selectedIds).not.toBe(before);
  });
});
