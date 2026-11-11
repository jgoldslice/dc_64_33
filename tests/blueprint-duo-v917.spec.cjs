'use strict';
const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';

test('Today separates schedule, tasks and priority cards without duplicating overdue items',async({page})=>{
  await page.setViewportSize({width:834,height:1194});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  await page.evaluate(()=>{
    state.events=[{id:'event-check',title:'Lab appointment',date:localToday(),time:'10:00'}];
    state.tasks=[
      {id:'task-now',title:'Finish report',dueDate:localToday(),done:false,priority:true,priorityRank:1},
      {id:'task-late',title:'Overdue report',dueDate:'2020-01-01',done:false,priority:false}
    ];
    render();
  });
  await expect(page.locator('#todayGlance')).toContainText('Lab appointment');
  await expect(page.locator('#todayGlance')).not.toContainText('Finish report');
  await expect(page.locator('#v917TodayTasks')).toContainText('Finish report');
  await expect(page.locator('#v917TodayTasks')).toContainText('Overdue report');
  await expect(page.locator('#v917TodayTasks')).not.toContainText('Lab appointment');
  await expect(page.locator('#v77TodayPriorities')).toContainText('Finish report');
  await expect(page.locator('#today > .stack > .v917-projects')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Duo viewport transition preserves content and switches from one to two columns',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:390,height:844});
  await page.goto(base);
  await page.evaluate(()=>{
    state.events=[{id:'duo-event',title:'Outer screen meeting',date:localToday(),time:'12:00'}];
    state.habits=[{id:'duo-habit',title:'Duo practice',days:{},createdOn:localToday(),schedule:[0,1,2,3,4,5,6]}];
    render();
  });
  const cols=page.locator('#today > .stack.v917-today-grid');
  await expect(cols).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-blueprint-display','compact');
  await expect(cols).toHaveCSS('grid-template-areas',/"schedule"/);
  await page.locator('#todayHabits [data-habit-check="duo-habit"]').check();
  await page.setViewportSize({width:900,height:850});
  await expect(page.locator('html')).toHaveAttribute('data-blueprint-display','expanded');
  await expect(cols).toHaveCSS('grid-template-areas',/schedule habits/);
  await expect(page.locator('#todayGlance')).toContainText('Outer screen meeting');
  await expect(page.locator('#todayHabits [data-habit-check="duo-habit"]')).toBeChecked();
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('html')).toHaveAttribute('data-blueprint-display','compact');
  await expect(page.locator('#todayGlance')).toContainText('Outer screen meeting');
  await expect(page.locator('#todayHabits [data-habit-check="duo-habit"]')).toBeChecked();
  expect(errors).toEqual([]);
});

test('scroll hints appear when dense schedule and tasks need internal scrolling',async({page})=>{
  await page.setViewportSize({width:834,height:1194});
  await page.goto(base);
  await page.evaluate(()=>{
    state.events=Array.from({length:22},(_,i)=>({id:'scroll-event-'+i,title:'Meeting '+i,date:localToday(),time:'10:00'}));
    state.tasks=Array.from({length:20},(_,i)=>({id:'scroll-task-'+i,title:'Task '+i,dueDate:localToday(),priority:false,done:false}));
    render();
  });
  for(const [id,cardName] of [['todayGlance','v917-schedule'],['v917TodayTasks','v917-tasks']]){
    const body=page.locator('#'+id);
    const card=page.locator('.'+cardName);
    await expect.poll(()=>body.evaluate(el=>el.scrollHeight-el.clientHeight)).toBeGreaterThan(60);
    await expect(card).toHaveClass(/v917-has-overflow/);
    await expect(card.locator('.v917-overflow-hint')).toBeVisible();
    const original=await card.locator('.card-heading').boundingBox();
    await body.evaluate(el=>{el.scrollTop=el.scrollHeight-el.clientHeight;});
    await expect.poll(()=>card.evaluate(el=>el.classList.contains('v917-has-overflow'))).toBe(false);
    const after=await card.locator('.card-heading').boundingBox();
    expect(Math.abs(original.y-after.y)).toBeLessThan(2);
  }
});

test('expanded Today centers when space permits and remains scrollable when content grows',async({page})=>{
  await page.setViewportSize({width:1194,height:1024});
  await page.goto(base);
  await expect(page.locator('#today')).toHaveCSS('justify-content','center');
  await expect(page.locator('#today > .v917-today-grid')).toHaveCSS('grid-template-areas',/projects projects/);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  expect(overflow).toBeLessThanOrEqual(3);
});
