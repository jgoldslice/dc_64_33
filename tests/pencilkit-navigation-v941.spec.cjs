const {submitSheet}=require('./sheet-helper.cjs');
const {test,expect}=require('@playwright/test');
const base=process.env.BLUEPRINT_NATIVE_NAV_BASE_URL||'http://127.0.0.1:8765/';
async function openNativeNotebook(page,nativeExtent){
  await page.addInitScript(extent=>{
    window.__pencilCalls=[];
    window.Capacitor={
      isNativePlatform:()=>true,
      nativePromise:async(plugin,method,args={})=>{
        if(plugin!=='BlueprintPencil')throw Error('Unknown plugin');
        window.__pencilCalls.push({method,args});
        if(method==='capabilities')return {
          available:true,schemaVersion:1,embeddedAvailable:true
        };
        if(method==='showInline')return {visible:true,embedded:true,...extent};
        if(method==='hideInline')return {hidden:true};
        return {opened:true};
      }
    };
  },nativeExtent);
  await page.goto(base);
  await page.locator('[data-tab="brainstorm"]').click();
  await page.locator('#newProject').click();
  await submitSheet(page, 'Native Navigation QA');
  await page.locator('[data-v919-project-open="notes"]').click();
  await expect(page.locator('#v936InlineInk')).toBeVisible();
  await page.locator('#v936InlineInk').click();
  await submitSheet(page);
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

for(const viewport of [{width:390,height:844},{width:834,height:1194}]){
  test('native ink outside the screen remains scrollable without rewriting the page at '+viewport.width,async({page})=>{
    await page.setViewportSize(viewport);
    await openNativeNotebook(page,{contentWidth:1600,contentHeight:2400});
    const before=await page.evaluate(()=>JSON.stringify(v6Project().notePages));
    await expect.poll(()=>page.evaluate(()=>document.getElementById('v815ZoomViewport').scrollWidth)).toBeGreaterThanOrEqual(1600);
    await expect.poll(()=>page.evaluate(()=>document.getElementById('v815ZoomViewport').scrollHeight)).toBeGreaterThanOrEqual(2400);
    await nativeEvent(page,'start',300,600);
    await nativeEvent(page,'change',80,200);
    await nativeEvent(page,'end',80,200);
    const result=await page.evaluate(()=>({
      left:document.getElementById('v815ZoomViewport').scrollLeft,
      top:document.getElementById('v815ZoomViewport').scrollTop,
      contents:JSON.stringify(v6Project().notePages),
      rejected:BlueprintNotesBridge.setNativeInkExtent(v6Project().id,v6Project().activeNotePageId,500000,2400)
    }));
    expect(result.left).toBeGreaterThan(150);expect(result.top).toBeGreaterThan(300);
    expect(result.contents).toBe(before);expect(result.rejected).toBe(false);
  });
}

test('native overlay reloads unchanged geometry after a sync apply and stays hidden while staging',async({page})=>{
  await openNativeNotebook(page);
  const before=await page.evaluate(()=>window.__pencilCalls.filter(c=>c.method==='showInline').length);
  await page.evaluate(async()=>{await BlueprintPencilInline.suspendForSync();window.dispatchEvent(new Event('resize'));});
  await page.waitForTimeout(80);
  expect(await page.evaluate(()=>window.__pencilCalls.filter(c=>c.method==='showInline').length)).toBe(before);
  expect(await page.evaluate(()=>window.__pencilCalls.at(-1).method)).toBe('hideInline');
  await page.evaluate(()=>BlueprintPencilInline.resumeAfterSync());
  await expect.poll(()=>page.evaluate(()=>window.__pencilCalls.filter(c=>c.method==='showInline').length)).toBeGreaterThan(before);
  await expect(page.locator('#v936InlineInk')).toHaveAttribute('aria-pressed','true');
});
