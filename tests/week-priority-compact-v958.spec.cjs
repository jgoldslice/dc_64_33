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
  await expect(card.locator('#priorities .bp-week-task-row')).toHaveCount(2);
  await expect(card.locator('[data-open="task"]')).toHaveCount(0);
  for(const id of ['week-compact-a','week-compact-b']){
    const row=card.locator('[data-bp-task-row="'+id+'"]');
    await expect(row.locator('[data-task-check]')).toBeVisible();
    await expect(row.locator('[data-bp-task-star],[data-bp-task-date],[data-edit-task],[data-bp-edit-task],.task-row-actions')).toHaveCount(0);
    await expect(row.locator('[data-bp-swipe-done]')).toHaveCount(0);
    await expect(row.locator('[data-bp-swipe-tomorrow]')).toHaveCount(1);
  }
  await expect(card.locator('[data-bp-task-row="week-compact-a"] .bp-week-task-due')).toContainText('Due Dec 4');
  await expect(card.locator('[data-bp-task-row="week-compact-b"] .bp-week-task-due')).toHaveCount(0);

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
  await row.locator('[data-task-check]').check();
  await expect(row).toHaveCount(0);
  expect(await page.evaluate(()=>{
    const disk=JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {done:state.tasks[0].done,storedDone:disk.tasks[0].done};
  })).toEqual({done:true,storedDone:true});
  await expect(page.locator('#modalBack')).not.toHaveClass(/open/);
});
