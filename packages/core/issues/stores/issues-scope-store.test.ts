import { beforeEach, describe, expect, it } from "vitest";
import { useIssuesScopeStore } from "./issues-scope-store";

const get = () => useIssuesScopeStore.getState();

beforeEach(() => {
  useIssuesScopeStore.setState({ scope: "all" });
});

describe("issues scope store", () => {
  it("defaults to the 'all' scope", () => {
    expect(get().scope).toBe("all");
  });

  it("setScope switches between scopes", () => {
    get().setScope("members");
    expect(get().scope).toBe("members");
    get().setScope("agents");
    expect(get().scope).toBe("agents");
    get().setScope("all");
    expect(get().scope).toBe("all");
  });
});
