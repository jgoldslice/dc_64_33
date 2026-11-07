const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';
test.use({browserName:'chromium',viewport:{width:834,height:1194},isMobile:true,hasTouch:true});

async function openWeek(page){
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  await page.locator('[data-tab="week"]').click();
  await expect(page.locator('#week')).toBeVisible();
  return errors;
}
const observedWeek=page=>page.evaluate(()=>iso(selectedWeek));
const observedEvents=page=>page.evaluate(()=>state.events.map(e=>({...e})));
const isoAfter=async(page,days)=>page.evaluate(days=>iso(plusDays(selectedWeek,days)),days);
async function swipe(page,selector,start,end){
  return page.locator(selector).evaluate((target,{start,end})=>{
    const touch=(x,y)=>new Touch({identifier:81,target,clientX:x,clientY:y,screenX:x,screenY:y});
    const a=touch(start.x,start.y),b=touch(end.x,end.y);
    target.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,cancelable:true,touches:[a],targetTouches:[a],changedTouches:[a]}));
    target.dispatchEvent(new TouchEvent('touchmove',{bubbles:true,cancelable:true,touches:[b],targetTouches:[b],changedTouches:[b]}));
    target.dispatchEvent(new TouchEvent('touchend',{bubbles:true,cancelable:true,touches:[],targetTouches:[],changedTouches:[b]}));
  },{start,end});
}
test('the calendar week arrows change the real displayed week and preserve the Week tab',async({page})=>{
  const errors=await openWeek(page);
  const monday=await observedWeek(page);
  const following=await isoAfter(page,7);
  await expect(page.locator('#v816CalendarPrev')).toBeVisible();
  await expect(page.locator('#v816CalendarNext')).toBeVisible();
  await page.locator('#v816CalendarNext').click();
  expect(await observedWeek(page)).toBe(following);
  await expect(page.locator('#weekGrid [data-week-event-date]')).toHaveCount(7);
  await page.locator('#v816CalendarPrev').click();
  expect(await observedWeek(page)).toBe(monday);
  await expect(page.locator('#week')).toBeVisible();
  expect(errors).toEqual([]);
});
test('swiping the calendar left/right moves weeks, but not between main app tabs',async({page})=>{
  const errors=await openWeek(page);
  const original=await observedWeek(page);
  const next=await isoAfter(page,7);
  const before=await page.locator('#weekGrid [data-week-event-date]').first().getAttribute('data-week-event-date');
  await swipe(page,'#weekGrid',{x:320,y:550},{x:160,y:560});
  expect(await observedWeek(page)).toBe(next);
  await expect(page.locator('#week')).toBeVisible();
  await swipe(page,'#weekGrid',{x:160,y:550},{x:320,y:555});
  expect(await observedWeek(page)).toBe(original);
  const now=await page.locator('#weekGrid [data-week-event-date]').first().getAttribute('data-week-event-date');
  expect(now).toBe(before);
  expect(errors).toEqual([]);
});
test('a vertical scroll gesture on the calendar does not turn the week',async({page})=>{
  await openWeek(page);
  const original=await observedWeek(page);
  await swipe(page,'#weekGrid',{x:200,y:400},{x:208,y:545});
  expect(await observedWeek(page)).toBe(original);
});
test('Add Event next/previous week preserves typed details and selected weekday',async({page})=>{
  const errors=await openWeek(page);
  const first=await observedWeek(page);
  await page.locator('#addWeekEvent').click();
  await expect(page.locator('#v87EventBack')).toBeVisible();
  await expect(page.locator('#v87EventDates [data-v87-date]')).toHaveCount(7);
  const chosen=await page.locator('#v87EventDates [aria-pressed="true"]').getAttribute('data-v87-date');
  await page.locator('#v87EventName').fill('Next week planning');
  await page.locator('#v87EventTime').fill('14:15');
  await page.locator('#v816EventNext').click();
  const second=await page.locator('#v87EventDates [aria-pressed="true"]').getAttribute('data-v87-date');
  const expected=await page.evaluate(chosen=>iso(plusDays(new Date(chosen+'T12:00:00'),7)),chosen);
  expect(second).toBe(expected);
  await expect(page.locator('#v87EventName')).toHaveValue('Next week planning');
  await expect(page.locator('#v87EventTime')).toHaveValue('14:15');
  await page.locator('#v816EventPrev').click();
  await expect(page.locator('#v87EventDates [aria-pressed="true"]')).toHaveAttribute('data-v87-date',chosen);
  expect(await observedWeek(page)).toBe(first);
  await page.locator('#v87EventCancel').click();
  await expect(page.locator('#v87EventBack')).toBeHidden();
  expect(errors).toEqual([]);
});
test('Add Event can schedule a future week and opens that calendar week on save',async({page})=>{
  const errors=await openWeek(page);
  const initialEvents=await observedEvents(page);
  await page.locator('#addWeekEvent').click();
  await page.locator('#v816EventNext').click();
  await page.locator('#v816EventNext').click();
  const target=await page.locator('#v87EventDates [data-v87-date]').last().getAttribute('data-v87-date');
  await page.locator('#v87EventDates [data-v87-date="'+target+'"]').click();
  await page.locator('#v87EventName').fill('Future calendar event');
  await page.locator('#v87EventTime').fill('10:45');
  await page.locator('#v87EventForm button[type="submit"]').click();
  await expect(page.locator('#v87EventBack')).toBeHidden();
  const saved=(await observedEvents(page)).find(x=>x.title==='Future calendar event');
  expect(saved).toMatchObject({date:target,time:'10:45'});
  expect(await observedWeek(page)).toBe(await page.evaluate(target=>iso(startOfWeek(new Date(target+'T12:00:00'))),target));
  await expect(page.locator('#weekGrid')).toContainText('Future calendar event');
  await page.reload();
  await page.locator('[data-tab="week"]').click();
  expect((await observedEvents(page)).some(x=>x.id===saved.id&&x.date===target)).toBe(true);
  expect((await observedEvents(page)).length).toBe(initialEvents.length+1);
  expect(errors).toEqual([]);
});
test('tapping a day opens its date and still allows swiping to next week',async({page})=>{
  await openWeek(page);
  const date=await page.locator('#weekGrid [data-week-event-date]').first().getAttribute('data-week-event-date');
  await page.locator('#weekGrid [data-week-event-date]').first().click();
  await expect(page.locator('#v87EventBack')).toBeVisible();
  await expect(page.locator('#v87EventDates [data-v87-date]')).toHaveCount(7);
  await expect(page.locator('#v87EventDates [aria-pressed="true"]')).toHaveAttribute('data-v87-date',date);
  await swipe(page,'#v87EventDates',{x:320,y:470},{x:165,y:471});
  const next=await page.evaluate(date=>iso(plusDays(new Date(date+'T12:00:00'),7)),date);
  await expect(page.locator('#v87EventDates [aria-pressed="true"]')).toHaveAttribute('data-v87-date',next);
  await page.locator('#v87EventCancel').click();
});
test('page turn snapshot remains aligned with the source view at the start of a horizontal swipe',async({page})=>{
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  await page.evaluate(()=>window.scrollTo(0,0));
  const geometry=await page.evaluate(()=>{
    const target=document.querySelector('#today .view-header h1');
    if(!target)throw Error('Missing Today title for gesture');
    const rect=target.getBoundingClientRect(),x=rect.x+Math.min(100,rect.width/2),y=rect.y+rect.height/2;
    const first=new Touch({identifier:1,target,clientX:x,clientY:y});
    const moved=new Touch({identifier:1,target,clientX:x-85,clientY:y+2});
    target.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,cancelable:true,touches:[first],changedTouches:[first]}));
    target.dispatchEvent(new TouchEvent('touchmove',{bubbles:true,cancelable:true,touches:[moved],changedTouches:[moved]}));
    const layer=document.querySelector('.canvas-turn-layer');
    if(!layer)throw Error('Swipe did not create a page-turn layer');
    const snapshot=layer.querySelector('.canvas-turn-sheet .canvas-turn-snapshot');
    const source=document.querySelector('#today').getBoundingClientRect();
    const layerRect=layer.getBoundingClientRect();
    return {
      x:parseFloat(snapshot.style.left)-(source.left-layerRect.left),
      y:parseFloat(snapshot.style.top)-(source.top-layerRect.top),
      width:parseFloat(snapshot.style.width)-source.width,
      direction:layer.dataset.direction,
      transform:layer.querySelector('.canvas-turn-sheet').style.transform
    };
  });
  expect(Math.abs(geometry.x)).toBeLessThan(1.5);
  expect(Math.abs(geometry.y)).toBeLessThan(1.5);
  expect(Math.abs(geometry.width)).toBeLessThan(1.5);
  expect(geometry.direction).toBe('forward');
  expect(geometry.transform).toContain('rotateY(');
  expect(errors).toEqual([]);
});
