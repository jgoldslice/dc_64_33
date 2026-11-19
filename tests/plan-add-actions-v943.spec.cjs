const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';
async function plan(page,width,height){
  await page.setViewportSize({width,height});
  await page.goto(base);
  await page.locator('.bottom-nav button[data-tab="myplan"]').click();
  await expect(page.locator('#myplan > .plan-tabs')).toBeVisible();
}
test('Tasks cards start immediately under tabs, with the only Add Task below both cards',async({page})=>{
  for(const [width,height] of [[1366,1024],[390,844]]){
    await plan(page,width,height);
    await page.locator('#myplan > .plan-tabs [data-plan-tab="tasks"]').click();
    const stack=page.locator('#tasks > .stack');
    const add=page.locator('#tasks > .plan-toolbar [data-open="task"]');
    await expect(add).toHaveCount(1);
    const layout=await page.evaluate(()=>{
      const tabs=document.querySelector('#myplan > .plan-tabs').getBoundingClientRect();
      const first=document.querySelector('#tasks > .stack > .card').getBoundingClientRect();
      const last=document.querySelector('#tasks > .stack > .card:last-child').getBoundingClientRect();
      const add=document.querySelector('#tasks > .plan-toolbar [data-open="task"]').getBoundingClientRect();
      return {tabGap:first.top-tabs.bottom,buttonAfterCards:add.top-last.bottom};
    });
    expect(layout.tabGap).toBeGreaterThanOrEqual(-2);
    expect(layout.tabGap).toBeLessThan(36);
    expect(layout.buttonAfterCards).toBeGreaterThanOrEqual(0);
    expect(layout.buttonAfterCards).toBeLessThan(40);
    await expect(stack.locator('.card h2')).toHaveText(['Priority Order','All Tasks']);
    await add.click();
    await expect(page.locator('#modalBack')).toHaveClass(/open/);
  }
});
test('Goals and Habits Add controls follow the content, without duplicate top action bars',async({page})=>{
  await plan(page,1366,1024);
  for(const [kind,panel,contentId] of [
    ['goal','goals','goalsList'],['habit','habits','habitManager']
  ]){
    await page.locator('#myplan > .plan-tabs [data-plan-tab="'+panel+'"]').click();
    await expect(page.locator('#'+panel+' > .plan-toolbar [data-open="'+kind+'"]')).toHaveCount(1);
    const order=await page.evaluate(({panel,contentId})=>{
      const content=document.querySelector('#'+contentId);
      const toolbar=document.querySelector('#'+panel+' > .plan-toolbar');
      return Boolean(content.compareDocumentPosition(toolbar)&Node.DOCUMENT_POSITION_FOLLOWING);
    },{panel,contentId});
    expect(order).toBeTruthy();
  }
});
test('Area add button follows Area cards and comes before weekly planning action',async({page})=>{
  await plan(page,1366,1024);
  const position=await page.evaluate(()=>{
    const cards=document.querySelector('#bpAreasRoot .bp-area-grid');
    const add=document.querySelector('#bpAreasRoot [data-bpa-new]');
    const week=document.querySelector('#overview [data-wb-launch]');
    const y=cards.getBoundingClientRect().bottom;
    return {
      afterCards:!!(cards.compareDocumentPosition(add)&Node.DOCUMENT_POSITION_FOLLOWING),
      beforeWeek:!!(add.compareDocumentPosition(week)&Node.DOCUMENT_POSITION_FOLLOWING),
      gap:add.getBoundingClientRect().top-y
    };
  });
  expect(position.afterCards).toBeTruthy();
  expect(position.beforeWeek).toBeTruthy();
  expect(position.gap).toBeGreaterThanOrEqual(0);
  expect(position.gap).toBeLessThan(38);
});
