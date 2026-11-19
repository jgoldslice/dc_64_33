const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';
async function openNativeNotebook(page){
  await page.addInitScript(()=>{
    window.__pencilCalls=[];
    window.Capacitor={
      isNativePlatform:()=>true,
      nativePromise:async(plugin,method,args={})=>{
        if(plugin!=='BlueprintPencil')throw Error('Unknown plugin');
        window.__pencilCalls.push({method,args});
        if(method==='capabilities')return {
          available:true,schemaVersion:1,embeddedAvailable:true
        };
        if(method==='showInline')return {visible:true,embedded:true};
        if(method==='hideInline')return {hidden:true};
        return {opened:true};
      }
    };
  });
  await page.goto(base);
  await page.locator('[data-tab="brainstorm"]').click();
  page.once('dialog',dialog=>dialog.accept('Native Navigation QA'));
  await page.locator('#newProject').click();
  await page.locator('[data-v919-project-open="notes"]').click();
  await expect(page.locator('#v936InlineInk')).toBeVisible();
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#v936InlineInk').click();
  await expect(page.locator('#v936InlineInk')).toHaveAttribute('aria-pressed','true');
}
async function nativeEvent(page,phase,x,y,scale=1,pageId){
  await page.evaluate(({phase,x,y,scale,pageId})=>{
    const ctx=window.BlueprintNotesBridge.current();
    window.dispatchEvent(new CustomEvent('blueprint:pencil-navigation',{detail:{
      phase,x,y,scale,projectId:String(ctx.p.id),pageId:pageId||String(ctx.page.id)
    }}));
  },{phase,x,y,scale,pageId});
}
test('native PencilKit pinch forwards to bounded web zoom without modifying note contents',async({page})=>{
  await openNativeNotebook(page);
  const before=await page.evaluate(()=>JSON.stringify(v6Project().notePages));
  await nativeEvent(page,'start',800,450);
  await nativeEvent(page,'change',800,450,2);
  await nativeEvent(page,'end',800,450,2);
  await expect(page.locator('#v815ZoomReset')).toHaveText('200%');
  const result=await page.evaluate(()=>({
    zoom:window.BlueprintNotesBridge.getZoom(),
    contents:JSON.stringify(v6Project().notePages),
    nativeRequests:window.__pencilCalls.filter(c=>c.method==='showInline').length
  }));
  expect(result.zoom).toBe(2);
  expect(result.contents).toBe(before);
  expect(result.nativeRequests).toBeGreaterThan(0);
});
test('finger pan moves only the notebook scroll offset at zoom, not the whole page',async({page})=>{
  await openNativeNotebook(page);
  await nativeEvent(page,'start',700,450);
  await nativeEvent(page,'change',700,450,2);
  await nativeEvent(page,'end',700,450,2);
  await page.waitForTimeout(80);
  const before=await page.evaluate(()=>({
    left:document.getElementById('v815ZoomViewport').scrollLeft,
    top:document.getElementById('v815ZoomViewport').scrollTop,
    whole:window.scrollY
  }));
  await nativeEvent(page,'start',700,450);
  await nativeEvent(page,'change',600,380);
  await nativeEvent(page,'end',600,380);
  const after=await page.evaluate(()=>({
    left:document.getElementById('v815ZoomViewport').scrollLeft,
    top:document.getElementById('v815ZoomViewport').scrollTop,
    whole:window.scrollY
  }));
  expect(after.left).toBeGreaterThan(before.left+60);
  expect(after.top).toBeGreaterThan(before.top+40);
  expect(after.whole).toBe(before.whole);
});
test('stale page navigation and inactive native drawing mode cannot move Notes',async({page})=>{
  await openNativeNotebook(page);
  await nativeEvent(page,'start',800,400,1,'old-page');
  await nativeEvent(page,'change',800,400,3,'old-page');
  await expect(page.locator('#v815ZoomReset')).toHaveText('100%');
  await page.locator('#v936InlineInk').click();
  await nativeEvent(page,'start',800,400);
  await nativeEvent(page,'change',800,400,3);
  await expect(page.locator('#v815ZoomReset')).toHaveText('100%');
});
test('native pinch obeys Notes zoom bounds and reset button remains usable',async({page})=>{
  await openNativeNotebook(page);
  await nativeEvent(page,'start',750,400);
  await nativeEvent(page,'change',750,400,100);
  await nativeEvent(page,'end',750,400,100);
  await expect(page.locator('#v815ZoomReset')).toHaveText('500%');
  await page.locator('#v815ZoomReset').click();
  await expect(page.locator('#v815ZoomReset')).toHaveText('100%');
  await nativeEvent(page,'start',750,400);
  await nativeEvent(page,'change',750,400,.01);
  await nativeEvent(page,'end',750,400,.01);
  await expect(page.locator('#v815ZoomReset')).toHaveText('50%');
});
