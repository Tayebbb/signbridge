export function withGeneration(text:string,generation:number){
  if(!Number.isSafeInteger(generation)||generation<0)throw Error("Invalid generation");
  return text.replace(/(\bgloss\s*=\s*)("|')([^"']+)\2/gu,(_,prefix:string,quote:string,id:string)=>{
    if(!/^s\d+a\d+u\d+$/u.test(id))throw Error("Manifest gloss must be lowercase without generation");return `${prefix}${quote}g${generation}_${id}${quote}`;
  });
}
export function parseGloss(id:string){const m=/^g(\d+)_s(\d+)a(\d+)u(\d+)$/u.exec(id);return m?{gen:Number(m[1]),segment:Number(m[2]),step:Number(m[3]),unit:Number(m[4])}:null;}
