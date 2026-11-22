const {test,expect}=require('@playwright/test');
const fs=require('node:fs/promises');
const base='http://127.0.0.1:8765/';
test.use({browserName:'chromium',viewport:{width:390,height:844},isMobile:true,hasTouch:true});

async function seed(page){
  await page.goto(base);
  await page.evaluate(async()=>{
    const photo=new Blob([new Uint8Array([137,80,78,71,13,10,26,10,7,6,5])],{type:'image/png'});
    const sketch=new Blob([new Uint8Array([137,80,78,71,13,10,26,10,9,8,7,6])],{type:'image/png'});
    await v6Blob('put','backup-note-image',photo);
    await v6Blob('put','backup-shared-image',photo);
    await v6Blob('put','backup-sketch',sketch);
    await v6Blob('put','v6-draft-p-backup-b',sketch);
    state.projects=[
      {id:'p-backup-a',title:'First Project',notes:[],actions:[
        {id:'act-a',title:'Finish test',done:false,taskId:'task-a'}],
        library:[{id:'lib-image',type:'file',title:'Photo.png',key:'backup-shared-image',mime:'image/png'}],
        contentBlocks:[{id:'block-image',type:'image',key:'backup-note-image',text:'caption'}],
        notePages:[{id:'page-a',title:'Page 1',height:740,objects:[
          {id:'obj-a',type:'image',key:'backup-shared-image',x:12,y:50,width:180},
          {id:'text-a',type:'text',x:10,y:10,width:210,html:'A thought',fontSize:'small'}
        ],strokes:[{id:'pen-a',color:'#111111',width:2.5,points:[{x:10,y:10},{x:24,y:28}]}]}]},
      {id:'p-backup-b',title:'Second Project',notes:[],actions:[],library:[
        {id:'sketch-a',type:'sketch',title:'Concept',key:'backup-sketch',mime:'image/png'}],
        notePages:[{id:'page-b',title:'Page 1',height:740,objects:[],strokes:[]}]}
    ];
    state.events=[{id:'event-a',title:'Plant watering check',date:'2026-11-09',time:'12:30'}];
    state.tasks=[{id:'task-a',title:'Finish test',done:false,projectId:'p-backup-a',projectActionId:'act-a'}];
    state.goals=[{id:'goal-a',title:'Develop Canvas',category:'Personal',actions:[{id:'step-a',title:'Backup',done:false}]}];
    state.habits=[{id:'habit-a',title:'Study',days:{},schedule:[0,1,2,3,4,5,6]}];
    state.primary='#78927d';state.secondary='#c6ae83';
    if(!save())throw Error('Seeding failed');
  });
}
async function exportData(page){
  const [download]=await Promise.all([
    page.waitForEvent('download'),
    page.evaluate(()=>document.getElementById('exportData').click())
  ]);
  return JSON.parse(await fs.readFile(await download.path(),'utf8'));
}
async function restore(page,archive){
  const dialogs=[];
  page.on('dialog',async d=>{dialogs.push(d.message());await d.accept();});
  await page.locator('#importFile').setInputFiles({
    name:'canvas-complete-backup.json',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify(archive))
  });
  await expect.poll(()=>page.evaluate(()=>(JSON.parse(localStorage.getItem('jgold-planner-v1')||'{}').projects||[]).length),{timeout:12000}).toBe(2);
  return dialogs;
}
async function keys(page){
  return page.evaluate(async()=>{
    const db=await v6DB();
    const k=await new Promise((resolve,reject)=>{
      const tx=db.transaction('blobs','readonly');
      const r=tx.objectStore('blobs').getAllKeys();
      r.onsuccess=()=>resolve(r.result.map(String));
      r.onerror=()=>reject(r.error);
    });
    db.close();return k;
  });
}

