import { randomUUID } from "node:crypto";
export interface DispatchStore {
  pendingJobIds(): Promise<string[]>;
  claimRun(jobId: string, runId: string): Promise<boolean>;
  markStarted(jobId: string, runId: string): Promise<void>;
}
export interface Dispatcher { dispatch(jobId: string): Promise<void>; reconcile(): Promise<void> }
/** Transport only. The injected queries own the durable outbox and atomic claim. */
export class InProcessDispatcher implements Dispatcher {
  constructor(private readonly store: DispatchStore, private readonly run: (jobId: string, runId: string) => Promise<void>) {}
  async dispatch(jobId: string): Promise<void> {
    const runId = randomUUID();
    if (!await this.store.claimRun(jobId, runId)) return;
    await this.store.markStarted(jobId, runId);
    await this.run(jobId, runId);
  }
  async reconcile(): Promise<void> {
    for (const jobId of await this.store.pendingJobIds()) await this.dispatch(jobId);
  }
}
