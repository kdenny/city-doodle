import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  PlacedSeedsProvider,
  usePlacedSeeds,
  usePlacedSeedsOptional,
} from "./PlacedSeedsContext";
import type { SeedType } from "./types";

// Mock the API hooks
vi.mock("../../api/hooks", () => ({
  useWorldSeeds: vi.fn(() => ({
    data: undefined,
    isLoading: false,
    error: null,
  })),
  useCreateSeed: vi.fn(() => ({
    mutate: vi.fn(),
  })),
  useDeleteSeed: vi.fn(() => ({
    mutate: vi.fn(),
  })),
}));

import { useWorldSeeds, useCreateSeed, useDeleteSeed } from "../../api/hooks";

const mockSeedType: SeedType = {
  id: "residential",
  label: "Residential",
  category: "district",
  icon: "",
  description: "Housing and neighborhoods",
};

const anotherMockSeedType: SeedType = {
  id: "hospital",
  label: "Hospital",
  category: "poi",
  icon: "",
  description: "Medical center",
};

function createWrapper(props: {
  worldId?: string;
  onSeedAdded?: () => void;
  onSeedRemoved?: () => void;
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <PlacedSeedsProvider
          worldId={props.worldId}
          onSeedAdded={props.onSeedAdded}
          onSeedRemoved={props.onSeedRemoved}
        >
          {children}
        </PlacedSeedsProvider>
      </QueryClientProvider>
    );
  };
}

