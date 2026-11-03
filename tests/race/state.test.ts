import {createDatabase} from "../../lib/db/client";
import {registerStateSuite} from "./suite";
registerStateSuite(async()=>{const db=await createDatabase();await db.migrate();return {store:db.state,close:()=>db.close(),engine:"pglite"};});
