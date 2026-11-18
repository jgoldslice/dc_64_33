'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('node:fs/promises');
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

test('an unsaved in-memory edit remains exportable for emergency recovery after a quota failure',async({page})=>{
  await page.goto(base);
  const unsuccessful=await page.evaluate(()=>{
    state.todayFocus='Uncommitted but recoverable work';
    const setter=Storage.prototype.setItem;
    Storage.prototype.setItem=function(k,value){
      if(k==='jgold-planner-v1')throw new DOMException('Storage full','QuotaExceededError');
      return setter.call(this,k,value);
    };
    try{return !save(true)&&canvasUnsaved;}
    finally{Storage.prototype.setItem=setter;}
  });
  expect(unsuccessful).toBe(true);
  const [download]=await Promise.all([
    page.waitForEvent('download'),
    page.evaluate(()=>document.getElementById('exportData').click())
  ]);
  const archive=JSON.parse(await fs.readFile(await download.path(),'utf8'));
  expect(archive.format).toBe('canvas-complete-backup');
  expect(archive.version).toBe(2);
  expect(archive.state.todayFocus).toBe('Uncommitted but recoverable work');
});

test('editing a task preserves unseen scheduling and project/idea relationships',async({page})=>{
  await page.goto(base);
  const seed=await page.evaluate(()=>{
    state.goals=[{id:'g1',title:'Goal',category:'Personal',actions:[{id:'a1',title:'Step',done:false}]}];
    state.tasks=[{id:'linked',title:'Before',date:'2026-11-19',dueDate:'2026-11-19',
      scheduledDate:'2026-11-20',scheduledTime:'14:30',priority:true,priorityRank:3,
      goalId:'g1',actionId:'a1',actionIndex:0,projectId:'project-1',projectActionId:'pa-1',
      ideaId:'idea-1',ideaActionId:'ia-1',done:false}];
    if(!save(true))throw Error('fixture save failed');
    openModal('task','linked');
    return structuredClone(state.tasks[0]);
  });
  await page.locator('#modalForm [name="title"]').fill('After');
  await page.locator('#modalForm button[type="submit"]').click();
  const result=await page.evaluate(()=>state.tasks[0]);
  expect(result.title).toBe('After');
  for(const key of ['scheduledDate','scheduledTime','projectId','projectActionId',
      'ideaId','ideaActionId','goalId','actionId','actionIndex','done'])
    expect(result[key],key).toEqual(seed[key]);
  expect(result.scheduledDate).toBe('2026-11-20');
  expect(result.scheduledTime).toBe('14:30');
  await page.reload();
  expect(await page.evaluate(()=>state.tasks.find(t=>t.id==='linked').scheduledTime)).toBe('14:30');
});
test('changing parent goal clears a stale step link without deleting project linkage',async({page})=>{
  await page.goto(base);
  await page.evaluate(()=>{
    state.goals=[{id:'g1',title:'First goal',category:'Personal',actions:[{id:'a1',title:'Step',done:false}]},
                 {id:'g2',title:'New goal',category:'Personal',actions:[]}];
    state.tasks=[{id:'linked',title:'Linked Task',date:'2026-11-19',dueDate:'2026-11-19',
      goalId:'g1',actionId:'a1',actionIndex:0,projectId:'project-1',projectActionId:'pa-1',
      scheduledDate:'2026-11-20',scheduledTime:'11:00',done:false}];
    save(true);openModal('task','linked');
  });
  await page.locator('#modalForm [name="goalId"]').selectOption('g2');
  await page.locator('#modalForm button[type="submit"]').click();
  const task=await page.evaluate(()=>state.tasks[0]);
  expect(task.goalId).toBe('g2');
  expect(task.actionId).toBe('');
  expect(task.actionIndex).toBe('');
  expect(task.projectActionId).toBe('pa-1');
  expect(task.scheduledTime).toBe('11:00');
});
test('a failed save exposes an emergency recovery download without clearing local data',async({page})=>{
  await page.goto(base);
  await page.evaluate(()=>{
    state.todayFocus='Unsaved recovery';
    const original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){
      if(key==='jgold-planner-v1')throw new DOMException('quota','QuotaExceededError');
      return original.call(this,key,value);
    };
    try{save(true);}finally{Storage.prototype.setItem=original;}
  });
  await expect(page.locator('#canvasSaveRecovery')).toBeVisible();
  const [download]=await Promise.all([
    page.waitForEvent('download'),
    page.locator('#canvasSaveRecovery').click()
  ]);
  const data=JSON.parse(await fs.readFile(await download.path(),'utf8'));
  expect(data.state.todayFocus).toBe('Unsaved recovery');
  expect(data.format).toBe('blueprint-unsaved-recovery');
});
