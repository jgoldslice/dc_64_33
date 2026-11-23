'use strict';
const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';

async function assertFooterVisible(form,footer){
  const box=await form.evaluate((el,selector)=>{
    const parent=el.getBoundingClientRect(),child=el.querySelector(selector).getBoundingClientRect();
    return {top:child.top,bottom:child.bottom,left:child.left,right:child.right,
      parentTop:parent.top,parentBottom:parent.bottom,width:innerWidth,height:innerHeight};
  },footer);
  expect(box.top).toBeGreaterThanOrEqual(Math.max(0,box.parentTop)-1);
  expect(box.bottom).toBeLessThanOrEqual(Math.min(box.height,box.parentBottom)+1);
  expect(box.left).toBeGreaterThanOrEqual(-1);
  expect(box.right).toBeLessThanOrEqual(box.width+1);
}

test('task editor keeps its actions visible and all fields reachable across phone, iPad, and desktop windows',async({page})=>{
  await page.goto(base);
  await page.locator('[data-tab="myplan"]').click();
  await page.locator('#myplan [data-plan-tab="tasks"]').click();
  await page.locator('#tasks > .plan-toolbar [data-open="task"]').click();
  const form=page.locator('#modalForm');
  for(const [width,height] of [[320,568],[568,320],[390,844],[844,390],[600,800],[768,1024],[1024,768],[1280,720],[1440,900]]){
    await page.setViewportSize({width,height});
    await assertFooterVisible(form,'.modal-actions');
    await expect(page.locator('#modalForm button[type="submit"]')).toBeVisible();
    expect(await page.locator('#modalForm button[type="submit"]').evaluate(e=>e.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    await page.locator('#modalFields [name="projectId"]').scrollIntoViewIfNeeded();
    await page.locator('#modalFields [name="projectId"]').focus();
    const reachable=await page.locator('#modalFields [name="projectId"]').evaluate(el=>{
      const input=el.getBoundingClientRect(),fields=el.closest('.form-fields').getBoundingClientRect();
      return input.bottom<=Math.min(fields.bottom,innerHeight)+1&&input.top>=Math.max(fields.top,0)-1;
    });
    expect(reachable,`${width}x${height}: Project selector is reachable`).toBe(true);
    await assertFooterVisible(form,'.modal-actions');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
  }
});

test('short weekly event form keeps actions visible while date and time controls scroll',async({page})=>{
  await page.setViewportSize({width:568,height:320});await page.goto(base);
  await page.locator('[data-tab="week"]').click();
  await page.locator('#addWeekEvent').click();
  const form=page.locator('#v87EventForm');
  await assertFooterVisible(form,'.v87-event-actions');
  await expect(page.locator('#v87EventDates')).toBeVisible();
  await page.locator('#v87EventTime').scrollIntoViewIfNeeded();
  await page.locator('#v87EventTime').focus();
  const metric=await page.locator('#v87EventTime').evaluate(el=>{
    const a=el.getBoundingClientRect(),b=el.closest('.v87-event-content').getBoundingClientRect();
    return {visible:a.top>=b.top-1&&a.bottom<=b.bottom+1,scroll:b.height<el.closest('.v87-event-content').scrollHeight};
  });
  expect(metric.visible).toBe(true);expect(metric.scroll).toBe(true);
  await assertFooterVisible(form,'.v87-event-actions');
  await page.locator('#v87EventCancel').click();
  await expect(page.locator('#v87EventBack')).toBeHidden();
});

test('crowded day sheet leaves its add action visible while the list scrolls',async({page})=>{
  await page.setViewportSize({width:568,height:320});await page.goto(base);
  const date=await page.evaluate(()=>{
    const d=localToday();selectedWeek=startOfWeek(new Date());
    state.events=Array.from({length:9},(_,i)=>({id:'event-'+i,title:'Meeting '+i,date:d,time:'09:00'}));
    state.tasks=Array.from({length:9},(_,i)=>({id:'task-'+i,title:'Task '+i,dueDate:d,scheduledDate:'',done:false}));
    if(!save(true))throw Error('Could not save test data');render();return d;
  });
  await page.locator('[data-tab="week"]').click();
  await page.locator(`#weekGrid [data-week-event-date="${date}"] .day-top`).click();
  const sheet=page.locator('#bpDayBack .bp-day-sheet');
  await expect(sheet.locator('[data-edit-event]')).toHaveCount(9);
  await expect(sheet.locator('[data-bp-jump-task]')).toHaveCount(9);
  await assertFooterVisible(sheet,'.bp-day-add');
  await sheet.locator('[data-bp-jump-task]').last().focus();
  const scroll=await sheet.locator('.bp-day-content').evaluate(el=>({top:el.scrollTop,height:el.clientHeight,total:el.scrollHeight}));
  expect(scroll.total).toBeGreaterThan(scroll.height);expect(scroll.top).toBeGreaterThan(0);
  await assertFooterVisible(sheet,'.bp-day-add');
  await sheet.locator('[data-bp-day-close]').click();
});
