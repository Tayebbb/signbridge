import { getDatabase } from "../client";
export async function healthStatus() {
  await (await getDatabase()).ping();
  return { db: "ok", processing: "disabled", renderer: "remote" } as const;
}
