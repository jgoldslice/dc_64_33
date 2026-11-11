const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';

async function week(page){
  await page.goto(base);
  await page.locator('[data-tab="week"]').click();
  await expect(page.locator('#v817WeekViewport')).toBeVisible();
  await page.locator('#addWeekEvent').click();
  const dates=page.locator('#v87EventDates');
  await expect(dates).toBeVisible();
  await expect.poll(()=>dates.evaluate(el=>el.style.scrollSnapType)).toBe('');
  return dates;
}

test('Add Event commits the date only after scroll settles and never advances twice',async({page})=>{
  const dates=await week(page);
  const original=await dates.locator('[aria-pressed="true"]').getAttribute('data-v87-date');
  // Disable snap to stage a still-in-progress native drag at the next week.
  const duringScroll=await dates.evaluate(el=>{
    el.style.scrollSnapType='none';
    el.scrollLeft=2*el.clientWidth;
    el.dispatchEvent(new Event('scroll'));
    // Read synchronously, before a browser-generated scrollend can arrive.
    return el.querySelector('[aria-pressed="true"]')?.dataset.v87Date;
  });
  expect(duringScroll).toBe(original);
  await dates.evaluate(el=>el.dispatchEvent(new Event('scrollend')));
  const next=await page.evaluate(value=>iso(plusDays(new Date(value+'T12:00:00'),7)),original);
  await expect(dates.locator('[aria-pressed="true"]')).toHaveAttribute('data-v87-date',next);
  await dates.evaluate(el=>el.dispatchEvent(new Event('scrollend')));
  await expect(dates.locator('[aria-pressed="true"]')).toHaveAttribute('data-v87-date',next);
  await expect.poll(()=>dates.evaluate(el=>Math.round(el.scrollLeft/el.clientWidth))).toBe(1);
});

test('failed planner save does not allow an attached file to be deleted',async({page})=>{
  await page.goto(base);
  await page.locator('[data-tab="brainstorm"]').click();
  page.once('dialog',dialog=>dialog.accept('Recovery test'));
  await page.locator('#newProject').click();
  await page.locator('[data-v919-project-open="notes"]').click();
  const result=await page.evaluate(async()=>{
    const p=v6Project();
    const key='v819-safety-file';
    await v6Blob('put',key,new Blob(['keep me'],{type:'text/plain'}));
    p.library.push({id:'v819-file',type:'file',title:'Important.txt',key,mime:'text/plain'});
    if(!save(true))throw Error('Could not seed data');
    const originalSet=Storage.prototype.setItem,originalConfirm=window.confirm;
    Storage.prototype.setItem=function(name,value){
      if(name===STORAGE_KEY)return;
      return originalSet.call(this,name,value);
    };
    window.confirm=()=>true;
    try{await v6DeleteResource('v819-file');}
    finally{Storage.prototype.setItem=originalSet;window.confirm=originalConfirm;}
    const linked=p.library.some(item=>item.id==='v819-file');
    const blob=await v6Blob('get',key);
    const persisted=JSON.parse(localStorage.getItem(STORAGE_KEY));
    // Failed deletion should not silently orphan a saved attachment.
    return {linked,hasBlob:!!blob,persisted:persisted.projects.some(x=>
      x.id===p.id&&x.library.some(item=>item.id==='v819-file'))};
  });
  expect(result).toEqual({linked:true,hasBlob:true,persisted:true});
});

