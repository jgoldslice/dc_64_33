const {test,expect}=require('@playwright/test');
const {submitSheet}=require('./sheet-helper.cjs');

test('native incoming sync reopens unchanged ink and displays changed ink from newly staged bytes',async({page})=>{
  await page.addInitScript(()=>{
    const files=new Map();window.__nativeInkFiles=files;window.__nativeShown=null;
    const key=(project,page)=>JSON.stringify([project,page]);
    window.Capacitor={isNativePlatform:()=>true,nativePromise:async(plugin,method,args={})=>{
      if(plugin!=='BlueprintPencil')throw Error('Unexpected native plugin');
      if(method==='capabilities')return {available:true,schemaVersion:1,embeddedAvailable:true,drawingArchiveVersion:1,syncDrawingEventsVersion:1,fullEditorActive:false};
      if(method==='exportDrawing'){
        const bytes=files.get(key(args.projectId,args.pageId));
        return bytes?{base64:bytes}:{missing:true};
      }
      if(method==='stageDrawing'){
        const pageId=crypto.randomUUID();files.set(key(args.projectId,pageId),args.base64);return {pageId};
      }
      if(method==='showInline'){
        // The fixture starts with an existing saved drawing on its first page.
        if(!files.has(key(args.projectId,args.pageId)))files.set(key(args.projectId,args.pageId),'b3JpZ2luYWw=');
        if(window.__nativeShown?.key!==key(args.projectId,args.pageId))
          window.__nativeShown={key:key(args.projectId,args.pageId),base64:files.get(key(args.projectId,args.pageId))};
        return {visible:true,embedded:true,contentWidth:1500,contentHeight:2100};
      }
      if(method==='hideInline'){window.__nativeShown=null;return {hidden:true};}
      throw Error('Unexpected native method '+method);
    }};
  });
  await page.goto('/');
  await page.locator('[data-tab="brainstorm"]').click();await page.locator('#newProject').click();
  await submitSheet(page,'Synthetic native sync');
  await page.locator('[data-v919-project-open="notes"]').click();
  await expect(page.locator('#v936InlineInk')).toBeVisible();
  await page.evaluate(()=>{
    const {p,page}=BlueprintNotesBridge.current();
    window.__originalNativeKey=JSON.stringify([String(p.id),String(page.id)]);
  });
  await expect.poll(()=>page.evaluate(()=>__nativeShown?.base64)).toBe('b3JpZ2luYWw=');
  await page.waitForFunction(()=>BlueprintFullSyncLocal.idle());
  await page.evaluate(async()=>{
    const {createFullSyncLocal}=await import('../sync/full-sync-local.mjs');
    const {archiveToGraph}=await import('../sync/full-sync-codec.mjs');
    const local=createFullSyncLocal(),snapshot=await local.snapshot();
    const incoming=structuredClone(snapshot.archive);
    incoming.state.tasks.push({id:'native-sync-fixture-task',title:'Unrelated incoming task',done:false});
    const packed=await archiveToGraph(incoming);
    await local.apply(snapshot,packed.graph,h=>packed.objects.get(h),()=>{});
  });
  await expect.poll(()=>page.evaluate(()=>__nativeShown?.base64)).toBe('b3JpZ2luYWw=');
  await page.waitForFunction(()=>BlueprintFullSyncLocal.idle());
  await page.evaluate(async()=>{
    const {createFullSyncLocal}=await import('../sync/full-sync-local.mjs');
    const {archiveToGraph}=await import('../sync/full-sync-codec.mjs');
    const local=createFullSyncLocal(),snapshot=await local.snapshot();
    const incoming=structuredClone(snapshot.archive);incoming.drawings[0].base64='bmV3ZXItaW5r';
    const packed=await archiveToGraph(incoming);
    await local.apply(snapshot,packed.graph,h=>packed.objects.get(h),()=>{});
  });
  await expect.poll(()=>page.evaluate(()=>__nativeShown?.base64)).toBe('bmV3ZXItaW5r');
  const result=await page.evaluate(async()=>({
    original:__nativeInkFiles.get(__originalNativeKey),
    current:JSON.parse(await (await v74BuildCompleteBackup()).text()).drawings[0].base64,
    task:state.tasks.some(t=>t.id==='native-sync-fixture-task')
  }));
  expect(result).toEqual({original:'b3JpZ2luYWw=',current:'bmV3ZXItaW5r',task:true});
});
