const { test, expect } = require('@playwright/test');
const baseURL = 'http://127.0.0.1:8765/';

test.use({ browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test('Today has only the four requested sections', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(baseURL);
  await expect(page.locator('#today')).toBeVisible();
  const headings = await page.locator('#today > .stack > section:visible > .card-heading h2').allTextContents();
  expect(headings.map(s => s.trim().replace(/\s+/g, ' '))).toEqual([
    'Today at a Glance', 'Habits', 'Top Priorities', 'Projects'
  ]);
  await expect(page.locator('#v77TodayPriorities')).toBeVisible();
  await expect(page.locator('#v77TodayProjects')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Goals emphasize their name and reveal contextual Task/Habit options', async ({ page }) => {
  page.on('dialog', d => d.dismiss());
  await page.goto(baseURL);
  await page.locator('[data-tab="myplan"]').click();
  await page.locator('[data-plan-tab="goals"]').click();
  const card = page.locator('#goalsList .v77-goal-card').first();
  await expect(card.locator('.v77-goal-heading h3')).toBeVisible();
  await expect(card.locator('.v77-goal-category')).toBeVisible();
  await card.locator('summary').click();
  const step = card.locator('[data-v77-step-action]').first();
  await expect(step).toBeVisible();
  await step.click();
  const menu = step.locator('xpath=following-sibling::*[contains(@class,"v77-step-menu")]');
  await expect(menu).toBeVisible();
  await expect(menu.locator('[data-action-to-task]')).toBeVisible();
  await expect(menu.locator('[data-action-to-habit]')).toBeVisible();
});

test('Project shortcuts open the workspace and note pages persist after refresh', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(baseURL);
  await page.locator('[data-tab="brainstorm"]').click();
  page.once('dialog', d => d.accept('Smoke Project'));
  await page.locator('#newProject').click();
  await expect(page.locator('#projectWorkspace')).toBeVisible();
  await expect(page.locator('#v76Editor')).toBeVisible();
  await expect(page.locator('[data-project-tab="actions"]')).toHaveText('To-Do');
  await expect(page.locator('[data-project-tab="sketch"]')).toBeHidden();
  await expect(page.locator('#v76PageSelect option')).toHaveCount(1);
  page.once('dialog', d => d.accept('Ideas'));
  await page.locator('#v76NewPage').click();
  await expect(page.locator('#v76PageSelect option')).toHaveCount(2);
  await page.locator('#v76Surface').click({ position: { x: 35, y: 175 } });
  const latestText = page.locator('.v76-rich').last();
  await latestText.fill('Draft sketch concept');
  await expect(latestText).toHaveText('Draft sketch concept');
  await page.locator('[data-tab="today"]').click();
  await expect(page.locator('[data-v77-open-project]').filter({ hasText: 'Smoke Project' })).toBeVisible();
  await page.locator('[data-v77-open-project]').filter({ hasText: 'Smoke Project' }).click();
  await expect(page.locator('#projectWorkspace')).toBeVisible();
  await page.reload();
  await page.locator('[data-tab="brainstorm"]').click();
  await page.locator('[data-v6-project]').filter({ hasText: 'Smoke Project' }).click();
  await expect(page.locator('#v76PageSelect option')).toHaveCount(2);
  await expect(page.locator('.v76-rich').filter({ hasText: 'Draft sketch concept' })).toBeVisible();
  expect(errors).toEqual([]);
});


test('Tap selects note text; left and right resize handles work, move control repositions, data persists', async ({ page }) => {
  const errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));
  await page.goto(baseURL);
  await page.locator('[data-tab="brainstorm"]').click();
  page.once('dialog',d=>d.accept('Resize Test'));
  await page.locator('#newProject').click();
  const box=page.locator('#v76Surface .v76-text').first();
  await expect(box).toBeVisible();
  await expect(box.locator('.v76-grip')).toHaveCount(0);
  const rich=box.locator('.v76-rich');
  await rich.click();
  await expect(box).toHaveClass(/v811-selected/);
  await expect(box.locator('.v811-resize-handle')).toHaveCount(8);
  const metrics=()=>box.evaluate(el=>({
    left:parseFloat(el.style.left),top:parseFloat(el.style.top),
    width:parseFloat(el.style.width),height:el.offsetHeight
  }));
  const drag=async (selector,dx,dy=0)=>{
    const rect=await box.locator(selector).boundingBox();
    const x=rect.x+rect.width/2,y=rect.y+rect.height/2;
    await page.mouse.move(x,y);await page.mouse.down();
    await page.mouse.move(x+dx,y+dy,{steps:8});await page.mouse.up();
  };
  const before=await metrics();
  // With the new page sidebar, the starting text box can nearly fill the
  // remaining paper. Contract first; expanding back then has room to work.
  await drag('.v811-handle-e',-70);
  const shrunkRight=await metrics();
  expect(shrunkRight.width).toBeLessThan(before.width-35);
  await drag('.v811-handle-e',55);
  const wide=await metrics();
  expect(wide.width).toBeGreaterThan(shrunkRight.width+35);
  await drag('.v811-handle-w',40);
  const narrow=await metrics();
  expect(narrow.width).toBeLessThan(wide.width-20);
  expect(narrow.left).toBeGreaterThan(wide.left+20);
  // This narrow paper is right-edge constrained after resizing; moving
  // downward still exercises the same pointer-captured move path.
  await drag('.v811-move-control',0,40);
  const moved=await metrics();
  expect(moved.top).toBeGreaterThan(narrow.top+20);
  expect(moved.width).toBeCloseTo(narrow.width,0);
  await rich.click({position:{x:34,y:13}});
  await expect(rich).toHaveAttribute('contenteditable','true');
  await rich.fill('Moving should not lose my note');
  await page.reload();
  await page.locator('[data-tab="brainstorm"]').click();
  await page.locator('[data-v6-project]').filter({hasText:'Resize Test'}).click();
  const persisted=await metrics();
  expect(persisted.left).toBeCloseTo(moved.left,0);
  expect(persisted.width).toBeCloseTo(moved.width,0);
  await expect(box.locator('.v76-rich')).toHaveText('Moving should not lose my note');
  expect(errors).toEqual([]);
});

