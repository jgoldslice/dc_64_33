'use strict';
const {test,expect}=require('@playwright/test');
test('next week planning stages new goals, selected-day events, and optional tasks until Apply',async({page})=>{
  await page.clock.install({time:new Date('2026-11-22T19:00:00Z')});
  await page.setViewportSize({width:1194,height:834});
  await page.goto('/');
  await page.locator('[data-tab="week"]').click();
  await expect(page.locator('#wbWeekLaunch')).toHaveText('Design Next Week');
  await page.locator('#wbWeekLaunch').click();
  expect(await page.evaluate(()=>BlueprintWeekly.getDraft().weekStart)).toBe('2026-11-23');
  await page.locator('[data-wb-step="1"]').click();
  await page.locator('[data-wb-add-goal]').click();
  const goal=page.locator('[data-wb-goal-field="title"]').last();
  await goal.fill('Complete lab report');
  expect(await page.evaluate(()=>state.goals.some(g=>g.title==='Complete lab report'))).toBe(false);
  await page.locator('[data-wb-step="2"]').click();
  await expect(page.locator('#wbEventForm')).toBeHidden();
  await page.locator('.wb-calendar [data-wb-day-card="2026-11-25"]').click();
  await expect(page.locator('#wbEventForm input[name="date"]')).toHaveValue('2026-11-25');
  await page.locator('#wbEventForm input[name="title"]').fill('Lab meeting');
  await page.locator('#wbEventForm input[name="time"]').fill('10:30');
  await page.locator('#wbEventForm button[type="submit"]').click();
  await expect(page.locator('#wbEventForm')).toBeHidden();
  await page.locator('[data-wb-step="3"]').click();
  await expect(page.locator('#wbNewTaskForm')).toBeHidden();
  await page.locator('[data-wb-task-toggle]').click();
  await page.locator('#wbNewTaskForm input[name="title"]').fill('Finish report');
  await page.locator('#wbNewTaskForm select[name="goalId"]').selectOption({label:'Complete lab report'});
  await page.locator('#wbNewTaskForm button[type="submit"]').click();
  await page.locator('[data-wb-step="4"]').click();
  await expect(page.locator('#wbMain')).toContainText('Complete lab report');
  await page.locator('[data-wb-next]').click();
  expect(await page.evaluate(()=>({goal:state.goals.find(g=>g.title==='Complete lab report')?.id,event:state.events.find(e=>e.title==='Lab meeting')?.date,task:state.tasks.find(t=>t.title==='Finish report')?.goalId}))).toEqual({goal:expect.any(String),event:'2026-11-25',task:expect.any(String)});
  expect(await page.evaluate(()=>state.tasks.find(t=>t.title==='Finish report').goalId===state.goals.find(g=>g.title==='Complete lab report').id)).toBe(true);
});

test('moving a drafted event by selecting a day edits the original and survives resume',async({page})=>{
  await page.clock.install({time:new Date('2026-11-22T19:00:00Z')});
  await page.setViewportSize({width:1194,height:834});
  await page.goto('/');
  await page.evaluate(()=>{
    state.events=[{id:'reschedule-me',title:'Lab meeting',date:'2026-11-23',time:'09:00'}];
    save(true);render();
  });
  await page.locator('[data-tab="week"]').click();
  await page.locator('#wbWeekLaunch').click();
  await page.locator('[data-wb-step="2"]').click();
  await page.locator('.wb-calendar [data-wb-edit-event="existing:reschedule-me"]').click();
  await page.locator('#wbEventForm input[name="title"]').fill('Updated lab meeting');
  await page.locator('.wb-calendar [data-wb-select-day="2026-11-25"]').click();
  await expect(page.locator('#wbEventForm input[name="title"]')).toHaveValue('Updated lab meeting');
  await expect(page.locator('#wbEventForm input[name="date"]')).toHaveValue('2026-11-25');
  await expect(page.locator('#wbEventForm button[type="submit"]')).toHaveText('Save event change');
  await page.locator('#wbEventForm button[type="submit"]').click();
  expect(await page.evaluate(()=>state.events[0].date)).toBe('2026-11-23');
  await page.reload();
  await page.locator('[data-tab="week"]').click();
  await page.locator('#wbWeekLaunch').click();
  await expect(page.locator('.wb-calendar [data-wb-day-card="2026-11-25"]')).toContainText('Updated lab meeting');
  await page.locator('[data-wb-step="4"]').click();
  await page.locator('[data-wb-next]').click();
  expect(await page.evaluate(()=>state.events)).toEqual([{id:'reschedule-me',title:'Updated lab meeting',date:'2026-11-25',time:'09:00'}]);
});

