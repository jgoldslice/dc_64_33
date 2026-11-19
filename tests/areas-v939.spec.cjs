const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';
async function makeArea(page,name='Work'){
  await page.goto(base);
  await page.locator('.bottom-nav button[data-tab="myplan"]').click();
  await expect(page.locator('#bpAreasRoot h1')).toHaveText('Areas');
  page.once('dialog',d=>d.accept(name));
  await page.locator('[data-bpa-new]').click();
  await expect(page.locator('.bp-area-detail-title h1')).toHaveText(name);
}
async function createItem(page,kind,title){
  await page.locator('[data-bpa-add-toggle]').click();
  await page.locator('[data-bpa-add-kind="'+kind+'"]').click();
  await page.locator('#modalFields [name="title"]').fill(title);
}
test('Area with only routine tasks and habits has neither Goal nor Project card',async({page})=>{
  await makeArea(page);
  await createItem(page,'task','Order laboratory supplies');
  await expect(page.locator('#modalFields select[name="area"]')).toHaveValue('Work');
  await page.locator('#modalForm button[type="submit"]').click();
  await createItem(page,'habit','Clean workbench');
  await expect(page.locator('#modalFields select[name="area"]')).toHaveValue('Work');
  await page.locator('#modalForm button[type="submit"]').click();
  await expect(page.locator('.bp-area-section-head h3')).toHaveText(['Tasks','Habits']);
  await expect(page.locator('.bp-area-section')).toHaveCount(2);
  await expect(page.locator('.bp-area-section [data-edit-task]')).toHaveText('Order laboratory supplies');
  await expect(page.locator('.bp-area-section [data-edit-habit]')).toHaveText('Clean workbench');
  await page.locator('[data-bpa-back]').click();
  await expect(page.locator('[data-bpa-open="Work"]')).toBeVisible();
});
test('Task linked to a Goal inherits its Area and appears under Goal rather than separate Tasks card',async({page})=>{
  await makeArea(page,'Research Lab');
  await createItem(page,'goal','Publish catalyst paper');
  await expect(page.locator('#modalFields select[name="category"]')).toHaveValue('Research Lab');
  await page.locator('#modalForm button[type="submit"]').click();
  await createItem(page,'task','Run GC analysis');
  await page.locator('#modalFields select[name="goalId"]').selectOption({label:'Publish catalyst paper'});
  await expect(page.locator('#modalFields select[name="area"]')).toBeDisabled();
  await page.locator('#modalForm button[type="submit"]').click();
  await expect(page.locator('.bp-area-section-head h3')).toHaveText(['Goals']);
  await page.locator('.bp-area-goal summary').click();
  await expect(page.locator('.bp-area-goal [data-edit-task]')).toHaveText('Run GC analysis');
  await page.reload();
  await page.locator('.bottom-nav button[data-tab="myplan"]').click();
  await page.locator('[data-bpa-open="Research Lab"]').click();
  await expect(page.locator('.bp-area-goal summary')).toContainText('Publish catalyst paper');
});
