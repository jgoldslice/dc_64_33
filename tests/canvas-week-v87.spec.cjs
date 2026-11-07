const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';
test.use({browserName:'chromium',viewport:{width:390,height:844},isMobile:true,hasTouch:true});
async function loadWeek(page){
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  await page.locator('[data-tab="week"]').click();
  await expect(page.locator('#week')).toBeVisible();
  return errors;
}
async function addEvent(page,{title='Research meeting',time='14:30'}={}){
  await page.locator('#v87EventName').fill(title);
  await page.locator('#v87EventTime').fill(time);
  await page.locator('#v87EventForm button[type="submit"]').click();
  await expect(page.locator('#v87EventBack')).toBeHidden();
}
test('Week shows one plus button and seven tappable days, including the shared weekend cell',async({page})=>{
  const errors=await loadWeek(page);
  await expect(page.locator('#addWeekEvent')).toBeVisible();
  const days=page.locator('#weekGrid [data-week-event-date]');
  await expect(days).toHaveCount(7);
  await expect(page.locator('#weekGrid .weekend-half[data-week-event-date]')).toHaveCount(2);
  const dates=await days.evaluateAll(items=>items.map(el=>el.dataset.weekEventDate));
  expect(new Set(dates).size).toBe(7);
  await expect(days.first()).toHaveAttribute('role','button');
  await expect(days.first()).toHaveAttribute('tabindex','0');
  expect(errors).toEqual([]);
});

test('tap a weekday to add an event with only name and time, save and reopen',async({page})=>{
  const errors=await loadWeek(page);
  const day=page.locator('#weekGrid [data-week-event-date]').nth(1);
  const date=await day.getAttribute('data-week-event-date');
  await day.click();
  await expect(page.locator('#v87EventBack')).toBeVisible();
  // v8.16 always shows week chips so a tapped day can be moved to another week.
  await expect(page.locator('#v87EventDates')).toBeVisible();
  await expect(page.locator('#v87EventDates [data-v87-date="'+date+'"]').first()).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#v87EventForm input')).toHaveCount(2);
  await addEvent(page,{title:'Chemistry lab',time:'15:45'});
  const saved=await page.evaluate(()=>state.events.find(e=>e.title==='Chemistry lab'));
  expect(saved).toMatchObject({date,time:'15:45',title:'Chemistry lab'});
  await expect(page.locator('#weekGrid [data-week-event-date="'+date+'"]')).toContainText('Chemistry lab');
  await page.reload();
  await page.locator('[data-tab="week"]').click();
  await expect(page.locator('#weekGrid [data-week-event-date="'+date+'"]')).toContainText('Chemistry lab');
  expect(errors).toEqual([]);
});

test('top-right plus picks a day from the displayed week and saves the chosen date',async({page})=>{
  await loadWeek(page);
  const day=page.locator('#weekGrid [data-week-event-date]').nth(4);
  const date=await day.getAttribute('data-week-event-date');
  await page.locator('#addWeekEvent').click();
  await expect(page.locator('#v87EventDates')).toBeVisible();
  await expect(page.locator('#v87EventDates [data-v87-date]')).toHaveCount(21);
  await page.locator('#v87EventDates [data-v87-date="'+date+'"]').click();
  await expect(page.locator('#v87EventDates [data-v87-date="'+date+'"]')).toHaveAttribute('aria-pressed','true');
  await addEvent(page,{title:'Soccer game',time:'18:00'});
  expect(await page.evaluate(()=>state.events.find(e=>e.title==='Soccer game'))).toMatchObject({date,time:'18:00'});
  await expect(day).toContainText('Soccer game');
});

test('Saturday and Sunday independently target the correct dates',async({page})=>{
  await loadWeek(page);
  const weekend=page.locator('#weekGrid .weekend-half[data-week-event-date]');
  const dates=await weekend.evaluateAll(els=>els.map(el=>el.dataset.weekEventDate));
  for(let i=0;i<2;i++){
    await weekend.nth(i).click();
    await addEvent(page,{title:'Weekend '+i,time:i===0?'10:15':'17:30'});
  }
  const stored=await page.evaluate(()=>state.events.filter(e=>e.title.startsWith('Weekend ')).map(e=>({title:e.title,date:e.date,time:e.time})));
  expect(stored).toEqual([
    {title:'Weekend 0',date:dates[0],time:'10:15'},
    {title:'Weekend 1',date:dates[1],time:'17:30'}
  ]);
  await expect(weekend.nth(0)).toContainText('Weekend 0');
  await expect(weekend.nth(1)).toContainText('Weekend 1');
});

test('next-week plus uses next-week dates; going backward does not move the event',async({page})=>{
  await loadWeek(page);
  const initial=await page.locator('#weekGrid [data-week-event-date]').first().getAttribute('data-week-event-date');
  await page.locator('#nextWeek').click();
  const next=await page.locator('#weekGrid [data-week-event-date]').first().getAttribute('data-week-event-date');
  expect(next).not.toBe(initial);
  await page.locator('#addWeekEvent').click();
  await expect(page.locator('#v87EventDates [data-v87-date="'+next+'"]')).toHaveAttribute('aria-pressed','true');
  await addEvent(page,{title:'Next week review',time:'08:00'});
  await page.locator('#prevWeek').click();
  expect(await page.locator('#weekGrid').textContent()).not.toContain('Next week review');
  await page.locator('#nextWeek').click();
  await expect(page.locator('#weekGrid [data-week-event-date="'+next+'"]')).toContainText('Next week review');
});

test('keyboard Enter opens quick add; Escape cancels without writing an event',async({page})=>{
  await loadWeek(page);
  const day=page.locator('#weekGrid [data-week-event-date]').first();
  await day.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#v87EventBack')).toBeVisible();
  await page.locator('#v87EventName').fill('Do not save');
  await page.keyboard.press('Escape');
  await expect(page.locator('#v87EventBack')).toBeHidden();
  await expect(day).toBeFocused();
  expect(await page.evaluate(()=>state.events.some(e=>e.title==='Do not save'))).toBe(false);
  await day.focus();await page.keyboard.press('Space');
  await expect(page.locator('#v87EventBack')).toBeVisible();
  await page.locator('#v87EventCancel').click();
  await expect(page.locator('#v87EventBack')).toBeHidden();
});

test('events entered for today also appear in Today at a Glance',async({page})=>{
  await loadWeek(page);
  const today=await page.evaluate(()=>localToday());
  const cell=page.locator('#weekGrid [data-week-event-date="'+today+'"]');
  if(!(await cell.count()))test.skip(true,'Current displayed week excludes today');
  await cell.click();
  await addEvent(page,{title:'Today calendar appointment',time:'13:15'});
  await page.locator('[data-tab="today"]').click();
  await expect(page.locator('#todayGlance')).toContainText('Today calendar appointment');
});

test('offline assets include quick event UI without changing existing video card support',async({request})=>{
  const res=await request.get(base+'sw.js');
  expect(res.ok()).toBe(true);
  const script=await res.text();
  expect(script).toContain('week-events-v87.css');
  expect(script).toContain('week-events-v87.js');
  expect(script).toContain('video-v86.js');
});
