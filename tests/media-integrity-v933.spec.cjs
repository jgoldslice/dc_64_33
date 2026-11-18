'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('node:fs/promises');
const crypto=require('node:crypto');
test.use({browserName:'chromium',viewport:{width:1024,height:900}});
const base='http://127.0.0.1:8765/';

test('deleting a Note image block with failed manifest save preserves both block and bytes',async({page})=>{
  await page.goto(base);
  const before=await page.evaluate(async()=>{
    const payload=new Blob([new Uint8Array([12,13,14,15])],{type:'image/png'});
    await v6Blob('put','safe-note-image',payload);
    state.projects=[{id:'block-project',title:'Images',notes:[],actions:[],
      library:[],notePages:[],contentBlocks:[
        {id:'block-img',type:'image',text:'Photo caption',key:'safe-note-image'}]}];
    if(!save(true))throw Error('fixture save failed');
    window.v6ActiveProjectId='block-project';v6ProjectTab='notes';v6Render();
    const setter=Storage.prototype.setItem;
    Storage.prototype.setItem=function(k,v){
      if(k===STORAGE_KEY)throw new DOMException('Storage quota','QuotaExceededError');
      return setter.call(this,k,v);
    };
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  });
  page.on('dialog',d=>d.accept());
  await page.locator('[data-v74-delete-block="block-img"]').click();
  const after=await page.evaluate(async()=>{
    Storage.prototype.setItem=window.Storage.prototype.setItem; // replaced below by reload
    const blob=await v6Blob('get','safe-note-image');
    const onDisk=JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {inMemory:state.projects[0].contentBlocks.map(x=>x.id),
      persisted:onDisk.projects[0].contentBlocks.map(x=>x.id),
      byteCount:blob?.size||0,
      warning:!document.getElementById('canvasSaveWarning').hidden};
  });
  expect(before.projects[0].contentBlocks[0].id).toBe('block-img');
  expect(after.inMemory).toEqual(['block-img']);
  expect(after.persisted).toEqual(['block-img']);
  expect(after.byteCount).toBe(4);
  expect(after.warning).toBe(true);
});

test('sketch save failure retains the original image, new image and unfinished draft',async({page})=>{
  await page.goto(base);
  const result=await page.evaluate(async()=>{
    state.projects=[{id:'sketch-project',title:'Sketches',notes:[],actions:[],
      library:[{id:'sketch1',type:'sketch',title:'Previous',key:'sketch-old',
        mime:'image/png'}],notePages:[]}];
    window.v6ActiveProjectId='sketch-project';v6SketchId='sketch1';v6SketchEditing=true;
    await v6Blob('put','sketch-old',new Blob([new Uint8Array([1,2,3])],{type:'image/png'}));
    await v6Blob('put','v6-draft-sketch-project',new Blob([new Uint8Array([4,5,6])],{type:'image/png'}));
    if(!save(true))throw Error('fixture save failed');
    const oldPrompt=window.prompt,oldAlert=window.alert,oldToBlob=v6Canvas.toBlob,
      setter=Storage.prototype.setItem;
    window.prompt=()=> 'New revision';
    window.alert=()=>{};
    v6Canvas.toBlob=cb=>cb(new Blob([new Uint8Array([7,8,9,10])],{type:'image/png'}));
    Storage.prototype.setItem=function(k,v){
      if(k===STORAGE_KEY)throw new DOMException('quota','QuotaExceededError');
      return setter.call(this,k,v);
    };
    try{await v6SaveSketch();}
    finally{
      window.prompt=oldPrompt;window.alert=oldAlert;v6Canvas.toBlob=oldToBlob;
      Storage.prototype.setItem=setter;
    }
    const draft=await v6Blob('get','v6-draft-sketch-project');
    const oldFile=await v6Blob('get','sketch-old');
    const inMemory=state.projects[0].library[0];
    const latest=await v6Blob('get',inMemory.key);
    const onDisk=JSON.parse(localStorage.getItem(STORAGE_KEY)).projects[0].library[0];
    return {draftSize:draft?.size,oldSize:oldFile?.size,
      newSize:latest?.size,newKey:inMemory.key,oldKey:onDisk.key,
      onDiskTitle:onDisk.title,editing:v6SketchEditing,
      activeSketch:v6SketchId,warning:canvasUnsaved};
  });
  expect(result).toMatchObject({
    draftSize:3,oldSize:3,newSize:4,oldKey:'sketch-old',onDiskTitle:'Previous',
    activeSketch:'sketch1',editing:true,warning:true
  });
  expect(result.newKey).not.toBe(result.oldKey);
});

test('complete backup keeps V2 integrity fields with several media entries',async({page})=>{
  await page.goto(base);
  await page.evaluate(async()=>{
    state.projects=[{id:'backup-project',title:'Many Media',notes:[],actions:[],
      library:[],notePages:[]}];
    const p=state.projects[0];
    for(let i=0;i<4;i++){
      const key='backup-media-'+i,bytes=new Uint8Array(32768+i*7).fill(i+1);
      await v6Blob('put',key,new Blob([bytes],{type:'image/png'}));
      p.library.push({id:'media'+i,type:'file',title:'Image '+i,key,mime:'image/png'});
    }
    if(!save(true))throw Error('fixture save failed');
  });
  const [download]=await Promise.all([
    page.waitForEvent('download'),
    page.locator('#exportData').click()
  ]);
  const output=JSON.parse(await fs.readFile(await download.path(),'utf8'));
  expect(output.format).toBe('canvas-complete-backup');
  expect(output.version).toBe(2);
  expect(output.attachments).toHaveLength(4);
  const stateHash=crypto.createHash('sha256').update(JSON.stringify(output.state)).digest('hex');
  expect(output.stateSha256).toBe(stateHash);
  for(const attachment of output.attachments){
    const bytes=Buffer.from(attachment.base64,'base64');
    expect(bytes.length).toBe(attachment.size);
    expect(attachment.sha256).toBe(crypto.createHash('sha256').update(bytes).digest('hex'));
  }
});
