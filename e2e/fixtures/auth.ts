/**
 * Authentication fixtures for E2E tests
 *
 * Provides helpers to register, login, and manage test users.
 * Uses the API directly for fast setup, then stores auth state for browser use.
 */

import { test as base, expect, type Page } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";

const API_URL = "http://localhost:8001";

export interface TestUser {
  email: string;
  password: string;
  id?: string;
  token?: string;
}

export interface AuthFixture {
  /** Register a new user via API and return credentials */
  registerUser: (email?: string, password?: string) => Promise<TestUser>;

  /** Login an existing user via API and return token */
  loginUser: (email: string, password: string) => Promise<TestUser>;

  /** Login as a user in the browser (UI flow) */
  loginViaBrowser: (page: Page, email: string, password: string) => Promise<void>;

  /** Register a user in the browser (UI flow) */
  registerViaBrowser: (page: Page, email?: string, password?: string) => Promise<TestUser>;

  /** Set auth token in browser localStorage for authenticated tests */
  setAuthInBrowser: (page: Page, token: string) => Promise<void>;

  /** Clear auth from browser */
  clearAuth: (page: Page) => Promise<void>;

  /** Get a unique test email */
  uniqueEmail: () => string;
}

/** Generate a unique email for test isolation */
function generateEmail(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `test-${timestamp}-${random}@e2e.test`;
}

/** Create auth fixture with API request context */
function createAuthFixture(request: APIRequestContext): AuthFixture {
  return {
    uniqueEmail: generateEmail,

    async registerUser(email?: string, password?: string): Promise<TestUser> {
      const testEmail = email ?? generateEmail();
      const testPassword = password ?? "TestPassword123!";

      const response = await request.post(`${API_URL}/auth/register`, {
        data: {
          email: testEmail,
          password: testPassword,
        },
      });

      if (!response.ok()) {
        const body = await response.text();
        throw new Error(`Failed to register user: ${response.status()} - ${body}`);
      }

      const data = await response.json();
      return {
        email: testEmail,
        password: testPassword,
        id: data.user.id,
        token: data.session.token,
      };
    },

    async loginUser(email: string, password: string): Promise<TestUser> {
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

    async loginViaBrowser(page: Page, email: string, password: string): Promise<void> {
      await page.goto("/login");
      await page.getByLabel(/email/i).fill(email);
      await page.getByLabel(/password/i).fill(password);
      await page.getByRole("button", { name: /log in|sign in/i }).click();

      // Wait for redirect after successful login
      await expect(page).not.toHaveURL(/login/);
    },

    async registerViaBrowser(page: Page, email?: string, password?: string): Promise<TestUser> {
      const testEmail = email ?? generateEmail();
      const testPassword = password ?? "TestPassword123!";

      await page.goto("/register");
      await page.getByLabel(/email/i).fill(testEmail);
      await page.getByLabel(/^password$/i).fill(testPassword);

      // Some forms have confirm password
      const confirmField = page.getByLabel(/confirm/i);
      if (await confirmField.isVisible()) {
        await confirmField.fill(testPassword);
      }

      await page.getByRole("button", { name: /register|sign up|create/i }).click();

      // Wait for redirect after successful registration
      await expect(page).not.toHaveURL(/register/);

      return { email: testEmail, password: testPassword };
    },

    async setAuthInBrowser(page: Page, token: string): Promise<void> {
      // Navigate to the app first to set localStorage on the correct origin
      await page.goto("/");
      await page.evaluate((authToken) => {
        localStorage.setItem("auth_token", authToken);
      }, token);
      // Reload to apply the token
      await page.reload();
    },

    async clearAuth(page: Page): Promise<void> {
      await page.evaluate(() => {
        localStorage.removeItem("auth_token");
      });
    },
  };
}

/**
 * Extended test with auth fixture
 *
 * Usage:
 * ```ts
 * import { test } from './fixtures/auth';
 *
 * test('can login', async ({ page, auth }) => {
 *   const user = await auth.registerUser();
 *   await auth.loginViaBrowser(page, user.email, user.password);
 * });
 * ```
 */
export const test = base.extend<{ auth: AuthFixture }>({
  auth: async ({ request }, use) => {
    const auth = createAuthFixture(request);
    await use(auth);
  },
});

export { expect } from "@playwright/test";
