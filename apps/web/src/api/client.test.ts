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

  describe("Transit Endpoints", () => {
    beforeEach(() => {
      setAuthToken("test-token");
    });

    describe("Network Operations", () => {
      it("gets transit network for a world", async () => {
        const mockNetwork = {
          world_id: "world-1",
          stations: [],
          lines: [],
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockNetwork),
        });

        const result = await api.transit.getNetwork("world-1");

        expect(result).toEqual(mockNetwork);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/worlds/world-1/transit"),
          expect.any(Object)
        );
      });

      it("gets transit stats for a world", async () => {
        const mockStats = {
          world_id: "world-1",
          total_stations: 5,
          total_lines: 2,
          total_segments: 4,
          stations_by_type: { subway: 3, rail: 2 },
          lines_by_type: { subway: 1, rail: 1 },
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockStats),
        });

        const result = await api.transit.getStats("world-1");

        expect(result).toEqual(mockStats);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/worlds/world-1/transit/stats"),
          expect.any(Object)
        );
      });

      it("clears transit network for a world", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 204,
          json: () => Promise.resolve(undefined),
        });

        await api.transit.clearNetwork("world-1");

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/worlds/world-1/transit"),
          expect.objectContaining({ method: "DELETE" })
        );
      });
    });

    describe("Station Operations", () => {
      it("lists stations for a world", async () => {
        const mockStations = [
          {
            id: "station-1",
            world_id: "world-1",
            district_id: "district-1",
            station_type: "subway",
            name: "Central",
            position_x: 100,
            position_y: 100,
            is_terminus: false,
            created_at: "2024-01-01",
            updated_at: "2024-01-01",
          },
        ];

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockStations),
        });

        const result = await api.transit.stations.list("world-1");

        expect(result).toEqual(mockStations);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/worlds/world-1/transit/stations"),
          expect.any(Object)
        );
      });

      it("lists stations filtered by type", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        });

        await api.transit.stations.list("world-1", "subway");

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringMatching(/station_type=subway/),
          expect.any(Object)
        );
      });

      it("creates a station", async () => {
        const mockStation = {
          id: "station-1",
          world_id: "world-1",
          district_id: "district-1",
          station_type: "subway",
          name: "New Station",
          position_x: 150,
          position_y: 250,
          is_terminus: false,
          created_at: "2024-01-01",
          updated_at: "2024-01-01",
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockStation),
        });

        const result = await api.transit.stations.create("world-1", {
          district_id: "district-1",
          station_type: "subway",
          name: "New Station",
          position_x: 150,
          position_y: 250,
        });

        expect(result).toEqual(mockStation);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/worlds/world-1/transit/stations"),
          expect.objectContaining({ method: "POST" })
        );
      });

      it("gets a station by ID", async () => {
        const mockStation = {
          id: "station-1",
          station_type: "subway",
          name: "Test Station",
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockStation),
        });

        const result = await api.transit.stations.get("station-1");

        expect(result).toEqual(mockStation);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/transit/stations/station-1"),
          expect.any(Object)
        );
      });

      it("updates a station", async () => {
        const mockStation = {
          id: "station-1",
          name: "Updated Station",
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockStation),
        });

        const result = await api.transit.stations.update("station-1", {
          name: "Updated Station",
        });

        expect(result).toEqual(mockStation);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/transit/stations/station-1"),
          expect.objectContaining({ method: "PATCH" })
        );
      });

      it("deletes a station", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 204,
          json: () => Promise.resolve(undefined),
        });

        await api.transit.stations.delete("station-1");

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/transit/stations/station-1"),
          expect.objectContaining({ method: "DELETE" })
        );
      });
    });

    describe("Line Operations", () => {
      it("creates a transit line", async () => {
        const mockLine = {
          id: "line-1",
          world_id: "world-1",
          line_type: "subway",
          name: "Red Line",
          color: "#FF0000",
          is_auto_generated: false,
          created_at: "2024-01-01",
          updated_at: "2024-01-01",
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockLine),
        });

        const result = await api.transit.lines.create("world-1", {
          line_type: "subway",
          name: "Red Line",
          color: "#FF0000",
        });

        expect(result).toEqual(mockLine);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/worlds/world-1/transit/lines"),
          expect.objectContaining({ method: "POST" })
        );
      });

      it("gets a line with segments", async () => {
        const mockLine = {
          id: "line-1",
          line_type: "subway",
          name: "Blue Line",
          segments: [
            { id: "seg-1", from_station_id: "s1", to_station_id: "s2" },
          ],
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockLine),
        });

        const result = await api.transit.lines.get("line-1");

        expect(result).toEqual(mockLine);
        expect(result.segments).toHaveLength(1);
      });
    });

    describe("Segment Operations", () => {
      it("creates a line segment", async () => {
        const mockSegment = {
          id: "seg-1",
          line_id: "line-1",
          from_station_id: "station-1",
          to_station_id: "station-2",
          geometry: [],
          is_underground: true,
          order_in_line: 0,
          created_at: "2024-01-01",
          updated_at: "2024-01-01",
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSegment),
        });

        const result = await api.transit.segments.create("line-1", {
          from_station_id: "station-1",
          to_station_id: "station-2",
          order_in_line: 0,
        });

        expect(result).toEqual(mockSegment);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/transit/lines/line-1/segments"),
          expect.objectContaining({ method: "POST" })
        );
      });

      it("lists segments for a line", async () => {
        const mockSegments = [
          { id: "seg-1", order_in_line: 0 },
          { id: "seg-2", order_in_line: 1 },
        ];

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSegments),
        });

        const result = await api.transit.segments.list("line-1");

        expect(result).toEqual(mockSegments);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/transit/lines/line-1/segments"),
          expect.any(Object)
        );
      });
    });
  });
});
