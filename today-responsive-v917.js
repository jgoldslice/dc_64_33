'use strict';
/* Blueprint v9.17: adaptive screen classification, non-destructive layout
   updates, and explicit overflow hints. No UI remount on unfold/rotation. */
(function(){
  const root=document.documentElement;
  const today=document.getElementById('today');
  const scrollBodies=[...document.querySelectorAll('#today .v917-card-body')];
  if(!today||scrollBodies.length!==5)return;
  let frame=0;
  function inspect(){
    frame=0;
    const width=document.documentElement.clientWidth;
    root.dataset.blueprintDisplay=width<650?'compact':width<1024?'expanded':'wide';
    for(const body of scrollBodies){
      const card=body.closest('.card');
      if(!card)continue;
      const excess=body.scrollHeight-body.clientHeight;
      const more=excess>12&&body.scrollTop<excess-10;
      card.classList.toggle('v917-has-overflow',more);
    }
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(inspect);}
  for(const body of scrollBodies){
    const observer=new MutationObserver(schedule);
    observer.observe(body,{childList:true,subtree:true,characterData:true});
    body.addEventListener('scroll',schedule,{passive:true});
  }
  window.addEventListener('resize',schedule,{passive:true});
  window.visualViewport?.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('pageshow',schedule,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
  if(typeof ResizeObserver==='function'){
    const ro=new ResizeObserver(schedule);
    ro.observe(today);
  }
  schedule();
})();
