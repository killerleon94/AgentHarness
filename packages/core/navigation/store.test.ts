import { beforeEach, describe, expect, it } from "vitest";
import { useNavigationStore } from "./store";

const get = () => useNavigationStore.getState();

beforeEach(() => {
  useNavigationStore.setState({ lastPath: "/issues" });
});

describe("navigation store", () => {
  it("defaults lastPath to /issues", () => {
    expect(get().lastPath).toBe("/issues");
  });

  it("records ordinary paths", () => {
    get().onPathChange("/projects/42");
    expect(get().lastPath).toBe("/projects/42");
  });

  it("ignores excluded /login paths", () => {
    get().onPathChange("/settings");
    get().onPathChange("/login");
    expect(get().lastPath).toBe("/settings");
  });

  it("ignores excluded /pair/ paths", () => {
    get().onPathChange("/settings");
    get().onPathChange("/pair/abc123");
    expect(get().lastPath).toBe("/settings");
  });

  it("records paths that merely contain but do not start with an excluded prefix", () => {
    get().onPathChange("/workspace/login");
    expect(get().lastPath).toBe("/workspace/login");
  });
});
