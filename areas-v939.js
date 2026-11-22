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
  const areaIcons={
    plan:['Folder','M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'],check:['Checkmark'],goal:['Target'],calendar:['Calendar'],clock:['Clock'],
    home:['Home','M3 11l9-8 9 8M5 10v11h14V10M10 21v-7h4v7'],
    briefcase:['Work','M3 7h18v13H3zM8 7V4h8v3M3 12h18M10 12v3h4v-3'],
    book:['Book','M12 5v16M12 5C9 3 6 3 3 4v15c3-1 6-1 9 2 3-3 6-3 9-2V4c-3-1-6-1-9 1z'],
    cap:['Education','M2 9l10-5 10 5-10 5-10-5zM6 11v6c4 3 8 3 12 0v-6M22 9v7'],
    flask:['Research','M9 3h6M10 3v7L4 19a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2l-6-9V3M7 15h10'],
    atom:['Science','M12 12h.01M12 3a4 9 0 1 0 0 18 4 9 0 0 0 0-18zM4.2 7.5a9 4 30 1 0 15.6 9 9 4 30 0 0-15.6-9zM4.2 16.5a9 4-30 1 0 15.6-9 9 4-30 0 0-15.6 9z'],
    fitness:['Fitness','M2 10v4m3-7v10m3-12v14m0-7h8m0-7v14m3-12v10m3-7v4'],
    heart:['Heart','M12 21S3 16 3 9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 7-9 12-9 12z'],
    pulse:['Health','M2 12h5l3-7 4 14 3-7h5'],
    leaf:['Leaf','M20 4C8 3 4 8 4 14a6 6 0 0 0 6 6c6 0 11-4 10-16zM3 21l11-11'],
    sun:['Sun','M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z'],
    star:['Star','m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9z'],
    spark:['Sparkles','m11 3 2.2 6.8L20 12l-6.8 2.2L11 21l-2.2-6.8L2 12l6.8-2.2zM19 3v5m-2.5-2.5h5'],
    people:['People','M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-4m-3-12a4 4 0 0 1 0 8M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z'],
    wallet:['Finances','M20 8V5H5a2 2 0 0 0 0 4h16v11H5a2 2 0 0 1-2-2V7m18 6h-5v3h5'],
    music:['Music','M9 18V5l12-2v12M9 18a3 2 0 1 1-6 0 3 2 0 0 1 6 0zm12-3a3 2 0 1 1-6 0 3 2 0 0 1 6 0z'],
    palette:['Art'],brainstorm:['Ideas'],
    camera:['Camera','M3 7h4l2-3h6l2 3h4v13H3zM12 10a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
    code:['Code','m8 6-6 6 6 6m8-12 6 6-6 6m-2-15-4 18'],
    compass:['Compass','M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm4 5-2 6-6 2 2-6z'],
    mountain:['Outdoors','m2 20 7-12 4 6 2-4 7 10z'],
    globe:['Globe','M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3a4 9 0 1 0 0 18 4 9 0 0 0 0-18z'],
    gift:['Gift','M4 10h16v11H4zM3 6h18v4H3zm9 0v15m0-15C11 1 6 1 7 4c0 2 5 2 5 2zm0 0c1-5 6-5 5-2 0 2-5 2-5 2z'],
    utensils:['Food','M4 3v6a3 3 0 0 0 6 0V3M7 3v18M17 3c-3 3-3 8-3 10h5m0-10v18']
  };
  // Match the names, values and order shown in Customize.
  const areaColors=new Map([
    ['theme',{name:'Theme',value:'var(--secondary)'}],
    ...palettes.map(([name,value])=>[name.toLowerCase(),{name,value}])
  ]);
  // Read v9.52 color names from the existing planner and older backups.
  const legacyColors=new Map(Object.entries({
    red:'terracotta',coral:'terracotta',orange:'copper',lime:'sage',
    green:'forest',mint:'sage',teal:'ocean',sky:'ocean',blue:'ocean',
    indigo:'lavender',purple:'lavender',pink:'rose'
  }));
  const areaDefaults=new Map([
    [INBOX,['check','slate']],['Personal',['home','sage']],['Physical',['fitness','copper']],
    ['Research',['flask','ocean']],['Spiritual',['sun','lavender']]
  ]);
  function areaIcon(key){
    const [,path]=areaIcons[key];
    return path?'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="'+path+'"/></svg>':icon(key);
  }
  const appearanceList=()=>Array.isArray(state.areaAppearance)?state.areaAppearance:[];
  function appearance(area){
    const stored=appearanceList().find(entry=>entry?.area===area);
    const [symbol,color]=areaDefaults.get(area)||['plan','theme'];
    const savedColor=legacyColors.get(stored?.color)??stored?.color;
    return {
      icon:Object.hasOwn(areaIcons,stored?.icon)?stored.icon:symbol,
      color:areaColors.has(savedColor)?savedColor:color
    };
  }
  function updateAppearance(area,style){
    state.areaAppearance=appearanceList().filter(entry=>entry?.area!==area);
    if(style)state.areaAppearance.push({area,...style});
  }
  function restoreAppearance(before){
    if(before===undefined)delete state.areaAppearance;
    else state.areaAppearance=before;
  }
  function moveAppearance(before,after){
    if(before===after)return;
    const hasStyle=appearanceList().some(entry=>entry?.area===before);
    if(!hasStyle&&!(after&&areaDefaults.has(before)))return;
    const style=appearance(before);
    if(hasStyle)updateAppearance(before,null);
    if(after)updateAppearance(after,style);
  }
  function badge(style){
    return '<span class="bp-area-badge" data-area-color="'+style.color+'" style="--area-accent:'+areaColors.get(style.color).value+'">'+areaIcon(style.icon)+'</span>';
  }
  async function chooseAppearance(area,anchor){
    const initial=appearance(area);
    const style={...initial};
    const content=document.createElement('div');
    content.className='bp-area-picker';
    const choice=(kind,key,label,visual)=>'<button type="button" data-area-'+kind+'="'+key+
      '" aria-label="'+label+'"'+(kind==='color'?' title="'+label+'"':'')+
      ' aria-pressed="'+(style[kind]===key)+'">'+visual+'</button>';
    content.innerHTML='<div class="bp-area-picker-preview" aria-hidden="true">'+badge(style)+'</div>'+
      '<fieldset><legend>Color</legend><div class="bp-area-picker-grid bp-area-color-grid">'+
      [...areaColors].map(([key,{name,value}])=>choice('color',key,name,
        '<span class="bp-area-swatch" style="--area-accent:'+value+'"></span><span>'+name+'</span>')).join('')+
      '</div></fieldset><fieldset><legend>Icon</legend><div class="bp-area-picker-grid">'+
      Object.entries(areaIcons).map(([key,[label]])=>choice('icon',key,label,areaIcon(key))).join('')+
      '</div></fieldset>';
    content.addEventListener('click',event=>{
      const button=event.target.closest('button');
      if(!button)return;
      const kind=button.hasAttribute('data-area-icon')?'icon':'color';
      const attribute='data-area-'+kind;
      content.querySelector('button['+attribute+'][aria-pressed="true"]')?.setAttribute('aria-pressed','false');
      style[kind]=button.getAttribute(attribute);
      button.setAttribute('aria-pressed','true');
      content.firstElementChild.innerHTML=badge(style);
    });
    const fields=area===null?[{label:'Name'}]:[];
    const result=await BlueprintSheet.open({title:area===null?'New Area':'Icon & color',fields,content,anchor});
    if(!result)return null;
    const changed=style.icon!==initial.icon||style.color!==initial.color;
    return {name:result[0],style:changed?style:null};
  }
  function focusAreaControl(area){
    const button=[...mount.querySelectorAll('[data-bpa-appearance]')].find(el=>el.dataset.bpaAppearance===area);
    button?.focus({preventScroll:true});
  }
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
    const top=Math.max(12,Math.min(rect.top,window.innerHeight-254));
    layer.innerHTML='<div class="bp-area-context-menu" role="dialog" aria-modal="true" aria-label="Options for '+escapeHtml(area)+'" style="left:'+Math.round(left)+'px;top:'+Math.round(top)+'px;width:'+menuWidth+'px">'+
      '<div class="bp-area-context-title">'+escapeHtml(area)+'</div>'+
      '<button type="button" data-bpa-appearance="'+escapeHtml(area)+'">Icon &amp; color</button>'+
      '<button type="button" data-bpa-rename="'+escapeHtml(area)+'">Rename</button>'+
      '<button type="button" class="bp-area-danger" data-bpa-remove="'+escapeHtml(area)+'">Delete</button>'+
      '<button type="button" data-bpa-menu-close>Cancel</button></div>';
    const openedAt=Date.now();
    layer.addEventListener('click',event=>{
      if(event.target===layer&&Date.now()-openedAt>550)closeAreaMenu(true);
    });
    document.body.append(layer);
    areaMenu=layer;
    layer.querySelector('[data-bpa-appearance]')?.focus({preventScroll:true});
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
    const keys=state.categories.slice();
    const orphan=contents(state,INBOX);
    if(Object.values(orphan).some(list=>list.length))keys.push(INBOX);
    const tiles=keys.map(a=>{
      const data=contents(state,a);
      const count=Object.values(data).reduce((n,items)=>n+items.length,0);
      const name=escapeHtml(display(a));
      return '<div class="bp-area-tile-wrap"><button type="button" class="card bp-area-tile" data-bpa-open="'+escapeHtml(a)+'" '+(a===INBOX?'':'title="Press and hold for options"')+'>'+
        badge(appearance(a))+'<span class="bp-area-tile-title"><strong>'+name+'</strong><span class="bp-area-chevron" aria-hidden="true">›</span></span>'+
        '<span class="bp-area-tile-sub">'+(count?counts(data):'No items yet')+'</span></button>'+
        (a===INBOX?'':'<button type="button" class="bp-area-appearance-button" data-bpa-appearance="'+escapeHtml(a)+'" aria-label="Customize '+name+'" aria-haspopup="dialog" title="Icon &amp; color">'+
          '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19v1h1l12-12-1-1L4 19zm11-11 3 3m0-8v4m-2-2h4"/></svg></button>')+'</div>';
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
    mount.innerHTML='<header class="bp-area-detail-head"><button type="button" class="bp-area-back" data-bpa-back>‹ Areas</button><div class="bp-area-detail-title"><div class="bp-area-detail-name">'+(selected===INBOX?badge(appearance(selected)):'<button type="button" class="bp-area-detail-icon" data-bpa-appearance="'+escapeHtml(selected)+'" aria-label="Customize '+escapeHtml(selected)+'" aria-haspopup="dialog">'+badge(appearance(selected))+'</button>')+'<h1>'+escapeHtml(display(selected))+'</h1></div><button class="primary-button" type="button" data-bpa-add-toggle aria-haspopup="dialog" aria-expanded="false">+ Add</button></div></header>'+
      (hasContent?'<div class="bp-area-sections">'+
        section('Goals','goals',data.goals,g=>goalRow(g,data))+
        section('Tasks','tasks',standaloneTasks,taskRow)+
        section('Habits','habits',standaloneHabits,habitRow)+
        section('Projects','projects',data.projects,projectRow)+'</div>':
        '<div class="card bp-area-empty">'+icon('plan')+'<h3>Nothing here yet</h3><p>Add a task, habit, goal, or project. Goals and projects are completely optional.</p><button type="button" class="secondary-button" data-bpa-add-toggle aria-haspopup="dialog" aria-expanded="false">+ Add to '+escapeHtml(display(selected))+'</button></div>');
  }
  function render(){if(!mount)return;closeCreateMenu();closeAreaMenu();cancelPress();if(selected===null)renderOverview();else renderDetail();}
  function refresh(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;render();});}
  root.blueprintAreas={refresh,model,moveAppearance,currentArea:()=>selected};
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
  document.addEventListener('pointermove',event=>{
    if(press&&event.pointerId===press.id&&
       Math.hypot(event.clientX-press.x,event.clientY-press.y)>MOVE_LIMIT)cancelPress();
  });
  document.addEventListener('pointerup',event=>{
    if(press&&event.pointerId===press.id)cancelPress();
    setTimeout(()=>{suppressCardTap=null;},0);
  });
  document.addEventListener('pointercancel',event=>{
    if(press&&event.pointerId===press.id)cancelPress();
  });
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
    const btn=event.target.closest('[data-bpa-open],[data-bpa-back],[data-bpa-new],[data-bpa-appearance],[data-bpa-rename],[data-bpa-remove],[data-bpa-menu-close],[data-bpa-add-toggle],[data-bpa-add-kind],[data-bpa-add-close],[data-bpa-expand],[data-bpa-edit-goal],[data-bpa-project]');
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
      const choice=await chooseAppearance(null,btn);
      if(!choice)return;
      const name=normalizedCategory(choice.name).slice(0,60);
      if(!name)return;
      if(state.categories.some(a=>a.toLocaleLowerCase()===name.toLocaleLowerCase())){
        alert('That Area already exists.');return;
      }
      const oldAppearance=state.areaAppearance;
      state.categories.push(name);
      if(choice.style)updateAppearance(name,choice.style);
      if(!save(true)){
        state.categories.pop();
        restoreAppearance(oldAppearance);
        return;
      }
      selected=selectedCategory=name;
      render();
      return;
    }
    if(btn.hasAttribute('data-bpa-appearance')){
      const area=btn.dataset.bpaAppearance;
      const trigger=[...mount.querySelectorAll('[data-bpa-appearance]')].find(el=>el.dataset.bpaAppearance===area);
      closeAreaMenu();
      const choice=await chooseAppearance(area,trigger);
      if(!choice?.style||!state.categories.includes(area))return;
      const before=state.areaAppearance;
      updateAppearance(area,choice.style);
      if(!save(true)){restoreAppearance(before);return;}
      render();
      requestAnimationFrame(()=>focusAreaControl(area));
      return;
    }
    if(btn.hasAttribute('data-bpa-rename')){
      const before=btn.dataset.bpaRename;closeAreaMenu();const next=await BlueprintSheet.name('Rename Area',before,'area:'+before);
      if(next===null)return;
      const name=normalizedCategory(next).slice(0,60);
      if(!name||name===before)return;
      if(state.categories.some(a=>a.toLowerCase()===name.toLowerCase())){alert('That Area already exists.');return;}
      if(!state.categories.includes(before))return;
      const oldCategories=state.categories,oldAppearance=state.areaAppearance;
      const goals=state.goals.filter(goal=>goal.category===before);
      const items=['tasks','habits','projects'].flatMap(type=>state[type]||[]).filter(item=>item.area===before);
      state.categories=state.categories.map(a=>a===before?name:a);
      moveAppearance(before,name);
      goals.forEach(goal=>{goal.category=name;});
      items.forEach(item=>{item.area=name;});
      if(!save(true)){
        goals.forEach(goal=>{goal.category=before;});
        items.forEach(item=>{item.area=before;});
        state.categories=oldCategories;
        restoreAppearance(oldAppearance);
        return;
      }
      if(selected===before)selected=name;
      if(selectedCategory===before)selectedCategory=name;
      render();return;
    }
    if(btn.hasAttribute('data-bpa-remove')){
      const area=btn.dataset.bpaRemove;closeAreaMenu();
      if(contents(state,area).goals.length||state.tasks.some(t=>t.area===area)||state.habits.some(h=>h.area===area)||state.projects.some(p=>p.area===area)){
        alert('Move the items out of this Area first.');return;
      }
      if(!await BlueprintSheet.confirm('Delete empty Area "'+area+'"?'))return;
      if(!state.categories.includes(area))return;
      const oldCategories=state.categories,oldAppearance=state.areaAppearance;
      state.categories=state.categories.filter(a=>a!==area);
      moveAppearance(area,null);
      if(!state.categories.length)state.categories=['Personal'];
      if(!save(true)){
        state.categories=oldCategories;
        restoreAppearance(oldAppearance);
        return;
      }
      if(selectedCategory===area)selectedCategory='All';
      if(selected===area)selected=null;
      render();return;
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
