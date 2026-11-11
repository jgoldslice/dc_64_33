const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';
test.use({browserName:'chromium',viewport:{width:390,height:844},isMobile:true,hasTouch:true});

async function openNotebook(page,name='Textbox Tool Test'){
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  await page.locator('[data-tab="brainstorm"]').click();
  page.once('dialog',d=>d.accept(name));
  await page.locator('#newProject').click();
  await page.locator('[data-v919-project-open="notes"]').click();
  await expect(page.locator('#v76Editor')).toBeVisible();
  return errors;
}

test('empty-paper taps in Select mode do not add text or show the typing keyboard',async({page})=>{
  const errors=await openNotebook(page);
  const boxes=page.locator('#v76Surface .v76-text');
  const initial=await boxes.count();
  const existing=boxes.first().locator('.v76-rich');
  await existing.click({position:{x:32,y:12}});
  await expect(boxes.first()).toHaveClass(/v811-selected/);
  await existing.click({position:{x:32,y:12}});
  await expect(existing).toHaveAttribute('contenteditable','true');
  await existing.fill('Notes stay where I put them');
  await page.locator('#v76Surface').click({position:{x:65,y:310}});
  await expect(boxes).toHaveCount(initial);
  await expect(boxes.first()).not.toHaveClass(/v811-selected/);
  expect(await page.evaluate(()=>document.activeElement?.classList.contains('v76-rich'))).toBe(false);
  await page.locator('#v76Surface').click({position:{x:90,y:370}});
  await expect(boxes).toHaveCount(initial);
  expect(errors).toEqual([]);
});

test('Textbox button is a one-shot insertion tool; its new text is editable, next blank tap does nothing',async({page})=>{
  const errors=await openNotebook(page);
  const tool=page.locator('[data-v76-mode="text"]');
  const boxes=page.locator('#v76Surface .v76-text');
  const original=await boxes.count();
  await expect(tool).toHaveAttribute('aria-pressed','false');
  await tool.click();
  await expect(tool).toHaveAttribute('aria-pressed','true');
  await expect(tool.locator('svg')).toBeVisible();
  await page.locator('#v76Surface').click({position:{x:80,y:290}});
  await expect(boxes).toHaveCount(original+1);
  await expect(tool).toHaveAttribute('aria-pressed','false');
  const rich=boxes.last().locator('.v76-rich');
  await expect(rich).toHaveAttribute('contenteditable','true');
  await rich.fill('A deliberate note');
  await page.locator('#v76Surface').click({position:{x:80,y:420}});
  await expect(boxes).toHaveCount(original+1);
  expect(await page.evaluate(()=>document.activeElement?.classList.contains('v76-rich'))).toBe(false);
  await page.reload();
  await page.locator('[data-tab="brainstorm"]').click();
  await page.locator('[data-v6-project]').filter({hasText:'Textbox Tool Test'}).click();
  await page.locator('[data-v919-project-open="notes"]').click();
  await expect(page.locator('[data-v76-mode="text"]')).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('#v76Surface .v76-rich').filter({hasText:'A deliberate note'})).toBeVisible();
  expect(errors).toEqual([]);
});

test('tapping existing text or picture with Textbox armed never creates a duplicate',async({page})=>{
  await openNotebook(page);
  const boxes=page.locator('#v76Surface .v76-text');
  const original=await boxes.count();
  const tool=page.locator('[data-v76-mode="text"]');
  await tool.click();
  await boxes.first().locator('.v76-rich').click({position:{x:30,y:12}});
  await expect(boxes).toHaveCount(original);
  await expect(tool).toHaveAttribute('aria-pressed','true');
  // The picture is added using the existing file attachment input.
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLytQAAAABJRU5ErkJggg==','base64');
  await page.locator('#v76ImageInput').setInputFiles({name:'sample.png',mimeType:'image/png',buffer:png});
  const picture=page.locator('#v76Surface .v76-image').first();
  await expect(picture).toBeVisible();
  const beforePhotoTap=await boxes.count();
  // Inserting an image doesn't change the explicitly armed Textbox tool.
  await expect(tool).toHaveAttribute('aria-pressed','true');
  await picture.locator('.v76-photo').click();
  await expect(picture).toHaveClass(/v811-selected/);
  await expect(boxes).toHaveCount(beforePhotoTap);
  await tool.click();
  await expect(tool).toHaveAttribute('aria-pressed','false');
});

test('bullet-list formatting and text size without an active editor never insert an implicit textbox',async({page})=>{
  await openNotebook(page);
  const boxes=page.locator('#v76Surface .v76-text');
  const before=await boxes.count();
  await page.locator('[data-v76-format="insertUnorderedList"]').click();
  await expect(boxes).toHaveCount(before);
  await page.locator('#v80TextSize').selectOption('large');
  await expect(boxes).toHaveCount(before);
  await page.locator('#v76Surface').click({position:{x:88,y:350}});
  await expect(boxes).toHaveCount(before);
});

test('pen and eraser still work as distinct modes and do not trigger textbox insertion',async({page})=>{
  await openNotebook(page);
  const boxes=page.locator('#v76Surface .v76-text');
  const initial=await boxes.count();
  const pen=page.locator('[data-v76-mode="pen"]');
  await pen.click();
  await expect(pen).toHaveAttribute('aria-pressed','true');
  await page.locator('#v76Ink').click({position:{x:100,y:300}});
  await expect(boxes).toHaveCount(initial);
  const eraser=page.locator('[data-v76-mode="erase"]');
  await eraser.click();
  await expect(eraser).toHaveAttribute('aria-pressed','true');
  await page.locator('#v76Ink').click({position:{x:180,y:380}});
  await expect(boxes).toHaveCount(initial);
  await eraser.click();
  await expect(eraser).toHaveAttribute('aria-pressed','false');
});

test('iPad wide notebook obeys the same explicit Textbox behavior beside its pages rail',async({page})=>{
  await page.setViewportSize({width:1366,height:1024});
  await openNotebook(page,'Tablet Textbox');
  await expect(page.locator('.v811-page-rail')).toBeVisible();
  const boxes=page.locator('#v76Surface .v76-text');
  const initial=await boxes.count();
  await page.locator('#v76Surface').click({position:{x:45,y:270}});
  await expect(boxes).toHaveCount(initial);
  await page.locator('[data-v76-mode="text"]').click();
  await page.locator('#v76Surface').click({position:{x:48,y:270}});
  await expect(boxes).toHaveCount(initial+1);
  await expect(page.locator('[data-v76-mode="text"]')).toHaveAttribute('aria-pressed','false');
  await page.locator('#v76Surface').click({position:{x:150,y:460}});
  await expect(boxes).toHaveCount(initial+1);
});
