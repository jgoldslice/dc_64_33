
'use strict';
const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';

test('Plan defaults to Overview and Weekly Blueprint opens as an accessible five-stage modal',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  await page.locator('[data-tab="myplan"]').click();
  await expect(page.locator('#overview')).toBeVisible();
  await expect(page.locator('#goals')).toBeHidden();
  await expect(page.locator('#wbOverviewGoals')).not.toBeEmpty();
  await page.locator('[data-wb-launch]').click();
  await expect(page.locator('#wbOverlay [role="dialog"]')).toBeVisible();
  await expect(page.locator('#wbTitle')).toHaveText('Report');
  await expect(page.locator('#wbProgress button')).toHaveCount(5);
  await page.locator('[data-wb-next]').click();
  await expect(page.locator('#wbTitle')).toHaveText('Goals');
  await page.keyboard.press('Escape');
  await expect(page.locator('#wbOverlay')).toBeHidden();
  await page.locator('[data-wb-launch]').click();
  await expect(page.locator('#wbTitle')).toHaveText('Goals');
  expect(errors).toEqual([]);
});

test('Sunday planning starts next Monday and week arrows stay on Schedule',async({page})=>{
  await page.clock.install({time:new Date('2026-11-22T19:00:00Z')});
  await page.setViewportSize({width:1194,height:834});
  await page.goto(base);
  await page.locator('[data-tab="myplan"]').click();
  await page.locator('[data-wb-launch]').click();
  expect(await page.evaluate(()=>BlueprintWeekly.getDraft().weekStart)).toBe('2026-11-23');
  await page.locator('[data-wb-step="2"]').click();
  await page.locator('.wb-calendar [data-wb-select-day="2026-11-26"]').click();
  await page.locator('#wbEventForm input[name=title]').fill('Planning meeting');
  await page.locator('#wbEventForm input[name=time]').fill('13:30');
  await page.locator('[data-wb-week="1"]').click();
  await expect(page.locator('#wbOverlay [role="dialog"]')).toBeVisible();
  await expect(page.locator('#wbTitle')).toHaveText('Schedule');
  expect(await page.evaluate(()=>BlueprintWeekly.getDraft().weekStart)).toBe('2026-11-30');
  expect(await page.evaluate(()=>BlueprintWeekly.getDraft().selectedDay)).toBe('2026-12-03');
  await expect(page.locator('#wbEventForm input[name=date]')).toHaveValue('2026-12-03');
  await expect(page.locator('#wbEventForm input[name=title]')).toHaveValue('Planning meeting');
  await expect(page.locator('#wbEventForm input[name=time]')).toHaveValue('13:30');
  await page.locator('[data-wb-week="-1"]').click();
  await expect(page.locator('#wbTitle')).toHaveText('Schedule');
  expect(await page.evaluate(()=>BlueprintWeekly.getDraft().weekStart)).toBe('2026-11-23');
  await expect(page.locator('#wbEventForm input[name=date]')).toHaveValue('2026-11-26');
});

test('reopening a blank browsed draft returns to the upcoming week without losing stage',async({page})=>{
  await page.clock.install({time:new Date('2026-11-22T19:00:00Z')});
  await page.goto(base);
  await page.locator('[data-tab="myplan"]').click();
  await page.locator('[data-wb-launch]').click();
  await page.locator('[data-wb-step="2"]').click();
  await page.locator('[data-wb-week="1"]').click();
  expect(await page.evaluate(()=>BlueprintWeekly.getDraft().weekStart)).toBe('2026-11-30');
  await page.locator('[data-wb-close]').click();
  await page.reload();
  await page.locator('[data-tab="myplan"]').click();
  await page.locator('[data-wb-launch]').click();
  await expect(page.locator('#wbTitle')).toHaveText('Schedule');
  expect(await page.evaluate(()=>BlueprintWeekly.getDraft().weekStart)).toBe('2026-11-23');
  await expect(page.locator('#wbEventForm input[name=date]')).toHaveValue('2026-11-23');
});

