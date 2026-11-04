import {readFile,writeFile,readdir,mkdir} from "node:fs/promises";
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {resolve,sep} from "node:path";
const evidenceRoot=process.argv.find(arg=>arg.startsWith("--evidence-dir="))?.slice("--evidence-dir=".length)??"docs/evidence/final";
const base=resolve("docs/evidence/final"),output=resolve(evidenceRoot);if(output!==base&&!output.startsWith(base+sep))throw Error("Final evidence must stay under docs/evidence/final");
const paths=["README.md","docs/LIMITATIONS.md","docs/ATTRIBUTION.md","public/renderer.html","lib/player/rendererFrame.js"];
async function walk(dir,extension){for(const entry of await readdir(dir,{withFileTypes:true})){const path=dir+"/"+entry.name;if(entry.isDirectory()&&!path.includes(".well-known"))await walk(path,extension);else if(entry.isFile()&&path.endsWith(extension))paths.push(path);}}
await walk("app",".tsx");await walk("submission",".md");paths.sort();
const pattern="accurate|correct|translat|understand|interpreter";
const grep=execFileSync("rg",["-n","-i",pattern,...paths],{encoding:"utf8"});await mkdir(evidenceRoot,{recursive:true});
const hits=[],files=[];
for(const path of paths){const content=await readFile(path,"utf8");files.push({path,sha256:createHash("sha256").update(content).digest("hex")});for(const [index,line]of content.split(/\r?\n/u).entries())for(const match of line.matchAll(new RegExp(pattern,"gi"))){
 const token=match[0].toLowerCase(),start=match.index??0;
 let justification;
 if(path.includes("Workspace"))justification="Source-caption correction controls/state only; no claim about signing quality.";
 else if(path==="docs/ATTRIBUTION.md")justification="Attribution/limitation explicitly denies inheriting BdSL quality or comprehension from rendered corpus data.";
 else if(token.startsWith("translat"))justification="Explicitly denies treating the fixture as a translation; no accuracy claim.";
 else justification="Linguistic correctness is explicitly unevaluated, or source-caption editing is described; technical completion is kept separate.";
 hits.push({path,line:index+1,term:token,excerpt:line.slice(Math.max(0,start-80),Math.min(line.length,start+160)),decision:"JUSTIFIED",justification});
}}
const grouped=[...new Set(hits.map(h=>h.path))].map(path=>({path,hits:hits.filter(h=>h.path===path).length,terms:[...new Set(hits.filter(h=>h.path===path).map(h=>h.term))],justifications:[...new Set(hits.filter(h=>h.path===path).map(h=>h.justification))]}));
const audit={date:new Date().toISOString(),command:"rg -n -i 'accurate|correct|translat|understand|interpreter' over listed public copy and submission Markdown",status:"PENDING MANUAL REVIEW",files,hits,grouped,unresolved:0,grepSha256:createHash("sha256").update(grep).digest("hex")};
await writeFile(`${evidenceRoot}/claims-audit.json`,JSON.stringify(audit,null,2)+"\n");
console.log(JSON.stringify({files:paths.length,totalHits:hits.length,groups:grouped,excerpts:hits.map(h=>({path:h.path,line:h.line,term:h.term,excerpt:h.excerpt}))},null,2));
