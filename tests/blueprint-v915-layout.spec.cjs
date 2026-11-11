'use strict';
const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';

test('v9.17 Today uses paired rows on expanded screens and a single column on phones',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:834,height:1194});
  await page.goto(base);
  for(const vp of [{width:834,height:1194},{width:1194,height:834}]){
    await page.setViewportSize(vp);
    await expect(page.locator('#today > .v917-today-grid')).toBeVisible();
    const layout=await page.evaluate(()=>{
      const rect=id=>document.getElementById(id).closest('section.card').getBoundingClientRect();
      const g=rect('todayGlance'),h=rect('todayHabits'),t=rect('v917TodayTasks'),p=rect('v77TodayPriorities'),r=rect('v77TodayProjects');
      return {g:{left:g.left,right:g.right,top:g.top,bottom:g.bottom},h:{left:h.left,right:h.right,top:h.top,bottom:h.bottom},t:{left:t.left,right:t.right,top:t.top,bottom:t.bottom},p:{left:p.left,right:p.right,top:p.top,bottom:p.bottom},r:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},overflow:document.documentElement.scrollWidth-innerWidth};
    });
    expect(layout.g.right).toBeLessThan(layout.h.left+4);
    expect(layout.t.right).toBeLessThan(layout.p.left+4);
    expect(Math.abs(layout.g.top-layout.h.top)).toBeLessThan(4);
    expect(Math.abs(layout.g.bottom-layout.h.bottom)).toBeLessThan(4);
    expect(Math.abs(layout.t.top-layout.p.top)).toBeLessThan(4);
    expect(Math.abs(layout.t.bottom-layout.p.bottom)).toBeLessThan(4);
    expect(Math.abs(layout.g.left-layout.r.left)).toBeLessThan(4);
    expect(Math.abs(layout.h.right-layout.r.right)).toBeLessThan(4);
    expect(layout.r.top-layout.t.bottom).toBeGreaterThanOrEqual(8);
    expect(layout.r.top-layout.t.bottom).toBeLessThanOrEqual(15);
    expect(layout.overflow).toBeLessThanOrEqual(3);
  }
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('#today .v915-today-columns')).toHaveCount(0);
  const order=await page.locator('#today > .stack > section.card').evaluateAll(cards=>cards.filter(el=>!el.hidden).map(c=>c.querySelector('.card-heading h2')?.textContent.trim()));
  expect(order).toEqual(['Schedule','Habits','Tasks','Top Priorities','Projects']);
  await expect(page.locator('#today > .stack')).toHaveCSS('grid-template-columns',/\d+.*px/);
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
  await expect(page.locator('#v916WeeklyProgress')).toContainText('1 of 1');
  await expect(page.locator('#habitsTracker input[type="checkbox"]:checked')).toHaveCount(1);
  await expect(page.locator('.v96-month-card')).toHaveCount(0);
});

test('v9.17 paired grid rows align without trimming either card body',async({page})=>{
  await page.setViewportSize({width:834,height:1194});
  await page.goto(base);
  await page.evaluate(()=>{
    state.events=Array.from({length:5},(_,i)=>({id:'align-event-'+i,title:'Event '+i,time:'09:00',date:localToday()}));
    state.tasks=Array.from({length:4},(_,i)=>({
      id:'align-task-'+i,title:'Task '+i,dueDate:localToday(),priority:true,
      priorityRank:i+1,done:false
    }));
    state.habits=Array.from({length:4},(_,i)=>({
      id:'align-habit-'+i,title:'Habit '+i,schedule:[0,1,2,3,4,5,6],days:{},createdOn:localToday()
    }));
    state.projects=[{id:'align-project',title:'Project',lastOpenedAt:0}];
    render();
  });
  for(const viewport of [{width:834,height:1194},{width:1194,height:834}]){
    await page.setViewportSize(viewport);
    await expect.poll(()=>page.evaluate(()=>{
      const bottom=id=>document.getElementById(id).closest('.card').getBoundingClientRect().bottom;
      const top=id=>document.getElementById(id).closest('.card').getBoundingClientRect().top;
      return Math.max(
        Math.abs(bottom('todayGlance')-bottom('todayHabits')),
        Math.abs(bottom('v917TodayTasks')-bottom('v77TodayPriorities')),
        Math.abs(top('todayGlance')-top('todayHabits'))
      );
    })).toBeLessThan(5);
  }
  await expect(page.locator('#today .v917-schedule .card-heading h2')).toHaveText('Schedule');
  await page.locator('[data-tab="week"]').click();
  await expect(page.locator('#week .v916-minimal-heading h2')).toHaveCSS('clip-path','inset(50%)');
  await expect(page.locator('#v94WeekForward')).toBeVisible();
});

test('v9.16 new habits do not retroactively count earlier days as missed',async({page})=>{
  await page.setViewportSize({width:834,height:1194});
  await page.goto(base);
  const counts=await page.evaluate(()=>{
    state.habits=[{id:'new-habit',title:'Just started',schedule:[0,1,2,3,4,5,6],days:{},createdOn:localToday()}];
    render();
    const start=selectedWeek;
    const weekDates=Array.from({length:7},(_,i)=>iso(plusDays(start,i)));
    return {
      expected:weekDates.filter(date=>date>=localToday()).length,
      available:document.querySelectorAll('#habitsTracker input[data-habit-check="new-habit"]').length,
      beforeStart:weekDates.filter(date=>date<localToday()&&!!document.querySelector('#habitsTracker input[data-date="'+date+'"]')).length,
      progress:document.getElementById('v916WeeklyProgress').textContent
    };
  });
  expect(counts.available).toBe(counts.expected);
  expect(counts.beforeStart).toBe(0);
  expect(counts.progress).toContain('0 of 1');
  await page.locator('[data-tab="myplan"]').click();
  await page.locator('#myplan .plan-tabs [data-plan-tab="habits"]').click();
  await expect(page.locator('.v96-month-card')).toHaveCount(0);
  const display=await page.locator('#habitManager').evaluate(el=>getComputedStyle(el).display);
  expect(display).toBe('grid');
});
