const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';

async function project(page,title='Device layout QA'){
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base);
  await page.locator('[data-tab="brainstorm"]').click();
  page.once('dialog',dialog=>dialog.accept(title));
  await page.locator('#newProject').click();
  await expect(page.locator('#v815ZoomViewport')).toBeVisible();
  return errors;
}
const notebookWidth=page=>page.locator('#projectNotes .v76-notebook-ui').evaluate(el=>el.getBoundingClientRect().width);
const pageOverflow=page=>page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);

test('portrait iPad can expand canvas to show the Pages rail without changing notebook data',async({page})=>{
  await page.setViewportSize({width:834,height:1194});
  const errors=await project(page);
  const focus=page.locator('.canvas-ipad-collapse');
  await expect(focus).toBeVisible();
  await expect(focus).toHaveAttribute('aria-label','Collapse sidebar');
  await expect(page.locator('#brainstorm>.view-header')).toBeHidden();
  const before=await notebookWidth(page);
  const original=await page.evaluate(()=>JSON.stringify(v6Project().notePages));
  await focus.click();
  await expect(page.locator('body')).toHaveClass(/canvas-ipad-sidebar-collapsed/);
  await expect(focus).toHaveAttribute('aria-label','Expand sidebar');
  await expect(focus).toHaveAttribute('aria-pressed','true');
  await expect.poll(()=>notebookWidth(page)).toBeGreaterThan(before+45);
  await expect(page.locator('.v811-page-rail')).toBeVisible();
  expect(await page.evaluate(()=>JSON.stringify(v6Project().notePages))).toBe(original);
  await focus.click();
  await expect(focus).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('body')).not.toHaveClass(/canvas-ipad-sidebar-collapsed/);
  expect(errors).toEqual([]);
});

test('iPad sidebar toggle and workspace focus reflect the same accessible state',async({page})=>{
  await page.setViewportSize({width:1194,height:834});
  const errors=await project(page);
  const sidebar=page.locator('.canvas-ipad-collapse');
  await sidebar.click();
  await expect(sidebar).toHaveAttribute('aria-pressed','true');
  await expect(sidebar).toHaveAttribute('aria-label','Expand sidebar');
  await sidebar.click();
  await expect(sidebar).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('.bottom-nav>button[data-tab]')).toHaveCount(4);
  expect(errors).toEqual([]);
});

for(const width of [320,390,430,600]){
  test('phone or split width '+width+' keeps project actions and notebook toolbar accessible',async({page})=>{
    await page.setViewportSize({width,height:844});
    const errors=await project(page,'Compact project');
    await expect(page.locator('#v892FocusCanvas')).toBeHidden();
    await expect(page.locator('#brainstorm>.view-header')).toBeHidden();
    await expect(page.locator('#backProjects')).toBeVisible();
    await expect(page.locator('#v814ProjectSelect')).toBeVisible();
    await expect(page.locator('.v82-develop')).toBeVisible();
    await expect(page.locator('.v82-develop')).toHaveAttribute('aria-label','Develop this project in ChatGPT');
    await expect(page.locator('#renameProject')).toBeVisible();
    expect(await pageOverflow(page)).toBeLessThanOrEqual(4);
    const toolbar=page.locator('#projectNotes .v76-toolbar');
    await expect(toolbar).toHaveCSS('flex-wrap','nowrap');
    const controls=await toolbar.evaluate(el=>({
      scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,
      scrollable:getComputedStyle(el).overflowX==='auto'
    }));
    expect(controls.scrollable).toBe(true);
    expect(controls.scrollWidth).toBeGreaterThanOrEqual(controls.clientWidth);
    await page.locator('#projectTabs [data-project-tab="actions"]').click();
    await expect(page.locator('#projectActions')).toBeVisible();
    await page.locator('#projectTabs [data-project-tab="library"]').click();
    await expect(page.locator('#projectLibrary')).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('iPad layout retains good touch targets and no document overflow at multiple sizes',async({page})=>{
  await page.setViewportSize({width:1024,height:768});
  await project(page);
  for(const size of [{width:1024,height:768},{width:834,height:1194},{width:1194,height:834}]){
    await page.setViewportSize(size);
    await expect(page.locator('.canvas-ipad-collapse')).toBeVisible();
    await expect.poll(()=>pageOverflow(page)).toBeLessThanOrEqual(4);
    const buttons=await page.locator('#projectNotes .v76-toolbar button:visible').evaluateAll(nodes=>
      nodes.map(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height})));
    expect(buttons.length).toBeGreaterThan(5);
    expect(buttons.every(x=>x.width>=44&&x.height>=44)).toBe(true);
  }
});

test('Reduce Motion and offline assets cover device workspace layout',async({page,request})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.setViewportSize({width:834,height:1194});
  await project(page);
  const transition=await page.locator('.canvas-ipad-collapse').evaluate(el=>getComputedStyle(el).transitionDuration);
  expect(transition.split(',').every(x=>parseFloat(x)===0)).toBe(true);
  const response=await request.get(base+'sw.js');
  expect(await response.text()).toContain('device-workspace-v892.css');
  const script=await request.get(base+'device-workspace-v892.js');
  expect(script.ok()).toBe(true);
});
