
'use strict';
/* Blueprint v9.18: Weekly Blueprint.
   A draft-first, local/offline, five-stage review and planning workspace.
   Never mutates the planner until an explicit verified Apply. */
(function(){
  const DRAFT_KEY='blueprint-weekly-v918-draft';
  const UNDO_KEY='blueprint-weekly-v918-undo';
  const STEPS=['Report','Goals','Schedule','Prioritize','Review'];
  const FIELDS=['tasks','habits','goals','events','ideas'];
  const E=id=>document.getElementById(id);
  const clone=value=>structuredClone(value);
  const dateObject=s=>new Date(String(s)+'T12:00:00');
  const add=(s,n)=>iso(plusDays(dateObject(s),n));
  const dayName=s=>dateObject(s).toLocaleDateString('en-US',{weekday:'short'});
  const niceDate=s=>dateObject(s).toLocaleDateString('en-US',{month:'short',day:'numeric'});
  const dateRange=s=>niceDate(s)+' – '+niceDate(add(s,6));
  const idString=id=>String(id);
  const attr=value=>esc(value);
  const clean=value=>String(value==null?'':value).trim();
  const read=key=>{try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}};
  const newDraft=(start)=>({
    version:1,weekStart:start,step:0,selectedDay:start,
    taskDone:{},habitDays:{},carry:{},goals:{},
    newEvents:[],eventEdits:{},eventForm:{title:'',date:start,time:'09:00'},
    editingEvent:null,priority:null,priorityTouched:false,
    newTasks:[],taskForm:{title:'',dueDate:start,goalId:''},
    created:Date.now()
  });
  let draft=read(DRAFT_KEY);
  if(!draft||draft.version!==1||!draft.weekStart||!draft.taskDone||!draft.habitDays||!draft.goals)draft=null;
  let returnFocus=null,originalOverflow='',goalOpen=new Set(),dragged=null,pointerDrag=null;
  const background=document.querySelector('.shell');
  const overlay=document.createElement('div');
  overlay.id='wbOverlay';
  overlay.className='wb-back';
  overlay.hidden=true;
  overlay.innerHTML=
    '<section class="wb-sheet" role="dialog" aria-modal="true" aria-labelledby="wbTitle">'+
      '<header class="wb-header"><div class="wb-titlebar"><div><span class="eyebrow">Weekly Blueprint</span><h2 id="wbTitle">Design your week</h2></div>'+
      '<button type="button" data-wb-close aria-label="Close weekly planning">×</button></div>'+
      '<nav class="wb-progress-nav" id="wbProgress" aria-label="Planning stages"></nav></header>'+
      '<div class="wb-main" id="wbMain" tabindex="-1"></div>'+
      '<footer class="wb-footer"><span id="wbStatus" class="wb-error" role="status"></span><div class="wb-footer-actions">'+
      '<button type="button" id="wbBackButton" data-wb-back>Back</button>'+
      '<button type="button" id="wbNextButton" data-wb-next class="wb-primary">Continue</button>'+
      '</div></footer></section>';
  document.body.append(overlay);
  function storeDraft(){
    if(!draft)return true;
    try{localStorage.setItem(DRAFT_KEY,JSON.stringify(draft));return true;}
    catch(e){E('wbStatus').textContent='Draft could not be saved on this device. Check storage before leaving.';console.error('Weekly Blueprint draft save failed',e);return false;}
  }
  function draftStart(){return iso(plusDays(startOfWeek(new Date()),7));}
  function previousWeek(){return add(draft.weekStart,-7);}
  function current(id){return state.tasks.find(t=>idString(t.id)===idString(id));}
  function doneTask(t){return Object.hasOwn(draft.taskDone,idString(t.id))?!!draft.taskDone[idString(t.id)]:!!t.done;}
  function completedHabit(h,date){
    const row=draft.habitDays[idString(h.id)];
    return row&&Object.hasOwn(row,date)?!!row[date]:!!h.days?.[date];
  }
  function goalFor(id){return draft.goals[idString(id)]||state.goals.find(g=>idString(g.id)===idString(id));}
  function editableGoal(id){
    const key=idString(id);
    if(!draft.goals[key]){
      const existing=state.goals.find(g=>idString(g.id)===key);
      if(!existing)return null;
      draft.goals[key]=clone(existing);
    }
    return draft.goals[key];
  }
  function priorityIds(){
    if(Array.isArray(draft.priority))return draft.priority;
    return ranked().map(t=>idString(t.id));
  }
  function allAvailableTasks(){
    return [...state.tasks,...draft.newTasks];
  }
  function effectiveEvents(){
    return [...state.events.map(e=>Object.assign({},e,draft.eventEdits[idString(e.id)]||{}, {wbKey:'existing:'+idString(e.id)})),
      ...draft.newEvents.map(e=>Object.assign({},e,{wbKey:'new:'+e.id}))];
  }
  function datesForWeek(){return Array.from({length:7},(_,i)=>add(draft.weekStart,i));}
  function meaningfulChanges(){
    let n=0;
    for(const [id,val] of Object.entries(draft.taskDone)){
      const t=current(id);if(t&&!!t.done!==!!val)n++;
    }
    for(const [id,days] of Object.entries(draft.habitDays)){
      const h=state.habits.find(x=>idString(x.id)===id);
      if(h)for(const [date,val] of Object.entries(days))if(!!h.days?.[date]!==!!val)n++;
    }
    for(const [id,g] of Object.entries(draft.goals)){
      const old=state.goals.find(x=>idString(x.id)===id);
      if(old&&JSON.stringify(old)!==JSON.stringify(g))n++;
    }
    for(const [id,ed] of Object.entries(draft.eventEdits)){
      const old=state.events.find(e=>idString(e.id)===id);
      if(old&&['title','date','time'].some(k=>old[k]!==ed[k]))n++;
    }
    n+=draft.newEvents.length+draft.newTasks.length;
    for(const [id,date] of Object.entries(draft.carry)){
      const t=current(id);if(t&&t.dueDate!==date)n++;
    }
    if(draft.priorityTouched)n++;
    return n;
  }
  function setStep(next){
    draft.step=Math.max(0,Math.min(4,next));
    storeDraft();
    renderSheet(true);
  }
  function open(fromWeek){
    returnFocus=document.activeElement;
    if(!draft)draft=newDraft(fromWeek?iso(startOfWeek(selectedWeek)):draftStart());
    if(!draft.selectedDay)draft.selectedDay=draft.weekStart;
    originalOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    if(background)background.inert=true;
    overlay.hidden=false;
    storeDraft();renderSheet(true);E('wbMain').focus({preventScroll:true});
  }
  function close(){
    if(overlay.hidden)return;
    storeDraft();
    overlay.hidden=true;
    document.body.style.overflow=originalOverflow;
    if(background)background.inert=false;
    renderOverview();
    if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});
  }
  function weekChange(by){
    if(meaningfulChanges()&&!confirm('Start a different week? Discard the un-applied changes in this planning draft?'))return;
    draft=newDraft(add(draft.weekStart,by*7));
    goalOpen.clear();storeDraft();renderSheet(true);
  }
  function changeNotice(){E('wbStatus').textContent='';}
  function reportMarkup(){
    const first=previousWeek(),last=add(first,6);
    const tasks=state.tasks.filter(t=>{
      const due=t.dueDate||t.date||'';
      return (due>=first&&due<=last)||(due&&due<first&&!doneTask(t));
    }).sort((a,b)=>(a.dueDate||'').localeCompare(b.dueDate||''));
    let taskRows='';
    for(const t of tasks){
      const key=idString(t.id),done=doneTask(t);
      taskRows+='<div class="wb-row"><input type="checkbox" data-wb-task-done="'+attr(key)+'" aria-label="Completed '+attr(t.title)+'" '+(done?'checked':'')+'>'+
        '<span class="wb-row-main">'+attr(t.title)+'<small>'+(t.dueDate?'Due '+niceDate(t.dueDate):'Unscheduled')+'</small></span>'+
        (!done?'<label class="wb-hint"><input type="checkbox" data-wb-carry="'+attr(key)+'" '+(draft.carry[key]?'checked':'')+'> Carry forward</label>':'')+'</div>';
      if(draft.carry[key]&&!done)taskRows+='<div class="wb-row"><span class="wb-hint">Move deadline to</span><input class="wb-carry-date" type="date" data-wb-carry-date="'+attr(key)+'" value="'+attr(draft.carry[key])+'"></div>';
    }
    let habits='<div class="wb-habit-table"><div class="wb-habit-row"><span></span>';
    for(let i=0;i<7;i++)habits+='<span class="wb-habit-head">'+['M','T','W','T','F','S','S'][i]+'</span>';
    habits+='</div>';
    for(const h of state.habits){
      const hid=idString(h.id);
      habits+='<div class="wb-habit-row"><span>'+attr(h.title)+'</span>';
      for(let i=0;i<7;i++){
        const date=add(first,i);
        if(isScheduled(h,date)){
          habits+='<label><input type="checkbox" data-wb-habit="'+attr(hid)+'" data-wb-date="'+date+'" aria-label="'+attr(h.title+' '+date)+'" '+(completedHabit(h,date)?'checked':'')+'></label>';
        }else habits+='<span class="wb-off">·</span>';
      }
      habits+='</div>';
    }
    habits+='</div>';
    return '<h3 class="wb-section-heading">Last week’s report</h3><p class="wb-subtext">'+dateRange(first)+
      ' · Mark completed work and habit days you haven’t recorded yet.</p>'+
      '<section class="wb-block"><div class="wb-block-title"><h3>Tasks</h3><small>'+tasks.length+' items</small></div>'+
      (taskRows||'<p class="wb-empty">No tasks were due last week.</p>')+'</section>'+
      '<section class="wb-block"><div class="wb-block-title"><h3>Habits</h3><small>Check completed days</small></div>'+
      (state.habits.length?habits:'<p class="wb-empty">No habits to report.</p>')+'</section>';
  }
  function goalsMarkup(){
    const goals=state.goals;
    let output='<h3 class="wb-section-heading">Update your goals</h3>'+
      '<p class="wb-subtext">Open a goal to check steps, edit its details, or add new steps. No changes are applied until Review.</p>';
    if(!goals.length)return output+'<p class="wb-empty">No goals yet. Create one from Plan → Goals.</p>';
    for(const original of goals){
      const key=idString(original.id),g=goalFor(key);
      const acts=g.actions||[],done=acts.filter(a=>a.done).length;
      output+='<details class="wb-goal" data-wb-goal-details="'+attr(key)+'" '+(goalOpen.has(key)?'open':'')+'>'+
        '<summary><span class="wb-goal-summary"><strong>'+attr(g.title)+'</strong><small>'+attr(g.category||'Personal')+' · '+done+' of '+acts.length+' steps</small></span><span aria-hidden="true">⌄</span></summary>'+
        '<div class="wb-goal-editor">'+
        '<label>Goal name<input type="text" maxlength="160" data-wb-goal-field="title" data-wb-goal="'+attr(key)+'" value="'+attr(g.title)+'"></label>'+
        '<label>Category<select data-wb-goal-field="category" data-wb-goal="'+attr(key)+'">'+
        state.categories.map(c=>'<option value="'+attr(c)+'" '+(g.category===c?'selected':'')+'>'+attr(c)+'</option>').join('')+'</select></label>'+
        '<label>Motivation<textarea maxlength="3000" rows="2" data-wb-goal-field="motivation" data-wb-goal="'+attr(key)+'" placeholder="Why it matters (optional)">'+attr(g.motivation||'')+'</textarea></label>'+
        '<div class="wb-block-title"><h3>Steps</h3><small>'+done+' / '+acts.length+'</small></div>';
      for(let i=0;i<acts.length;i++){
        const a=acts[i];
        output+='<div class="wb-step goal-step-row"><input type="checkbox" data-wb-step-check="'+attr(key)+'" data-wb-step="'+attr(a.id)+'" aria-label="Complete '+attr(a.title)+'" '+(a.done?'checked':'')+'>'+
          '<input type="text" maxlength="160" value="'+attr(a.title)+'" data-wb-step-title="'+attr(key)+'" data-wb-step="'+attr(a.id)+'" aria-label="Step '+(i+1)+'">'+
          '<button type="button" data-wb-step-move="'+attr(key)+'" data-wb-step="'+attr(a.id)+'" data-wb-dir="-1" aria-label="Move step up" '+(i===0?'disabled':'')+'>↑</button>'+
          '<button type="button" data-wb-step-move="'+attr(key)+'" data-wb-step="'+attr(a.id)+'" data-wb-dir="1" aria-label="Move step down" '+(i===acts.length-1?'disabled':'')+'>↓</button>'+
          '<button type="button" data-wb-step-delete="'+attr(key)+'" data-wb-step="'+attr(a.id)+'" aria-label="Remove step">×</button></div>';
      }
      output+='<button type="button" class="wb-add-step goal-step-add" data-wb-step-add="'+attr(key)+'">+ Add Step</button></div></details>';
    }
    return output;
  }
  function selectDayMarkup(){
    const dates=datesForWeek();
    let output='<div class="wb-days-strip" aria-label="Select a day">';
    for(const date of dates)output+='<button type="button" data-wb-select-day="'+date+'" aria-pressed="'+String(draft.selectedDay===date)+'">'+dayName(date).slice(0,1)+'<strong>'+dateObject(date).getDate()+'</strong></button>';
    return output+'</div>';
  }
  function eventMarkup(event){
    return '<button type="button" class="wb-event" data-wb-edit-event="'+attr(event.wbKey)+'">'+
      attr(event.title)+'<time>'+attr(timeText(event.time)||'No time')+'</time></button>';
  }
  function scheduleMarkup(){
    const all=effectiveEvents(),dates=datesForWeek();
    const byDay=date=>all.filter(e=>e.date===date).sort((a,b)=>String(a.time||'').localeCompare(String(b.time||'')));
    let calendar='<div class="wb-calendar" aria-label="Weekly calendar">';
    for(const date of dates){
      calendar+='<div class="wb-day '+(draft.selectedDay===date?'wb-selected':'')+'">'+
        '<button type="button" class="wb-day-select" data-wb-select-day="'+date+'">'+dayName(date)+' '+dateObject(date).getDate()+'</button>'+
        (byDay(date).map(eventMarkup).join('')||'<span class="wb-hint">—</span>')+
        '</div>';
    }
    calendar+='</div>';
    const daily='<div class="wb-day-detail wb-block"><div class="wb-block-title"><h3>'+attr(dateObject(draft.selectedDay).toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'}))+'</h3>'+
      '<small>'+byDay(draft.selectedDay).length+' events</small></div>'+
      (byDay(draft.selectedDay).length?'<div class="wb-list">'+byDay(draft.selectedDay).map(eventMarkup).join('')+'</div>':'<p class="wb-empty">Nothing scheduled yet.</p>')+'</div>';
    const f=draft.eventForm;
    return '<h3 class="wb-section-heading">Schedule your week</h3><p class="wb-subtext">Tap a day or an event. New events appear here immediately in your draft.</p>'+
      '<div class="wb-week-pager"><button type="button" data-wb-week="-1" aria-label="Previous planning week">‹</button><strong>'+dateRange(draft.weekStart)+'</strong>'+
      '<button type="button" data-wb-week="1" aria-label="Next planning week">›</button></div>'+
      selectDayMarkup()+calendar+daily+
      '<section class="wb-block"><div class="wb-block-title"><h3>'+(draft.editingEvent?'Edit event':'Add event')+'</h3><small>'+niceDate(f.date||draft.selectedDay)+'</small></div>'+
      '<form id="wbEventForm" class="wb-event-editor"><label>Event name<input name="title" maxlength="160" required placeholder="Meeting, class, appointment…" value="'+attr(f.title||'')+'"></label>'+
      '<label>Date<input type="date" name="date" required value="'+attr(f.date||draft.selectedDay)+'"></label>'+
      '<label>Time<input type="time" name="time" required value="'+attr(f.time||'09:00')+'"></label>'+
      '<div class="wb-event-actions">'+(draft.editingEvent?'<button class="wb-secondary-action" type="button" data-wb-event-cancel>Cancel edit</button>':'')+
      '<button class="wb-input-button" type="submit">'+(draft.editingEvent?'Save event change':'+ Add event')+'</button></div></form></section>';
  }
  function prioritiesMarkup(){
    const ids=priorityIds();
    const relevant=allAvailableTasks().filter(t=>{
      const due=draft.carry[idString(t.id)]||t.dueDate||'';
      return !doneTask(t)&&(ids.includes(idString(t.id))||(due>=draft.weekStart&&due<=add(draft.weekStart,6)));
    });
    let ordered='<div class="wb-order" id="wbPriorityOrder">';
    for(let i=0;i<ids.length;i++){
      const t=allAvailableTasks().find(t=>idString(t.id)===ids[i]);
      if(!t||doneTask(t))continue;
      ordered+='<div class="wb-priority" data-wb-priority-row="'+attr(ids[i])+'" draggable="true">'+
        '<button type="button" data-wb-drag="'+attr(ids[i])+'" aria-label="Drag to reorder '+attr(t.title)+'">⠿</button>'+
        '<span class="wb-priority-num">'+roman(i+1)+'</span>'+
        '<span class="wb-priority-title">'+attr(t.title)+'<small>'+(t.dueDate?'Due '+niceDate(t.dueDate):'No deadline')+'</small></span>'+
        '<span class="wb-order-actions">'+
        '<button type="button" data-wb-move-priority="'+attr(ids[i])+'" data-wb-dir="-1" aria-label="Move priority up" '+(i===0?'disabled':'')+'>↑</button>'+
        '<button type="button" data-wb-move-priority="'+attr(ids[i])+'" data-wb-dir="1" aria-label="Move priority down" '+(i===ids.length-1?'disabled':'')+'>↓</button>'+
        '<button type="button" data-wb-remove-priority="'+attr(ids[i])+'" aria-label="Remove from priorities">×</button></span></div>';
    }
    ordered+='</div>';
    let available='<div class="wb-list">';
    for(const t of relevant.filter(t=>!ids.includes(idString(t.id)))){
      available+='<div class="wb-row"><span class="wb-row-main">'+attr(t.title)+'<small>'+(t.dueDate?'Due '+niceDate(t.dueDate):'No deadline')+'</small></span>'+
        '<button type="button" class="wb-inline-action" data-wb-add-priority="'+attr(t.id)+'">+ Prioritize</button></div>';
    }
    available+='</div>';
    const form=draft.taskForm;
    return '<h3 class="wb-section-heading">Set your priorities</h3><p class="wb-subtext">Rank what matters this week. Drag to reorder, or use the arrows.</p>'+
      '<section class="wb-block"><div class="wb-block-title"><h3>Priority order</h3><small>'+ids.length+' selected</small></div>'+
      (ids.length?ordered:'<p class="wb-empty">No priorities selected.</p>')+'</section>'+
      '<section class="wb-block"><div class="wb-block-title"><h3>Tasks due this week</h3></div>'+available+'</section>'+
      '<section class="wb-block"><div class="wb-block-title"><h3>Add a priority task</h3></div>'+
      '<form class="wb-new-priority" id="wbNewTaskForm"><label>Task name<input maxlength="160" required name="title" value="'+attr(form.title||'')+'" placeholder="What needs to get done?"></label>'+
      '<label>Due date<input name="dueDate" type="date" value="'+attr(form.dueDate||draft.weekStart)+'"></label>'+
      '<label>Connected goal<select name="goalId"><option value="">None</option>'+
      state.goals.map(g=>'<option value="'+attr(g.id)+'" '+(idString(form.goalId)===idString(g.id)?'selected':'')+'>'+attr(g.title)+'</option>').join('')+
      '</select></label><button type="submit" class="wb-input-button">+ Add task</button></form></section>';
  }
  function reviewMarkup(){
    const first=previousWeek();
    const taskChanges=Object.entries(draft.taskDone).filter(([id,val])=>{const t=current(id);return t&&t.done!==val;});
    const habitChanges=[];
    for(const [id,days] of Object.entries(draft.habitDays)){
      const h=state.habits.find(h=>idString(h.id)===id);
      if(h)for(const [date,val] of Object.entries(days))if(!!h.days?.[date]!==!!val)habitChanges.push((val?'✓ ':'○ ')+h.title+' · '+niceDate(date));
    }
    const goalChanges=Object.entries(draft.goals).filter(([id,g])=>{
      const orig=state.goals.find(x=>idString(x.id)===id);
      return orig&&JSON.stringify(orig)!==JSON.stringify(g);
    }).map(([,g])=>g.title+' · '+g.actions.filter(a=>a.done).length+'/'+g.actions.length+' steps');
    const eventChanges=draft.newEvents.map(e=>'+ '+e.title+' · '+niceDate(e.date)+' '+timeText(e.time));
    for(const [id,e] of Object.entries(draft.eventEdits)){
      const old=state.events.find(x=>idString(x.id)===id);
      if(old&&['title','date','time'].some(k=>e[k]!==old[k]))eventChanges.push('Edit '+e.title+' · '+niceDate(e.date)+' '+timeText(e.time));
    }
    const carry=Object.entries(draft.carry).filter(([id,date])=>current(id)?.dueDate!==date).map(([id,date])=>current(id)?.title+' → '+niceDate(date));
    const priorityRows=draft.priorityTouched?priorityIds().map((id,i)=>{
      const t=allAvailableTasks().find(x=>idString(x.id)===id);
      return t?(i+1)+'. '+t.title:'';
    }).filter(Boolean):[];
    const groups=[
      ['Last week',taskChanges.map(([id,val])=>(val?'✓ ':'○ ')+current(id).title).concat(habitChanges)],
      ['Goal updates',goalChanges],
      ['Calendar',eventChanges],
      ['Carry forward',carry],
      ['New tasks',draft.newTasks.map(t=>t.title+' · '+(t.dueDate?niceDate(t.dueDate):'No deadline'))],
      ['Priority order',priorityRows]
    ];
    let markup='<h3 class="wb-section-heading">Review your weekly blueprint</h3>'+
      '<p class="wb-subtext">'+dateRange(draft.weekStart)+' · Review everything before applying changes to your actual planner.</p>';
    for(const [name,items] of groups){
      markup+='<section class="wb-review-group"><h3>'+attr(name)+' <span class="wb-hint">('+items.length+')</span></h3>'+
        (items.length?items.map(item=>'<p>'+attr(item)+'</p>').join(''):'<p>Nothing to change.</p>')+'</section>';
    }
    const conflicts=[];
    const events=effectiveEvents();
    for(const e of events){
      if(!e.time)continue;
      if(events.some(x=>x.wbKey!==e.wbKey&&x.date===e.date&&x.time===e.time&&x.title!==e.title)){
        const label=niceDate(e.date)+' · '+timeText(e.time);
        if(!conflicts.includes(label))conflicts.push(label);
      }
    }
    if(conflicts.length)markup+='<p class="wb-subtext">Potential calendar overlaps: '+attr(conflicts.join(', '))+'. Review the times before applying.</p>';
    if(!meaningfulChanges())markup+='<p class="wb-empty">No changes yet. You can finish without modifying your planner.</p>';
    return markup;
  }
  const renderers=[reportMarkup,goalsMarkup,scheduleMarkup,prioritiesMarkup,reviewMarkup];
  function renderSheet(resetScroll){
    if(!draft)return;
    E('wbTitle').textContent=STEPS[draft.step];
    E('wbProgress').innerHTML=STEPS.map((name,i)=>
      '<button type="button" data-wb-step="'+i+'" '+(i===draft.step?'aria-current="step"':'')+
      ' class="'+(i<draft.step?'wb-done':'')+'">'+name+'</button>').join('');
    const main=E('wbMain'),top=resetScroll?0:main.scrollTop;
    main.innerHTML=renderers[draft.step]();
    main.scrollTop=top;
    E('wbBackButton').disabled=draft.step===0;
    E('wbNextButton').textContent=draft.step===4?'Apply Weekly Blueprint':'Continue';
    E('wbNextButton').disabled=draft.step===4&&!meaningfulChanges();
    E('wbStatus').textContent='';
  }
  function editEvent(key){
    const e=effectiveEvents().find(e=>e.wbKey===key);
    if(!e)return;
    draft.editingEvent=key;
    draft.selectedDay=e.date;
    draft.eventForm={title:e.title,date:e.date,time:e.time||'09:00'};
    storeDraft();renderSheet(false);
  }
  function saveEvent(){
    const form=E('wbEventForm');
    if(!form||!form.reportValidity())return;
    const raw=new FormData(form);
    const info={title:clean(raw.get('title')).slice(0,160),date:String(raw.get('date')||''),time:String(raw.get('time')||'')};
    if(!info.title||!/^\d{4}-\d{2}-\d{2}$/.test(info.date)||!/^\d{2}:\d{2}$/.test(info.time))return;
    if(draft.editingEvent?.startsWith('existing:')){
      draft.eventEdits[draft.editingEvent.slice(9)]=info;
    }else if(draft.editingEvent?.startsWith('new:')){
      const old=draft.newEvents.find(e=>idString(e.id)===draft.editingEvent.slice(4));
      if(old)Object.assign(old,info);
    }else{
      const duplicate=effectiveEvents().some(e=>e.title.toLocaleLowerCase()===info.title.toLocaleLowerCase()&&e.date===info.date&&e.time===info.time);
      if(duplicate){E('wbStatus').textContent='This event already exists on that day at that time.';return;}
      draft.newEvents.push({id:'wbe-'+uid(),...info});
    }
    draft.editingEvent=null;draft.selectedDay=info.date;
    draft.eventForm={title:'',date:info.date,time:'09:00'};
    storeDraft();renderSheet(false);
  }
  function priorityMove(from,to){
    const ids=priorityIds().slice(),i=ids.indexOf(from),j=ids.indexOf(to);
    if(i<0||j<0||i===j)return;
    ids.splice(i,1);ids.splice(j,0,from);
    draft.priority=ids;draft.priorityTouched=true;storeDraft();renderSheet(false);
  }
  function apply(){
    if(!draft||draft.step!==4||!meaningfulChanges())return;
    const before={};for(const key of FIELDS)before[key]=clone(state[key]);
    const next=clone(before),find=(key,id)=>next[key].find(x=>idString(x.id)===idString(id));
    const fail=message=>{E('wbStatus').textContent=message;return false;};
    try{
      for(const id of Object.keys(draft.taskDone))if(!find('tasks',id))throw Error('A task was removed while this plan was open. Review your draft first.');
      for(const id of Object.keys(draft.goals))if(!find('goals',id))throw Error('A goal was removed while this plan was open. Review your draft first.');
      for(const id of Object.keys(draft.eventEdits))if(!find('events',id))throw Error('An event was removed while this plan was open. Review your draft first.');
      for(const id of Object.keys(draft.habitDays))if(!find('habits',id))throw Error('A habit was removed while this plan was open. Review your draft first.');
      // Apply goal edits, keeping task and habit links to unchanged step IDs.
      for(const [id,update] of Object.entries(draft.goals)){
        const g=find('goals',id),oldActions=g.actions||[];
        g.title=clean(update.title).slice(0,160)||g.title;
        g.category=state.categories.includes(update.category)?update.category:g.category;
        g.motivation=String(update.motivation||'').slice(0,3000);
        g.actions=clone(update.actions||[]).filter(a=>clean(a.title)).map(a=>({id:a.id,title:clean(a.title).slice(0,160),done:!!a.done}));
        const retained=new Set(g.actions.map(a=>idString(a.id)));
        for(const t of next.tasks){
          if(idString(t.goalId||'')!==id)continue;
          const old=oldActions.find(a=>idString(a.id)===idString(t.actionId||''))||oldActions[Number(t.actionIndex)];
          if(old&&!retained.has(idString(old.id))){t.goalId='';t.actionId='';t.actionIndex='';}
          else if(old){t.actionId=old.id;t.actionIndex=g.actions.findIndex(a=>idString(a.id)===idString(old.id));}
        }
        for(const h of next.habits){
          if(idString(h.goalId||'')===id&&!retained.has(idString(h.actionId||''))){h.goalId='';h.actionId='';}
        }
        for(const t of next.tasks){
          if(idString(t.goalId||'')!==id)continue;
          const step=g.actions.find(a=>idString(a.id)===idString(t.actionId||''));
          if(step)t.done=!!step.done;
        }
      }
      for(const [id,done] of Object.entries(draft.taskDone)){
        const t=find('tasks',id);t.done=!!done;
        const g=find('goals',t.goalId);
        const step=g?.actions?.find(a=>idString(a.id)===idString(t.actionId||''));
        if(step)step.done=!!done;
        const idea=next.ideas.find(i=>idString(i.id)===idString(t.ideaId));
        const ia=idea?.actions?.find(a=>idString(a.id)===idString(t.ideaActionId));
        if(ia)ia.done=!!done;
      }
      for(const [id,dates] of Object.entries(draft.habitDays)){
        const h=find('habits',id);if(!h.days||typeof h.days!=='object')h.days={};
        for(const [date,val] of Object.entries(dates)){
          if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!isScheduled(h,date))throw Error('An invalid habit date was supplied.');
          h.days[date]=!!val;
        }
      }
      for(const [id,date] of Object.entries(draft.carry)){
        const t=find('tasks',id);
        if(!t||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Invalid carry-forward task.');
        if(!t.done){t.dueDate=date;t.date=date;}
      }
      for(const [id,update] of Object.entries(draft.eventEdits)){
        const event=find('events',id);
        Object.assign(event,{title:clean(update.title).slice(0,160),date:update.date,time:update.time});
      }
      for(const e of draft.newEvents){
        if(!clean(e.title)||!/^\d{4}-\d{2}-\d{2}$/.test(e.date)||!/^\d{2}:\d{2}$/.test(e.time))throw Error('Invalid event in draft.');
        const duplicate=next.events.some(old=>old.title.toLocaleLowerCase()===e.title.toLocaleLowerCase()&&old.date===e.date&&old.time===e.time);
        if(!duplicate)next.events.push({id:uid(),title:e.title.slice(0,160),date:e.date,time:e.time});
      }
      const newTaskIds={};
      for(const t of draft.newTasks){
        const newId=uid();newTaskIds[idString(t.id)]=idString(newId);
        next.tasks.push({id:newId,title:t.title,dueDate:t.dueDate||'',date:t.dueDate||'',scheduledDate:'',scheduledTime:'',done:false,priority:false,priorityRank:0,goalId:t.goalId||'',actionId:'',actionIndex:''});
      }
      if(draft.priorityTouched){
        const order=priorityIds().map(id=>newTaskIds[id]||id);
        for(const t of next.tasks){t.priority=false;t.priorityRank=0;}
        let count=0;
        for(const id of order){
          const t=find('tasks',id);
          if(t&&!t.done){t.priority=true;t.priorityRank=++count;}
        }
      }
      // Persist a precise undo snapshot, then commit all affected collections
      // together through the app's verified, existing storage writer.
      const snapshot={version:1,before,after:clone(next),weekStart:draft.weekStart,created:Date.now()};
      try{localStorage.setItem(UNDO_KEY,JSON.stringify(snapshot));}
      catch{throw Error('Not enough space to prepare an undo. Nothing has been applied.');}
      for(const key of FIELDS)state[key]=next[key];
      if(!save(true)){
        for(const key of FIELDS)state[key]=before[key];
        localStorage.removeItem(UNDO_KEY);
        throw Error('Unable to save the plan. Your draft is still available.');
      }
      selectedWeek=dateObject(draft.weekStart);
      localStorage.removeItem(DRAFT_KEY);
      draft=null;
      close();
      render();
      renderOverview();
      return true;
    }catch(error){
      if(error?.message)fail(error.message);
      console.error('Weekly Blueprint apply failed',error);
      return false;
    }
  }
  function undo(){
    const snapshot=read(UNDO_KEY);
    if(!snapshot||snapshot.version!==1)return;
    for(const key of FIELDS){
      if(JSON.stringify(state[key])!==JSON.stringify(snapshot.after[key])){
        alert('Other planner changes were made after Weekly Blueprint. Undo is unavailable to protect newer edits.');
        return;
      }
    }
    if(!confirm('Undo the last Weekly Blueprint? This restores your previous tasks, goals, habits and events.'))return;
    const now={};for(const key of FIELDS)now[key]=state[key];
    for(const key of FIELDS)state[key]=snapshot.before[key];
    if(!save(true)){
      for(const key of FIELDS)state[key]=now[key];
      alert('Unable to save the undo. Your current planner is unchanged.');
      return;
    }
    localStorage.removeItem(UNDO_KEY);
    render();renderOverview();
  }
  function renderOverview(){
    const goals=E('wbOverviewGoals'),upcoming=E('wbOverviewUpcoming'),status=E('wbDraftStatus'),undoRegion=E('wbUndoRegion');
    if(!goals||!upcoming||!status||!undoRegion)return;
    status.textContent=draft?'Unfinished plan saved · Resume anytime':'Five short steps · Changes stay in draft until applied';
    E('wbStartButton')?.setAttribute('aria-label',draft?'Resume Weekly Blueprint':'Design Your Week');
    goals.innerHTML=state.goals.length?state.goals.slice(0,5).map(g=>{
      const total=(g.actions||[]).length,complete=(g.actions||[]).filter(a=>a.done).length;
      const pct=total?Math.round(complete/total*100):0;
      return '<button type="button" class="wb-overview-goal" data-wb-open-goal="'+attr(g.id)+'"><strong>'+attr(g.title)+'</strong>'+
        '<div class="wb-mini-track"><span style="width:'+pct+'%"></span></div>'+
        '<small>'+complete+' of '+total+' steps · '+attr(g.category||'Personal')+'</small></button>';
    }).join(''):'<p class="wb-empty">Create your first goal in Goals.</p>';
    const start=iso(startOfWeek(new Date())),end=add(start,13);
    const upcomingEvents=state.events.filter(e=>e.date>=start&&e.date<=end).map(e=>({date:e.date,title:e.title,time:e.time,type:'Event'}));
    const upcomingTasks=state.tasks.filter(t=>!t.done&&t.dueDate>=start&&t.dueDate<=end).map(t=>({date:t.dueDate,title:t.title,time:'',type:'Task'}));
    const lines=[...upcomingEvents,...upcomingTasks].sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||'')).slice(0,7);
    upcoming.innerHTML=lines.length?lines.map(x=>'<div class="wb-upcoming-line"><span>'+niceDate(x.date)+'</span><span>'+attr(x.title)+' <small class="wb-hint">· '+x.type+'</small></span></div>').join(''):'<p class="wb-empty">No commitments in the next two weeks.</p>';
    const record=read(UNDO_KEY);
    undoRegion.innerHTML=record?'<div class="wb-undo"><span class="wb-hint">A Weekly Blueprint was applied. Undo is available until further planner changes.</span><button type="button" data-wb-undo>Undo last plan</button></div>':'';
  }
  function changePriority(key,delta){
    const ids=priorityIds().slice(),i=ids.indexOf(key),j=i+delta;
    if(i<0||j<0||j>=ids.length)return;
    [ids[i],ids[j]]=[ids[j],ids[i]];
    draft.priority=ids;draft.priorityTouched=true;storeDraft();renderSheet(false);
  }
  overlay.addEventListener('submit',function(e){
    if(e.target.id==='wbEventForm'){e.preventDefault();saveEvent();}
    if(e.target.id==='wbNewTaskForm'){
      e.preventDefault();
      const f=new FormData(e.target),title=clean(f.get('title')).slice(0,160);
      if(!title||!e.target.reportValidity())return;
      const newTask={id:'wbt-'+uid(),title,dueDate:String(f.get('dueDate')||draft.weekStart),goalId:String(f.get('goalId')||'')};
      draft.newTasks.push(newTask);
      draft.priority=priorityIds().concat(idString(newTask.id));
      draft.priorityTouched=true;
      draft.taskForm={title:'',dueDate:newTask.dueDate,goalId:newTask.goalId};
      storeDraft();renderSheet(false);
    }
  });
  overlay.addEventListener('input',function(e){
    const x=e.target;
    if(x.dataset.wbGoalField){
      const g=editableGoal(x.dataset.wbGoal);if(!g)return;
      g[x.dataset.wbGoalField]=x.value;
    }else if(x.dataset.wbStepTitle){
      const g=editableGoal(x.dataset.wbStepTitle),step=g?.actions.find(a=>idString(a.id)===x.dataset.wbStep);
      if(step)step.title=x.value;
    }else if(x.closest('#wbEventForm')){
      const f=x.closest('form');
      draft.eventForm={title:f.elements.title.value,date:f.elements.date.value,time:f.elements.time.value};
    }else if(x.closest('#wbNewTaskForm')){
      const f=x.closest('form');
      draft.taskForm={title:f.elements.title.value,dueDate:f.elements.dueDate.value,goalId:f.elements.goalId.value};
    }else return;
    storeDraft();
  });
  overlay.addEventListener('change',function(e){
    const x=e.target;
    if(x.dataset.wbTaskDone){
      draft.taskDone[x.dataset.wbTaskDone]=x.checked;
      if(x.checked)delete draft.carry[x.dataset.wbTaskDone];
      storeDraft();renderSheet(false);
    }else if(x.dataset.wbHabit){
      const hid=x.dataset.wbHabit;
      if(!draft.habitDays[hid])draft.habitDays[hid]={};
      draft.habitDays[hid][x.dataset.wbDate]=x.checked;
      storeDraft();
    }else if(x.dataset.wbCarry){
      if(x.checked)draft.carry[x.dataset.wbCarry]=draft.weekStart;else delete draft.carry[x.dataset.wbCarry];
      storeDraft();renderSheet(false);
    }else if(x.dataset.wbCarryDate){
      draft.carry[x.dataset.wbCarryDate]=x.value;
      storeDraft();
    }else if(x.dataset.wbStepCheck){
      const g=editableGoal(x.dataset.wbStepCheck),step=g?.actions.find(a=>idString(a.id)===x.dataset.wbStep);
      if(step){step.done=x.checked;storeDraft();renderSheet(false);}
    }else if(x.dataset.wbGoalField||x.dataset.wbStepTitle)storeDraft();
  });
  overlay.addEventListener('toggle',function(e){
    const detail=e.target.closest?.('[data-wb-goal-details]');
    if(!detail)return;
    if(detail.open)goalOpen.add(detail.dataset.wbGoalDetails);
    else goalOpen.delete(detail.dataset.wbGoalDetails);
  },true);
  overlay.addEventListener('click',function(e){
    const button=e.target.closest('button');
    if(!button)return;
    if(button.hasAttribute('data-wb-close')){close();return;}
    if(button.dataset.wbStep!==undefined){setStep(Number(button.dataset.wbStep));return;}
    if(button.hasAttribute('data-wb-back')){setStep(draft.step-1);return;}
    if(button.hasAttribute('data-wb-next')){if(draft.step===4)apply();else setStep(draft.step+1);return;}
    if(button.dataset.wbWeek){weekChange(Number(button.dataset.wbWeek));return;}
    if(button.dataset.wbSelectDay){draft.selectedDay=button.dataset.wbSelectDay;if(!draft.editingEvent)draft.eventForm.date=draft.selectedDay;storeDraft();renderSheet(false);return;}
    if(button.dataset.wbEditEvent){editEvent(button.dataset.wbEditEvent);return;}
    if(button.hasAttribute('data-wb-event-cancel')){
      draft.editingEvent=null;draft.eventForm={title:'',date:draft.selectedDay,time:'09:00'};storeDraft();renderSheet(false);return;
    }
    if(button.dataset.wbStepAdd){
      const g=editableGoal(button.dataset.wbStepAdd);
      if(!g)return;
      const id='a-wb-'+uid();
      g.actions.push({id,title:'',done:false});
      goalOpen.add(idString(g.id));
      storeDraft();renderSheet(false);
      const focus=[...overlay.querySelectorAll('[data-wb-step-title]')].find(x=>x.dataset.wbStep===id);
      if(focus)focus.focus({preventScroll:true});
      return;
    }
    if(button.dataset.wbStepMove){
      const g=editableGoal(button.dataset.wbStepMove);
      const i=g?.actions.findIndex(a=>idString(a.id)===button.dataset.wbStep);
      const j=i+Number(button.dataset.wbDir);
      if(i>=0&&j>=0&&j<g.actions.length){
        [g.actions[i],g.actions[j]]=[g.actions[j],g.actions[i]];
        storeDraft();renderSheet(false);
      }
      return;
    }
    if(button.dataset.wbStepDelete){
      const g=editableGoal(button.dataset.wbStepDelete);
      if(g){g.actions=g.actions.filter(a=>idString(a.id)!==button.dataset.wbStep);storeDraft();renderSheet(false);}
      return;
    }
    if(button.dataset.wbMovePriority){changePriority(button.dataset.wbMovePriority,Number(button.dataset.wbDir));return;}
    if(button.dataset.wbRemovePriority){
      draft.priority=priorityIds().filter(id=>id!==button.dataset.wbRemovePriority);
      draft.priorityTouched=true;storeDraft();renderSheet(false);return;
    }
    if(button.dataset.wbAddPriority){
      draft.priority=priorityIds().concat(button.dataset.wbAddPriority);
      draft.priorityTouched=true;storeDraft();renderSheet(false);return;
    }
  });
  overlay.addEventListener('dragstart',e=>{
    const row=e.target.closest('[data-wb-priority-row]');if(!row)return;
    dragged=row.dataset.wbPriorityRow;
    e.dataTransfer.effectAllowed='move';
    try{e.dataTransfer.setData('text/plain',dragged);}catch{}
  });
  overlay.addEventListener('dragover',e=>{
    const row=e.target.closest('[data-wb-priority-row]');if(!row||!dragged)return;
    e.preventDefault();e.dataTransfer.dropEffect='move';
    overlay.querySelectorAll('.wb-drag-target').forEach(x=>x.classList.remove('wb-drag-target'));
    row.classList.add('wb-drag-target');
  });
  overlay.addEventListener('drop',e=>{
    const row=e.target.closest('[data-wb-priority-row]');if(!row||!dragged)return;
    e.preventDefault();priorityMove(dragged,row.dataset.wbPriorityRow);dragged=null;
  });
  overlay.addEventListener('dragend',()=>{
    dragged=null;
    overlay.querySelectorAll('.wb-drag-target').forEach(x=>x.classList.remove('wb-drag-target'));
  });
  overlay.addEventListener('pointerdown',e=>{
    const handle=e.target.closest('[data-wb-drag]');
    if(!handle||e.pointerType==='mouse')return;
    pointerDrag={id:handle.dataset.wbDrag,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY};
    try{handle.setPointerCapture(e.pointerId);}catch{}
  });
  overlay.addEventListener('pointerup',e=>{
    if(!pointerDrag||pointerDrag.pointerId!==e.pointerId)return;
    const moved=Math.hypot(e.clientX-pointerDrag.startX,e.clientY-pointerDrag.startY);
    const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-wb-priority-row]');
    if(moved>12&&target)priorityMove(pointerDrag.id,target.dataset.wbPriorityRow);
    pointerDrag=null;
  });
  overlay.addEventListener('pointercancel',()=>{pointerDrag=null;});
  overlay.addEventListener('keydown',function(e){
    if(e.key==='Escape'){e.preventDefault();close();return;}
    if(e.key!=='Tab')return;
    const controls=[...overlay.querySelectorAll('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),a[href]')].filter(x=>x.getClientRects().length);
    if(!controls.length)return;
    const first=controls[0],last=controls[controls.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  });
  overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
  document.addEventListener('click',e=>{
    const launch=e.target.closest('[data-wb-launch],[data-wb-launch-week]');
    if(launch){open(launch.hasAttribute('data-wb-launch-week'));return;}
    if(e.target.closest('[data-wb-view-goals]')){planTab('goals');return;}
    if(e.target.closest('[data-wb-view-week]')){tab('week');return;}
    const goal=e.target.closest('[data-wb-open-goal]');
    if(goal){expandedGoals.add(goal.dataset.wbOpenGoal);selectedCategory='All';planTab('goals');render();return;}
    if(e.target.closest('[data-wb-undo]'))undo();
  });
  const oldRender=render;
  render=function(){oldRender();renderOverview();};
  renderOverview();
  window.BlueprintWeekly={open:()=>open(false),close,getDraft:()=>draft?clone(draft):null,hasDraft:()=>!!draft};
})();
