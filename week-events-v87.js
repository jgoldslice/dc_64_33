'use strict';
/* Canvas v8.7: lightweight event entry from Week. Same state.events storage. */
(function(){
  const grid=document.getElementById('weekGrid');
  const add=document.getElementById('addWeekEvent');
  if(!grid||!add)return;
  const overlay=document.createElement('div');
  overlay.id='v87EventBack';
  overlay.className='v87-event-back';
  overlay.hidden=true;
  overlay.innerHTML=[
    '<form id="v87EventForm" class="v87-event-sheet" role="dialog" aria-modal="true" aria-labelledby="v87EventTitle">',
      '<div class="v87-event-heading"><h2 id="v87EventTitle">Add event</h2>',
        '<button type="button" id="v87EventClose" class="v87-event-close" aria-label="Close event form">×</button></div>',
      '<p id="v87EventDate" class="v87-event-date"></p>',
      '<div class="v816-modal-week-controls" aria-label="Event week navigation">'+
        '<button type="button" id="v816EventPrev" aria-label="Previous event week" title="Previous week">‹</button>'+
        '<span id="v816EventWeek" aria-live="polite"></span>'+
        '<button type="button" id="v816EventNext" aria-label="Next event week" title="Next week">›</button>'+
      '</div>',
      '<div id="v87EventDates" class="v87-event-days" role="group" aria-label="Choose event day"></div>',
      '<label class="v87-event-label" for="v87EventName">Event name',
        '<input id="v87EventName" name="title" type="text" maxlength="160" placeholder="What\'s happening?" autocomplete="off" required></label>',
      '<label class="v87-event-label" for="v87EventTime">Time',
        '<input id="v87EventTime" name="time" type="time" value="09:00" required></label>',
      '<div class="v87-event-actions">',
        '<button type="button" id="v87EventCancel" class="secondary-button">Cancel</button>',
        '<button type="submit" class="primary-button">Add event</button>',
      '</div>',
    '</form>'
  ].join('');
  document.body.append(overlay);
  const form=overlay.querySelector('#v87EventForm');
  const label=overlay.querySelector('#v87EventDate');
  const dates=overlay.querySelector('#v87EventDates');
  const name=overlay.querySelector('#v87EventName');
  const time=overlay.querySelector('#v87EventTime');
  const cancel=overlay.querySelector('#v87EventCancel');
  const x=overlay.querySelector('#v87EventClose');
  const eventPrev=overlay.querySelector('#v816EventPrev');
  const eventNext=overlay.querySelector('#v816EventNext');
  const eventWeek=overlay.querySelector('#v816EventWeek');
  let chosen='',previous=null,modalWeek=null;
  const weekDates=()=>Array.from({length:7},(_,i)=>iso(plusDays(modalWeek||startOfWeek(selectedWeek),i)));
  const friendly=date=>new Date(date+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'});
  function valid(date){return /^\d{4}-\d{2}-\d{2}$/.test(date)&&weekDates().includes(date);}
  function choose(date){
    if(!valid(date))return;
    chosen=date;label.textContent=friendly(date);
    dates.querySelectorAll('[data-v87-date]').forEach(b=>{
      b.setAttribute('aria-pressed',String(b.dataset.v87Date===date));
    });
  }
  function renderDays(){
    dates.replaceChildren();
    const week=weekDates();
    eventWeek.textContent=week[0].slice(0,4)===week[6].slice(0,4)
      ?friendly(week[0]).replace(/^[^,]+,?\s*/,'')+' – '+friendly(week[6]).replace(/^[^,]+,?\s*/,'')
      :week[0]+' – '+week[6];
    for(const day of week){
      const d=new Date(day+'T12:00:00'),chip=document.createElement('button');
      chip.type='button';chip.className='v87-day-option';
      chip.dataset.v87Date=day;
      chip.textContent=d.toLocaleDateString('en-US',{weekday:'short',day:'numeric'});
      chip.setAttribute('aria-label',friendly(day));
      chip.addEventListener('click',()=>choose(day));
      dates.append(chip);
    }
  }
  function changeEventWeek(step){
    if(overlay.hidden)return;
    const current=chosen?new Date(chosen+'T12:00:00'):new Date(weekDates()[0]+'T12:00:00');
    const weekday=(current.getDay()+6)%7;
    modalWeek=plusDays(modalWeek,step*7);
    renderDays();
    // Keep the same weekday selected, plus all typed event details.
    choose(weekDates()[weekday]);
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches&&dates.animate){
      dates.animate([
        {opacity:.6,transform:'translateX('+(step>0?12:-12)+'px)'},
        {opacity:1,transform:'translateX(0)'}
      ],{duration:180,easing:'cubic-bezier(.2,.75,.2,1)'});
    }
  }
  eventPrev.addEventListener('click',()=>changeEventWeek(-1));
  eventNext.addEventListener('click',()=>changeEventWeek(1));
  // Swipe the day strip like pages, without swallowing vertical modal scroll.
  function addHorizontalSwipe(element,onStep){
    let gesture=null;
    element.addEventListener('touchstart',e=>{
      if(e.touches.length!==1){gesture=null;return;}
      const t=e.touches[0];
      gesture={x:t.clientX,y:t.clientY,valid:true};
    },{passive:true});
    element.addEventListener('touchmove',e=>{
      if(!gesture||e.touches.length!==1)return;
      const t=e.touches[0],dx=t.clientX-gesture.x,dy=t.clientY-gesture.y;
      if(Math.abs(dy)>14&&Math.abs(dy)>Math.abs(dx)*1.2){gesture=null;return;}
      if(Math.abs(dx)>16&&Math.abs(dx)>Math.abs(dy)*1.5&&e.cancelable)e.preventDefault();
    },{passive:false});
    element.addEventListener('touchend',e=>{
      if(!gesture||e.changedTouches.length!==1)return;
      const t=e.changedTouches[0],dx=t.clientX-gesture.x,dy=t.clientY-gesture.y;
      gesture=null;
      if(Math.abs(dx)>=58&&Math.abs(dx)>Math.abs(dy)*1.5)onStep(dx<0?1:-1);
    },{passive:true});
    element.addEventListener('touchcancel',()=>{gesture=null;},{passive:true});
    // Allow click-and-drag on a Mac/desktop, without turning a dragged day
    // into an accidental calendar event.
    let mouseStart=null,suppressClickUntil=0;
    element.addEventListener('pointerdown',e=>{
      if(e.pointerType==='mouse'&&e.button===0)
        mouseStart={x:e.clientX,y:e.clientY};
    });
    element.addEventListener('pointerup',e=>{
      if(!mouseStart)return;
      const dx=e.clientX-mouseStart.x,dy=e.clientY-mouseStart.y;
      mouseStart=null;
      if(Math.abs(dx)>=58&&Math.abs(dx)>Math.abs(dy)*1.5){
        suppressClickUntil=Date.now()+400;
        onStep(dx<0?1:-1);
      }
    });
    element.addEventListener('pointercancel',()=>{mouseStart=null;});
    element.addEventListener('click',e=>{
      if(Date.now()<suppressClickUntil){e.preventDefault();e.stopImmediatePropagation();}
    },true);
  }
  addHorizontalSwipe(dates,changeEventWeek);
  // Apple trackpads send horizontal wheel deltas; keyboard users can move
  // through the dates with arrow keys, even though the duplicate buttons hide.
  let lastEventWheel=0;
  dates.addEventListener('wheel',e=>{
    if(Math.abs(e.deltaX)<24||Math.abs(e.deltaX)<Math.abs(e.deltaY)*1.3)return;
    if(e.cancelable)e.preventDefault();
    const now=Date.now();if(now-lastEventWheel<450)return;
    lastEventWheel=now;changeEventWeek(e.deltaX>0?1:-1);
  },{passive:false});
  dates.addEventListener('keydown',e=>{
    if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;
    e.preventDefault();
    const direction=e.key==='ArrowRight'?1:-1;
    const next=iso(plusDays(new Date(chosen+'T12:00:00'),direction));
    if(!weekDates().includes(next))changeEventWeek(direction);
    choose(next);
    dates.querySelector('[aria-pressed="true"]')?.focus();
  });

  function shiftCalendar(step){
    const button=document.getElementById(step>0?'nextWeek':'prevWeek');
    button.click(); // Existing week navigation updates week label, habits and events.
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches&&grid.animate){
      grid.animate([
        {opacity:.55,transform:'translateX('+(step>0?18:-18)+'px)'},
        {opacity:1,transform:'translateX(0)'}
      ],{duration:210,easing:'cubic-bezier(.2,.75,.2,1)'});
    }
  }
  document.getElementById('v816CalendarPrev')?.addEventListener('click',()=>shiftCalendar(-1));
  document.getElementById('v816CalendarNext')?.addEventListener('click',()=>shiftCalendar(1));
  addHorizontalSwipe(grid,shiftCalendar);
  grid.setAttribute('tabindex','0');
  grid.addEventListener('keydown',e=>{
    if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;
    e.preventDefault();
    shiftCalendar(e.key==='ArrowRight'?1:-1);
    grid.focus({preventScroll:true});
  });
  // Horizontal trackpad scrolling is available on desktop Safari as well.
  let lastWheelTurn=0;
  grid.addEventListener('wheel',e=>{
    if(Math.abs(e.deltaX)<28||Math.abs(e.deltaX)<Math.abs(e.deltaY)*1.4)return;
    if(e.cancelable)e.preventDefault();
    const now=Date.now();
    if(now-lastWheelTurn<450)return;
    lastWheelTurn=now;
    shiftCalendar(e.deltaX>0?1:-1);
  },{passive:false});

  function close(restore=true){
    if(overlay.hidden)return;
    overlay.hidden=true;form.reset();chosen='';modalWeek=null;
    if(restore)(previous?.isConnected?previous:add).focus({preventScroll:true});
    previous=null;
  }
  function open(date,fromDay,trigger){
    if(!overlay.hidden)close(false);
    previous=trigger||document.activeElement;
    modalWeek=startOfWeek(selectedWeek);
    const week=weekDates();
    if(!week.includes(date))date=week.includes(localToday())?localToday():week[0];
    renderDays();
    form.reset();choose(date);overlay.hidden=false;
    requestAnimationFrame(()=>name.focus());
  }
  add.addEventListener('click',()=>open('',false,add));
  grid.addEventListener('click',e=>{
    const item=e.target instanceof Element?e.target.closest('[data-week-event-date]'):null;
    if(item&&grid.contains(item))open(item.dataset.weekEventDate,true,item);
  });
  grid.addEventListener('keydown',e=>{
    if(e.key!=='Enter'&&e.key!==' ')return;
    const item=e.target;
    if(!(item instanceof Element)||!item.matches('[data-week-event-date]'))return;
    e.preventDefault();open(item.dataset.weekEventDate,true,item);
  });
  overlay.addEventListener('click',e=>{
    if(e.target===overlay||e.target===x||e.target===cancel)close();
  });
  document.addEventListener('keydown',e=>{
    if(overlay.hidden)return;
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();return;}
    if(e.key!=='Tab')return;
    const focusable=[...form.querySelectorAll('button:not([disabled]),input:not([disabled])')]
      .filter(el=>el.getClientRects().length);
    if(!focusable.length)return;
    const first=focusable[0],last=focusable[focusable.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  },true);
  form.addEventListener('submit',e=>{
    e.preventDefault();
    const title=name.value.trim(),value=time.value;
    if(!title){name.focus();return;}
    if(!valid(chosen)){label.textContent='Choose a day in the displayed week.';return;}
    if(!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)){time.focus();return;}
    const date=chosen;
    state.events.push({id:uid(),title,date,time:value});
    save();
    close(false);
    // Show the newly scheduled week, even when it is weeks in the future.
    selectedWeek=startOfWeek(new Date(date+'T12:00:00'));
    render();
    const cell=[...grid.querySelectorAll('[data-week-event-date]')]
      .find(el=>el.dataset.weekEventDate===date);
    (cell||add).focus({preventScroll:true});
  });
})();
