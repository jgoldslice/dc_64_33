'use strict';
const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';
test.use({browserName:'chromium',viewport:{width:390,height:844}});

test('read-only local storage report checks every referenced Library image without changing saved state',async({page})=>{
  await page.goto(base);
  await page.evaluate(async()=>{
    const blob=new Blob([new Uint8Array([1,2,3,4])],{type:'image/png'});
    await v6Blob('put','health-photo-a',blob);
    state.projects=[{
      id:'health-project',title:'Storage QA',notes:[],actions:[],
      library:[{id:'health-library',type:'file',title:'Photo.png',key:'health-photo-a'}],
      notePages:[{id:'health-page',title:'Page',objects:[{id:'health-obj',type:'image',key:'health-photo-a'}],strokes:[]}]
    }];
    state.tasks=[{id:'health-task',title:'Verify'}];
    if(!save(true))throw Error('Test seed failed');
  });
  const before=await page.evaluate(()=>localStorage.getItem('jgold-planner-v1'));
  const report=await page.evaluate(()=>window.BlueprintStorageHealth.inspect());
  expect(report).toMatchObject({
    saved:true,projects:1,tasks:1,attachments:1,missing:[],fileBytes:4
  });
  await page.evaluate(()=>document.getElementById('v926CheckLocal').click());
  await expect(page.locator('#v926StorageReport')).toContainText('All 1 referenced Library file(s) were found.');
  expect(await page.evaluate(()=>localStorage.getItem('jgold-planner-v1'))).toBe(before);
});

test('storage check warns about a missing referenced attachment but does not erase its record',async({page})=>{
  await page.goto(base);
  await page.evaluate(()=>{
    state.projects=[{id:'lost-file-project',title:'Project',notes:[],actions:[],
      library:[{id:'missing-file',title:'Missing.png',type:'file',key:'missing-file-key'}]}];
    if(!save(true))throw Error('Test seed failed');
  });
  const before=await page.evaluate(()=>localStorage.getItem('jgold-planner-v1'));
  await page.evaluate(()=>document.getElementById('v926CheckLocal').click());
  await expect(page.locator('#v926StorageReport')).toContainText('WARNING: 1 referenced Library file(s) are missing');
  expect(await page.evaluate(()=>localStorage.getItem('jgold-planner-v1'))).toBe(before);
});

test('corrupted existing local JSON is never overwritten by autosave or misleading complete backup',async({page})=>{
  await page.goto(base);
  const original='{"tasks":[corrupted]';
  await page.evaluate(raw=>localStorage.setItem('jgold-planner-v1',raw),original);
  await page.reload();
  await expect(page.locator('#canvasSaveWarning')).toContainText('could not read saved local data');
  const result=await page.evaluate(()=>({
    saved:save(true),
    original:localStorage.getItem('jgold-planner-v1'),
    error:!!canvasLoadError,
    recoveryVisible:!document.getElementById('canvasSaveRecovery').hidden
  }));
  expect(result).toEqual({saved:false,original,error:true,recoveryVisible:true});
  const dialogs=[];
  page.on('dialog',async dialog=>{dialogs.push(dialog.message());await dialog.dismiss();});
  await page.evaluate(()=>document.getElementById('exportData').click());
  await expect.poll(()=>dialogs.length).toBe(1);
  expect(dialogs[0]).toContain('Saved planner data could not be loaded');
  expect(await page.evaluate(()=>localStorage.getItem('jgold-planner-v1'))).toBe(original);
});

test('older partial planner snapshots remain writable when their present collections are valid',async({page})=>{
  await page.goto(base);
  await page.evaluate(()=>localStorage.setItem('jgold-planner-v1',JSON.stringify({
    tasks:[],goals:[]
  })));
  await page.reload();
  const data=await page.evaluate(()=>({
    locked:!!canvasLoadError,
    saveWorked:save(true),
    hasHabits:Array.isArray(JSON.parse(localStorage.getItem('jgold-planner-v1')).habits)
  }));
  expect(data).toEqual({locked:false,saveWorked:true,hasHabits:true});
});
