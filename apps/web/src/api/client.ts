/**
 * API client for City Doodle backend.
 * Handles authentication, request formatting, and error handling.
 */

import {
  ApiClientError,
  AuthResponse,
  District,
  DistrictBulkCreate,
  DistrictCreate,
  DistrictUpdate,
  Job,
  JobCreate,
  PlacedSeed,
  PlacedSeedBulkCreate,
  PlacedSeedCreate,
  Tile,
  TileCreate,
  TileLock,
  TileLockCreate,
  TileUpdate,
  UserCreate,
  UserLogin,
  UserResponse,
  World,
  WorldCreate,
  WorldUpdate,
} from "./types";

// ============================================================================
// Configuration
// ============================================================================

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ============================================================================
// Token Management
// ============================================================================

let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
  if (token) {
    localStorage.setItem("auth_token", token);
  } else {
    localStorage.removeItem("auth_token");
  }
}

export function getAuthToken(): string | null {
  if (!authToken) {
    authToken = localStorage.getItem("auth_token");
  }
  return authToken;
}

export function clearAuthToken(): void {
  authToken = null;
  localStorage.removeItem("auth_token");
}

// ============================================================================
// Base Request Function
// ============================================================================

async function request<T>(
  method: string,
  path: string,
  options: {
    body?: unknown;
    params?: Record<string, string | number | boolean | undefined>;
    requireAuth?: boolean;
  } = {}
): Promise<T> {
  const { body, params, requireAuth = true } = options;

  // Build URL with query params
  const url = new URL(path, API_BASE_URL);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  // Build headers
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const token = getAuthToken();
  if (requireAuth && token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Make request
  const response = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Handle errors
  if (!response.ok) {
    let detail: unknown;
    try {
      detail = await response.json();
    } catch {
      detail = await response.text();
    }
    // Extract error message from API response
    let errorMessage = `API request failed: ${response.status} ${response.statusText}`;
    if (detail && typeof detail === "object" && "detail" in detail) {
      const apiDetail = (detail as { detail: unknown }).detail;
      if (typeof apiDetail === "string") {
        errorMessage = apiDetail;
      } else if (apiDetail && typeof apiDetail === "object" && "message" in apiDetail) {
        errorMessage = String((apiDetail as { message: unknown }).message);
      }
    }
    throw new ApiClientError(errorMessage, response.status, detail);
  }

  // Handle empty responses (204 No Content)
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// ============================================================================
// Auth Endpoints
// ============================================================================

export const auth = {
  /** Register a new user */
  async register(data: UserCreate): Promise<AuthResponse> {
    const result = await request<AuthResponse>("POST", "/auth/register", {
      body: data,
      requireAuth: false,
    });
    setAuthToken(result.session.token);
    return result;
  },

  /** Login with email and password */
  async login(data: UserLogin): Promise<AuthResponse> {
    const result = await request<AuthResponse>("POST", "/auth/login", {
      body: data,
      requireAuth: false,
    });
    setAuthToken(result.session.token);
    return result;
  },

  /** Logout and clear session */
  async logout(): Promise<void> {
    await request<void>("POST", "/auth/logout");
    clearAuthToken();
  },

  /** Get current user info */
  async me(): Promise<UserResponse> {
    return request<UserResponse>("GET", "/auth/me");
  },
};

// ============================================================================
// World Endpoints
// ============================================================================

export const worlds = {
  /** Create a new world */
  async create(data: WorldCreate): Promise<World> {
    return request<World>("POST", "/worlds", { body: data });
  },

  /** List user's worlds */
  async list(): Promise<World[]> {
    return request<World[]>("GET", "/worlds");
  },

  /** Get a world by ID */
  async get(worldId: string): Promise<World> {
    return request<World>("GET", `/worlds/${worldId}`);
  },

  /** Update a world's name or settings */
  async update(worldId: string, data: WorldUpdate): Promise<World> {
    return request<World>("PATCH", `/worlds/${worldId}`, { body: data });
  },

  /** Delete a world */
  async delete(worldId: string): Promise<void> {
    return request<void>("DELETE", `/worlds/${worldId}`);
  },
};

// ============================================================================
// Tile Endpoints
// ============================================================================

export const tiles = {
  /** Create or get a tile at the specified coordinates */
  async create(data: TileCreate): Promise<Tile> {
    return request<Tile>("POST", `/worlds/${data.world_id}/tiles`, {
      params: { tx: data.tx, ty: data.ty },
    });
  },

  /** List tiles in a world */
  async list(worldId: string): Promise<Tile[]> {
    return request<Tile[]>("GET", `/worlds/${worldId}/tiles`);
  },

  /** Get a tile by ID */
  async get(tileId: string): Promise<Tile> {
    return request<Tile>("GET", `/tiles/${tileId}`);
  },

  /** Update a tile */
  async update(tileId: string, data: TileUpdate): Promise<Tile> {
    return request<Tile>("PATCH", `/tiles/${tileId}`, { body: data });
  },

  /** Acquire a lock on a tile */
  async acquireLock(tileId: string, data?: TileLockCreate): Promise<TileLock> {
    return request<TileLock>("POST", `/tiles/${tileId}/lock`, { body: data });
  },

  /** Release a lock on a tile */
  async releaseLock(tileId: string): Promise<void> {
    return request<void>("DELETE", `/tiles/${tileId}/lock`);
  },

  /** Get lock status for a tile */
  async getLock(tileId: string): Promise<TileLock | null> {
    return request<TileLock | null>("GET", `/tiles/${tileId}/lock`);
  },

  /** Extend a lock (heartbeat) */
  async heartbeatLock(
    tileId: string,
    durationSeconds?: number
  ): Promise<TileLock> {
    return request<TileLock>("POST", `/tiles/${tileId}/lock/heartbeat`, {
      params: { duration_seconds: durationSeconds },
    });
  },
};

// ============================================================================
// Job Endpoints
// ============================================================================

export const jobs = {
  /** Create a new job */
  async create(data: JobCreate): Promise<Job> {
    return request<Job>("POST", "/jobs", { body: data });
  },

  /** List user's jobs */
  async list(options?: { tileId?: string; limit?: number }): Promise<Job[]> {
    return request<Job[]>("GET", "/jobs", {
      params: {
        tile_id: options?.tileId,
        limit: options?.limit,
      },
    });
  },

  /** Get a job by ID */
  async get(jobId: string): Promise<Job> {
    return request<Job>("GET", `/jobs/${jobId}`);
  },

  /** Cancel a pending job */
  async cancel(jobId: string): Promise<Job> {
    return request<Job>("POST", `/jobs/${jobId}/cancel`);
  },
};

// ============================================================================
// Seed Endpoints
// ============================================================================

export const seeds = {
  /** List all placed seeds in a world */
  async list(worldId: string): Promise<PlacedSeed[]> {
    return request<PlacedSeed[]>("GET", `/worlds/${worldId}/seeds`);
  },

  /** Create a new placed seed */
  async create(worldId: string, data: PlacedSeedCreate): Promise<PlacedSeed> {
    return request<PlacedSeed>("POST", `/worlds/${worldId}/seeds`, { body: data });
  },

  /** Create multiple placed seeds in a single request */
  async createBulk(worldId: string, data: PlacedSeedBulkCreate): Promise<PlacedSeed[]> {
    return request<PlacedSeed[]>("POST", `/worlds/${worldId}/seeds/bulk`, { body: data });
  },

  /** Delete a placed seed */
  async delete(seedId: string): Promise<void> {
    return request<void>("DELETE", `/seeds/${seedId}`);
  },

  /** Delete all placed seeds in a world */
  async deleteAll(worldId: string): Promise<void> {
    return request<void>("DELETE", `/worlds/${worldId}/seeds`);
  },
};

// ============================================================================
// District Endpoints
// ============================================================================

export const districts = {
  /** List all districts in a world */
  async list(worldId: string, options?: { historicOnly?: boolean }): Promise<District[]> {
    return request<District[]>("GET", `/worlds/${worldId}/districts`, {
      params: { historic_only: options?.historicOnly },
    });
  },

  /** Create a new district */
  async create(worldId: string, data: Omit<DistrictCreate, "world_id">): Promise<District> {
    return request<District>("POST", `/worlds/${worldId}/districts`, {
      body: { ...data, world_id: worldId },
    });
  },

  /** Create multiple districts in a single request */
  async createBulk(worldId: string, data: DistrictBulkCreate): Promise<District[]> {
    return request<District[]>("POST", `/worlds/${worldId}/districts/bulk`, { body: data });
  },

  /** Get a district by ID */
  async get(districtId: string): Promise<District> {
    return request<District>("GET", `/districts/${districtId}`);
  },

  /** Update a district */
  async update(districtId: string, data: DistrictUpdate): Promise<District> {
    return request<District>("PATCH", `/districts/${districtId}`, { body: data });
  },

  /** Delete a district */
  async delete(districtId: string): Promise<void> {
    return request<void>("DELETE", `/districts/${districtId}`);
  },

  /** Delete all districts in a world */
  async deleteAll(worldId: string): Promise<void> {
    return request<void>("DELETE", `/worlds/${worldId}/districts`);
  },
};

// ============================================================================
// Default Export
// ============================================================================

export const api = {
  auth,
  worlds,
  tiles,
  jobs,
  seeds,
  districts,
};

export default api;
