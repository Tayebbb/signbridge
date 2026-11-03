import type {TestProject} from "vitest/node";
import {execFile,spawn} from "node:child_process";
import {promisify} from "node:util";
import {mkdir,mkdtemp,rm,writeFile} from "node:fs/promises";
import {resolve,sep,dirname,join} from "node:path";
import {createServer} from "node:net";
const exec=promisify(execFile);
declare module "vitest" {export interface ProvidedContext {nativePgPort:number}}
export default async function setup(project:TestProject) {
  const binary=process.env.PG_TEST_BIN??"C:/Program Files/PostgreSQL/16/bin";
  const base=resolve(".data");await mkdir(base,{recursive:true});const directory=await mkdtemp(join(base,"postgres-race-"));
  const env={...process.env,PGPASSWORD:"",PGSERVICE:"",PGPASSFILE:join(directory,"empty-password-file")};
  const ctl=(args:string[])=>new Promise<void>((done,reject)=>{const child=spawn(join(binary,"pg_ctl"),args,{windowsHide:true,env,stdio:"ignore"});child.once("error",reject);child.once("exit",code=>code===0?done():reject(new Error(`pg_ctl exit ${code}`)));});
  await writeFile(env.PGPASSFILE,"");const version=(await exec(join(binary,"postgres"),["--version"],{windowsHide:true,env})).stdout.trim();
  await exec(join(binary,"initdb"),["-D",join(directory,"db"),"-U","signbridge_test","--auth=trust","--no-locale","--encoding=UTF8"],{windowsHide:true,env});
  const listener=createServer();await new Promise<void>(r=>listener.listen(0,"127.0.0.1",r));const address=listener.address();if(!address||typeof address==="string")throw new Error("No disposable port");const port=address.port;await new Promise<void>(r=>listener.close(()=>r()));
  const stop=async()=>{await ctl(["-D",join(directory,"db"),"-m","fast","-w","stop"]);if(!resolve(directory).startsWith(base+sep))throw new Error("Unsafe cluster cleanup");await rm(directory,{recursive:true,force:true});};
  try{await ctl(["-D",join(directory,"db"),"-l",join(directory,"postgres.log"),"-o",`-h 127.0.0.1 -p ${port} -c shared_buffers=16MB -c max_connections=32`,"-w","start"]);}
  catch(error){throw new Error(`Disposable PostgreSQL failed to start: ${String(error)}`);}
  project.provide("nativePgPort",port);
  const evidence=resolve("docs/evidence/phase-3/native-environment.json");await mkdir(dirname(evidence),{recursive:true});await writeFile(evidence,JSON.stringify({version,bind:"127.0.0.1",authentication:"trust in a new disposable cluster; no existing credentials",maxConnections:32,poolMax:20,purpose:"Independent sessions for real row-lock contention; PGlite has one connection and serializes transactions."},null,2)+"\n");
  return stop;
}
