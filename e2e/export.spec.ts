/**
 * E2E tests for export functionality
 *
 * Tests:
 * - PNG snapshot export
 * - GIF timelapse export (if implemented)
 *
 * NOTE: These tests require export features to be implemented.
 * Currently contains placeholder tests.
 *
 * @see CITY-107 for full test acceptance criteria
 */

import { test, expect } from "./fixtures";

test.describe("PNG Export", () => {
  test.skip("@slow can export PNG snapshot", async ({ page, auth, api }) => {
    // TODO: Implement once export functionality is available
    const user = await auth.registerUser();
    const world = await api.createWorld(user.token!, "Export Test");

    await auth.setAuthInBrowser(page, user.token!);
    await page.goto(`/worlds/${world.id}`);

    // TODO: Add export tests
    // - Navigate to export view
    // - Click export PNG button
    // - Verify download is triggered

    // Playwright can intercept downloads:
    // const downloadPromise = page.waitForEvent('download');
    // await page.getByRole('button', { name: /export png/i }).click();
    // const download = await downloadPromise;
    // expect(download.suggestedFilename()).toMatch(/\.png$/);
  });
});

test.describe("GIF Export", () => {
  test.skip("@slow can export GIF timelapse", async ({ page, auth, api }) => {
    // TODO: Implement once GIF export is available
    const user = await auth.registerUser();
    const world = await api.createWorld(user.token!, "GIF Test");

    await auth.setAuthInBrowser(page, user.token!);
    await page.goto(`/worlds/${world.id}`);

    // TODO: Add GIF export tests
    // - Generate some history (multiple growth steps)
    // - Navigate to export view
    // - Click export GIF button
    // - Verify download is triggered
  });
});
