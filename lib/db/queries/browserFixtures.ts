import {sql} from "drizzle-orm";
import type {StateStore} from "../session";
/** Test harness only; called exclusively against the fixed local browser-fixture database. */
export async function resetBrowserFixtures(store:StateStore){await store.transaction(q=>q.query(sql`TRUNCATE owners,stage_results,spend_budgets,spend_reservations,storage_ledger,ops_settings,rate_windows,api_requests,render_events CASCADE`));}
