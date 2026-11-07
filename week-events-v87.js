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
      '<div class="v816-modal-week-controls v817-date-heading" aria-label="Selected event week">'+
        '<span id="v816EventWeek" aria-live="polite"></span>'+
      '</div>',
      '<div id="v87EventDates" class="v87-event-days v817-date-scroller" tabindex="0" role="group" aria-label="Swipe horizontally to see calendar weeks and choose a day"></div>',
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
  const eventWeek=overlay.querySelector('#v816EventWeek');
  const previousGrid=document.getElementById('v817WeekPrev');
  const nextGrid=document.getElementById('v817WeekNext');
  const weekWindow=document.getElementById('v817WeekViewport');
  let chosen='',previous=null,modalWeek=null,trackWeek=null;
  let dateScrollTimer=null,dateScrollLocked=false,calendarScrollTimer=null;
  let calendarScrollLocked=false,calendarGesture=null,dateGesture=null;
  const weekDates=()=>Array.from({length:7},(_,i)=>iso(plusDays(modalWeek||startOfWeek(selectedWeek),i)));
  const friendly=date=>new Date(date+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'});
  function valid(date){return /^\d{4}-\d{2}-\d{2}$/.test(date)&&weekDates().includes(date);}
  const stamp=day=>new Date(day+'T12:00:00');
  const weekdayIndex=date=>(stamp(date).getDay()+6)%7;
  function weekLabelText(week){
    const a=plusDays(week,0),b=plusDays(week,6);
    const short=d=>d.toLocaleDateString('en-US',{month:'short',day:'numeric'});
    return short(a)+' – '+short(b)+(a.getFullYear()!==b.getFullYear()?' '+b.getFullYear():'');
  }
  function displayChosen(){
    if(chosen)label.textContent=friendly(chosen);
    if(modalWeek)eventWeek.textContent=weekLabelText(modalWeek);
    dates.querySelectorAll('[data-v87-date]').forEach(button=>{
      const on=button.dataset.v87Date===chosen;
      button.setAttribute('aria-pressed',String(on));
    });
  }
  function centerDates(){
    if(overlay.hidden||!dates.clientWidth)return;
    dateScrollLocked=true;
    dates.style.scrollSnapType='none';
    dates.scrollLeft=dates.clientWidth;
    // Restore native snap after the recenter operation has taken effect.
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      dates.style.scrollSnapType='';
      dateScrollLocked=false;
    }));
  }
  function renderDays(){
    if(!modalWeek)return;
    trackWeek=startOfWeek(modalWeek);
    const track=document.createElement('div');
    track.className='v817-date-track';
    for(let offset=-1;offset<=1;offset++){
      const week=plusDays(trackWeek,offset*7);
      const page=document.createElement('div');
      page.className='v817-date-week';
      page.dataset.weekStart=iso(week);
      for(let i=0;i<7;i++){
        const day=iso(plusDays(week,i));
        const chip=document.createElement('button');
        chip.type='button';chip.className='v87-day-option';
        chip.dataset.v87Date=day;
        chip.textContent=stamp(day).toLocaleDateString('en-US',{weekday:'short',day:'numeric'});
        chip.setAttribute('aria-label',friendly(day));
        chip.setAttribute('aria-pressed',String(day===chosen));
        chip.addEventListener('click',()=>choose(day));
        page.append(chip);
      }
      track.append(page);
    }
    dates.replaceChildren(track);
    displayChosen();
    requestAnimationFrame(centerDates);
  }
  function choose(date){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return;
    const nextWeek=startOfWeek(stamp(date));
    const switched=!modalWeek||iso(modalWeek)!==iso(nextWeek);
    chosen=date;modalWeek=nextWeek;
    if(switched&&!overlay.hidden)renderDays();
    else displayChosen();
  }
  function shiftDateWeek(step){
    if(overlay.hidden||!modalWeek)return;
    const day=chosen?weekdayIndex(chosen):0;
    modalWeek=plusDays(modalWeek,7*step);
    chosen=iso(plusDays(modalWeek,day));
    renderDays();
  }
  function shownDateWeek(){
    if(!trackWeek||!dates.clientWidth)return;
    const nearest=Math.max(0,Math.min(2,Math.round(dates.scrollLeft/dates.clientWidth)));
    const candidate=plusDays(trackWeek,(nearest-1)*7);
    if(!modalWeek||iso(candidate)!==iso(modalWeek)){
      const day=chosen?weekdayIndex(chosen):0;
      modalWeek=candidate;
      chosen=iso(plusDays(modalWeek,day));
      displayChosen();
    }
  }
  function settleDateScroll(){
    if(dateScrollLocked||overlay.hidden)return;
    shownDateWeek();
    const page=Math.max(0,Math.min(2,Math.round(dates.scrollLeft/Math.max(1,dates.clientWidth))));
    if(page!==1)renderDays(); // Recenter an identical week, ready to swipe again indefinitely.
  }
  dates.addEventListener('scroll',()=>{
    if(dateScrollLocked||overlay.hidden)return;
    shownDateWeek();
    clearTimeout(dateScrollTimer);
    dateScrollTimer=setTimeout(settleDateScroll,140);
  },{passive:true});
  dates.addEventListener('scrollend',()=>{clearTimeout(dateScrollTimer);settleDateScroll();},{passive:true});
  dates.addEventListener('keydown',e=>{
    if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;
    e.preventDefault();
    shiftDateWeek(e.key==='ArrowRight'?1:-1);
  });
  // Native momentum and CSS scroll-snap handle real iPad finger gestures.
  // Synthesized browser tests do not produce native scrolling, so keep a
  // small synthetic-only touch fallback; it never runs for trusted touches.
  dates.addEventListener('touchstart',e=>{
    if(e.touches.length!==1){dateGesture=null;return;}
    const t=e.touches[0];
    dateGesture={x:t.clientX,y:t.clientY,left:dates.scrollLeft};
  },{passive:true});
  dates.addEventListener('touchend',e=>{
    if(!dateGesture||e.changedTouches.length!==1)return;
    const g=dateGesture,t=e.changedTouches[0];dateGesture=null;
    const dx=t.clientX-g.x,dy=t.clientY-g.y;
    if(!e.isTrusted&&Math.abs(dx)>64&&Math.abs(dx)>Math.abs(dy)*1.5&&
      Math.abs(dates.scrollLeft-g.left)<6)shiftDateWeek(dx<0?1:-1);
  },{passive:true});
  dates.addEventListener('touchcancel',()=>{dateGesture=null;},{passive:true});

  // Calendar: a native three-week scroll-snap track shows preceding and
  // following dates as the user drags. Keep the original #weekGrid centered
  // so existing per-day click handlers, data selectors and saved events work.
  function weekMarkup(start){
    const days=Array.from({length:5},(_,i)=>dayCard(iso(plusDays(start,i)))).join('');
    const weekend=[5,6].map(i=>{
      const d=plusDays(start,i),date=iso(d);
      return '<div class="weekend-half" data-week-event-date="'+date+'">'+
        '<div class="day-top"><span>'+weekDay(d)+'</span>'+
        '<span class="day-date">'+format(d)+'</span></div>'+dayLines(date)+'</div>';
    }).join('');
    return days+'<div class="day-card weekend">'+weekend+'</div>';
  }
  function centerCalendar(){
    if(!weekWindow||!weekWindow.clientWidth)return;
    calendarScrollLocked=true;
    weekWindow.style.scrollSnapType='none';
    weekWindow.scrollLeft=weekWindow.clientWidth;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      weekWindow.style.scrollSnapType='';
      calendarScrollLocked=false;
    }));
  }
  function renderAdjacentWeeks(){
    if(!weekWindow||!previousGrid||!nextGrid)return;
    previousGrid.innerHTML=weekMarkup(plusDays(selectedWeek,-7));
    nextGrid.innerHTML=weekMarkup(plusDays(selectedWeek,7));
    requestAnimationFrame(centerCalendar);
  }
  function shiftCalendar(step){
    const button=document.getElementById(step>0?'nextWeek':'prevWeek');
    button.click();
    // A MutationObserver on #weekGrid rebuilds adjacent weeks after render().
  }
  function settleCalendar(){
    if(calendarScrollLocked||!weekWindow?.clientWidth)return;
    const page=Math.max(0,Math.min(2,Math.round(weekWindow.scrollLeft/weekWindow.clientWidth)));
    if(page!==1)shiftCalendar(page===2?1:-1);
  }
  if(weekWindow){
    const observer=new MutationObserver(renderAdjacentWeeks);
    observer.observe(grid,{childList:true});
    renderAdjacentWeeks();
    weekWindow.addEventListener('scroll',()=>{
      if(calendarScrollLocked)return;
      clearTimeout(calendarScrollTimer);
      calendarScrollTimer=setTimeout(settleCalendar,140);
    },{passive:true});
    weekWindow.addEventListener('scrollend',()=>{
      clearTimeout(calendarScrollTimer);
      settleCalendar();
    },{passive:true});
    weekWindow.addEventListener('touchstart',e=>{
      if(e.touches.length!==1){calendarGesture=null;return;}
      const t=e.touches[0];
      calendarGesture={x:t.clientX,y:t.clientY,left:weekWindow.scrollLeft};
    },{passive:true});
    weekWindow.addEventListener('touchend',e=>{
      if(!calendarGesture||e.changedTouches.length!==1)return;
      const g=calendarGesture,t=e.changedTouches[0];calendarGesture=null;
      const dx=t.clientX-g.x,dy=t.clientY-g.y;
      if(!e.isTrusted&&Math.abs(dx)>=65&&Math.abs(dx)>Math.abs(dy)*1.5&&
         Math.abs(weekWindow.scrollLeft-g.left)<6)shiftCalendar(dx<0?1:-1);
    },{passive:true});
    weekWindow.addEventListener('touchcancel',()=>{calendarGesture=null;},{passive:true});
    weekWindow.addEventListener('keydown',e=>{
      if(e.target!==weekWindow||(e.key!=='ArrowLeft'&&e.key!=='ArrowRight'))return;
      e.preventDefault();shiftCalendar(e.key==='ArrowRight'?1:-1);
    });
  }

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
    // The strip needs a laid-out width before we scroll to its middle week.
    requestAnimationFrame(()=>{centerDates();name.focus();});
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
