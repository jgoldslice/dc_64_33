const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';
test.use({browserName:'chromium',viewport:{width:390,height:844},isMobile:true,hasTouch:true});
async function boot(page){
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  await expect(page.locator('#openingOverlay')).toBeHidden({timeout:10000});
  return errors;
}
async function dragThenCancel(page){
  await page.evaluate(()=>{
    const target=document.querySelector('#today .view-header h1');
    const r=target.getBoundingClientRect(),x=r.left+50,y=r.top+25;
    const a=new Touch({identifier:9,target,clientX:x,clientY:y});
    const b=new Touch({identifier:9,target,clientX:x-110,clientY:y+2});
    target.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,cancelable:true,touches:[a],changedTouches:[a]}));
    target.dispatchEvent(new TouchEvent('touchmove',{bubbles:true,cancelable:true,touches:[b],changedTouches:[b]}));
    target.dispatchEvent(new TouchEvent('touchcancel',{bubbles:true,cancelable:true,touches:[],changedTouches:[b]}));
  });
}
test('interrupted swipe restores the original tab and leaves no visual pane behind',async({page})=>{
  const errors=await boot(page);
  const before=await page.evaluate(()=>JSON.stringify(state));
  await dragThenCancel(page);
  await expect(page.locator('.v94-live-pane')).toHaveCount(0);
  await expect(page.locator('#today')).toHaveClass(/active/);
  expect(await page.evaluate(()=>JSON.stringify(state))).toBe(before);
  expect(errors).toEqual([]);
});
test('project opening does not animate the whole page or mutate existing planner records',async({page})=>{
  const errors=await boot(page);
  await page.locator('[data-tab="brainstorm"]').click();
  page.once('dialog',dialog=>dialog.accept('Fluidity project'));
  await page.locator('#newProject').click();
  await page.locator('[data-v919-project-open="notes"]').click();
  await expect(page.locator('#projectWorkspace')).toBeVisible();
  await page.locator('#backProjects').click();
  await expect(page.locator('#projectGrid [data-v6-project]')).toHaveCount(1);
  await page.evaluate(()=>{
    window.__v91ProjectScroll=[];
    const old=Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView=function(options){
      if(this.id==='projectWorkspace')window.__v91ProjectScroll.push(options?.behavior);
      return old.call(this,options);
    };
  });
  await page.locator('#projectGrid [data-v6-project]').first().click();
  await expect(page.locator('#projectWorkspace')).toBeVisible();
  const stateNow=await page.evaluate(()=>({
    methods:window.__v91ProjectScroll,
    name:v6Project().title,
    notes:v6Project().notePages[0]?.strokes||[],
    entryAnimation:getComputedStyle(document.querySelector('#projectWorkspace .v6-project-title')).animationName
  }));
  expect(stateNow.methods).toEqual(['instant']);
  expect(stateNow.name).toBe('Fluidity project');
  expect(stateNow.notes).toHaveLength(0);
  expect(stateNow.entryAnimation).toContain('blueprint-v91-arrive');
  expect(errors).toEqual([]);
});
test('Pencil surface and its pointer events cannot initiate top-level swipe motion',async({page})=>{
  const errors=await boot(page);
  await page.locator('[data-tab="brainstorm"]').click();
  page.once('dialog',d=>d.accept('Pencil-safe'));
  await page.locator('#newProject').click();
  await page.locator('[data-v919-project-open="notes"]').click();
  await page.locator('#v76Ink').scrollIntoViewIfNeeded();
  await page.locator('#v76Ink').evaluate(target=>{
    const b=target.getBoundingClientRect(),x=b.left+b.width*.68,y=b.top+Math.min(80,b.height/2);
    const a=new Touch({identifier:31,target,clientX:x,clientY:y});
    const z=new Touch({identifier:31,target,clientX:x-130,clientY:y+3});
    target.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,cancelable:true,touches:[a],changedTouches:[a]}));
    target.dispatchEvent(new TouchEvent('touchmove',{bubbles:true,cancelable:true,touches:[z],changedTouches:[z]}));
    target.dispatchEvent(new TouchEvent('touchend',{bubbles:true,cancelable:true,touches:[],changedTouches:[z]}));
  });
  await expect(page.locator('#brainstorm')).toHaveClass(/active/);
  await expect(page.locator('.v94-live-pane')).toHaveCount(0);
  expect(await page.evaluate(()=>window.__blueprintMotionDebug.prepares)).toBe(0);
  expect(errors).toEqual([]);
});
test('rapid tab taps and viewport changes leave one active tab without animation remnants',async({page})=>{
  const errors=await boot(page);
  for(const width of [390,834,600,320,1194,390]){
    await page.setViewportSize({width,height:900});
    for(const id of ['week','myplan','brainstorm','today']){
      await page.locator('.bottom-nav [data-tab="'+id+'"]').click();
      await expect(page.locator('#'+id)).toHaveClass(/active/);
      await expect(page.locator('.view.active')).toHaveCount(1);
      await expect(page.locator('.v94-live-pane')).toHaveCount(0);
    }
  }
  expect(errors).toEqual([]);
});
test('Reduce Motion removes project/sheet entrances and preserves full controls',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await boot(page);
  await page.locator('[data-tab="brainstorm"]').click();
  page.once('dialog',dialog=>dialog.accept('Reduced motion'));
  await page.locator('#newProject').click();
  await page.locator('[data-v919-project-open="notes"]').click();
  await expect(page.locator('#projectWorkspace')).toBeVisible();
  await expect(page.locator('#projectWorkspace .v6-project-title')).toHaveCSS('animation-name','none');
  await page.locator('[data-tab="week"]').click();
  await page.locator('#addWeekEvent').click();
  await expect(page.locator('#v87EventBack')).toBeVisible();
  await expect(page.locator('#v87EventBack .v87-event-sheet')).toHaveCSS('animation-name','none');
});

test('dragging an overflowing tab does not collapse its document scroll position',async({page})=>{
  await boot(page);
  const result=await page.evaluate(()=>{
    const source=document.getElementById('today');
    const spacer=document.createElement('div');spacer.style.height='2400px';
    source.append(spacer);
    window.scrollTo(0,300);
    const original=window.scrollY;
    const target=source.querySelector('.view-header h1');
    const rect=target.getBoundingClientRect(),x=rect.x+65,y=rect.y+20;
    const t=dx=>new Touch({identifier:11,target,clientX:x+dx,clientY:y});
    const a=t(0),b=t(-100);
    const send=(type,touches,changed)=>target.dispatchEvent(new TouchEvent(type,{
      bubbles:true,cancelable:true,touches,changedTouches:changed,targetTouches:touches
    }));
    send('touchstart',[a],[a]);
    send('touchmove',[b],[b]);
    const during=window.scrollY;
    send('touchcancel',[],[b]);
    return {original,during};
  });
  expect(result.original).toBeGreaterThan(200);
  expect(Math.abs(result.during-result.original)).toBeLessThan(2);
  await expect(page.locator('.v94-live-pane')).toHaveCount(0);
});
