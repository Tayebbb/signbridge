import { createDatabase } from "../lib/db/client";
const db = await createDatabase({ url: process.env.DATABASE_URL || undefined, dataDir: process.env.PGLITE_DATA_DIR || ".data/postgres" });
try { await db.migrate(); console.log(`Migrations applied (${db.kind})`); }
finally { await db.close(); }