test('a new goal can be removed while retaining and unlinking its drafted tasks',async({page})=>{
  await page.goto('/');
  await page.evaluate(()=>{state.goals=[];state.tasks=[];save(true);render();});
  await page.locator('[data-tab="myplan"]').click();
  await page.locator('[data-wb-launch]').click();
  await page.locator('[data-wb-step="1"]').click();
  await page.locator('[data-wb-add-goal]').click();
  await expect(page.locator('[data-wb-goal-field="title"]')).toHaveValue('');
  await page.locator('[data-wb-step="4"]').click();
  await expect(page.locator('#wbMain')).toContainText('Unnamed goal');
  await page.locator('[data-wb-next]').click();
  await expect(page.locator('#wbStatus')).toContainText('Give each new goal a name');
  await page.locator('[data-wb-step="1"]').click();
  if(!await page.locator('[data-wb-goal-details]').last().evaluate(el=>el.open))await page.locator('[data-wb-goal-details] summary').last().click();
  await page.locator('[data-wb-remove-goal]').click();
  expect(await page.evaluate(()=>BlueprintWeekly.getDraft().newGoals)).toHaveLength(0);
  await page.locator('[data-wb-add-goal]').click();
  await page.locator('[data-wb-goal-field="title"]').fill('Research milestone');
  await page.locator('[data-wb-step="3"]').click();
  await page.locator('[data-wb-task-toggle]').click();
  await page.locator('#wbNewTaskForm input[name="title"]').fill('Finish the analysis');
  await page.locator('#wbNewTaskForm select[name="goalId"]').selectOption({label:'Research milestone'});
  await page.locator('#wbNewTaskForm button[type="submit"]').click();
  await page.locator('[data-wb-step="1"]').click();
  if(!await page.locator('[data-wb-goal-details]').last().evaluate(el=>el.open))await page.locator('[data-wb-goal-details] summary').last().click();
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('[data-wb-remove-goal]').click();
  expect(await page.evaluate(()=>({goals:BlueprintWeekly.getDraft().newGoals,tasks:BlueprintWeekly.getDraft().newTasks.map(t=>({title:t.title,goalId:t.goalId}))}))).toEqual({goals:[],tasks:[{title:'Finish the analysis',goalId:''}]});
  await page.locator('[data-wb-step="4"]').click();
  await page.locator('[data-wb-next]').click();
  expect(await page.evaluate(()=>({goals:state.goals,tasks:state.tasks.map(t=>({title:t.title,goalId:t.goalId}))}))).toEqual({goals:[],tasks:[{title:'Finish the analysis',goalId:''}]});
});

test('switching events asks before discarding an unfinished event',async({page})=>{
  await page.clock.install({time:new Date('2026-11-22T19:00:00Z')});
  await page.setViewportSize({width:1194,height:834});
  await page.goto('/');
  await page.evaluate(()=>{state.events=[{id:'existing',title:'Existing',date:'2026-11-23',time:'10:00'}];save(true);render();});
  await page.locator('[data-tab="week"]').click();
  await page.locator('#wbWeekLaunch').click();
  await page.locator('[data-wb-step="2"]').click();
  await page.locator('.wb-calendar [data-wb-select-day="2026-11-24"]').click();
  await page.locator('#wbEventForm input[name="title"]').fill('Unfinished event');
  page.once('dialog',dialog=>dialog.dismiss());
  await page.locator('.wb-calendar [data-wb-edit-event="existing:existing"]').click();
  await expect(page.locator('#wbEventForm input[name="title"]')).toHaveValue('Unfinished event');
  expect(await page.evaluate(()=>BlueprintWeekly.getDraft().eventForm.date)).toBe('2026-11-24');
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('.wb-calendar [data-wb-edit-event="existing:existing"]').click();
  await expect(page.locator('#wbEventForm input[name="title"]')).toHaveValue('Existing');
});

test('only today is highlighted, including in adjacent weeks and on a Sunday',async({page})=>{
  await page.clock.install({time:new Date('2026-11-22T19:00:00Z')});
  await page.setViewportSize({width:1194,height:834});
  await page.goto('/');
  await page.locator('[data-tab="week"]').click();
  await expect(page.locator('#weekGrid [data-week-event-date="2026-11-22"]')).toHaveClass(/today/);
  await expect(page.locator('#weekGrid [data-week-event-date="2026-11-21"]')).not.toHaveClass(/today/);
  const backgrounds=await page.evaluate(()=>{
    const value=selector=>getComputedStyle(document.querySelector(selector)).backgroundColor;
    return {
      currentWeekend:value('#weekGrid .day-card.weekend'),
      adjacentWeekend:value('#v817WeekNext .day-card.weekend'),
      ordinaryDay:value('#weekGrid .day-card:not(.weekend)'),
      sunday:value('#weekGrid .weekend-half.today')
    };
  });
  expect(backgrounds.currentWeekend).toBe(backgrounds.ordinaryDay);
  expect(backgrounds.adjacentWeekend).toBe(backgrounds.ordinaryDay);
  expect(backgrounds.sunday).not.toBe(backgrounds.ordinaryDay);
});
