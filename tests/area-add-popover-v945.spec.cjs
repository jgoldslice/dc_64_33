const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';
async function research(page,width=1366,height=1024){
  await page.setViewportSize({width,height});
  await page.goto(base);
  await page.locator('.bottom-nav button[data-tab="myplan"]').click();
  await page.locator('#bpAreasRoot [data-bpa-open="Research"]').click();
  await expect(page.locator('.bp-area-detail-title h1')).toHaveText('Research');
}
test('iPad Add opens an anchored non-reflowing popover with four choices',async({page})=>{
  await research(page);
  const cards=page.locator('.bp-area-sections');
  const before=await cards.boundingBox();
  const add=page.locator('.bp-area-detail-title [data-bpa-add-toggle]');
  await add.click();
  const pop=page.getByRole('dialog',{name:'Add to Research'});
  await expect(pop).toBeVisible();
  await expect(add).toHaveAttribute('aria-expanded','true');
  await expect(pop.locator('[data-bpa-add-kind]')).toHaveCount(4);
  await expect(pop.locator('.bp-area-create-copy strong')).toHaveText(['Task','Habit','Goal','Project']);
  await expect(page.locator('.bp-area-add-menu')).toHaveCount(0);
  const after=await cards.boundingBox();
  expect(Math.abs(after.y-before.y)).toBeLessThan(1);
  expect(Math.abs(after.height-before.height)).toBeLessThan(1);
  const menuRect=await pop.boundingBox(),buttonRect=await add.boundingBox();
  expect(menuRect.x+menuRect.width).toBeLessThanOrEqual(1366);
  expect(menuRect.y).toBeGreaterThanOrEqual(0);
  expect(menuRect.y+menuRect.height).toBeLessThanOrEqual(1024);
  expect(menuRect.x+menuRect.width).toBeGreaterThan(buttonRect.x);
});
test('Escape, close button, and outside click dismiss without changing Area contents',async({page})=>{
  await research(page);
  const add=page.locator('.bp-area-detail-title [data-bpa-add-toggle]');
  const pop=page.getByRole('dialog',{name:'Add to Research'});
  const goals=await page.locator('.bp-area-goal').count();
  await add.click();
  await page.keyboard.press('Escape');
  await expect(pop).toHaveCount(0);
  await expect(add).toHaveAttribute('aria-expanded','false');
  await expect(add).toBeFocused();
  await add.click();
  await pop.getByRole('button',{name:'Close Add menu'}).click();
  await expect(pop).toHaveCount(0);
  await add.click();
  await page.mouse.click(4,4);
  await expect(pop).toHaveCount(0);
  expect(await page.locator('.bp-area-goal').count()).toBe(goals);
});
test('Popover keeps keyboard focus inside and selecting Task preserves Area default',async({page})=>{
  await research(page);
  await page.locator('.bp-area-detail-title [data-bpa-add-toggle]').click();
  const pop=page.getByRole('dialog',{name:'Add to Research'});
  await expect(pop.locator('[data-bpa-add-kind="task"]')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(pop.locator('[data-bpa-add-close]')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(pop.locator('[data-bpa-add-kind="project"]')).toBeFocused();
  await pop.locator('[data-bpa-add-kind="task"]').click();
  await expect(pop).toHaveCount(0);
  await expect(page.locator('#modalBack')).toHaveClass(/open/);
  await expect(page.locator('#modalFields select[name="area"]')).toHaveValue('Research');
});
test('Habit and Goal choices reuse existing forms without spawning inline panels',async({page})=>{
  await research(page);
  for(const [type,selector,expected] of [
    ['habit','select[name="area"]','Research'],
    ['goal','select[name="category"]','Research']
  ]){
    await page.locator('.bp-area-detail-title [data-bpa-add-toggle]').click();
    await page.locator('[data-bpa-add-kind="'+type+'"]').click();
    await expect(page.locator('#modalFields '+selector)).toHaveValue(expected);
    await page.locator('#modalFields [name="title"]').fill('QA '+type+' creation');
    await page.locator('#modalForm button[type="submit"]').click();
    await expect(page.locator('.bp-area-create-popover')).toHaveCount(0);
  }
  await expect(page.locator('.bp-area-section-head h3')).toContainText(['Goals','Habits']);
});
test('On iPhone the Add popover fits as bottom sheet without hiding actions',async({page})=>{
  await research(page,390,844);
  const before=await page.locator('.bp-area-sections').boundingBox();
  await page.locator('.bp-area-detail-title [data-bpa-add-toggle]').click();
  const pop=page.getByRole('dialog',{name:'Add to Research'});
  await expect(pop).toBeVisible();
  const rect=await pop.boundingBox(),after=await page.locator('.bp-area-sections').boundingBox();
  expect(rect.x).toBeGreaterThanOrEqual(0);
  expect(rect.x+rect.width).toBeLessThanOrEqual(390);
  expect(rect.y+rect.height).toBeLessThanOrEqual(844);
  expect(Math.abs(after.y-before.y)).toBeLessThan(1);
  for(const kind of ['task','habit','goal','project'])await expect(pop.locator('[data-bpa-add-kind="'+kind+'"]')).toBeVisible();
});
test('Reduce Motion removes the opening animation',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await research(page,768,1024);
  await page.locator('.bp-area-detail-title [data-bpa-add-toggle]').click();
  await expect(page.locator('.bp-area-create-popover')).toHaveCSS('animation-name','none');
});
