'use strict';
const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';
test.use({browserName:'chromium',viewport:{width:834,height:1194},isMobile:true,hasTouch:true});
async function boot(page){
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  await expect(page.locator('#openingOverlay')).toBeHidden();
  return errors;
}
async function syntheticSwipe(page,selector,dx,dy=0){
  return page.locator(selector).evaluate((target,{dx,dy})=>{
    const rect=target.getBoundingClientRect();
    const x=rect.left+Math.min(90,rect.width*.4),y=rect.top+Math.min(50,rect.height*.4);
    const touch=(x,y)=>new Touch({identifier:123,target,clientX:x,clientY:y});
    const a=touch(x,y),b=touch(x+dx,y+dy);
    const send=(name,touches,changed)=>target.dispatchEvent(new TouchEvent(name,{
      bubbles:true,cancelable:true,touches,targetTouches:touches,changedTouches:changed
    }));
    send('touchstart',[a],[a]);send('touchmove',[b],[b]);send('touchend',[],[b]);
  },{dx,dy});
}
test('main tabs slide the full width with no opacity or page-turn transforms',async({page})=>{
  const errors=await boot(page);
  const state=await page.evaluate(async()=>{
    const target=document.querySelector('#today .view-header h1');
    const a=target.getBoundingClientRect(),x=a.left+80,y=a.top+15;
    const first=new Touch({identifier:121,target,clientX:x,clientY:y});
    const moved=new Touch({identifier:121,target,clientX:x-96,clientY:y});
    const send=(type,touches,changed)=>target.dispatchEvent(new TouchEvent(type,{
      bubbles:true,cancelable:true,touches,changedTouches:changed,targetTouches:touches
    }));
    send('touchstart',[first],[first]);send('touchmove',[moved],[moved]);
    await new Promise(resolve=>requestAnimationFrame(resolve));
    const source=document.getElementById('today'),dest=document.getElementById('week');
    const data={both:source.classList.contains('v94-live-pane')&&
      dest.classList.contains('v94-live-pane'),
      travel:parseFloat(source.style.transform.match(/translate3d\\((-?[\\d.]+)px/)?.[1]||0),
      opacity:source.style.opacity||'',
      destination:dest.style.transform,
      cloned:document.querySelectorAll('.canvas-turn-snapshot').length};
    send('touchcancel',[],[moved]);return data;
  });
  expect(state.both).toBe(true);
  expect(state.travel).toBeLessThan(-80);
  expect(state.travel).toBeGreaterThan(-110);
  expect(state.opacity).toBe('');
  expect(state.destination).toContain('translate3d(');
  expect(state.cloned).toBe(0);
  await expect(page.locator('#today')).toHaveClass(/active/);
  expect(errors).toEqual([]);
});
test('calendar and day picker own touch gestures, never the main tabs',async({page})=>{
  const errors=await boot(page);
  await page.locator('[data-tab="week"]').click();
  const before=await page.evaluate(()=>iso(selectedWeek));
  const next=await page.evaluate(()=>iso(plusDays(selectedWeek,7)));
  const preparations=await page.evaluate(()=>window.__blueprintMotionDebug.prepares);
  await syntheticSwipe(page,'#weekGrid',-155,2);
  await expect.poll(()=>page.evaluate(()=>iso(selectedWeek))).toBe(next);
  expect(await page.evaluate(()=>window.__blueprintMotionDebug.prepares)).toBe(preparations);
  await expect(page.locator('#week')).toHaveClass(/active/);
  await page.locator('#addWeekEvent').click();
  await syntheticSwipe(page,'#v87EventDates',-155,2);
  await expect(page.locator('#v87EventBack')).toBeVisible();
  await expect(page.locator('#week')).toHaveClass(/active/);
  await page.locator('#v87EventCancel').click();
  expect(before).not.toBe(next);
  expect(errors).toEqual([]);
});
test('habit card stays fixed after four and only its list scrolls',async({page})=>{
  await boot(page);
  await page.evaluate(()=>{
    state.habits=Array.from({length:4},(_,i)=>({
      id:'v94-'+i,title:'Habit '+i,schedule:[0,1,2,3,4,5,6],days:{}
    }));
    render();
  });
  const card=page.locator('#todayHabits').locator('xpath=ancestor::section[1]');
  const original=await card.evaluate(el=>el.getBoundingClientRect().height);
  await page.evaluate(()=>{
    state.habits.push(...Array.from({length:7},(_,i)=>({
      id:'v94-extra-'+i,title:'Extra Habit '+i,schedule:[0,1,2,3,4,5,6],days:{}
    })));
    render();
  });
  const after=await card.evaluate(el=>el.getBoundingClientRect().height);
  expect(Math.abs(after-original)).toBeLessThanOrEqual(2);
  const metrics=await page.locator('#todayHabits').evaluate(el=>({
    client:el.clientHeight,scroll:el.scrollHeight,overflow:getComputedStyle(el).overflowY
  }));
  expect(metrics.scroll).toBeGreaterThan(metrics.client);
  expect(metrics.overflow).toBe('auto');
  const preps=await page.evaluate(()=>window.__blueprintMotionDebug.prepares);
  await syntheticSwipe(page,'#todayHabits',-150,1);
  await expect(page.locator('#today')).toHaveClass(/active/);
  expect(await page.evaluate(()=>window.__blueprintMotionDebug.prepares)).toBe(preps);
});
test('Notes drawing gestures and project editor are protected from tab swipes',async({page})=>{
  await boot(page);
  await page.locator('[data-tab="brainstorm"]').click();
  page.once('dialog',d=>d.accept('Protected project'));
  await page.locator('#newProject').click();
  await page.locator('[data-v76-mode="pen"]').click();
  const before=await page.evaluate(()=>window.__blueprintMotionDebug.prepares);
  await syntheticSwipe(page,'#v76Ink',-150,1);
  await expect(page.locator('#brainstorm')).toHaveClass(/active/);
  expect(await page.evaluate(()=>window.__blueprintMotionDebug.prepares)).toBe(before);
  expect(await page.locator('#v76Ink').evaluate(el=>getComputedStyle(el).touchAction)).toBe('none');
});
test('native week strip supports mid-drag neighboring weeks without remount',async({page})=>{
  await boot(page);
  await page.locator('[data-tab="week"]').click();
  const strip=page.locator('#v817WeekViewport');
  await expect(strip.locator('.v817-week-panel')).toHaveCount(3);
  expect(await strip.evaluate(el=>getComputedStyle(el).scrollSnapType)).toContain('x mandatory');
  await expect(strip.locator('#v817WeekPrev')).toBeVisible();
  await expect(strip.locator('#v817WeekNext')).toBeVisible();
});
