/**
 * React Query hooks for the City Doodle API.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  UseMutationOptions,
  UseQueryOptions,
} from "@tanstack/react-query";
import { api } from "./client";
import {
  AuthResponse,
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
} from "./types";

// ============================================================================
// Query Keys
// ============================================================================

export const queryKeys = {
  // Auth
  me: ["auth", "me"] as const,

  // Worlds
  worlds: ["worlds"] as const,
  world: (id: string) => ["worlds", id] as const,

  // Tiles
  worldTiles: (worldId: string) => ["worlds", worldId, "tiles"] as const,
  tile: (id: string) => ["tiles", id] as const,
  tileLock: (id: string) => ["tiles", id, "lock"] as const,

  // Jobs
  jobs: (filters?: { tileId?: string }) =>
    filters?.tileId ? (["jobs", { tileId: filters.tileId }] as const) : (["jobs"] as const),
  job: (id: string) => ["jobs", id] as const,

  // Seeds
  worldSeeds: (worldId: string) => ["worlds", worldId, "seeds"] as const,
};

// ============================================================================
// Auth Hooks
// ============================================================================

export function useCurrentUser(
  options?: Omit<UseQueryOptions<UserResponse>, "queryKey" | "queryFn">
) {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => api.auth.me(),
    ...options,
  });
}

export function useRegister(
  options?: UseMutationOptions<AuthResponse, Error, UserCreate>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UserCreate) => api.auth.register(data),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.me, data.user);
    },
    ...options,
  });
}

export function useLogin(
  options?: UseMutationOptions<AuthResponse, Error, UserLogin>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UserLogin) => api.auth.login(data),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.me, data.user);
    },
    ...options,
  });
}

export function useLogout(options?: UseMutationOptions<void, Error, void>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.auth.logout(),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: queryKeys.me });
      queryClient.removeQueries({ queryKey: queryKeys.worlds });
    },
    ...options,
  });
}

// ============================================================================
// World Hooks
// ============================================================================

export function useWorlds(
  options?: Omit<UseQueryOptions<World[]>, "queryKey" | "queryFn">
) {
  return useQuery({
    queryKey: queryKeys.worlds,
    queryFn: () => api.worlds.list(),
    ...options,
  });
}

export function useWorld(
  worldId: string,
  options?: Omit<UseQueryOptions<World>, "queryKey" | "queryFn">
) {
  return useQuery({
    queryKey: queryKeys.world(worldId),
    queryFn: () => api.worlds.get(worldId),
    enabled: !!worldId,
    ...options,
  });
}

export function useCreateWorld(
  options?: UseMutationOptions<World, Error, WorldCreate>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: WorldCreate) => api.worlds.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.worlds });
    },
    ...options,
  });
}

export function useDeleteWorld(
  options?: UseMutationOptions<void, Error, string>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (worldId: string) => api.worlds.delete(worldId),
    onSuccess: (_, worldId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.worlds });
      queryClient.removeQueries({ queryKey: queryKeys.world(worldId) });
    },
    ...options,
  });
}

// ============================================================================
// Tile Hooks
// ============================================================================

export function useWorldTiles(
  worldId: string,
  options?: Omit<UseQueryOptions<Tile[]>, "queryKey" | "queryFn">
) {
  return useQuery({
    queryKey: queryKeys.worldTiles(worldId),
    queryFn: () => api.tiles.list(worldId),
    enabled: !!worldId,
    ...options,
  });
}

export function useTile(
  tileId: string,
  options?: Omit<UseQueryOptions<Tile>, "queryKey" | "queryFn">
) {
  return useQuery({
    queryKey: queryKeys.tile(tileId),
    queryFn: () => api.tiles.get(tileId),
    enabled: !!tileId,
    ...options,
  });
}

export function useCreateTile(
  options?: UseMutationOptions<Tile, Error, TileCreate>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TileCreate) => api.tiles.create(data),
    onSuccess: (tile) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.worldTiles(tile.world_id),
      });
    },
    ...options,
  });
}

export function useUpdateTile(
  options?: UseMutationOptions<Tile, Error, { tileId: string; data: TileUpdate }>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tileId, data }) => api.tiles.update(tileId, data),
    onSuccess: (tile) => {
      queryClient.setQueryData(queryKeys.tile(tile.id), tile);
      queryClient.invalidateQueries({
        queryKey: queryKeys.worldTiles(tile.world_id),
      });
    },
    ...options,
  });
}

// ============================================================================
// Tile Lock Hooks
// ============================================================================

export function useTileLock(
  tileId: string,
  options?: Omit<UseQueryOptions<TileLock | null>, "queryKey" | "queryFn">
) {
  return useQuery({
    queryKey: queryKeys.tileLock(tileId),
    queryFn: () => api.tiles.getLock(tileId),
    enabled: !!tileId,
    ...options,
  });
}

export function useAcquireLock(
  options?: UseMutationOptions<
    TileLock,
    Error,
    { tileId: string; data?: TileLockCreate }
  >
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tileId, data }) => api.tiles.acquireLock(tileId, data),
    onSuccess: (lock) => {
      queryClient.setQueryData(queryKeys.tileLock(lock.tile_id), lock);
    },
    ...options,
  });
}

export function useReleaseLock(
  options?: UseMutationOptions<void, Error, string>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tileId: string) => api.tiles.releaseLock(tileId),
    onSuccess: (_, tileId) => {
      queryClient.setQueryData(queryKeys.tileLock(tileId), null);
    },
    ...options,
  });
}

export function useHeartbeatLock(
  options?: UseMutationOptions<
    TileLock,
    Error,
    { tileId: string; durationSeconds?: number }
  >
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tileId, durationSeconds }) =>
      api.tiles.heartbeatLock(tileId, durationSeconds),
    onSuccess: (lock) => {
      queryClient.setQueryData(queryKeys.tileLock(lock.tile_id), lock);
    },
    ...options,
  });
}

// ============================================================================
// Job Hooks
// ============================================================================

export function useJobs(
  filters?: { tileId?: string; limit?: number },
  options?: Omit<UseQueryOptions<Job[]>, "queryKey" | "queryFn">
) {
  return useQuery({
    queryKey: queryKeys.jobs(filters),
    queryFn: () => api.jobs.list(filters),
    ...options,
  });
}

export function useJob(
  jobId: string,
  options?: Omit<UseQueryOptions<Job>, "queryKey" | "queryFn">
) {
  return useQuery({
    queryKey: queryKeys.job(jobId),
    queryFn: () => api.jobs.get(jobId),
    enabled: !!jobId,
    ...options,
  });
}

export function useCreateJob(
  options?: UseMutationOptions<Job, Error, JobCreate>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: JobCreate) => api.jobs.create(data),
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs() });
      if (job.tile_id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.jobs({ tileId: job.tile_id }),
        });
      }
    },
    ...options,
  });
}

export function useCancelJob(options?: UseMutationOptions<Job, Error, string>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => api.jobs.cancel(jobId),
    onSuccess: (job) => {
      queryClient.setQueryData(queryKeys.job(job.id), job);
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs() });
    },
    ...options,
  });
}

// ============================================================================
// Seed Hooks
// ============================================================================

export function useWorldSeeds(
  worldId: string,
  options?: Omit<UseQueryOptions<PlacedSeed[]>, "queryKey" | "queryFn">
) {
  return useQuery({
    queryKey: queryKeys.worldSeeds(worldId),
    queryFn: () => api.seeds.list(worldId),
    enabled: !!worldId,
    ...options,
  });
}

export function useCreateSeed(
  options?: UseMutationOptions<PlacedSeed, Error, { worldId: string; data: PlacedSeedCreate }>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ worldId, data }) => api.seeds.create(worldId, data),
    onSuccess: (_, { worldId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.worldSeeds(worldId),
      });
    },
    ...options,
  });
}

export function useCreateSeedsBulk(
  options?: UseMutationOptions<PlacedSeed[], Error, { worldId: string; data: PlacedSeedBulkCreate }>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ worldId, data }) => api.seeds.createBulk(worldId, data),
    onSuccess: (_, { worldId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.worldSeeds(worldId),
      });
    },
    ...options,
  });
}

export function useDeleteSeed(
  options?: UseMutationOptions<void, Error, { seedId: string; worldId: string }>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ seedId }) => api.seeds.delete(seedId),
    onSuccess: (_, { worldId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.worldSeeds(worldId),
      });
    },
    ...options,
  });
}

export function useDeleteAllSeeds(
  options?: UseMutationOptions<void, Error, string>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (worldId: string) => api.seeds.deleteAll(worldId),
    onSuccess: (_, worldId) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.worldSeeds(worldId),
      });
    },
    ...options,
  });
}
