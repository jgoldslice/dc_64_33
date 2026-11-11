'use strict';
const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';

test('v9.15 Today stays aligned in portrait, landscape, and phone widths',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:834,height:1194});
  await page.goto(base);
  for(const vp of [{width:834,height:1194},{width:1194,height:834}]){
    await page.setViewportSize(vp);
    await expect(page.locator('#today .v915-today-columns')).toBeVisible();
    const layout=await page.evaluate(()=>{
      const rect=id=>document.getElementById(id).closest('section.card').getBoundingClientRect();
      const g=rect('todayGlance'),h=rect('todayHabits'),p=rect('v77TodayPriorities'),r=rect('v77TodayProjects');
      return {g:{left:g.left,right:g.right,bottom:g.bottom},h:{left:h.left,bottom:h.bottom},p:{left:p.left,top:p.top},r:{left:r.left,right:r.right,top:r.top},overflow:document.documentElement.scrollWidth-innerWidth};
    });
    expect(layout.g.right).toBeLessThan(layout.h.left+4);
    expect(layout.g.right).toBeLessThan(layout.p.left+4);
    expect(Math.abs(layout.g.left-layout.r.left)).toBeLessThan(4);
    expect(Math.abs(layout.g.right-layout.r.right)).toBeLessThan(4);
    expect(layout.r.top-layout.g.bottom).toBeGreaterThanOrEqual(7);
    expect(layout.r.top-layout.g.bottom).toBeLessThanOrEqual(17);
    expect(layout.p.top-layout.h.bottom).toBeGreaterThanOrEqual(7);
    expect(layout.p.top-layout.h.bottom).toBeLessThanOrEqual(17);
    expect(layout.overflow).toBeLessThanOrEqual(3);
  }
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('#today .v915-today-columns')).toHaveCount(0);
  const order=await page.locator('#today > .stack > section.card').evaluateAll(cards=>cards.filter(el=>!el.hidden).map(c=>c.querySelector('.card-heading h2')?.textContent.trim()));
  expect(order).toEqual(['Today at a Glance','Habits','Top Priorities','Projects']);
  expect(errors).toEqual([]);
});

test('many events and habits scroll within their cards with headings fixed',async({page})=>{
  await page.setViewportSize({width:834,height:1194});
  await page.goto(base);
  await page.evaluate(()=>{
    state.events=Array.from({length:22},(_,i)=>({id:'layout-event-'+i,title:'Event '+i,date:localToday(),time:'10:00'}));
    state.habits=Array.from({length:18},(_,i)=>({id:'layout-habit-'+i,title:'Habit '+i,schedule:[0,1,2,3,4,5,6],days:{}}));
    render();
  });
  for(const id of ['todayGlance','todayHabits']){
    const list=page.locator('#'+id);
    const measured=await list.evaluate(el=>({client:el.clientHeight,scroll:el.scrollHeight,overflow:getComputedStyle(el).overflowY}));
    expect(measured.scroll).toBeGreaterThan(measured.client+20);
    expect(measured.overflow).toBe('auto');
    const card=list.locator('xpath=ancestor::section[contains(@class,"card")][1]');
    const before=await card.locator('.card-heading').boundingBox();
    await list.evaluate(el=>{el.scrollTop=95;});
    const after=await card.locator('.card-heading').boundingBox();
    expect(Math.abs(after.y-before.y)).toBeLessThanOrEqual(1);
    expect(await list.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
  }
});

test('habit marked on Today is reflected in the Week and monthly tracker',async({page})=>{
  await page.setViewportSize({width:834,height:1194});
  await page.goto(base);
  const today=await page.evaluate(()=>{
    state.habits=[{id:'sync-habit',title:'Habit Sync QA',schedule:[0,1,2,3,4,5,6],days:{}}];
    render();return localToday();
  });
  await page.locator('#todayHabits input[type="checkbox"]').check();
  const marked=await page.evaluate(today=>({
    data:state.habits[0].days[today],
    weekCheckboxes:[...document.querySelectorAll('#weekHabits input[type="checkbox"]')].filter(e=>e.checked).length
  }),today);
  expect(marked.data).toBe(true);
  expect(marked.weekCheckboxes).toBeGreaterThan(0);
  await page.locator('[data-tab="myplan"]').click();
  await page.locator('#myplan .plan-tabs [data-plan-tab="habits"]').click();
  const selected=page.locator('#v96MonthCalendar [data-v96-date="'+today+'"]');
  await expect(selected).toContainText('1/1');
});
