import { beforeAll, afterAll, expect, test } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { createDatabase, type Database } from "@/lib/db/client";

let database: Database;
let reference: PGlite;
beforeAll(async () => {
  database = await createDatabase();
  await database.migrate();
  reference = new PGlite();
  const design = await readFile("SYSTEM-DESIGN.md", "utf8");
  const section = design.slice(design.indexOf("### C.2 "), design.indexOf("### C.3 "));
  const sql = section.match(/```sql\r?\n([\s\S]*?)```/)?.[1];
  if (!sql) throw new Error("Design C.2 SQL missing");
  await reference.exec(sql);
  await reference.exec(await readFile("tests/fixtures/phase-3-schema.sql","utf8"));
});
afterAll(async () => { await database?.close(); await reference?.close(); });

async function sameCatalog(query: string) {
  if (database.kind !== "pglite") throw new Error("Tests require isolated PGlite");
  const actual = (await database.client.query(query)).rows;
  const expected = (await reference.query(query)).rows;
  expect(actual).toEqual(expected);
  return actual;
}
test("P1-SCHEMA: C.2 and explicit phase-3 journals match all columns, defaults and nullability", async () => {
  const rows = await sameCatalog(`select table_name, column_name, udt_name, is_nullable, column_default
    from information_schema.columns where table_schema='public' order by table_name, column_name`);
  expect(new Set(rows.map(r => (r as { table_name: string }).table_name)).size).toBe(21);
});
test("P1-SCHEMA: every primary, unique, check and foreign-key constraint including delete actions matches C.2", async () => {
  await sameCatalog(`select c.relname as table_name, con.contype, pg_get_constraintdef(con.oid) as definition
    from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' order by c.relname, con.contype, definition`);
});
test("P1-SCHEMA: every enum, including unused reviewer_kind, matches C.2", async () => {
  await sameCatalog(`select t.typname, e.enumlabel, e.enumsortorder from pg_type t join pg_enum e on e.enumtypid=t.oid
    join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' order by t.typname, e.enumsortorder`);
});
test("P1-SCHEMA: both partial indexes have the exact C.2 predicates", async () => {
  await sameCatalog(`select c.relname, pg_get_indexdef(i.indexrelid,1,true) as column_name, pg_get_expr(i.indpred,i.indrelid) as predicate
    from pg_index i join pg_class c on c.oid=i.indexrelid where c.relname in ('jobs_active','jobs_dispatch') order by c.relname`);
});
test("P1-SCHEMA: migrations are idempotent", async () => { await database.migrate(); await database.ping(); });
test("P1-SCHEMA: circular pointers SET NULL, project cascade and retained spend/shared results work", async () => {
  if (database.kind !== "pglite") throw new Error("PGlite required");
  const db = database.client;
  await db.exec(`insert into owners(id,token_hash) values ('00000000-0000-4000-8000-000000000001',decode('ab','hex'));
    insert into projects(id,owner_id,title,rights_attested_at) values ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','test',now());
    insert into transcript_versions(id,project_id,version_no,source,cues,segmenter_version,source_form_version,text_hash)
      values ('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000002',1,'pasted','[]','test','test','test');
    insert into jobs(id,project_id,transcript_version_id,processing_epoch,idempotency_key,model_profile)
      values ('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003',0,'key','fake');
    insert into track_versions(id,project_id,transcript_version_id,media_content_sha256,track_fingerprint,manifest,manifest_hash,technical_status,created_by_job_id)
      values ('00000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','test','test','{}','test','partial','00000000-0000-4000-8000-000000000004');
    update projects set current_transcript_version_id='00000000-0000-4000-8000-000000000003',current_track_version_id='00000000-0000-4000-8000-000000000005',active_job_id='00000000-0000-4000-8000-000000000004';
    insert into stage_results(cache_key,stage,schema_version,model_id,prompt_version,output,output_hash,validation) values ('shared','meaning','1','fake','1','{}','test','{}');
    insert into stage_result_refs values ('00000000-0000-4000-8000-000000000002','shared');
    insert into spend_reservations(attempt_key,day_scope,amount_micros) values ('retained','test',1);
    delete from jobs where id='00000000-0000-4000-8000-000000000004';`);
  expect((await db.query("select active_job_id from projects")).rows).toEqual([{ active_job_id: null }]);
  expect((await db.query("select created_by_job_id from track_versions")).rows).toEqual([{ created_by_job_id: null }]);
  await db.exec("delete from transcript_versions");
  expect((await db.query("select current_transcript_version_id,current_track_version_id from projects")).rows).toEqual([{ current_transcript_version_id: null, current_track_version_id: null }]);
  await db.exec("delete from projects");
  expect((await db.query("select * from stage_result_refs")).rows).toEqual([]);
  expect((await db.query("select cache_key from stage_results")).rows).toHaveLength(1);
  expect((await db.query("select id from spend_reservations")).rows).toHaveLength(1);
});