test('Pictures use OneNote-style selection, corner resizing and a move control instead of six dots', async ({ page }) => {
  await page.goto(baseURL);
  await page.locator('[data-tab="brainstorm"]').click();
  page.once('dialog',d=>d.accept('Photo Test'));
  await page.locator('#newProject').click();
  await page.locator('#v76PageMore').click();
  await expect(page.locator('#v76PageMenu')).toBeVisible();
  await expect(page.locator('#v76RenamePage')).toHaveText('Rename page');
  await expect(page.locator('#v76DeletePage')).toHaveText('Delete page');
  await page.locator('#v76PageMore').click();
  const imgBytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP+ZJRdGAAAAABJRU5ErkJggg==','base64');
  await page.locator('#v76ImageInput').setInputFiles({name:'test.png',mimeType:'image/png',buffer:imgBytes});
  const box=page.locator('#v76Surface .v76-image').first();
  await expect(box).toBeVisible();
  await expect(box.locator('.v76-grip')).toHaveCount(0);
  await box.locator('.v76-photo').click();
  await expect(box).toHaveClass(/v811-selected/);
  const rect=await box.locator('.v811-handle-se').boundingBox();
  const initial=await box.evaluate(el=>({w:el.offsetWidth,h:el.offsetHeight}));
  await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);
  await page.mouse.down();await page.mouse.move(rect.x+rect.width/2+55,rect.y+rect.height/2+48,{steps:6});
  await page.mouse.up();
  const bigger=await box.evaluate(el=>({w:el.offsetWidth,h:el.offsetHeight}));
  expect(bigger.w).toBeGreaterThan(initial.w+25);
  expect(bigger.h).toBeGreaterThan(initial.h+25);
  const beforeY=await box.evaluate(el=>parseFloat(el.style.top));
  const move=await box.locator('.v811-move-control').boundingBox();
  await page.mouse.move(move.x+move.width/2,move.y+move.height/2);await page.mouse.down();
  // The wider photo is right-edge constrained. Move it vertically instead.
  await page.mouse.move(move.x+move.width/2,move.y+move.height/2+40,{steps:6});await page.mouse.up();
  const afterY=await box.evaluate(el=>parseFloat(el.style.top));
  expect(afterY).toBeGreaterThan(beforeY+20);
  expect(await box.evaluate(el=>el.offsetWidth)).toBeCloseTo(bigger.w,0);
});

