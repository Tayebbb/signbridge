import { test, expect } from "vitest";
import { createDatabase } from "@/lib/db/client";
import { dispatchStore } from "@/lib/db/queries/dispatch";
import { InProcessDispatcher } from "@/lib/jobs/dispatcher";
test("P1-ADAPTERS: duplicate delivery/reconcile claims an outbox job once against real SQL", async () => {
  const database = await createDatabase();
  try {
    await database.migrate();
    if (database.kind !== "pglite") throw new Error("PGlite required");
    await database.client.exec(`insert into owners(id,token_hash) values ('00000000-0000-4000-8000-000000000001',decode('ab','hex'));
      insert into projects(id,owner_id,title,rights_attested_at) values ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','dispatch',now());
      insert into transcript_versions(id,project_id,version_no,source,cues,segmenter_version,source_form_version,text_hash) values ('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000002',1,'pasted','[]','test','test','test');
      insert into jobs(id,project_id,transcript_version_id,processing_epoch,idempotency_key,model_profile) values ('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003',0,'dispatch','fake');`);
    const calls: string[] = [];
    const store = dispatchStore(database);
    const runner = new InProcessDispatcher(store, async id => { calls.push(id); });
    const id = '00000000-0000-4000-8000-000000000004';
    await Promise.all([runner.dispatch(id), runner.dispatch(id), runner.reconcile()]);
    await runner.reconcile();
    expect(calls).toEqual([id]);
    expect(await store.pendingJobIds()).toEqual([]);
    await expect(store.markStarted(id, "foreign-run")).rejects.toThrow("does not own");
    expect((await database.client.query("select dispatch_state,dispatch_attempts,run_claim=workflow_run_id as same_run from jobs")).rows).toEqual([{ dispatch_state: "started", dispatch_attempts: 1, same_run: true }]);
  } finally { await database.close(); }
});
