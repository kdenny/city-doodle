/**
 * API client fixture for E2E tests
 *
 * Provides direct API access for fast test setup.
 * Use this to create test data (worlds, tiles) before UI tests.
 */

import { test as base } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";

const API_URL = "http://localhost:8001";

export interface World {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

export interface Tile {
  id: string;
  world_id: string;
  x: number;
  y: number;
  terrain_data?: Record<string, unknown>;
}

export interface ApiFixture {
  /** Create a new world via API */
  createWorld: (token: string, name?: string) => Promise<World>;

  /** List worlds for the current user */
  listWorlds: (token: string) => Promise<World[]>;

  /** Get a world by ID */
  getWorld: (token: string, worldId: string) => Promise<World>;

  /** Generate terrain for a tile */
  generateTerrain: (token: string, worldId: string, x: number, y: number) => Promise<Tile>;

  /** Get a tile by coordinates */
  getTile: (token: string, worldId: string, x: number, y: number) => Promise<Tile | null>;

  /** Make an authenticated API request */
  fetch: (
    token: string,
    path: string,
    options?: { method?: string; data?: unknown }
  ) => Promise<Response>;
}

function createApiFixture(request: APIRequestContext): ApiFixture {
  const authHeaders = (token: string) => ({
    Authorization: `Bearer ${token}`,
  });

  return {
    async createWorld(token: string, name?: string): Promise<World> {
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

    async listWorlds(token: string): Promise<World[]> {
      const response = await request.get(`${API_URL}/worlds`, {
        headers: authHeaders(token),
      });

      if (!response.ok()) {
        const body = await response.text();
        throw new Error(`Failed to list worlds: ${response.status()} - ${body}`);
      }

      return response.json();
    },

    async getWorld(token: string, worldId: string): Promise<World> {
      const response = await request.get(`${API_URL}/worlds/${worldId}`, {
        headers: authHeaders(token),
      });

      if (!response.ok()) {
        const body = await response.text();
        throw new Error(`Failed to get world: ${response.status()} - ${body}`);
      }

      return response.json();
    },

    async generateTerrain(
      token: string,
      worldId: string,
      x: number,
      y: number
    ): Promise<Tile> {
      const response = await request.post(
        `${API_URL}/worlds/${worldId}/tiles/${x}/${y}/generate`,
        {
          headers: authHeaders(token),
        }
      );

      if (!response.ok()) {
        const body = await response.text();
        throw new Error(`Failed to generate terrain: ${response.status()} - ${body}`);
      }

      return response.json();
    },

    async getTile(
      token: string,
      worldId: string,
      x: number,
      y: number
    ): Promise<Tile | null> {
      const response = await request.get(
        `${API_URL}/worlds/${worldId}/tiles/${x}/${y}`,
        {
          headers: authHeaders(token),
        }
      );

      if (response.status() === 404) {
        return null;
      }

      if (!response.ok()) {
        const body = await response.text();
        throw new Error(`Failed to get tile: ${response.status()} - ${body}`);
      }

      return response.json();
    },

    async fetch(
      token: string,
      path: string,
      options?: { method?: string; data?: unknown }
    ): Promise<Response> {
      const url = path.startsWith("http") ? path : `${API_URL}${path}`;
      const method = options?.method ?? "GET";

      const response = await request.fetch(url, {
        method,
        headers: authHeaders(token),
        data: options?.data,
      });

      return response;
    },
  };
}

/**
 * Extended test with API fixture
 *
 * Usage:
 * ```ts
 * import { test } from './fixtures/api';
 *
 * test('can create world via API', async ({ api }) => {
 *   const user = await auth.registerUser();
 *   const world = await api.createWorld(user.token!, 'My World');
 * });
 * ```
 */
export const test = base.extend<{ api: ApiFixture }>({
  api: async ({ request }, use) => {
    const api = createApiFixture(request);
    await use(api);
  },
});

export { expect } from "@playwright/test";
export type { Response } from "@playwright/test";
