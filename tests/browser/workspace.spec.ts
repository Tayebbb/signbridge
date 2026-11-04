import {test,expect} from "@playwright/test";
import {createServer,request as httpRequest,type IncomingHttpHeaders} from "node:http";
import type {AddressInfo} from "node:net";
import {mkdir,writeFile} from "node:fs/promises";
const evidenceRoot=process.env.SIGNBRIDGE_EVIDENCE_PHASE==="7"?"docs/evidence/phase-7/recheck":process.env.SIGNBRIDGE_EVIDENCE_PHASE==="6"?"docs/evidence/phase-6":"docs/evidence/phase-5";
import {fakeEngine,create} from "./helpers";

test("Fake end to end: upload, transcript, publish, playback, reload identity and stale-message barrier",async({page},info)=>{
  await fakeEngine(page);await create(page);const player=page.getByRole("region",{name:"Saved signing companion"}),hash=await player.getAttribute("data-manifest-hash");
  await page.getByRole("button",{name:"Play segment",exact:true}).click();await expect(page.getByRole("heading",{name:"1 of 1 segments fully signed (experimental)",exact:true})).toBeVisible({timeout:15000});
  const seen=JSON.parse((await player.getAttribute("data-seen-units"))!);expect(seen).toHaveLength(5);await expect(player).toHaveAttribute("data-loaded-units","5");await expect(player).toHaveAttribute("data-raw-sign-events","6");expect(seen).toEqual(JSON.parse((await player.getAttribute("data-expected-units"))!));
  await page.evaluate(()=>{const frame=document.querySelector<HTMLIFrameElement>(".renderer-instance:not(.renderer-standby)")!;(window as Window&{oldRenderer?:{source:Window|null;id:string}}).oldRenderer={source:frame.contentWindow,id:new URL(frame.src).searchParams.get("instanceId")!};});
  await page.getByRole("button",{name:"Replay segment"}).click();await page.getByRole("button",{name:"Pause",exact:true}).click();await expect(page.getByTestId("player-state")).toHaveText("Paused");
  await page.evaluate(()=>{const old=(window as Window&{oldRenderer?:{source:Window|null;id:string}}).oldRenderer!;for(let i=0;i<1000;i++)window.dispatchEvent(new MessageEvent("message",{source:old.source,data:{instanceId:old.id,gen:i%7,type:i%2?"animidle":"sigmlloaded",payload:i%2?null:{s:5,f:164}}}));});
  await expect(page.getByTestId("player-state")).toHaveText("Paused");await expect.poll(async()=>Number(await player.getAttribute("data-dropped-messages"))).toBeGreaterThanOrEqual(1000);
  await page.reload();await expect(page.getByRole("region",{name:"Saved signing companion"})).toHaveAttribute("data-manifest-hash",hash!);await expect(page.getByTestId("player-state")).toHaveText("Ready",{timeout:60000});
  await mkdir(evidenceRoot,{recursive:true});await page.screenshot({path:`${evidenceRoot}/ready-${info.project.name}.png`,fullPage:true});
  if(info.project.name==="chromium"){await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`${evidenceRoot}/ready-portrait-layout.png`,fullPage:true});}
});
test("T22 browser: gap card precedes signing and incomplete units never increment header",async({page},info)=>{
  await fakeEngine(page,"missing");await create(page,"কক্সবাজার অতিথি আঙুল না।");await page.getByRole("button",{name:"Play segment",exact:true}).click();await expect(page.getByTestId("gap-card")).toBeVisible({timeout:10000});await expect(page.getByRole("heading",{name:"0 of 1 segments fully signed (experimental)",exact:true})).toBeVisible();
  await mkdir(evidenceRoot,{recursive:true});await page.screenshot({path:`${evidenceRoot}/gap-card-${info.project.name}.png`,fullPage:true});await page.getByRole("button",{name:"Play available signs"}).click();await expect(page.getByTestId("incomplete-card")).toBeVisible({timeout:15000});await page.screenshot({path:`${evidenceRoot}/incomplete-${info.project.name}.png`,fullPage:true});await expect(page.getByRole("heading",{name:"0 of 1 segments fully signed (experimental)",exact:true})).toBeVisible();await expect(page.getByTestId("source-caption")).toBeVisible();
  await page.getByRole("button",{name:"Retry signing"}).click();await expect(page.getByTestId("incomplete-card")).toBeVisible({timeout:15000});await page.getByRole("button",{name:"Skip segment"}).click();await expect(page.getByTestId("player-state")).toHaveText("Ready");
  const status=await page.request.get("/api/admin/status",{headers:{Authorization:"Bearer browser-fixture-admin"}});expect(status.status()).toBe(200);expect((await status.json()).renderEvents).toEqual(expect.arrayContaining([expect.objectContaining({kind:"played_incomplete"}),expect.objectContaining({kind:"skipped"})]));
});
test("T3 / T23 live: five units via workspace frame, forged messages dropped and opaque mutation rejected",async({page},info)=>{
  const requests:{origin:string|undefined;cookie:boolean;status?:number}[]=[];
  const server=createServer((req,res)=>{const observation={origin:req.headers.origin,cookie:Boolean(req.headers.cookie),status:undefined as number|undefined};if(req.url==='/api/projects'&&req.method==='POST')requests.push(observation);
    const headers:IncomingHttpHeaders={...req.headers};
    const upstream=httpRequest({hostname:'127.0.0.1',port:43182,path:req.url,method:req.method,headers},response=>{observation.status=response.statusCode;res.writeHead(response.statusCode??502,response.headers);response.pipe(res);});upstream.on('error',()=>{res.writeHead(502);res.end();});req.pipe(upstream);
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+(server.address() as AddressInfo).port;
  try{
    await create(page,undefined,origin);const player=page.getByRole('region',{name:'Saved signing companion'});await page.getByRole('button',{name:'Play segment',exact:true}).click();await expect(page.getByRole('heading',{name:'1 of 1 segments fully signed (experimental)',exact:true})).toBeVisible({timeout:60000});
    const seen=JSON.parse((await player.getAttribute('data-seen-units'))!);expect(seen).toHaveLength(5);expect(seen).toEqual(JSON.parse((await player.getAttribute('data-expected-units'))!));expect(seen.every((s:string)=>/^g\d+_s0a\d+u\d+$/u.test(s))).toBe(true);
    await expect(page.locator('.renderer-instance:not(.renderer-standby)')).toHaveAttribute('sandbox','allow-scripts');
    const src=await page.locator('.renderer-instance:not(.renderer-standby)').getAttribute('src'),active=page.frames().find(f=>f.url()===new URL(src!,page.url()).href)!;
    const readable=await active.evaluate(async()=>{try{await fetch('/api/projects',{method:'POST',credentials:'include',headers:{'Content-Type':'text/plain'},body:JSON.stringify({title:'forged',rightsAttested:true})});return true;}catch{return false;}});expect(readable).toBe(false);
    await expect.poll(()=>requests.some(r=>r.origin==='null'&&!r.cookie&&r.status===403)).toBe(true);
    const before=Number(await player.getAttribute('data-dropped-messages'));await page.evaluate(()=>window.postMessage({type:'animidle',instanceId:crypto.randomUUID(),gen:1,payload:null},'*'));await expect.poll(async()=>Number(await player.getAttribute('data-dropped-messages'))).toBeGreaterThan(before);
    await mkdir(evidenceRoot,{recursive:true});await page.screenshot({path:evidenceRoot+'/live-'+info.project.name+'.png',fullPage:true});await writeFile(evidenceRoot+'/live-'+info.project.name+'.json',JSON.stringify({passed:true,environment:'Windows headless software WebGL',orderedDistinctIds:seen,expectedUnits:5,readable,requests},null,2)+'\n');
  }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
