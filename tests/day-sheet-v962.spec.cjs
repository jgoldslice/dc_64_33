'use strict';
const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';

test('day sheet lists all events and tasks, and a linked checkoff is saved across views',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  await page.evaluate(()=>{
    selectedWeek=startOfWeek(new Date('2026-12-09T12:00:00'));
    state.projects=[{id:'proj',title:'Catalysis',area:'Research',actions:[{id:'action',taskId:'linked',title:'Report',done:false}],notes:[],library:[]}];
    state.events=[{id:'event-one',title:'Group meeting',date:'2026-12-09',time:'14:30'}];
    state.tasks=[{id:'linked',title:'Report',dueDate:'2026-12-09',scheduledDate:'2026-12-09',scheduledTime:'09:00',done:false,projectId:'proj',projectActionId:'action',priority:false},
      ...Array.from({length:9},(_,i)=>({id:'task-'+i,title:'Sample '+i,dueDate:'2026-12-09',scheduledDate:'',done:false,priority:false}))];
    if(!save(true))throw Error('Could not seed');render();
  });
  await page.locator('[data-tab="week"]').click();
  const cell=page.locator('#weekGrid [data-week-event-date="2026-12-09"]');
  await cell.locator('[data-bp-week-more]').click();
  const day=page.locator('#bpDayBack');
  await expect(day).toBeVisible();
  await expect(day.locator('[data-edit-event]')).toHaveCount(1);
  await expect(day.locator('[data-bp-jump-task]')).toHaveCount(10);
  await expect(day).toContainText('Research · Catalysis');
  await day.locator('[data-task-check="linked"]').check();
  await expect(day.locator('[data-task-check="linked"]')).toBeChecked();
  expect(await page.evaluate(()=>({task:state.tasks.find(t=>t.id==='linked').done,project:state.projects[0].actions[0].done,stored:JSON.parse(localStorage.getItem(STORAGE_KEY)).tasks.find(t=>t.id==='linked').done}))).toEqual({task:true,project:true,stored:true});
  await day.locator('[data-bp-jump-task="linked"]').click();
  await expect(day).toBeHidden();
  await expect(page.locator('#tasks')).toHaveClass(/active/);
  await expect(page.locator('#allTasks [data-bp-task-row="linked"]')).toHaveClass(/bp-plan-jump-highlight/);
  expect(errors).toEqual([]);
});

test('Today groups multiple completed tasks and explains overdue dates without changing priority',async({page})=>{
  await page.goto(base);
  await page.evaluate(()=>{
    const now=localToday(),old=iso(plusDays(new Date(now+'T12:00:00'),-2));
    state.tasks=[{id:'late',title:'Late report',dueDate:old,done:false,priority:false},
      ...Array.from({length:3},(_,i)=>({id:'done-'+i,title:'Finished '+i,dueDate:now,done:true,priority:false}))];
    if(!save(true))throw Error('Could not seed');render();
  });
  const today=page.locator('#v77TodayPriorities');
  await expect(today).toContainText('2 days overdue');
  await expect(today.locator('.bp-today-completed summary')).toHaveText('Completed (3)');
  await expect(today.locator('[data-bp-task-row="done-0"]')).toBeHidden();
  await today.locator('summary').click();
  await today.locator('[data-task-check="done-0"]').uncheck();
  await expect(today.locator('[data-task-check="done-0"]')).not.toBeChecked();
  expect(await page.evaluate(()=>state.tasks.find(t=>t.id==='late').priority)).toBe(false);
});

test('event deletion offers one Undo and rolls back a failed save',async({page})=>{
  await page.goto(base);
  await page.evaluate(()=>{
    state.events=[{id:'event-undo',title:'Research meeting',date:localToday(),time:'11:15'}];
    if(!save(true))throw Error('Could not seed');render();
  });
  const dialogs=[];page.on('dialog',async d=>{dialogs.push(d.message());await d.dismiss();});
  await page.locator('#todayGlance [data-edit-event="event-undo"]').click();
  await page.locator('#deleteModal').click();
  await expect(page.locator('#bpTaskUndoToast')).toContainText('Event deleted');
  expect(await page.evaluate(()=>state.events.length)).toBe(0);
  await page.locator('[data-bp-undo-task]').click();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem(STORAGE_KEY)).events[0].title)).toBe('Research meeting');
  expect(dialogs).toEqual([]);
  await page.locator('#todayGlance [data-edit-event="event-undo"]').click();
  await page.evaluate(()=>{
    window.__realSetItem=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){if(key===STORAGE_KEY)throw Error('full');return window.__realSetItem.call(this,key,value);};
  });
  await page.locator('#deleteModal').click();
  expect(await page.evaluate(()=>state.events.some(e=>e.id==='event-undo'))).toBe(true);
  await expect(page.locator('#modalBack')).toHaveClass(/open/);
  await page.evaluate(()=>{Storage.prototype.setItem=window.__realSetItem;});
  await page.locator('#cancelModal').click();
});

test('return to current week and open an empty day with keyboard',async({page})=>{
  await page.goto(base);
  await page.evaluate(()=>{state.events=[];state.tasks=[];save(true);render();});
  await page.locator('[data-tab="week"]').click();
  await page.locator('#v94WeekForward').click();
  await expect(page.locator('#v94WeekToday')).toBeVisible();
  await page.locator('#v94WeekToday').click();
  await expect(page.locator('#v94WeekToday')).toBeHidden();
  expect(await page.evaluate(()=>iso(selectedWeek))).toBe(await page.evaluate(()=>iso(startOfWeek(new Date()))));
  const cell=page.locator('#weekGrid [data-week-event-date]').first();
  await cell.focus();await page.keyboard.press('Enter');
  await expect(page.locator('#bpDayBack')).toContainText('Nothing scheduled for this day.');
  await page.keyboard.press('Escape');
  await expect(page.locator('#bpDayBack')).toBeHidden();
  await expect(cell).toBeFocused();
});

for(const width of [320,390,768,1024])test('day sheet fits viewport '+width,async({page})=>{
  await page.setViewportSize({width,height:820});await page.goto(base);
  await page.locator('[data-tab="week"]').click();
  await page.locator('#weekGrid [data-week-event-date]').first().locator('.day-top').click();
  const sheet=page.locator('#bpDayBack .bp-day-sheet');await expect(sheet).toBeVisible();
  const box=await sheet.boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width+1);
  await expect(page.locator('[data-bp-day-add]')).toBeVisible();
});
