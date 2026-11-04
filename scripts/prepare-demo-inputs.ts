// Original synthetic source media for technical demonstrations; no model, account or secret.
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {existsSync} from "node:fs";
import {resolve,join} from "node:path";
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {chromium} from "@playwright/test";
import {buildSigml} from "../lib/domain/sigmlBuilder";
import type {CorpusImport} from "./corpus-import";
const words=["বই","হাত","দুধ","খাবার","মানুষ","কলম"];
const common=[...new Set([...words,"পানি","মাছ","ফুল","গাছ","বৃষ্টি","সূর্য"])];
const root=resolve("demo-input"),frames=resolve(".data/demo-source-frames"),evidence=resolve("docs/evidence/phase-7");
function command(executable:string,args:string[]){const result=spawnSync(executable,args,{encoding:"utf8",windowsHide:true});if(result.status!==0)throw Error(`${executable} failed: ${result.stderr?.slice(-800)}`);return result.stdout;}
function timestamp(ms:number){return `${String(Math.floor(ms/3600000)).padStart(2,"0")}:${String(Math.floor(ms/60000)%60).padStart(2,"0")}:${String(Math.floor(ms/1000)%60).padStart(2,"0")},${String(ms%1000).padStart(3,"0")}`;}
const hash=(bytes:Uint8Array)=>createHash("sha256").update(bytes).digest("hex");
for(const file of ["sample-a.mp4","sample-a.srt","unsupported-b.mp4","unsupported-b.srt","demo.json"]){if(existsSync(join(root,file)))throw Error("Demo inputs already exist; preserve them or choose another output directory before regenerating");}
await Promise.all([mkdir(root,{recursive:true}),mkdir(frames,{recursive:true}),mkdir(evidence,{recursive:true})]);
command("ffmpeg",["-version"]);command("ffprobe",["-version"]);
const corpus=JSON.parse(await readFile("data/corpus/assets.json","utf8")) as CorpusImport;
const selected=common.map(word=>{const asset=corpus.assets.filter(a=>a.labelBn===word).sort((a,b)=>a.id.localeCompare(b.id))[0];if(!asset)throw Error("A source label is unavailable under the fixed XML policy");return asset;});
const probe=selected.map(a=>({assetId:a.id,labelBn:a.labelBn,derivedSha256:a.derivedSha256,unitCount:a.unitCount,xml:buildSigml(0,[{stepIdx:0,derivedSigml:a.derivedSigml,unitCount:a.unitCount}]).text}));
await writeFile(join(root,"curated-probe.json"),JSON.stringify(probe,null,2)+"\n");
await writeFile(join(evidence,"curated-selection.json"),JSON.stringify({purpose:"Synthetic source-label demo plus common words; technical rendering only",selection:"First accepted asset by lexical ID for each exact corpus label; no alias or motion changes",sourceManifestSha256:corpus.release.manifestSha256,assetIds:selected.map(a=>a.id),labels:common,intentionallyUncovered:"নেই (negation)",linguisticReview:"none"},null,2)+"\n");
const edge=existsSync("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe")||existsSync("C:/Program Files/Microsoft/Edge/Application/msedge.exe");
const browser=await chromium.launch({headless:true,...(edge?{channel:"msedge"}:{})});
const clips=[];
try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  for(const [id,labels] of [["sample-a",words],["unsupported-b",["দুধ","দুধ নেই"]]] as const){
    const images:string[]=[];
    for(const [i,label] of labels.entries()){
      // All text is a fixed source literal from this file; no supplied HTML or model content.
      await page.setContent(`<!doctype html><html lang="bn"><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#f7f8f4;color:#172e2a;font:28px Arial,sans-serif;height:720px;padding:64px 80px;display:flex;flex-direction:column}header,footer{font-size:22px}main{flex:1;display:grid;place-items:center;text-align:center}h1{font:100px "Nirmala UI",Arial,sans-serif;margin:0}.shape{width:120px;height:8px;background:#cc642a;margin:36px auto}footer{display:flex;justify-content:space-between;border-top:1px solid #ced7cf;padding-top:22px}</style><header>SignBridge · synthetic source clip</header><main><div><h1>${label}</h1><div class="shape"></div></div></main><footer><span>Original text-card fixture · silent</span><span>${i+1} / ${labels.length}</span></footer></html>`);
      await page.evaluate(()=>document.fonts.ready);const path=join(frames,`${id}-${i}.png`);await page.screenshot({path});images.push(path);
    }
    const concat=images.map(path=>`file '${path.replaceAll("\\","/")}'\noption framerate 24\nduration 7.5`).join("\n")+`\nfile '${images.at(-1)!.replaceAll("\\","/")}'\noption framerate 24\n`,list=join(frames,`${id}.txt`),video=join(root,`${id}.mp4`);
    await writeFile(list,concat);const durationMs=labels.length*7500;
    command("ffmpeg",["-hide_banner","-loglevel","error","-f","concat","-safe","0","-i",list,"-vf",`fps=24,tpad=stop_mode=clone:stop_duration=${durationMs/1000}`,"-frames:v",String(durationMs/1000*24),"-c:v","libx264","-threads","2","-preset","fast","-crf","24","-pix_fmt","yuv420p","-movflags","+faststart",video]);
    const metadata=JSON.parse(command("ffprobe",["-v","error","-show_entries","format=duration:stream=width,height","-of","json",video])) as {format:{duration:string};streams:{width:number;height:number}[]};
    if(Math.round(Number(metadata.format.duration)*1000)!==durationMs||metadata.streams[0].width!==1280||metadata.streams[0].height!==720)throw Error("Generated clip metadata mismatch");
    await writeFile(join(root,`${id}.srt`),labels.map((label,i)=>`${i+1}\n${timestamp(i*7500)} --> ${timestamp((i+1)*7500)}\n${label}।\n`).join("\n"));
    const bytes=await readFile(video);if(bytes.length>15728640)throw Error("Generated video exceeds the upload limit");
    clips.push({id,title:id==="sample-a"?"Synthetic source-label demo":"Synthetic unsupported-negation demo",video:`${id}.mp4`,captions:`${id}.srt`,durationMs,width:1280,height:720,expectUnsupported:id==="unsupported-b",sizeBytes:bytes.length,sha256:hash(bytes)});
  }
}finally{await browser.close();}
await writeFile(join(root,"demo.json"),JSON.stringify({rightsAttested:true,clips:clips.map(({sizeBytes,sha256,...clip})=>{void sizeBytes;void sha256;return clip;})},null,2)+"\n");
const provenance={createdAt:new Date().toISOString(),source:"Original project-generated text cards; no external footage, people, voices, music or signer performance",license:"CC0-1.0 for these generated source clips and captions",limitation:"Synthetic technical fixtures, not a linguistic evaluation or production-model result",clips};
await writeFile(join(root,"PROVENANCE.json"),JSON.stringify(provenance,null,2)+"\n");await writeFile(join(evidence,"demo-inputs.json"),JSON.stringify(provenance,null,2)+"\n");
console.log(JSON.stringify({mode:"FREE original synthetic inputs",clips:clips.map(c=>({id:c.id,durationMs:c.durationMs,bytes:c.sizeBytes,sha256:c.sha256})),curatedAssets:selected.length,modelCalls:0}));
