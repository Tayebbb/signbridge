import {test,expect} from "vitest";
import {PgDialect} from "drizzle-orm/pg-core";
import type {SQL} from "drizzle-orm";
import type {StateStore,SqlSession} from "../../../lib/db/session";
import {deploymentSnapshot} from "../../../lib/db/queries/deploymentVerification";
import {claimRun} from "../../../lib/db/queries/execution";
import {publishTrack} from "../../../lib/db/queries/publish";
import {nativeBackend} from "./backend";
import {projectFixture,trackFor,NOW} from "../support";
test("Deployment verification cannot mix project-before with job-after atomic publication",async()=>{
 const backend=await nativeBackend(),store=backend.store,dialect=new PgDialect();
 try{
  const fixture=await projectFixture(store),proof={runId:"snapshot-regression"};expect(await claimRun(store,fixture.jobId,proof.runId,NOW)).toBe(true);
  let signal!:()=>void,release!:()=>void,armed=true;
  const entered=new Promise<void>(r=>signal=r),hold=new Promise<void>(r=>release=r);
  const wrap=(q:SqlSession):SqlSession=>({async query<T extends object>(statement:SQL){const rows=await q.query<T>(statement);if(armed&&dialect.sqlToQuery(statement).sql.includes("SELECT id,current_track_version_id,active_job_id FROM projects")){armed=false;signal();await hold;}return rows;}});
  const gated:StateStore={...wrap(store),transaction:work=>store.transaction(q=>work(wrap(q)))};
  const pending=deploymentSnapshot(gated,fixture.projectId);await entered;
  try{expect((await publishTrack(store,fixture.jobId,proof,trackFor(fixture),NOW)).status).toBe("published");}finally{release();}
  const before=await pending;expect(before.project.current_track_version_id).toBeNull();expect(before.jobs[0].status).toBe("running");expect(before.tracks).toHaveLength(0);
  const after=await deploymentSnapshot(store,fixture.projectId);expect(after.tracks).toHaveLength(1);expect(after.project.current_track_version_id).toBe(after.jobs[0].result_track_version_id);
 }finally{await backend.close();}
});
