import { and, eq, isNull, sql } from "drizzle-orm";
import type { Database } from "../client";
import { jobs } from "../schema";
import type { DispatchStore } from "@/lib/jobs/dispatcher";

/** Atomic run claim + outbox acknowledgement; no business processing in phase 1. */
export function dispatchStore(database: Database): DispatchStore {
  const db = database.db;
  return {
    async pendingJobIds() {
      return (await db.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.dispatchState, "pending"), eq(jobs.status, "queued"), eq(jobs.cancelRequested, false)))).map(r => r.id);
    },
    async claimRun(jobId, runId) {
      const rows = await db.update(jobs).set({ runClaim: runId, workflowRunId: runId, dispatchState: "started", dispatchAttempts: sql`${jobs.dispatchAttempts} + 1`, updatedAt: new Date() })
        .where(and(eq(jobs.id, jobId), isNull(jobs.runClaim), eq(jobs.dispatchState, "pending"), eq(jobs.status, "queued"), eq(jobs.cancelRequested, false))).returning();
      return rows.length === 1;
    },
    async markStarted(jobId, runId) {
      const rows = await db.select({ claim: jobs.runClaim, dispatch: jobs.dispatchState }).from(jobs).where(eq(jobs.id, jobId));
      if (rows[0]?.claim !== runId || rows[0]?.dispatch !== "started") throw new Error("Dispatch run does not own the job");
    },
  };
}
