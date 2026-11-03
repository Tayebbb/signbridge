import {sql,SQL} from "drizzle-orm";
import {PgDialect} from "drizzle-orm/pg-core";
import {randomUUID} from "node:crypto";
import {mkdir,mkdtemp,rm} from "node:fs/promises";
import {resolve,sep} from "node:path";
import type {StateStore,SqlSession} from "../../lib/db/session";
import {FilesystemBlobStore} from "../../lib/storage/blob";
import {submitTranscriptVersion} from "../../lib/db/queries/authority";
import {buildManifest} from "../../lib/domain/manifest";
import {trackFingerprint,trackIdFor,hash} from "../../lib/domain/fingerprints";
import {segmentInput} from "../fixtures/domain";
export interface Backend {store:StateStore;close():Promise<void>;engine:"pglite"|"postgres"}
export const NOW=new Date("2026-11-03T03:00:00Z");
export const later=(ms:number)=>new Date(NOW.getTime()+ms);
export async function projectFixture(store:StateStore,options:{ownerId?:string;job?:boolean;driver?:"lease"}={}) {
  const ownerId=options.ownerId??randomUUID(),projectId=randomUUID();
  await store.query(sql`INSERT INTO owners(id,token_hash) VALUES (${ownerId},decode(${hash(ownerId)},'hex')) ON CONFLICT DO NOTHING`);
  await store.query(sql`INSERT INTO projects(id,owner_id,title,rights_attested_at,created_at) VALUES (${projectId},${ownerId},'Engineering fixture',${NOW},${NOW})`);
  if(options.job===false)return {ownerId,projectId,jobId:"",transcriptVersionId:"",epoch:0n};
  const job=await submitTranscriptVersion(store,{projectId,baseVersionId:null,idempotencyKey:randomUUID(),cues:[{idx:0,startMs:0,endMs:2000,text:"আমি আসবে।"}]},NOW);
  if(options.driver==="lease")await store.query(sql`UPDATE jobs SET driver='lease' WHERE id=${job.id}`);
  return {ownerId,projectId,jobId:job.id,transcriptVersionId:job.transcriptVersionId,epoch:job.epoch};
}
export function trackFor(f:{projectId:string;jobId:string;transcriptVersionId:string}) {
  const input=segmentInput();input.segment={...input.segment,idx:0,startMs:0,endMs:2000};
  const manifest=buildManifest({trackVersionId:"pending",projectId:f.projectId,transcriptVersion:{id:f.transcriptVersionId,versionNo:1,textHash:"fixture"},media:{contentSha256:"a".repeat(64),sizeBytes:32,durationMs:2000},provenance:{corpusReleaseId:"ik2-mendeley-v2",corpusLicense:"CC-BY-4.0",corpusAttribution:"Engineering fixture only",sourceFormVersion:"src-v1",sigmlBuilderVersion:"sigml-builder-v2",modelProfile:"fake",promptVersions:{meaning:"1",plan:"1"},validatorVersion:"validator-v1"},anchors:[],segments:[input]});
  manifest.trackVersionId=trackIdFor(f.jobId,trackFingerprint(manifest));return manifest;
}
export class FaultBlobStore extends FilesystemBlobStore {
  removes=0;failAt:number|null=null;
  async remove(pathname:string){this.removes++;if(this.removes===this.failAt)throw new Error("simulated interrupted Blob deletion");await super.remove(pathname);}
}
export async function blobFixture(){const base=resolve(".data");await mkdir(base,{recursive:true});const root=await mkdtemp(resolve(base,"race-blobs-"));return {blobs:new FaultBlobStore(root),async close(){const target=resolve(root);if(!target.startsWith(base+sep))throw new Error("Unsafe test cleanup path");await rm(target,{recursive:true,force:true});}};}
export function gateProjectLock(store:StateStore) {
  let signal!:()=>void,release!:()=>void,hit=false;
  const entered=new Promise<void>(r=>signal=r),pause=new Promise<void>(r=>release=r),dialect=new PgDialect();
  const gated:StateStore={...store,transaction:work=>store.transaction(q=>work({async query<T extends object>(query:SQL){const rows=await q.query<T>(query);const text=dialect.sqlToQuery(query).sql;if(!hit&&text.includes("SELECT * FROM projects")&&text.includes("FOR UPDATE")){hit=true;signal();await pause;}return rows;}}))};
  return {store:gated,entered,release};
}
export async function assertBudgetInvariant(store:SqlSession) {const rows=await store.query<{scope:string;spent_micros:string;reserved_micros:string;cap_micros:string}>(sql`SELECT * FROM spend_budgets`);for(const row of rows)if(BigInt(row.spent_micros)<0n||BigInt(row.reserved_micros)<0n||BigInt(row.spent_micros)+BigInt(row.reserved_micros)>BigInt(row.cap_micros))throw new Error(`Budget invariant failed: ${row.scope}`);}
