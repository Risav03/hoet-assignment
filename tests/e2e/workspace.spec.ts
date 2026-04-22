import { test, expect } from "@playwright/test";

test.describe("Workspace management", () => {
  test.beforeEach(async ({ page }) => {
    // Sign up as a fresh user for each test
    const email = `ws-test-${Date.now()}@example.com`;
    await page.goto("/signup");
    await page.getByLabel(/full name/i).fill("Workspace Tester");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill("TestPass1234");
    await page.getByRole("button", { name: /create account/i }).click();
    await page.waitForURL(/dashboard/);
  });

  test("can create a workspace", async ({ page }) => {
    await page.getByRole("button", { name: /new workspace/i }).click();
    await page.getByLabel(/workspace name/i).fill("My Test Workspace");
    await page.getByRole("button", { name: /^create$/i }).click();
    await expect(page).toHaveURL(/workspaces\//, { timeout: 10000 });
    await expect(page.getByText("My Test Workspace")).toBeVisible();
  });

  test("can create a document in workspace", async ({ page }) => {
    await page.getByRole("button", { name: /new workspace/i }).click();
    await page.getByLabel(/workspace name/i).fill("Doc Test Workspace");
    await page.getByRole("button", { name: /^create$/i }).click();
    await page.waitForURL(/workspaces\/.+\/documents/);

    await page.getByRole("button", { name: /new document/i }).click();
    await page.getByLabel(/title/i).fill("My First Document");
    await page.getByRole("button", { name: /^create$/i }).click();
    await page.waitForURL(/documents\//);
    await expect(page.locator("input[value='My First Document'], input").first()).toBeVisible();
  });
});
