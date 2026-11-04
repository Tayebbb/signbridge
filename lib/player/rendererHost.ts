import { z } from "zod";
import {withGeneration} from "./gloss";
const envelope = { instanceId: z.uuid(), gen: z.number().int().nonnegative() };
export const rendererEventSchema = z.discriminatedUnion("type", [
  z.object({ ...envelope, type: z.literal("avatarready"), payload: z.null() }),
  z.object({ ...envelope, type: z.literal("sigmlloaded"), payload: z.object({ s: z.number().int().nonnegative(), f: z.number().int().nonnegative() }) }),
  z.object({ ...envelope, type: z.enum(["animactive", "animidle"]), payload: z.null() }),
  z.object({ ...envelope, type: z.literal("avatarsign"), payload: z.object({ g: z.string().max(200), s: z.number().int(), f: z.number().int() }) }),
  z.object({ ...envelope, type: z.literal("avatarframe"), payload: z.object({ s: z.number().int(), f: z.number().int() }) }),
  z.object({...envelope,type:z.literal("avatarfps"),payload:z.number().finite().positive()}),
  z.object({ ...envelope, type: z.literal("cspviolation"), payload: z.object({ directive: z.string(), blockedURI: z.string() }) }),
  z.object({ ...envelope, type: z.literal("engineerror"), payload: z.object({ message: z.string() }) }),
  z.object({ ...envelope, type: z.literal("healthprobe"), payload: z.object({ settled: z.boolean(), readable: z.boolean() }) }),
]);
export type RendererEvent = z.infer<typeof rendererEventSchema>;
export function validateRendererEvent(event: Pick<MessageEvent, "source" | "data">, source: MessageEventSource | null, instanceId: string): RendererEvent | null {
  if (!source || event.source !== source) return null;
  const result = rendererEventSchema.safeParse(event.data);
  return result.success && result.data.instanceId === instanceId ? result.data : null;
}
/** Original diagnostic spike; production scheduling uses RendererHost below. */
export function attachRendererSpike(frame: HTMLIFrameElement, onEvent: (event: RendererEvent) => void) {
  const instanceId = crypto.randomUUID();
  const receive = (event: MessageEvent) => {
    const valid = validateRendererEvent(event, frame.contentWindow, instanceId);
    if (valid) onEvent(valid);
  };
  window.addEventListener("message", receive);
  frame.src = `/renderer.html?instanceId=${instanceId}&parentOrigin=${encodeURIComponent(location.origin)}`;
  return {
    play(sigml: string) { frame.contentWindow?.postMessage({ instanceId, gen: 1, type: "play", sigml }, "*"); },
    probeHealth() { frame.contentWindow?.postMessage({ instanceId, type: "probe-health" }, "*"); },
    dispose() { window.removeEventListener("message", receive); frame.removeAttribute("src"); },
  };
}
export interface RendererPort {onEvent:(event:RendererEvent)=>void;play(sigml:string,gen:number):void;replaceInstance():void;dispose():void}
export class MessageBarrier {
  dropped=0;
  constructor(public source:MessageEventSource|null,public instanceId:string){}
  accept(event:Pick<MessageEvent,"source"|"data">){const valid=validateRendererEvent(event,this.source,this.instanceId);if(!valid)this.dropped++;return valid;}
  promote(source:MessageEventSource|null,instanceId:string){this.source=source;this.instanceId=instanceId;}
}
interface Instance {id:string;frame:HTMLIFrameElement;ready:boolean;played:boolean;timer:ReturnType<typeof setTimeout>;failed:boolean}
/** Disposable sandbox instances are the ownership barrier for unscoped engine hooks. */
export class RendererHost implements RendererPort {
  onEvent:(event:RendererEvent)=>void=()=>{};
  private active:Instance|null=null;private standby:Instance|null=null;private queued:{text:string;gen:number}|null=null;private disposed=false;
  readonly barrier=new MessageBarrier(null,"");
  constructor(private readonly container:HTMLElement,private readonly options:{loadTimeoutMs?:number;onDrop?:(count:number)=>void;onReadyChange?:(ready:boolean)=>void}={}){
    window.addEventListener("message",this.receive);
    if(!this.supportsWebGL()){queueMicrotask(()=>this.error("webgl_unavailable"));return;}
    this.active=this.create(false);this.barrier.promote(this.active.frame.contentWindow,this.active.id);
  }
  private supportsWebGL(){try{const canvas=document.createElement("canvas"),context=canvas.getContext("webgl2")??canvas.getContext("webgl");if(!context)return false;context.getExtension("WEBGL_lose_context")?.loseContext();return true;}catch{return false;}}
  private create(standby:boolean):Instance{
    const frame=document.createElement("iframe"),id=crypto.randomUUID();frame.title=standby?"Standby isolated signing renderer":"Isolated signing renderer";frame.setAttribute("sandbox","allow-scripts");frame.className=standby?"renderer-instance renderer-standby":"renderer-instance";frame.setAttribute("aria-hidden",String(standby));
    this.container.append(frame);const instance:Instance={id,frame,ready:false,played:false,failed:false,timer:setTimeout(()=>{instance.failed=true;if(this.active===instance)this.error("engine_load_failed");},this.options.loadTimeoutMs??20000)};
    frame.src=`/renderer.html?instanceId=${id}&parentOrigin=${encodeURIComponent(location.origin)}`;return instance;
  }
  private receive=(event:MessageEvent)=>{
    if(this.disposed)return;
    if(this.standby&&event.source===this.standby.frame.contentWindow){const valid=validateRendererEvent(event,event.source,this.standby.id);if(valid?.type==="avatarready"){this.standby.ready=true;clearTimeout(this.standby.timer);return;}}
    const valid=this.barrier.accept(event);if(!valid){this.options.onDrop?.(this.barrier.dropped);return;}
    if(valid.type==="avatarready"&&this.active){this.active.ready=true;clearTimeout(this.active.timer);this.options.onReadyChange?.(true);this.flush();}
    this.onEvent(valid);
  };
  private error(message:string){if(this.disposed)return;this.options.onReadyChange?.(false);this.onEvent({instanceId:this.active?.id??crypto.randomUUID(),gen:this.queued?.gen??0,type:"engineerror",payload:{message}});}
  play(text:string,gen:number){
    // Fresh contexts also prevent late unscoped callbacks from a completed preceding segment.
    if(this.active?.played)this.replaceInstance();
    this.queued={text:withGeneration(text,gen),gen};this.flush();
  }
  private flush(){if(!this.active?.ready||!this.queued)return;const {text,gen}=this.queued;this.queued=null;this.active.played=true;this.active.frame.contentWindow?.postMessage({instanceId:this.active.id,type:"play",gen,sigml:text},"*");this.standby??=this.create(true);}
  replaceInstance(){
    if(this.disposed)return;if(!this.active&&!this.supportsWebGL()){queueMicrotask(()=>this.error("webgl_unavailable"));return;}this.queued=null;if(this.active){clearTimeout(this.active.timer);this.active.frame.remove();}
    this.active=this.standby??this.create(false);this.standby=null;this.active.frame.className="renderer-instance";this.active.frame.title="Isolated signing renderer";this.active.frame.setAttribute("aria-hidden","false");this.barrier.promote(this.active.frame.contentWindow,this.active.id);
    this.options.onReadyChange?.(this.active.ready);if(this.active.failed)this.error("engine_load_failed");
    else if(this.active.ready){const id=this.active.id;queueMicrotask(()=>{if(this.active?.id===id&&!this.disposed)this.onEvent({instanceId:id,gen:0,type:"avatarready",payload:null});});}
  }
  probeHealth(){this.active?.frame.contentWindow?.postMessage({instanceId:this.active.id,type:"probe-health"},"*");}
  dispose(){this.disposed=true;window.removeEventListener("message",this.receive);for(const item of [this.active,this.standby])if(item){clearTimeout(item.timer);item.frame.remove();}this.queued=null;}
}
