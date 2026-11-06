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
