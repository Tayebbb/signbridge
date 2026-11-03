import {sql} from "drizzle-orm";
import type {StateStore} from "../session";
import {lockProject,StateError} from "./common";
import type {AccessProject} from "./api";
export async function accessibleProject(store:StateStore,id:string,ownerId:string|null,shareHash:Buffer|null){
  if(!ownerId&&!shareHash)throw new StateError("not_found");
  const [row]=await store.query<AccessProject>(sql`SELECT * FROM projects WHERE id=${id} AND status='active' AND (owner_id=${ownerId} OR (visibility='unlisted' AND share_token_hash=${shareHash}))`);if(!row)throw new StateError("not_found");return row;
}
export async function projectForDelete(store:StateStore,id:string,ownerId:string|null){const [row]=await store.query<AccessProject>(sql`SELECT * FROM projects WHERE id=${id} AND owner_id=${ownerId}`);if(!row)throw new StateError("not_found");return row;}
export async function setSharing(store:StateStore,projectId:string,shareHash:Buffer|null){await store.transaction(async q=>{
  await lockProject(q,projectId,true);await q.query(sql`UPDATE projects SET visibility=${shareHash?"unlisted":"private"},share_token_hash=${shareHash},share_created_at=${shareHash?new Date():null} WHERE id=${projectId}`);
});}
