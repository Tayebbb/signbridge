import type {PlaybackManifest} from "../contracts/manifest";
import type {RendererEvent,RendererPort} from "./rendererHost";
import {parseGloss} from "./gloss";
export type PlayerState="EngineLoading"|"RendererUnavailable"|"Ready"|"SourcePlaying"|"SourceHold"|"GapBlocking"|"SignLoading"|"SignPlaying"|"SignIncomplete"|"SegmentComplete"|"SegmentSkipped"|"Paused"|"StaleWait";
export interface VideoPort {currentTime:number;playbackRate:number;play():Promise<void>;pause():void;requestVideoFrameCallback?:(callback:()=>void)=>number;cancelVideoFrameCallback?:(id:number)=>void}
export interface PlayerSnapshot {state:PlayerState;idx:number;gen:number;seen:string[];expected:string[];progress:number;loadedUnits:number|null;rawSigns:number;step:number|null;completed:number[];message:string;dropped:number}
export interface PlayerTelemetry {kind:"played_complete"|"played_incomplete"|"skipped"|"engine_load_failed"|"retry";segmentIdx:number;detail:Record<string,string|number>}
export class Scheduler {
  gen=0;state:PlayerState="EngineLoading";idx=0;autoAdvance=false;sourceAvailable=true;
  private phase:"source"|"gap"|"signing"="source";private seen:string[]=[];private expected:string[]=[];private unexpected=false;private fps=23;private frames=0;private progress=0;private loadedUnits:number|null=null;private rawSigns=0;private step:number|null=null;private completed=new Set<number>();private message="Loading signing avatar…";private dropped=0;private watchdog:ReturnType<typeof setTimeout>|undefined;private sourceTimer:ReturnType<typeof setTimeout>|undefined;private frameRequest:number|undefined;private stale=new Set<number>();private disposed=false;private engineRetries=0;private engineRetry:ReturnType<typeof setTimeout>|undefined;
  constructor(private readonly video:VideoPort,private readonly host:RendererPort,private manifest:PlaybackManifest,private readonly onChange:(snapshot:PlayerSnapshot)=>void,private readonly telemetry:(event:PlayerTelemetry)=>void=()=>{}){host.onEvent=e=>this.onEvent(e);this.emit();}
  snapshot():PlayerSnapshot{return {state:this.state,idx:this.idx,gen:this.gen,seen:[...this.seen],expected:[...this.expected],progress:this.progress,loadedUnits:this.loadedUnits,rawSigns:this.rawSigns,step:this.step,completed:[...this.completed],message:this.message,dropped:this.dropped};}
  private emit(){if(!this.disposed)this.onChange(this.snapshot());}
  private transition(state:PlayerState,message=""){this.state=state;this.message=message;this.emit();}
  private clear(){clearTimeout(this.watchdog);clearTimeout(this.sourceTimer);if(this.frameRequest!==undefined)this.video.cancelVideoFrameCallback?.(this.frameRequest);this.frameRequest=undefined;}
  private bump(){this.clear();return ++this.gen;}
  private segment(){return this.manifest.segments[this.idx];}
  playSegment(idx:number){
    if(!Number.isInteger(idx)||idx<0||idx>=this.manifest.segments.length||this.state==="EngineLoading"||this.state==="RendererUnavailable")return;
    if(!["Ready","SegmentComplete","SegmentSkipped"].includes(this.state)){this.host.replaceInstance();this.video.pause();}
    this.idx=idx;const seg=this.segment();this.bump();this.phase="source";this.seen=[];this.expected=seg.sigml.unitGlossIds.map(id=>`g${this.gen}_${id}`);this.unexpected=false;this.progress=0;this.loadedUnits=null;this.rawSigns=0;this.step=null;this.completed.delete(idx);
    if(this.stale.has(idx)){this.transition("StaleWait","Updating this segment…");return;}
    if(seg.technicalStatus==="failed"){this.transition("SignIncomplete","Processing failed for this segment. Retry processing or skip.");return;}
    if(!this.sourceAvailable){this.hold();return;}
    this.video.currentTime=seg.startMs/1000;this.transition("SourcePlaying");const g=this.gen;
    this.video.play().then(()=>{if(g===this.gen&&this.state==="SourcePlaying")this.waitForSourceEnd();}).catch(()=>{if(g===this.gen)this.transition("Paused","Tap Resume to start the source video.");});
  }
  private waitForSourceEnd(){const g=this.gen;if(this.state!=="SourcePlaying")return;this.onSourceTime();if(this.state!=="SourcePlaying")return;
    if(this.video.requestVideoFrameCallback)this.frameRequest=this.video.requestVideoFrameCallback(()=>{if(g===this.gen)this.waitForSourceEnd();});
    else this.sourceTimer=setTimeout(()=>{if(g===this.gen)this.waitForSourceEnd();},Math.max(20,Math.min(250,(this.segment().endMs-this.video.currentTime*1000)/this.video.playbackRate)));
  }
  onSourceTime(){if(this.state==="SourcePlaying"&&this.video.currentTime*1000>=this.segment().endMs-10)this.hold();}
  private hold(){this.clear();const seg=this.segment();this.video.pause();if(this.sourceAvailable)this.video.currentTime=seg.holdFrameMs/1000;this.transition("SourceHold");
    if(seg.criticalGaps.length||seg.technicalStatus==="partial_blocked"||seg.technicalStatus==="no_signing"){this.phase="gap";this.transition("GapBlocking","Available signs may convey a different or opposite meaning. Caption remains visible.");return;}
    this.startSigning();
  }
  playAvailable(){if(this.state==="GapBlocking")this.startSigning();}
  private startSigning(){const seg=this.segment();if(!seg.sigml.unitCount){this.finish("skipped","no_signing");return;}
    this.phase="signing";this.seen=[];this.expected=seg.sigml.unitGlossIds.map(id=>`g${this.gen}_${id}`);this.unexpected=false;this.fps=23;this.progress=0;this.step=null;this.transition("SignLoading","Loading signs…");
    this.arm(10000,"load_timeout");this.host.play(seg.sigml.text,this.gen);
  }
  onEvent(event:RendererEvent){
    if(this.disposed)return;
    if(event.type==="engineerror"){this.bump();this.video.pause();clearTimeout(this.engineRetry);this.telemetry({kind:"engine_load_failed",segmentIdx:this.idx,detail:{reason:event.payload.message}});this.transition("RendererUnavailable",event.payload.message==="webgl_unavailable"?"Signing avatar needs WebGL, which this browser has disabled.":"Signing avatar service (University of East Anglia) is unreachable. Your track is saved.");if(event.payload.message!=="webgl_unavailable"&&this.engineRetries<3){const delay=[5000,15000,45000][this.engineRetries++];this.engineRetry=setTimeout(()=>{if(!this.disposed)this.retryRenderer(false);},delay);}return;}
    if(event.type==="avatarready"){clearTimeout(this.engineRetry);this.engineRetries=0;if(this.state==="EngineLoading")this.transition("Ready");return;}
    if(event.gen!==this.gen){this.dropped++;this.emit();return;}
    if(event.type==="avatarfps"){this.fps=Math.max(8,event.payload);return;}
    if(event.type==="sigmlloaded"&&this.state==="SignLoading"){
      if(event.payload.s!==this.expected.length||event.payload.f<=0){this.incomplete("id_mismatch");return;}
      this.loadedUnits=event.payload.s;this.frames=event.payload.f;this.transition("SignPlaying");this.arm(this.frames/this.fps*1500+3000,"watchdog");return;
    }
    if(event.type==="avatarsign"&&["SignLoading","SignPlaying"].includes(this.state)){
      const id=event.payload.g;if(!id)return;const parsed=parseGloss(id);
      if(parsed&&parsed.gen!==this.gen){this.dropped++;this.emit();return;}
      if(!parsed||parsed.segment!==this.idx){this.unexpected=true;return;}
      this.rawSigns++;if(this.seen.at(-1)!==id){if(this.seen.length<=40)this.seen.push(id);else this.unexpected=true;}this.step=parsed.step;this.emit();return;
    }
    if(event.type==="avatarframe"&&this.state==="SignPlaying"){this.progress=this.frames?Math.max(0,Math.min(1,event.payload.f/this.frames)):0;this.emit();return;}
    if(event.type==="animidle"&&this.state==="SignPlaying"){
      if(this.unexpected||this.seen.length!==this.expected.length||this.seen.some((id,i)=>id!==this.expected[i])){this.incomplete("id_mismatch");return;}
      const seg=this.segment();if(seg.technicalStatus!=="ready"||seg.criticalGaps.length)this.finish("played_incomplete","critical_gap");else this.finish("played_complete");
    }
  }
  private arm(ms:number,reason:string){clearTimeout(this.watchdog);const g=this.gen;this.watchdog=setTimeout(()=>{if(g===this.gen)this.incomplete(reason);},ms);}
  private incomplete(reason:string){this.clear();this.host.replaceInstance();this.bump();this.completed.delete(this.idx);this.telemetry({kind:"played_incomplete",segmentIdx:this.idx,detail:{reason,seen:this.seen.length,expected:this.expected.length}});this.transition("SignIncomplete",reason==="load_timeout"?"Signing failed to load — Retry or Skip":"Signing did not finish — Retry or Skip");}
  private finish(kind:"played_complete"|"played_incomplete"|"skipped",reason=""){
    this.clear();this.telemetry({kind,segmentIdx:this.idx,detail:{reason}});if(kind==="played_complete")this.completed.add(this.idx);else this.completed.delete(this.idx);
    this.transition(kind==="played_complete"?"SegmentComplete":"SegmentSkipped",kind==="played_incomplete"?"Available signs finished; this segment remains incomplete.":"");
    if(this.autoAdvance&&this.idx+1<this.manifest.segments.length)this.playSegment(this.idx+1);else this.transition("Ready",this.message);
  }
  skip(){if(["GapBlocking","SignIncomplete"].includes(this.state)){this.bump();this.host.replaceInstance();this.finish("skipped");}}
  pause(message="Resume restarts signing from the first sign."){if(["EngineLoading","RendererUnavailable"].includes(this.state)){this.video.pause();return;}this.bump();this.host.replaceInstance();this.video.pause();this.transition("Paused",message);}
  resume(){if(this.state!=="Paused")return;if(this.phase==="signing"){this.bump();this.startSigning();}else if(this.phase==="gap")this.transition("GapBlocking");else{const g=this.gen;this.transition("SourcePlaying");this.video.play().then(()=>{if(g===this.gen)this.waitForSourceEnd();}).catch(()=>this.transition("Paused","Tap Resume to start."));}}
  retry(){if(this.state==="SignIncomplete"){this.bump();this.host.replaceInstance();this.telemetry({kind:"retry",segmentIdx:this.idx,detail:{}});this.startSigning();}}
  retryRenderer(manual=true){clearTimeout(this.engineRetry);if(manual)this.engineRetries=0;this.bump();this.transition("EngineLoading","Restarting signing…");this.host.replaceInstance();}
  browseSegment(idx:number){if(!Number.isInteger(idx)||!this.manifest.segments[idx])return;if(["EngineLoading","RendererUnavailable"].includes(this.state)){this.idx=idx;this.emit();}else this.playSegment(idx);}
  replay(){this.pause();this.playSegment(this.idx);}
  next(){if(this.idx+1<this.manifest.segments.length){this.pause();this.playSegment(this.idx+1);}}
  prev(){this.pause();this.playSegment(Math.max(0,this.idx-1));}
  seek(ms:number){const index=this.manifest.segments.findIndex(s=>s.startMs<=ms&&s.endMs>ms);this.pause();this.playSegment(index<0?Math.max(0,this.manifest.segments.length-1):index);}
  setSourceSpeed(speed:number){if(![0.5,0.75,1].includes(speed))throw Error("Unsupported source speed");this.video.playbackRate=speed;}
  onVisibilityHidden(){this.pause("Paused while in background. Resume restarts signing from its first sign.");}
  onManifestStale(indices:number[]){for(const idx of indices){this.stale.add(idx);this.completed.delete(idx);}if(indices.includes(this.idx)&&this.state!=="StaleWait"){this.pause();this.transition("StaleWait","Updating this segment…");}else this.emit();}
  replaceManifest(manifest:PlaybackManifest){const waiting=["EngineLoading","RendererUnavailable"].includes(this.state);if(!waiting)this.pause();this.manifest=manifest;this.stale.clear();this.completed.clear();this.idx=Math.min(this.idx,Math.max(0,manifest.segments.length-1));if(waiting)this.emit();else this.transition("Ready","Updated track ready.");}
  dispose(){this.disposed=true;clearTimeout(this.engineRetry);this.clear();this.video.pause();this.host.dispose();}
}
