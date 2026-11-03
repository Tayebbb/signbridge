import {readFile} from "node:fs/promises";
import {createDatabase} from "../lib/db/client";
import {applyCorpusSeed} from "../lib/db/queries/corpusSeed";
import {eligibleAssets} from "../lib/db/queries/api";
// Deliberately ignores DATABASE_URL and all production credentials.
const db=await createDatabase({dataDir:process.env.PGLITE_DATA_DIR||".data/postgres"});
try{await db.migrate();await applyCorpusSeed(db.state,await readFile("data/corpus/seed.sql","utf8"));console.log(JSON.stringify({database:db.kind,eligible:(await eligibleAssets(db.state)).length}));}finally{await db.close();}
