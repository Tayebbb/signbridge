"use client";
import {useEffect,useRef,useState} from "react";
import type {PlaybackManifest,CurrentTrackResponse} from "@/lib/contracts/manifest";
import {Scheduler,type PlayerSnapshot,type PlayerTelemetry} from "@/lib/player/scheduler";
import {RendererHost} from "@/lib/player/rendererHost";
const initial:PlayerSnapshot={state:"EngineLoading",idx:0,gen:0,seen:[],expected:[],progress:0,loadedUnits:null,rawSigns:0,step:null,completed:[],message:"Loading signing avatar…",dropped:0};
export default function Player({manifest,current,stale=[]}:{manifest:PlaybackManifest;current:CurrentTrackResponse;stale?:number[]}){
  const video=useRef<HTMLVideoElement>(null),container=useRef<HTMLDivElement>(null),scheduler=useRef<Scheduler|null>(null),[snapshot,setSnapshot]=useState(initial),[captions,setCaptions]=useState(true),[size,setSize]=useState(400),[auto,setAuto]=useState(false);
  useEffect(()=>{
    if(!video.current||!container.current)return;
    const host=new RendererHost(container.current,{onDrop:count=>setSnapshot(s=>({...s,dropped:count+(scheduler.current?.snapshot().dropped??0)}))});
    const telemetry=(e:PlayerTelemetry)=>{void fetch("/api/telemetry/render",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({trackVersionId:manifest.trackVersionId,segmentIdx:e.segmentIdx,kind:e.kind,detail:e.detail,uaClass:"web"}),keepalive:true}).catch(()=>{});};
    const player=new Scheduler(video.current,host,manifest,s=>setSnapshot({...s,dropped:s.dropped+host.barrier.dropped}),telemetry);scheduler.current=player;
    const hidden=()=>{if(document.hidden)player.onVisibilityHidden();};document.addEventListener("visibilitychange",hidden);
    return ()=>{document.removeEventListener("visibilitychange",hidden);player.dispose();scheduler.current=null;};
    // A new artifact creates a new scheduler/ownership boundary; mutable overlays do not.
  },[manifest]);
  useEffect(()=>{if(scheduler.current){scheduler.current.sourceAvailable=current.media.state==="available";scheduler.current.autoAdvance=auto;}},[current.media.state,auto]);
  useEffect(()=>{if(stale.length)scheduler.current?.onManifestStale(stale);},[stale]);
  const segment=manifest.segments[snapshot.idx],blocked=snapshot.state==="GapBlocking",incomplete=snapshot.state==="SignIncomplete",unavailable=snapshot.state==="RendererUnavailable",engineBusy=snapshot.state==="EngineLoading"||unavailable;
  const forceCaption=blocked||incomplete||unavailable||Boolean(segment?.criticalGaps.length),signing=["SignLoading","SignPlaying"].includes(snapshot.state);
  if(!segment)return <p>No segments in this saved track.</p>;
  return <section className="player" aria-label="Saved signing companion" data-manifest-hash={current.manifestHash} data-loaded-units={snapshot.loadedUnits??""} data-raw-sign-events={snapshot.rawSigns} data-seen-units={JSON.stringify(snapshot.seen)} data-expected-units={JSON.stringify(snapshot.expected)} data-dropped-messages={snapshot.dropped}>
    <div className="player-heading"><h2>{snapshot.completed.length} of {manifest.segments.length} segments fully signed (experimental)</h2><p className="field-note">Technical playback completion only · experimental · not reviewed by a BdSL signer</p></div>
    <div className="player-layout"><section className={`source-panel ${signing?"source-held":""}`}><h3>Source clip</h3><video ref={video} src={current.media.url??undefined} preload="metadata" playsInline onTimeUpdate={()=>scheduler.current?.onSourceTime()} aria-label="Source video" />
      {current.media.state!=="available"&&<p className="error-note">Source video expired or missing. Captions and the saved signing track remain available.</p>}
      {(captions||forceCaption)&&<p className="caption" lang="bn" data-testid="source-caption">{segment.sourceTextBn}</p>}
      <p className="field-note">{signing?"Source held while signs play.":"Source plays first, then waits for signing."} Signing pace: engine default 1×.</p>
    </section><section className="signing-panel" aria-label="Signing panel"><div className="signing-title"><h3>Signing companion</h3><label>Panel size <select aria-label="Signing panel size" value={size} onChange={e=>setSize(Number(e.target.value))}><option value={320}>S</option><option value={400}>M</option><option value={520}>L</option></select></label></div>
      <div className="renderer-area" style={{maxWidth:size}} ref={container} />
      <div className="player-state" role="status" data-testid="player-state">{snapshot.state}</div>
      {snapshot.message&&<p className="state-message">{snapshot.message}</p>}
      {blocked&&<div className="gap-card" role="alert" data-testid="gap-card"><h3>Incomplete — {segment.criticalGaps.map(g=>g.role).join(", ")||"no signs available"} not signed</h3><p lang="bn">{segment.criticalGaps.map(g=>g.surfaceBn).join(" · ")}</p><p>Available signs may convey a different or opposite meaning. Read the caption before continuing.</p><div className="button-row"><button onClick={()=>scheduler.current?.playAvailable()} disabled={!segment.sigml.unitCount}>Play available signs</button><button className="secondary" onClick={()=>scheduler.current?.skip()}>Skip segment</button></div></div>}
      {incomplete&&<div className="gap-card" role="alert" data-testid="incomplete-card"><h3>Signing did not finish</h3><p>This segment has not counted as complete. Retry restarts from its first sign.</p><div className="button-row"><button onClick={()=>scheduler.current?.retry()}>Retry signing</button><button className="secondary" onClick={()=>scheduler.current?.skip()}>Skip segment</button></div></div>}
      {unavailable&&<button onClick={()=>scheduler.current?.retryRenderer()}>Retry avatar connection</button>}
      {signing&&<progress aria-label="Signing animation progress" max={1} value={snapshot.progress} />}
      <p className="strategy">{segment.strategy==="exact_corpus_phrase"?"Corpus phrase (IsharaKotha) · not reviewed in this context":"Composed by SignBridge · experimental"}</p>
      <ol className="sign-timeline">{segment.timeline.map((step,i)=><li key={i} aria-current={snapshot.step===i?"step":undefined} className={step.kind==="gap"?"timeline-gap":""}>{step.kind==="asset"?<span lang="bn">{step.labelBn}</span>:<>Gap: <span lang="bn">{step.surfaceBn}</span> ({step.reason.replaceAll("_"," ")})</>}</li>)}</ol>
    </section></div>
    <div className="player-controls"><div className="button-row"><button disabled={engineBusy||snapshot.idx===0} className="secondary" onClick={()=>scheduler.current?.prev()}>Previous</button><button disabled={engineBusy} onClick={()=>snapshot.state==="Paused"?scheduler.current?.resume():scheduler.current?.playSegment(snapshot.idx)}>{snapshot.state==="Paused"?"Resume":"Play segment"}</button><button disabled={engineBusy||["Ready","Paused"].includes(snapshot.state)} className="secondary" onClick={()=>scheduler.current?.pause()}>Pause</button><button disabled={engineBusy} className="secondary" onClick={()=>scheduler.current?.replay()}>Replay segment</button><button disabled={engineBusy||snapshot.idx+1===manifest.segments.length} className="secondary" onClick={()=>scheduler.current?.next()}>Next</button></div>
      <div className="settings-row"><label>Source speed <select defaultValue="1" onChange={e=>scheduler.current?.setSourceSpeed(Number(e.target.value))}><option value="0.5">0.5×</option><option value="0.75">0.75×</option><option value="1">1×</option></select></label><label className="check"><input type="checkbox" checked={captions||forceCaption} disabled={forceCaption} onChange={e=>setCaptions(e.target.checked)} />Show captions</label><label className="check"><input type="checkbox" checked={auto} onChange={e=>setAuto(e.target.checked)} />Auto-advance after playback</label></div>
      <label>Segment <select value={snapshot.idx} onChange={e=>scheduler.current?.playSegment(Number(e.target.value))} disabled={engineBusy}>{manifest.segments.map(s=><option key={s.idx} value={s.idx}>{s.idx+1} · {(s.startMs/1000).toFixed(1)}–{(s.endMs/1000).toFixed(1)}s</option>)}</select></label>
    </div>
  </section>;
}
