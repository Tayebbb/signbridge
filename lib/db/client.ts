import { PGlite } from "@electric-sql/pglite";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle as pgliteDrizzle } from "drizzle-orm/pglite";
import { drizzle as neonDrizzle } from "drizzle-orm/neon-serverless";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { migrate as migrateNeon } from "drizzle-orm/neon-serverless/migrator";
import { sql } from "drizzle-orm";
import ws from "ws";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import * as schema from "./schema";
import { sqlSession, type StateStore } from "./session";

export async function createDatabase(options: { url?: string; dataDir?: string } = {}) {
  const folder = resolve("lib/db/migrations");
  if (options.url) {
    neonConfig.webSocketConstructor = ws;
    const pool = new Pool({ connectionString: options.url });
    const db = neonDrizzle(pool, { schema });
    const state:StateStore={...sqlSession(q=>db.execute(q)),transaction:work=>db.transaction(tx=>work(sqlSession(q=>tx.execute(q))))};
    return { kind: "neon" as const, db, state, migrate: () => migrateNeon(db, { migrationsFolder: folder }), ping: async () => { await db.execute(sql`select 1`); }, close: () => pool.end() };
  }
  const dataDir = options.dataDir ?? "memory://";
  if (dataDir !== "memory://") await mkdir(dataDir, { recursive: true });
  const client = new PGlite(dataDir);
  const db = pgliteDrizzle(client, { schema });
  const state:StateStore={...sqlSession(q=>db.execute(q)),transaction:work=>db.transaction(tx=>work(sqlSession(q=>tx.execute(q))))};
  return { kind: "pglite" as const, db, state, client, migrate: () => migratePglite(db, { migrationsFolder: folder }), ping: async () => { await db.execute(sql`select 1`); }, close: () => client.close() };
}
export type Database = Awaited<ReturnType<typeof createDatabase>>;
const shared = globalThis as typeof globalThis & { signbridgeDatabase?: Promise<Database> };
export function getDatabase(): Promise<Database> {
  shared.signbridgeDatabase ??= createDatabase({
    url: process.env.DATABASE_URL || undefined,
    dataDir: process.env.PGLITE_DATA_DIR || (process.env.VERCEL ? "/tmp/signbridge-postgres" : ".data/postgres"),
  });
  return shared.signbridgeDatabase;
}
