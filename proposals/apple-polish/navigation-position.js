/**
 * DRAFT, NOT IMPORTED. Persist navigation position per top-level tab without
 * adding more tabs or scroll-restoration dependencies.
 */
export function createTabPositionMemory({
  getY=()=>window.scrollY,
  scroll=(y)=>window.scrollTo({top:y,behavior:'instant'}),
  raf=(fn)=>requestAnimationFrame(fn)
}={}) {
  const positions=new Map();
  const state={active:'today'};
  const valid=new Set(['today','week','myplan','brainstorm']);
  function snapshot(){
    if(valid.has(state.active))positions.set(state.active,Math.max(0,getY()));
  }
  function switchTo(next,{render,restore=true}={}){
    if(!valid.has(next))return false;
    if(next===state.active)return true;
    snapshot();
    state.active=next;
    if(typeof render==='function')render(next);
    raf(()=>scroll(restore?(positions.get(next)||0):0));
    return true;
  }
  function reset(tab){if(valid.has(tab))positions.delete(tab);}
  return {
    switchTo,
    snapshot,
    reset,
    getCurrent:()=>state.active,
    getScrollPosition:(tab)=>positions.get(tab)||0
  };
}
