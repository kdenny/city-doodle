import { test, expect } from "@playwright/test";

test.describe("Home Page", () => {
  test("has title", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("City Doodle")).toBeVisible();
  });

  test("can navigate to about page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /about/i }).click();
    await expect(page.getByText("About")).toBeVisible();
  });

  test("can navigate back to home", async ({ page }) => {
    await page.goto("/about");
    await page.getByRole("link", { name: /home/i }).click();
    await expect(page.getByText("City Doodle")).toBeVisible();
  });
});
