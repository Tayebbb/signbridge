import type { Database } from "../client";
import type { DispatchStore } from "@/lib/jobs/dispatcher";
import {claimRun,pendingDispatches,acknowledgeRun,acknowledgeKnownRun} from "./execution";

/** Atomic run claim + outbox acknowledgement; no business processing in phase 1. */
export function dispatchStore(database: Database): DispatchStore {
  const state=database.state;
  return {
    async pendingJobIds() {
      return (await pendingDispatches(state)).map(r=>r.id);
    },
    async claimRun(jobId, runId) {
      const owned=await claimRun(state,jobId,runId);
      if(!owned)await acknowledgeKnownRun(state,jobId);
      return owned;
    },
    async markStarted(jobId, runId) {
      await acknowledgeRun(state,jobId,runId);
    },
  };
}