test('interrupted Pencil stroke retains ink already drawn',async({page})=>{
  await page.goto(base);
  await page.locator('[data-tab="brainstorm"]').click();
  page.once('dialog',dialog=>dialog.accept('Pencil cancel test'));
  await page.locator('#newProject').click();
  await page.locator('[data-v919-project-open="notes"]').click();
  await page.locator('[data-v76-mode="pen"]').click();
  const ink=page.locator('#v76Ink');
  await ink.scrollIntoViewIfNeeded();
  const p=await ink.evaluate(el=>{
    const r=el.getBoundingClientRect();
    el.addEventListener('pointerdown',e=>window.__v819Pointer=e.pointerId,{once:true});
    return {x:r.left+r.width/2,y:r.top+Math.min(r.height/2,125)};
  });
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x,y:p.y,buttons:0,pointerType:'pen'});
  await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'left',buttons:1,clickCount:1,pointerType:'pen'});
  await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x+65,y:p.y+15,buttons:1,pointerType:'pen'});
  await ink.evaluate(el=>el.dispatchEvent(new PointerEvent('pointercancel',{
    bubbles:true,pointerId:window.__v819Pointer,pointerType:'pen',
    clientX:0,clientY:0
  })));
  await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x+65,y:p.y+15,button:'left',buttons:0,clickCount:1,pointerType:'pen'});
  await cdp.detach();
  await expect(ink.locator('path.v818-ink-stroke')).toHaveCount(1);
  expect(await page.evaluate(()=>v6Project().notePages[0].strokes.length)).toBe(1);
});

test('failed upload index save preserves the file in memory for a later retry',async({page})=>{
  await page.goto(base);
  await page.locator('[data-tab="brainstorm"]').click();
  page.once('dialog',dialog=>dialog.accept('Upload recovery test'));
  await page.locator('#newProject').click();
  await page.locator('[data-v919-project-open="notes"]').click();
  const result=await page.evaluate(async()=>{
    const p=v6Project();
    const originalSet=Storage.prototype.setItem,originalAlert=window.alert;
    Storage.prototype.setItem=function(name,value){
      if(name===STORAGE_KEY)return;
      return originalSet.call(this,name,value);
    };
    window.alert=()=>{};
    try{await v6Upload([new File(['important draft'],'Uncommitted.txt',{type:'text/plain'})]);}
    finally{Storage.prototype.setItem=originalSet;window.alert=originalAlert;}
    const file=p.library.find(item=>item.title==='Uncommitted.txt');
    const hasBytes=!!(file&&await v6Blob('get',file.key));
    const retrySaved=save(true);
    const disk=JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {hasRecord:!!file,hasBytes,retrySaved,
      persisted:disk.projects.some(project=>String(project.id)===String(p.id)&&
        project.library.some(item=>item.title==='Uncommitted.txt'))};
  });
  expect(result).toEqual({hasRecord:true,hasBytes:true,retrySaved:true,persisted:true});
});

test('notebook has no instruction paragraph and can save ink to project library',async({page})=>{
  await page.goto(base);
  await page.locator('[data-tab="brainstorm"]').click();
  page.once('dialog',dialog=>dialog.accept('Sketch export'));
  await page.locator('#newProject').click();
  await page.locator('[data-v919-project-open="notes"]').click();
  await expect(page.locator('.v76-tip')).toHaveCount(0);
  await expect(page.locator('#v819SaveSketch')).toBeVisible();
  await page.locator('[data-v76-mode="pen"]').click();
  const rect=await page.locator('#v76Ink').boundingBox();
  await page.mouse.move(rect.x+rect.width/2,rect.y+80);
  await page.mouse.down();
  await page.mouse.move(rect.x+rect.width/2+50,rect.y+100,{steps:5});
  await page.mouse.up();
  await expect(page.locator('#v76Ink path.v818-ink-stroke')).toHaveCount(1);
  page.once('dialog',dialog=>dialog.accept('Notebook sketch'));
  await page.locator('#v819SaveSketch').click();
  await expect.poll(()=>page.evaluate(()=>v6Project().library.filter(x=>x.type==='sketch').length)).toBe(1);
  const result=await page.evaluate(async()=>{
    const r=v6Project().library.find(x=>x.type==='sketch');
    const blob=await v6Blob('get',r.key);
    return {type:blob?.type,size:blob?.size,strokes:v6Project().notePages[0].strokes.length};
  });
  expect(result.type).toBe('image/png');
  expect(result.size).toBeGreaterThan(100);
  expect(result.strokes).toBe(1);
});
