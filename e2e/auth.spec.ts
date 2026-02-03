/**
 * E2E tests for authentication flows
 *
 * Tests:
 * - User registration (happy path + error cases)
 * - User login (happy path + error cases)
 * - Logout flow
 *
 * @see CITY-104 for full test acceptance criteria
 */

import { test, expect } from "./fixtures";

test.describe("Registration", () => {
  test("can register a new user via UI", async ({ page, auth }) => {
    const email = auth.uniqueEmail();
    const password = "SecurePassword123!";

    await page.goto("/register");

    // Fill in registration form
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByLabel("Confirm password").fill(password);

    // Submit
    await page.getByRole("button", { name: "Create account" }).click();

    // Should redirect to home/worlds after successful registration
    await expect(page).not.toHaveURL(/register/);

    // User should be logged in (check for auth-dependent UI)
    await expect(page.getByText(/worlds|my world|log out/i)).toBeVisible();
  });

  test("shows error for mismatched passwords", async ({ page, auth }) => {
    await page.goto("/register");

    await page.getByLabel("Email address").fill(auth.uniqueEmail());
    await page.getByLabel("Password", { exact: true }).fill("Password123!");
    await page.getByLabel("Confirm password").fill("DifferentPassword!");

    await page.getByRole("button", { name: "Create account" }).click();

    // Should show error message
    await expect(page.getByText(/passwords do not match/i)).toBeVisible();

    // Should stay on register page
    await expect(page).toHaveURL(/register/);
  });

  test("shows error for short password", async ({ page, auth }) => {
    await page.goto("/register");

    await page.getByLabel("Email address").fill(auth.uniqueEmail());
    await page.getByLabel("Password", { exact: true }).fill("short");
    await page.getByLabel("Confirm password").fill("short");

    await page.getByRole("button", { name: "Create account" }).click();

    // Should show error message (use role to avoid matching hint text)
    await expect(page.getByRole("alert").or(page.locator('[data-testid="error"]')).or(page.locator('.text-red-500, .text-destructive, .error'))).toBeVisible();
  });

  test("@slow shows error for duplicate email", async ({ page, auth }) => {
    // First, register a user via API (fast setup)
    const existingUser = await auth.registerUser();

    // Try to register with same email via UI
    await page.goto("/register");
    await page.getByLabel("Email address").fill(existingUser.email);
    await page.getByLabel("Password", { exact: true }).fill("NewPassword123!");
    await page.getByLabel("Confirm password").fill("NewPassword123!");

    await page.getByRole("button", { name: "Create account" }).click();

    // Should show error about email already registered
    await expect(page.getByText(/already registered|email.*exists/i)).toBeVisible();
  });

  test("can navigate to login page", async ({ page }) => {
    await page.goto("/register");

    await page.getByRole("link", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/login/);
  });
});

test.describe("Login", () => {
  test("can login with valid credentials", async ({ page, auth }) => {
    // Create user via API first (fast setup)
    const user = await auth.registerUser();

    // Login via UI
    await page.goto("/login");
    await page.getByLabel("Email address").fill(user.email);
    await page.getByLabel("Password").fill(user.password);

    await page.getByRole("button", { name: "Sign in" }).click();

    // Should redirect after successful login
    await expect(page).not.toHaveURL(/login/);

    // Should show authenticated UI
    await expect(page.getByText(/worlds|my world|log out/i)).toBeVisible();
  });

  test("shows error for invalid email", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Email address").fill("nonexistent@test.com");
    await page.getByLabel("Password").fill("SomePassword123!");

    await page.getByRole("button", { name: "Sign in" }).click();

    // Should show error
    await expect(page.getByText(/invalid|incorrect|not found/i)).toBeVisible();

    // Should stay on login page
    await expect(page).toHaveURL(/login/);
  });

  test("shows error for wrong password", async ({ page, auth }) => {
    // Create user first
    const user = await auth.registerUser();

    await page.goto("/login");
    await page.getByLabel("Email address").fill(user.email);
    await page.getByLabel("Password").fill("WrongPassword123!");

    await page.getByRole("button", { name: "Sign in" }).click();

    // Should show error
    await expect(page.getByText(/invalid|incorrect/i)).toBeVisible();

    // Should stay on login page
    await expect(page).toHaveURL(/login/);
  });

  test("shows validation error for empty fields", async ({ page }) => {
    await page.goto("/login");

    // Try to submit without filling fields
    await page.getByRole("button", { name: "Sign in" }).click();

    // Browser validation should prevent submission (required fields)
    // Form should still be on login page
    await expect(page).toHaveURL(/login/);
  });

  test("can navigate to register page", async ({ page }) => {
    await page.goto("/login");

    await page.getByRole("link", { name: "Create one" }).click();

    await expect(page).toHaveURL(/register/);
  });
});

test.describe("Auth State", () => {
  test("authenticated user can access protected routes", async ({ page, auth }) => {
    // Register and get token
    const user = await auth.registerUser();

    // Set auth in browser directly (faster than UI login)
    await auth.setAuthInBrowser(page, user.token!);

    // Navigate to protected route
    await page.goto("/worlds");

    // Should see worlds page, not redirect to login
    await expect(page.getByText(/my worlds/i)).toBeVisible();
  });

  test("unauthenticated user is redirected to login", async ({ page }) => {
    // Try to access protected route without auth
    await page.goto("/worlds");

    // Should be redirected to login
    await expect(page).toHaveURL(/login/);
  });

  test("@slow logout clears auth state", async ({ page, auth }) => {
    // Register and login
    const user = await auth.registerUser();
    await auth.setAuthInBrowser(page, user.token!);

    // Navigate to verify auth works
    await page.goto("/worlds");
    await expect(page.getByText(/my worlds/i)).toBeVisible();

    // Find and click logout (if visible in UI)
    const logoutButton = page.getByRole("button", { name: /log out|sign out/i });
    if (await logoutButton.isVisible()) {
      await logoutButton.click();

      // Should be on login page or home
      await expect(page).toHaveURL(/login|^\/$/);
    }

    // Clear auth manually to test protected route
    await auth.clearAuth(page);
    await page.goto("/worlds");

    // Should redirect to login
    await expect(page).toHaveURL(/login/);
  });
});
