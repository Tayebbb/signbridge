export const LIFETIME_CAP=19_000_000n, DAILY_CAP=5_000_000n;
export const STORAGE_CAP=800_000_000n, TRANSFER_CAP=6_000_000_000n, ANCHOR_BOUND=300_000n;
export function dayScope(date:Date):string {
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Dhaka",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
  const part=(type:string)=>parts.find(p=>p.type===type)!.value;
  return `day:${part("year")}-${part("month")}-${part("day")}`;
}
export function dayBounds(date:Date) {const start=new Date(`${dayScope(date).slice(4)}T00:00:00+06:00`);return {start,end:new Date(start.getTime()+86_400_000)};}
export interface TokenPrices { inputMicrosPerMillion:bigint; outputMicrosPerMillion:bigint }
const ceilMillion=(value:bigint)=>(value+999_999n)/1_000_000n;
export function attemptUpperBound(requestJson:string,maxOutputTokens:number,prices:TokenPrices):bigint {
  if(!Number.isSafeInteger(maxOutputTokens)||maxOutputTokens<1||prices.inputMicrosPerMillion<0n||prices.outputMicrosPerMillion<0n)throw new Error("Invalid attempt bound inputs");
  return ceilMillion(BigInt(new TextEncoder().encode(requestJson).length+500)*prices.inputMicrosPerMillion)+ceilMillion(BigInt(maxOutputTokens)*prices.outputMicrosPerMillion);
}
export function usageCost(usage:{inputTokens:number;outputTokens:number;reasoningTokens?:number},prices:TokenPrices):bigint {
  if(!Number.isSafeInteger(usage.inputTokens)||!Number.isSafeInteger(usage.outputTokens)||usage.inputTokens<0||usage.outputTokens<0||prices.inputMicrosPerMillion<0n||prices.outputMicrosPerMillion<0n)throw new Error("Invalid model usage");
  return ceilMillion(BigInt(usage.inputTokens)*prices.inputMicrosPerMillion+BigInt(usage.outputTokens)*prices.outputMicrosPerMillion);
}
