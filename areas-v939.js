'use strict';
// Blueprint Areas v9.39. Uses existing goal categories as Areas and adds
// optional area labels on tasks, habits and projects. No storage migration.
(function(root){
  const INBOX='__unassigned__';
  const validArea=(name,areas)=>areas.includes(String(name||''))?String(name):'';
  function itemArea(item,goals,projects,areas){
    const goal=goals.find(g=>String(g.id)===String(item.goalId||'')&&item.goalId!=='');
    if(goal)return validArea(goal.category,areas);
    const project=projects.find(p=>String(p.id)===String(item.projectId||'')&&item.projectId!=='');
    if(project)return validArea(project.area,areas);
    return validArea(item.area,areas);
  }
  function contents(data,area){
    const areas=data.categories||[], goals=data.goals||[], projects=data.projects||[];
    const match=name=>(name||INBOX)===area;
    return {
      goals: goals.filter(g=>match(validArea(g.category,areas))),
      tasks: (data.tasks||[]).filter(t=>match(itemArea(t,goals,projects,areas))),
      habits: (data.habits||[]).filter(h=>match(itemArea(h,goals,projects,areas))),
      projects: projects.filter(p=>match(validArea(p.area,areas)))
    };
  }
  const model={INBOX,validArea,itemArea,contents};
  if(typeof module!=='undefined'&&module.exports)module.exports=model;
  if(typeof document==='undefined'||typeof window==='undefined')return;
  const mount=document.getElementById('bpAreasRoot');
  if(!mount)return;
  const escapeHtml=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon=name=>'<svg class="icon" aria-hidden="true"><use href="#i-'+name+'"></use></svg>';
  let selected=null,pending=false;
  let createMenu=null,createTrigger=null;
  const expanded=new Set(),openGoals=new Set();
  let areaMenu=null,press=null,pressTimer=null,suppressCardTap=null;
  const HOLD_MS=520,MOVE_LIMIT=12;
  function cancelPress(){
    if(pressTimer!==null)clearTimeout(pressTimer);
    pressTimer=null;press=null;
  }
  function closeAreaMenu(restoreFocus=false){
    if(!areaMenu)return;
    const area=areaMenu.dataset.area;
    areaMenu.remove();areaMenu=null;
    if(restoreFocus){
      const tile=[...mount.querySelectorAll('[data-bpa-open]')].find(el=>el.dataset.bpaOpen===area);
      tile?.focus({preventScroll:true});
    }
  }
  function showAreaMenu(area,tile){
    if(area===INBOX||!state.categories.includes(area))return;
    cancelPress();
    closeAreaMenu();
    const layer=document.createElement('div');
    layer.className='bp-area-menu-layer';
    layer.dataset.area=area;
    const rect=tile.getBoundingClientRect();
    const menuWidth=Math.min(240,window.innerWidth-24);
    const left=Math.min(Math.max(12,rect.right-menuWidth),window.innerWidth-menuWidth-12);
    const top=Math.max(12,Math.min(rect.top,window.innerHeight-210));
    layer.innerHTML='<div class="bp-area-context-menu" role="dialog" aria-modal="true" aria-label="Options for '+escapeHtml(area)+'" style="left:'+Math.round(left)+'px;top:'+Math.round(top)+'px;width:'+menuWidth+'px">'+
      '<div class="bp-area-context-title">'+escapeHtml(area)+'</div>'+
      '<button type="button" data-bpa-rename="'+escapeHtml(area)+'">Rename</button>'+
      '<button type="button" class="bp-area-danger" data-bpa-remove="'+escapeHtml(area)+'">Delete</button>'+
      '<button type="button" data-bpa-menu-close>Cancel</button></div>';
    const openedAt=Date.now();
    layer.addEventListener('click',event=>{
      if(event.target===layer&&Date.now()-openedAt>550)closeAreaMenu(true);
    });
    document.body.append(layer);
    areaMenu=layer;
    layer.querySelector('[data-bpa-rename]')?.focus({preventScroll:true});
  }

  // A single anchored popover replaces the layout-shifting inline add row.
  // It lives outside the notebook grid so opening it never moves Area cards.
  function closeCreateMenu(restoreFocus=false){
    if(!createMenu)return;
    const trigger=createTrigger;
    createMenu.remove();
    createMenu=null;
    createTrigger=null;
    if(trigger?.isConnected){
      trigger.setAttribute('aria-expanded','false');
      if(restoreFocus)trigger.focus({preventScroll:true});
    }
  }
  function showCreateMenu(trigger){
    if(selected===null)return;
    if(createMenu){closeCreateMenu(true);return;}
    const choices=[
      ['task','check','Task','A one-time action'],
      ['habit','habit','Habit','Something to repeat'],
      ['goal','goal','Goal','An outcome to pursue'],
      ['project','plan','Project','Notes, to-dos and files']
    ];
    const layer=document.createElement('div');
    layer.className='bp-area-create-backdrop';
    layer.innerHTML='<div class="bp-area-create-popover" role="dialog" aria-modal="true" aria-label="Add to '+escapeHtml(display(selected))+'">'+
      '<div class="bp-area-create-header"><strong>Add to '+escapeHtml(display(selected))+'</strong>'+
      '<button type="button" class="bp-area-create-close" data-bpa-add-close aria-label="Close Add menu">×</button></div>'+
      choices.map(([kind,symbol,title,subtitle])=>
        '<button type="button" class="bp-area-create-option" data-bpa-add-kind="'+kind+'">'+
          '<span class="bp-area-create-icon">'+icon(symbol)+'</span>'+
          '<span class="bp-area-create-copy"><strong>'+title+'</strong><small>'+subtitle+'</small></span>'+
          '<span class="bp-area-create-chevron" aria-hidden="true">›</span></button>').join('')+'</div>';
    const popover=layer.firstElementChild;
    layer.addEventListener('click',event=>{
      if(event.target===layer)closeCreateMenu(true);
    });
    layer.addEventListener('keydown',event=>{
      if(event.key!=='Tab')return;
      const buttons=[...popover.querySelectorAll('button:not([disabled])')];
      if(!buttons.length)return;
      const first=buttons[0],last=buttons[buttons.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    });
    document.body.append(layer);
    createMenu=layer;
    createTrigger=trigger;
    trigger.setAttribute('aria-expanded','true');
    if(window.innerWidth>600){
      // Adapt placement above/below the trigger for Split View and iPad.
      const rect=trigger.getBoundingClientRect();
      const width=popover.offsetWidth;
      const height=popover.offsetHeight;
      const left=Math.min(Math.max(12,rect.right-width),Math.max(12,window.innerWidth-width-12));
      const below=window.innerHeight-rect.bottom;
      let top=below>=height+12?rect.bottom+8:rect.top-height-8;
      top=Math.min(Math.max(12,top),Math.max(12,window.innerHeight-height-12));
      popover.style.left=Math.round(left)+'px';
      popover.style.top=Math.round(top)+'px';
    }
    popover.querySelector('[data-bpa-add-kind]')?.focus({preventScroll:true});
  }

  function display(area){return area===INBOX?'Unassigned':area;}
  function counts(data){
    return [['goals','Goals','goal'],['tasks','Tasks','check'],['habits','Habits','habit'],['projects','Projects','plan']]
      .filter(([key])=>data[key].length)
      .map(([key,label,symbol])=>'<span class="bp-area-stat">'+icon(symbol)+data[key].length+' '+label+'</span>').join('');
  }
  function selectionOptions(current){
    return '<option value="">Unassigned</option>'+state.categories.map(a=>'<option value="'+escapeHtml(a)+'" '+(a===current?'selected':'')+'>'+escapeHtml(a)+'</option>').join('');
  }
  function taskRow(t){
    return '<div class="bp-area-item"><input type="checkbox" data-task-check="'+escapeHtml(t.id)+'" aria-label="Complete '+escapeHtml(t.title)+'" '+(t.done?'checked':'')+'><button type="button" data-edit-task="'+escapeHtml(t.id)+'" class="bp-area-item-title '+(t.done?'bp-done':'')+'">'+escapeHtml(t.title)+'</button></div>';
  }
  function habitRow(h){
    const checked=!!h.days?.[localToday()];
    const due=Array.isArray(h.schedule)?h.schedule.includes(new Date().getDay()):true;
    return '<div class="bp-area-item"><input type="checkbox" data-habit-check="'+escapeHtml(h.id)+'" data-date="'+localToday()+'" aria-label="Mark '+escapeHtml(h.title)+' today" '+(checked?'checked':'')+' '+(!due?'disabled title="Not scheduled today"':'')+'><button type="button" data-edit-habit="'+escapeHtml(h.id)+'" class="bp-area-item-title">'+escapeHtml(h.title)+'</button></div>';
  }
  function stepsForGoal(g,linkedTasks){
    return (g.actions||[]).filter(a=>!linkedTasks.some(t=>String(t.actionId||'')===String(a.id))).map(a=>
      '<div class="bp-area-item bp-area-step"><input type="checkbox" data-action-check="'+escapeHtml(g.id)+'" data-action-id="'+escapeHtml(a.id)+'" aria-label="Complete step '+escapeHtml(a.title)+'" '+(a.done?'checked':'')+'><span class="bp-area-item-title '+(a.done?'bp-done':'')+'">'+escapeHtml(a.title)+'</span></div>').join('');
  }
  function goalRow(g,data){
    const tasks=data.tasks.filter(t=>String(t.goalId||'')===String(g.id));
    const habits=data.habits.filter(h=>String(h.goalId||'')===String(g.id));
    const children=stepsForGoal(g,tasks)+tasks.map(taskRow).join('')+habits.map(habitRow).join('');
    return '<details class="bp-area-goal" data-bpa-goal="'+escapeHtml(g.id)+'" '+(openGoals.has(String(g.id))?'open':'')+'><summary>'+icon('goal')+'<strong>'+escapeHtml(g.title)+'</strong><span class="bp-area-chevron">⌄</span></summary>'+
      '<div class="bp-area-goal-body">'+(children||'<p class="muted small">No linked tasks or habits yet.</p>')+
      '<button type="button" class="text-button" data-bpa-edit-goal="'+escapeHtml(g.id)+'">Edit goal</button></div></details>';
  }
  function projectRow(p){
    return '<div class="bp-area-project"><button type="button" data-bpa-project="'+escapeHtml(p.id)+'" class="bp-area-project-open">'+icon('plan')+'<span>'+escapeHtml(p.title)+'</span><span aria-hidden="true">›</span></button>'+
      '<label class="bp-area-project-move"><span class="bp-visually-hidden">Area for '+escapeHtml(p.title)+'</span><select data-bpa-project-area="'+escapeHtml(p.id)+'" aria-label="Area for '+escapeHtml(p.title)+'">'+selectionOptions(validArea(p.area,state.categories))+'</select></label></div>';
  }
  function section(title,kind,items,draw){
    if(!items.length)return '';
    const key=selected+':'+kind,showAll=expanded.has(key),shown=showAll?items:items.slice(0,3);
    return '<section class="card bp-area-section"><div class="bp-area-section-head"><h3>'+icon({goals:'goal',tasks:'check',habits:'habit',projects:'plan'}[kind])+title+'</h3><span class="bp-area-count">'+items.length+'</span></div>'+
      shown.map(draw).join('')+
      (items.length>3?'<button type="button" class="bp-area-more" data-bpa-expand="'+escapeHtml(kind)+'">'+(showAll?'Show less':'See all '+items.length)+'</button>':'')+'</section>';
  }
  function renderOverview(){
    mount.dataset.detail='false';
    const keys=state.categories.concat([]);
    const orphan=contents(state,INBOX);
    if(Object.values(orphan).some(list=>list.length))keys.push(INBOX);
    const tiles=keys.map(a=>{
      const data=contents(state,a);
      const count=Object.values(data).reduce((n,items)=>n+items.length,0);
      return '<button type="button" class="card bp-area-tile" data-bpa-open="'+escapeHtml(a)+'" '+(a===INBOX?'':'aria-haspopup="dialog" title="Press and hold for options"')+'><span class="bp-area-tile-title">'+icon(a===INBOX?'check':'plan')+'<strong>'+escapeHtml(display(a))+'</strong><span class="bp-area-chevron">›</span></span>'+
        '<span class="bp-area-tile-sub">'+(count?counts(data):'No items yet')+'</span></button>';
    }).join('');
    mount.innerHTML='<div class="bp-area-grid">'+tiles+'</div>'+
      '<div class="bp-areas-header" aria-label="Area actions"><div class="bp-area-heading-actions">'+
        '<button type="button" class="secondary-button" data-bpa-new>+ Area</button>'+
        '<button type="button" class="primary-button bp-area-week-action" data-wb-launch aria-label="Design your week" title="Design your week">'+icon('calendar')+'<span>Design Week</span></button>'+
        '</div></div>';
    document.getElementById('overview')?.classList.remove('bp-area-detail');
  }
  function renderDetail(){
    if(selected!==INBOX&&!state.categories.includes(selected)){selected=null;renderOverview();return;}
    mount.dataset.detail='true';
    document.getElementById('overview')?.classList.add('bp-area-detail');
    const data=contents(state,selected);
    const standaloneTasks=data.tasks.filter(t=>!data.goals.some(g=>String(g.id)===String(t.goalId||'')));
    const standaloneHabits=data.habits.filter(h=>!data.goals.some(g=>String(g.id)===String(h.goalId||'')));
    const hasContent=Object.values(data).some(list=>list.length);
    mount.innerHTML='<header class="bp-area-detail-head"><button type="button" class="bp-area-back" data-bpa-back>‹ Areas</button><div class="bp-area-detail-title"><h1>'+escapeHtml(display(selected))+'</h1><button class="primary-button" type="button" data-bpa-add-toggle aria-haspopup="dialog" aria-expanded="false">+ Add</button></div></header>'+
      (hasContent?'<div class="bp-area-sections">'+
        section('Goals','goals',data.goals,g=>goalRow(g,data))+
        section('Tasks','tasks',standaloneTasks,taskRow)+
        section('Habits','habits',standaloneHabits,habitRow)+
        section('Projects','projects',data.projects,projectRow)+'</div>':
        '<div class="card bp-area-empty">'+icon('plan')+'<h3>Nothing here yet</h3><p>Add a task, habit, goal, or project. Goals and projects are completely optional.</p><button type="button" class="secondary-button" data-bpa-add-toggle aria-haspopup="dialog" aria-expanded="false">+ Add to '+escapeHtml(display(selected))+'</button></div>');
  }
  function render(){if(!mount)return;closeCreateMenu();closeAreaMenu();cancelPress();if(selected===null)renderOverview();else renderDetail();}
  function refresh(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;render();});}
  root.blueprintAreas={refresh,model};
  const trySave=()=>{save(true);refresh();};
  // Native-feeling long press for touch/Pencil; cancel when scrolling or dragging.
  mount.addEventListener('pointerdown',event=>{
    const tile=event.target.closest?.('[data-bpa-open]');
    if(!tile||tile.dataset.bpaOpen===INBOX||event.isPrimary===false||event.button!==0)return;
    cancelPress();
    press={tile,id:event.pointerId,x:event.clientX,y:event.clientY};
    pressTimer=setTimeout(()=>{
      if(!press||press.tile!==tile)return;
      suppressCardTap=tile;
      showAreaMenu(tile.dataset.bpaOpen,tile);
    },HOLD_MS);
  });
  mount.addEventListener('pointermove',event=>{
    if(press&&event.pointerId===press.id&&
       Math.hypot(event.clientX-press.x,event.clientY-press.y)>MOVE_LIMIT)cancelPress();
  });
  mount.addEventListener('pointerup',()=>{
    cancelPress();
    setTimeout(()=>{suppressCardTap=null;},0);
  });
  mount.addEventListener('pointercancel',cancelPress);
  document.addEventListener('scroll',event=>{
    cancelPress();
    if(createMenu&&!createMenu.contains(event.target))closeCreateMenu();
  },true);
  window.addEventListener('resize',()=>closeCreateMenu());
  window.addEventListener('blur',cancelPress);
  mount.addEventListener('contextmenu',event=>{
    const tile=event.target.closest?.('[data-bpa-open]');
    if(!tile||tile.dataset.bpaOpen===INBOX)return;
    event.preventDefault();
    showAreaMenu(tile.dataset.bpaOpen,tile);
  });
  mount.addEventListener('keydown',event=>{
    const tile=event.target.closest?.('[data-bpa-open]');
    if(tile&&tile.dataset.bpaOpen!==INBOX&&
       (event.key==='ContextMenu'||(event.shiftKey&&event.key==='F10'))){
      event.preventDefault();
      showAreaMenu(tile.dataset.bpaOpen,tile);
    }
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&createMenu){event.preventDefault();closeCreateMenu(true);return;}
    if(event.key==='Escape'&&areaMenu){event.preventDefault();closeAreaMenu(true);}
  });
  document.addEventListener('click',async event=>{
    const btn=event.target.closest('[data-bpa-open],[data-bpa-back],[data-bpa-new],[data-bpa-rename],[data-bpa-remove],[data-bpa-menu-close],[data-bpa-add-toggle],[data-bpa-add-kind],[data-bpa-add-close],[data-bpa-expand],[data-bpa-edit-goal],[data-bpa-project]');
    if(!btn)return;
    if(btn.hasAttribute('data-bpa-open')){
      if(suppressCardTap===btn){suppressCardTap=null;event.preventDefault();return;}
      if(areaMenu)return;
      selected=btn.dataset.bpaOpen;expanded.clear();render();return;
    }
    if(btn.hasAttribute('data-bpa-menu-close')){closeAreaMenu(true);return;}
    if(btn.hasAttribute('data-bpa-back')){selected=null;render();return;}
    if(btn.hasAttribute('data-bpa-add-toggle')){showCreateMenu(btn);return;}
    if(btn.hasAttribute('data-bpa-add-close')){closeCreateMenu(true);return;}
    if(btn.hasAttribute('data-bpa-expand')){const key=selected+':'+btn.dataset.bpaExpand;expanded.has(key)?expanded.delete(key):expanded.add(key);render();return;}
    if(btn.hasAttribute('data-bpa-new')){
      const next=await BlueprintSheet.name('New Area');
      if(next===null)return;
      const name=normalizedCategory(next).slice(0,60);
      if(!name)return;
      if(addCategory(name)){selected=name;render();}
      return;
    }
    if(btn.hasAttribute('data-bpa-rename')){
      const before=btn.dataset.bpaRename;closeAreaMenu();const next=await BlueprintSheet.name('Rename Area',before,'area:'+before);
      if(next===null)return;
      const name=normalizedCategory(next).slice(0,60);
      if(!name||name===before)return;
      if(state.categories.some(a=>a.toLowerCase()===name.toLowerCase())){alert('That Area already exists.');return;}
      state.categories=state.categories.map(a=>a===before?name:a);
      state.goals.forEach(g=>{if(g.category===before)g.category=name;});
      for(const type of ['tasks','habits','projects'])for(const x of state[type]||[])if(x.area===before)x.area=name;
      if(selected===before)selected=name;
      if(selectedCategory===before)selectedCategory=name;
      trySave();render();return;
    }
    if(btn.hasAttribute('data-bpa-remove')){
      const area=btn.dataset.bpaRemove;closeAreaMenu();
      if(contents(state,area).goals.length||state.tasks.some(t=>t.area===area)||state.habits.some(h=>h.area===area)||state.projects.some(p=>p.area===area)){
        alert('Move the items out of this Area first.');return;
      }
      if(!await BlueprintSheet.confirm('Delete empty Area "'+area+'"?'))return;
      state.categories=state.categories.filter(a=>a!==area);
      if(!state.categories.length)state.categories=['Personal'];
      if(selectedCategory===area)selectedCategory='All';
      if(selected===area)selected=null;
      trySave();render();return;
    }
    if(btn.hasAttribute('data-bpa-edit-goal')){openModal('goal',btn.dataset.bpaEditGoal);return;}
    if(btn.hasAttribute('data-bpa-project')){tab('brainstorm');v6OpenProject(btn.dataset.bpaProject);return;}
    if(btn.hasAttribute('data-bpa-add-kind')){
      const kind=btn.dataset.bpaAddKind;closeCreateMenu();
      root.blueprintAreaCreationContext=selected===INBOX?'':selected;
      if(kind==='project'){
        const name=await BlueprintSheet.name('New project','','project-in:'+selected);
        if(name?.trim()){tab('brainstorm');v6CreateProject(name);}
        root.blueprintAreaCreationContext='';
      }else{
        openModal(kind);
      }
      render();
    }
  });
  document.addEventListener('toggle',event=>{
    const goal=event.target.closest?.('[data-bpa-goal]');
    if(!goal)return;
    if(goal.open)openGoals.add(String(goal.dataset.bpaGoal));
    else openGoals.delete(String(goal.dataset.bpaGoal));
  },true);
  document.addEventListener('change',event=>{
    const select=event.target.closest('[data-bpa-project-area]');
    if(!select)return;
    const p=state.projects.find(p=>String(p.id)===select.dataset.bpaProjectArea);
    if(!p)return;
    p.area=validArea(select.value,state.categories);
    // A linked Goal follows its Project's Area, and its Tasks/Habits in turn
    // inherit that Goal category from the existing shared Area model.
    for(const goal of state.goals||[])
      if(String(goal.projectId||'')===String(p.id))goal.category=p.area||goal.category;
    trySave();
  });
  render();
})(typeof window==='undefined'?{}:window);