describe("PlacedSeedsContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations
    (useWorldSeeds as ReturnType<typeof vi.fn>).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });
    (useCreateSeed as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
    });
    (useDeleteSeed as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
    });
  });

  describe("usePlacedSeeds", () => {
    it("throws error when used outside provider", () => {
      expect(() => {
        renderHook(() => usePlacedSeeds());
      }).toThrow("usePlacedSeeds must be used within a PlacedSeedsProvider");
    });

    it("returns empty seeds array initially", () => {
      const { result } = renderHook(() => usePlacedSeeds(), {
        wrapper: createWrapper(),
      });

      expect(result.current.seeds).toEqual([]);
    });

    it("provides isLoading and error states", () => {
      const { result } = renderHook(() => usePlacedSeeds(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe("usePlacedSeedsOptional", () => {
    it("returns null when used outside provider", () => {
      const { result } = renderHook(() => usePlacedSeedsOptional());

      expect(result.current).toBeNull();
    });

    it("returns context value when used inside provider", () => {
      const { result } = renderHook(() => usePlacedSeedsOptional(), {
        wrapper: createWrapper(),
      });

      expect(result.current).not.toBeNull();
      expect(result.current?.seeds).toEqual([]);
    });
  });

  describe("addSeed (in-memory mode)", () => {
    it("adds a seed to the seeds array", () => {
      const { result } = renderHook(() => usePlacedSeeds(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.addSeed(mockSeedType, { x: 100, y: 200 });
      });

      expect(result.current.seeds).toHaveLength(1);
      expect(result.current.seeds[0].seed).toEqual(mockSeedType);
      expect(result.current.seeds[0].position).toEqual({ x: 100, y: 200 });
    });

    it("generates unique IDs for each seed", () => {
      const { result } = renderHook(() => usePlacedSeeds(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.addSeed(mockSeedType, { x: 100, y: 200 });
        result.current.addSeed(mockSeedType, { x: 300, y: 400 });
      });

      expect(result.current.seeds).toHaveLength(2);
      expect(result.current.seeds[0].id).not.toEqual(result.current.seeds[1].id);
    });

    it("returns the created seed", () => {
      const { result } = renderHook(() => usePlacedSeeds(), {
        wrapper: createWrapper(),
      });

      let createdSeed;
      act(() => {
        createdSeed = result.current.addSeed(mockSeedType, { x: 100, y: 200 });
      });

      expect(createdSeed).toBeDefined();
      expect(createdSeed!.seed).toEqual(mockSeedType);
      expect(createdSeed!.position).toEqual({ x: 100, y: 200 });
      expect(createdSeed!.id).toBeDefined();
      expect(createdSeed!.placedAt).toBeDefined();
    });

    it("calls onSeedAdded callback when provided", () => {
      const onSeedAdded = vi.fn();
      const { result } = renderHook(() => usePlacedSeeds(), {
        wrapper: createWrapper({ onSeedAdded }),
      });

      act(() => {
        result.current.addSeed(mockSeedType, { x: 100, y: 200 });
      });

      expect(onSeedAdded).toHaveBeenCalledTimes(1);
      expect(onSeedAdded).toHaveBeenCalledWith(
        expect.objectContaining({
          seed: mockSeedType,
          position: { x: 100, y: 200 },
        })
      );
    });

    it("records placedAt timestamp", () => {
      const { result } = renderHook(() => usePlacedSeeds(), {
        wrapper: createWrapper(),
      });

      const beforeTime = Date.now();
      act(() => {
        result.current.addSeed(mockSeedType, { x: 100, y: 200 });
      });
      const afterTime = Date.now();

      expect(result.current.seeds[0].placedAt).toBeGreaterThanOrEqual(beforeTime);
      expect(result.current.seeds[0].placedAt).toBeLessThanOrEqual(afterTime);
    });
  });

  describe("removeSeed (in-memory mode)", () => {
    it("removes a seed by id", () => {
      const { result } = renderHook(() => usePlacedSeeds(), {
        wrapper: createWrapper(),
      });

      let seedId: string;
      act(() => {
        const seed = result.current.addSeed(mockSeedType, { x: 100, y: 200 });
        seedId = seed.id;
      });

      expect(result.current.seeds).toHaveLength(1);

      act(() => {
        result.current.removeSeed(seedId);
      });

      expect(result.current.seeds).toHaveLength(0);
    });

    it("only removes the specified seed", () => {
      const { result } = renderHook(() => usePlacedSeeds(), {
        wrapper: createWrapper(),
      });

      let firstSeedId: string;
      act(() => {
        const first = result.current.addSeed(mockSeedType, { x: 100, y: 200 });
        firstSeedId = first.id;
        result.current.addSeed(anotherMockSeedType, { x: 300, y: 400 });
      });

      expect(result.current.seeds).toHaveLength(2);

      act(() => {
        result.current.removeSeed(firstSeedId);
      });

      expect(result.current.seeds).toHaveLength(1);
      expect(result.current.seeds[0].seed).toEqual(anotherMockSeedType);
    });

    it("calls onSeedRemoved callback when provided", () => {
      const onSeedRemoved = vi.fn();
      const { result } = renderHook(() => usePlacedSeeds(), {
        wrapper: createWrapper({ onSeedRemoved }),
      });

      let seedId = "";
      act(() => {
        const seed = result.current.addSeed(mockSeedType, { x: 100, y: 200 });
        seedId = seed.id;
      });

      act(() => {
        result.current.removeSeed(seedId);
      });

      expect(onSeedRemoved).toHaveBeenCalledTimes(1);
      expect(onSeedRemoved).toHaveBeenCalledWith(seedId);
    });

    it("does nothing when removing non-existent id", () => {
      const { result } = renderHook(() => usePlacedSeeds(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.addSeed(mockSeedType, { x: 100, y: 200 });
      });

      expect(result.current.seeds).toHaveLength(1);

      act(() => {
        result.current.removeSeed("non-existent-id");
      });

      expect(result.current.seeds).toHaveLength(1);
    });
  });

  describe("updateSeedPosition", () => {
    it("updates the position of a seed", () => {
      const { result } = renderHook(() => usePlacedSeeds(), {
        wrapper: createWrapper(),
      });

      let seedId = "";
      act(() => {
        const seed = result.current.addSeed(mockSeedType, { x: 100, y: 200 });
        seedId = seed.id;
      });

      act(() => {
        result.current.updateSeedPosition(seedId, { x: 500, y: 600 });
      });

      expect(result.current.seeds[0].position).toEqual({ x: 500, y: 600 });
    });

    it("preserves other seed properties when updating position", () => {
      const { result } = renderHook(() => usePlacedSeeds(), {
        wrapper: createWrapper(),
      });

      let seedId = "";
      let originalPlacedAt = 0;
      act(() => {
        const seed = result.current.addSeed(mockSeedType, { x: 100, y: 200 });
        seedId = seed.id;
        originalPlacedAt = seed.placedAt;
      });

      act(() => {
        result.current.updateSeedPosition(seedId, { x: 500, y: 600 });
      });

      expect(result.current.seeds[0].id).toEqual(seedId);
      expect(result.current.seeds[0].seed).toEqual(mockSeedType);
      expect(result.current.seeds[0].placedAt).toEqual(originalPlacedAt);
    });

    it("only updates the specified seed", () => {
      const { result } = renderHook(() => usePlacedSeeds(), {
        wrapper: createWrapper(),
      });

      let firstSeedId: string;
      act(() => {
        const first = result.current.addSeed(mockSeedType, { x: 100, y: 200 });
        firstSeedId = first.id;
        result.current.addSeed(anotherMockSeedType, { x: 300, y: 400 });
      });

      act(() => {
        result.current.updateSeedPosition(firstSeedId, { x: 999, y: 888 });
      });

      expect(result.current.seeds[0].position).toEqual({ x: 999, y: 888 });
      expect(result.current.seeds[1].position).toEqual({ x: 300, y: 400 });
    });

    it("does nothing when updating non-existent id", () => {
      const { result } = renderHook(() => usePlacedSeeds(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.addSeed(mockSeedType, { x: 100, y: 200 });
      });

      const originalPosition = result.current.seeds[0].position;

      act(() => {
        result.current.updateSeedPosition("non-existent-id", { x: 999, y: 888 });
      });

      expect(result.current.seeds[0].position).toEqual(originalPosition);
    });
  });

  describe("clearSeeds", () => {
    it("removes all seeds", () => {
      const { result } = renderHook(() => usePlacedSeeds(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.addSeed(mockSeedType, { x: 100, y: 200 });
        result.current.addSeed(anotherMockSeedType, { x: 300, y: 400 });
        result.current.addSeed(mockSeedType, { x: 500, y: 600 });
      });

      expect(result.current.seeds).toHaveLength(3);

      act(() => {
        result.current.clearSeeds();
      });

      expect(result.current.seeds).toHaveLength(0);
    });

    it("works when seeds array is already empty", () => {
      const { result } = renderHook(() => usePlacedSeeds(), {
        wrapper: createWrapper(),
      });

      expect(result.current.seeds).toHaveLength(0);

      act(() => {
        result.current.clearSeeds();
      });

      expect(result.current.seeds).toHaveLength(0);
    });
  });

  describe("API integration (with worldId)", () => {
    it("shows loading state while fetching seeds", () => {
      (useWorldSeeds as ReturnType<typeof vi.fn>).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      });

      const { result } = renderHook(() => usePlacedSeeds(), {
        wrapper: createWrapper({ worldId: "test-world-id" }),
      });

      expect(result.current.isLoading).toBe(true);
    });

    it("loads seeds from API when worldId is provided", async () => {
      const apiSeeds = [
        {
          id: "api-seed-1",
          world_id: "test-world-id",
          seed_type_id: "residential",
          position: { x: 100, y: 200 },
          placed_at: "2024-01-01T00:00:00Z",
        },
      ];

      (useWorldSeeds as ReturnType<typeof vi.fn>).mockReturnValue({
        data: apiSeeds,
        isLoading: false,
        error: null,
      });

      const { result } = renderHook(() => usePlacedSeeds(), {
        wrapper: createWrapper({ worldId: "test-world-id" }),
      });

      await waitFor(() => {
        expect(result.current.seeds).toHaveLength(1);
      });

      expect(result.current.seeds[0].id).toBe("api-seed-1");
      expect(result.current.seeds[0].seed.id).toBe("residential");
      expect(result.current.seeds[0].position).toEqual({ x: 100, y: 200 });
    });

    it("calls createSeed API when adding a seed with worldId", () => {
      const mockMutate = vi.fn();
      (useCreateSeed as ReturnType<typeof vi.fn>).mockReturnValue({
        mutate: mockMutate,
      });

      const { result } = renderHook(() => usePlacedSeeds(), {
        wrapper: createWrapper({ worldId: "test-world-id" }),
      });

      act(() => {
        result.current.addSeed(mockSeedType, { x: 100, y: 200 });
      });

      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          worldId: "test-world-id",
          data: {
            seed_type_id: "residential",
            position: { x: 100, y: 200 },
          },
        }),
        expect.any(Object)
      );
    });

    it("calls deleteSeed API when removing a seed with worldId", async () => {
      const mockMutate = vi.fn();
      (useDeleteSeed as ReturnType<typeof vi.fn>).mockReturnValue({
        mutate: mockMutate,
      });

      // Pre-load a seed from the API
      const apiSeeds = [
        {
          id: "api-seed-1",
          world_id: "test-world-id",
          seed_type_id: "residential",
          position: { x: 100, y: 200 },
          placed_at: "2024-01-01T00:00:00Z",
        },
      ];
      (useWorldSeeds as ReturnType<typeof vi.fn>).mockReturnValue({
        data: apiSeeds,
        isLoading: false,
        error: null,
      });

      const { result } = renderHook(() => usePlacedSeeds(), {
        wrapper: createWrapper({ worldId: "test-world-id" }),
      });

      await waitFor(() => {
        expect(result.current.seeds).toHaveLength(1);
      });

      act(() => {
        result.current.removeSeed("api-seed-1");
      });

      expect(mockMutate).toHaveBeenCalledWith(
        { seedId: "api-seed-1", worldId: "test-world-id" },
        expect.any(Object)
      );
    });

    it("shows error state when API fails", () => {
      const error = new Error("API Error");
      (useWorldSeeds as ReturnType<typeof vi.fn>).mockReturnValue({
        data: undefined,
        isLoading: false,
        error,
      });

      const { result } = renderHook(() => usePlacedSeeds(), {
        wrapper: createWrapper({ worldId: "test-world-id" }),
      });

      expect(result.current.error).toBe(error);
    });
  });

  describe("multiple operations", () => {
    it("handles a sequence of add, update, and remove operations", () => {
      const { result } = renderHook(() => usePlacedSeeds(), {
        wrapper: createWrapper(),
      });

      let seed1Id = "";
      let seed2Id = "";

      // Add two seeds
      act(() => {
        const seed1 = result.current.addSeed(mockSeedType, { x: 100, y: 100 });
        seed1Id = seed1.id;
        const seed2 = result.current.addSeed(anotherMockSeedType, { x: 200, y: 200 });
        seed2Id = seed2.id;
      });

      expect(result.current.seeds).toHaveLength(2);

      // Update first seed position
      act(() => {
        result.current.updateSeedPosition(seed1Id, { x: 150, y: 150 });
      });

      expect(result.current.seeds.find((s) => s.id === seed1Id)?.position).toEqual({
        x: 150,
        y: 150,
      });

      // Remove second seed
      act(() => {
        result.current.removeSeed(seed2Id);
      });

      expect(result.current.seeds).toHaveLength(1);
      expect(result.current.seeds[0].id).toEqual(seed1Id);

      // Add another seed
      act(() => {
        result.current.addSeed(mockSeedType, { x: 300, y: 300 });
      });

      expect(result.current.seeds).toHaveLength(2);

      // Clear all
      act(() => {
        result.current.clearSeeds();
      });

      expect(result.current.seeds).toHaveLength(0);
    });
  });
});
