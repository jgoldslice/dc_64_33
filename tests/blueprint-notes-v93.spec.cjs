'use strict';
const {test,expect}=require('@playwright/test');
test.use({browserName:'chromium',viewport:{width:1366,height:1024},isMobile:true,hasTouch:true});
const base=process.env.TEST_URL||'http://127.0.0.1:8765/';
async function openNotebook(page){
  await page.goto(base);
  await page.locator('[data-tab="brainstorm"]').click();
  page.once('dialog',d=>d.accept('Notes V93 Test'));
  await page.locator('#newProject').click();
  await expect(page.locator('#v76Editor')).toBeVisible();
}
test('new page is created immediately; options menu lives next to its name',async({page})=>{
  await openNotebook(page);
  await page.locator('#v811NewPage').click();
  await expect(page.locator('#v811PageList .v811-page-row')).toHaveCount(2);
  await expect(page.locator('#v811PageList .v811-current .v811-page-labels strong')).toHaveText('Page 2');
  await page.locator('#v811PageList .v811-current .v811-page-rename').click();
  await expect(page.locator('#v811PageList .v811-current #v76PageMenu')).toBeVisible();
  page.once('dialog',d=>d.accept('Experiments'));
  await page.locator('#v76RenamePage').click();
  await expect(page.locator('#v811PageList .v811-current .v811-page-labels strong')).toHaveText('Experiments');
});
test('full-width notes hides Pages and restores it without changing page',async({page})=>{
  await openNotebook(page);
  const selected=await page.locator('#v76PageSelect').inputValue();
  await page.locator('#v93TogglePageRail').click();
  await expect(page.locator('.v811-page-rail')).toBeHidden();
  await expect(page.locator('#v93TogglePageRail')).toHaveAttribute('aria-pressed','true');
  await page.locator('#v93TogglePageRail').click();
  await expect(page.locator('.v811-page-rail')).toBeVisible();
  await expect(page.locator('#v76PageSelect')).toHaveValue(selected);
});
test('at 50 percent, ink covers entire visible canvas; touch cannot create marks',async({page})=>{
  await openNotebook(page);
  await page.locator('#v815ZoomOut').click();
  await page.locator('#v815ZoomOut').click();
  await expect(page.locator('#v815ZoomReset')).toHaveText('50%');
  const dims=await page.evaluate(()=>{
    const v=document.querySelector('#v815ZoomViewport').getBoundingClientRect();
    const s=document.querySelector('#v76Surface').getBoundingClientRect();
    return {viewWidth:v.width,surfaceWidth:s.width,viewHeight:v.height,surfaceHeight:s.height};
  });
  expect(dims.surfaceWidth).toBeGreaterThanOrEqual(dims.viewWidth-3);
  expect(dims.surfaceHeight).toBeGreaterThanOrEqual(dims.viewHeight-3);
  await page.locator('[data-v76-mode="pen"]').click();
  const count=await page.evaluate(()=>v6Project().notePages[0].strokes.length);
  await page.locator('#v76Ink').dispatchEvent('pointerdown',{pointerId:17,pointerType:'touch',isPrimary:true,clientX:400,clientY:600});
  expect(await page.evaluate(()=>v6Project().notePages[0].strokes.length)).toBe(count);
});

test('Pencil surface suppresses browser scrolling and fingers can still pan',async({page})=>{
  await openNotebook(page);
  await page.locator('#v815ZoomIn').click();
  await page.locator('#v815ZoomIn').click();
  await page.locator('[data-v76-mode="pen"]').click();
  const result=await page.evaluate(()=>{
    const viewport=document.getElementById('v815ZoomViewport');
    const ink=document.getElementById('v76Ink');
    const touchStyle=getComputedStyle(ink).touchAction;
    const before=viewport.scrollTop;
    const make=(x,y)=>new Touch({
      identifier:101,target:ink,clientX:x,clientY:y
    });
    const begin=make(350,540),end=make(350,360);
    ink.dispatchEvent(new TouchEvent('touchstart',{
      bubbles:true,cancelable:true,touches:[begin],
      targetTouches:[begin],changedTouches:[begin]
    }));
    const moved=ink.dispatchEvent(new TouchEvent('touchmove',{
      bubbles:true,cancelable:true,touches:[end],
      targetTouches:[end],changedTouches:[end]
    }));
    ink.dispatchEvent(new TouchEvent('touchend',{
      bubbles:true,cancelable:true,touches:[],
      targetTouches:[],changedTouches:[end]
    }));
    return {touchStyle,before,after:viewport.scrollTop,prevented:!moved,
      strokes:v6Project().notePages[0].strokes.length};
  });
  expect(result.touchStyle).toBe('none');
  expect(result.after).toBeGreaterThan(result.before+25);
  expect(result.prevented).toBe(true);
  expect(result.strokes).toBe(0);
});
test('Apple Pencil pen pointer writes without moving the notebook',async({page})=>{
  await openNotebook(page);
  await page.locator('[data-v76-mode="pen"]').click();
  const before=await page.evaluate(()=>({
    top:document.getElementById('v815ZoomViewport').scrollTop,
    left:document.getElementById('v815ZoomViewport').scrollLeft
  }));
  const target=await page.locator('#v76Ink').boundingBox();
  const x=target.x+Math.min(70,target.width/3),y=target.y+Math.min(110,target.height/4);
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y,buttons:0,pointerType:'pen'});
  await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,buttons:1,button:'left',clickCount:1,pointerType:'pen'});
  await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:x+35,y:y+35,buttons:1,button:'left',pointerType:'pen'});
  await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:x+35,y:y+35,buttons:0,button:'left',clickCount:1,pointerType:'pen'});
  await expect(page.locator('#v76Ink path.v818-ink-stroke')).toHaveCount(1);
  const after=await page.evaluate(()=>({
    top:document.getElementById('v815ZoomViewport').scrollTop,
    left:document.getElementById('v815ZoomViewport').scrollLeft
  }));
  expect(after).toEqual(before);
});
