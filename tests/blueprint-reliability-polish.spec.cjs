const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';
test.use({browserName:'chromium',viewport:{width:390,height:844},isMobile:true,hasTouch:true});

async function notebook(page){
  await page.goto(base);
  await page.locator('[data-tab="brainstorm"]').click();
  page.once('dialog',dialog=>dialog.accept('Reliability test'));
  await page.locator('#newProject').click();
  await page.locator('[data-v919-project-open="notes"]').click();
  await page.locator('[data-v76-mode="pen"]').click();
  const ink=page.locator('#v76Ink');
  await ink.scrollIntoViewIfNeeded();
  const rect=await ink.boundingBox();
  await page.mouse.move(rect.x+rect.width/2,rect.y+80);
  await page.mouse.down();
  await page.mouse.move(rect.x+rect.width/2+50,rect.y+100,{steps:5});
  await page.mouse.up();
  await expect(ink.locator('path.v818-ink-stroke')).toHaveCount(1);
  return {ink,button:page.locator('#v819SaveSketch')};
}
function sketchDialogs(page){
  const dialogs=[];
  page.on('dialog',async dialog=>{
    dialogs.push({type:dialog.type(),message:dialog.message()});
    await dialog.accept(dialog.type()==='prompt'?'Resilient sketch':undefined);
  });
  return dialogs;
}
async function rows(page){
  return page.evaluate(async()=>{
    const project=v6Project();
    const inMemory=project.library.filter(item=>item.type==='sketch');
    const persisted=JSON.parse(localStorage.getItem('jgold-planner-v1'));
    const diskProject=persisted.projects.find(item=>String(item.id)===String(project.id));
    const onDisk=(diskProject?.library||[]).filter(item=>item.type==='sketch');
    const blobs=await Promise.all(inMemory.map(item=>v6Blob('get',item.key)));
    return {
      inMemory:inMemory.length,onDisk:onDisk.length,
      id:inMemory[0]?.id,key:inMemory[0]?.key,diskId:onDisk[0]?.id,
      strokes:project.notePages[0].strokes.length,
      bytes:blobs[0]?.size||0
    };
  });
}

test('quota failure rolls back unverified Library row; retry keeps the same PNG and exactly one record',async({page})=>{
  const {button}=await notebook(page);
  const dialogs=sketchDialogs(page);
  await page.evaluate(()=>{
    const original=Storage.prototype.setItem;
    window.__restorePlannerSet=()=>{Storage.prototype.setItem=original;};
    let fail=true;
    Storage.prototype.setItem=function(key,value){
      if(key==='jgold-planner-v1'&&fail){fail=false;throw new DOMException('Storage full','QuotaExceededError');}
      return original.call(this,key,value);
    };
  });
  await button.click();
  await expect(button).toHaveText('Retry sketch save');
  expect((await rows(page)).inMemory).toBe(0);
  expect((await rows(page)).onDisk).toBe(0);
  expect(dialogs.some(d=>d.message.includes('Planner storage is unavailable'))).toBe(true);
  await page.evaluate(()=>window.__restorePlannerSet());
  await button.click();
  await expect(button).toHaveText('Save sketch');
  const result=await rows(page);
  expect(result.inMemory).toBe(1);
  expect(result.onDisk).toBe(1);
  expect(result.id).toBe(result.diskId);
  expect(result.bytes).toBeGreaterThan(100);
  expect(result.strokes).toBe(1);
  expect(dialogs.filter(d=>d.type==='prompt')).toHaveLength(1);
  await page.reload();
  await page.locator('[data-tab="brainstorm"]').click();
  const projectId=await page.evaluate(()=>state.projects.find(p=>p.title==='Reliability test').id);
  await page.evaluate(id=>v6OpenProject(id),projectId);
  expect((await rows(page)).inMemory).toBe(1);
  expect((await rows(page)).strokes).toBe(1);
});

test('failed readback after a real write retries the same sketch ID without duplicates',async({page})=>{
  const {button}=await notebook(page);
  sketchDialogs(page);
  await page.evaluate(()=>{
    const original=Storage.prototype.getItem;
    let fail=true;
    Storage.prototype.getItem=function(key){
      if(key==='jgold-planner-v1'&&fail){fail=false;throw Error('Readback unavailable');}
      return original.call(this,key);
    };
    window.__restorePlannerGet=()=>{Storage.prototype.getItem=original;};
  });
  await button.click();
  await expect(button).toHaveText('Retry sketch save');
  const staged=await page.evaluate(()=>{
    const disk=JSON.parse(localStorage.getItem('jgold-planner-v1'));
    return disk.projects.find(p=>p.title==='Reliability test').library.find(r=>r.type==='sketch').id;
  });
  await page.evaluate(()=>window.__restorePlannerGet());
  await button.click();
  await expect(button).toHaveText('Save sketch');
  const result=await rows(page);
  expect(result.inMemory).toBe(1);
  expect(result.onDisk).toBe(1);
  expect(result.id).toBe(staged);
  expect(result.diskId).toBe(staged);
});

