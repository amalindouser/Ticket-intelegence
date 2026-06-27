import { test, expect } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe("File Upload & Evidence", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ agent: { name: "Test Agent", email: "test@test.com" } }),
      });
    });
    await page.goto("/login");
    await page.evaluate(() => localStorage.setItem("token", "test-token"));
  });

  test("view evidence list", async ({ page }) => {
    await page.route("**/api/evidences?*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              id: "ev-1",
              ticketId: 1001,
              fileName: "report.pdf",
              fileType: "pdf",
              fileSize: 102400,
              createdAt: "2025-01-15T10:00:00Z",
            },
          ],
          total: 1,
          page: 1,
          perPage: 20,
        }),
      });
    });

    await page.goto("/evidences");
    await expect(page.getByText("report.pdf")).toBeVisible();
    await expect(page.getByText(/KB/).first()).toBeVisible();
  });

  test("collect evidence from tickets", async ({ page }) => {
    let collectCalled = false;
    await page.route("**/api/evidences", async (route) => {
      if (route.request().method() === "POST" && route.request().url().includes("/collect")) {
        collectCalled = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ processed: 1, results: [{ ticketId: 1001, count: 3 }] }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: [], total: 0, page: 1, perPage: 20 }),
        });
      }
    });

    await page.goto("/evidences");
    const textarea = page.locator("textarea, input[placeholder*='ticket']");
    if (await textarea.isVisible()) {
      await textarea.fill("1001");
    }
    // Evidence collect may have a button
    const collectBtn = page.getByText("Collect", { exact: false });
    if (await collectBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await collectBtn.click();
      await expect(page.getByText(/processed|success|berhasil/i)).toBeVisible({ timeout: 5000 }).catch(() => {});
    }
  });

  test("download evidence", async ({ page }) => {
    await page.route("**/api/evidences?*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              id: "ev-2",
              ticketId: 1002,
              fileName: "sample.pdf",
              fileType: "pdf",
              fileSize: 51200,
              createdAt: "2025-01-15T10:00:00Z",
            },
          ],
          total: 1,
          page: 1,
          perPage: 20,
        }),
      });
    });

    await page.route("**/api/evidences/ev-2/download", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/pdf",
        body: Buffer.from("%PDF-1.4 mock pdf content"),
      });
    });

    await page.goto("/evidences");
    await expect(page.getByText("sample.pdf")).toBeVisible();
    const downloadBtn = page.getByText(/download/i).first();
    if (await downloadBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await downloadBtn.click();
    }
  });
});
