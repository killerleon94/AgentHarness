import { afterEach, describe, expect, it, vi } from "vitest";
import { shortID, timeAgo } from "./utils";

describe("timeAgo", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function freezeNow(now: string) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
  }

  it("returns 'just now' for times under a minute", () => {
    freezeNow("2024-01-01T00:00:30Z");
    expect(timeAgo("2024-01-01T00:00:00Z")).toBe("just now");
  });

  it("returns minutes for times under an hour", () => {
    freezeNow("2024-01-01T00:30:00Z");
    expect(timeAgo("2024-01-01T00:00:00Z")).toBe("30m ago");
  });

  it("returns hours for times under a day", () => {
    freezeNow("2024-01-01T05:00:00Z");
    expect(timeAgo("2024-01-01T00:00:00Z")).toBe("5h ago");
  });

  it("returns days for times of a day or more", () => {
    freezeNow("2024-01-04T00:00:00Z");
    expect(timeAgo("2024-01-01T00:00:00Z")).toBe("3d ago");
  });

  it("uses floor at each boundary", () => {
    freezeNow("2024-01-01T00:59:59Z");
    expect(timeAgo("2024-01-01T00:00:00Z")).toBe("59m ago");

    freezeNow("2024-01-01T23:59:59Z");
    expect(timeAgo("2024-01-01T00:00:00Z")).toBe("23h ago");
  });
});

describe("shortID", () => {
  it("strips dashes and takes the first 8 characters", () => {
    expect(shortID("123e4567-e89b-12d3-a456-426614174000")).toBe("123e4567");
  });

  it("returns the whole string when shorter than 8 characters", () => {
    expect(shortID("ab-cd")).toBe("abcd");
  });

  it("handles an empty string", () => {
    expect(shortID("")).toBe("");
  });
});
