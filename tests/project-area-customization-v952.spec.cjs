'use strict';
const {test,expect}=require('@playwright/test');
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
  expect(await sheet.locator('[data-area-icon]').count()).toBeGreaterThanOrEqual(25);
  expect(await sheet.locator('[data-area-color]').count()).toBeGreaterThanOrEqual(12);
  await sheet.getByRole('button',{name:'Compass',exact:true}).click();
  await sheet.getByRole('button',{name:'Pink',exact:true}).click();
  await expect(sheet.getByRole('button',{name:'Compass',exact:true})).toHaveAttribute('aria-pressed','true');
  await submitSheet(page);
  await expect(research.locator('.bp-area-badge')).toHaveClass(/bp-area-color-pink/);
  await research.click({button:'right'});
  await page.getByRole('dialog',{name:'Options for Research'}).getByRole('button',{name:'Rename'}).click();
  await submitSheet(page,'Lab');
  await page.reload();
  await showAreas(page);
  await page.locator('[data-bpa-open="Lab"]').click();
  await expect(page.locator('.bp-area-detail-name .bp-area-badge')).toHaveClass(/bp-area-color-pink/);
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
  await sheet.getByRole('button',{name:'Green',exact:true}).click();
  await submitSheet(page,'Garden');
  await expect(page.locator('.bp-area-detail-name .bp-area-badge')).toHaveClass(/bp-area-color-green/);
  expect(await page.evaluate(()=>state.areaAppearance)).toEqual([
    {area:'Lab',icon:'compass',color:'pink'},{area:'Garden',icon:'leaf',color:'green'}
  ]);
});

test('New aligns with iPad navigation in both sidebar sizes and docks in the iPhone header',async({page})=>{
  await page.setViewportSize({width:1024,height:900});
  await page.goto('/');
  const quick=page.locator('#bpQuickAdd');
  const tab=page.locator('.bottom-nav [data-tab="today"]');
  const compare=async()=>{
    const a=await quick.boundingBox(),b=await tab.boundingBox();
    expect(a.x).toBeCloseTo(b.x,0);
    expect(a.width).toBeCloseTo(b.width,0);
    expect(a.height).toBeCloseTo(b.height,0);
  };
  await compare();
  await expect(quick.locator('.bp-quick-label')).toBeVisible();
  await page.locator('.canvas-ipad-collapse').click();
  await expect(quick.locator('.bp-quick-label')).toBeHidden();
  await compare();
  await quick.click();
  await expect(page.locator('#bpQuickAddMenu')).toBeVisible();
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('.app-header #bpQuickAdd')).toBeVisible();
  await expect(page.locator('#bpQuickAddMenu')).toBeHidden();
});
