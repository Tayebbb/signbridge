import { getDatabase } from "../client";
import {processingAllowed} from "./api";
export async function healthStatus() {
  await (await getDatabase()).ping();
  return { db: "ok", processing: await processingAllowed((await getDatabase()).state,process.env.PROCESSING_ENABLED==="true")?"enabled":"disabled", renderer: "remote" } as const;
}
