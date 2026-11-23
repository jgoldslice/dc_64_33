'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('node:fs/promises');
const base='http://127.0.0.1:8765/';
const defaults=['schedule','habits','priorities','projects'];
const todayOrder=page=>page.locator('#today > .v917-today-grid > [data-bp-today-card]')
  .evaluateAll(nodes=>nodes.map(n=>n.dataset.bpTodayCard));

test('Today keeps paired default cards and reorders by a true pointer-following lift',async({page})=>{
  await page.setViewportSize({width:1024,height:1040});
  await page.goto(base);
  expect(await todayOrder(page)).toEqual(defaults);
  const source=page.locator('[data-bp-today-card="habits"]');
  const target=page.locator('[data-bp-today-card="schedule"]');
  const a=await source.boundingBox(),b=await target.boundingBox();
  expect(a.x).toBeGreaterThan(b.x+b.width-4);
  const start={x:a.x+a.width*.5,y:a.y+55};
  await page.mouse.move(start.x,start.y);
  await page.mouse.down();
  await page.waitForTimeout(490);
  const ghost=page.locator('.bp-follow-ghost');
  await expect(ghost).toHaveCount(1);
  await expect(source).toHaveClass(/bp-today-placeholder/);
  const before=await ghost.boundingBox();
  await page.mouse.move(start.x-50,start.y+25);
  const after=await ghost.boundingBox();
  expect(after.x-before.x).toBeCloseTo(-50,0);
  expect(after.y-before.y).toBeCloseTo(25,0);
  await page.mouse.move(b.x+b.width*.45,b.y+55,{steps:6});
  await page.mouse.up();
  await expect(ghost).toHaveCount(0);
  expect(await todayOrder(page)).toEqual(['habits','schedule','priorities','projects']);
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('jgold-planner-v1')).todayCardOrder);
  expect(stored).toEqual(['habits','schedule','priorities','projects']);
  await page.reload();
  expect(await todayOrder(page)).toEqual(stored);
  const positions=await page.evaluate(()=>({
    h:document.querySelector('[data-bp-today-card="habits"]').getBoundingClientRect().x,
    s:document.querySelector('[data-bp-today-card="schedule"]').getBoundingClientRect().x
  }));
  expect(positions.h).toBeLessThan(positions.s);
});

test('keyboard reordering supports a full-width Projects card and survives reload',async({page})=>{
  await page.setViewportSize({width:834,height:1194});
  await page.goto(base);
  const project=page.locator('[data-bp-today-card="projects"]');
  await project.focus();
  await page.keyboard.press('Alt+ArrowUp');
  expect(await todayOrder(page)).toEqual(['schedule','habits','projects','priorities']);
  await expect(project).toBeFocused();
  const widths=await page.evaluate(()=>({
    project:document.querySelector('[data-bp-today-card="projects"]').getBoundingClientRect().width,
    priorities:document.querySelector('[data-bp-today-card="priorities"]').getBoundingClientRect().width
  }));
  expect(widths.project).toBeGreaterThan(widths.priorities+100);
  await page.reload();
  expect(await todayOrder(page)).toEqual(['schedule','habits','projects','priorities']);
});

test('touch hold moves a floating Today card without scrolling or triggering its contents',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto(base);
  const result=await page.evaluate(async()=>{
    const source=document.querySelector('[data-bp-today-card="priorities"]');
    const a=source.getBoundingClientRect();
    const x=a.left+25,y=a.top+30;
    const touch=(px,py)=>new Touch({identifier:7,target:source,clientX:px,clientY:py});
    const send=(type,px,py)=>source.dispatchEvent(new TouchEvent(type,{
      bubbles:true,cancelable:true,
      touches:type==='touchend'?[]:[touch(px,py)],
      targetTouches:type==='touchend'?[]:[touch(px,py)],
      changedTouches:[touch(px,py)]
    }));
    send('touchstart',x,y);
    await new Promise(resolve=>setTimeout(resolve,480));
    const ghost=document.querySelector('.bp-follow-ghost');
    if(!ghost)return {error:'No floating card'};
    const before=ghost.getBoundingClientRect();
    send('touchmove',x+37,y+21);
    const after=ghost.getBoundingClientRect();
    // End at the source location, without a reorder, to verify no phantom save.
    send('touchend',x+37,y+21);
    return {deltaX:after.left-before.left,deltaY:after.top-before.top,
      ghostRemoved:!document.querySelector('.bp-follow-ghost'),
      order:[...document.querySelectorAll('[data-bp-today-card]')].map(n=>n.dataset.bpTodayCard)};
  });
  expect(result.error).toBeUndefined();
  expect(result.deltaX).toBeCloseTo(37,0);
  expect(result.deltaY).toBeCloseTo(21,0);
  expect(result.ghostRemoved).toBe(true);
  expect(result.order).toEqual(defaults);
  await page.locator('#today .v917-schedule [data-open="event"]').click();
  await expect(page.locator('#modalTitle')).toHaveText('Add Event');
});

