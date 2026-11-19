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
