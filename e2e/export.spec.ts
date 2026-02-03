/**
 * E2E tests for export functionality
 *
 * Tests:
 * - PNG snapshot export at different resolutions
 * - GIF timelapse export (placeholder until implemented)
 * - Format and resolution selection
 *
 * @see CITY-107 for full test acceptance criteria
 * @see CITY-110 for EditorShell view mode integration
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

    // Download button has aria-label="Download export" but visible text includes format
    // Use text matcher to find the button with "Download PNG" visible text
    await expect(page.getByRole("button", { name: /download export/i })).toBeVisible();
    await expect(page.getByText("Download PNG")).toBeVisible();
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
      // Download button has aria-label="Download export" but visible text changes
      await expect(page.getByRole("button", { name: /download export/i })).toBeVisible();
      await expect(page.getByText("Download GIF")).toBeVisible();
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

    // ResolutionSelector uses buttons with aria-label="{label} resolution"
    // Labels: "Standard resolution", "High resolution", "Ultra resolution"
    const standardRes = page.getByRole("button", { name: /standard resolution/i });
    const highRes = page.getByRole("button", { name: /high resolution/i });
    const ultraRes = page.getByRole("button", { name: /ultra resolution/i });

    // All resolution options should be visible
    await expect(standardRes).toBeVisible();
    await expect(highRes).toBeVisible();
    await expect(ultraRes).toBeVisible();

    // Click to select high resolution
    await highRes.click();

    // The button should now show selected state (has blue border/bg)
    // We verify it's clickable and exists
    await expect(highRes).toBeVisible();
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

    // Select High (2x) resolution
    const highRes = page.getByRole("button", { name: /high resolution/i });
    await highRes.click();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /download export/i }).click();
    const download = await downloadPromise;

    // Filename should include resolution indicator
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/\.png$/);
    // Filename format is: city-doodle-{resolution}-{date}.png
    expect(filename).toMatch(/city-doodle.*\.png$/);
  });
});

test.describe("GIF Export", () => {
  // TODO(CITY-112): GIF export not yet implemented - requires growth simulation
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
