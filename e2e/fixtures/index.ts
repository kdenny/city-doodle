/**
 * Combined E2E test fixtures
 *
 * Import from this file to get all fixtures at once:
 *
 * ```ts
 * import { test, expect } from './fixtures';
 *
 * test('authenticated test', async ({ page, auth, api }) => {
 *   const user = await auth.registerUser();
 *   const world = await api.createWorld(user.token!, 'My World');
 *   await auth.setAuthInBrowser(page, user.token!);
 *   // Now test UI with authenticated user and world
 * });
 * ```
 */

import { test as base, expect } from "@playwright/test";
import type { AuthFixture } from "./auth";
import type { ApiFixture } from "./api";

const API_URL = "http://localhost:8001";

// Re-export types
export type { TestUser, AuthFixture } from "./auth";
export type { World, Tile, ApiFixture } from "./api";

// Generate unique email for test isolation
// Note: Using @example.com which is a reserved domain for examples per RFC 2606
// The .test TLD is rejected by email validators as a special-use domain
function generateEmail(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `test-${timestamp}-${random}@example.com`;
}

/**
 * Combined test fixture with auth and api helpers
 */
export const test = base.extend<{
  auth: AuthFixture;
  api: ApiFixture;
}>({
  auth: async ({ request }, use) => {
    const authHeaders = (token: string) => ({
      Authorization: `Bearer ${token}`,
    });

    const auth: AuthFixture = {
      uniqueEmail: generateEmail,

      async registerUser(email?, password?) {
        const testEmail = email ?? generateEmail();
        const testPassword = password ?? "TestPassword123!";

        const response = await request.post(`${API_URL}/auth/register`, {
          data: { email: testEmail, password: testPassword },
        });

        if (!response.ok()) {
          const body = await response.text();
          throw new Error(`Failed to register: ${response.status()} - ${body}`);
        }

        const data = await response.json();
        return {
          email: testEmail,
          password: testPassword,
          id: data.user.id,
          token: data.session.token,
        };
      },

      async loginUser(email, password) {
        const response = await request.post(`${API_URL}/auth/login`, {
          data: { email, password },
        });

        if (!response.ok()) {
          const body = await response.text();
          throw new Error(`Failed to login: ${response.status()} - ${body}`);
        }

        const data = await response.json();
        return {
          email,
          password,
          id: data.user.id,
          token: data.session.token,
        };
      },

      async loginViaBrowser(page, email, password) {
        await page.goto("/login");
        await page.getByLabel(/email/i).fill(email);
        await page.getByLabel(/password/i).fill(password);
        await page.getByRole("button", { name: /log in|sign in/i }).click();
        await expect(page).not.toHaveURL(/login/);
      },

      async registerViaBrowser(page, email?, password?) {
        const testEmail = email ?? generateEmail();
        const testPassword = password ?? "TestPassword123!";

        await page.goto("/register");
        await page.getByLabel(/email/i).fill(testEmail);
        await page.getByLabel(/^password$/i).fill(testPassword);

        const confirmField = page.getByLabel(/confirm/i);
        if (await confirmField.isVisible()) {
          await confirmField.fill(testPassword);
        }

        await page.getByRole("button", { name: /register|sign up|create/i }).click();
        await expect(page).not.toHaveURL(/register/);

        return { email: testEmail, password: testPassword };
      },

      async setAuthInBrowser(page, token) {
        await page.goto("/");
        await page.evaluate((authToken) => {
          localStorage.setItem("auth_token", authToken);
        }, token);
        await page.reload();
      },

      async clearAuth(page) {
        await page.evaluate(() => {
          localStorage.removeItem("auth_token");
        });
      },
    };

    await use(auth);
  },

  api: async ({ request }, use) => {
    const authHeaders = (token: string) => ({
      Authorization: `Bearer ${token}`,
    });

    const api: ApiFixture = {
      async createWorld(token, name?) {
        const worldName = name ?? `Test World ${Date.now()}`;
        const response = await request.post(`${API_URL}/worlds`, {
          headers: authHeaders(token),
          data: { name: worldName },
        });

        if (!response.ok()) {
          const body = await response.text();
          throw new Error(`Failed to create world: ${response.status()} - ${body}`);
        }

        return response.json();
      },

      async listWorlds(token) {
        const response = await request.get(`${API_URL}/worlds`, {
          headers: authHeaders(token),
        });

        if (!response.ok()) {
          const body = await response.text();
          throw new Error(`Failed to list worlds: ${response.status()} - ${body}`);
        }

        return response.json();
      },

      async getWorld(token, worldId) {
        const response = await request.get(`${API_URL}/worlds/${worldId}`, {
          headers: authHeaders(token),
        });

        if (!response.ok()) {
          const body = await response.text();
          throw new Error(`Failed to get world: ${response.status()} - ${body}`);
        }

        return response.json();
      },

      async generateTerrain(token, worldId, x, y) {
        const response = await request.post(
          `${API_URL}/worlds/${worldId}/tiles/${x}/${y}/generate`,
          { headers: authHeaders(token) }
        );

        if (!response.ok()) {
          const body = await response.text();
          throw new Error(`Failed to generate terrain: ${response.status()} - ${body}`);
        }

        return response.json();
      },

      async getTile(token, worldId, x, y) {
        const response = await request.get(
          `${API_URL}/worlds/${worldId}/tiles/${x}/${y}`,
          { headers: authHeaders(token) }
        );

        if (response.status() === 404) return null;

        if (!response.ok()) {
          const body = await response.text();
          throw new Error(`Failed to get tile: ${response.status()} - ${body}`);
        }

        return response.json();
      },

      async fetch(token, path, options?) {
        const url = path.startsWith("http") ? path : `${API_URL}${path}`;
        return request.fetch(url, {
          method: options?.method ?? "GET",
          headers: authHeaders(token),
          data: options?.data,
        });
      },
    };

    await use(api);
  },
});

export { expect };