test('v2 export hashes state and every shared image/sketch/draft without dropping references',async({page})=>{
  await seed(page);
  const archive=await exportData(page);
  expect(archive.format).toBe('canvas-complete-backup');
  expect(archive.version).toBe(2);
  expect(archive.stateSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(archive.state.projects).toHaveLength(2);
  expect(archive.state.projects[0].notePages[0].objects[1].html).toBe('A thought');
  expect(archive.state.projects[0].notePages[0].strokes[0].points).toHaveLength(2);
  expect(archive.state.events[0]).toMatchObject({title:'Plant watering check',date:'2026-11-09',time:'12:30'});
  expect(archive.attachments.map(a=>a.key).sort()).toEqual([
    'backup-note-image','backup-shared-image','backup-sketch','v6-draft-p-backup-b'
  ]);
  for(const attachment of archive.attachments){
    expect(attachment.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(attachment.size).toBe(Buffer.from(attachment.base64,'base64').length);
  }
});

test('complete backup imports into clean storage, remaps shared images and retains editable links',async({browser,page})=>{
  await seed(page);const archive=await exportData(page);
  const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
  const restored=await context.newPage();
  try{
    await restored.goto(base);
    const dialogs=await restore(restored,archive);
    expect(dialogs.some(x=>x.includes('All attachment checks passed'))).toBe(true);
    const result=await restored.evaluate(async()=>{
      const [pA,pB]=state.projects;
      const shared=pA.library[0].key;
      const photo=await v6Blob('get',shared);
      const note=await v6Blob('get',pA.contentBlocks[0].key);
      const sketch=await v6Blob('get',pB.library[0].key);
      const draft=await v6Blob('get',v6SketchDraftKey(pB));
      return {
        count:state.projects.length,
        shared,sharedAcrossPage:pA.notePages[0].objects[0].key===shared,
        text:pA.notePages[0].objects[1].html,
        task:state.tasks[0].id,linkedAction:pA.actions[0].taskId,
        goal:state.goals[0].id,habit:state.habits[0].id,
        event:state.events[0],ink:pA.notePages[0].strokes[0],
        photo:[...new Uint8Array(await photo.arrayBuffer())],
        note:[...new Uint8Array(await note.arrayBuffer())],
        sketch:[...new Uint8Array(await sketch.arrayBuffer())],
        draft:[...new Uint8Array(await draft.arrayBuffer())]
      };
    });
    expect(result.count).toBe(2);
    expect(result.shared.startsWith('v85-import-')).toBe(true);
    expect(result.sharedAcrossPage).toBe(true);
    expect(result.text).toBe('A thought');
    expect(result.task).toBe('task-a');
    expect(result.linkedAction).toBe('task-a');
    expect(result.goal).toBe('goal-a');
    expect(result.habit).toBe('habit-a');
    expect(result.event).toMatchObject({id:'event-a',date:'2026-11-09',time:'12:30'});
    expect(result.ink.points).toEqual([{x:10,y:10},{x:24,y:28}]);
    expect(result.photo).toEqual([137,80,78,71,13,10,26,10,7,6,5]);
    expect(result.note).toEqual(result.photo);
    expect(result.sketch).toEqual([137,80,78,71,13,10,26,10,9,8,7,6]);
    expect(result.draft).toEqual(result.sketch);
    const reexported=await exportData(restored);
    expect(reexported.state.projects.every(p=>!('sketchDraftId' in p))).toBe(true);
    const draftEntry=a=>a.attachments.find(entry=>entry.key==='v6-draft-p-backup-b');
    expect(draftEntry(reexported)).toEqual(draftEntry(archive));
    const second=await browser.newPage();
    try{
      await second.goto(base);
      await restore(second,reexported);
      await second.reload();
      const reopened=await second.evaluate(async()=>{
        const project=state.projects.find(p=>p.id==='p-backup-b');
        const draft=await v6Blob('get',v6SketchDraftKey(project));
        return {title:project.title,draft:[...new Uint8Array(await draft.arrayBuffer())]};
      });
      expect(reopened).toEqual({title:'Second Project',draft:result.draft});
    }finally{await second.close();}
    await restored.reload();
    const persists=await restored.evaluate(async()=>({
      projects:state.projects.length,
      found:!!(await v6Blob('get',state.projects[0].library[0].key)),
      draft:!!(await v6Blob('get',v6SketchDraftKey(state.projects[1]))),
      event:state.events.some(e=>e.id==='event-a'),
      ink:state.projects[0].notePages[0].strokes.length
    }));
    expect(persists).toEqual({projects:2,found:true,draft:true,event:true,ink:1});
  }finally{await context.close();}
});

test('tampered or partial media and state checksums are rejected before write or confirmation',async({page})=>{
  await seed(page);
  const archive=await exportData(page);
  const original=await page.evaluate(()=>localStorage.getItem('jgold-planner-v1'));
  const beforeKeys=await keys(page);
  const errors=[];
  page.on('dialog',async d=>{errors.push(d.message());await d.dismiss();});
  for(const mutated of [
    {...archive,state:{...archive.state,primary:'#123456'}},
    {...archive,attachments:archive.attachments.map((a,i)=>i===0?{...a,base64:'AAAA'}:a)},
    {...archive,attachments:archive.attachments.slice(1)}
  ]){
    const previous=errors.length;
    await page.locator('#importFile').setInputFiles({
      name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(mutated))
    });
    await expect.poll(()=>errors.length).toBe(previous+1);
    expect(await page.evaluate(()=>localStorage.getItem('jgold-planner-v1'))).toBe(original);
    expect(await keys(page)).toEqual(beforeKeys);
  }
  expect(errors.every(x=>x.startsWith('Could not import backup:'))).toBe(true);
});

test('a failed planner commit rolls back staged media without overwriting the old sketch draft',async({page})=>{
  await seed(page);
  const archive=await exportData(page);
  // The current draft is different from the archive so overwritten media is detectable.
  await page.evaluate(async()=>{
    await v6Blob('put','v6-draft-p-backup-b',new Blob([new Uint8Array([42,43])],{type:'image/png'}));
    state.projects=[{id:'p-backup-b',title:'Existing Work',notes:[],actions:[],library:[]}];
    save();
  });
  const original=await page.evaluate(()=>localStorage.getItem('jgold-planner-v1'));
  const beforeKeys=await keys(page);
  await page.evaluate(()=>{
    const original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(k,v){
      // Fail specifically on the imported state, never on unrelated autosaves.
      if(k==='jgold-planner-v1'&&v.includes('"p-backup-a"'))
        throw new DOMException('Quota','QuotaExceededError');
      return original.call(this,k,v);
    };
    window.__restoreSetItem=()=>{Storage.prototype.setItem=original;};
  });
  const messages=[];
  page.on('dialog',async d=>{messages.push(d.message());if(d.type()==='confirm')await d.accept();else await d.dismiss();});
  await page.locator('#importFile').setInputFiles({
    name:'valid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(archive))
  });
  await expect.poll(()=>messages.some(x=>x.startsWith('Could not import backup:')),{timeout:10000}).toBe(true);
  await page.evaluate(()=>window.__restoreSetItem());
  expect(await page.evaluate(()=>localStorage.getItem('jgold-planner-v1'))).toBe(original);
  expect(await page.evaluate(()=>state.projects[0].title)).toBe('Existing Work');
  expect(await page.evaluate(async()=>[...new Uint8Array(await (await v6Blob('get','v6-draft-p-backup-b')).arrayBuffer())])).toEqual([42,43]);
  expect(await keys(page)).toEqual(beforeKeys);
});

test('old complete v1 backups remain readable',async({browser,page})=>{
  await seed(page);const archive=await exportData(page);
  archive.version=1;delete archive.stateSha256;
  archive.attachments=archive.attachments.map(({key,mime,base64})=>({key,mime,base64}));
  const context=await browser.newContext({acceptDownloads:true});
  const restored=await context.newPage();
  try{
    await restored.goto(base);
    const dialogs=await restore(restored,archive);
    expect(dialogs.some(x=>x.includes('All attachment checks passed'))).toBe(true);
    expect(await restored.evaluate(()=>state.projects[1].title)).toBe('Second Project');
  }finally{await context.close();}
});

test('an aborted IndexedDB write rejects rather than reporting a successful attachment save',async({page})=>{
  await page.goto(base);
  const result=await page.evaluate(async()=>{
    const original=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(...args){
      const request=original.apply(this,args);
      request.addEventListener('success',()=>{try{request.transaction.abort();}catch{}});
      return request;
    };
    try{
      await v6Blob('put','abort-tx-test',new Blob(['bytes']));
      return 'unexpected success';
    }catch(e){return e.name||String(e);}
    finally{IDBObjectStore.prototype.put=original;}
  });
  expect(result).not.toBe('unexpected success');
  expect(await page.evaluate(async()=>v6Blob('get','abort-tx-test'))).toBeUndefined();
});

test('native archive round trip stages fresh drawings and rejects corrupt ink before writing',async({page})=>{
  await page.addInitScript(()=>{
    window.stagedInk=[];
    window.Capacitor={isNativePlatform:()=>true,nativePromise:async(_,method,args)=>{
      if(method==='capabilities')return {drawingArchiveVersion:1};
      if(method==='exportDrawing')return {base64:btoa(args.pageId)};
      if(method==='stageDrawing'){
        if(window.failSecond && window.stagedInk.length===1)throw Error('Storage full');
        window.stagedInk.push(atob(args.base64));
        return {pageId:crypto.randomUUID()};
      }
    }};
  });
  await seed(page);
  const archive=await exportData(page);
  expect(archive.version).toBe(3);
  const corrupt=structuredClone(archive);
  corrupt.drawings[0].base64='AAAA';
  const result=await page.evaluate(async data=>{
    try{await v74ImportBackup(new Blob([JSON.stringify(data)]));}
    catch(error){return error.message;}
  },corrupt);
  expect(result).toContain('Drawing manifest checksum mismatch');
  expect(await page.evaluate(()=>window.stagedInk)).toEqual([]);
  page.on('dialog',d=>d.accept());
  const before=await page.evaluate(()=>localStorage.getItem(STORAGE_KEY));
  const failure=await page.evaluate(async data=>{
    window.failSecond=true;
    try{await v74ImportBackup(new Blob([JSON.stringify(data)]));}
    catch(error){return error.message;}
    finally{window.failSecond=false;}
  },archive);
  expect(failure).toContain('Storage full');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem(STORAGE_KEY)))).toEqual(JSON.parse(before));
  expect(await page.evaluate(()=>window.stagedInk)).toEqual(['page-a']);
  await page.evaluate(()=>{window.stagedInk=[];});
  await page.evaluate(data=>v74ImportBackup(new Blob([JSON.stringify(data)])),archive);
  expect(await page.evaluate(()=>window.stagedInk)).toEqual(['page-a','page-b']);
  const pageRecord=await page.evaluate(()=>state.projects[0].notePages[0]);
  expect(pageRecord.id).not.toBe('page-a');
  expect(pageRecord.strokes).toEqual(archive.state.projects[0].notePages[0].strokes);
});

