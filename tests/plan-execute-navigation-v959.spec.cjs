'use strict';
const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';
test.use({browserName:'chromium'});

test('Today and Week card headings navigate to the simple Plan Tasks and Habits sections',async({page})=>{
  await page.goto(base);
  await page.locator('.v917-priorities [data-bp-plan-destination="tasks"]').click();
  await expect(page.locator('#myplan')).toHaveClass(/active/);
  await expect(page.locator('#tasks')).toHaveClass(/active/);
  await page.locator('[data-tab="today"]').click();
  await page.locator('.v917-tasks [data-bp-plan-destination="tasks"]').click();
  await expect(page.locator('#tasks')).toHaveClass(/active/);
  await page.locator('[data-tab="today"]').click();
  await page.locator('.v917-habits [data-bp-plan-destination="habits"]').click();
  await expect(page.locator('#habits')).toHaveClass(/active/);
  await page.locator('[data-tab="week"]').click();
  await page.locator('.v4-week-priorities [data-bp-plan-destination="tasks"]').click();
  await expect(page.locator('#tasks')).toHaveClass(/active/);
  await page.locator('[data-tab="week"]').click();
  await page.locator('.v4-week-habits [data-bp-plan-destination="habits"]').click();
  await expect(page.locator('#habits')).toHaveClass(/active/);
});

test('Tapping an individual habit goes to the correct Plan row without checking it',async({page})=>{
  await page.goto(base);
  await page.evaluate(()=>{
    state.habits=[{id:'habit-highlight',title:'Morning run',days:{},schedule:[0,1,2,3,4,5,6],weeklyTarget:4}];
    if(!save(true))throw Error('Unable to seed Habit');render();
  });
  await page.locator('#todayHabits [data-bp-jump-habit="habit-highlight"]').click();
  await expect(page.locator('#habits')).toHaveClass(/active/);
  await expect(page.locator('#habitManager [data-bp-habit-row="habit-highlight"]')).toHaveClass(/bp-plan-jump-highlight/);
  expect(await page.evaluate(()=>state.habits[0].days)).toEqual({});
  await page.locator('[data-tab="week"]').click();
  await page.locator('#weekHabits [data-bp-jump-habit="habit-highlight"]').click();
  await expect(page.locator('#habitManager [data-bp-habit-row="habit-highlight"]')).toHaveClass(/bp-plan-jump-highlight/);
});

test('Crowded Week days expand all tasks and keep checked tasks available to uncheck',async({page})=>{
  await page.goto(base);
  await page.evaluate(()=>{
    selectedWeek=startOfWeek(new Date('2026-12-09T12:00:00'));
    state.tasks=Array.from({length:12},(_,i)=>({id:'crowd-'+i,title:'Lab task '+i,
      scheduledDate:'2026-12-09',dueDate:'',done:i===1,priority:false,priorityRank:0}));
    if(!save(true))throw Error('Unable to seed dense Week');render();
  });
  await page.locator('[data-tab="week"]').click();
  const wed=page.locator('#weekGrid [data-week-event-date="2026-12-09"]');
  await expect(wed.locator('[data-bp-jump-task]')).toHaveCount(7);
  await expect(wed.locator('[data-bp-week-more]')).toContainText('+5 more tasks');
  await wed.locator('[data-bp-week-more]').click();
  await expect(wed.locator('[data-bp-jump-task]')).toHaveCount(12);
  await expect(wed.locator('[data-bp-week-more]')).toHaveAttribute('aria-expanded','true');
  await expect(wed.locator('[data-task-check="crowd-1"]')).toBeChecked();
  await wed.locator('[data-task-check="crowd-1"]').uncheck();
  await expect(wed.locator('[data-task-check="crowd-1"]')).not.toBeChecked();
  await expect(page.locator('#v87EventBack')).toBeHidden();
  expect(await page.evaluate(()=>state.tasks.find(t=>t.id==='crowd-1').done)).toBe(false);
  await wed.locator('[data-bp-week-more]').click();
  await expect(wed.locator('[data-bp-jump-task]')).toHaveCount(7);
});

