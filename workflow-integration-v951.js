'use strict';
/* Blueprint v9.51: lightweight task gestures and shared Project dashboards.
   Uses only existing state.tasks, state.habits, state.goals and state.projects.
   All edits use the guarded planner save; no duplicate collections or keys. */
(function(){
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const findTask=id=>state.tasks.find(t=>String(t.id)===String(id));
  const safeDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''))?String(value):'';
  const addDays=(n,date=new Date())=>{const d=new Date(date.getFullYear(),date.getMonth(),date.getDate());d.setDate(d.getDate()+n);return iso(d);};
  const formatDate=value=>safeDate(value)?new Date(value+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}):'';
  function updateTask(task,fields){
    if(!task)return false;
    const before=Object.fromEntries(Object.keys(fields).map(k=>[k,task[k]]));
    const project=state.projects.find(p=>String(p.id)===String(task.projectId||''));
    const action=project?.actions?.find(a=>String(a.id)===String(task.projectActionId||''));
    const previousAction=action?{...action}:null;
    Object.assign(task,fields);
    if('done' in fields)v6SyncTaskAction(task);
    if(!save(true)){
      Object.assign(task,before);
      if(action&&previousAction)Object.assign(action,previousAction);
      render('tasks');
      return false;
    }
    render('tasks');
    window.v919RenderProjectOverview?.(v6Project());
    return true;
  }
  const menu=document.createElement('div');
  menu.id='bpTaskDates';
  menu.className='bp-task-date-menu';
  menu.setAttribute('role','dialog');
  menu.setAttribute('aria-label','Task dates');
  menu.hidden=true;
  menu.innerHTML='<div class="bp-task-date-menu-heading"><strong>Task dates</strong><button type="button" data-bp-date-close aria-label="Close date picker">×</button></div>'+
    '<div class="bp-task-date-presets"><button type="button" data-bp-date-preset="today">Today</button>'+
    '<button type="button" data-bp-date-preset="tomorrow">Tomorrow</button>'+
    '<button type="button" data-bp-date-preset="week">In 7 days</button>'+
    '<button type="button" data-bp-date-preset="clear">No deadline</button></div>'+
    '<label>Deadline <input type="date" data-bp-date-input></label>'+
    '<div class="bp-task-menu-divider"></div>'+
    '<label>On calendar <input type="date" data-bp-plan-input></label>'+
    '<label>Time (optional) <input type="time" data-bp-time-input></label>'+
    '<div class="bp-task-menu-actions"><button type="button" data-bp-plan-clear>Clear plan</button><button type="button" data-bp-plan-apply>Save schedule</button></div>';
  document.body.append(menu);
  let openedTask=null,restoreFocus=null;
  function closeMenu(){
    if(menu.hidden)return;
    menu.hidden=true;
    const focus=restoreFocus;
    restoreFocus=null;openedTask=null;
    if(focus?.isConnected)focus.focus({preventScroll:true});
  }
  function placeMenu(anchor){
    const rect=anchor.getBoundingClientRect(),vw=window.visualViewport?.width||innerWidth,
      vh=window.visualViewport?.height||innerHeight;
    const width=Math.min(316,Math.max(250,vw-24));
    menu.style.width=width+'px';
    const left=Math.max(12,Math.min(rect.left,vw-width-12));
    menu.style.left=left+'px';
    menu.style.top=Math.max(12,Math.min(rect.bottom+8,vh-menu.getBoundingClientRect().height-12))+'px';
  }
  function openMenu(anchor,id){
    const task=findTask(id);
    if(!task)return;
    closeMenu();
    openedTask=String(id);restoreFocus=anchor;
    menu.querySelector('[data-bp-date-input]').value=safeDate(task.dueDate);
    menu.querySelector('[data-bp-plan-input]').value=safeDate(task.scheduledDate);
    menu.querySelector('[data-bp-time-input]').value=task.scheduledTime||'';
    menu.hidden=false;
    placeMenu(anchor);
    menu.querySelector('[data-bp-date-input]').focus({preventScroll:true});
  }
  function setDeadline(date){
    const task=findTask(openedTask);
    if(!task)return;
    if(updateTask(task,{dueDate:date,date})){
      const id=openedTask;closeMenu();
      // Preserve the existing focus route even when render replaces the row.
      document.querySelector('[data-bp-task-date="'+CSS.escape(id)+'"]')?.focus({preventScroll:true});
    }
  }
  menu.addEventListener('click',e=>{
    const button=e.target.closest('button');if(!button)return;
    if(button.hasAttribute('data-bp-date-close')){closeMenu();return;}
    const preset=button.dataset.bpDatePreset;
    if(preset){
      setDeadline(preset==='today'?localToday():preset==='tomorrow'?addDays(1):preset==='week'?addDays(7):'');
      return;
    }
    if(button.hasAttribute('data-bp-plan-apply')||button.hasAttribute('data-bp-plan-clear')){
      const task=findTask(openedTask);if(!task)return;
      const clear=button.hasAttribute('data-bp-plan-clear');
      const day=clear?'':safeDate(menu.querySelector('[data-bp-plan-input]').value);
      const time=clear||!day?'':menu.querySelector('[data-bp-time-input]').value;
      if(updateTask(task,{scheduledDate:day,scheduledTime:time})){closeMenu();}
    }
  });
  menu.addEventListener('change',e=>{
    if(e.target.matches('[data-bp-date-input]'))setDeadline(safeDate(e.target.value));
  });
  document.addEventListener('click',e=>{
    if(!(e.target instanceof Element))return;
    const edit=e.target.closest('[data-bp-edit-task]');
    if(edit){e.preventDefault();openModal('task',edit.dataset.bpEditTask);return;}
    const date=e.target.closest('[data-bp-task-date]');
    if(date){e.preventDefault();openMenu(date,date.dataset.bpTaskDate);return;}
    const star=e.target.closest('[data-bp-task-star]');
    if(star){
      e.preventDefault();const t=findTask(star.dataset.bpTaskStar);
      if(!t)return;
      const priority=!t.priority;
      const priorityRank=priority?Math.max(0,...state.tasks.filter(t=>t.priority).map(t=>t.priorityRank||0))+1:0;
      updateTask(t,{priority,priorityRank});return;
    }
    const tomorrow=e.target.closest('[data-bp-swipe-tomorrow]');
    if(tomorrow){
      const t=findTask(tomorrow.dataset.bpSwipeTomorrow);
      if(t)updateTask(t,{dueDate:addDays(1),date:addDays(1)});
      return;
    }
    const projectAdd=e.target.closest('[data-bp-project-add]');
    if(projectAdd){
      const project=v6Project();
      if(!project)return;
      window.blueprintProjectCreationContext=project.id;
      openModal(projectAdd.dataset.bpProjectAdd);
      return;
    }
    if(!menu.hidden&&!menu.contains(e.target))closeMenu();
  });
  window.addEventListener('resize',closeMenu,{passive:true});
  window.addEventListener('scroll',closeMenu,true);
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&!menu.hidden){e.preventDefault();closeMenu();}
  },true);

  // One Quick Add for every tab. It opens the existing forms rather than
  // creating competing task/goal/habit/event entry paths or storage models.
  const quickTrigger=document.getElementById('bpQuickAdd');
  if(quickTrigger){
    // The iPad uses a sidebar and deliberately hides .app-header; iPhones
    // retain the header. Reparent one actual button rather than floating
    // another control over existing Add Task/Habit actions.
    const phoneHeader=document.querySelector('.app-header');
    const rail=document.querySelector('.bottom-nav');
    const railMode=matchMedia('(min-width:740px) and (min-height:600px)');
    quickTrigger.innerHTML='<svg class="icon" aria-hidden="true"><use href="#i-plus"></use></svg><span class="bp-quick-label">New</span>';
    function mountQuick(){
      const inRail=railMode.matches;
      const destination=inRail?rail:phoneHeader;
      if(!destination)return;
      if(inRail){
        const footer=rail.querySelector('.canvas-ipad-nav-footer');
        if(footer)footer.before(quickTrigger);
        else rail.append(quickTrigger);
      }else destination.append(quickTrigger);
      quickTrigger.classList.toggle('bp-quick-in-rail',inRail);
    }
    mountQuick();
    if(typeof railMode.addEventListener==='function')
      railMode.addEventListener('change',mountQuick);
    const quick=document.createElement('div');
    quick.id='bpQuickAddMenu';quick.className='bp-quick-menu';
    quick.setAttribute('role','dialog');
    quick.setAttribute('aria-label','Create in Blueprint');
    quick.hidden=true;
    quick.innerHTML='<p>Create</p>'+
      '<button type="button" data-bp-quick-kind="task"><span aria-hidden="true">☑</span>Task</button>'+
      '<button type="button" data-bp-quick-kind="event"><span aria-hidden="true">▦</span>Event</button>'+
      '<button type="button" data-bp-quick-kind="habit"><span aria-hidden="true">◎</span>Habit</button>'+
      '<button type="button" data-bp-quick-kind="goal"><span aria-hidden="true">☆</span>Goal</button>';
    document.body.append(quick);
    const hideQuick=(focus=false)=>{
      if(quick.hidden)return;
      quick.hidden=true;
      quickTrigger.setAttribute('aria-expanded','false');
      if(focus)quickTrigger.focus({preventScroll:true});
    };
    const showQuick=()=>{
      quick.hidden=false;
      quickTrigger.setAttribute('aria-expanded','true');
      const r=quickTrigger.getBoundingClientRect(),width=Math.min(240,innerWidth-24);
      quick.style.width=width+'px';
      const preferred=quickTrigger.classList.contains('bp-quick-in-rail')?r.right+8:r.right-width;
      quick.style.left=Math.max(12,Math.min(preferred,innerWidth-width-12))+'px';
      const top=quickTrigger.classList.contains('bp-quick-in-rail')?r.top:r.bottom+7;
      quick.style.top=Math.max(12,Math.min(top,innerHeight-quick.getBoundingClientRect().height-12))+'px';
      quick.querySelector('[data-bp-quick-kind]')?.focus({preventScroll:true});
    };
    window.addEventListener('resize',()=>hideQuick());
    quickTrigger.addEventListener('click',()=>{if(quick.hidden)showQuick();else hideQuick(true);});
    quick.addEventListener('click',event=>{
      const option=event.target.closest('[data-bp-quick-kind]');
      if(!option)return;
      const kind=option.dataset.bpQuickKind;
      const view=document.querySelector('.view.active')?.id;
      const project=view==='brainstorm'?v6Project():null;
      const area=view==='myplan'&&activePlanTab==='overview'?window.blueprintAreas?.currentArea?.():'';
      if(project)window.blueprintProjectCreationContext=project.id;
      else if(state.categories.includes(area))window.blueprintAreaCreationContext=area;
      hideQuick();
      openModal(kind);
    });
    document.addEventListener('click',event=>{
      if(!quick.hidden&&!quick.contains(event.target)&&!quickTrigger.contains(event.target))hideQuick();
    });
    document.addEventListener('keydown',event=>{
      if(!quick.hidden&&event.key==='Escape'){event.preventDefault();hideQuick(true);}
    },true);
    window.addEventListener('resize',()=>hideQuick(),{passive:true});
  }

  // Native-feeling horizontal reveal. Vertical gestures remain ordinary
  // scrolling; system edges and other tab navigation are unaffected.
  const SWIPE_WIDTH=96; // One swipe action: postpone the deadline.
  let gesture=null,openedRow=null,suppressClickUntil=0;
  const rowOf=target=>target instanceof Element?target.closest('[data-bp-task-row]'):null;
  function slide(row,offset){
    const main=row?.querySelector('.bp-task-main');
    if(main)main.style.transform='translate3d('+offset+'px,0,0)';
  }
  function closeRow(row){if(row){row.classList.remove('bp-task-revealed');slide(row,0);if(openedRow===row)openedRow=null;}}
  function start(e){
    if(e.touches.length!==1||!rowOf(e.target)||e.target.closest('input,select,textarea'))return;
    const p=e.touches[0],row=rowOf(e.target);
    if(openedRow&&openedRow!==row)closeRow(openedRow);
    gesture={row,x:p.clientX,y:p.clientY,dx:0,horizontal:false,wasOpen:row.classList.contains('bp-task-revealed')};
  }
  function moving(e){
    if(!gesture||e.touches.length!==1)return;
    const t=e.touches[0],dx=t.clientX-gesture.x,dy=t.clientY-gesture.y;
    if(!gesture.horizontal){
      if(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)){gesture=null;return;}
      if(Math.abs(dx)<12||Math.abs(dx)<Math.abs(dy)*1.4)return;
      gesture.horizontal=true;
    }
    gesture.dx=dx;
    slide(gesture.row,Math.max(-SWIPE_WIDTH,Math.min(0,dx+(gesture.wasOpen?-SWIPE_WIDTH:0))));
    if(e.cancelable)e.preventDefault();
  }
  function finish(){
    if(!gesture)return;
    const g=gesture;gesture=null;
    if(!g.horizontal){return;}
    const reveal=g.wasOpen?g.dx<48:g.dx<-48;
    if(reveal){
      g.row.classList.add('bp-task-revealed');slide(g.row,-SWIPE_WIDTH);openedRow=g.row;
    }else closeRow(g.row);
    suppressClickUntil=Date.now()+400;
  }
  document.addEventListener('touchstart',start,{passive:true});
  document.addEventListener('touchmove',moving,{passive:false});
  document.addEventListener('touchend',finish,{passive:true});
  document.addEventListener('touchcancel',()=>{
    if(gesture)closeRow(gesture.row);
    gesture=null;
  },{passive:true});
  document.addEventListener('click',e=>{
    if(Date.now()>suppressClickUntil||!rowOf(e.target)||e.target.closest('[data-bp-swipe-tomorrow]'))return;
    e.preventDefault();e.stopImmediatePropagation();
  },true);

  function projectPulse(p){
    const target=document.getElementById('v951ProjectPulse');
    const linked=document.getElementById('v951ProjectConnections');
    if(!target||!linked||!p)return;
    const projectTasks=state.tasks.filter(t=>String(t.projectId||'')===String(p.id));
    const goals=state.goals.filter(g=>String(g.projectId||'')===String(p.id));
    const relatedGoalIds=new Set(goals.map(g=>String(g.id)));
    const habits=state.habits.filter(h=>String(h.projectId||'')===String(p.id)||
      relatedGoalIds.has(String(h.goalId||'')));
    const completed=projectTasks.filter(t=>t.done).length;
    const next=projectTasks.filter(t=>!t.done&&(t.scheduledDate||t.dueDate))
      .sort((a,b)=>String(a.scheduledDate||a.dueDate).localeCompare(String(b.scheduledDate||b.dueDate)))[0];
    const pageCount=p.notePages?.length||0,resources=p.library?.length||0;
    target.innerHTML='<div class="v951-pulse-stat"><strong>'+completed+' / '+projectTasks.length+'</strong><span>Tasks done</span></div>'+
      '<div class="v951-pulse-stat"><strong>'+habits.length+'</strong><span>Linked habits</span></div>'+
      '<div class="v951-pulse-stat"><strong>'+goals.length+'</strong><span>Linked goals</span></div>'+
      '<div class="v951-pulse-stat"><strong>'+pageCount+' · '+resources+'</strong><span>Pages · Library</span></div>'+
      (next?'<div class="v951-pulse-next"><span>Up next</span><button type="button" data-edit-task="'+esc(next.id)+'">'+esc(next.title)+
        ' <small>'+esc(formatDate(next.scheduledDate||next.dueDate))+'</small></button></div>':'');
    const goalRows=goals.map(g=>{
      const steps=g.actions||[],done=steps.filter(a=>a.done).length;
      return '<button type="button" class="v951-connection" data-edit-goal="'+esc(g.id)+'"><span aria-hidden="true">◎</span><span>'+esc(g.title)+'</span><small>'+done+'/'+steps.length+' steps</small></button>';
    });
    const habitRows=habits.map(h=>{
      const week=habitWeekSummary(h);
      return '<button type="button" class="v951-connection" data-edit-habit="'+esc(h.id)+'"><span aria-hidden="true">◷</span><span>'+esc(h.title)+'</span><small>'+esc(week)+'</small></button>';
    });
    linked.innerHTML=goalRows.concat(habitRows).slice(0,6).join('')||
      '<span class="v951-no-links">Connect a goal or habit to keep it in this project.</span>';
  }
  const projectBoard=document.querySelector('#projectOverview .v919-project-grid');
  let orderedProject;
  const projectOrder=projectBoard&&window.BlueprintCardReorder?.({
    board:projectBoard,
    names:['notes','todo','stats','connections','library'],
    dataset:'bpProjectCard',
    selector:id=>'[data-bp-project-card="'+id+'"]',
    cardSelector:'[data-bp-project-card]',
    classPrefix:'bp-project',
    isActive:()=>document.getElementById('brainstorm').classList.contains('active')&&
      !document.getElementById('projectWorkspace').hidden&&v6ProjectTab==='overview',
    savedMessage:'Project card order saved.',
    saveOrder(order){
      const project=v6Project();
      if(!project||project!==orderedProject)return false;
      const previous=project.overviewCardOrder;
      project.overviewCardOrder=order;
      if(save(true))return true;
      if(previous===undefined)delete project.overviewCardOrder;
      else project.overviewCardOrder=previous;
      return false;
    }
  });
  const previousOverview=window.v919RenderProjectOverview;
  if(typeof previousOverview==='function'){
    window.v919RenderProjectOverview=function(p){
      previousOverview(p);
      projectPulse(p);
      if(p!==orderedProject){
        orderedProject=p;
        projectOrder?.sync(p.overviewCardOrder);
      }
    };
  }
  const previousRender=render;
  render=function(...args){
    const result=previousRender(...args);
    if(v6ProjectTab==='overview'&&v6Project())
      window.v919RenderProjectOverview?.(v6Project());
    return result;
  };
  if(v6ProjectTab==='overview'&&v6Project())window.v919RenderProjectOverview?.(v6Project());
})();
