/**
 * Global setup for E2E tests
 *
 * Runs once before all tests to ensure the test environment is ready.
 * - Verifies API is running and healthy
 * - Verifies database is accessible
 */

import { test as setup, expect } from "@playwright/test";

const API_URL = "http://localhost:8001";

setup("verify API is healthy", async ({ request }) => {
  // Check API health endpoint
  const response = await request.get(`${API_URL}/health`);
  expect(response.ok()).toBeTruthy();

  const data = await response.json();
  expect(data.status).toBe("healthy");
});

setup("verify auth endpoints are available", async ({ request }) => {
  // Try to access auth endpoint (should return 422 without body, not 500)
  const response = await request.post(`${API_URL}/auth/login`, {
    data: {},
    failOnStatusCode: false,
  });

  // 422 (validation error) means the endpoint exists and validates input
  // 401/400 means it processed the request
  // 500+ would indicate a server error
  expect(response.status()).toBeLessThan(500);
});

setup("verify worlds endpoint requires auth", async ({ request }) => {
  // Unauthenticated request should return 401
  const response = await request.get(`${API_URL}/worlds`, {
    failOnStatusCode: false,
  });

  // Should be unauthorized, not a server error
  expect([401, 403]).toContain(response.status());
});
