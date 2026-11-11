'use strict';
/* Blueprint v9.4 — direct, finger-following navigation.
   One gesture owner: nested scrollers, buttons and Notes are excluded at
   touchstart and NEVER transfer control to tab navigation mid-gesture.
   Existing live views are moved, not cloned or remounted. */
(function(){
  const tabs=['today','week','myplan','brainstorm'];
  const main=document.querySelector('.shell main');
  if(!main)return;
  const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  const debug=window.__blueprintMotionDebug={
    prepares:0,snapshots:0,lastPrepareMs:0,lastSettleMs:0,interruptions:0,
    owner:null,liveTranslation:0
  };
  let gesture=null,motion=null,frame=0;
  const owners='.v817-date-scroller,#todayHabits,'+
    '#v815ZoomViewport,.v76-notebook-ui,.v81-project-rail,'+
    '.week-table,[data-no-swipe],.bottom-nav,'+
    'input,textarea,select,button,canvas,video,a,summary,details,'+
    '[contenteditable],[role="slider"],[role="tablist"],[role="textbox"]';
  function protectedTarget(target){
    if(!(target instanceof Element)||target.closest(owners))return true;
    for(let n=target;n&&n!==main;n=n.parentElement){
      if(!(n instanceof HTMLElement))continue;
      const style=getComputedStyle(n);
      if((style.overflowX==='auto'||style.overflowX==='scroll')&&
        n.scrollWidth>n.clientWidth+8)return true;
    }
    return false;
  }
  function overlayOpen(){
    if(document.querySelector('.modal-back.open'))return true;
    return [...document.querySelectorAll('[role="dialog"],.opening-overlay')]
      .some(el=>!el.hidden&&el.getClientRects().length&&
        getComputedStyle(el).visibility!=='hidden');
  }
  function cancelFrame(){
    if(frame){cancelAnimationFrame(frame);frame=0;}
  }
  function cleanup(){
    cancelFrame();
    const m=motion;motion=null;
    if(!m)return;
    if(m.timer)clearTimeout(m.timer);
    if(m.listener)m.source.removeEventListener('transitionend',m.listener);
    for(const [node,original] of [[m.source,m.sourceStyle],[m.target,m.targetStyle]]){
      node.classList.remove('v94-live-pane','v94-live-source','v94-live-target');
      node.style.cssText=original;
    }
    m.parent.style.minHeight=m.parentMinHeight;
    m.target.inert=m.targetInert;
    if(m.targetAria===null)m.target.removeAttribute('aria-hidden');
    else m.target.setAttribute('aria-hidden',m.targetAria);
    document.body.classList.remove('v94-sliding-tabs');
    debug.liveTranslation=0;
  }
  function finish(commit){
    if(!motion)return;
    const dest=motion.to;
    cleanup();
    if(commit)tab(dest);
  }
  function prepare(from,to,direction){
    if(motion)return;
    const start=performance.now();
    const source=document.getElementById(from),target=document.getElementById(to);
    if(!source||!target)return;
    const rect=source.getBoundingClientRect(),parent=source.parentElement;
    const parentMinHeight=parent.style.minHeight;
    parent.style.minHeight=Math.ceil(Math.max(parent.getBoundingClientRect().height,
      source.offsetHeight))+'px';
    const current={
      source,target,to,direction,width:rect.width,parent,parentMinHeight,
      sourceStyle:source.style.cssText,targetStyle:target.style.cssText,
      targetInert:target.inert,targetAria:target.getAttribute('aria-hidden'),
      timer:0,listener:null,commit:false,progress:0
    };
    for(const node of [source,target]){
      node.style.setProperty('--v94-left',rect.left+'px');
      node.style.setProperty('--v94-top',rect.top+'px');
      node.style.setProperty('--v94-width',rect.width+'px');
      node.style.setProperty('--v94-height',Math.max(rect.height,innerHeight-rect.top)+'px');
      node.classList.add('v94-live-pane');
    }
    source.classList.add('v94-live-source');
    target.classList.add('v94-live-target');
    target.inert=true;
    target.setAttribute('aria-hidden','true');
    document.body.classList.add('v94-sliding-tabs');
    motion=current;
    debug.prepares++;
    debug.lastPrepareMs=performance.now()-start;
    paint(0);
  }
  function paint(px){
    if(!motion)return;
    const m=motion;
    const travel=clamp(px*m.direction,0,m.width)*m.direction;
    m.progress=Math.abs(travel)/m.width;
    m.source.style.transform='translate3d('+travel+'px,0,0)';
    m.target.style.transform='translate3d('+(travel-m.direction*m.width)+'px,0,0)';
    debug.liveTranslation=travel;
  }
  function paintSoon(px){
    if(!motion)return;
    motion.nextPixels=px;
    if(frame)return;
    frame=requestAnimationFrame(()=>{frame=0;if(motion)paint(motion.nextPixels);});
  }
  function settle(commit,velocity){
    if(!motion)return;
    cancelFrame();
    const m=motion,position=m.progress;
    const remaining=commit?1-position:position;
    const duration=reduced()?0:Math.round(clamp(
      70+remaining*165/(1+Math.min(Math.abs(velocity),1)),70,235));
    debug.lastSettleMs=duration;
    m.commit=commit;
    if(!duration){finish(commit);return;}
    const transition='transform '+duration+'ms cubic-bezier(.22,.8,.26,1)';
    for(const node of [m.source,m.target])node.style.transition=transition;
    // Force the browser to establish the current position before settling.
    void m.source.offsetWidth;
    paint(commit?m.direction*m.width:0);
    let finished=false;
    const complete=()=>{if(finished||motion!==m)return;finished=true;finish(commit);};
    m.listener=e=>{if(e.target===m.source&&e.propertyName==='transform')complete();};
    m.source.addEventListener('transitionend',m.listener);
    m.timer=setTimeout(complete,duration+75);
  }
  function interrupt(){
    if(!motion)return;
    debug.interruptions++;
    finish(motion.commit===true);
  }
  main.addEventListener('touchstart',e=>{
    interrupt();
    gesture=null;debug.owner=null;
    if(e.touches.length!==1||overlayOpen()||protectedTarget(e.target)||
      window.getSelection()?.toString().trim())return;
    const active=document.querySelector('.view.active');
    if(!active||!tabs.includes(active.id)||!active.contains(e.target))return;
    // Project Notes are never allowed to initiate main tab navigation.
    if(active.id==='brainstorm'&&!document.getElementById('projectWorkspace')?.hidden)return;
    const touch=e.touches[0];
    if(touch.touchType==='stylus'||touch.clientX<28||
      touch.clientX>innerWidth-28)return;
    gesture={id:touch.identifier,from:active.id,x:touch.clientX,y:touch.clientY,
      direction:0,to:null,locked:false,vertical:false,
      points:[{x:touch.clientX,t:performance.now()}]};
  },{passive:true});
  main.addEventListener('touchmove',e=>{
    const g=gesture;
    if(!g||e.touches.length!==1||e.touches[0].identifier!==g.id)return;
    const touch=e.touches[0],dx=touch.clientX-g.x,dy=touch.clientY-g.y;
    const now=performance.now();
    g.points.push({x:touch.clientX,t:now});
    g.points=g.points.filter(p=>now-p.t<140).slice(-10);
    if(!g.locked){
      if(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)*1.2){
        g.vertical=true;gesture=null;return;
      }
      if(Math.abs(dx)<10||Math.abs(dx)<Math.abs(dy)*1.3)return;
      const direction=dx<0?-1:1;
      const next=tabs.indexOf(g.from)+(direction<0?1:-1);
      if(next<0||next>=tabs.length){gesture=null;return;}
      g.locked=true;g.direction=direction;g.to=tabs[next];
      debug.owner='tabs';
      if(!reduced())prepare(g.from,g.to,direction);
    }
    if(e.cancelable)e.preventDefault();
    if(motion)paintSoon(dx);
  },{passive:false});
  main.addEventListener('touchend',e=>{
    if(!gesture)return;
    const g=gesture;gesture=null;debug.owner=null;
    if(!g.locked||e.changedTouches.length!==1||
      e.changedTouches[0].identifier!==g.id||overlayOpen()){
      if(motion)settle(false,0);
      return;
    }
    const touch=e.changedTouches[0],dx=touch.clientX-g.x,dy=touch.clientY-g.y;
    const now=performance.now();
    const sample=g.points.find(p=>now-p.t>=12);
    const dt=sample?now-sample.t:0;
    const velocity=dt?(touch.clientX-sample.x)*g.direction/dt:0;
    const distance=dx*g.direction;
    const threshold=Math.min(95,Math.max(70,innerWidth*.21));
    const commit=(distance>=threshold||(distance>=36&&velocity>=.5))&&
      Math.abs(dx)>Math.abs(dy)*1.3;
    if(reduced()){if(commit)tab(g.to);return;}
    if(motion)settle(commit,velocity);
  },{passive:true});
  main.addEventListener('touchcancel',()=>{
    gesture=null;debug.owner=null;if(motion)settle(false,0);
  },{passive:true});
  document.querySelector('.bottom-nav')?.addEventListener('pointerdown',()=>{
    gesture=null;if(motion)cleanup();
  },true);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){gesture=null;if(motion)finish(motion.commit);}
  });
  window.addEventListener('pagehide',()=>{gesture=null;if(motion)finish(motion.commit);});
  window.addEventListener('resize',()=>{gesture=null;if(motion)cleanup();},{passive:true});
})();
