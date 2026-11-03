import {validateCues,type Cue} from "./captions/shared";
import {segmentCues,type Segment} from "./segmentation";
import {sourceForm} from "./captions/textForms";
export interface CueRange {cueFrom:number;cueTo:number}
export function materializeSegments(cues:readonly Cue[],layout?:readonly CueRange[]):Segment[]{
  if(!layout)return segmentCues(cues);
  if(!layout.length||layout.length>20)throw Error("Invalid segment layout");
  let next=0;
  const result=layout.map((range,idx)=>{
    if(!Number.isInteger(range.cueFrom)||!Number.isInteger(range.cueTo)||range.cueFrom!==next||range.cueTo<next||range.cueTo>=cues.length)throw Error("Invalid cue partition");
    next=range.cueTo+1;const group=cues.slice(range.cueFrom,next);
    return {idx,...range,startMs:group[0].startMs,endMs:group.at(-1)!.endMs,sourceText:sourceForm(group.map(c=>c.text).join(" "))};
  });
  if(next!==cues.length)throw Error("Unbound cues");return result;
}
export function editTranscript(cues:readonly Cue[],segments:readonly Segment[],operation:{edits?:{segmentIdx:number;text?:string;startMs?:number;endMs?:number}[];merge?:number[];split?:{segmentIdx:number;atCueIdx:number}}){
  let next=cues.map(c=>({...c})),layout:CueRange[]=segments.map(s=>({cueFrom:s.cueFrom,cueTo:s.cueTo}));
  if(operation.merge){const [a,b]=operation.merge;if(b!==a+1||!layout[a]||!layout[b])throw Error("Merge requires adjacent segments");layout.splice(a,2,{cueFrom:layout[a].cueFrom,cueTo:layout[b].cueTo});}
  else if(operation.split){const {segmentIdx:i,atCueIdx:c}=operation.split,s=layout[i];if(!s||c<=s.cueFrom||c>s.cueTo)throw Error("Split requires an interior cue boundary");layout.splice(i,1,{cueFrom:s.cueFrom,cueTo:c-1},{cueFrom:c,cueTo:s.cueTo});}
  else if(operation.edits){
    const edits=new Map(operation.edits.map(e=>[e.segmentIdx,e]));if(edits.size!==operation.edits.length||[...edits.keys()].some(i=>!segments[i]))throw Error("Invalid edit index");
    next=[];layout=[];
    for(const s of segments){const e=edits.get(s.idx),from=next.length;
      const group=e?.text!==undefined?[{idx:from,text:e.text,startMs:e.startMs??s.startMs,endMs:e.endMs??s.endMs}]:cues.slice(s.cueFrom,s.cueTo+1).map(c=>({...c}));
      if(e?.text===undefined&&e){group[0].startMs=e.startMs??group[0].startMs;group.at(-1)!.endMs=e.endMs??group.at(-1)!.endMs;}
      next.push(...group);layout.push({cueFrom:from,cueTo:next.length-1});
    }
  }else throw Error("No transcript operation");
  const validated=validateCues(next,next.map((_,i)=>i+1));materializeSegments(validated,layout);return {cues:validated,layout};
}
