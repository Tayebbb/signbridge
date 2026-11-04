import { getDatabase } from "../client";
import {processingAllowed} from "./api";
import {sql} from "drizzle-orm";
export async function healthStatus() {
  await (await getDatabase()).ping();
  // Fail readiness when an old schema cannot support creator recovery in this release.
  await (await getDatabase()).state.query(sql`SELECT recovery_hash FROM owners LIMIT 0`);
  if(process.env.VERCEL&&(process.env.MODEL_DRIVER!=="openai"||process.env.JOB_DRIVER!=="workflows"||process.env.BLOB_DRIVER!=="vercel"||process.env.PROCESSING_ENABLED==="true"&&!process.env.OPENAI_API_KEY||!process.env.ADMIN_TOKEN||!process.env.CRON_SECRET||!(process.env.BLOB_STORE_ID||process.env.BLOB_READ_WRITE_TOKEN)))throw Error("Production dependencies are not configured");
  return { db: "ok", processing: await processingAllowed((await getDatabase()).state,process.env.PROCESSING_ENABLED==="true")?"enabled":"disabled", renderer: "remote" } as const;
}
