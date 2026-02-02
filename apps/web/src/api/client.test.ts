import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  api,
  setAuthToken,
  getAuthToken,
  clearAuthToken,
} from "./client";
import { ApiClientError } from "./types";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();
vi.stubGlobal("localStorage", localStorageMock);

describe("API Client", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    localStorageMock.clear();
    clearAuthToken();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Token Management", () => {
    it("stores token in localStorage", () => {
      setAuthToken("test-token");
      expect(localStorage.getItem("auth_token")).toBe("test-token");
    });

    it("retrieves token from memory", () => {
      setAuthToken("test-token");
      expect(getAuthToken()).toBe("test-token");
    });

    it("retrieves token from localStorage if not in memory", () => {
      localStorage.setItem("auth_token", "stored-token");
      // Clear in-memory token first, then call getAuthToken which reads from localStorage
      clearAuthToken();
      localStorage.setItem("auth_token", "stored-token");
      expect(getAuthToken()).toBe("stored-token");
    });

    it("clears token from both memory and localStorage", () => {
      setAuthToken("test-token");
      clearAuthToken();
      expect(getAuthToken()).toBeNull();
      expect(localStorage.getItem("auth_token")).toBeNull();
    });
  });

  describe("Auth Endpoints", () => {
    it("registers a new user and sets token", async () => {
      const mockResponse = {
        user: { id: "1", email: "test@example.com", created_at: "2024-01-01" },
        session: { token: "new-token", expires_at: "2024-02-01" },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await api.auth.register({
        email: "test@example.com",
        password: "password123",
      });

      expect(result).toEqual(mockResponse);
      expect(getAuthToken()).toBe("new-token");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/auth/register"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            email: "test@example.com",
            password: "password123",
          }),
        })
      );
    });

    it("logs in and sets token", async () => {
      const mockResponse = {
        user: { id: "1", email: "test@example.com", created_at: "2024-01-01" },
        session: { token: "login-token", expires_at: "2024-02-01" },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await api.auth.login({
        email: "test@example.com",
        password: "password123",
      });

      expect(result).toEqual(mockResponse);
      expect(getAuthToken()).toBe("login-token");
    });

    it("logs out and clears token", async () => {
      setAuthToken("existing-token");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: () => Promise.resolve(undefined),
      });

      await api.auth.logout();

      expect(getAuthToken()).toBeNull();
    });

    it("gets current user info", async () => {
      setAuthToken("valid-token");
      const mockUser = {
        id: "1",
        email: "test@example.com",
        created_at: "2024-01-01",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUser),
      });

      const result = await api.auth.me();

      expect(result).toEqual(mockUser);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/auth/me"),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer valid-token",
          }),
        })
      );
    });
  });

  describe("World Endpoints", () => {
    beforeEach(() => {
      setAuthToken("test-token");
    });

    it("creates a world", async () => {
      const mockWorld = {
        id: "world-1",
        name: "Test World",
        seed: 12345,
        settings: {
          grid_organic: 0.5,
          sprawl_compact: 0.5,
          historic_modern: 0.5,
          transit_car: 0.5,
        },
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockWorld),
      });

      const result = await api.worlds.create({ name: "Test World" });

      expect(result).toEqual(mockWorld);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/worlds"),
        expect.objectContaining({
          method: "POST",
        })
      );
    });

    it("lists worlds", async () => {
      const mockWorlds = [{ id: "world-1", name: "World 1" }];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockWorlds),
      });

      const result = await api.worlds.list();

      expect(result).toEqual(mockWorlds);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/worlds"),
        expect.objectContaining({ method: "GET" })
      );
    });

    it("gets a world by ID", async () => {
      const mockWorld = { id: "world-1", name: "Test World" };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockWorld),
      });

      const result = await api.worlds.get("world-1");

      expect(result).toEqual(mockWorld);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/worlds/world-1"),
        expect.any(Object)
      );
    });

    it("deletes a world", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: () => Promise.resolve(undefined),
      });

      await api.worlds.delete("world-1");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/worlds/world-1"),
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("Error Handling", () => {
    beforeEach(() => {
      setAuthToken("test-token");
    });

    it("throws ApiClientError on 4xx errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: () => Promise.resolve({ detail: "World not found" }),
      });

      await expect(api.worlds.get("nonexistent")).rejects.toThrow(
        ApiClientError
      );
    });

    it("includes status code in error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: () => Promise.resolve({ detail: "Invalid token" }),
      });

      try {
        await api.auth.me();
      } catch (error) {
        expect(error).toBeInstanceOf(ApiClientError);
        expect((error as ApiClientError).status).toBe(401);
      }
    });

    it("handles network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await expect(api.worlds.list()).rejects.toThrow("Network error");
    });
  });

  describe("Job Endpoints", () => {
    beforeEach(() => {
      setAuthToken("test-token");
    });

    it("creates a job", async () => {
      const mockJob = {
        id: "job-1",
        user_id: "user-1",
        type: "terrain_generation",
        status: "pending",
        params: {},
        created_at: "2024-01-01",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockJob),
      });

      const result = await api.jobs.create({ type: "terrain_generation" });

      expect(result).toEqual(mockJob);
    });

    it("cancels a job", async () => {
      const mockJob = {
        id: "job-1",
        status: "cancelled",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockJob),
      });

      const result = await api.jobs.cancel("job-1");

      expect(result.status).toBe("cancelled");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/jobs/job-1/cancel"),
        expect.objectContaining({ method: "POST" })
      );
    });
  });
});
