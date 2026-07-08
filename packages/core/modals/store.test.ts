import { beforeEach, describe, expect, it } from "vitest";
import { useModalStore } from "./store";

const get = () => useModalStore.getState();

beforeEach(() => {
  get().close();
});

describe("modal store", () => {
  it("starts with no modal open", () => {
    expect(get().modal).toBeNull();
    expect(get().data).toBeNull();
  });

  it("open sets the modal type and defaults data to null", () => {
    get().open("create-issue");
    expect(get().modal).toBe("create-issue");
    expect(get().data).toBeNull();
  });

  it("open carries optional data", () => {
    get().open("create-workspace", { name: "Acme" });
    expect(get().modal).toBe("create-workspace");
    expect(get().data).toEqual({ name: "Acme" });
  });

  it("close resets both modal and data", () => {
    get().open("create-issue", { foo: 1 });
    get().close();
    expect(get().modal).toBeNull();
    expect(get().data).toBeNull();
  });
});
