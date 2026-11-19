const {test,expect}=require('@playwright/test');
const {submitSheet}=require('./sheet-helper.cjs');
for(const width of [390,834]){
  test('project form retains interrupted text and keyboard focus at width '+width,async({page})=>{
    await page.setViewportSize({width,height:850});
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.goto('/');
    await page.locator('[data-tab="brainstorm"]').click();
    const button=page.locator('#newProject'),before=await button.boundingBox();
    await button.click();
    const name=page.getByLabel('Name',{exact:true});
    await expect(name).toBeFocused();
    await name.fill('Notebook');
    expect(await button.boundingBox()).toEqual(before);
    await page.keyboard.press('Escape');
    await expect(button).toBeFocused();
    await button.click();
    await expect(name).toHaveValue('Notebook');
    await submitSheet(page);
    await expect(page.locator('#projectTitle')).toHaveText('Notebook');
  });
}

test('holding another page opens its actions and leaves the selected page intact',async({page})=>{
  await page.setViewportSize({width:1024,height:820});
  await page.goto('/');
  await page.locator('[data-tab="brainstorm"]').click();
  await page.locator('#newProject').click();
  await submitSheet(page,'Pages');
  await page.locator('[data-v919-project-open="notes"]').click();
  await page.locator('#v811NewPage').click();
  const previous=page.locator('[data-v811-page-id]').first();
  const selected=await page.locator('#v76PageSelect').inputValue();
  await previous.dispatchEvent('pointerdown',{pointerType:'touch',isPrimary:true,pointerId:7,button:0});
  await expect(page.locator('#v76RenamePage')).toBeFocused();
  await previous.dispatchEvent('pointerup',{pointerType:'touch',isPrimary:true,pointerId:7});
  await previous.evaluate(el=>el.click());
  expect(await page.locator('#v76PageSelect').inputValue()).toBe(selected);
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#v76DeletePage')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#v76PageMenu')).toBeHidden();
});