test('unsaved committed event drafts are retained on reopen and protected during week switches',async({page})=>{
  await page.clock.install({time:new Date('2026-11-22T19:00:00Z')});
  await page.goto(base);
  await page.locator('[data-tab="myplan"]').click();
  await page.locator('[data-wb-launch]').click();
  await page.locator('[data-wb-step="2"]').click();
  await page.locator('[data-wb-week="1"]').click();
  await page.locator('#wbEventForm input[name=title]').fill('Save this event');
  await page.locator('#wbEventForm button[type=submit]').click();
  await page.locator('[data-wb-close]').click();
  await page.reload();
  await page.locator('[data-tab="myplan"]').click();
  await page.locator('[data-wb-launch]').click();
  expect(await page.evaluate(()=>BlueprintWeekly.getDraft().weekStart)).toBe('2026-11-30');
  await expect(page.locator('#wbMain')).toContainText('Save this event');
  page.once('dialog',dialog=>dialog.dismiss());
  await page.locator('[data-wb-week="-1"]').click();
  expect(await page.evaluate(()=>BlueprintWeekly.getDraft().weekStart)).toBe('2026-11-30');
  await expect(page.locator('#wbTitle')).toHaveText('Schedule');
  await expect(page.locator('#wbMain')).toContainText('Save this event');
});

test('Report stages last-week task and habit checkmarks, then applies them together',async({page})=>{
  await page.goto(base);
  const dates=await page.evaluate(()=>{
    const lastMonday=iso(startOfWeek(new Date()));
    state.tasks=[{id:'wb-report-task',title:'Submit old assignment',dueDate:lastMonday,date:lastMonday,done:false,priority:false,priorityRank:0}];
    state.habits=[{id:'wb-report-habit',title:'Exercise',schedule:[0,1,2,3,4,5,6],days:{},createdOn:lastMonday}];
    state.goals=[];state.events=[];
    render();
    return {lastMonday};
  });
  await page.locator('[data-tab="myplan"]').click();
  await page.locator('[data-wb-launch]').click();
  await expect(page.locator('#wbMain')).toContainText('Submit old assignment');
  await page.locator('[data-wb-task-done="wb-report-task"]').check();
  await page.locator('[data-wb-habit="wb-report-habit"][data-wb-date="'+dates.lastMonday+'"]').check();
  const before=await page.evaluate(()=>({task:state.tasks[0].done,habit:state.habits[0].days[localToday()]}));
  expect(before.task).toBe(false);
  await page.locator('[data-wb-step="4"]').click();
  await expect(page.locator('#wbMain')).toContainText('Submit old assignment');
  await page.locator('[data-wb-next]').click();
  await expect(page.locator('#wbOverlay')).toBeHidden();
  const after=await page.evaluate(date=>({task:state.tasks[0].done,habit:state.habits[0].days[date],stored:JSON.parse(localStorage.getItem('jgold-planner-v1')).tasks[0].done}),dates.lastMonday);
  expect(after).toEqual({task:true,habit:true,stored:true});
});

test('Goals edits and milestone completion remain drafts until applied and keep linked tasks synchronized',async({page})=>{
  await page.goto(base);
  await page.evaluate(()=>{
    state.goals=[{id:'wb-goal',title:'Finish research',category:'Research',motivation:'Publish',actions:[{id:'a1',title:'Analyze data',done:false}]}];
    state.tasks=[{id:'wb-goal-task',title:'Analyze data',done:false,dueDate:'',priority:false,priorityRank:0,goalId:'wb-goal',actionId:'a1',actionIndex:0}];
    render();
  });
  await page.locator('[data-tab="myplan"]').click();
  await page.locator('[data-wb-launch]').click();
  await page.locator('[data-wb-step="1"]').click();
  await page.locator('[data-wb-goal-details="wb-goal"] summary').click();
  await page.locator('[data-wb-step-check="wb-goal"][data-wb-step="a1"]').check();
  await page.locator('[data-wb-step-add="wb-goal"]').click();
  const stepInputs=page.locator('[data-wb-step-title="wb-goal"]');
  await stepInputs.last().fill('Draft discussion');
  expect(await page.evaluate(()=>state.goals[0].actions.length)).toBe(1);
  expect(await page.evaluate(()=>state.tasks[0].done)).toBe(false);
  await page.locator('[data-wb-step="4"]').click();
  await expect(page.locator('#wbMain')).toContainText('Finish research');
  await page.locator('[data-wb-next]').click();
  const final=await page.evaluate(()=>({steps:state.goals[0].actions.map(a=>({title:a.title,done:a.done})),linked:state.tasks[0].done}));
  expect(final.steps).toEqual([{title:'Analyze data',done:true},{title:'Draft discussion',done:false}]);
  expect(final.linked).toBe(true);
});

