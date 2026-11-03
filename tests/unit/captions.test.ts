import {test,expect} from "vitest";
import {parseSrt} from "@/lib/domain/captions/parseSrt";
import {parseVtt} from "@/lib/domain/captions/parseVtt";
import {parsePasted} from "@/lib/domain/captions/parsePasted";
import {CaptionError} from "@/lib/domain/captions/shared";
const srt=(text:string,start="00:00:00,000",end="00:00:02,000")=>`1\n${start} --> ${end}\n${text}\n`;
test("SRT: CRLF/BOM, multiline formatting and punctuation preserve source meaning",()=>{
  expect(parseSrt("\ufeff"+srt("<b>সে</b>\n আসবে?").replaceAll("\n","\r\n"))).toEqual([{idx:0,startMs:0,endMs:2000,text:"সে আসবে?"}]);
});
test("VTT: header, identifier, NOTE/STYLE and cue settings are isolated from text",()=>{
  const input="WEBVTT\n\nNOTE ignored\nnot a cue\n\nSTYLE\n::cue {color:red}\n\nintro\n00:00.000 --> 00:02.000 align:start\n<v Speaker><c.green>না</c>!</v>\n";
  expect(parseVtt(input)).toEqual([{idx:0,startMs:0,endMs:2000,text:"না!"}]);
});
test("Pasted: next cue closes previous and supplied duration closes final",()=>{
  expect(parsePasted("[00:01.250] প্রথম।\n[00:03.000] দ্বিতীয়?",5000)).toEqual([{idx:0,startMs:1250,endMs:3000,text:"প্রথম।"},{idx:1,startMs:3000,endMs:5000,text:"দ্বিতীয়?"}]);
});
test("T12: script markup is literal text, never interpreted by a parser",()=>{
  const payload='<script>alert("x")</script>';
  expect(parseSrt(srt(payload))[0].text).toBe(payload);
  expect(parseVtt(`WEBVTT\n\n00:00.000 --> 00:01.000\n${payload}`)[0].text).toBe(payload);
  expect(parsePasted(`[00:00.000] ${payload}`,1000)[0].text).toBe(payload);
});
test.each([parseSrt,parseVtt,parsePasted])("T12: 10 MB payload rejected before line parsing",parse=>{
  expect(()=>parse("x".repeat(10*1024*1024))).toThrowError(expect.objectContaining({code:"caption_too_large",line:1}));
});
test("Caption byte limit counts UTF-8 rather than JavaScript characters",()=>{expect(()=>parseSrt(srt("ক".repeat(23_000)))).toThrowError(expect.objectContaining({code:"caption_too_large"}));});
test("T12: 1,000 SRT cues rejected with cue and line diagnostics",()=>{
  const input=Array.from({length:1000},(_,i)=>`${i+1}\n00:00:00,000 --> 00:00:00,001\na\n`).join("\n");
  expect(()=>parseSrt(input)).toThrowError(expect.objectContaining({code:"too_many_cues",cue:300,line:1201}));
});
test("T12: VTT and pasted reject 1,000 cues",()=>{
  expect(()=>parseVtt("WEBVTT\n\n"+Array.from({length:1000},()=>"00:00.000 --> 00:00.001\na\n").join("\n"))).toThrowError(expect.objectContaining({code:"too_many_cues"}));
  expect(()=>parsePasted(Array.from({length:1000},()=>"[00:00.000] a").join("\n"))).toThrowError(expect.objectContaining({code:"too_many_cues"}));
});
test("300 cues and exactly 90 seconds are accepted",()=>{
  expect(parseSrt(Array.from({length:300},(_,i)=>`${i+1}\n00:00:00,000 --> 00:01:30,000\na\n`).join("\n"))).toHaveLength(300);
});
test.each([
  [srt("a","00:00:60,000"),"invalid_timestamp"], [srt("a","00:00:02,000","00:00:01,000"),"invalid_cue"],
  [srt("a","00:00,000"),"invalid_timestamp"],
  [srt("a","00:00:00,000","00:01:30,001"),"caption_duration_exceeded"], [srt("<b> </b>"),"invalid_cue"], ["","empty_caption"],
])("Parser error carries precise code: %s",(input,code)=>{try{parseSrt(input);throw new Error("Expected rejection");}catch(error){expect(error).toBeInstanceOf(CaptionError);expect(error).toMatchObject({code});expect((error as CaptionError).line).toBeGreaterThan(0);}});
test("Malformed VTT and pasted formats report a source line",()=>{
  expect(()=>parseVtt("not WEBVTT")).toThrowError(expect.objectContaining({line:1,code:"invalid_cue"}));
  expect(()=>parsePasted("[00:00.000] a\nbad",1000)).toThrowError(expect.objectContaining({line:2,cue:1,code:"invalid_cue"}));
  expect(()=>parsePasted("[00:01.000] a\n[00:00.500] b",2000)).toThrowError(expect.objectContaining({code:"invalid_cue"}));
});
