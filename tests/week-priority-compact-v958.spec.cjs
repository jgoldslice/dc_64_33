'use strict';
const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';
test.use({browserName:'chromium'});

test('Week Top Priorities is view and check only; Plan retains Task editing',async({page})=>{
  await page.goto(base);
  await page.evaluate(()=>{
    state.tasks=[
      {id:'week-compact-a',title:'Finish a detailed chemical engineering experiment and write up the findings',
        done:false,priority:true,priorityRank:1,dueDate:'2026-12-04',date:'2026-12-04',area:'Research'},
      {id:'week-compact-b',title:'Practice guitar',done:false,priority:true,priorityRank:2,dueDate:''}
    ];
    if(!save(true))throw Error('Unable to prepare priorities');
    render();
  });
  await page.locator('[data-tab="week"]').click();
  const card=page.locator('#week .v4-week-priorities');
  await expect(card.locator('#priorities .bp-task-preview-row')).toHaveCount(2);
  await expect(card.locator('[data-open="task"]')).toHaveCount(0);
  for(const id of ['week-compact-a','week-compact-b']){
    const row=card.locator('[data-bp-task-row="'+id+'"]');
    await expect(row.locator('[data-task-check]')).toBeVisible();
    await expect(row.locator('[data-bp-task-star],[data-bp-task-date],[data-edit-task],[data-bp-edit-task],.task-row-actions')).toHaveCount(0);
    await expect(row.locator('[data-bp-swipe-done]')).toHaveCount(0);
    await expect(row.locator('[data-bp-swipe-tomorrow]')).toHaveCount(1);
  }
  await expect(card.locator('[data-bp-task-row="week-compact-a"] .bp-task-preview-due')).toContainText('Due Dec 4');
  await expect(card.locator('[data-bp-task-row="week-compact-b"] .bp-task-preview-due')).toHaveCount(0);

  for(const width of [320,375,390,768,1024,1366]){
    await page.setViewportSize({width,height:900});
    const info=await card.locator('[data-bp-task-row="week-compact-a"]').evaluate(el=>{
      const r=el.getBoundingClientRect(),t=el.querySelector('.bp-task-title').getBoundingClientRect();
      const c=el.querySelector('[data-task-check]').getBoundingClientRect();
      return {rowWidth:r.width,titleWidth:t.width,titleRight:t.right,rowRight:r.right,
        titleLeft:t.left,checkboxRight:c.right,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth};
    });
    expect(info.titleWidth,width+' title width').toBeGreaterThan(100);
    expect(info.titleRight,width+' title right').toBeLessThanOrEqual(info.rowRight+2);
    expect(info.titleLeft,width+' title left').toBeGreaterThanOrEqual(info.checkboxRight);
    expect(info.scrollWidth,width+' row scroll width').toBeLessThanOrEqual(info.clientWidth+2);
  }
  await page.locator('[data-tab="myplan"]').click();
  await page.locator('#myplan .plan-tabs [data-plan-tab="tasks"]').click();
  const plan=page.locator('#allTasks [data-bp-task-row="week-compact-a"]');
  await expect(plan.locator('[data-bp-task-star]')).toBeVisible();
  await expect(plan.locator('[data-bp-task-date]')).toBeVisible();
  await expect(plan.locator('[data-bp-edit-task]')).toBeVisible();
});

test('Week priority checkbox marks task done without opening editor',async({page})=>{
  await page.goto(base);
  await page.evaluate(()=>{
    state.tasks=[{id:'week-check',title:'Review catalyst data',done:false,priority:true,priorityRank:1,dueDate:''}];
    if(!save(true))throw Error('Cannot prepare task');
    render();
  });
  await page.locator('[data-tab="week"]').click();
  const row=page.locator('#priorities [data-bp-task-row="week-check"]');
  await expect(row.locator('[data-edit-task]')).toHaveCount(0);
  // Completing a priority removes its row immediately, so click is the
  // correct interaction assertion instead of check() on a detached element.
  await row.locator('[data-task-check]').click();
  await expect(row).toHaveCount(0);
  expect(await page.evaluate(()=>{
    const disk=JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {done:state.tasks[0].done,storedDone:disk.tasks[0].done};
  })).toEqual({done:true,storedDone:true});
  await expect(page.locator('#modalBack')).not.toHaveClass(/open/);
});

test('Today Tasks and Top Priorities are view/check only, with room for long titles',async({page})=>{
  await page.goto(base);
  await page.evaluate(()=>{
    state.tasks=[
      {id:'today-compact-a',title:'Write a detailed proposal describing the catalyst characterization work for the whole team',
        done:false,priority:true,priorityRank:1,dueDate:localToday(),date:localToday(),area:'Research'},
      {id:'today-compact-b',title:'Review lab notes',done:false,priority:true,priorityRank:2,dueDate:localToday(),date:localToday()}
    ];
    if(!save(true))throw Error('Unable to prepare Today Task fixtures');
    render();
  });
  await page.locator('[data-tab="today"]').click();
  await expect(page.locator('#today .v917-tasks [data-open="task"]')).toHaveCount(0);
  const checkOnly='[data-bp-task-star],[data-bp-task-date],[data-edit-task],[data-bp-edit-task],.task-row-actions,[data-bp-swipe-done]';
  for(const list of ['#v917TodayTasks','#v77TodayPriorities']){
    await expect(page.locator(list+' .bp-task-preview-row')).toHaveCount(2);
    await expect(page.locator(list+' '+checkOnly.split(',').join(','+list+' '))).toHaveCount(0);
    await expect(page.locator(list+' [data-bp-task-row="today-compact-a"] [data-bp-swipe-tomorrow]')).toHaveCount(1);
  }
  for(const width of [320,375,390,768,1024,1366]){
    await page.setViewportSize({width,height:900});
    for(const list of ['#v917TodayTasks','#v77TodayPriorities']){
      const info=await page.locator(list+' [data-bp-task-row="today-compact-a"]').evaluate(el=>{
        const row=el.getBoundingClientRect(),title=el.querySelector('.bp-task-title').getBoundingClientRect();
        const checkbox=el.querySelector('[data-task-check]').getBoundingClientRect();
        return {titleWidth:title.width,titleRight:title.right,rowRight:row.right,checkboxRight:checkbox.right,
          titleLeft:title.left,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth};
      });
      expect(info.titleWidth,width+' '+list+' title').toBeGreaterThan(80);
      expect(info.titleRight,width+' '+list+' right edge').toBeLessThanOrEqual(info.rowRight+2);
      expect(info.titleLeft,width+' '+list+' checkbox gap').toBeGreaterThanOrEqual(info.checkboxRight);
      expect(info.scrollWidth,width+' '+list+' overflow').toBeLessThanOrEqual(info.clientWidth+2);
    }
  }
  await page.locator('#v917TodayTasks [data-bp-task-row="today-compact-a"] [data-task-check]').check();
  await expect(page.locator('#v77TodayPriorities [data-bp-task-row="today-compact-a"]')).toHaveCount(0);
  expect(await page.evaluate(()=>{
    const disk=JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {done:state.tasks.find(t=>t.id==='today-compact-a').done,
      storedDone:disk.tasks.find(t=>t.id==='today-compact-a').done};
  })).toEqual({done:true,storedDone:true});
});
