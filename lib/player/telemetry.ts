import type {PlayerTelemetry} from "./scheduler";
export function browserClass(ua:string){const browser=/Edg(?:e|A|iOS)?\//.test(ua)?"edge":/Firefox\/|FxiOS\//.test(ua)?"firefox":/Chrome\/|CriOS\//.test(ua)?"chrome":/Safari\//.test(ua)?"safari":"other";const device=/iPhone|iPad/.test(ua)?"ios":/Android/.test(ua)?"android":"desktop";return `${device}:${browser}`;}
export const telemetryDelivery={accepted:0,dropped:0};
export async function sendRenderTelemetry(trackVersionId:string,event:PlayerTelemetry,shareToken?:string){
  try{const response=await fetch(`/api/telemetry/render${shareToken?`?s=${encodeURIComponent(shareToken)}`:""}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({trackVersionId,segmentIdx:event.segmentIdx,kind:event.kind,detail:event.detail,uaClass:browserClass(navigator.userAgent)}),keepalive:true});if(!response.ok)throw Error("telemetry_rejected");telemetryDelivery.accepted++;}
  catch{telemetryDelivery.dropped++;window.dispatchEvent(new Event("signbridge:telemetry-dropped"));}
}
