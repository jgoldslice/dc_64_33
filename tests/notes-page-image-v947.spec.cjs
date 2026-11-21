'use strict';
const {test,expect}=require('@playwright/test');
const {submitSheet}=require('./sheet-helper.cjs');
const base='http://127.0.0.1:8765/';
test.use({browserName:'chromium',viewport:{width:1180,height:800},isMobile:true,hasTouch:true});

async function openNotes(page){
  await page.goto(base);
  await page.locator('[data-tab="brainstorm"]').click();
  await page.locator('#newProject').click();
  await submitSheet(page,'Page Export Regression');
  await page.locator('[data-v919-project-open="notes"]').click();
  await expect(page.locator('#v76Editor')).toBeVisible();
}

test('Textbox A opens exactly one in-app size selector without an iOS select picker',async({page})=>{
  await openNotes(page);
  const trigger=page.locator('#v938TextSizeTrigger');
  await expect(trigger).toHaveText('A');
  await trigger.click();
  await expect(page.locator('#v938TextSizeMenu')).toBeVisible();
  await expect(page.locator('#v80TextSize')).toBeHidden();
  await expect(page.locator('.v938-text-size-choices button')).toHaveCount(3);
  await page.locator('[data-v938-size="large"]').click();
  await expect(page.locator('#v938TextSizeMenu')).toBeHidden();
  await expect(page.locator('#v80TextSize')).toHaveValue('large');
  expect(await page.evaluate(()=>window.BlueprintNotesBridge.current().page.defaultTextSize)).toBe('large');
  // The T half of the split control still has its original drawing-mode action.
  await page.locator('.v812-textbox-button').click();
  await expect(page.locator('.v812-textbox-button')).toHaveAttribute('aria-pressed','true');
});

test('Pages options float outside the scroll rail, stay within the viewport, and include image save',async({page})=>{
  await openNotes(page);
  await page.locator('#v811PageList .v811-page-rename').click();
  const menu=page.locator('body > #v76PageMenu');
  await expect(menu).toBeVisible();
  await expect(menu.locator('#v947SavePageImage')).toHaveText('Save image to Library');
  const position=await menu.evaluate(el=>{
    const r=el.getBoundingClientRect();
    return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,
      width:innerWidth,height:innerHeight,parent:el.parentElement.tagName};
  });
  expect(position.parent).toBe('BODY');
  expect(position.left).toBeGreaterThanOrEqual(0);
  expect(position.top).toBeGreaterThanOrEqual(0);
  expect(position.right).toBeLessThanOrEqual(position.width+1);
  expect(position.bottom).toBeLessThanOrEqual(position.height+1);
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
});

test('Save image to Library stores a real PNG without changing editable notes or web ink',async({page})=>{
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await openNotes(page);
  await page.evaluate(()=>{
    const api=window.BlueprintNotesBridge,ctx=api.current();
    ctx.page.strokes=[{id:'export-ink',color:'#d73537',width:3,
      points:[{x:100,y:120},{x:150,y:140},{x:195,y:175}]}];
    ctx.page.objects[0].html='Export this page';
    api.persist();
    document.querySelector('#v76Surface .v76-rich').textContent='Export this page';
    api.strokesView(ctx.page);
  });
  const before=await page.evaluate(()=>JSON.stringify(window.BlueprintNotesBridge.current().page));
  await page.locator('#v811PageList .v811-page-rename').click();
  await page.locator('#v947SavePageImage').click();
  await expect.poll(async()=>page.evaluate(()=>v6Project().library.filter(r=>
    r.type==='file'&&r.mime==='image/png').length)).toBe(1);
  const stored=await page.evaluate(async()=>{
    const project=v6Project(),record=project.library.find(r=>r.type==='file'&&r.mime==='image/png');
    const blob=await v6Blob('get',record.key);
    const signature=[...new Uint8Array(await blob.slice(0,8).arrayBuffer())];
    return {title:record.title,bytes:blob.size,signature,mime:blob.type};
  });
  expect(stored.title).toContain('Page 1');
  expect(stored.bytes).toBeGreaterThan(250);
  expect(stored.signature).toEqual([137,80,78,71,13,10,26,10]);
  expect(await page.evaluate(()=>JSON.stringify(window.BlueprintNotesBridge.current().page)))
    .toBe(before);
  expect(errors).toEqual([]);
});