test('iPhone scheduling stays day-by-day, shows staged events immediately, and persists edits',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto(base);
  await page.locator('[data-tab="myplan"]').click();
  await page.locator('[data-wb-launch]').click();
  await page.locator('[data-wb-step="2"]').click();
  await expect(page.locator('#wbOverlay .wb-days-strip')).toBeVisible();
  await expect(page.locator('#wbOverlay .wb-calendar')).toBeHidden();
  const day=await page.evaluate(()=>BlueprintWeekly.getDraft().weekStart);
  await page.locator('#wbEventForm input[name=title]').fill('Research meeting');
  await page.locator('#wbEventForm input[name=time]').fill('14:00');
  await page.locator('#wbEventForm button[type=submit]').click();
  await expect(page.locator('.wb-day-detail')).toContainText('Research meeting');
  expect(await page.evaluate(()=>state.events.some(e=>e.title==='Research meeting'))).toBe(false);
  await page.reload();
  await page.locator('[data-tab="myplan"]').click();
  await page.locator('[data-wb-launch]').click();
  await expect(page.locator('#wbTitle')).toHaveText('Schedule');
  await expect(page.locator('.wb-day-detail')).toContainText('Research meeting');
  await page.locator('[data-wb-step="4"]').click();
  await page.locator('[data-wb-next]').click();
  const recorded=await page.evaluate(()=>state.events.filter(e=>e.title==='Research meeting').map(e=>({date:e.date,time:e.time})));
  expect(recorded).toEqual([{date:day,time:'14:00'}]);
});

test('iPad full week calendar shows existing events in their day and updates after editing',async({page})=>{
  await page.setViewportSize({width:1194,height:834});
  await page.goto(base);
  const day=await page.evaluate(()=>{
    const date=iso(plusDays(startOfWeek(new Date()),7));
    state.events=[{id:'wb-edit-event',title:'Original meeting',date,time:'10:00'}];
    render();return date;
  });
  await page.locator('[data-tab="myplan"]').click();
  await page.locator('[data-wb-launch]').click();
  await page.locator('[data-wb-step="2"]').click();
  await expect(page.locator('.wb-calendar')).toBeVisible();
  await expect(page.locator('.wb-calendar')).toContainText('Original meeting');
  await page.locator('[data-wb-edit-event="existing:wb-edit-event"]').first().click();
  await page.locator('#wbEventForm input[name=title]').fill('Revised meeting');
  await page.locator('#wbEventForm button[type=submit]').click();
  await expect(page.locator('.wb-calendar')).toContainText('Revised meeting');
  expect(await page.evaluate(()=>state.events[0].title)).toBe('Original meeting');
  await page.locator('[data-wb-step="4"]').click();
  await page.locator('[data-wb-next]').click();
  expect(await page.evaluate(()=>state.events[0].title)).toBe('Revised meeting');
  expect(await page.evaluate(()=>state.events[0].date)).toBe(day);
});

