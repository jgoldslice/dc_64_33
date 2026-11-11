const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';
test.use({browserName:'chromium',viewport:{width:1366,height:1024},isMobile:true,hasTouch:true});

async function createProject(page,title){
  page.once('dialog',d=>d.accept(title));
  await page.locator('#newProject').click();
  await page.locator('[data-v919-project-open="notes"]').click();
  await expect(page.locator('#projectTitle')).toHaveText(title);
  return page.evaluate(()=>String(v6Project().id));
}
async function openBrainstorm(page){
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  await page.locator('[data-tab="brainstorm"]').click();
  await expect(page.locator('#brainstorm')).toBeVisible();
  return errors;
}

test('Brainstorm keeps its heading but removes both decorative subtitle lines',async({page})=>{
  const errors=await openBrainstorm(page);
  await expect(page.locator('#brainstormTitle')).toHaveText('Brainstorm');
  await expect(page.locator('#brainstorm .view-header .eyebrow')).toHaveCount(0);
  await expect(page.locator('#brainstorm .view-header p')).toHaveCount(0);
  await createProject(page,'Quiet Notebook');
  await expect(page.locator('#brainstorm .view-header .eyebrow')).toHaveCount(0);
  await expect(page.locator('#brainstorm .view-header p')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('wide iPad removes the extra Projects panel and keeps the notebook Pages list',async({page})=>{
  const errors=await openBrainstorm(page);
  await createProject(page,'Build Notes');
  await expect(page.locator('.v81-project-rail')).toHaveCount(0);
  await expect(page.locator('.v811-page-rail')).toBeVisible();
  await expect(page.locator('#v814ProjectSelect')).toBeVisible();
  await expect(page.locator('#v814ProjectSelect')).toHaveValue(await page.evaluate(()=>String(v6Project().id)));
  const size=await page.evaluate(()=>{
    const get=id=>document.querySelector(id).getBoundingClientRect();
    const layout=get('.v81-project-layout'),main=get('.v81-project-main');
    const paper=get('#v76Surface'),pages=get('.v811-page-rail');
    return {
      gap:Math.abs(layout.width-main.width),
      pageGap:paper.left-pages.right,
      pageWidth:paper.width,
      horizontalOverflow:document.documentElement.scrollWidth-innerWidth
    };
  });
  expect(size.gap).toBeLessThan(3);
  expect(size.pageGap).toBeGreaterThanOrEqual(0);
  expect(size.pageWidth).toBeGreaterThan(540);
  expect(size.horizontalOverflow).toBeLessThanOrEqual(2);
  expect(errors).toEqual([]);
});

test('header switcher changes projects directly without returning to project library or losing notebook data',async({page})=>{
  const errors=await openBrainstorm(page);
  const first=await createProject(page,'Research');
  await page.evaluate(()=>{
    const p=v6Project();p.notePages[0].title='Catalysis ideas';
    p.notePages[0].objects[0].html='First project note';
    save();v6Render();
  });
  await page.locator('#backProjects').click();
  await expect(page.locator('#projectHome')).toBeVisible();
  const second=await createProject(page,'Minecraft');
  await page.evaluate(()=>{
    const p=v6Project();p.notePages[0].title='Village layouts';
    p.notePages[0].objects[0].html='Second project note';
    save();v6Render();
  });
  const chooser=page.locator('#v814ProjectSelect');
  const names=await chooser.locator('option').allTextContents();
  expect(names).toContain('Research');
  expect(names).toContain('Minecraft');
  await chooser.selectOption(first);
  await page.locator('[data-v919-project-open="notes"]').click();
  await expect(page.locator('#projectTitle')).toHaveText('Research');
  await expect(page.locator('#projectWorkspace')).toBeVisible();
  await expect(page.locator('#projectHome')).toBeHidden();
  await expect(page.locator('#v811PageList')).toContainText('Catalysis ideas');
  await expect(page.locator('#v76Surface .v76-rich').first()).toHaveText('First project note');
  await chooser.selectOption(second);
  await page.locator('[data-v919-project-open="notes"]').click();
  await expect(page.locator('#projectTitle')).toHaveText('Minecraft');
  await expect(page.locator('#v811PageList')).toContainText('Village layouts');
  await expect(page.locator('#v76Surface .v76-rich').first()).toHaveText('Second project note');
  await page.reload();
  await page.locator('[data-tab="brainstorm"]').click();
  await page.locator('[data-v6-project]').filter({hasText:'Research'}).click();
  await page.locator('[data-v919-project-open="notes"]').click();
  await expect(page.locator('#v814ProjectSelect')).toHaveValue(first);
  await expect(page.locator('#v76Surface .v76-rich').first()).toHaveText('First project note');
  expect(errors).toEqual([]);
});

test('project settings menu and Back to Projects remain accessible beside compact picker',async({page})=>{
  await openBrainstorm(page);
  await createProject(page,'Settings Check');
  await expect(page.locator('#renameProject')).toBeVisible();
  await page.locator('#renameProject').click();
  await expect(page.locator('#v82ProjectMenu')).toBeVisible();
  await expect(page.locator('#v82RenameProject')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#v82ProjectMenu')).toBeHidden();
  await page.locator('#backProjects').click();
  await expect(page.locator('#projectHome')).toBeVisible();
  await expect(page.locator('#projectGrid [data-v6-project]')).toHaveCount(1);
});

test('compact Split View and iPhone retain project switching without horizontal overflow',async({page})=>{
  await openBrainstorm(page);
  const one=await createProject(page,'First');
  await page.locator('#backProjects').click();
  const two=await createProject(page,'Second');
  for(const viewport of [{width:834,height:1194},{width:600,height:900},{width:390,height:844}]){
    await page.setViewportSize(viewport);
    const chooser=page.locator('#v814ProjectSelect');
    await expect(chooser).toBeVisible();
    const dimensions=await chooser.evaluate(el=>{
      const rect=el.getBoundingClientRect();
      return {x:rect.x,right:rect.right,width:rect.width,viewport:innerWidth,
        overflow:document.documentElement.scrollWidth-innerWidth};
    });
    expect(dimensions.x).toBeGreaterThanOrEqual(0);
    expect(dimensions.right).toBeLessThanOrEqual(dimensions.viewport+2);
    expect(dimensions.overflow).toBeLessThanOrEqual(2);
    await chooser.selectOption(one);
    await expect(page.locator('#projectTitle')).toHaveText('First');
    await chooser.selectOption(two);
    await expect(page.locator('#projectTitle')).toHaveText('Second');
  }
});

test('offline worker still includes the established notebook, iPad and project navigation assets',async({request})=>{
  const res=await request.get(base+'sw.js');
  expect(res.ok()).toBe(true);
  const worker=await res.text();
  for(const file of ['polish-v81.js','polish-v81.css','ipad-v84.css','v76.js','v76.css']){
    expect(worker).toContain(file);
  }
});
