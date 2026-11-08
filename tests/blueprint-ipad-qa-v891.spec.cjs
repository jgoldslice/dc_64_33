const { test, expect } = require('@playwright/test');
const base = 'http://127.0.0.1:8765/';

test('iPad sidebar and notebook controls have 44px targets without resizing the whole page', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 834, height: 1194 });
  await page.goto(base);
  const toggle = page.locator('.canvas-ipad-collapse');
  await expect(toggle).toBeVisible();
  const first = await toggle.boundingBox();
  expect(first.width).toBeGreaterThanOrEqual(44);
  expect(first.height).toBeGreaterThanOrEqual(44);
  await toggle.click();
  const collapsed = await toggle.boundingBox();
  expect(collapsed.width).toBeGreaterThanOrEqual(44);
  expect(collapsed.height).toBeGreaterThanOrEqual(44);
  await toggle.click();

  await page.locator('[data-tab="brainstorm"]').click();
  page.once('dialog', dialog => dialog.accept('Blueprint iPad QA'));
  await page.locator('#newProject').click();
  await expect(page.locator('#v815ZoomViewport')).toBeVisible();
  await expect(page.locator('#projectNotes .v76-toolbar')).toHaveCSS('flex-wrap', 'wrap');
  const measurements = await page.evaluate(() => {
    const controls = Array.from(document.querySelectorAll('#projectNotes .v76-toolbar button, #projectNotes .v76-toolbar select'))
      .filter(el => el.getClientRects().length)
      .map(el => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height }));
    const paper = document.getElementById('v815ZoomViewport').getBoundingClientRect();
    return { controls, paperBottom: paper.bottom, windowHeight: innerHeight,
      pageScrollDisabled: getComputedStyle(document.body).overflowY === 'hidden' };
  });
  expect(measurements.controls.length).toBeGreaterThan(2);
  for (const control of measurements.controls) {
    expect(control.width).toBeGreaterThanOrEqual(44);
    expect(control.height).toBeGreaterThanOrEqual(44);
  }
  expect(measurements.pageScrollDisabled).toBe(true);
  expect(measurements.paperBottom).toBeLessThanOrEqual(measurements.windowHeight + 3);
  expect(errors).toEqual([]);
});

test('wide iPad keeps the Today schedule dominant and Week calendar to the right', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 1024 });
  await page.goto(base);
  const today = await page.evaluate(() => {
    const b = id => document.getElementById(id).closest('section.card').getBoundingClientRect();
    const schedule = b('todayGlance'), habits = b('todayHabits');
    const priorities = b('v77TodayPriorities'), projects = b('v77TodayProjects');
    return { schedule: { left: schedule.left, right: schedule.right },
      habits: { left: habits.left, right: habits.right },
      priorities: { left: priorities.left, right: priorities.right },
      projects: { left: projects.left, right: projects.right } };
  });
  expect(today.schedule.right).toBeLessThan(today.habits.left + 4);
  expect(today.schedule.right).toBeLessThan(today.priorities.left + 4);
  expect(today.projects.left).toBeLessThanOrEqual(today.schedule.left + 4);
  expect(today.projects.right).toBeGreaterThanOrEqual(today.habits.right - 4);

  await page.locator('[data-tab="week"]').click();
  const week = await page.locator('#week .week-v4').evaluate(el => getComputedStyle(el).gridTemplateAreas);
  expect(week).toContain('focus calendar');
  expect(week).toContain('habits calendar');
  expect(week).toContain('priorities calendar');

  await page.setViewportSize({ width: 834, height: 1194 });
  const portrait = await page.locator('#week .week-v4').evaluate(el => getComputedStyle(el).gridTemplateAreas);
  expect(portrait).toContain('"calendar"');
  expect(portrait).toContain('"habits"');
});

test('phone keeps compact nonwrapping notes toolbar and hidden iPad rail toggle', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base);
  await expect(page.locator('.canvas-ipad-collapse')).toBeHidden();
  await page.locator('[data-tab="brainstorm"]').click();
  page.once('dialog', dialog => dialog.accept('Blueprint phone QA'));
  await page.locator('#newProject').click();
  await expect(page.locator('#projectNotes .v76-toolbar')).toHaveCSS('flex-wrap', 'nowrap');
});