test('Today drag is cancelled if saving fails, preserving the previous saved order',async({page})=>{
  await page.goto(base);
  await page.evaluate(()=>{
    const original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){
      if(key==='jgold-planner-v1')throw new DOMException('Storage full','QuotaExceededError');
      return original.call(this,key,value);
    };
    window.__restoreTodayWrites=()=>Storage.prototype.setItem=original;
  });
  try{
    const card=page.locator('[data-bp-today-card="habits"]');
    await card.focus();
    await page.keyboard.press('Alt+ArrowUp');
    expect(await todayOrder(page)).toEqual(defaults);
    expect(await page.evaluate(()=>state.todayCardOrder)).toBeUndefined();
  }finally{await page.evaluate(()=>window.__restoreTodayWrites());}
});

test('complete backup round-trip restores the custom Today card order immediately',async({page})=>{
  await page.goto(base);
  await page.evaluate(()=>{
    state.todayCardOrder=['projects','priorities','tasks','habits','schedule'];
    if(!save(true))throw Error('Could not seed dashboard order');
  });
  const [download]=await Promise.all([
    page.waitForEvent('download'),
    page.locator('#exportData').evaluate(button=>button.click())
  ]);
  const backup=JSON.parse(await fs.readFile(await download.path(),'utf8'));
  expect(backup.state.todayCardOrder).toEqual(['projects','priorities','tasks','habits','schedule']);
  await page.evaluate(()=>{state.todayCardOrder=['schedule','habits','priorities','projects'];if(!save(true))throw Error('Could not reset');});
  page.on('dialog',dialog=>dialog.accept());
  await page.evaluate(data=>v74ImportBackup(new Blob([JSON.stringify(data)])),backup);
  expect(await todayOrder(page)).toEqual(['projects','priorities','habits','schedule']);
  await page.reload();
  expect(await todayOrder(page)).toEqual(['projects','priorities','habits','schedule']);
});

test('Library follows the pointer and shows no persistent instruction subtitles',async({page})=>{
  await page.goto(base);
  await page.locator('[data-tab="brainstorm"]').click();
  await page.locator('#newProject').click();
  const {submitSheet}=require('./sheet-helper.cjs');
  await submitSheet(page,'Follow QA');
  await page.evaluate(()=>{
    const p=v6Project();
    p.library=[
      {id:'one',title:'One',type:'link',url:'https://example.com/a'},
      {id:'two',title:'Two',type:'link',url:'https://example.com/b'}
    ];
    if(!save(true))throw Error('Seed failed');
    v6Render();
  });
  await page.locator('[data-v919-project-open="library"]').click();
  await expect(page.locator('#projectLibraryList .v923-reorder-hint')).toHaveCount(0);
  await expect(page.locator('#projectLibrary')).not.toContainText('Files and sketches stay on this device');
  const a=await page.locator('[data-v923-item="one"]').boundingBox();
  const x=a.x+40,y=a.y+45;
  await page.mouse.move(x,y);await page.mouse.down();
  await page.waitForTimeout(480);
  const ghost=page.locator('.bp-follow-ghost');
  await expect(ghost).toHaveCount(1);
  const before=await ghost.boundingBox();
  await page.mouse.move(x+24,y+36);
  const after=await ghost.boundingBox();
  expect(after.x-before.x).toBeCloseTo(24,0);
  expect(after.y-before.y).toBeCloseTo(36,0);
  await page.mouse.up();
  await expect(ghost).toHaveCount(0);
});
