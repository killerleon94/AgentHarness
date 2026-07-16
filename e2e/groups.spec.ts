import { test, expect } from "@playwright/test";
import { createTestApi, loginAsDefault } from "./helpers";
import type { TestApiClient } from "./fixtures";

test.describe("Groups", () => {
  let api: TestApiClient;

  test.beforeEach(async ({ page }) => {
    api = await createTestApi();
    await loginAsDefault(page);
  });

  test.afterEach(async () => {
    await api.cleanup();
  });

  test("group list page loads with empty state", async ({ page }) => {
    await page.goto("/groups");
    await expect(page.locator("text=Groups")).toBeVisible();
    await expect(page.locator("text=No groups yet")).toBeVisible();
  });

  test("can create a group via the dialog", async ({ page }) => {
    await page.goto("/groups");
    await expect(page.locator("text=Groups")).toBeVisible();

    await page.click("text=Create Group");

    await expect(
      page.locator('input[placeholder="Group name"]'),
    ).toBeVisible();
    await expect(
      page.locator(
        'textarea[placeholder="Group announcement (optional)"]',
      ),
    ).toBeVisible();

    const groupName = "E2E Test Group " + Date.now();
    await page.fill('input[placeholder="Group name"]', groupName);

    await page.click("text=Create");

    await expect(page.locator(`text=${groupName}`)).toBeVisible({
      timeout: 10000,
    });
  });

  test("can navigate to group detail page", async ({ page }) => {
    const group = await api.createGroup(
      "E2E Detail Group " + Date.now(),
      "Test announcement",
    );

    await page.goto(`/groups/${group.id}`);
    await page.waitForURL(`/groups/${group.id}`);

    await expect(page.locator(`text=${group.name}`).first()).toBeVisible({
      timeout: 10000,
    });

    await expect(page.locator("text=Announcement")).toBeVisible();
    await expect(
      page.locator("text=Test announcement"),
    ).toBeVisible();

    await expect(page.locator("text=1 members")).toBeVisible();

    await expect(
      page.locator(
        'input[placeholder="Type a message... (@ to mention)"]',
      ),
    ).toBeVisible();
  });

  test("group detail page shows members section", async ({ page }) => {
    const group = await api.createGroup("E2E Members Test " + Date.now());

    await page.goto(`/groups/${group.id}`);
    await page.waitForURL(`/groups/${group.id}`);

    await expect(page.locator("text=Members")).toBeVisible();
    await expect(page.locator("text=E2E User")).toBeVisible();
  });
});
