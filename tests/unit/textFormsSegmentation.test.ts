import {test,expect} from "vitest";
import {sourceForm,phraseForm,retrievalForm} from "@/lib/domain/captions/textForms";
import {segmentCues,contextWindow} from "@/lib/domain/segmentation";
test("src-v1 NFC, caption markup, whitespace, U+09F7 and meaningful punctuation",()=>{
  expect(sourceForm(" <b> সে </b>\n  আসবে?  না ২৷ ")).toBe("সে আসবে? না ২।");
  expect(sourceForm("e\u0301")).toBe("é");
  expect(sourceForm("আ\u200dম")).toContain("\u200d");
});
test("phraseForm removes just one trailing period/danda and joiners",()=>{
  expect(phraseForm("আ\u200dম।")).toBe("আম"); expect(phraseForm("আম..")).toBe("আম.");
  expect(phraseForm("আম?!")).toBe("আম?!"); expect(phraseForm("সে আসবে।")).not.toBe(phraseForm("সে আসবে?"));
});
test("retrieval deliberately conflates inflections, folds digits and Latin, but exact/source do not",()=>{
  expect(retrievalForm("আমি কিনেছি")).toBe(retrievalForm("আমি কিনিনি"));
  expect(retrievalForm("A ১২!")).toBe("a 12");
  expect(retrievalForm("ড় ঢ় য়")).toBe(retrievalForm("ড় ঢ় য়"));
});
test("segmenter minimum duration, terminators and original cue bounds are deterministic",()=>{
  const cues=[{idx:0,startMs:0,endMs:500,text:"প্রথম।"},{idx:1,startMs:500,endMs:1600,text:"দ্বিতীয়?"},{idx:2,startMs:2000,endMs:4000,text:"শেষ!"}];
  const copy=structuredClone(cues),result=segmentCues(cues);
  expect(result.map(s=>[s.cueFrom,s.cueTo,s.startMs,s.endMs,s.sourceText])).toEqual([[0,1,0,1600,"প্রথম। দ্বিতীয়?"],[2,2,2000,4000,"শেষ!"]]);
  expect(segmentCues(cues)).toEqual(result);expect(cues).toEqual(copy);
});
test("segmenter bounds long runs without splitting cues; oversize singleton is preserved",()=>{
  const cues=Array.from({length:4},(_,idx)=>({idx,startMs:idx*4000,endMs:(idx+1)*4000,text:"শব্দ"}));
  expect(segmentCues(cues).map(s=>[s.cueFrom,s.cueTo])).toEqual([[0,2],[3,3]]);
  const long={idx:0,startMs:0,endMs:15000,text:Array(30).fill("শব্দ").join(" ")};
  expect(segmentCues([long])).toEqual([{idx:0,startMs:0,endMs:15000,cueFrom:0,cueTo:0,sourceText:long.text}]);
  expect(segmentCues([{...long,endMs:1000,text:Array(20).fill("শব্দ").join(" ")},{idx:1,startMs:1000,endMs:2000,text:Array(6).fill("শব্দ").join(" ")}])).toHaveLength(2);
});
test("context is two previous and one next source texts plus title; no outputs or positions",()=>{
  const segments=Array.from({length:6},(_,idx)=>({idx,startMs:idx,endMs:idx+1,cueFrom:idx,cueTo:idx,sourceText:String(idx)}));
  expect(contextWindow(segments,3," <b>Title</b> ")).toEqual({before:["1","2"],after:["4"],title:"Title"});
  expect(contextWindow(segments,0,"")).toEqual({before:[],after:["1"],title:""});
  expect(()=>contextWindow(segments,6,"")).toThrow();
});
