import {sql} from "drizzle-orm";
import type {StateStore} from "../session";
export async function stalledJobs(store:StateStore,now:Date,projectId?:string) {return store.query<{id:string}>(sql`SELECT j.id FROM jobs j JOIN projects p ON p.id=j.project_id WHERE p.status='active' AND p.active_job_id=j.id AND j.status='running' AND j.heartbeat_at<${new Date(now.getTime()-600_000)} ${projectId?sql`AND p.id=${projectId}`:sql``} ORDER BY j.id`);}
