'use strict';
/* Blueprint v9.16 — keep the two Today columns flush while preserving
   natural card sizes. Extra entries become internal scroll, not extra blank
   area. No DOM moves and no planner-state changes. */
(function(){
  const cols=document.querySelector('#today .v915-today-columns');
  const main=cols?.querySelector('.v915-today-main');
  const side=cols?.querySelector('.v915-today-side');
  const list=id=>document.getElementById(id);
  const glance=list('todayGlance'),projects=list('v77TodayProjects');
  const habits=list('todayHabits'),priorities=list('v77TodayPriorities');
  if(!cols||!main||!side||!glance||!projects||!habits||!priorities)return;
  const tablet=matchMedia('(min-width:740px) and (min-height:600px)');
  const lists=[glance,projects,habits,priorities];
  let frame=0;
  function shrink(items,amount){
    for(const [el,min] of items){
      if(amount<=1)break;
      const current=el.getBoundingClientRect().height;
      const usable=Math.max(0,current-min);
      const by=Math.min(amount,usable);
      if(by>0){
        el.style.maxHeight=Math.max(min,current-by)+'px';
        amount-=by;
      }
    }
  }
  function balance(){
    frame=0;
    lists.forEach(el=>el.style.removeProperty('max-height'));
    if(!tablet.matches||cols.offsetParent===null)return;
    const left=main.getBoundingClientRect().height;
    const right=side.getBoundingClientRect().height;
    const delta=left-right;
    if(Math.abs(delta)<2)return;
    if(delta>0)shrink([[glance,150],[projects,84]],delta);
    else shrink([[priorities,132],[habits,84]],-delta);
  }
  function schedule(){
    if(frame)return;
    frame=requestAnimationFrame(balance);
  }
  const observer=new MutationObserver(schedule);
  for(const el of lists)observer.observe(el,{childList:true,subtree:true,characterData:true});
  window.addEventListener('resize',schedule,{passive:true});
  if(typeof tablet.addEventListener==='function')tablet.addEventListener('change',schedule);
  if(typeof ResizeObserver==='function'){
    // Changes to layout width (e.g. sidebar collapse) rewrap card contents.
    const ro=new ResizeObserver(schedule);
    ro.observe(cols);
  }
  schedule();
})();
