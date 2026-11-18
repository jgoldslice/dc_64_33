'use strict';
const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';
test.use({browserName:'chromium',viewport:{width:1024,height:900}});

test('rapid ordinary typing is batched, then flushed on blur and pagehide',async({page})=>{
  await page.goto(base);
  const before=await page.evaluate(()=>{
    if(!save(true))throw Error('Unable to persist baseline');
    const orig=Storage.prototype.setItem;
    window.__v933Writes=0;
    Storage.prototype.setItem=function(key,value){
      if(key===STORAGE_KEY)window.__v933Writes++;
      return orig.call(this,key,value);
    };
    const input=document.getElementById('todayFocus');
    input.focus();
    for(let i=0;i<90;i++){
      input.value='Typing '+i;
      input.dispatchEvent(new Event('input',{bubbles:true}));
    }
    return {writes:window.__v933Writes,pending:canvasTextSavePending,
      stored:JSON.parse(localStorage.getItem(STORAGE_KEY)).todayFocus};
  });
  expect(before.writes).toBe(0);
  expect(before.pending).toBe(true);
  await page.evaluate(()=>document.getElementById('todayFocus').blur());
  const saved=await page.evaluate(()=>({
    writes:window.__v933Writes,
    pending:canvasTextSavePending,
    stored:JSON.parse(localStorage.getItem(STORAGE_KEY)).todayFocus
  }));
  expect(saved).toEqual({writes:1,pending:false,stored:'Typing 89'});
  await page.evaluate(()=>{
    const input=document.getElementById('todayFocus');
    input.focus();input.value='Final background edit';
    input.dispatchEvent(new Event('input',{bubbles:true}));
    window.dispatchEvent(new Event('pagehide'));
  });
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem(STORAGE_KEY)).todayFocus)).toBe('Final background edit');
});

test('a pending text edit refuses to overwrite data saved in another window',async({page})=>{
  await page.goto(base);
  const result=await page.evaluate(()=>{
    if(!save(true))throw Error('baseline save failed');
    const field=document.getElementById('todayFocus');
    field.focus();field.value='My unsaved work';field.dispatchEvent(new Event('input',{bubbles:true}));
    const persisted=JSON.parse(localStorage.getItem(STORAGE_KEY));
    persisted.todayFocus='Newer second-window edit';
    localStorage.setItem(STORAGE_KEY,JSON.stringify(persisted));
    field.blur();
    return {
      disk:JSON.parse(localStorage.getItem(STORAGE_KEY)).todayFocus,
      inMemory:state.todayFocus,
      conflict:canvasExternalChange,
      warning:!document.getElementById('canvasSaveWarning').hidden,
      recovery:!document.getElementById('canvasSaveRecovery').hidden
    };
  });
  expect(result).toEqual({
    disk:'Newer second-window edit',inMemory:'My unsaved work',
    conflict:true,warning:true,recovery:true
  });
});

test('Habit checkbox keeps unrelated task/calendar DOM while updating goal and habit trackers',async({page})=>{
  await page.goto(base);
  await page.evaluate(()=>{
    state.tasks=[{id:'task1',title:'Task on Today',dueDate:localToday(),done:false,
      priority:true,priorityRank:1}];
    state.habits=[{id:'habit1',title:'Practice piano',schedule:[0,1,2,3,4,5,6],
      days:{},createdOn:localToday(),goalId:'goal1'}];
    state.goals=[{id:'goal1',title:'Learn piano',category:'Personal',actions:[]}];
    save(true);render();
    window.__v933Before={
      task:document.getElementById('v917TodayTasks').firstElementChild,
      calendar:document.getElementById('weekGrid').firstElementChild
    };
  });
  await page.locator('#todayHabits [data-habit-check="habit1"]').check();
  const result=await page.evaluate(()=>({
    taskKept:document.getElementById('v917TodayTasks').firstElementChild===window.__v933Before.task,
    calendarKept:document.getElementById('weekGrid').firstElementChild===window.__v933Before.calendar,
    habitSaved:!!state.habits[0].days[localToday()],
    weekUpdated:!!document.querySelector('#habitsTracker input[data-habit-check="habit1"][data-date="'+localToday()+'"]')?.checked
  }));
  expect(result).toEqual({taskKept:true,calendarKept:true,habitSaved:true,weekUpdated:true});
});

