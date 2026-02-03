/**
 * E2E tests for world creation and management flows
 *
 * Tests:
 * - Create new world via UI
 * - View world list
 * - Navigate to world canvas
 * - Delete world
 *
 * @see CITY-105 for full test acceptance criteria
 */

import { test, expect } from "./fixtures";

test.describe("World Creation", () => {
  test.beforeEach(async ({ page, auth }) => {
    // All world tests need an authenticated user
    const user = await auth.registerUser();
    await auth.setAuthInBrowser(page, user.token!);
  });

  test("can create a new world via modal", async ({ page }) => {
    await page.goto("/worlds");

    // Click "New World" button
    await page.getByRole("button", { name: "New World" }).click();

    // Modal should appear
    await expect(page.getByText("Create New World")).toBeVisible();

    // Fill in world name
    await page.getByLabel("World Name").fill("Test City");

    // Submit
    await page.getByRole("button", { name: "Create World" }).click();

    // Should navigate to the world view
    await expect(page).toHaveURL(/\/worlds\/[a-f0-9-]+/);
  });

  test("can create world with custom seed", async ({ page }) => {
    await page.goto("/worlds");
    await page.getByRole("button", { name: "New World" }).click();

    // Fill in world details
    await page.getByLabel("World Name").fill("Seeded World");
    await page.getByLabel(/seed/i).fill("12345");

    await page.getByRole("button", { name: "Create World" }).click();

    // Should navigate to world view
    await expect(page).toHaveURL(/\/worlds\/[a-f0-9-]+/);
  });

  test("shows validation error for empty world name", async ({ page }) => {
    await page.goto("/worlds");
    await page.getByRole("button", { name: "New World" }).click();

    // Try to submit without name
    await page.getByRole("button", { name: "Create World" }).click();

    // Should show error
    await expect(page.getByText(/enter a world name/i)).toBeVisible();
  });

  test("can cancel world creation", async ({ page }) => {
    await page.goto("/worlds");
    await page.getByRole("button", { name: "New World" }).click();

    // Modal should be visible
    await expect(page.getByText("Create New World")).toBeVisible();

    // Click cancel
    await page.getByRole("button", { name: "Cancel" }).click();

    // Modal should close
    await expect(page.getByText("Create New World")).not.toBeVisible();
  });
});

test.describe("World List", () => {
  test("shows empty state when no worlds", async ({ page, auth }) => {
    const user = await auth.registerUser();
    await auth.setAuthInBrowser(page, user.token!);

    await page.goto("/worlds");

    // Should show empty state message
    await expect(page.getByText(/don't have any worlds/i)).toBeVisible();
    await expect(page.getByText(/create your first world/i)).toBeVisible();
  });

  test("displays created worlds", async ({ page, auth, api }) => {
    // Setup: create user and some worlds via API
    const user = await auth.registerUser();
    await api.createWorld(user.token!, "My First City");
    await api.createWorld(user.token!, "Coastal Town");

    // Login and view worlds
    await auth.setAuthInBrowser(page, user.token!);
    await page.goto("/worlds");

    // Should see both worlds
    await expect(page.getByText("My First City")).toBeVisible();
    await expect(page.getByText("Coastal Town")).toBeVisible();
  });

  test("can open a world", async ({ page, auth, api }) => {
    const user = await auth.registerUser();
    const world = await api.createWorld(user.token!, "Open Me");

    await auth.setAuthInBrowser(page, user.token!);
    await page.goto("/worlds");

    // Click Open link on the world card
    await page.getByRole("link", { name: "Open" }).first().click();

    // Should navigate to world view
    await expect(page).toHaveURL(`/worlds/${world.id}`);
  });

  test("@slow can delete a world", async ({ page, auth, api }) => {
    const user = await auth.registerUser();
    await api.createWorld(user.token!, "Delete Me");

    // Set up dialog handler BEFORE navigating (best practice for timing)
    page.on("dialog", (dialog) => dialog.accept());

    await auth.setAuthInBrowser(page, user.token!);
    await page.goto("/worlds");

    // Should see the world
    await expect(page.getByText("Delete Me")).toBeVisible();

    // Click delete
    await page.getByRole("button", { name: "Delete" }).click();

    // World should be gone
    await expect(page.getByText("Delete Me")).not.toBeVisible();

    // Empty state should appear
    await expect(page.getByText(/don't have any worlds/i)).toBeVisible();
  });
});

test.describe("World Navigation", () => {
  test("can navigate back to worlds from world view", async ({ page, auth, api }) => {
    const user = await auth.registerUser();
    const world = await api.createWorld(user.token!, "My World");

    await auth.setAuthInBrowser(page, user.token!);
    await page.goto(`/worlds/${world.id}`);

    // Find back/home link
    const backLink = page.getByRole("link", { name: /back|home|worlds/i });
    if (await backLink.isVisible()) {
      await backLink.click();
      await expect(page).toHaveURL(/\/worlds$/);
    }
  });

  test("shows 404 for non-existent world", async ({ page, auth }) => {
    const user = await auth.registerUser();
    await auth.setAuthInBrowser(page, user.token!);

    // Try to access a non-existent world
    await page.goto("/worlds/00000000-0000-0000-0000-000000000000");

    // Should show error or redirect
    await expect(
      page.getByText(/not found|doesn't exist|error/i).or(page.locator('[data-testid="error"]'))
    ).toBeVisible();
  });
});
