'use strict';
const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';
test.use({browserName:'chromium'});

test('Today tasks, Today priorities and Week priorities show checks without editing controls',async({page})=>{
  await page.goto(base);
  await page.evaluate(()=>{
    const today=localToday();
    state.tasks=[
      {id:'compact-one',title:'Finish an exceptionally detailed engineering report for a research project',
        done:false,priority:true,priorityRank:1,dueDate:today,date:today,area:'Research'},
      {id:'compact-two',title:'Review lab notes',done:false,priority:true,priorityRank:2,dueDate:today,date:today}
    ];
    if(!save(true))throw Error('Failed to seed tasks');
    render();
  });
  const lists=['#v917TodayTasks','#v77TodayPriorities','#priorities'];
  const noActions='[data-bp-task-date],[data-bp-task-star],[data-edit-task],[data-bp-edit-task],.task-row-actions,[data-bp-swipe-done]';
  for(const target of lists){
    if(target==='#priorities')await page.locator('[data-tab="week"]').click();
    else await page.locator('[data-tab="today"]').click();
    const card=page.locator(target);
    await expect(card.locator('[data-bp-task-row="compact-one"]')).toBeVisible();
    await expect(card.locator(noActions)).toHaveCount(0);
    await expect(card.locator('[data-bp-task-row="compact-one"] [data-task-check]')).toBeVisible();
    await expect(card.locator('[data-bp-task-row="compact-one"] [data-bp-swipe-tomorrow]')).toHaveCount(1);
    await expect(card.locator('[data-bp-task-row="compact-one"]')).toHaveClass(/bp-task-readonly/);
  }
  for(const width of [320,375,390,620,768,1024,1366]){
    await page.setViewportSize({width,height:900});
    for(const target of ['#priorities']){
      const r=await page.locator(target+' [data-bp-task-row="compact-one"]').evaluate(el=>{
        const card=el.getBoundingClientRect(),title=el.querySelector('.bp-task-title').getBoundingClientRect(),
          checkbox=el.querySelector('[data-task-check]').getBoundingClientRect();
        return {cardRight:card.right,titleRight:title.right,titleWidth:title.width,
          checkboxRight:checkbox.right,titleLeft:title.left,scroll:el.scrollWidth,client:el.clientWidth};
      });
      expect(r.titleRight,width+' title right').toBeLessThanOrEqual(r.cardRight+2);
      expect(r.titleLeft,width+' checkbox spacing').toBeGreaterThanOrEqual(r.checkboxRight);
      expect(r.titleWidth,width+' title usable').toBeGreaterThan(75);
      expect(r.scroll,width+' no overflow').toBeLessThanOrEqual(r.client+2);
    }
  }
  await page.locator('#priorities [data-bp-task-row="compact-one"] [data-task-check]').check();
  await expect(page.locator('#priorities [data-bp-task-row="compact-one"]')).toHaveCount(0);
  const saved=await page.evaluate(()=>{
    const disk=JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {live:state.tasks.find(t=>t.id==='compact-one').done,stored:disk.tasks.find(t=>t.id==='compact-one').done};
  });
  expect(saved).toEqual({live:true,stored:true});
  await page.locator('[data-tab="myplan"]').click();
  await page.locator('#myplan .plan-tabs [data-plan-tab="tasks"]').click();
  await expect(page.locator('#allTasks [data-bp-task-row="compact-one"] [data-bp-edit-task]')).toBeVisible();
  await expect(page.locator('#allTasks [data-bp-task-row="compact-one"] [data-bp-task-date]')).toHaveCount(0);
});

test('Week shows completed scheduled tasks for unchecking without opening event creation',async({page})=>{
  await page.goto(base);
  await page.evaluate(()=>{
    selectedWeek=startOfWeek(new Date('2026-12-02T12:00:00'));
    state.tasks=[{id:'week-recheck',title:'Finish lab analysis',done:true,priority:false,
      dueDate:'2026-12-02',date:'2026-12-02',scheduledDate:'2026-12-02',scheduledTime:'10:15'}];
    if(!save(true))throw Error('Failed to seed checked task');
    render();
  });
  await page.locator('[data-tab="week"]').click();
  const row=page.locator('#weekGrid [data-week-event-date="2026-12-02"] .bp-cal-task');
  await expect(row).toContainText('Finish lab analysis');
  await expect(row).toHaveClass(/bp-cal-task-completed/);
  await expect(row.locator('[data-task-check="week-recheck"]')).toBeChecked();
  await row.locator('[data-task-check="week-recheck"]').uncheck();
  await expect(row.locator('[data-task-check="week-recheck"]')).not.toBeChecked();
  await expect(page.locator('#v87EventBack')).toBeHidden();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem(STORAGE_KEY)).tasks[0].done)).toBe(false);
});
