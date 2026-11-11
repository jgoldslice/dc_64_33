
'use strict';
const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';
test.use({browserName:'chromium'});
async function create(page,name='QA Project'){
  await page.goto(base);await page.locator('[data-tab="brainstorm"]').click();
  page.once('dialog',d=>d.accept(name));await page.locator('#newProject').click();
  await expect(page.locator('#projectOverview')).toBeVisible();
}
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP+ZJRdGAAAAABJRU5ErkJggg==','base64');

test('project opens to overview, with three cards and no tabs; Notes remains editable',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await create(page);
  await expect(page.locator('#projectTabs')).toBeHidden();
  await expect(page.locator('#projectOverview .card')).toHaveCount(3);
  await expect(page.locator('#v919NotesHeading')).toHaveText('Notes');
  await expect(page.locator('#v919TodoHeading')).toHaveText('To-Do');
  await expect(page.locator('#v919LibraryHeading')).toHaveText('Library');
  await page.locator('[data-v919-project-open="notes"]').click();
  await expect(page.locator('#v76Editor')).toBeVisible();
  expect(await page.locator('#v76Surface').evaluate(e=>e.getBoundingClientRect().width)).toBeGreaterThan(150);
  await page.locator('#v919BackOverview').click();
  await page.locator('[data-v919-project-open="library"]').click();
  await expect(page.locator('#projectLibrary')).toBeVisible();
  expect(errors).toEqual([]);
});
test('note preview and linked to-do completion use the original project data',async({page})=>{
  await create(page);
  await page.evaluate(()=>{
    const p=v6Project();
    p.notePages=[{id:'q-page',title:'Research Notes',height:820,objects:[{id:'txt',type:'text',html:'Catalysis results',x:10,y:20,width:240}],strokes:[]}];
    p.activeNotePageId='q-page';
    p.actions=[{id:'qa-action',title:'Prepare figures',done:false,taskId:'qa-task'}];
    state.tasks.push({id:'qa-task',title:'Prepare figures',done:false,priority:false,priorityRank:0,projectId:p.id,projectActionId:'qa-action'});
    save();v6Render();
  });
  await expect(page.locator('#v919NotesPreview')).toContainText('Catalysis results');
  await page.locator('[data-v919-check="qa-action"]').check();
  expect(await page.evaluate(()=>[v6Project().actions[0].done,state.tasks.find(t=>t.id==='qa-task').done])).toEqual([true,true]);
  await page.locator('[data-v919-project-open="notes"]').click();
  await expect(page.locator('#v76PageSelect')).toHaveValue('q-page');
  await page.locator('#v919BackOverview').click();
  await expect(page.locator('#v919NotesPreview')).toContainText('Research Notes');
});
test('up to four latest images are previewed and can open the existing image viewer',async({page})=>{
  await create(page);
  await page.evaluate(async()=>{
    const p=v6Project();
    for(let i=0;i<5;i++){
      const key='qa-fig-'+i;
      await v6Blob('put',key,new Blob([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP+ZJRdGAAAAABJRU5ErkJggg=='),x=>x.charCodeAt(0))],{type:'image/png'}));
      p.library.push({id:'figure-'+i,title:'Figure '+i,type:'file',mime:'image/png',key,created:new Date(2026,0,i+1).toISOString()});
    }
    save();v6Render();
  });
  await expect(page.locator('#v919LibraryPreview .v919-gallery-item')).toHaveCount(4);
  await expect(page.locator('#v919LibraryPreview')).not.toContainText('Figure 0');
  await expect.poll(()=>page.locator('#v919LibraryPreview img[src^="blob:"]').count()).toBe(4);
  await page.locator('#v919LibraryPreview [data-v6-view-image="figure-4"]').click();
  await expect(page.locator('#v6ImageViewer')).toBeVisible();
});
test('Shortcut URL fragment opens reviewed capture and saves only once',async({page})=>{
  await create(page);
  const url='https://example.com/manuscript?paper=1';
  await page.goto(base+'#bp-share?url='+encodeURIComponent(url)+'&title=Paper');
  await expect(page.locator('#v919CaptureBack')).toBeVisible();
  await expect(page.locator('#v919CaptureURL')).toHaveValue(url);
  expect(await page.evaluate(()=>location.hash)).toBe('');
  await page.locator('#v919CaptureSave').click();
  await expect(page.locator('#v919CaptureBack')).toBeHidden();
  await page.evaluate(u=>BlueprintProjectCapture.open({url:u}),url);
  await page.locator('#v919CaptureSave').click();
  await expect(page.locator('#v919CaptureStatus')).toContainText('already saved');
  expect(await page.evaluate(()=>state.projects[0].library.filter(x=>x.type==='link').length)).toBe(1);
});
test('photo import saves verified binary and retries after simulated storage failure',async({page})=>{
  await create(page);
  await page.locator('[data-v919-capture-open]').click();
  await page.locator('[data-v919-mode="photo"]').click();
  await page.locator('#v919CaptureFiles').setInputFiles({name:'research.png',mimeType:'image/png',buffer:png});
  await page.evaluate(()=>{
    window.originalSet=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){
      if(key===STORAGE_KEY)throw Error('Test quota');
      return window.originalSet.call(this,key,value);
    };
  });
  await page.locator('#v919CaptureSave').click();
  await expect(page.locator('#v919CaptureStatus')).toContainText('Retry save');
  const size=await page.evaluate(async()=>{
    const item=v6Project().library.find(x=>x.title==='research.png');
    return (await v6Blob('get',item.key)).size;
  });
  expect(size).toBe(png.length);
  await page.evaluate(()=>{Storage.prototype.setItem=window.originalSet;});
  await page.locator('#v919CaptureSave').click();
  await expect(page.locator('#v919CaptureBack')).toBeHidden();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem(STORAGE_KEY)).projects[0].library.filter(x=>x.title==='research.png').length)).toBe(1);
});
test('stale browser window cannot overwrite a newer shared link',async({page,context})=>{
  await create(page);
  const other=await context.newPage();await other.goto(base);
  await other.evaluate(()=>BlueprintProjectCapture.open({url:'https://example.org/newer'}));
  await other.locator('#v919CaptureSave').click();
  await expect(other.locator('#v919CaptureBack')).toBeHidden();
  await page.evaluate(()=>BlueprintProjectCapture.open({url:'https://example.org/stale'}));
  await page.locator('#v919CaptureSave').click();
  await expect(page.locator('#v919CaptureStatus')).toContainText('Another Blueprint window');
  await expect(page.locator('#canvasSaveRecovery')).toBeVisible();
  const urls=await page.evaluate(()=>JSON.parse(localStorage.getItem(STORAGE_KEY)).projects[0].library.filter(r=>r.type==='link').map(r=>r.url));
  expect(urls).toEqual(['https://example.org/newer']);
  await other.close();
});
test('Notes toolbar remains inside its layout at nine iPhone and iPad sizes',async({page})=>{
  await create(page);await page.locator('[data-v919-project-open="notes"]').click();
  for(const [width,height] of [[320,700],[375,812],[390,844],[430,932],[768,1024],[834,1194],[1024,768],[1194,834],[1366,1024]]){
    await page.setViewportSize({width,height});
    const m=await page.locator('#projectNotes .v76-toolbar').evaluate(el=>{
      const t=el.getBoundingClientRect();
      const visible=[...el.querySelectorAll('button,select')].filter(b=>b.getClientRects().length>0&&getComputedStyle(b).visibility!=='hidden');
      const bad=visible.filter(b=>{const r=b.getBoundingClientRect();return r.left<t.left-2||r.right>t.right+2||r.height<42;}).map(b=>b.id||b.getAttribute('aria-label'));
      const a=el.querySelector('#v819SaveSketch').getBoundingClientRect(),b=el.querySelector('#v815ZoomReset').getBoundingClientRect();
      return {bad,overflow:el.scrollWidth-el.clientWidth,pageOverflow:document.documentElement.scrollWidth-innerWidth,
        overlap:Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top))};
    });
    const label=String(width)+'x'+String(height);
    expect(m.bad,label).toEqual([]);
    expect(m.overflow,label).toBeLessThanOrEqual(3);
    expect(m.pageOverflow,label).toBeLessThanOrEqual(4);
    expect(m.overlap,label).toBeLessThan(1);
  }
});
