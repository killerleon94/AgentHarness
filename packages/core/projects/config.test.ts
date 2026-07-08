import { describe, expect, it } from "vitest";
import type { ProjectPriority, ProjectStatus } from "../types";
import {
  PROJECT_PRIORITY_CONFIG,
  PROJECT_PRIORITY_ORDER,
  PROJECT_STATUS_CONFIG,
  PROJECT_STATUS_ORDER,
} from "./config";

const EXPECTED_STATUSES: ProjectStatus[] = [
  "planned",
  "in_progress",
  "paused",
  "completed",
  "cancelled",
];

const EXPECTED_PRIORITIES: ProjectPriority[] = [
  "urgent",
  "high",
  "medium",
  "low",
  "none",
];

describe("project status config", () => {
  it("PROJECT_STATUS_ORDER lists every status once", () => {
    expect(PROJECT_STATUS_ORDER).toEqual(EXPECTED_STATUSES);
  });

  it("PROJECT_STATUS_CONFIG has an entry for every status", () => {
    expect(Object.keys(PROJECT_STATUS_CONFIG).sort()).toEqual(
      [...EXPECTED_STATUSES].sort(),
    );
    for (const status of EXPECTED_STATUSES) {
      expect(PROJECT_STATUS_CONFIG[status]).toMatchObject({
        label: expect.any(String),
        color: expect.any(String),
        dotColor: expect.any(String),
        badgeBg: expect.any(String),
        badgeText: expect.any(String),
      });
    }
  });
});

describe("project priority config", () => {
  it("PROJECT_PRIORITY_ORDER runs from most to least urgent", () => {
    expect(PROJECT_PRIORITY_ORDER).toEqual(EXPECTED_PRIORITIES);
  });

  it("bar counts decrease with priority, with none at zero", () => {
    expect(
      PROJECT_PRIORITY_ORDER.map((p) => PROJECT_PRIORITY_CONFIG[p].bars),
    ).toEqual([4, 3, 2, 1, 0]);
  });

  it("PROJECT_PRIORITY_CONFIG has an entry for every priority", () => {
    expect(Object.keys(PROJECT_PRIORITY_CONFIG).sort()).toEqual(
      [...EXPECTED_PRIORITIES].sort(),
    );
    for (const priority of EXPECTED_PRIORITIES) {
      expect(PROJECT_PRIORITY_CONFIG[priority]).toMatchObject({
        label: expect.any(String),
        bars: expect.any(Number),
        color: expect.any(String),
        badgeBg: expect.any(String),
        badgeText: expect.any(String),
      });
    }
  });
});
