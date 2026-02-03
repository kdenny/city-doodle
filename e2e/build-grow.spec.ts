/**
 * E2E tests for place seed and grow flows
 *
 * Tests:
 * - Place a seed/district on canvas
 * - Run growth simulation
 * - Verify growth results
 *
 * NOTE: These tests require the canvas and simulation features to be implemented.
 * Currently contains placeholder tests.
 *
 * @see CITY-106 for full test acceptance criteria
 */

import { test, expect } from "./fixtures";

test.describe("Seed Placement", () => {
  test.skip("@slow can place a district seed on canvas", async ({ page, auth, api }) => {
    // TODO: Implement once canvas interaction is available
    // Setup: create user and world
    const user = await auth.registerUser();
    const world = await api.createWorld(user.token!, "Build Test");

    await auth.setAuthInBrowser(page, user.token!);
    await page.goto(`/worlds/${world.id}`);

    // Verify canvas is loaded
    await expect(page.locator("canvas")).toBeVisible();

    // TODO: Add seed placement interaction tests
    // - Select district from palette
    // - Click on canvas to place
    // - Verify seed appears
  });
});

test.describe("Growth Simulation", () => {
  test.skip("@slow can run 1-year growth simulation", async ({ page, auth, api }) => {
    // TODO: Implement once growth simulation is available
    const user = await auth.registerUser();
    const world = await api.createWorld(user.token!, "Growth Test");

    await auth.setAuthInBrowser(page, user.token!);
    await page.goto(`/worlds/${world.id}`);

    // TODO: Add growth simulation tests
    // - Place initial seeds
    // - Click grow button
    // - Verify growth results
  });
});
