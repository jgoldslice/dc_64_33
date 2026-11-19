const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';
test('Plan has no redundant page-level titles or subtitles, with compact tab spacing',async({page})=>{
  await page.goto(base);
  await page.locator('.bottom-nav [data-tab="myplan"]').click();
  await expect(page.locator('#myplan .plan-tabs')).toBeVisible();
  await expect(page.locator('#overview .bp-areas-header h1,#overview .bp-areas-header .eyebrow')).toHaveCount(0);
  await expect(page.locator('#overview [data-bpa-new]')).toBeVisible();
  await expect(page.locator('#overview .bp-area-grid .bp-area-tile').first()).toBeVisible();
  const margin=await page.locator('#myplan > .plan-tabs').evaluate(el=>getComputedStyle(el).marginBottom);
  expect(margin).toBe('8px');
  await page.locator('#myplan > .plan-tabs [data-plan-tab="tasks"]').click();
  await expect(page.locator('#tasks .plan-toolbar')).toHaveText('+ Task');
  await expect(page.locator('#tasks .card h2')).toHaveText(['Priority Order','All Tasks']);
  await page.locator('#myplan > .plan-tabs [data-plan-tab="habits"]').click();
  await expect(page.locator('#habits .plan-toolbar')).toHaveText('+ Habit');
  await expect(page.locator('#habits .card h2')).toContainText(['Weekly Tracker','Manage Habits']);
  await page.locator('#myplan > .plan-tabs [data-plan-tab="goals"]').click();
  await expect(page.locator('#goals .plan-toolbar')).toHaveText('+ Goal');
});
test('New Plan simplification does not modify saved goal or task text',async({page})=>{
  await page.goto(base);
  await page.locator('.bottom-nav [data-tab="myplan"]').click();
  await page.locator('#myplan > .plan-tabs [data-plan-tab="tasks"]').click();
  await expect(page.locator('#tasksPriority')).toBeVisible();
  await expect(page.locator('#allTasks')).toBeVisible();
  await page.locator('#myplan > .plan-tabs [data-plan-tab="goals"]').click();
  await expect(page.locator('#goalsList')).toBeVisible();
});