test('Task checkbox keeps unrelated habit DOM while updating goal and priority views',async({page})=>{
  await page.goto(base);
  await page.evaluate(()=>{
    state.tasks=[{id:'task1',title:'Priority',dueDate:localToday(),done:false,
      priority:true,priorityRank:1}];
    state.habits=[{id:'habit1',title:'Read',schedule:[0,1,2,3,4,5,6],
      days:{},createdOn:localToday()}];
    save(true);render();
    window.__v933OldHabit=document.getElementById('todayHabits').firstElementChild;
  });
  await page.locator('#v917TodayTasks [data-task-check="task1"]').check();
  expect(await page.evaluate(()=>({
    habitKept:document.getElementById('todayHabits').firstElementChild===window.__v933OldHabit,
    taskSaved:state.tasks[0].done,
    taskDone:document.querySelector('#allTasks [data-task-check="task1"]')?.checked,
    priorityGone:!document.querySelector('#priorities [data-task-check="task1"]')
  }))).toEqual({habitKept:true,taskSaved:true,taskDone:true,priorityGone:true});
});

test('hidden project panels stay untouched until opened and Library image requests are lazy',async({page})=>{
  await page.goto(base);
  const result=await page.evaluate(()=>{
    const links=Array.from({length:3},(_,i)=>({id:'link'+i,type:'link',title:'Link '+i,url:'https://example.com/'+i}));
    const photos=Array.from({length:70},(_,i)=>({id:'photo'+i,type:'file',
      title:'Photo '+i,mime:'image/png',key:'fake-photo-'+i}));
    const project={id:'proj-large',title:'A Large Project',notes:[],
      actions:[],notePages:[],library:[...links,...photos]};
    state.projects=[project];save(true);
    window.v6ActiveProjectId='proj-large';v6ProjectTab='overview';
    const originalIO=window.IntersectionObserver;
    class FakeIO {
      constructor(callback){this.callback=callback;this.targets=[];this.disconnected=false;FakeIO.latest=this;}
      observe(target){this.targets.push(target);}
      unobserve(target){this.targets=this.targets.filter(x=>x!==target);}
      disconnect(){this.disconnected=true;this.targets=[];}
    }
    window.IntersectionObserver=FakeIO;
    try{
      v6Render();
      const overview={empty:document.getElementById('projectLibraryList').children.length===0,
        noObserver:!FakeIO.latest};
      v6ProjectTab='library';v6Render();
      const instance=FakeIO.latest;
      const loadedInitially=!!document.querySelector('#projectLibraryList [data-v6-gallery-image][data-v6-loading]');
      const observed=instance?.targets.length;
      const image=instance?.targets[0];
      v6ProjectTab='overview';v6Render();
      return {overview,observed,loadedInitially,disconnected:instance?.disconnected,
        imageStillLoading:image?.dataset.v6Loading||false};
    }finally{window.IntersectionObserver=originalIO;}
  });
  expect(result.overview).toEqual({empty:true,noObserver:true});
  expect(result.observed).toBe(70);
  expect(result.loadedInitially).toBe(false);
  expect(result.disconnected).toBe(true);
});

test('task rank indexing has identical output with large datasets; record a repeatable browser timing',async({page})=>{
  await page.goto(base);
  const result=await page.evaluate(()=>{
    state.tasks=Array.from({length:600},(_,i)=>({
      id:'t'+i,title:'Task '+i,dueDate:'2026-12-01',done:i%9===0,
      priority:i%3===0,priorityRank:600-i
    }));
    state.habits=[];state.events=[];state.goals=[];state.ideas=[];
    save(true);
    const t0=performance.now();
    render();
    const t1=performance.now();
    const tasks=state.tasks;
    const naiveStart=performance.now();
    const oldRanks=tasks.map(t=>(tasks.filter(x=>x.priority&&!x.done)
      .sort((a,b)=>(a.priorityRank||9999)-(b.priorityRank||9999)||
        String(a.dueDate||'').localeCompare(String(b.dueDate||'')))
      .findIndex(x=>String(x.id)===String(t.id))+1));
    const naiveMs=performance.now()-naiveStart;
    const fastStart=performance.now();
    const priorities=tasks.filter(x=>x.priority&&!x.done)
      .sort((a,b)=>(a.priorityRank||9999)-(b.priorityRank||9999)||
        String(a.dueDate||'').localeCompare(String(b.dueDate||'')));
    const rankMap=new Map(priorities.map((t,i)=>[String(t.id),i+1]));
    const newRanks=tasks.map(t=>rankMap.get(String(t.id))||0);
    const optimizedMs=performance.now()-fastStart;
    const allRows=document.querySelectorAll('#allTasks .entry').length;
    return {renderMs:t1-t0,naiveMs,optimizedMs,identical:JSON.stringify(oldRanks)===JSON.stringify(newRanks),
      allRows};
  });
  expect(result.identical).toBe(true);
  expect(result.allRows).toBe(600);
  console.log('[Blueprint v9.33 browser benchmark; 600 tasks]',JSON.stringify(result));
});
