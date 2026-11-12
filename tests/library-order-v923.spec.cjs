'use strict';
const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';
test.use({browserName:'chromium'});

async function setup(page){
  await page.goto(base);
  await page.locator('[data-tab="brainstorm"]').click();
  page.once('dialog',dialog=>dialog.accept('Order QA'));
  await page.locator('#newProject').click();
  await expect(page.locator('#projectOverview')).toBeVisible();
  await page.evaluate(async()=>{
    const p=v6Project();
    const png=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP+ZJRdGAAAAABJRU5ErkJggg=='),x=>x.charCodeAt(0));
    for(const [id,key] of [['image-a','test-v923-a'],['image-c','test-v923-c']])
      await v6Blob('put',key,new Blob([png],{type:'image/png'}));
    p.library=[
      {id:'image-a',type:'file',title:'A · Figure',mime:'image/png',key:'test-v923-a',created:'2026-01-01'},
      {id:'link-b',type:'link',title:'B · Article',url:'https://example.com/article',created:'2026-01-04'},
      {id:'image-c',type:'file',title:'C · Figure',mime:'image/png',key:'test-v923-c',created:'2026-01-02'},
      {id:'video-d',type:'link',title:'D · YouTube',url:'https://youtube.com/shorts/QaB8oahyId8',created:'2026-01-03'}
    ];
    if(!save(true))throw Error('QA setup save failed');
    v6Render();
  });
}
const order=page=>page.locator('#projectLibraryList [data-v923-item]')
  .evaluateAll(nodes=>nodes.map(el=>el.dataset.v923Item));

test('Overview shows exactly the first three mixed Library items; links have working open actions',async({page})=>{
  await setup(page);
  const preview=page.locator('#v919LibraryPreview');
  await expect(preview.locator('.v919-gallery-item')).toHaveCount(3);
  await expect(preview).toContainText('A · Figure');
  await expect(preview).toContainText('B · Article');
  await expect(preview).toContainText('C · Figure');
  await expect(preview).not.toContainText('D · YouTube');
  await expect(preview.locator('[data-v6-open-resource="link-b"]')).toBeVisible();
  await expect.poll(()=>preview.locator('img[src^="blob:"]').count()).toBe(2);
  await page.locator('[data-v919-project-open="library"]').click();
  expect(await order(page)).toEqual(['image-a','link-b','image-c','video-d']);
  await expect(page.locator('[data-v923-item="video-d"] .v86-video-card')).toBeVisible();
});

test('press and hold an image then drag after a YouTube link: saves order and updates Overview',async({page})=>{
  await setup(page);
  await page.locator('[data-v919-project-open="library"]').click();
  const source=page.locator('[data-v923-item="image-a"]');
  const target=page.locator('[data-v923-item="video-d"]');
  const a=await source.boundingBox();
  const b=await target.boundingBox();
  await page.mouse.move(a.x+a.width*.45,a.y+a.height*.5);
  await page.mouse.down();
  await page.waitForTimeout(500);
  await expect(source).toHaveClass(/v923-dragging/);
  await page.mouse.move(b.x+b.width*.78,b.y+b.height*.65,{steps:8});
  await page.mouse.up();
  await expect.poll(()=>order(page)).toEqual(['link-b','image-c','video-d','image-a']);
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem(STORAGE_KEY))
    .projects[0].library.map(r=>r.id));
  expect(saved).toEqual(['link-b','image-c','video-d','image-a']);
  await page.locator('#v919BackOverview').click();
  const preview=page.locator('#v919LibraryPreview');
  await expect(preview.locator('.v919-gallery-item')).toHaveCount(3);
  await expect(preview).toContainText('B · Article');
  await expect(preview).toContainText('D · YouTube');
  await expect(preview).not.toContainText('A · Figure');
  await page.reload();
  await page.locator('[data-tab="brainstorm"]').click();
  await page.locator('[data-v6-project]').filter({hasText:'Order QA'}).click();
  await expect(page.locator('#v919LibraryPreview')).toContainText('D · YouTube');
  await page.locator('[data-v919-project-open="library"]').click();
  expect(await order(page)).toEqual(['link-b','image-c','video-d','image-a']);
});

test('list mode and keyboard alternative reorder links without changing resource contents',async({page})=>{
  await setup(page);
  await page.locator('[data-v919-project-open="library"]').click();
  await page.locator('[data-library-view="list"]').click();
  await expect(page.locator('#projectLibraryList')).toHaveClass(/v74-library-list/);
  const moving=page.locator('[data-v923-item="link-b"]');
  await moving.focus();
  await page.keyboard.press('Alt+ArrowUp');
  expect(await order(page)).toEqual(['link-b','image-a','image-c','video-d']);
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem(STORAGE_KEY)).projects[0].library);
  expect(stored.map(x=>x.id)).toEqual(['link-b','image-a','image-c','video-d']);
  expect(stored[0].url).toBe('https://example.com/article');
  expect(stored[1].key).toBe('test-v923-a');
  await page.locator('[data-library-view="gallery"]').click();
  expect(await order(page)).toEqual(['link-b','image-a','image-c','video-d']);
});

test('long touch hold reorders a link without triggering Open or deleting records',async({page})=>{
  await setup(page);
  await page.locator('[data-v919-project-open="library"]').click();
  await page.evaluate(async()=>{
    const source=document.querySelector('[data-v923-item="link-b"]');
    const destination=document.querySelector('[data-v923-item="image-a"]');
    const a=source.getBoundingClientRect();
    const b=destination.getBoundingClientRect();
    const makeTouch=(x,y)=>new Touch({identifier:17,target:source,clientX:x,clientY:y});
    const x=a.left+a.width/2,y=a.top+a.height/2;
    const start=makeTouch(x,y);
    source.dispatchEvent(new TouchEvent('touchstart',{
      bubbles:true,cancelable:true,touches:[start],targetTouches:[start],changedTouches:[start]
    }));
    await new Promise(resolve=>setTimeout(resolve,480));
    const moved=makeTouch(b.left+5,b.top+5);
    source.dispatchEvent(new TouchEvent('touchmove',{
      bubbles:true,cancelable:true,touches:[moved],targetTouches:[moved],changedTouches:[moved]
    }));
    source.dispatchEvent(new TouchEvent('touchend',{
      bubbles:true,cancelable:true,touches:[],targetTouches:[],changedTouches:[moved]
    }));
  });
  expect(await order(page)).toEqual(['link-b','image-a','image-c','video-d']);
  expect(await page.evaluate(()=>v6Project().library.length)).toBe(4);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem(STORAGE_KEY)).projects[0].library[0].id)).toBe('link-b');
});
