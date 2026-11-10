'use strict';
/* Blueprint v9.1 · Iteration 1.
   Gesture-driven navigation operates on the two EXISTING tab views. It never
   deep-clones a view, so project/Notes DOM, listeners and user data stay intact.
   A gesture is provisional until release; a cancelled drag changes no tabs. */
(function(){
  const tabs=['today','week','myplan','brainstorm'];
  const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const debug=window.__blueprintMotionDebug={
    snapshots:0,prepares:0,lastPrepareMs:0,lastSettleMs:0,interruptions:0
  };
  let gesture=null,motion=null,turning=false,frame=0;
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
    return [...document.querySelectorAll('[role="dialog"],.opening-overlay')]
      .some(el=>!el.hidden&&el.getClientRects().length>0&&getComputedStyle(el).visibility!=='hidden');
  }
  function cleanup(){
    if(frame){cancelAnimationFrame(frame);frame=0;}
    if(!motion){turning=false;return;}
    if(motion.timer)clearTimeout(motion.timer);
    if(motion.onTransitionEnd)motion.source.removeEventListener('transitionend',motion.onTransitionEnd);
    const m=motion;motion=null;turning=false;
    for(const [view,original] of [[m.source,m.fromCSS],[m.target,m.toCSS]]){
      view.classList.remove('canvas-v91-pane','canvas-v91-source','canvas-v91-target','canvas-v91-settling');
      view.style.cssText=original;
    }
    if(m.parent)m.parent.style.minHeight=m.parentMinHeight;
    m.target.inert=m.targetInert;
    if(m.targetAria===null)m.target.removeAttribute('aria-hidden');
    else m.target.setAttribute('aria-hidden',m.targetAria);
    document.body.classList.remove('canvas-v91-motion-active');
  }
  function finish(commit){
    if(!motion)return;
    const destination=motion.to;
    cleanup();
    if(commit)tab(destination);
  }
  function prepare(from,to,direction){
    if(motion)return;
    const source=document.getElementById(from),target=document.getElementById(to);
    if(!source||!target)return;
    const start=performance.now();
    const rect=source.getBoundingClientRect();
    // Taking the active view out of flow must not collapse the document and
    // silently move its scroll position during a drag.
    const parent=source.parentElement;
    const parentMinHeight=parent?.style.minHeight||'';
    if(parent)parent.style.minHeight=Math.ceil(Math.max(parent.getBoundingClientRect().height,source.offsetHeight))+'px';
    const left=rect.left+'px',top=rect.top+'px',width=rect.width+'px';
    const height=Math.max(rect.height,innerHeight-rect.top)+'px';
    const stored={
      source,target,to,direction,width:rect.width,progress:0,parent,parentMinHeight,
      fromCSS:source.style.cssText,toCSS:target.style.cssText,
      targetInert:target.inert,targetAria:target.getAttribute('aria-hidden'),
      timer:null
    };
    for(const el of [source,target]){
      el.style.setProperty('--v91-left',left);
      el.style.setProperty('--v91-top',top);
      el.style.setProperty('--v91-width',width);
      el.style.setProperty('--v91-height',height);
      el.classList.add('canvas-v91-pane');
    }
    source.classList.add('canvas-v91-source');
    target.classList.add('canvas-v91-target');
    target.inert=true;
    target.setAttribute('aria-hidden','true');
    document.body.classList.add('canvas-v91-motion-active');
    motion=stored;
    debug.prepares++;
    debug.lastPrepareMs=performance.now()-start;
    paint(0);
  }
  function paint(value){
    if(!motion)return;
    const m=motion,p=clamp(value,0,1),direction=m.direction;
    m.progress=p;
    // A subtle 18% parallax is calmer and cheaper than 3D page curls.
    m.source.style.transform='translate3d('+(direction*m.width*.18*p)+'px,0,0)';
    m.source.style.opacity=String(1-.16*p);
    m.target.style.transform='translate3d('+(-direction*m.width*(1-p))+'px,0,0)';
    m.target.style.opacity=String(.92+.08*p);
  }
  function paintSoon(value){
    if(!motion)return;
    motion.progress=clamp(value,0,1);
    if(frame)return;
    frame=requestAnimationFrame(()=>{
      frame=0;
      if(motion)paint(motion.progress);
    });
  }
  function settle(commit,fromProgress,velocity=0){
    if(!motion){if(commit&&gesture?.to)tab(gesture.to);return;}
    if(frame){cancelAnimationFrame(frame);frame=0;}
    const m=motion;
    turning=true;
    const remaining=commit?1-fromProgress:fromProgress;
    // Deliberately short; unlike a fixed-duration turn, an almost-complete
    // swipe never waits through the same animation as a tiny drag.
    const duration=reduce()?0:Math.round(clamp(remaining*220/(1+Math.min(1.1,Math.abs(velocity)*1.15)),65,220));
    m.settleCommit=commit;
    debug.lastSettleMs=duration;
    if(!duration){finish(commit);return;}
    const easing='cubic-bezier(.2,.75,.22,1)';
    for(const el of [m.source,m.target]){
      el.classList.add('canvas-v91-settling');
      el.style.transition='transform '+duration+'ms '+easing+',opacity '+duration+'ms ease';
    }
    paint(commit?1:0);
    let done=false;
    const complete=()=>{
      if(done||motion!==m)return;
      done=true;finish(commit);
    };
    m.onTransitionEnd=e=>{if(e.propertyName==='transform'&&e.target===m.source)complete();};
    m.source.addEventListener('transitionend',m.onTransitionEnd);
    m.timer=setTimeout(complete,duration+85);
  }
  function cancel(){
    gesture=null;
    cleanup();
  }
  document.addEventListener('touchstart',e=>{
    // Another gesture can immediately retarget a settling navigation. Finish
    // its state change before interpreting the new gesture; never lock the UI.
    if(turning&&motion){debug.interruptions++;finish(motion.settleCommit===true);}
    gesture=null;
    if(e.touches.length!==1||blocked()||protectedTarget(e.target)||window.getSelection()?.toString().trim())return;
    const view=document.querySelector('.view.active');
    if(!view||!tabs.includes(view.id)||!view.contains(e.target))return;
    if(view.id==='brainstorm'&&!document.getElementById('projectWorkspace')?.hidden)return;
    const touch=e.touches[0];
    if(touch.clientX<28||touch.clientX>innerWidth-28)return;
    gesture={x:touch.clientX,y:touch.clientY,id:view.id,locked:false,to:null,direction:0,progress:0,
      samples:[{x:touch.clientX,t:performance.now()}]};
  },{passive:true});
  document.addEventListener('touchmove',e=>{
    if(!gesture||e.touches.length!==1)return;
    const touch=e.touches[0],dx=touch.clientX-gesture.x,dy=touch.clientY-gesture.y;
    const now=performance.now();
    gesture.samples.push({x:touch.clientX,t:now});
    gesture.samples=gesture.samples.filter(sample=>now-sample.t<=130).slice(-8);
    if(!gesture.locked){
      if(Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)*1.25){gesture=null;return;}
      if(Math.abs(dx)<16||Math.abs(dx)<Math.abs(dy)*1.7)return;
      const next=tabs.indexOf(gesture.id)+(dx<0?1:-1);
      if(next<0||next>=tabs.length){gesture=null;return;}
      gesture.to=tabs[next];gesture.direction=dx<0?-1:1;gesture.locked=true;
      if(!reduce())prepare(gesture.id,gesture.to,gesture.direction);
    }
    if(e.cancelable)e.preventDefault();
    gesture.progress=clamp(dx*gesture.direction/Math.max(220,innerWidth*.72),0,1);
    paintSoon(gesture.progress);
  },{passive:false});
  document.addEventListener('touchend',e=>{
    if(!gesture)return;
    const g=gesture;gesture=null;
    if(!g.locked){cancel();return;}
    const touch=e.changedTouches[0],dx=touch.clientX-g.x,dy=touch.clientY-g.y;
    const endTime=performance.now();
    // Ignore synthetic or ultra-short sample intervals; they cannot provide
    // meaningful velocity and must not accidentally trigger navigation.
    const first=g.samples.find(s=>endTime-s.t>=12)||null;
    const duration=first?endTime-first.t:0;
    const directedVelocity=duration>0?(touch.clientX-first.x)*g.direction/duration:0;
    const distance=dx*g.direction;
    const commit=(distance>=72||(distance>=36&&directedVelocity>=.5))&&
      Math.abs(dx)>Math.abs(dy)*1.7&&!blocked();
    if(reduce()){cleanup();if(commit)tab(g.to);return;}
    settle(commit,g.progress,directedVelocity);
  },{passive:true});
  document.addEventListener('touchcancel',()=>{gesture=null;if(motion)settle(false,motion.progress);},{passive:true});
  // Explicit tab taps win over an in-flight animation.
  document.querySelector('.bottom-nav')?.addEventListener('pointerdown',()=>{
    if(motion)cancel();
  },true);
  const flushForExit=()=>{if(turning&&motion)finish(motion.settleCommit===true);else cancel();};
  document.addEventListener('visibilitychange',()=>{if(document.hidden)flushForExit();});
  window.addEventListener('pagehide',flushForExit);
  window.addEventListener('resize',()=>{if(motion)cancel();},{passive:true});
})();
