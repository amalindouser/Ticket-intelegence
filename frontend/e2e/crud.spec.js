import { test, expect } from "@playwright/test";

test.describe("CRUD Operations", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ agent: { name: "Test Agent", email: "test@test.com" } }),
      });
    });
    await page.route("**/api/groups/mappings", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { groupId: "1001", groupName: "IT Support", escalationEmail: "it@test.com" },
        ]),
      });
    });
    await page.goto("/login");
    await page.evaluate(() => localStorage.setItem("token", "test-token"));
  });

  test("view ticket list", async ({ page }) => {
    await page.route("**/api/tickets?*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          tickets: [
            {
              id: "uuid-1",
              freshdeskTicketId: 1001,
              subject: "Test Ticket 1",
              status: 2,
              priority: 3,
              requesterEmail: "user@test.com",
              assignedGroup: "1001",
              createdAt: "2025-01-15T10:00:00Z",
            },
          ],
          total: 1,
          page: 1,
          perPage: 20,
        }),
      });
    });

    await page.goto("/tickets");
    await expect(page.getByText("Test Ticket 1")).toBeVisible();
    await expect(page.getByText("#1001")).toBeVisible();
    await expect(page.getByText("Open")).toBeVisible();
    await expect(page.getByText("High")).toBeVisible();
  });

  test("create group mapping", async ({ page }) => {
    await page.route("**/api/groups/mappings", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ groupId: "2001", groupName: "Network Team", escalationEmail: "net@test.com" }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            { groupId: "1001", groupName: "IT Support", escalationEmail: "it@test.com" },
          ]),
        });
      }
    });

    await page.goto("/groups");
    await expect(page.getByText("IT Support")).toBeVisible();
  });

  test("search tickets", async ({ page }) => {
    let searchCalled = false;
    await page.route("**/api/tickets?*", async (route) => {
      searchCalled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          tickets: [
            {
              id: "uuid-2",
              freshdeskTicketId: 2002,
              subject: "Search Result",
              status: 3,
              priority: 2,
              requesterEmail: "found@test.com",
              createdAt: "2025-02-01T10:00:00Z",
            },
          ],
          total: 1,
          page: 1,
          perPage: 20,
        }),
      });
    });

    await page.goto("/tickets");
    await expect(page.getByText("Search Result")).toBeVisible();
    expect(searchCalled).toBeTruthy();
  });
});