test('a restored project without draft cannot inherit an older local draft with the same ID',async({page})=>{
  await seed(page);
  const archive=await exportData(page);
  archive.attachments=archive.attachments.filter(item=>item.key!=='v6-draft-p-backup-b');
  await page.evaluate(async()=>{
    await v6Blob('put','v6-draft-p-backup-b',new Blob(['abandoned local draft']));
    state.projects[1].title='Old local version';
    if(!save(true))throw Error('Could not save previous local project');
  });
  page.on('dialog',dialog=>dialog.accept());
  await page.evaluate(data=>v74ImportBackup(new Blob([JSON.stringify(data)])),archive);
  const result=await page.evaluate(async()=>{
    const p=state.projects.find(p=>p.id==='p-backup-b');
    return {
      title:p.title,
      importedDraftPresent:!!(await v6Blob('get',v6SketchDraftKey(p))),
      oldDraftKeptForRecovery:await (await v6Blob('get','v6-draft-p-backup-b')).text()
    };
  });
  expect(result).toEqual({
    title:'Second Project',importedDraftPresent:false,
    oldDraftKeptForRecovery:'abandoned local draft'
  });
  const reexport=await exportData(page);
  expect(reexport.attachments.some(item=>item.key==='v6-draft-p-backup-b')).toBe(false);
});

test('reloading while a restored draft is staged keeps the old planner and draft together',async({page})=>{
  await seed(page);
  const archive=await exportData(page);
  await page.evaluate(async()=>{
    const project=state.projects[1];
    project.title='Local version';
    await v6Blob('put',v6SketchDraftKey(project),new Blob(['local ink']));
    if(!save(true))throw Error('Could not save test planner');
    const write=v6Blob;
    v6Blob=async(mode,key,blob)=>{
      const result=await write(mode,key,blob);
      if(mode==='put'&&key.startsWith('v6-imported-draft-')){
        window.draftStaged=true;
        await new Promise(()=>{});
      }
      return result;
    };
  });
  page.on('dialog',dialog=>dialog.accept());
  await page.locator('#importFile').setInputFiles({
    name:'restore.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(archive))
  });
  await page.waitForFunction(()=>window.draftStaged);
  await page.reload();
  const reopened=await page.evaluate(async()=>{
    const project=state.projects[1];
    const draft=await v6Blob('get',v6SketchDraftKey(project));
    return [project.title,await draft.text()];
  });
  expect(reopened).toEqual(['Local version','local ink']);
});
