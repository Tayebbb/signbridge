import {inject} from "vitest";
import {Pool,type PoolConfig} from "pg";
import {randomUUID} from "node:crypto";
import {drizzle} from "drizzle-orm/node-postgres";
import {migrate} from "drizzle-orm/node-postgres/migrator";
import {sqlSession,type StateStore} from "../../../lib/db/session";
import type {Backend} from "../support";
function disposablePool(config:PoolConfig){
  const pool=new Pool(config),connectionsClosed:Promise<void>[]=[];
  pool.on("connect",client=>connectionsClosed.push(new Promise<void>(resolve=>client.once("end",resolve))));
  return {pool,async close(){
    // pg-pool.end() can resolve when clients leave the pool, before their sockets close.
    // Wait for the actual client end events before dropping the database/stopping PostgreSQL.
    await pool.end();await Promise.all(connectionsClosed);
  }};
}
export async function nativeBackend():Promise<Backend&{databaseName:string;port:number}> {
  const config={host:"127.0.0.1",port:inject("nativePgPort"),user:"signbridge_test",password:"",ssl:false};
  const adminConnection=disposablePool({...config,database:"postgres",max:1}),admin=adminConnection.pool;
  const name=`signbridge_${randomUUID().replaceAll("-","")}`;if(!/^signbridge_[a-f0-9]{32}$/u.test(name))throw new Error("Unsafe database identifier");
  await admin.query(`CREATE DATABASE "${name}"`);
  const connection=disposablePool({...config,database:name,max:20}),db=drizzle(connection.pool);
  await migrate(db,{migrationsFolder:"lib/db/migrations"});
  const store:StateStore={...sqlSession(q=>db.execute(q)),transaction:work=>db.transaction(q=>work(sqlSession(statement=>q.execute(statement))))};
  return {store,engine:"postgres",databaseName:name,port:config.port,async close(){await connection.close();await admin.query(`DROP DATABASE "${name}"`);await adminConnection.close();}};
}
