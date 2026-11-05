// Real unmodified CWASA rendering only; never a language-quality evaluation.
import {chromium} from '@playwright/test';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
const [input,output,workersArg='4']=process.argv.slice(2),workers=Number(workersArg);
if(!input||!output||!Number.isInteger(workers)||workers<1||workers>4)throw Error('Usage: node scripts/probe-corpus-batch.mjs input.json evidence-directory [1..4 workers]');
const list=JSON.parse(await readFile(input,'utf8'));
if(!Array.isArray(list)||!list.length||new Set(list.map(x=>x.assetId)).size!==list.length)throw Error('Unique nonempty probe list required');
await mkdir(output,{recursive:true});const profile='cwasa-vhg2026/anna/speed0',checks=new Map();
try{for(const c of JSON.parse(await readFile(output+'/asset-render-checks.json','utf8')).asset_render_checks??[]){const item=list.find(x=>x.assetId===c.assetId);if(item&&item.derivedSha256===c.derivedSha256&&c.rendererProfile===profile)checks.set(c.assetId,c);}}catch(error){if(error.code!=='ENOENT')throw error;}
const pending=list.filter(x=>!checks.has(x.assetId));let next=0,persistTail=Promise.resolve();
const persist=()=>persistTail=persistTail.then(async()=>{const rows=[...checks.values()].sort((a,b)=>a.assetId.localeCompare(b.assetId));await writeFile(output+'/checks.tmp',JSON.stringify({renderer:profile,checkedAt:new Date().toISOString(),workers,total:list.length,attempted:rows.length,passed:rows.filter(x=>x.passed).length,limitation:'Technical renderability only; no linguistic correctness or comprehension evidence.',asset_render_checks:rows},null,2)+'\n');await rename(output+'/checks.tmp',output+'/asset-render-checks.json');});
const [html,wrapper]=await Promise.all([readFile('public/renderer.html'),readFile('lib/player/rendererFrame.js')]);
const csp="default-src 'none'; script-src 'self' https://vhg.cmp.uea.ac.uk; script-src-attr 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://vhg.cmp.uea.ac.uk; connect-src 'self' https://vhg.cmp.uea.ac.uk; img-src https://vhg.cmp.uea.ac.uk blob: data:; worker-src blob:; frame-ancestors 'self'";
const server=createServer((req,res)=>{if(req.url.startsWith('/renderer.html')){res.writeHead(200,{'Content-Type':'text/html','Content-Security-Policy':csp});res.end(html);}else if(req.url==='/renderer-frame.js'){res.writeHead(200,{'Content-Type':'text/javascript'});res.end(wrapper);}else{res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><html lang="en"><title>Corpus technical checks</title><p>Experimental; unreviewed. Technical rendering only.</p></html>');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader','--disable-renderer-backgrounding','--disable-background-timer-throttling','--disable-backgrounding-occluded-windows']});
try{await Promise.all(Array.from({length:workers},async(_,worker)=>{
 const context=await browser.newContext({viewport:{width:1000,height:760}}),page=await context.newPage();let gen=0,used=0;const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 const reset=async()=>{gen=0;used=0;const instanceId=randomUUID();await page.goto(origin);await page.evaluate(({instanceId,origin})=>{window.probe={instanceId,events:[]};const frame=document.createElement('iframe');frame.sandbox='allow-scripts';frame.width='820';frame.height='600';addEventListener('message',e=>{if(e.source===frame.contentWindow&&e.data?.instanceId===instanceId)window.probe.events.push(e.data);});frame.src=`/renderer.html?instanceId=${instanceId}&parentOrigin=${encodeURIComponent(origin)}`;document.body.append(frame);},{instanceId,origin});await page.waitForFunction(()=>window.probe.events.some(e=>e.type==='avatarready'),null,{timeout:60000});};
 try{await reset();while(next<pending.length){const item=pending[next++];if(used>=30)await reset();gen++;used++;const started=Date.now();
  const xml=item.xml.replace(/(\bgloss\s*=\s*)("|')(s\d+a\d+u\d+)\2/g,(_,prefix,quote,id)=>`${prefix}${quote}g${gen}_${id}${quote}`),expected=[...xml.matchAll(/\bgloss\s*=\s*("|')([^"']+)\1/g)].map(m=>m[2]);
  if(expected.length!==item.unitCount)throw Error('Probe XML/unit mismatch');
  await page.evaluate(({xml,gen})=>{window.probe.events=[];document.querySelector('iframe').contentWindow.postMessage({instanceId:window.probe.instanceId,type:'play',gen,sigml:xml},'*');},{xml,gen});
  let timedOut=false;try{await page.waitForFunction(()=>{const e=window.probe.events;return e.some(x=>['engineerror','cspviolation'].includes(x.type))||(e.some(x=>x.type==='animactive')&&e.some(x=>x.type==='avatarframe')&&e.some(x=>x.type==='animidle'));},null,{timeout:35000});}catch{timedOut=true;}
  const events=await page.evaluate(()=>window.probe.events),loaded=events.find(e=>e.type==='sigmlloaded')?.payload,observed=[];for(const e of events.filter(e=>e.type==='avatarsign')){const id=e.payload.g;if(id&&observed.at(-1)!==id)observed.push(id);}const frames=events.filter(e=>e.type==='avatarframe').length;
  const passed=!timedOut&&loaded?.s===item.unitCount&&loaded?.f>0&&frames>0&&errors.length===0&&JSON.stringify(observed)===JSON.stringify(expected)&&!events.some(e=>['engineerror','cspviolation'].includes(e.type));
  checks.set(item.assetId,{assetId:item.assetId,labelBn:item.labelBn,derivedSha256:item.derivedSha256,rendererProfile:profile,checkedAt:new Date().toISOString(),browser:'chromium',browserVersion:browser.version(),environment:{platform:process.platform,headless:true,webgl:'SwiftShader'},passed,timedOut,signs:loaded?.s??0,frames:loaded?.f??0,frameEvents:frames,elapsedMs:Date.now()-started,expectedIds:expected,observedIds:observed,pageErrors:errors.splice(0)});await persist();
  if(pending.length<=20)await page.screenshot({path:`${output}/${item.assetId}.png`});
  if(checks.size%25===0||!passed)console.log(JSON.stringify({checked:checks.size,total:list.length,passed:[...checks.values()].filter(x=>x.passed).length,worker,latest:item.assetId,latestPassed:passed}));
  if(!passed&&next<pending.length)await reset();
 }}finally{await context.close();}
}));}finally{await persistTail;await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
await persist();console.log(JSON.stringify({complete:true,attempted:checks.size,passed:[...checks.values()].filter(x=>x.passed).length,total:list.length}));
if(checks.size!==list.length||[...checks.values()].some(x=>!x.passed))process.exitCode=1;
