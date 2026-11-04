/** Deliver only the requested range while preserving upstream streaming and cancellation. */
export function selectBytes(source:ReadableStream<Uint8Array>,start:number,end:number){
 const reader=source.getReader();let offset=0,finished=false;
 return new ReadableStream<Uint8Array>({
  async pull(controller){try{for(;;){const {done,value}=await reader.read();if(done){finished=true;controller.close();return;}const from=Math.max(0,start-offset),to=Math.min(value.length,end+1-offset);offset+=value.length;if(to>from)controller.enqueue(value.slice(from,to));if(offset>end){finished=true;controller.close();await reader.cancel();return;}if(to>from)return;}}catch(error){finished=true;controller.error(error);await reader.cancel().catch(()=>{});}},
  async cancel(){if(!finished){finished=true;await reader.cancel();}},
 });
}
export function byteRange(value:string|null,size:number){if(!value)return {start:0,end:size-1,partial:false};const match=/^bytes=(\d*)-(\d*)$/u.exec(value);if(!match||!match[1]&&!match[2])return null;const start=match[1]?Number(match[1]):Math.max(0,size-Number(match[2])),end=match[1]&&match[2]?Math.min(Number(match[2]),size-1):size-1;if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=size||end<start)return null;return {start,end,partial:true};}