test('Prioritize lists all app tasks and can rank a Project to-do without a deadline',async({page})=>{
  await page.goto(base);
  await page.evaluate(()=>{
    const tasks=[
      {id:'plain',title:'Undated task'},
      {id:'overdue',title:'Overdue task',dueDate:'2000-01-01'},
      {id:'later',title:'Future task',dueDate:'2099-01-01'},
      {id:'area',title:'Area task',area:'Research'},
      {id:'goal',title:'Goal task',goalId:String(state.goals[0].id)},
      {id:'selected',title:'Previously starred',priority:true,priorityRank:1},
      {id:'done',title:'Completed task',done:true}
    ];
    state.tasks=tasks.map(t=>({dueDate:'',done:false,priority:false,priorityRank:0,...t}));
    const action={id:'action',title:'Project task',done:false};
    const project={id:'test-project',title:'Test Project',notes:[],library:[],actions:[action]};
    state.projects=[project];
    v6EnsureProjectTask(project,action);
    render();
  });
  await page.locator('[data-tab="myplan"]').click();
  await page.locator('[data-wb-launch]').click();
  await page.locator('[data-wb-step="3"]').click();
  const list=page.getByRole('region',{name:'All tasks'});
  const row=title=>list.locator('.wb-row').filter({hasText:title});
  await expect(list.locator('.wb-row')).toHaveCount(8);
  for(const title of ['Undated task','Overdue task','Future task','Area task','Goal task','Project task'])
    await expect(row(title).getByRole('button',{name:'+ Prioritize'})).toBeVisible();
  await expect(row('Previously starred')).toContainText('Prioritized');
  await expect(row('Completed task').getByRole('button')).toHaveCount(0);
  await expect(row('Completed task').locator('.wb-chip')).toHaveText('Completed');

  await row('Project task').getByRole('button',{name:'+ Prioritize'}).click();
  await expect(row('Project task')).toContainText('Prioritized');
  await expect(page.locator('#wbPriorityOrder')).toContainText('Project task');
  expect(await page.evaluate(()=>state.tasks.find(t=>t.title==='Project task').priority)).toBe(false);
  await page.locator('[data-wb-step="4"]').click();
  await page.locator('[data-wb-next]').click();
  const task=await page.evaluate(()=>state.tasks.find(t=>t.title==='Project task'));
  expect(task).toMatchObject({priority:true,priorityRank:2,projectId:'test-project',dueDate:''});
});

test('Priority reordering and undo restore the exact previous task priority state',async({page})=>{
  await page.goto(base);
  await page.evaluate(()=>{
    state.tasks=[
      {id:'wb-t1',title:'Priority one',dueDate:'',done:false,priority:true,priorityRank:1},
      {id:'wb-t2',title:'Priority two',dueDate:'',done:false,priority:true,priorityRank:2}
    ];
    render();
  });
  await page.locator('[data-tab="myplan"]').click();
  await page.locator('[data-wb-launch]').click();
  await page.locator('[data-wb-step="3"]').click();
  await page.locator('[data-wb-move-priority="wb-t2"][data-wb-dir="-1"]').click();
  await page.locator('[data-wb-step="4"]').click();
  await expect(page.locator('#wbMain')).toContainText('Priority two');
  await page.locator('[data-wb-next]').click();
  expect(await page.evaluate(()=>state.tasks.find(t=>t.id==='wb-t2').priorityRank)).toBe(1);
  page.on('dialog',d=>d.accept());
  await page.locator('[data-wb-undo]').click();
  await expect.poll(()=>page.evaluate(()=>state.tasks.find(t=>t.id==='wb-t1').priorityRank)).toBe(1);
  expect(await page.evaluate(()=>state.tasks.find(t=>t.id==='wb-t2').priorityRank)).toBe(2);
});

test('Weekly Blueprint modal survives expanded-to-compact viewport changes without losing stage',async({page})=>{
  await page.setViewportSize({width:1194,height:834});
  await page.goto(base);
  await page.locator('[data-tab="myplan"]').click();
  await page.locator('[data-wb-launch]').click();
  await page.locator('[data-wb-step="2"]').click();
  await expect(page.locator('.wb-calendar')).toBeVisible();
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('.wb-days-strip')).toBeVisible();
  await expect(page.locator('#wbTitle')).toHaveText('Schedule');
  await page.setViewportSize({width:900,height:834});
  await expect(page.locator('.wb-calendar')).toBeVisible();
  await expect(page.locator('#wbTitle')).toHaveText('Schedule');
});
