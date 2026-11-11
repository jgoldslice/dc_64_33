const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';
test.use({browserName:'chromium',viewport:{width:1366,height:1024},isMobile:true,hasTouch:true});
const isoWeek=page=>page.evaluate(()=>iso(selectedWeek));
const isoNext=async(page,days)=>page.evaluate(n=>iso(plusDays(selectedWeek,n)),days);
async function openWeek(page){
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  await page.goto(base);
  await page.locator('[data-tab="week"]').click();
  await expect(page.locator('#v817WeekViewport')).toBeVisible();
  // Calendar itself is now static; its arrows change weeks.
  await expect(page.locator('#v94WeekForward')).toBeVisible();
  return errors;
}
async function nativePageScroll(page,selector,side){
  const el=page.locator(selector);
  await expect.poll(()=>el.evaluate(x=>Math.round(x.scrollLeft/Math.max(1,x.clientWidth)))).toBe(1);
  // Re-centering deliberately disables scroll-snap for two animation frames.
  // Only simulate the next swipe once the scroller is fully unlocked.
  await expect.poll(()=>el.evaluate(x=>x.style.scrollSnapType)).toBe('');
  await el.evaluate(async (node,side)=>{
    node.scrollLeft=node.clientWidth*(1+side);
    await new Promise(resolve=>requestAnimationFrame(resolve));
    node.dispatchEvent(new Event('scrollend'));
  },side);
}
async function openNotebook(page,title='Zoom Window'){
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  await page.goto(base);
  await page.locator('[data-tab="brainstorm"]').click();
  page.once('dialog',dialog=>dialog.accept(title));
  await page.locator('#newProject').click();
  await page.locator('[data-v919-project-open="notes"]').click();
  await expect(page.locator('#v815ZoomViewport')).toBeVisible();
  return errors;
}
const geometry=page=>page.evaluate(()=>{
  const b=(selector)=>document.querySelector(selector).getBoundingClientRect();
  const paper=b('#v815ZoomViewport'),toolbar=b('#v76Editor .v76-toolbar'),rail=b('.v811-page-rail');
  const surface=b('#v76Surface'),panel=b('.v811-note-body');
  return {paper:{x:paper.x,y:paper.y,width:paper.width,height:paper.height},
    toolbar:{y:toolbar.y,width:toolbar.width},
    rail:{x:rail.x,width:rail.width},panel:{width:panel.width},
    surfaceWidth:surface.width,windowScroll:window.scrollY,
    documentOverflow:document.documentElement.scrollWidth-innerWidth};
});
test('Add Event uses a continuous swipeable strip without duplicate week arrows',async({page})=>{
  const errors=await openWeek(page);
  await page.locator('#addWeekEvent').click();
  const strip=page.locator('#v87EventDates');
  await expect(strip).toBeVisible();
  await expect(page.locator('#v816EventNext,#v816EventPrev')).toHaveCount(0);
  await expect(strip.locator('.v817-date-week')).toHaveCount(3);
  await expect(strip.locator('[data-v87-date]')).toHaveCount(21);
  expect(await strip.evaluate(el=>el.scrollWidth)).toBeGreaterThan((await strip.evaluate(el=>el.clientWidth))*2.8);
  await page.locator('#v87EventCancel').click();
  expect(errors).toEqual([]);
});
test('native date scrolling advances a week, keeps the weekday, and recenters indefinitely',async({page})=>{
  const errors=await openWeek(page);
  await page.locator('#addWeekEvent').click();
  await page.locator('#v87EventName').fill('Long range meeting');
  await page.locator('#v87EventTime').fill('16:30');
  const start=await page.locator('#v87EventDates [aria-pressed="true"]').getAttribute('data-v87-date');
  for(let i=1;i<=4;i++){
    await nativePageScroll(page,'#v87EventDates',1);
    const expected=await page.evaluate(({start,i})=>iso(plusDays(new Date(start+'T12:00:00'),7*i)),{start,i});
    await expect(page.locator('#v87EventDates [aria-pressed="true"]')).toHaveAttribute('data-v87-date',expected);
    await expect.poll(()=>page.locator('#v87EventDates').evaluate(el=>Math.round(el.scrollLeft/Math.max(1,el.clientWidth)))).toBe(1);
    await expect(page.locator('#v87EventName')).toHaveValue('Long range meeting');
    await expect(page.locator('#v87EventTime')).toHaveValue('16:30');
  }
  await nativePageScroll(page,'#v87EventDates',-1);
  const back=await page.evaluate(start=>iso(plusDays(new Date(start+'T12:00:00'),21)),start);
  await expect(page.locator('#v87EventDates [aria-pressed="true"]')).toHaveAttribute('data-v87-date',back);
  await page.locator('#v87EventCancel').click();
  expect(errors).toEqual([]);
});
test('Week at a Glance arrows change the week without leaving the Week tab',async({page})=>{
  const errors=await openWeek(page);
  const monday=await isoWeek(page),next=await isoNext(page,7);
  await expect(page.locator('#v94WeekBack')).toBeVisible();
  await expect(page.locator('#v94WeekForward')).toBeVisible();
  await expect(page.locator('#weekGrid [data-week-event-date]')).toHaveCount(7);
  await expect(page.locator('#v816CalendarPrev,#v816CalendarNext')).toHaveCount(0);
  await page.locator('#v94WeekForward').click();
  await expect.poll(()=>isoWeek(page)).toBe(next);
  await expect(page.locator('#week')).toHaveClass(/active/);
  await page.locator('#v94WeekBack').click();
  await expect.poll(()=>isoWeek(page)).toBe(monday);
  expect(errors).toEqual([]);
});
test('notebook viewport stays the same size and position across zoom levels',async({page})=>{
  const errors=await openNotebook(page);
  const original=await geometry(page);
  await expect(page.locator('.v811-page-rail')).toBeVisible();
  const originalNotes=await page.evaluate(()=>JSON.stringify(v6Project().notePages));
  const buttons=page.locator('#v815ZoomIn');
  await buttons.click();await buttons.click();await buttons.click(); // 175%
  await expect(page.locator('#v815ZoomReset')).toHaveText('175%');
  const close=await geometry(page);
  expect(Math.abs(close.paper.width-original.paper.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(close.paper.height-original.paper.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(close.paper.x-original.paper.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(close.paper.y-original.paper.y)).toBeLessThanOrEqual(1);
  expect(close.surfaceWidth).toBeGreaterThan(original.surfaceWidth*1.7);
  expect(close.rail.width).toBe(original.rail.width);
  expect(Math.abs(close.panel.width-original.panel.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(close.windowScroll-original.windowScroll)).toBeLessThanOrEqual(2);
  expect(close.documentOverflow).toBeLessThanOrEqual(2);
  await page.locator('#v815ZoomReset').click();
  const back=await geometry(page);
  expect(Math.abs(back.paper.height-original.paper.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(back.paper.width-original.paper.width)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(()=>JSON.stringify(v6Project().notePages))).toBe(originalNotes);
  expect(errors).toEqual([]);
});
test('scrolling a magnified note pans inside the notebook, not the whole app',async({page})=>{
  const errors=await openNotebook(page);
  const original=await geometry(page);
  for(let i=0;i<6;i++)await page.locator('#v815ZoomIn').click();
  await expect(page.locator('#v815ZoomReset')).toHaveText('300%');
  const result=await page.locator('#v815ZoomViewport').evaluate(el=>{
    const before=window.scrollY,top=el.scrollTop,left=el.scrollLeft;
    el.scrollTop=220;el.scrollLeft=130;
    return {top:el.scrollTop,left:el.scrollLeft,before,after:window.scrollY,
      scrollHeight:el.scrollHeight,clientHeight:el.clientHeight};
  });
  expect(result.scrollHeight).toBeGreaterThan(result.clientHeight);
  expect(result.top).toBeGreaterThan(100);
  expect(result.left).toBeGreaterThan(60);
  expect(Math.abs(result.before-result.after)).toBeLessThanOrEqual(2);
  const next=await geometry(page);
  expect(Math.abs(next.paper.height-original.paper.height)).toBeLessThanOrEqual(1);
  expect(next.documentOverflow).toBeLessThanOrEqual(2);
  expect(errors).toEqual([]);
});
test('Safari gesture start is canceled only inside the note viewport',async({page})=>{
  await openNotebook(page);
  const prevented=await page.evaluate(()=>{
    const pad=document.getElementById('v815ZoomViewport');
    const a=new Event('gesturestart',{bubbles:true,cancelable:true});
    pad.dispatchEvent(a);
    const b=new Event('gesturestart',{bubbles:true,cancelable:true});
    document.getElementById('projectTitle').dispatchEvent(b);
    return {inside:a.defaultPrevented,outside:b.defaultPrevented};
  });
  expect(prevented).toEqual({inside:true,outside:false});
});
