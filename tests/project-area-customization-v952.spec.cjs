'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('node:fs/promises');
const {submitSheet}=require('./sheet-helper.cjs');

const original=['notes','todo','stats','connections','library'];
const projectCards=page=>page.locator('#projectOverview [data-bp-project-card]');
const order=page=>projectCards(page).evaluateAll(cards=>cards.map(card=>card.dataset.bpProjectCard));
const card=(page,name)=>page.locator('[data-bp-project-card="'+name+'"]');

async function projects(page){
  await page.goto('/');
  await page.evaluate(()=>{
    state.projects=['first','second'].map(id=>({id,title:id,notes:[],actions:[],library:[]}));
    save(true);
    v6Render();
  });
  await page.locator('.bottom-nav [data-tab="brainstorm"]').click();
  await page.locator('[data-v6-project="first"]').click();
}

test('Project card lift follows a touch and saves order only for the current project',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await projects(page);
  await expect(page.getByRole('heading',{name:'Project Stats'})).toBeVisible();
  expect(await order(page)).toEqual(original);
  const lift=await page.evaluate(async()=>{
    const source=document.querySelector('[data-bp-project-card="notes"] h3');
    const target=document.querySelector('[data-bp-project-card="todo"] h3');
    const start=source.getBoundingClientRect(),end=target.getBoundingClientRect();
    const send=(type,x,y)=>{
      const t=new Touch({identifier:4,target:source,clientX:x,clientY:y});
      const active=type==='touchend'?[]:[t];
      const event=new TouchEvent(type,{bubbles:true,cancelable:true,touches:active,targetTouches:active,changedTouches:[t]});
      source.dispatchEvent(event);
      return event.defaultPrevented;
    };
    send('touchstart',start.x+10,start.y+10);
    await new Promise(resolve=>setTimeout(resolve,470));
    const ghost=document.querySelector('.bp-follow-ghost');
    if(!ghost)return null;
    const before=ghost.getBoundingClientRect();
    const owned=send('touchmove',start.x+30,start.y+24);
    const after=ghost.getBoundingClientRect();
    send('touchmove',end.x+10,end.y+10);
    send('touchmove',end.x+11,end.y+11);
    send('touchend',end.x+10,end.y+10);
    return {x:after.left-before.left,y:after.top-before.top,owned};
  });
  expect(lift).toEqual({x:20,y:14,owned:true});
  await expect(page.locator('.bp-follow-ghost')).toHaveCount(0);
  const customized=['todo','notes','stats','connections','library'];
  expect(await order(page)).toEqual(customized);
  await page.locator('#backProjects').click();
  await page.locator('[data-v6-project="second"]').click();
  expect(await order(page)).toEqual(original);
  await page.reload();
  await page.locator('.bottom-nav [data-tab="brainstorm"]').click();
  await page.locator('[data-v6-project="first"]').click();
  expect(await order(page)).toEqual(customized);
});

test('Project card reorder supports keys, clean grid rows and failed-save rollback',async({page})=>{
  await page.setViewportSize({width:1024,height:1050});
  await projects(page);
  const stats=card(page,'stats');
  await stats.focus();
  await page.keyboard.press('Alt+ArrowUp');
  const customized=['notes','stats','todo','connections','library'];
  expect(await order(page)).toEqual(customized);
  await expect(stats).toBeFocused();
  expect((await card(page,'notes').boundingBox()).width).toBe((await stats.boundingBox()).width);
  await page.evaluate(()=>{
    const set=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){
      if(key===STORAGE_KEY)throw new DOMException('Storage full','QuotaExceededError');
      return set.call(this,key,value);
    };
  });
  await page.keyboard.press('Alt+ArrowUp');
  expect(await order(page)).toEqual(customized);
  expect(await page.evaluate(()=>v6Project().overviewCardOrder)).toEqual(customized);
});

const showAreas=page=>page.locator('.bottom-nav [data-tab="myplan"]').click();

