/**
 * Hook to trigger and poll a city growth simulation job.
 */

import { useState, useEffect, useRef } from "react";
import { useCreateJob, useJob } from "../../api/hooks";
import type { YearChange } from "./ChangesPanel";

export interface GrowthSimulationState {
  /** Whether growth is currently being simulated */
  isSimulating: boolean;
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
    if (summary.districts_densified > 0) {
      changes.push({
        id: "densified",
        description: `${summary.districts_densified} district${summary.districts_densified > 1 ? "s" : ""} grew denser`,
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
  const hasTriggered = useRef(false);

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

  // Auto-trigger growth when first mounted with a worldId
  useEffect(() => {
    if (worldId && !hasTriggered.current) {
      hasTriggered.current = true;
      simulate(1);
    }
  }, [worldId]);

  return {
    isSimulating,
    changes,
    error,
    yearsSimulated,
    simulate,
  };
}
