'use strict';
const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';

test.use({
  browserName:'chromium',
  viewport:{width:390,height:844},
  deviceScaleFactor:3,
  isMobile:true,
  hasTouch:true
});

const usableFontSize=locator=>locator.evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
const modalGeometry=page=>page.evaluate(()=>{
  const modal=document.querySelector('#modalForm').getBoundingClientRect();
  const days=document.querySelector('#modalForm .days-picker')?.getBoundingClientRect();
  return {
    viewport:window.innerWidth,
    documentWidth:document.documentElement.scrollWidth,
    left:modal.left,right:modal.right,
    dayRight:days?.right,
    controls:[...document.querySelectorAll('#modalForm .modal-actions button')]
      .filter(el=>getComputedStyle(el).display!=='none')
      .map(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right};})
  };
});

test('touch habit title focus uses at least 16px and modal stays within the viewport',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  await page.locator('[data-tab="myplan"]').click();
  await page.locator('#myplan [data-plan-tab="habits"]').click();
  await page.locator('#habits [data-open="habit"]').click();
  await expect(page.locator('#modalBack')).toHaveClass(/open/);
  const title=page.locator('#modalFields input[name="title"]');
  await title.focus();
  await title.fill('25 pull ups');
  expect(await usableFontSize(title)).toBeGreaterThanOrEqual(16);
  const checkboxes=page.locator('#modalForm input[type="checkbox"][name="schedule"]');
  await expect(checkboxes).toHaveCount(7);
  for(const width of [390,320]){
    await page.setViewportSize({width,height:844});
    const g=await modalGeometry(page);
    expect(g.left).toBeGreaterThanOrEqual(-1);
    expect(g.right).toBeLessThanOrEqual(g.viewport+1);
    expect(g.documentWidth).toBeLessThanOrEqual(g.viewport+1);
    expect(g.dayRight).toBeLessThanOrEqual(g.right+1);
    for(const b of g.controls){
      expect(b.left).toBeGreaterThanOrEqual(-1);
      expect(b.right).toBeLessThanOrEqual(g.viewport+1);
    }
  }
  await page.locator('#cancelModal').click();
  await expect(page.locator('#modalBack')).not.toHaveClass(/open/);
  expect(errors).toEqual([]);
});

test('touch Goal inputs, category select and motivation text area do not trigger small-font focus zoom',async({page})=>{
  await page.goto(base);
  await page.locator('[data-tab="myplan"]').click();
  await page.locator('#myplan [data-plan-tab="goals"]').click();
  await page.locator('#goals [data-open="goal"]').click();
  for(const name of ['input[name="title"]','select[name="category"]','textarea[name="motivation"]']){
    const field=page.locator('#modalFields '+name);
    await field.focus();
    expect(await usableFontSize(field)).toBeGreaterThanOrEqual(16);
  }
  const meta=await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(meta).not.toMatch(/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i);
  await page.locator('#cancelModal').click();
});