test('Area icon and color persist, travel with rename, and can be set on creation',async({page})=>{
  await page.setViewportSize({width:375,height:812});
  await page.goto('/');
  await showAreas(page);
  const research=page.locator('[data-bpa-open="Research"]');
  expect((await research.boundingBox()).height).toBeGreaterThanOrEqual(150);
  expect((await research.locator('.bp-area-badge').boundingBox()).width).toBeGreaterThanOrEqual(52);
  await page.getByRole('button',{name:'Customize Research'}).click();
  const sheet=page.locator('#bpSheet');
  const icons=sheet.locator('button[data-area-icon]');
  await expect(icons).toHaveCount(30);
  await expect(sheet.locator('button[data-area-icon][title]')).toHaveCount(0);
  expect((await icons.allTextContents()).every(text=>text.trim()==='')).toBe(true);
  expect(await sheet.locator('[data-area-color]').count()).toBeGreaterThanOrEqual(12);
  await sheet.getByRole('button',{name:'Compass',exact:true}).click();
  await sheet.getByRole('button',{name:'Rose',exact:true}).click();
  await expect(sheet.getByRole('button',{name:'Compass',exact:true})).toHaveAttribute('aria-pressed','true');
  await submitSheet(page);
  await expect(research.locator('.bp-area-badge')).toHaveAttribute('data-area-color','rose');
  await research.click({button:'right'});
  await page.getByRole('dialog',{name:'Options for Research'}).getByRole('button',{name:'Rename'}).click();
  await submitSheet(page,'Lab');
  await page.reload();
  await showAreas(page);
  await page.locator('[data-bpa-open="Lab"]').click();
  await expect(page.locator('.bp-area-detail-name .bp-area-badge')).toHaveAttribute('data-area-color','rose');
  await expect(page.locator('.bp-area-goal summary')).toContainText('Finish research manuscript');
  await page.getByRole('button',{name:'Customize Lab'}).click();
  await expect(sheet.getByRole('button',{name:'Compass',exact:true})).toHaveAttribute('aria-pressed','true');
  await sheet.getByRole('button',{name:'Leaf',exact:true}).click();
  await sheet.getByRole('button',{name:'Cancel'}).click();
  await expect(sheet).toHaveCount(0);
  await page.getByRole('button',{name:'Customize Lab'}).click();
  await expect(sheet.getByRole('button',{name:'Compass',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.keyboard.press('Escape');
  await page.locator('[data-bpa-back]').click();
  await page.locator('[data-bpa-new]').click();
  await sheet.getByRole('button',{name:'Leaf',exact:true}).click();
  await sheet.getByRole('button',{name:'Forest',exact:true}).click();
  await submitSheet(page,'Garden');
  await expect(page.locator('.bp-area-detail-name .bp-area-badge')).toHaveAttribute('data-area-color','forest');
  expect(await page.evaluate(()=>state.areaAppearance)).toEqual([
    {area:'Lab',icon:'compass',color:'rose'},{area:'Garden',icon:'leaf',color:'forest'}
  ]);
});

test('New aligns with iPad navigation in both sidebar sizes and docks in the iPhone header',async({page})=>{
  await page.setViewportSize({width:1024,height:900});
  await page.goto('/');
  const quick=page.locator('#bpQuickAdd');
  const tab=page.locator('.bottom-nav [data-tab="today"]');
  // Sidebar collapse animates width; compare both buttons after layout settles.
  // This still fails if New and Today remain misaligned after the transition.
  const compare=async()=>{
    await expect.poll(async()=>{
      const a=await quick.boundingBox(),b=await tab.boundingBox();
      if(!a||!b)return Infinity;
      return Math.max(Math.abs(a.x-b.x),Math.abs(a.width-b.width),Math.abs(a.height-b.height));
    },{timeout:3000}).toBeLessThanOrEqual(0.5);
  };
  await compare();
  await expect(quick.locator('.bp-quick-label')).toBeVisible();
  expect(await quick.evaluate(node=>getComputedStyle(node).flexDirection)).toBe('row');
  await page.locator('.canvas-ipad-collapse').click();
  await expect(quick.locator('.bp-quick-label')).toBeHidden();
  await compare();
  await quick.click();
  await expect(page.locator('#bpQuickAddMenu')).toBeVisible();
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('.app-header #bpQuickAdd')).toBeVisible();
  await expect(page.locator('#bpQuickAddMenu')).toBeHidden();
});

test('Complete backup restores Area appearance and individual Project card order',async({page})=>{
  await projects(page);
  const customized=['library','notes','todo','stats','connections'];
  const style={area:'Research',icon:'globe',color:'sky'};
  await page.evaluate(({customized,style})=>{
    v6Project().overviewCardOrder=customized;
    state.areaAppearance=[style];
    if(!save(true))throw Error('Could not seed preferences');
  },{customized,style});
  const [download]=await Promise.all([
    page.waitForEvent('download'),
    page.locator('#exportData').evaluate(button=>button.click())
  ]);
  const backup=JSON.parse(await fs.readFile(await download.path(),'utf8'));
  await page.evaluate(()=>{
    delete v6Project().overviewCardOrder;
    delete state.areaAppearance;
    if(!save(true))throw Error('Could not reset preferences');
  });
  page.on('dialog',dialog=>dialog.accept());
  await page.evaluate(data=>v74ImportBackup(new Blob([JSON.stringify(data)])),backup);
  await page.locator('[data-v6-project="first"]').click();
  expect(await order(page)).toEqual(customized);
  await showAreas(page);
  await expect(page.locator('[data-bpa-open="Research"] .bp-area-badge')).toHaveAttribute('data-area-color','ocean');
  await page.getByRole('button',{name:'Customize Research'}).click();
  await expect(page.locator('#bpSheet [data-area-icon="globe"]')).toHaveAttribute('aria-pressed','true');
});


test('Area swatches match all Customize names and colors and Theme follows the current accent',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await page.locator('#paletteLauncher').click();
  const presets=await page.locator('#secondarySwatches button').evaluateAll(buttons=>
    buttons.map(button=>[button.title,button.dataset.color]));
  await page.locator('#secondarySwatches [title="Copper"]').click();
  await page.locator('#closeCustomize').click();
  await showAreas(page);
  await page.getByRole('button',{name:'Customize Research'}).click();
  const sheet=page.locator('#bpSheet');
  const swatches=await sheet.locator('button[data-area-color]').evaluateAll(buttons=>
    buttons.map(button=>[button.title,button.firstElementChild.style.getPropertyValue('--area-accent')]));
  expect(swatches.slice(1)).toEqual(presets);
  await sheet.getByRole('button',{name:'Theme',exact:true}).click();
  const preview=sheet.locator('.bp-area-picker-preview .bp-area-badge');
  await expect(preview).toHaveAttribute('data-area-color','theme');
  expect(await preview.evaluate(badge=>getComputedStyle(badge).getPropertyValue('--area-accent').trim())).toBe('#b87333');
});

test('Renaming a built-in Area preserves its default icon and color',async({page})=>{
  await page.goto('/');
  await showAreas(page);
  await page.locator('[data-bpa-open="Physical"]').click({button:'right'});
  await page.getByRole('dialog',{name:'Options for Physical'}).getByRole('button',{name:'Rename'}).click();
  await submitSheet(page,'Training');
  const tile=page.locator('[data-bpa-open="Training"]');
  await expect(tile.locator('.bp-area-badge')).toHaveAttribute('data-area-color','copper');
  await page.getByRole('button',{name:'Customize Training'}).click();
  await expect(page.locator('#bpSheet [data-area-icon="fitness"]')).toHaveAttribute('aria-pressed','true');
});

test('New uses Area context only in the visible Areas panel and closes when resized',async({page})=>{
  await page.setViewportSize({width:1024,height:900});
  await page.goto('/');
  await showAreas(page);
  await page.locator('[data-bpa-open="Research"]').click();
  await page.getByRole('tab',{name:'Tasks',exact:true}).click();
  await page.locator('#bpQuickAdd').click();
  await expect(page.locator('#bpQuickAddMenu')).toBeVisible();
  await page.setViewportSize({width:950,height:900});
  await expect(page.locator('#bpQuickAddMenu')).toBeHidden();
  await page.locator('#bpQuickAdd').click();
  await page.locator('[data-bp-quick-kind="task"]').click();
  await expect(page.locator('#modalForm select[name="area"]')).toHaveValue('');
});

test('An Area press released outside the card ends without opening its options',async({page})=>{
  await page.goto('/');
  await showAreas(page);
  const opened=await page.evaluate(async()=>{
    const tile=document.querySelector('[data-bpa-open="Research"]');
    const options={bubbles:true,pointerId:20,pointerType:'mouse',button:0,isPrimary:true,clientX:20,clientY:80};
    tile.dispatchEvent(new PointerEvent('pointerdown',options));
    document.body.dispatchEvent(new PointerEvent('pointerup',options));
    await new Promise(resolve=>setTimeout(resolve,570));
    return !!document.querySelector('.bp-area-context-menu');
  });
  expect(opened).toBe(false);
});
