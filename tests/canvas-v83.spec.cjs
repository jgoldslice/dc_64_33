const { test, expect } = require('@playwright/test');
test.use({ browserName:'chromium', viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
const base='http://127.0.0.1:8765/';

// Model a touch sequence against the actual tab DOM and document-level handlers.
// This catches regressions in gesture direction and dispatch without requiring
// physical iPhone hardware; final Safari validation is still a separate gate.
async function gesture(page,{from='today',start=315,end=105,target,vertical=0}={}){
  await page.evaluate(({from,start,end,target,vertical})=>{
    const el=target?document.querySelector(target):document.querySelector('#'+from+' .view-header h1');
    if(!el)throw new Error('Gesture target missing');
    function dispatch(type,x,y,active){
      const point=new Touch({identifier:123,target:el,clientX:x,clientY:y,pageX:x,pageY:y,screenX:x,screenY:y});
      el.dispatchEvent(new TouchEvent(type,{
        bubbles:true,cancelable:true,
        touches:active?[point]:[],targetTouches:active?[point]:[],changedTouches:[point]
      }));
    }
    dispatch('touchstart',start,250,true);
    dispatch('touchmove',end,250+vertical,true);
    dispatch('touchend',end,250+vertical,false);
  },{from,start,end,target,vertical});
}
test('Swipe next and previous flips the correct main tabs and cleans up overlays',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  await expect(page.locator('#openingOverlay')).toBeHidden({timeout:10000});
  await expect(page.locator('#today')).toHaveClass(/active/);
  await gesture(page);
  await expect(page.locator('#week')).toHaveClass(/active/);
  await expect(page.locator('.canvas-turn-layer')).toHaveCount(0);
  await gesture(page,{from:'week',start:90,end:310});
  await expect(page.locator('#today')).toHaveClass(/active/);
  await expect(page.locator('.canvas-turn-layer')).toHaveCount(0);
  expect(errors).toEqual([]);
});
test('Vertical scrolling and protected controls never trigger a tab turn',async({page})=>{
  await page.goto(base);
  await expect(page.locator('#openingOverlay')).toBeHidden({timeout:10000});
  await gesture(page,{start:185,end:155,vertical:170});
  await expect(page.locator('#today')).toHaveClass(/active/);
  await gesture(page,{start:315,end:105,target:'.bottom-nav [data-tab="today"]'});
  await expect(page.locator('#today')).toHaveClass(/active/);
  await expect(page.locator('.canvas-turn-layer')).toHaveCount(0);
});
test('Reduced Motion swaps tabs without a 3D overlay',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(base);
  await expect(page.locator('#openingOverlay')).toBeHidden({timeout:10000});
  await gesture(page);
  await expect(page.locator('#week')).toHaveClass(/active/);
  await expect(page.locator('.canvas-turn-layer')).toHaveCount(0);
});
test('Failed localStorage write leaves user edits in memory and Retry clears warning',async({page})=>{
  await page.goto(base);
  const result=await page.evaluate(()=>{
    const orig=Storage.prototype.setItem;
    Storage.prototype.setItem=function(){throw Object.assign(new Error('Quota'),{name:'QuotaExceededError'});};
    try{
      state.tasks.push({id:94211,title:'Unsaved test task',done:false});
      return {saved:save(),itemInMemory:state.tasks.some(t=>t.title==='Unsaved test task')};
    }finally{Storage.prototype.setItem=orig;}
  });
  expect(result).toEqual({saved:false,itemInMemory:true});
  await expect(page.locator('#canvasSaveWarning')).toBeVisible();
  await page.locator('#canvasSaveWarning button').click();
  await expect(page.locator('#canvasSaveWarning')).toBeHidden();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('jgold-planner-v1')).tasks.some(t=>t.title==='Unsaved test task'))).toBe(true);
});
test('Offline cache includes the v9.4 fluid navigation files while preserving safeguards',async({request})=>{
  const response=await request.get(base+'sw.js');
  expect(response.ok()).toBe(true);
  const source=await response.text();
  expect(source).toContain('fluid-navigation-v94.js');
  expect(source).toContain('fluid-navigation-v94.css');
  expect(source).toContain("name.startsWith(PREFIX)");
  expect(source).toContain("request.mode==='navigate'");
});
