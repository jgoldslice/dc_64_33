const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';
async function plan(page,width){
  await page.setViewportSize({width,height:width>=760?1024:844});
  await page.goto(base);
  await page.locator('.bottom-nav button[data-tab="myplan"]').click();
}
test('Area actions are compact siblings below the cards, with no weekly feature card',async({page})=>{
  for(const width of [1366,768,390,320]){
    await plan(page,width);
    const week=page.locator('#bpAreasRoot .bp-areas-header [data-wb-launch]');
    const area=page.locator('#bpAreasRoot .bp-areas-header [data-bpa-new]');
    await expect(week).toBeVisible();
    await expect(area).toBeVisible();
    await expect(page.locator('#overview > .wb-overview-feature')).toHaveCount(0);
    await expect(page.locator('#overview [data-wb-launch]')).toHaveCount(1);
    await expect(week).toHaveAttribute('aria-label','Design your week');
    const rects=await page.evaluate(()=>{
      const cards=document.querySelector('.bp-area-grid').getBoundingClientRect();
      const area=document.querySelector('#bpAreasRoot [data-bpa-new]').getBoundingClientRect();
      const week=document.querySelector('#bpAreasRoot [data-wb-launch]').getBoundingClientRect();
      const toolbar=document.querySelector('.bp-areas-header').getBoundingClientRect();
      return {cardsBottom:cards.bottom,areaTop:area.top,weekTop:week.top,
        weekRight:week.right,areaRight:area.right,toolbarRight:toolbar.right,areaBottom:area.bottom};
    });
    expect(rects.areaTop).toBeGreaterThanOrEqual(rects.cardsBottom);
    expect(Math.abs(rects.areaTop-rects.weekTop)).toBeLessThanOrEqual(2);
    expect(rects.weekRight).toBeLessThanOrEqual(rects.toolbarRight+1);
    expect(rects.weekRight).toBeGreaterThan(rects.areaRight);
    expect(rects.areaBottom-rects.areaTop).toBeGreaterThanOrEqual(44);
  }
});
test('Compact Design Week button launches the existing five-stage planner and retains drafts',async({page})=>{
  await plan(page,390);
  await page.locator('#bpAreasRoot [data-wb-launch]').click();
  await expect(page.locator('#wbOverlay [role="dialog"]')).toBeVisible();
  await expect(page.locator('#wbTitle')).toHaveText('Report');
  await expect(page.locator('#wbProgress button')).toHaveCount(5);
  await page.locator('[data-wb-next]').click();
  await expect(page.locator('#wbTitle')).toHaveText('Goals');
  await page.keyboard.press('Escape');
  await expect(page.locator('#wbOverlay')).toBeHidden();
  await page.locator('#bpAreasRoot [data-wb-launch]').click();
  await expect(page.locator('#wbTitle')).toHaveText('Goals');
  await expect(page.locator('#wbDraftStatus')).not.toBeEmpty();
  await expect(page.locator('#wbUndoRegion')).toHaveCount(1);
});
