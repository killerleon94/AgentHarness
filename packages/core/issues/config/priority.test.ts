import { describe, expect, it } from "vitest";
import type { IssuePriority } from "../../types";
import { PRIORITY_CONFIG, PRIORITY_ORDER } from "./priority";

const EXPECTED_PRIORITIES: IssuePriority[] = [
  "urgent",
  "high",
  "medium",
  "low",
  "none",
];

describe("priority config", () => {
  it("PRIORITY_ORDER runs from most to least urgent", () => {
    expect(PRIORITY_ORDER).toEqual(EXPECTED_PRIORITIES);
  });

  it("PRIORITY_CONFIG has an entry for every priority", () => {
    expect(Object.keys(PRIORITY_CONFIG).sort()).toEqual(
      [...EXPECTED_PRIORITIES].sort(),
    );
  });

  it("bar counts decrease with priority, with none at zero", () => {
    expect(PRIORITY_ORDER.map((p) => PRIORITY_CONFIG[p].bars)).toEqual([
      4, 3, 2, 1, 0,
    ]);
  });

  it("every entry exposes the full styling contract", () => {
    for (const priority of EXPECTED_PRIORITIES) {
      expect(PRIORITY_CONFIG[priority]).toMatchObject({
        label: expect.any(String),
        bars: expect.any(Number),
        color: expect.any(String),
        badgeBg: expect.any(String),
        badgeText: expect.any(String),
        dotColor: expect.any(String),
      });
    }
  });
});
