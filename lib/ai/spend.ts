import type {StateStore} from "../db/session";
import {reserveAttempt,settleAttempt,type ReserveAttempt} from "../db/queries/spend";
import {StateError,type RunProof} from "../db/queries/common";
import {attemptUpperBound,usageCost,type TokenPrices} from "../domain/limits";
export {attemptUpperBound,usageCost};
/** Accounting only. No model invocation or credential access. */
export async function reserveModelCall(store:StateStore,input:Omit<ReserveAttempt,"upperBound">&{requestJson:string;maxOutputTokens:number;prices:TokenPrices},now=new Date()) {
  const result=await reserveAttempt(store,{...input,upperBound:attemptUpperBound(input.requestJson,input.maxOutputTokens,input.prices)},now);
  if(result.status!=="reserved")throw new StateError(result.status);return result;
}
export async function settleModelUsage(store:StateStore,reservationId:string,proof:RunProof,usage:{inputTokens:number;outputTokens:number;reasoningTokens?:number},prices:TokenPrices,now=new Date(),outcome="usage") {return settleAttempt(store,reservationId,proof,"settled",usageCost(usage,prices),now,usage,outcome);}
