import {createDatabase} from "../lib/db/client";
import {resetBrowserFixtures} from "../lib/db/queries/browserFixtures";
const path=".data/browser-phase5";
if(process.env.PGLITE_DATA_DIR!==path)throw Error("Browser-fixture reset requires the exact dedicated local test path");
const db=await createDatabase({dataDir:path});
try{await db.migrate();await resetBrowserFixtures(db.state);}finally{await db.close();}
