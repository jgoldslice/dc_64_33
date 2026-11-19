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
  let selected=null,managing=false,pending=false,menuOpen=false;
  const expanded=new Set();
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
    return '<details class="bp-area-goal"><summary>'+icon('goal')+'<strong>'+escapeHtml(g.title)+'</strong><span class="bp-area-chevron">⌄</span></summary>'+
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
      return '<button type="button" class="card bp-area-tile" data-bpa-open="'+escapeHtml(a)+'"><span class="bp-area-tile-title">'+icon(a===INBOX?'check':'plan')+'<strong>'+escapeHtml(display(a))+'</strong><span class="bp-area-chevron">›</span></span>'+
        '<span class="bp-area-tile-sub">'+(count?counts(data):'No items yet')+'</span></button>';
    }).join('');
    const manager=managing?'<section class="card bp-area-manager"><h3>Manage Areas</h3>'+state.categories.map(a=>'<div class="bp-area-manage-row"><strong>'+escapeHtml(a)+'</strong><button type="button" data-bpa-rename="'+escapeHtml(a)+'">Rename</button><button type="button" data-bpa-remove="'+escapeHtml(a)+'">Delete</button></div>').join('')+'</section>':'';
    mount.innerHTML='<header class="bp-areas-header"><div><span class="eyebrow">Your responsibilities</span><h1>Areas</h1></div><div class="bp-area-heading-actions"><button type="button" class="text-button" data-bpa-manage aria-pressed="'+managing+'">'+(managing?'Done':'Manage')+'</button><button type="button" class="primary-button" data-bpa-new>+ Area</button></div></header>'+
      '<div class="bp-area-grid">'+tiles+'</div>'+manager;
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
    mount.innerHTML='<header class="bp-area-detail-head"><button type="button" class="bp-area-back" data-bpa-back>‹ Areas</button><div class="bp-area-detail-title"><h1>'+escapeHtml(display(selected))+'</h1><button class="primary-button" type="button" data-bpa-add-toggle aria-expanded="'+menuOpen+'">+ Add</button></div>'+
      (menuOpen?'<div class="bp-area-add-menu" role="group" aria-label="Add to '+escapeHtml(display(selected))+'">'+['task','habit','goal','project'].map(kind=>'<button type="button" data-bpa-add-kind="'+kind+'">+ '+kind[0].toUpperCase()+kind.slice(1)+'</button>').join('')+'</div>':'')+'</header>'+
      (hasContent?'<div class="bp-area-sections">'+
        section('Goals','goals',data.goals,g=>goalRow(g,data))+
        section('Tasks','tasks',standaloneTasks,taskRow)+
        section('Habits','habits',standaloneHabits,habitRow)+
        section('Projects','projects',data.projects,projectRow)+'</div>':
        '<div class="card bp-area-empty">'+icon('plan')+'<h3>Nothing here yet</h3><p>Add a task, habit, goal, or project. Goals and projects are completely optional.</p><button type="button" class="secondary-button" data-bpa-add-toggle>+ Add to '+escapeHtml(display(selected))+'</button></div>');
  }
  function render(){if(!mount)return;if(selected===null)renderOverview();else renderDetail();}
  function refresh(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;render();});}
  root.blueprintAreas={refresh,model};
  const trySave=()=>{save(true);refresh();};
  document.addEventListener('click',event=>{
    const btn=event.target.closest('[data-bpa-open],[data-bpa-back],[data-bpa-new],[data-bpa-manage],[data-bpa-rename],[data-bpa-remove],[data-bpa-add-toggle],[data-bpa-add-kind],[data-bpa-expand],[data-bpa-edit-goal],[data-bpa-project]');
    if(!btn)return;
    if(btn.hasAttribute('data-bpa-open')){selected=btn.dataset.bpaOpen;menuOpen=false;expanded.clear();render();return;}
    if(btn.hasAttribute('data-bpa-back')){selected=null;menuOpen=false;render();return;}
    if(btn.hasAttribute('data-bpa-add-toggle')){menuOpen=!menuOpen;render();return;}
    if(btn.hasAttribute('data-bpa-expand')){const key=selected+':'+btn.dataset.bpaExpand;expanded.has(key)?expanded.delete(key):expanded.add(key);render();return;}
    if(btn.hasAttribute('data-bpa-manage')){managing=!managing;render();return;}
    if(btn.hasAttribute('data-bpa-new')){
      const next=prompt('New Area name');
      if(next===null)return;
      const name=normalizedCategory(next).slice(0,60);
      if(!name)return;
      if(addCategory(name)){selected=name;managing=false;render();}
      return;
    }
    if(btn.hasAttribute('data-bpa-rename')){
      const before=btn.dataset.bpaRename,next=prompt('Rename Area',before);
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
      const area=btn.dataset.bpaRemove;
      if(contents(state,area).goals.length||state.tasks.some(t=>t.area===area)||state.habits.some(h=>h.area===area)||state.projects.some(p=>p.area===area)){
        alert('Move the items out of this Area first.');return;
      }
      if(!confirm('Delete empty Area "'+area+'"?'))return;
      state.categories=state.categories.filter(a=>a!==area);
      if(!state.categories.length)state.categories=['Personal'];
      if(selectedCategory===area)selectedCategory='All';
      if(selected===area)selected=null;
      trySave();render();return;
    }
    if(btn.hasAttribute('data-bpa-edit-goal')){openModal('goal',btn.dataset.bpaEditGoal);return;}
    if(btn.hasAttribute('data-bpa-project')){tab('brainstorm');v6OpenProject(btn.dataset.bpaProject);return;}
    if(btn.hasAttribute('data-bpa-add-kind')){
      const kind=btn.dataset.bpaAddKind;menuOpen=false;
      root.blueprintAreaCreationContext=selected===INBOX?'':selected;
      if(kind==='project'){
        const name=prompt('Project name');
        if(name?.trim()){tab('brainstorm');v6CreateProject(name);}
        root.blueprintAreaCreationContext='';
      }else{
        openModal(kind);
      }
      render();
    }
  });
  document.addEventListener('change',event=>{
    const select=event.target.closest('[data-bpa-project-area]');
    if(!select)return;
    const p=state.projects.find(p=>String(p.id)===select.dataset.bpaProjectArea);
    if(!p)return;
    p.area=validArea(select.value,state.categories);
    trySave();
  });
  render();
})(window);