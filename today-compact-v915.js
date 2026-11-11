'use strict';
/* Blueprint v9.15 — compact Today: move existing cards into independent columns
   on iPad, restore original document/keyboard order on iPhone. No data changes. */
(function(){
  const host=document.querySelector('#today > .stack');
  if(!host)return;
  const glance=document.getElementById('todayGlance')?.closest('.card');
  const habits=document.getElementById('todayHabits')?.closest('.card');
  const priorities=document.getElementById('v77TodayPriorities')?.closest('.card');
  const projects=document.getElementById('v77TodayProjects')?.closest('.card');
  if(!glance||!habits||!priorities||!projects)return;

  const tablet=window.matchMedia('(min-width:740px) and (min-height:600px)');
  const grid=document.createElement('div');
  grid.className='v915-today-columns';
  const main=document.createElement('div');
  main.className='v915-today-column v915-today-main';
  const side=document.createElement('div');
  side.className='v915-today-column v915-today-side';
  grid.append(main,side);
  host.classList.add('v915-layout-ready');

  function arrange(){
    if(tablet.matches){
      if(grid.parentNode!==host)host.append(grid);
      main.append(glance,projects);
      side.append(habits,priorities);
    }else{
      host.append(glance,habits,priorities,projects);
      grid.remove();
    }
  }
  arrange();
  if(typeof tablet.addEventListener==='function')tablet.addEventListener('change',arrange);
  else if(typeof tablet.addListener==='function')tablet.addListener(arrange);
})();