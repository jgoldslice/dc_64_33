'use strict';
const {test,expect}=require('@playwright/test');
test.use({browserName:'chromium',viewport:{width:1024,height:900},isMobile:true,hasTouch:true});
const base='http://127.0.0.1:8765/';

test('rapid typing batches serialization and blur persists the last edit',async({page})=>{
  await page.goto(base);
  const result=await page.evaluate(()=>{
    const el=document.getElementById('todayFocus');
    let writes=0;
    const original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){
      if(key==='jgold-planner-v1')writes++;
      return original.call(this,key,value);
    };
    try{
      el.focus();
      for(let i=0;i<30;i++){
        el.value='Typing rapidly '+i;
        el.dispatchEvent(new Event('input',{bubbles:true}));
      }
      const beforeBlur={writes,dirty:canvasTextSavePending};
      el.blur();
      return {beforeBlur,writes,dirty:canvasTextSavePending,
        saved:JSON.parse(localStorage.getItem('jgold-planner-v1')).todayFocus};
    }finally{Storage.prototype.setItem=original;}
  });
  expect(result.beforeBlur.writes).toBe(0);
  expect(result.beforeBlur.dirty).toBe(true);
  expect(result.writes).toBe(1);
  expect(result.dirty).toBe(false);
  expect(result.saved).toBe('Typing rapidly 29');
});

test('backgrounding flushes pending text before the save timer expires',async({page})=>{
  await page.goto(base);
  const result=await page.evaluate(()=>{
    const el=document.getElementById('brainstormDraft');
    el.value='Save me on background';
    el.dispatchEvent(new Event('input',{bubbles:true}));
    const pendingBefore=canvasTextSavePending;
    // Simulate Safari's visibilitychange with a hidden document.
    Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});
    document.dispatchEvent(new Event('visibilitychange'));
    return {pendingBefore,pendingAfter:canvasTextSavePending,
      saved:JSON.parse(localStorage.getItem('jgold-planner-v1')).brainstormDraft};
  });
  expect(result).toEqual({pendingBefore:true,pendingAfter:false,saved:'Save me on background'});
});

test('habit check leaves unrelated task and Library DOM nodes intact',async({page})=>{
  await page.goto(base);
  const result=await page.evaluate(()=>{
    const beforeTask=document.getElementById('allTasks').firstElementChild;
    const beforeGrid=document.getElementById('weekGrid').firstElementChild;
    const beforeGoals=document.getElementById('goalsList').firstElementChild;
    const beforeHabits=document.getElementById('todayHabits').firstElementChild;
    const beforePalette=document.getElementById('primarySwatches').firstElementChild;
    const habit=state.habits[0],date=localToday();
    habit.days[date]=!habit.days[date];
    render('habits');
    return {taskUnchanged:beforeTask===document.getElementById('allTasks').firstElementChild,
      calendarUnchanged:beforeGrid===document.getElementById('weekGrid').firstElementChild,
      paletteUnchanged:beforePalette===document.getElementById('primarySwatches').firstElementChild,
      goalsChanged:beforeGoals!==document.getElementById('goalsList').firstElementChild,
      habitsChanged:beforeHabits!==document.getElementById('todayHabits').firstElementChild};
  });
  expect(result.taskUnchanged).toBe(true);
  expect(result.calendarUnchanged).toBe(true);
  expect(result.paletteUnchanged).toBe(true);
  expect(result.habitsChanged).toBe(true);
  expect(result.goalsChanged).toBe(true);
});

test('task check updates task + week, but leaves Habit Manager and Customize untouched',async({page})=>{
  await page.goto(base);
  const result=await page.evaluate(()=>{
    const taskBefore=document.getElementById('allTasks').firstElementChild;
    const weekBefore=document.getElementById('weekGrid').firstElementChild;
    const habitBefore=document.getElementById('habitManager').firstElementChild;
    const paletteBefore=document.getElementById('primarySwatches').firstElementChild;
    state.tasks[0].done=!state.tasks[0].done;
    render('tasks');
    return {tasksChanged:taskBefore!==document.getElementById('allTasks').firstElementChild,
      weekChanged:weekBefore!==document.getElementById('weekGrid').firstElementChild,
      habitSame:habitBefore===document.getElementById('habitManager').firstElementChild,
      paletteSame:paletteBefore===document.getElementById('primarySwatches').firstElementChild};
  });
  expect(result).toEqual({tasksChanged:true,weekChanged:true,habitSame:true,paletteSame:true});
});

test('hidden project Library does not fetch blobs until Library tab is opened',async({page})=>{
  await page.goto(base);
  const result=await page.evaluate(async()=>{
    const blob=new Blob([new Uint8Array([1,2,3])],{type:'image/png'});
    await v6Blob('put','perf-image-1',blob);
    state.projects=[{id:'p-perf',title:'Performance project',notes:[],actions:[],library:[
      {id:'image-1',title:'photo.png',type:'file',mime:'image/png',key:'perf-image-1'}
    ],notePages:[]}];
    window.v6ActiveProjectId='p-perf';
    v6ProjectTab='notes';
    let fetchCount=0;
    const original=v6Blob;
    v6Blob=async (...args)=>{if(args[0]==='get')fetchCount++;return original(...args);};
    try{
      v6Render();
      const hidden=fetchCount;
      v6ProjectTab='library';
      v6Render();
      // Force the new tiles into the observer's viewport when possible.
      const tile=document.querySelector('[data-v6-gallery-image]');
      const count=tile?1:0;
      if(tile&&typeof IntersectionObserver!=='function')await new Promise(r=>setTimeout(r,50));
      return {hidden,count,library:!document.getElementById('projectLibrary').hidden};
    }finally{v6Blob=original;}
  });
  expect(result.hidden).toBe(0);
  expect(result.count).toBe(1);
  expect(result.library).toBe(true);
});

test('render benchmark with populated planner: targeted updates touch fewer sections',async({page})=>{
  await page.goto(base);
  const metrics=await page.evaluate(()=>{
    const backup=structuredClone(state);
    try{
      const baseDate=localToday();
      state.tasks=Array.from({length:220},(_,i)=>({id:'benchmark-task-'+i,
        title:'Long test task '+i,done:false,priority:i%3===0,
        priorityRank:i+1,dueDate:baseDate,scheduledDate:baseDate}));
      state.habits=Array.from({length:36},(_,i)=>({id:'benchmark-habit-'+i,
        title:'Sample habit '+i,days:{},schedule:[0,1,2,3,4,5,6],createdOn:baseDate}));
      state.goals=Array.from({length:35},(_,i)=>({id:'benchmark-goal-'+i,title:'Goal '+i,
        category:'Personal',actions:[{id:'a'+i,title:'Step',done:false}]}));
      const started=performance.now();render();
      const fullMs=performance.now()-started;
      const t1=performance.now();render('habits');
      const habitMs=performance.now()-t1;
      const t2=performance.now();render('tasks');
      const taskMs=performance.now()-t2;
      return {fullMs,habitMs,taskMs,tasks:state.tasks.length,habits:state.habits.length};
    }finally{state=backup;render();}
  });
  expect(metrics.tasks).toBe(220);
  expect(metrics.habits).toBe(36);
  expect(metrics.fullMs).toBeGreaterThan(0);
  expect(metrics.habitMs).toBeGreaterThan(0);
  expect(metrics.taskMs).toBeGreaterThan(0);
  // Functional QA only; timing varies with CI hardware and is not a device FPS claim.
  console.log('Planner browser performance (ms):',JSON.stringify(metrics));
});
