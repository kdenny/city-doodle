/**
 * Hook to trigger and poll a city growth simulation job.
 */

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateJob, useJob, queryKeys } from "../../api/hooks";
import type { YearChange } from "./ChangesPanel";

export interface GrowthSimulationState {
  /** Whether growth is currently being simulated */
  isSimulating: boolean;
  /** Whether a growth simulation has completed (and changelog should be shown) */
  hasCompleted: boolean;
  /** Growth changes parsed from the job result */
  changes: YearChange[];
  /** Error message if the job failed */
  error: string | null;
  /** Number of years simulated */
  yearsSimulated: number;
  /** Trigger a new growth simulation */
  simulate: (years?: number) => void;
}

/**
 * Parse growth job result entries into YearChange display items.
 */
function parseGrowthChanges(result: Record<string, unknown>): YearChange[] {
  const changes: YearChange[] = [];
  const summary = result.summary as Record<string, number> | undefined;

  if (summary) {
    if (summary.districts_infilled > 0) {
      changes.push({
        id: "densified",
        description: `${summary.districts_infilled} district${summary.districts_infilled > 1 ? "s" : ""} grew denser`,
      });
    }
    if (summary.districts_expanded > 0) {
      changes.push({
        id: "expanded",
        description: `${summary.districts_expanded} district${summary.districts_expanded > 1 ? "s" : ""} expanded`,
      });
    }
    if (summary.roads_added > 0) {
      changes.push({
        id: "roads",
        description: `${summary.roads_added} new road${summary.roads_added > 1 ? "s" : ""} built`,
      });
    }
    if (summary.pois_added > 0) {
      changes.push({
        id: "pois",
        description: `${summary.pois_added} new point${summary.pois_added > 1 ? "s" : ""} of interest`,
      });
    }
  }

  if (changes.length === 0) {
    changes.push({ id: "none", description: "No growth changes this cycle" });
  }

  return changes;
}

export function useGrowthSimulation(worldId?: string): GrowthSimulationState {
  const [jobId, setJobId] = useState<string | null>(null);
  const [changes, setChanges] = useState<YearChange[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [yearsSimulated, setYearsSimulated] = useState(0);
  const [hasCompleted, setHasCompleted] = useState(false);

  const queryClient = useQueryClient();
  const createJobMutation = useCreateJob();

  // Poll job status when we have a jobId
  const { data: job } = useJob(jobId || "", {
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "completed" || status === "failed" || status === "cancelled") {
        return false; // Stop polling
      }
      return 1000; // Poll every second
    },
  });

  // When job completes, parse results
  useEffect(() => {
    if (!job) return;

    if (job.status === "completed" && job.result) {
      setChanges(parseGrowthChanges(job.result));
      setYearsSimulated(
        (job.result as Record<string, unknown>).years_simulated as number || 1
      );
      setHasCompleted(true);
      // CITY-497: Growth modifies districts, roads, and POIs — invalidate their caches.
      // worldRoadNodes/worldRoadEdges removed: no component queries those lists directly,
      // and worldRoadNetwork already fetches the combined graph.
      if (worldId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.worldDistricts(worldId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.worldRoadNetwork(worldId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.worldPOIs(worldId) });
      }
    } else if (job.status === "failed") {
      setError(job.error || "Growth simulation failed");
      setChanges([{ id: "error", description: "Simulation failed" }]);
    }
  }, [job?.status, job?.result, job?.error]);

  const isSimulating = !!jobId && !!job && !["completed", "failed", "cancelled"].includes(job.status);

  const simulate = (years = 1) => {
    if (!worldId) return;
    setError(null);
    setChanges([]);
    setHasCompleted(false);

    createJobMutation.mutate(
      {
        type: "city_growth",
        params: { world_id: worldId, years },
      },
      {
        onSuccess: (createdJob) => {
          setJobId(createdJob.id);
        },
        onError: (err) => {
          setError(err.message);
        },
      }
    );
  };

  return {
    isSimulating,
    hasCompleted,
    changes,
    error,
    yearsSimulated,
    simulate,
  };
}
