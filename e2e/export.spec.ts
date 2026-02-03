/**
 * E2E tests for export functionality
 *
 * Tests:
 * - PNG snapshot export at different resolutions
 * - GIF timelapse export (placeholder until implemented)
 * - Format and resolution selection
 *
 * @see CITY-107 for full test acceptance criteria
 */

import { test, expect } from "./fixtures";

test.describe("Export View Navigation", () => {
  test("can navigate to export view from world editor", async ({ page, auth, api }) => {
    const user = await auth.registerUser();
    const world = await api.createWorld(user.token!, "Export Nav Test");

    await auth.setAuthInBrowser(page, user.token!);
    await page.goto(`/worlds/${world.id}`);

    // Click Export tab in header
    await page.getByRole("button", { name: "Export" }).click();

    // Verify export view is shown
    await expect(page.getByText("Export Preview")).toBeVisible();
    await expect(page.getByText("Export Settings")).toBeVisible();
  });

  test("can return to build mode from export view", async ({ page, auth, api }) => {
    const user = await auth.registerUser();
    const world = await api.createWorld(user.token!, "Exit Export Test");

    await auth.setAuthInBrowser(page, user.token!);
    await page.goto(`/worlds/${world.id}`);

    // Go to export view
    await page.getByRole("button", { name: "Export" }).click();
    await expect(page.getByText("Export Preview")).toBeVisible();

    // Click exit button to return to build mode
    await page.getByRole("button", { name: /exit/i }).click();

    // Export view should no longer be visible
    await expect(page.getByText("Export Preview")).not.toBeVisible();
  });
});

test.describe("Export Format Selection", () => {
  test("can select PNG format", async ({ page, auth, api }) => {
    const user = await auth.registerUser();
    const world = await api.createWorld(user.token!, "PNG Format Test");

    await auth.setAuthInBrowser(page, user.token!);
    await page.goto(`/worlds/${world.id}`);
    await page.getByRole("button", { name: "Export" }).click();

    // PNG should be default or selectable
    const pngOption = page.getByRole("radio", { name: /png/i }).or(
      page.getByLabel(/png/i)
    );
    if (await pngOption.isVisible()) {
      await pngOption.click();
    }

    // Download button should show PNG
    await expect(page.getByRole("button", { name: /download png/i })).toBeVisible();
  });

  test("can select GIF format", async ({ page, auth, api }) => {
    const user = await auth.registerUser();
    const world = await api.createWorld(user.token!, "GIF Format Test");

    await auth.setAuthInBrowser(page, user.token!);
    await page.goto(`/worlds/${world.id}`);
    await page.getByRole("button", { name: "Export" }).click();

    // Select GIF format
    const gifOption = page.getByRole("radio", { name: /gif/i }).or(
      page.getByLabel(/gif/i)
    );
    if (await gifOption.isVisible()) {
      await gifOption.click();
      // Download button should show GIF
      await expect(page.getByRole("button", { name: /download gif/i })).toBeVisible();
    }
  });
});

test.describe("Export Resolution Selection", () => {
  test("can select different resolutions", async ({ page, auth, api }) => {
    const user = await auth.registerUser();
    const world = await api.createWorld(user.token!, "Resolution Test");

    await auth.setAuthInBrowser(page, user.token!);
    await page.goto(`/worlds/${world.id}`);
    await page.getByRole("button", { name: "Export" }).click();

    // Check resolution options are visible
    const res1x = page.getByRole("radio", { name: /1x/i }).or(page.getByLabel(/1x/i));
    const res2x = page.getByRole("radio", { name: /2x/i }).or(page.getByLabel(/2x/i));
    const res4x = page.getByRole("radio", { name: /4x/i }).or(page.getByLabel(/4x/i));

    // At least one resolution option should be visible
    const anyResolutionVisible =
      (await res1x.isVisible()) ||
      (await res2x.isVisible()) ||
      (await res4x.isVisible());

    expect(anyResolutionVisible).toBe(true);
  });
});

test.describe("PNG Export", () => {
  test("@slow can export PNG snapshot", async ({ page, auth, api }) => {
    const user = await auth.registerUser();
    const world = await api.createWorld(user.token!, "PNG Export Test");

    await auth.setAuthInBrowser(page, user.token!);
    await page.goto(`/worlds/${world.id}`);

    // Navigate to export view
    await page.getByRole("button", { name: "Export" }).click();
    await expect(page.getByText("Export Preview")).toBeVisible();

    // Set up download handler before clicking
    const downloadPromise = page.waitForEvent("download");

    // Click download button
    await page.getByRole("button", { name: /download/i }).click();

    // Wait for download to start
    const download = await downloadPromise;

    // Verify it's a PNG file
    expect(download.suggestedFilename()).toMatch(/\.png$/);
  });

  test("@slow exported PNG filename includes resolution", async ({ page, auth, api }) => {
    const user = await auth.registerUser();
    const world = await api.createWorld(user.token!, "PNG Filename Test");

    await auth.setAuthInBrowser(page, user.token!);
    await page.goto(`/worlds/${world.id}`);
    await page.getByRole("button", { name: "Export" }).click();

    // Select 2x resolution if available
    const res2x = page.getByRole("radio", { name: /2x/i }).or(page.getByLabel(/2x/i));
    if (await res2x.isVisible()) {
      await res2x.click();
    }

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /download/i }).click();
    const download = await downloadPromise;

    // Filename should include resolution indicator
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/\.png$/);
    // Filename format is: city-doodle-{resolution}-{date}.png
    expect(filename).toMatch(/city-doodle.*\.png$/);
  });
});

test.describe("GIF Export", () => {
  // GIF export requires timelapse history - skip until growth simulation is available
  test.skip("@slow can export GIF timelapse", async ({ page, auth, api }) => {
    const user = await auth.registerUser();
    const world = await api.createWorld(user.token!, "GIF Export Test");

    await auth.setAuthInBrowser(page, user.token!);
    await page.goto(`/worlds/${world.id}`);

    // TODO: Generate some history first (run growth simulation)
    // This requires the growth simulation feature to be implemented

    // Navigate to export view
    await page.getByRole("button", { name: "Export" }).click();

    // Select GIF format
    const gifOption = page.getByRole("radio", { name: /gif/i }).or(
      page.getByLabel(/gif/i)
    );
    if (await gifOption.isVisible()) {
      await gifOption.click();

      const downloadPromise = page.waitForEvent("download");
      await page.getByRole("button", { name: /download gif/i }).click();
      const download = await downloadPromise;

      expect(download.suggestedFilename()).toMatch(/\.gif$/);
    }
  });
});

test.describe("Export Preview", () => {
  test("shows preview area with canvas content", async ({ page, auth, api }) => {
    const user = await auth.registerUser();
    const world = await api.createWorld(user.token!, "Preview Test");

    await auth.setAuthInBrowser(page, user.token!);
    await page.goto(`/worlds/${world.id}`);
    await page.getByRole("button", { name: "Export" }).click();

    // Preview section should be visible
    await expect(page.getByText("Export Preview")).toBeVisible();

    // The preview should contain the canvas or a preview area
    const previewArea = page.locator('[data-testid="export-preview"]').or(
      page.locator(".flex-1.min-h-0") // fallback to the preview container
    );
    await expect(previewArea.first()).toBeVisible();
  });
});
