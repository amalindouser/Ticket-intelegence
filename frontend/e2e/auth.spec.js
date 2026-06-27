import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("shows login page", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Ticket Intelligence" })).toBeVisible();
    await expect(page.getByPlaceholder("nama@ainosi.co.id")).toBeVisible();
    await expect(page.getByPlaceholder("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Masuk" })).toBeVisible();
  });

  test("shows error message on failed login", async ({ page }) => {
    // Mock the login API to return an error
    await page.route("**/api/auth/login", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Email atau password salah" }),
      });
    });

    await page.goto("/login");
    await page.getByPlaceholder("nama@ainosi.co.id").fill("wrong@test.com");
    await page.getByPlaceholder("Password").fill("wrongpassword");
    await page.getByRole("button", { name: "Masuk" }).click();
    await expect(page.getByText("Email atau password salah")).toBeVisible({ timeout: 10000 });
  });

  test("redirects to login when accessing protected route", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });
});