test('Notes have only Text, Pen and Misc tool groups, with tap-to-type', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(baseURL);
  await page.locator('[data-tab="brainstorm"]').click();
  page.once('dialog', d => d.accept('Minimal Toolbar Test'));
  await page.locator('#newProject').click();
  const toolbar = page.locator('#v76Editor .v76-toolbar');
  // v8.10 uses a compact icon-only toolbar but preserves the accessible groups.
  await expect(toolbar.locator('.v79-tool-title')).toHaveCount(0);
  await expect(toolbar.locator('.v79-tool-group[aria-label="Text"]')).toHaveCount(1);
  await expect(toolbar.locator('.v79-tool-group[aria-label="Pen"]')).toHaveCount(1);
  await expect(toolbar.locator('.v79-tool-group[aria-label="Misc"]')).toHaveCount(1);
  await expect(toolbar.locator('button')).toHaveCount(5);
  await expect(toolbar.locator('[data-v76-format="bold"],[data-v76-format="italic"],[data-v76-mode="text"],[data-v76-mode="select"]')).toHaveCount(0);
  await expect(toolbar.locator('[data-v76-format="insertUnorderedList"]')).toBeVisible();
  await expect(toolbar.locator('[data-v76-mode="pen"]')).toBeVisible();
  await expect(toolbar.locator('[data-v76-mode="erase"]')).toBeVisible();
  await expect(toolbar.locator('#v76UndoInk')).toBeVisible();
  await expect(toolbar.locator('#v76AddImage')).toBeVisible();
  const before = await page.locator('#v76Surface .v76-text').count();
  await page.locator('#v76Surface').click({ position: { x: 35, y: 200 } });
  await expect(page.locator('#v76Surface .v76-text')).toHaveCount(before+1);
  const lastText = page.locator('#v76Surface .v76-rich').last();
  await lastText.fill('A new text box appeared');
  await expect(lastText).toHaveText('A new text box appeared');
  const pen=toolbar.locator('[data-v76-mode="pen"]');
  await pen.click();
  await expect(pen).toHaveAttribute('aria-pressed','true');
  await pen.click();
  await expect(pen).toHaveAttribute('aria-pressed','false');
  const eraser=toolbar.locator('[data-v76-mode="erase"]');
  await eraser.click();
  await expect(eraser).toHaveAttribute('aria-pressed','true');
  await eraser.click();
  await expect(eraser).toHaveAttribute('aria-pressed','false');
  expect(errors).toEqual([]);
});

test('Text stays transparent over images and size choices persist independently', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e=>errors.push(e.message));
  await page.goto(baseURL);
  await page.locator('[data-tab="brainstorm"]').click();
  page.once('dialog', d=>d.accept('Transparency Test'));
  await page.locator('#newProject').click();
  const text=page.locator('#v76Surface .v76-text').first();
  await expect(text).toBeVisible();
  const rich=text.locator('.v76-rich');
  await rich.click({position:{x:34,y:13}});await rich.click({position:{x:34,y:13}});
  await expect(rich).toHaveAttribute('contenteditable','true');
  await rich.fill('This text should float over a picture');
  const size=page.locator('#v80TextSize');
  await expect(size).toHaveValue('medium');
  await size.selectOption('small');
  await expect(rich).toHaveAttribute('data-font-size','small');
  const savedText=await rich.textContent();
  await size.selectOption('large');
  await expect(rich).toHaveAttribute('data-font-size','large');
  const color=await text.evaluate(el=>({
    box:getComputedStyle(el).backgroundColor,
    rich:getComputedStyle(el.querySelector('.v76-rich')).backgroundColor,
    font:getComputedStyle(el.querySelector('.v76-rich')).fontSize
  }));
  expect(color.box).toBe('rgba(0, 0, 0, 0)');
  expect(color.rich).toBe('rgba(0, 0, 0, 0)');
  expect(parseFloat(color.font)).toBeGreaterThan(20);
  expect(await rich.textContent()).toBe(savedText);
  await page.reload();
  await page.locator('[data-tab="brainstorm"]').click();
  await page.locator('[data-v6-project]').filter({hasText:'Transparency Test'}).click();
  await expect(page.locator('#v76Surface .v76-text .v76-rich').first()).toHaveAttribute('data-font-size','large');
  await expect(page.locator('#v76Surface .v76-text .v76-rich').first()).toHaveText(savedText);
  expect(errors).toEqual([]);
});



test('Notebook touchstart cancels the native long-press selection gesture', async ({page}) => {
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(baseURL);
  await page.locator('[data-tab="brainstorm"]').click();
  page.once('dialog',d=>d.accept('Touch Safety Test'));
  await page.locator('#newProject').click();
  const rich=page.locator('#v76Surface .v76-text .v76-rich').first();
  await rich.click({position:{x:34,y:13}});await rich.click({position:{x:34,y:13}});
  await expect(rich).toHaveAttribute('contenteditable','true');
  await rich.fill('iPhone selection protection');
  // Exit editing, then select to exercise the handles' touch-selection guard.
  await page.locator('#v76Surface').click({position:{x:15,y:590}});
  await rich.click();
  const rect=await rich.boundingBox();
  // Select the object first; its handles now suppress native selection,
  // whereas unselected text and blank-paper scrolling remain usable.
  await rich.click({position:{x:34,y:13}});
  const canceled=await page.evaluate(({x,y})=>{
    const target=document.elementFromPoint(x,y);
    const touch=new Touch({identifier:99,target,clientX:x,clientY:y});
    const event=new TouchEvent('touchstart',{bubbles:true,cancelable:true,touches:[touch],changedTouches:[touch],targetTouches:[touch]});
    target.dispatchEvent(event);return event.defaultPrevented;
  },{x:rect.x+30,y:rect.y+12});
  expect(canceled).toBe(true);
  expect(await page.evaluate(()=>window.getSelection()?.toString()||'')).toBe('');
  expect(errors).toEqual([]);
});
