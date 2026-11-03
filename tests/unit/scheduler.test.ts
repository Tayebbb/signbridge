import {test,expect,vi,afterEach} from "vitest";
import {randomUUID} from "node:crypto";
import {Scheduler,type PlayerTelemetry} from "@/lib/player/scheduler";
import {MessageBarrier,type RendererPort,type RendererEvent} from "@/lib/player/rendererHost";
import {withGeneration} from "@/lib/player/gloss";
import {trackFor} from "../race/support";
class FakeHost implements RendererPort {
  onEvent:(e:RendererEvent)=>void=()=>{};source={} as Window;instanceId:string=randomUUID();replacements=0;plays:{text:string;gen:number;source:Window;id:string}[]=[];barrier=new MessageBarrier(this.source,this.instanceId);
  play(text:string,gen:number){this.plays.push({text:withGeneration(text,gen),gen,source:this.source,id:this.instanceId});}
  replaceInstance(){this.source={} as Window;this.instanceId=randomUUID();this.barrier.promote(this.source,this.instanceId);this.replacements++;}
  dispose(){}
  send(type:RendererEvent["type"],payload:unknown,gen:number,source=this.source,id=this.instanceId){const event=this.barrier.accept({source,data:{instanceId:id,gen,type,payload}});if(event)this.onEvent(event);}
}
function fixture(){const manifest=trackFor({projectId:randomUUID(),jobId:randomUUID(),transcriptVersionId:randomUUID()}),host=new FakeHost(),events:PlayerTelemetry[]=[],video={currentTime:0,playbackRate:1,play:async()=>{},pause:vi.fn()},scheduler=new Scheduler(video,host,manifest,()=>{},e=>events.push(e));host.send("avatarready",null,0);scheduler.sourceAvailable=false;return {manifest,host,events,video,scheduler};}
function finish(f:ReturnType<typeof fixture>,ids=f.scheduler.snapshot().expected){const gen=f.scheduler.gen;f.host.send("animactive",null,gen);f.host.send("sigmlloaded",{s:f.manifest.segments[0].sigml.unitCount,f:100},gen);for(const [s,g] of ids.entries())f.host.send("avatarsign",{g,s,f:s*10},gen);if(ids.length)f.host.send("avatarsign",{g:ids.at(-1),s:ids.length-1,f:100},gen);f.host.send("animidle",null,gen);}
afterEach(()=>vi.useRealTimers());
test("T7: 1,000 randomized interleavings reject removed instances and old generations with zero stale transitions",()=>{
  vi.useFakeTimers();let seed=35101,drops=0;
  const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed;};
  for(let i=0;i<1000;i++){
    const f=fixture();f.scheduler.playSegment(0);const old=f.host.plays.at(-1)!,oldIds=f.scheduler.snapshot().expected;f.scheduler.pause();f.scheduler.resume();const current=f.scheduler.snapshot(),gen=f.scheduler.gen;
    const late=[()=>f.host.send("sigmlloaded",{s:3,f:100},old.gen,old.source,old.id),()=>f.host.send("avatarsign",{g:oldIds[0].toLowerCase(),s:0,f:0},old.gen,old.source,old.id),()=>f.host.send("animidle",null,old.gen,old.source,old.id),()=>f.host.send("animidle",null,gen-1),()=>f.host.send("avatarsign",{g:oldIds[0],s:0,f:0},gen)];
    for(let n=late.length-1;n>0;n--){const p=random()%(n+1);[late[n],late[p]]=[late[p],late[n]];}late.forEach(run=>run());
    expect(f.scheduler.state).toBe(current.state);expect(f.scheduler.snapshot().seen).toEqual(current.seen);expect(f.scheduler.snapshot().completed).toEqual([]);expect(f.host.barrier.dropped).toBe(3);expect(f.scheduler.snapshot().dropped).toBe(2);drops+=f.host.barrier.dropped;
    finish(f);expect(f.scheduler.snapshot().completed).toEqual([0]);expect(f.events.filter(e=>e.kind==="played_complete")).toHaveLength(1);f.scheduler.dispose();
  }
  expect(drops).toBe(3000);
});
test.each(["missing","extra","order","malformed"])("T22: %s unit sequence never completes; terminal consecutive duplicate is allowed",mode=>{
  vi.useFakeTimers();const f=fixture();f.scheduler.playSegment(0);const ids=f.scheduler.snapshot().expected;
  const bad=mode==="missing"?ids.slice(1):mode==="extra"?[...ids,ids[0]]:mode==="order"?[...ids].reverse():[...ids,"invalid"];
  finish(f,bad);expect(f.scheduler.state).toBe("SignIncomplete");expect(f.scheduler.snapshot().completed).toEqual([]);expect(f.events).toContainEqual(expect.objectContaining({kind:"played_incomplete",detail:expect.objectContaining({reason:"id_mismatch"})}));expect(f.host.replacements).toBe(1);f.scheduler.dispose();
});
test("T22: silence in load and playback fires honest watchdogs; Retry and Skip never manufacture completion",()=>{
  vi.useFakeTimers();const f=fixture();f.scheduler.playSegment(0);vi.advanceTimersByTime(10001);expect(f.scheduler.state).toBe("SignIncomplete");expect(f.events.at(-1)?.detail.reason).toBe("load_timeout");
  f.scheduler.retry();const gen=f.scheduler.gen;f.host.send("sigmlloaded",{s:3,f:100},gen);for(const [s,g] of f.scheduler.snapshot().expected.entries())f.host.send("avatarsign",{g,s,f:0},gen);vi.advanceTimersByTime(10000);expect(f.scheduler.state).toBe("SignIncomplete");expect(f.events.at(-1)?.detail.reason).toBe("watchdog");
  f.scheduler.skip();expect(f.events.at(-1)?.kind).toBe("skipped");expect(f.scheduler.snapshot().completed).toEqual([]);expect(f.events.some(e=>e.kind==="played_complete")).toBe(false);f.scheduler.dispose();
});
test("T22: gap card holds before every play; available signs never count a critical-gap segment complete",()=>{
  vi.useFakeTimers();const f=fixture();f.manifest.segments[0].technicalStatus="partial_blocked";f.manifest.segments[0].criticalGaps=[{conceptId:"c3",role:"negation",surfaceBn:"না",reason:"no_candidate"}];f.scheduler.autoAdvance=true;f.scheduler.playSegment(0);
  expect(f.scheduler.state).toBe("GapBlocking");expect(f.host.plays).toHaveLength(0);vi.advanceTimersByTime(300000);expect(f.scheduler.state).toBe("GapBlocking");expect(f.host.plays).toHaveLength(0);
  f.scheduler.playAvailable();finish(f);expect(f.scheduler.snapshot().completed).toEqual([]);expect(f.events.at(-1)).toMatchObject({kind:"played_incomplete",detail:{reason:"critical_gap"}});f.scheduler.dispose();
});
test("Two clocks: video holds at segment end, signing pause swaps context and resumes from first unit",async()=>{
  vi.useFakeTimers();const f=fixture();f.scheduler.sourceAvailable=true;f.scheduler.playSegment(0);await Promise.resolve();expect(f.scheduler.state).toBe("SourcePlaying");vi.advanceTimersByTime(3000);expect(f.host.plays).toHaveLength(0);
  f.video.currentTime=2;f.scheduler.onSourceTime();expect(f.scheduler.state).toBe("SignLoading");expect(f.video.pause).toHaveBeenCalled();const old=f.scheduler.gen;f.host.send("sigmlloaded",{s:3,f:100},old);f.host.send("avatarsign",{g:f.scheduler.snapshot().expected[0],s:0,f:0},old);f.scheduler.pause();f.scheduler.resume();expect(f.scheduler.gen).toBeGreaterThan(old);expect(f.scheduler.snapshot().seen).toEqual([]);expect(f.host.replacements).toBeGreaterThan(0);
  expect(()=>f.scheduler.setSourceSpeed(2)).toThrow();for(const speed of [.5,.75,1]){f.scheduler.setSourceSpeed(speed);expect(f.video.playbackRate).toBe(speed);}f.scheduler.onVisibilityHidden();expect(f.scheduler.state).toBe("Paused");f.scheduler.dispose();
});
test("Stale map cancels the active segment; unrelated stale segments do not stop it",()=>{
  vi.useFakeTimers();const f=fixture();f.scheduler.playSegment(0);f.scheduler.onManifestStale([3]);expect(f.scheduler.state).toBe("SignLoading");f.scheduler.onManifestStale([0]);expect(f.scheduler.state).toBe("StaleWait");expect(f.host.replacements).toBeGreaterThan(0);f.scheduler.replaceManifest(structuredClone(f.manifest));expect(f.scheduler.state).toBe("Ready");f.scheduler.dispose();
});
