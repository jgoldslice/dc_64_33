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


test('Six-dot grip resizes a text box, hold-and-drag moves it, and both values persist', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(baseURL);
  await page.locator('[data-tab="brainstorm"]').click();
  page.once('dialog', d => d.accept('Resize Test'));
  await page.locator('#newProject').click();
  const box = page.locator('#v76Surface .v76-text').first();
  await expect(box).toBeVisible();
  const metrics = async () => box.evaluate(el => ({
    left: parseFloat(el.style.left), top: parseFloat(el.style.top), width: parseFloat(el.style.width)
  }));
  const before = await metrics();
  const grip = await box.locator('.v76-grip').boundingBox();
  await page.mouse.move(grip.x + grip.width/2, grip.y + grip.height/2);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width/2 - 72, grip.y + grip.height/2, { steps: 6 });
  await page.mouse.up();
  const shrunk = await metrics();
  expect(shrunk.width).toBeLessThan(before.width - 40);
  expect(shrunk.left).toBeCloseTo(before.left, 0);
  const rich = box.locator('.v76-rich');
  await rich.fill('Moving should not change the width');
  const rect = await rich.boundingBox();
  const x = rect.x + Math.min(45,rect.width/2), y = rect.y + 13;
  await page.mouse.move(x,y);
  await page.mouse.down();
  await page.waitForTimeout(560);
  await page.mouse.move(x+40,y+20,{steps:8});
  await page.mouse.up();
  const moved = await metrics();
  expect(moved.left).toBeGreaterThan(shrunk.left+20);
  expect(moved.width).toBeCloseTo(shrunk.width,0);
  await page.reload();
  await page.locator('[data-tab="brainstorm"]').click();
  await page.locator('[data-v6-project]').filter({hasText:'Resize Test'}).click();
  const persisted = await metrics();
  expect(persisted.left).toBeCloseTo(moved.left,0);
  expect(persisted.width).toBeCloseTo(moved.width,0);
  expect(errors).toEqual([]);
});

test('Images use the same grip for resizing and long-press to move; page controls are clear', async ({ page }) => {
  await page.goto(baseURL);
  await page.locator('[data-tab="brainstorm"]').click();
  page.once('dialog', d => d.accept('Photo Test'));
  await page.locator('#newProject').click();
  await page.locator('#v76PageMore').click();
  await expect(page.locator('#v76PageMenu')).toBeVisible();
  await expect(page.locator('#v76RenamePage')).toHaveText('Rename page');
  await expect(page.locator('#v76DeletePage')).toHaveText('Delete page');
  await page.locator('#v76PageMore').click();
  const imgBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP+ZJRdGAAAAABJRU5ErkJggg==','base64');
  await page.locator('#v76ImageInput').setInputFiles({name:'test.png',mimeType:'image/png',buffer:imgBytes});
  const box = page.locator('#v76Surface .v76-image').first();
  await expect(box).toBeVisible();
  await expect(box.locator('.v76-size-tools')).toHaveCount(0);
  const width = async () => box.evaluate(el=>parseFloat(el.style.width));
  const initial = await width();
  const grip = await box.locator('.v76-grip').boundingBox();
  await page.mouse.move(grip.x+8,grip.y+9);
  await page.mouse.down();
  await page.mouse.move(grip.x-48,grip.y+9,{steps:5});
  await page.mouse.up();
  const resized = await width();
  expect(resized).toBeLessThan(initial-25);
  const beforeX = await box.evaluate(el=>parseFloat(el.style.left));
  const pic = await box.locator('.v76-photo').boundingBox();
  const x = pic.x+Math.min(50,pic.width/2), y=pic.y+Math.min(30,pic.height/2);
  await page.mouse.move(x,y);await page.mouse.down();
  await page.waitForTimeout(540);
  await page.mouse.move(x+36,y+22,{steps:5});await page.mouse.up();
  const afterX = await box.evaluate(el=>parseFloat(el.style.left));
  expect(afterX).toBeGreaterThan(beforeX+15);
  expect(await width()).toBeCloseTo(resized,0);
});
