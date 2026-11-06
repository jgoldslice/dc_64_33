'use strict';
/* Canvas paper turn: visual-only DOM snapshots; live views and saved data stay untouched. */
(function(){
  const tabs=['today','week','myplan','brainstorm'];
  const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  let gesture=null,overlay=null,turning=false;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function protectedTarget(target){
    if(!(target instanceof Element))return true;
    if(target.closest('input,textarea,select,button,canvas,svg,video,a,summary,details,[contenteditable],[role="slider"],[role="tablist"],.no-swipe,.bottom-nav,.v76-notebook-ui,.v81-project-rail,[data-no-swipe]'))return true;
    for(let el=target;el&&el!==document.body;el=el.parentElement){
      const css=getComputedStyle(el);
      if((css.overflowX==='auto'||css.overflowX==='scroll')&&el.scrollWidth>el.clientWidth+8)return true;
    }
    return false;
  }
  function blocked(){
    if(document.querySelector('.modal-back.open'))return true;
    return [...document.querySelectorAll('[role="dialog"],.opening-overlay')].some(el=>!el.hidden&&el.getClientRects().length>0&&getComputedStyle(el).visibility!=='hidden');
  }
  function snapshot(view){
    const copy=view.cloneNode(true);
    copy.removeAttribute('id');
    copy.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));
    copy.classList.add('canvas-turn-snapshot');
    copy.setAttribute('aria-hidden','true');
    copy.inert=true;
    copy.style.display='block';
    copy.style.marginTop=(-window.scrollY)+'px';
    return copy;
  }
  function clear(){overlay?.remove();overlay=null;turning=false;}
  function create(from,to,direction){
    if(overlay)return;
    const layer=document.createElement('div');
    layer.className='canvas-turn-layer';
    layer.setAttribute('aria-hidden','true');
    const underneath=document.createElement('div');
    underneath.className='canvas-turn-under';
    const sheet=document.createElement('div');
    sheet.className='canvas-turn-sheet';
    const fold=document.createElement('div');
    fold.className='canvas-turn-fold';
    underneath.append(snapshot(document.getElementById(to)));
    sheet.append(snapshot(document.getElementById(from)),fold);
    layer.append(underneath,sheet);
    document.body.append(layer);
    sheet.style.transformOrigin=direction<0?'left center':'right center';
    overlay={layer,underneath,sheet,direction};
  }
  function progress(p){
    if(!overlay)return;
    const v=clamp(p,0,1);
    const angle=(overlay.direction<0?-1:1)*v*85;
    overlay.sheet.style.transform='rotateY('+angle+'deg)';
    overlay.sheet.style.opacity=String(1-Math.max(0,v-.85)*3);
    overlay.underneath.style.opacity=String(.78+.22*v);
    overlay.sheet.style.setProperty('--canvas-fold-opacity',String(.12+.5*v));
  }
  function settle(commit,to,p){
    if(!overlay){if(commit)tab(to);return;}
    turning=true;
    const duration=reduce()?0:Math.round((commit?1-p:p)*320);
    overlay.sheet.style.transition='transform '+duration+'ms cubic-bezier(.22,.7,.2,1),opacity '+duration+'ms ease';
    overlay.underneath.style.transition='opacity '+duration+'ms ease';
    progress(commit?1:0);
    const layer=overlay.layer;
    const finish=()=>{
      if(overlay?.layer!==layer)return;
      if(commit)tab(to);
      clear();
    };
    if(!duration){finish();return;}
    let finished=false;
    const once=()=>{if(finished)return;finished=true;finish();};
    overlay.sheet.addEventListener('transitionend',once,{once:true});
    // A transition can be interrupted by app backgrounding; use a bounded fallback.
    setTimeout(once,duration+90);
  }
  document.addEventListener('touchstart',e=>{
    gesture=null;
    if(turning||e.touches.length!==1||blocked()||protectedTarget(e.target)||window.getSelection()?.toString().trim())return;
    const view=document.querySelector('.view.active');
    if(!view||!tabs.includes(view.id)||!view.contains(e.target))return;
    if(view.id==='brainstorm'&&!document.getElementById('projectWorkspace')?.hidden)return;
    const touch=e.touches[0];
    if(touch.clientX<28||touch.clientX>innerWidth-28)return;
    gesture={x:touch.clientX,y:touch.clientY,id:view.id,locked:false,invalid:false,progress:0,to:null};
  },{passive:true});
  document.addEventListener('touchmove',e=>{
    if(!gesture||e.touches.length!==1)return;
    const t=e.touches[0],dx=t.clientX-gesture.x,dy=t.clientY-gesture.y;
    if(!gesture.locked){
      if(Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)*1.25){gesture.invalid=true;gesture=null;return;}
      if(Math.abs(dx)<16||Math.abs(dx)<Math.abs(dy)*1.7)return;
      const i=tabs.indexOf(gesture.id),next=i+(dx<0?1:-1);
      if(next<0||next>=tabs.length){gesture=null;return;}
      gesture.to=tabs[next];gesture.direction=dx<0?-1:1;gesture.locked=true;
      if(!reduce())create(gesture.id,gesture.to,gesture.direction);
    }
    if(!gesture)return;
    if(gesture.locked&&e.cancelable)e.preventDefault();
    gesture.progress=clamp(Math.abs(dx)/Math.max(220,innerWidth*.68),0,1);
    progress(gesture.progress);
  },{passive:false});
  document.addEventListener('touchend',e=>{
    if(!gesture)return;
    const g=gesture;gesture=null;
    if(!g.locked){clear();return;}
    const touch=e.changedTouches[0],dx=touch.clientX-g.x,dy=touch.clientY-g.y;
    const commit=Math.abs(dx)>=72&&Math.abs(dx)>Math.abs(dy)*1.7&&!blocked();
    settle(commit,g.to,g.progress);
  },{passive:true});
  document.addEventListener('touchcancel',()=>{gesture=null;settle(false,null,overlay?0.4:0);},{passive:true});
  window.addEventListener('pagehide',clear);
})();
