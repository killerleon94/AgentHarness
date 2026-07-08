import { describe, expect, it } from "vitest";
import type { IssueStatus } from "../../types";
import {
  ALL_STATUSES,
  BOARD_STATUSES,
  STATUS_CONFIG,
  STATUS_ORDER,
} from "./status";

const EXPECTED_STATUSES: IssueStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
  "blocked",
  "cancelled",
];

describe("status config", () => {
  it("STATUS_ORDER and ALL_STATUSES list every status once", () => {
    expect(STATUS_ORDER).toEqual(EXPECTED_STATUSES);
    expect(ALL_STATUSES).toEqual(EXPECTED_STATUSES);
    expect(new Set(ALL_STATUSES).size).toBe(ALL_STATUSES.length);
  });

  it("BOARD_STATUSES excludes cancelled but keeps the rest in order", () => {
    expect(BOARD_STATUSES).not.toContain("cancelled");
    expect(BOARD_STATUSES).toEqual(
      EXPECTED_STATUSES.filter((s) => s !== "cancelled"),
    );
  });

  it("STATUS_CONFIG has an entry for every status", () => {
    expect(Object.keys(STATUS_CONFIG).sort()).toEqual(
      [...EXPECTED_STATUSES].sort(),
    );
  });

  it("every STATUS_CONFIG entry exposes the full styling contract", () => {
    for (const status of EXPECTED_STATUSES) {
      const config = STATUS_CONFIG[status];
      expect(config.label).toBeTruthy();
      expect(config).toMatchObject({
        label: expect.any(String),
        iconColor: expect.any(String),
        hoverBg: expect.any(String),
        dividerColor: expect.any(String),
        badgeBg: expect.any(String),
        badgeText: expect.any(String),
        columnBg: expect.any(String),
        accentBg: expect.any(String),
        glowBg: expect.any(String),
      });
    }
  });
});
