/* Deterministic test engine served only by Playwright request interception. Never shipped as CWASA. */
(() => {
  const hooks=new Map();
  const fault="none";
  const emit=(type,msg)=>{for(const hook of hooks.get(type)??[])hook({msg});};
  window.CWASA={
    addHook(type,hook){hooks.set(type,[...(hooks.get(type)??[]),hook]);},
    init(){setTimeout(()=>emit("avatarready",null),30);},
    playSiGMLText(text){
      const ids=[...text.matchAll(/gloss="([^"]+)"/gu)].map(m=>m[1].toLowerCase());
      emit("animactive",null);emit("sigmlloaded",{s:ids.length,f:ids.length*10});
      ids.forEach((g,i)=>setTimeout(()=>{if(fault!=="missing"||i!==1)emit("avatarsign",{g,s:i,f:i*10});emit("avatarframe",{s:i,f:i*10});},40+i*40));
      setTimeout(()=>{emit("avatarsign",{g:ids.at(-1)??"",s:ids.length-1,f:ids.length*10});if(fault!=="silence")emit("animidle",null);},40+ids.length*40);
    },
  };
})();
