import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("shows nav items when logged in", async ({ page }) => {
    // Mock auth API response
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ agent: { name: "Test Agent", email: "test@test.com" } }),
      });
    });
    // Mock dashboard stats to avoid loading errors
    await page.route("**/api/dashboard/**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
    });
    await page.route("**/api/groups/mappings", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
    });

    await page.goto("/login");
    await page.evaluate(() => {
      localStorage.setItem("token", "test-token");
    });
    await page.goto("/");
    // Wait for nav to render
    await page.waitForSelector("nav");
    const nav = page.locator("nav");
    await expect(nav.getByRole("link", { name: /Tickets/ }).first()).toBeVisible();
    await expect(nav.getByRole("link", { name: /Evidences/ }).first()).toBeVisible();
    await expect(nav.getByRole("link", { name: /Groups/ }).first()).toBeVisible();
  });
});
