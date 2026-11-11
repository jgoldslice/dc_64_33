const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';
test.use({browserName:'chromium',viewport:{width:834,height:1194},isMobile:true,hasTouch:true});

test.describe('Canvas adaptive iPad workspace',()=>{
  test('iPad portrait uses a leading sidebar, not a bottom tab bar',async({page})=>{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base);
    const nav=page.locator('.bottom-nav');
    await expect(nav.locator('.canvas-ipad-nav-head')).toBeVisible();
    const before=await page.evaluate(()=>{
      const nav=document.querySelector('.bottom-nav').getBoundingClientRect();
      const content=document.querySelector('.shell').getBoundingClientRect();
      return {navX:nav.x,navWidth:nav.width,navHeight:nav.height,shellX:content.x,
        viewportWidth:innerWidth,viewportHeight:innerHeight};
    });
    expect(before.navX).toBe(0);
    expect(before.navWidth).toBeGreaterThan(160);
    expect(before.navHeight).toBeGreaterThan(900);
    expect(before.shellX).toBeGreaterThanOrEqual(before.navWidth);
    await page.locator('[data-tab="week"]').click();
    await expect(page.locator('#week')).toBeVisible();
    await expect(page.locator('[data-tab="week"]')).toHaveAttribute('aria-current','page');
    await page.locator('[data-tab="myplan"]').click();
    await expect(page.locator('#myplan')).toBeVisible();
    await page.locator('[data-tab="today"]').click();
    await expect(page.locator('#today')).toBeVisible();
    expect(errors).toEqual([]);
  });
  test('sidebar collapses and expands without changing the planner state',async({page})=>{
    await page.goto(base);
    const toggle=page.locator('.canvas-ipad-collapse');
    const initial=await page.locator('.bottom-nav').evaluate(el=>el.getBoundingClientRect().width);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed','true');
    await expect(page.locator('body')).toHaveClass(/canvas-ipad-sidebar-collapsed/);
    await expect.poll(async()=>page.locator('.bottom-nav').evaluate(el=>el.getBoundingClientRect().width))
      .toBeLessThan(initial-40);
    await page.locator('[data-tab="brainstorm"]').click();
    await expect(page.locator('#brainstorm')).toBeVisible();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed','false');
    await expect(page.locator('body')).not.toHaveClass(/canvas-ipad-sidebar-collapsed/);
    await expect(page.locator('#brainstorm')).toBeVisible();
  });
  test('a small multitasking window returns to mobile navigation without data loss',async({page})=>{
    await page.goto(base);
    await page.locator('[data-tab="brainstorm"]').click();
    page.once('dialog',d=>d.accept('iPad Window Test'));
    await page.locator('#newProject').click();
    await expect(page.locator('#projectTitle')).toHaveText('iPad Window Test');
    await page.setViewportSize({width:600,height:900});
    await expect(page.locator('.canvas-ipad-nav-head')).toBeHidden();
    const navBox=await page.locator('.bottom-nav').boundingBox();
    expect(navBox.y).toBeGreaterThan(700);
    await expect(page.locator('#projectTitle')).toHaveText('iPad Window Test');
    await page.reload();
    await page.locator('[data-tab="brainstorm"]').click();
    await page.locator('[data-v6-project]').filter({hasText:'iPad Window Test'}).click();
    await expect(page.locator('#projectTitle')).toHaveText('iPad Window Test');
    await page.setViewportSize({width:834,height:1194});
    await expect(page.locator('.canvas-ipad-nav-head')).toBeVisible();
  });
});

test.describe('Canvas iPad landscape and notebook',()=>{
  test.beforeEach(async({page})=>{await page.setViewportSize({width:1366,height:1024});});
  test('large iPad switches projects from the header and gives the notebook the full workspace width',async({page})=>{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base);
    await page.locator('[data-tab="brainstorm"]').click();
    page.once('dialog',d=>d.accept('Notebook on iPad'));
    await page.locator('#newProject').click();
    await expect(page.locator('#v76Editor')).toBeVisible();
    await expect(page.locator('.v81-project-rail')).toHaveCount(0);
    await expect(page.locator('#v814ProjectSelect')).toBeVisible();
    await expect(page.locator('.v811-page-rail')).toBeVisible();
    const bounds=await page.evaluate(()=>{
      const nav=document.querySelector('.bottom-nav').getBoundingClientRect();
      const layout=document.querySelector('.v81-project-layout').getBoundingClientRect();
      const main=document.querySelector('.v81-project-main').getBoundingClientRect();
      const pages=document.querySelector('.v811-page-rail').getBoundingClientRect();
      const sheet=document.getElementById('v76Surface').getBoundingClientRect();
      return {navRight:nav.right,layoutLeft:layout.left,layoutWidth:layout.width,
        mainWidth:main.width,pagesRight:pages.right,sheetLeft:sheet.left,
        sheetWidth:sheet.width,sheetRight:sheet.right,viewport:innerWidth,
        contentWidth:document.documentElement.scrollWidth};
    });
    expect(bounds.layoutLeft).toBeGreaterThanOrEqual(bounds.navRight);
    expect(Math.abs(bounds.mainWidth-bounds.layoutWidth)).toBeLessThan(3);
    expect(bounds.sheetLeft).toBeGreaterThan(bounds.pagesRight);
    expect(bounds.sheetWidth).toBeGreaterThan(540);
    expect(bounds.sheetRight).toBeLessThanOrEqual(bounds.viewport+2);
    expect(bounds.contentWidth).toBeLessThanOrEqual(bounds.viewport+2);
    expect(errors).toEqual([]);
  });
  test('Today uses two content columns on a wide tablet',async({page})=>{
    await page.goto(base);
    const style=await page.locator('#today .v915-today-columns').evaluate(el=>({
      columns:getComputedStyle(el).gridTemplateColumns,
      gap:getComputedStyle(el).columnGap
    }));
    expect(style.columns.split(' ').length).toBe(2);
  });
  test('offline worker includes both iPad assets',async({request})=>{
    const res=await request.get(base+'sw.js');
    expect(res.ok()).toBe(true);
    const script=await res.text();
    expect(script).toContain('ipad-v84.js');
    expect(script).toContain('ipad-v84.css');
    expect(script).toContain("name.startsWith(PREFIX)");
  });
});