test('Today orders unfinished tasks ahead of completed tasks',async({page})=>{
  await page.goto(base);
  await page.evaluate(()=>{
    const d=localToday();
    state.tasks=[{id:'completed-first',title:'Finished',done:true,dueDate:d,priority:true},
      {id:'unfinished-last',title:'Remaining',done:false,dueDate:d,priority:false}];
    if(!save(true))throw Error('Unable to seed Today');render();
  });
  await expect(page.locator('#v917TodayTasks [data-bp-task-row]')).toHaveCount(2);
  await expect(page.locator('#v917TodayTasks [data-bp-task-row]').first()).toHaveAttribute('data-bp-task-row','unfinished-last');
});

test('One-tap completed deletion offers Undo and restores Project and Idea references',async({page})=>{
  await page.goto(base);
  await page.evaluate(()=>{
    state.tasks=[{id:'delete-linked',title:'Submitted manuscript',done:true,projectId:'proj',projectActionId:'pa',dueDate:''}];
    state.projects=[{id:'proj',title:'Research',actions:[{id:'pa',taskId:'delete-linked',title:'Submitted manuscript',done:true}],notes:[],library:[]}];
    state.ideas=[{id:'idea',title:'Notes',body:'',updated:'2026-11-22T12:00:00Z',actions:[{id:'ia',taskId:'delete-linked',title:'Draft',done:true}]}];
    if(!save(true))throw Error('Unable to seed links');render();
  });
  await page.locator('[data-tab="myplan"]').click();
  await page.locator('#myplan .plan-tabs [data-plan-tab="tasks"]').click();
  const dialogs=[];page.on('dialog',async d=>{dialogs.push(d.message());await d.dismiss();});
  await page.locator('#allTasks [data-bp-task-row="delete-linked"] [data-delete-completed-task]').click();
  await expect(page.locator('#allTasks [data-bp-task-row="delete-linked"]')).toHaveCount(0);
  await expect(page.locator('#bpTaskUndoToast')).toBeVisible();
  expect(dialogs).toEqual([]);
  await page.locator('#bpTaskUndoToast [data-bp-undo-task]').click();
  await expect(page.locator('#allTasks [data-bp-task-row="delete-linked"]')).toBeVisible();
  const restored=await page.evaluate(()=>{
    const disk=JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {task:!!state.tasks.find(t=>t.id==='delete-linked'),project:state.projects[0].actions[0].taskId,
      idea:state.ideas[0].actions[0].taskId,stored:disk.tasks.some(t=>t.id==='delete-linked')};
  });
  expect(restored).toEqual({task:true,project:'delete-linked',idea:'delete-linked',stored:true});
  await expect(page.locator('#bpTaskUndoToast')).toBeHidden();
});


test('Today includes scheduled work due later without duplicating overdue work',async({page})=>{
  await page.goto(base);
  await page.evaluate(()=>{
    const now=localToday();
    const tomorrow=iso(plusDays(new Date(now+'T12:00:00'),1));
    const yesterday=iso(plusDays(new Date(now+'T12:00:00'),-1));
    state.tasks=[
      {id:'scheduled-later',title:'Prepare next-week lab',done:false,dueDate:tomorrow,scheduledDate:now,scheduledTime:'09:00',priority:false},
      {id:'due-today',title:'Submit worksheet',done:false,dueDate:now,scheduledDate:'',priority:false},
      {id:'overdue-scheduled',title:'Fix overdue report',done:false,dueDate:yesterday,scheduledDate:now,priority:false},
      {id:'finished-today',title:'Already finished',done:true,dueDate:now,scheduledDate:'',priority:false}
    ];
    if(!save(true))throw Error('Unable to seed scheduled Today tasks');
    render();
  });
  const today=page.locator('#v917TodayTasks');
  const all=await today.locator('[data-bp-task-row]').evaluateAll(rows=>rows.map(row=>row.dataset.bpTaskRow));
  expect(all).toEqual(['overdue-scheduled','scheduled-later','due-today','finished-today']);
  await expect(today.getByText('For today')).toBeVisible();
  await today.locator('[data-bp-task-row="scheduled-later"] [data-task-check]').check();
  expect(await page.evaluate(()=>state.tasks.find(t=>t.id==='scheduled-later').done)).toBe(true);
});