test('aborted PNG transaction never creates a Library record and preserves editable strokes',async({page})=>{
  const {button}=await notebook(page);
  const dialogs=sketchDialogs(page);
  await page.evaluate(()=>{
    const original=IDBObjectStore.prototype.put;
    window.__restoreSketchPut=()=>{IDBObjectStore.prototype.put=original;};
    IDBObjectStore.prototype.put=function(...args){
      const req=original.apply(this,args);
      if(typeof args[1]==='string'&&args[1].startsWith('v6-')){
        req.addEventListener('success',()=>{try{req.transaction.abort();}catch{}},{once:true});
      }
      return req;
    };
  });
  await button.click();
  await expect.poll(()=>dialogs.some(d=>d.message.includes('Could not add sketch'))).toBe(true);
  expect((await rows(page)).inMemory).toBe(0);
  expect((await rows(page)).onDisk).toBe(0);
  expect((await rows(page)).strokes).toBe(1);
  await page.evaluate(()=>window.__restoreSketchPut());
  await button.click();
  await expect.poll(()=>rows(page).then(x=>x.onDisk)).toBe(1);
  expect((await rows(page)).inMemory).toBe(1);
});

test('rapid repeated week-arrow presses each advance once, even with stale scrollend',async({page})=>{
  await page.goto(base);
  await page.locator('[data-tab="week"]').click();
  const strip=page.locator('#v817WeekViewport');
  await expect(strip).toHaveClass(/v94-week-static/);
  const initial=await page.evaluate(()=>iso(selectedWeek));
  for(let n=1;n<=3;n++){
    await page.locator('#v94WeekForward').click();
    const wanted=await page.evaluate(({initial,n})=>iso(plusDays(new Date(initial+'T12:00:00'),7*n)),{initial,n});
    await expect.poll(()=>page.evaluate(()=>iso(selectedWeek))).toBe(wanted);
    await strip.evaluate(el=>el.dispatchEvent(new Event('scrollend')));
    await expect.poll(()=>page.evaluate(()=>iso(selectedWeek))).toBe(wanted);
  }
});

test('saved Pencil strokes survive zooming and reopening the notebook',async({page})=>{
  const {ink}=await notebook(page);
  const projectId=await page.evaluate(()=>v6Project().id);
  const before=await page.evaluate(()=>JSON.stringify(v6Project().notePages[0].strokes));
  await page.locator('#v815ZoomIn').click();
  await page.locator('#v815ZoomIn').click();
  await expect(ink.locator('path.v818-ink-stroke')).toHaveCount(1);
  expect(await page.evaluate(()=>JSON.stringify(v6Project().notePages[0].strokes))).toBe(before);
  await page.reload();
  await page.locator('[data-tab="brainstorm"]').click();
  await page.evaluate(id=>v6OpenProject(id),projectId);
  await expect(page.locator('#v76Ink path.v818-ink-stroke')).toHaveCount(1);
  expect(await page.evaluate(()=>JSON.stringify(v6Project().notePages[0].strokes))).toBe(before);
});

test('responsive notebook controls remain usable and Reduce Motion is respected',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(base);
  for(const width of [390,600,834,1366]){
    await page.setViewportSize({width,height:1024});
    await page.locator('[data-tab="brainstorm"]').click();
    if(!(await page.locator('#v76Editor').isVisible())){
      page.once('dialog',dialog=>dialog.accept('Responsive test'));
      await page.locator('#newProject').click();
  await page.locator('[data-v919-project-open="notes"]').click();
    }
    const metrics=await page.evaluate(()=>{
      const btn=document.getElementById('v819SaveSketch');
      const toolbar=document.querySelector('#projectNotes .v76-toolbar');
      return {overflow:document.documentElement.scrollWidth-innerWidth,
        buttonHeight:btn.getBoundingClientRect().height,
        buttonWidth:btn.getBoundingClientRect().width,
        hasLabel:!!btn.getAttribute('aria-label'),
        transition:getComputedStyle(btn).transitionDuration,
        wrapping:getComputedStyle(toolbar).flexWrap};
    });
    expect(metrics.overflow).toBeLessThanOrEqual(4);
    if(width>=740)expect(metrics.buttonHeight).toBeGreaterThanOrEqual(44);
    expect(metrics.buttonWidth).toBeGreaterThanOrEqual(44);
    expect(metrics.hasLabel).toBe(true);
    expect(metrics.transition.split(',').every(t=>parseFloat(t)<=0.001)).toBe(true);
  }
});
