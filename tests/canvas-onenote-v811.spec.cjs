const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';
test.use({browserName:'chromium',viewport:{width:1366,height:1024},isMobile:true,hasTouch:true});
async function notebook(page,title='OneNote Layout Test'){
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base);
  await page.locator('[data-tab="brainstorm"]').click();
  page.once('dialog',d=>d.accept(title));
  await page.locator('#newProject').click();
  await expect(page.locator('#v76Editor')).toBeVisible();
  return errors;
}
async function drag(page,locator,dx,dy){
  await locator.scrollIntoViewIfNeeded();
  const rect=await locator.boundingBox();
  if(!rect)throw Error('Missing drag control');
  const x=rect.x+rect.width/2,y=rect.y+rect.height/2;
  await page.mouse.move(x,y);await page.mouse.down();
  await page.mouse.move(x+dx,y+dy,{steps:9});await page.mouse.up();
}
function metric(page,item){
  return page.locator(item).evaluate(el=>({
    x:parseFloat(el.style.left),y:parseFloat(el.style.top),
    width:parseFloat(el.style.width),height:el.offsetHeight
  }));
}
test('iPad landscape shows named pages vertically to the left of the ruled notebook',async({page})=>{
  const errors=await notebook(page);
  const list=page.locator('#v811PageList');
  await expect(page.locator('.v811-page-rail')).toBeVisible();
  await expect(page.locator('#v76PageSelect')).toBeHidden();
  await expect(page.locator('#v811NewPage')).toBeVisible();
  await expect(list.locator('.v811-page-row')).toHaveCount(1);
  const bounds=await page.evaluate(()=>{
    const list=document.querySelector('.v811-page-rail').getBoundingClientRect();
    const paper=document.querySelector('#v76Surface').getBoundingClientRect();
    return {listRight:list.right,paperLeft:paper.left,listWidth:list.width,
      right:paper.right,viewport:innerWidth};
  });
  expect(bounds.listRight).toBeLessThan(bounds.paperLeft);
  expect(bounds.listWidth).toBeGreaterThan(130);
  expect(bounds.right).toBeLessThanOrEqual(bounds.viewport+2);
  expect(errors).toEqual([]);
});
test('page list can create, rename, switch and restore notes across reload',async({page})=>{
  const errors=await notebook(page,'Multiple Pages');
  const list=page.locator('#v811PageList');
  const original=await page.locator('#v76PageSelect').inputValue();
  await page.locator('#v811NewPage').click();
  await expect(list.locator('.v811-page-row')).toHaveCount(2);
  expect(await page.locator('#v76PageSelect').inputValue()).not.toBe(original);
  let active=await page.locator('#v76PageSelect').inputValue();
  let names=await list.locator('.v811-page-labels strong').allTextContents();
  expect(names).toEqual(['Page 1','Page 2']);
  await list.locator('[data-v811-rename-id="'+active+'"]').click();
  page.once('dialog',d=>d.accept('Ideas and Sketches'));
  await page.locator('#v76RenamePage').click();
  await expect(list.locator('.v811-page-labels strong').last()).toHaveText('Ideas and Sketches');
  // The new page starts with editable text, ready to type.
  const rich=page.locator('#v76Surface .v76-rich').first();
  await rich.click({position:{x:34,y:13}});await rich.click({position:{x:34,y:13}});
  await expect(rich).toHaveAttribute('contenteditable','true');
  await rich.fill('Diagram goes on this page');
  await list.locator('[data-v811-page-id="'+original+'"]').click();
  await expect(page.locator('#v76PageSelect')).toHaveValue(original);
  await expect(list.locator('.v811-current')).toContainText('Page 1');
  await list.locator('[data-v811-page-id="'+active+'"]').click();
  await expect(page.locator('#v76Surface .v76-rich').first()).toHaveText('Diagram goes on this page');
  await page.reload();
  await page.locator('[data-tab="brainstorm"]').click();
  await page.locator('[data-v6-project]').filter({hasText:'Multiple Pages'}).click();
  await expect(list.locator('.v811-page-row')).toHaveCount(2);
  await expect(list.locator('.v811-page-labels strong').last()).toHaveText('Ideas and Sketches');
  await expect(page.locator('#v76Surface .v76-rich').first()).toHaveText('Diagram goes on this page');
  expect(errors).toEqual([]);
});
test('compact multitasking window hides page rail but retains top page selector and saved content',async({page})=>{
  await notebook(page);
  await page.locator('#v811NewPage').click();
  await expect(page.locator('#v811PageList .v811-page-row')).toHaveCount(2);
  await page.setViewportSize({width:600,height:900});
  await expect(page.locator('.v811-page-rail')).toBeHidden();
  await expect(page.locator('#v76PageSelect')).toBeVisible();
  await expect(page.locator('#v76PageSelect option')).toHaveCount(2);
  await page.locator('#v76PageSelect').selectOption({label:'Page 1'});
  await expect(page.locator('#v76PageSelect')).toHaveValue(await page.evaluate(()=>v6Project().notePages[0].id));
  await page.setViewportSize({width:1366,height:1024});
  await expect(page.locator('.v811-page-rail')).toBeVisible();
  await expect(page.locator('#v811PageList .v811-current')).toContainText('Page 1');
});
test('selection outline has eight handles, move control, and edits text on a second tap',async({page})=>{
  await notebook(page);
  const box=page.locator('#v76Surface .v76-text').first();
  const rich=box.locator('.v76-rich');
  await expect(box.locator('.v76-grip')).toHaveCount(0);
  await rich.click();
  await expect(box).toHaveClass(/v811-selected/);
  await expect(box.locator('.v811-resize-handle')).toHaveCount(8);
  await expect(box.locator('.v811-move-control')).toBeVisible();
  await expect(box.locator('.v811-object-actions')).toBeVisible();
  await expect(rich).toHaveAttribute('contenteditable','false');
  await rich.click({position:{x:34,y:13}});
  await expect(rich).toHaveAttribute('contenteditable','true');
  await rich.fill('Type in the selected text box');
  await expect(rich).toHaveText('Type in the selected text box');
  await page.locator('#v76Surface').click({position:{x:10,y:550}});
  await expect(box).not.toHaveClass(/v811-selected/);
});
test('West, north, and southwest resize handles adjust position and dimension in both directions',async({page})=>{
  await notebook(page);
  const box=page.locator('#v76Surface .v76-text').first();
  await box.locator('.v76-rich').click();
  let m=await metric(page,'#v76Surface .v76-text:first-of-type');
  const before=await box.evaluate(el=>({
    x:parseFloat(el.style.left),y:parseFloat(el.style.top),
    w:parseFloat(el.style.width),h:el.offsetHeight
  }));
  await drag(page,box.locator('.v811-handle-e'),85,0);
  const east=await box.evaluate(el=>({w:parseFloat(el.style.width),x:parseFloat(el.style.left)}));
  expect(east.w).toBeGreaterThan(before.w+45);
  await drag(page,box.locator('.v811-handle-w'),38,0);
  const west=await box.evaluate(el=>({w:parseFloat(el.style.width),x:parseFloat(el.style.left)}));
  expect(west.w).toBeLessThan(east.w-20);
  expect(west.x).toBeGreaterThan(east.x+20);
  await drag(page,box.locator('.v811-handle-s'),0,55);
  const tall=await box.evaluate(el=>el.offsetHeight);
  expect(tall).toBeGreaterThan(before.h+35);
  await drag(page,box.locator('.v811-handle-n'),0,28);
  const top=await box.evaluate(el=>({y:parseFloat(el.style.top),h:el.offsetHeight}));
  expect(top.h).toBeLessThan(tall-15);
  expect(top.y).toBeGreaterThan(before.y+15);
});
test('selected object moves immediately without long-press, keeps width, and remains positioned after reload',async({page})=>{
  await notebook(page,'Move Test');
  const box=page.locator('#v76Surface .v76-text').first();
  await box.locator('.v76-rich').click();
  const before=await box.evaluate(el=>({x:parseFloat(el.style.left),y:parseFloat(el.style.top),w:parseFloat(el.style.width)}));
  await drag(page,box.locator('.v811-move-control'),45,35);
  const moved=await box.evaluate(el=>({x:parseFloat(el.style.left),y:parseFloat(el.style.top),w:parseFloat(el.style.width)}));
  expect(moved.x).toBeGreaterThan(before.x+20);
  expect(moved.y).toBeGreaterThan(before.y+20);
  expect(moved.w).toBe(before.w);
  await page.reload();
  await page.locator('[data-tab="brainstorm"]').click();
  await page.locator('[data-v6-project]').filter({hasText:'Move Test'}).click();
  const persisted=await box.evaluate(el=>({x:parseFloat(el.style.left),y:parseFloat(el.style.top)}));
  expect(persisted.x).toBeCloseTo(moved.x,0);
  expect(persisted.y).toBeCloseTo(moved.y,0);
});
test('photo is selectable and resizable vertically as well as horizontally without changing text or sketch objects',async({page})=>{
  await notebook(page);
  const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP+ZJRdGAAAAABJRU5ErkJggg==','base64');
  await page.locator('#v76ImageInput').setInputFiles({name:'photo.png',mimeType:'image/png',buffer:image});
  const box=page.locator('#v76Surface .v76-image').first();
  await expect(box).toBeVisible();
  await box.locator('img').click();
  await expect(box).toHaveClass(/v811-selected/);
  const before=await box.evaluate(el=>({w:el.offsetWidth,h:el.offsetHeight}));
  await drag(page,box.locator('.v811-handle-se'),50,70);
  const after=await box.evaluate(el=>({w:el.offsetWidth,h:el.offsetHeight}));
  expect(after.w).toBeGreaterThan(before.w+25);
  expect(after.h).toBeGreaterThan(before.h+25);
  const state=await page.evaluate(()=>({
    picture:v6Project().notePages[0].objects.find(o=>o.type==='image'),
    textCount:v6Project().notePages[0].objects.filter(o=>o.type==='text').length,
    inkCount:v6Project().notePages[0].strokes.length
  }));
  expect(state.picture.width).toBeGreaterThan(260);
  expect(state.picture.height).toBeGreaterThan(70);
  expect(state.textCount).toBeGreaterThanOrEqual(1);
  expect(state.inkCount).toBe(0);
});
