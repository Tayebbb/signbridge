// Technical renderability only. Remote UEA code stays unmodified; no linguistic review.
(async()=>{
 const {chromium}=await import('@playwright/test');
 const fs=await import('node:fs/promises');
 const syncFs=await import('node:fs');
 const http=await import('node:http');
 const {randomUUID}=await import('node:crypto');
 const list=JSON.parse(await fs.readFile(process.argv[2]||'data/corpus/sample-probe.json','utf8'));
 const checkedAt=new Date().toISOString();
 const html=await fs.readFile('public/renderer.html');
 const wrapper=await fs.readFile('lib/player/rendererFrame.js');
 const csp="default-src 'none'; script-src 'self' https://vhg.cmp.uea.ac.uk; script-src-attr 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://vhg.cmp.uea.ac.uk; connect-src 'self' https://vhg.cmp.uea.ac.uk; img-src https://vhg.cmp.uea.ac.uk blob: data:; worker-src blob:; frame-ancestors 'self'";
 const server=http.createServer((req,res)=>{
  if(req.url.startsWith('/renderer.html')){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':csp});res.end(html);}
  else if(req.url==='/renderer-frame.js'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});res.end(wrapper);}
  else{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<!doctype html><html lang="en"><meta charset="utf-8"><title>Technical corpus probe</title><body><p>Experimental · not reviewed by a BdSL signer. Technical renderability only.</p></body></html>');}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${server.address().port}`;
 const edge=process.platform==='win32'&&(syncFs.existsSync('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe')||syncFs.existsSync('C:/Program Files/Microsoft/Edge/Application/msedge.exe'));
 const browser=await chromium.launch({...(edge?{channel:'msedge'}:{}),headless:true,args:['--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1100,height:800}}),checks=[],errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 let gen=0;
 const reset=async()=>{
  gen=0;const instanceId=randomUUID();
  await page.goto(origin);
  await page.evaluate(({instanceId,origin})=>{
   window.probe={instanceId,events:[]};const frame=document.createElement('iframe');frame.sandbox='allow-scripts';frame.width='820';frame.height='600';
   addEventListener('message',e=>{if(e.source===frame.contentWindow&&e.data?.instanceId===instanceId)window.probe.events.push(e.data);});
   frame.src=`/renderer.html?instanceId=${instanceId}&parentOrigin=${encodeURIComponent(origin)}`;document.body.append(frame);
  },{instanceId,origin});
  await page.waitForFunction(()=>window.probe.events.some(e=>e.type==='avatarready'),null,{timeout:60000});
 };
 await fs.mkdir('docs/evidence/phase-2',{recursive:true});
 try{
  await reset();
  for(let i=0;i<list.length;i++){
   const item=list[i],started=Date.now();gen++;
   const xml=item.xml.replace(/(\bgloss\s*=\s*)("|')(s\d+a\d+u\d+)\2/g,(_,prefix,quote,id)=>`${prefix}${quote}g${gen}_${id}${quote}`);
   const expected=[...xml.matchAll(/\bgloss\s*=\s*("|')([^"']+)\1/g)].map(m=>m[2]);
   await page.evaluate(({xml,gen})=>{window.probe.events=[];document.querySelector('iframe').contentWindow.postMessage({instanceId:window.probe.instanceId,type:'play',gen,sigml:xml},'*');},{xml,gen});
   let timedOut=false;
   try{await page.waitForFunction(()=>{const e=window.probe.events;return e.some(x=>x.type==='animactive')&&e.some(x=>x.type==='avatarframe')&&e.some(x=>x.type==='animidle');},null,{timeout:35000});}catch{timedOut=true;}
   const events=await page.evaluate(()=>window.probe.events);
   const loaded=events.find(e=>e.type==='sigmlloaded')?.payload;
   const observed=[];for(const e of events.filter(e=>e.type==='avatarsign')){const id=e.payload.g;if(id&&observed.at(-1)!==id)observed.push(id);}
   const frameEvents=events.filter(e=>e.type==='avatarframe').length;
   const passed=!timedOut&&loaded?.s===item.unitCount&&loaded?.f>0&&frameEvents>0&&JSON.stringify(observed)===JSON.stringify(expected)&&!events.some(e=>e.type==='cspviolation');
   const check={assetId:item.assetId,labelBn:item.labelBn,derivedSha256:item.derivedSha256,rendererProfile:'cwasa-vhg2026/anna/speed0',checkedAt,passed,timedOut,signs:loaded?.s??0,frames:loaded?.f??0,frameEvents,elapsedMs:Date.now()-started,expectedIds:expected,observedIds:observed};checks.push(check);
   if(i===0||i===list.length-1)await page.screenshot({path:`docs/evidence/phase-2/corpus-${i+1}.png`});
   await fs.writeFile('docs/evidence/phase-2/asset-render-checks.json',JSON.stringify({checkedAt,renderer:'cwasa-vhg2026/anna/speed0',browser:edge?'msedge':'chromium',environment:{platform:process.platform,headless:true,webgl:'SwiftShader'},limitation:'Technical rendering only; no linguistic review or comprehension evidence.',passed:checks.filter(c=>c.passed).length,attempted:checks.length,browserErrors:errors,asset_render_checks:checks},null,2)+'\n');
   console.log(JSON.stringify({item:i+1,assetId:item.assetId,passed,signs:check.signs,frames:check.frames}));
   if(!passed&&i<list.length-1)await reset();
  }
 }finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
 if(checks.length!==list.length||checks.some(c=>!c.passed))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
