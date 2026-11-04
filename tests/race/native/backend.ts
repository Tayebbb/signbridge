import {inject} from "vitest";
import {Pool} from "pg";
import {randomUUID} from "node:crypto";
import {drizzle} from "drizzle-orm/node-postgres";
import {migrate} from "drizzle-orm/node-postgres/migrator";
import {sqlSession,type StateStore} from "../../../lib/db/session";
import type {Backend} from "../support";
export async function nativeBackend():Promise<Backend&{databaseName:string;port:number}> {
  const config={host:"127.0.0.1",port:inject("nativePgPort"),user:"signbridge_test",password:"",ssl:false};
  const admin=new Pool({...config,database:"postgres",max:1});
  const name=`signbridge_${randomUUID().replaceAll("-","")}`;if(!/^signbridge_[a-f0-9]{32}$/u.test(name))throw new Error("Unsafe database identifier");
  await admin.query(`CREATE DATABASE "${name}"`);
  const pool=new Pool({...config,database:name,max:20}),db=drizzle(pool);
  await migrate(db,{migrationsFolder:"lib/db/migrations"});
  const store:StateStore={...sqlSession(q=>db.execute(q)),transaction:work=>db.transaction(q=>work(sqlSession(statement=>q.execute(statement))))};
  return {store,engine:"postgres",databaseName:name,port:config.port,async close(){await pool.end();await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);await admin.end();}};
}
