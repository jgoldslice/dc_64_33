const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';
test.use({browserName:'chromium',viewport:{width:390,height:844},isMobile:true,hasTouch:true});
async function start(page){
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  await expect(page.locator('#openingOverlay')).toBeHidden({timeout:10000});
  await page.evaluate(()=>window.scrollTo(0,0));
  return errors;
}
async function gesture(page,{from='today',dx=-135,dy=2,reverse=false,targetSelector,finish=true}={}){
  return page.evaluate(({from,dx,dy,reverse,targetSelector,finish})=>{
    const el=document.querySelector(targetSelector||'#'+from+' .view-header h1');
    if(!el)throw Error('No swipe target');
    const b=el.getBoundingClientRect(),x=b.x+Math.min(90,b.width/2),y=b.y+b.height/2;
    const t=(cx,cy)=>new Touch({identifier:63,target:el,clientX:cx,clientY:cy});
    const a=t(x,y),b1=t(x+dx,y+dy);
    const dispatch=(type,touches,changed)=>{
      el.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches,
        changedTouches:changed,targetTouches:touches}));
    };
    dispatch('touchstart',[a],[a]);
    dispatch('touchmove',[b1],[b1]);
    if(reverse)dispatch('touchmove',[t(x+3,y+dy)],[t(x+3,y+dy)]);
    if(finish)dispatch('touchend',[],[reverse?t(x+3,y+dy):b1]);
    return {...window.__blueprintMotionDebug,
      cloned:document.querySelectorAll('.canvas-turn-snapshot').length,
      active:document.querySelector('.view.active')?.id};
  },{from,dx,dy,reverse,targetSelector,finish});
}
test('repeated main swipes navigate exactly one tab and never create deep clones',async({page})=>{
  const errors=await start(page);
  const one=await gesture(page);
  expect(one.cloned).toBe(0);
  await expect(page.locator('#week')).toHaveClass(/active/);
  await gesture(page,{from:'week',dx:-150,targetSelector:'#weekTitle'});
  await expect(page.locator('#myplan')).toHaveClass(/active/);
  await expect(page.locator('.canvas-v91-pane')).toHaveCount(0);
  expect(await page.evaluate(()=>window.__blueprintMotionDebug.prepares)).toBe(2);
  expect(errors).toEqual([]);
});
test('reversing a drag cancels navigation and restores live view layout',async({page})=>{
  await start(page);
  const old=await page.locator('#today').evaluate(el=>el.getBoundingClientRect().width);
  await gesture(page,{reverse:true});
  await expect(page.locator('.canvas-v91-pane')).toHaveCount(0);
  await expect(page.locator('#today')).toHaveClass(/active/);
  const width=await page.locator('#today').evaluate(el=>el.getBoundingClientRect().width);
  expect(Math.abs(width-old)).toBeLessThan(1);
});
test('vertical movement never steals document scrolling',async({page})=>{
  await start(page);
  await gesture(page,{dx:-6,dy:150});
  expect(await page.evaluate(()=>window.__blueprintMotionDebug.prepares)).toBe(0);
  await expect(page.locator('#today')).toHaveClass(/active/);
});
test('reduced motion changes tabs without any transformed motion panes',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await start(page);
  await gesture(page,{dx:-140});
  await expect(page.locator('#week')).toHaveClass(/active/);
  expect(await page.evaluate(()=>window.__blueprintMotionDebug.prepares)).toBe(0);
  await expect(page.locator('.canvas-v91-pane')).toHaveCount(0);
});
test('a direct tab click interrupts animation and takes priority',async({page})=>{
  await start(page);
  await gesture(page,{dx:-135});
  await page.locator('[data-tab="brainstorm"]').click();
  await expect(page.locator('#brainstorm')).toHaveClass(/active/);
  await expect(page.locator('.canvas-v91-pane')).toHaveCount(0);
});
