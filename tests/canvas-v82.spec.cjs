const {test,expect}=require('@playwright/test');
const fs=require('node:fs/promises');
test.use({browserName:'chromium',viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const base='http://127.0.0.1:8765/';

async function createProject(page,name){
  await page.locator('[data-tab="brainstorm"]').click();
  page.once('dialog',d=>d.accept(name));
  await page.locator('#newProject').click();
  await expect(page.locator('#projectTitle')).toHaveText(name);
}
test('Project settings replaces exposed destructive controls and preserves Develop',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  await createProject(page,'Menu Test');
  await expect(page.locator('.v6-project-header #projectChat')).toHaveCount(0);
  await expect(page.locator('.v82-project-header #projectChat')).toBeVisible();
  await expect(page.locator('.v6-project-footer')).toBeHidden();
  const more=page.locator('#renameProject');
  await expect(more).toHaveAttribute('aria-expanded','false');
  await more.click();
  await expect(page.locator('#v82ProjectMenu')).toBeVisible();
  await expect(page.locator('#v82ProjectMenu button')).toHaveText(['Rename project','Export complete backup','Delete project']);
  await page.keyboard.press('Escape');
  await expect(page.locator('#v82ProjectMenu')).toBeHidden();
  await expect(more).toBeFocused();
  await more.click();
  page.once('dialog',d=>d.accept('Renamed Project'));
  await page.locator('#v82RenameProject').click();
  await expect(page.locator('#projectTitle')).toHaveText('Renamed Project');
  await more.click();
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#v82ExportBackup').click()]);
  const data=JSON.parse(await fs.readFile(await download.path(),'utf8'));
  expect(data.format).toBe('canvas-complete-backup');
  expect(data.state.projects.some(x=>x.title==='Renamed Project')).toBe(true);
  expect(errors).toEqual([]);
});

test('Reopening a project always starts at Overview and its cards open each editor',async({page})=>{
  await page.goto(base);
  await createProject(page,'Project Continuity');
  await expect(page.locator('#projectOverview')).toBeVisible();
  await page.locator('[data-v919-project-open="library"]').click();
  await expect(page.locator('#projectLibrary')).toBeVisible();
  await page.locator('#v919BackOverview').click();
  await page.locator('[data-v919-project-open="actions"]').click();
  await expect(page.locator('#projectActions')).toBeVisible();
  await page.locator('#backProjects').click();
  await page.locator('[data-v6-project]').filter({hasText:'Project Continuity'}).click();
  await expect(page.locator('#projectOverview')).toBeVisible();
  await expect(page.locator('#projectActions')).toBeHidden();
  await page.reload();
  await page.locator('[data-tab="brainstorm"]').click();
  await page.locator('[data-v6-project]').filter({hasText:'Project Continuity'}).click();
  await expect(page.locator('#projectOverview')).toBeVisible();
  await page.locator('[data-v919-project-open="notes"]').click();
  await expect(page.locator('#v76Editor')).toBeVisible();
});

test('Overdue tasks appear in dedicated Today Tasks card without adding duplicates',async({page})=>{
  await page.goto(base);
  await page.evaluate(()=>{
    state.tasks.push(
      {id:992001,title:'Missed important task',dueDate:'2020-01-01',done:false,priority:false,priorityRank:0},
      {id:992002,title:'Already finished',dueDate:'2020-01-01',done:true,priority:false,priorityRank:0}
    );
    save();render();
  });
  await expect(page.locator('#v917TodayTasks .v82-overdue-label')).toHaveText('Overdue');
  await expect(page.locator('#v917TodayTasks')).toContainText('Missed important task');
  await expect(page.locator('#v917TodayTasks')).not.toContainText('Already finished');
  await expect(page.locator('#todayGlance')).not.toContainText('Missed important task');
  const headings=await page.locator('#today>.stack>section:visible>.card-heading h2').allTextContents();
  expect(headings.length).toBe(5);
});

test('Deleting one project keeps cross-project media, and removes orphaned files',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  await createProject(page,'Delete Me');
  await page.evaluate(async()=>{
    const original=v6Project();
    const shared='v82-test-shared',orphan='v82-test-orphan';
    const bytes=new Uint8Array([137,80,78,71,13,10,26,10]);
    await v6Blob('put',shared,new Blob([bytes],{type:'image/png'}));
    await v6Blob('put',orphan,new Blob([bytes],{type:'image/png'}));
    original.library.push({id:v6Id(),type:'file',title:'Media Shared',key:shared,mime:'image/png'});
    original.notePages[0].objects.push({id:v6Id(),type:'image',key:orphan,x:10,y:130,width:180});
    const survivor={id:v6Id(),title:'Keep Me',created:v6Now(),notes:[],actions:[],
      library:[{id:v6Id(),type:'file',title:'Same Blob',key:shared,mime:'image/png'}],
      notePages:[{id:v6Id(),title:'Page 1',height:740,objects:[{id:v6Id(),type:'image',key:shared,x:10,y:50,width:200}],strokes:[]}]};
    state.projects.push(survivor);save();
  });
  await page.locator('#renameProject').click();
  page.once('dialog',d=>d.accept());
  await page.locator('#deleteProject').click();
  await expect(page.locator('#projectHome')).toBeVisible();
  const result=await page.evaluate(async()=>({
    shared:!!(await v6Blob('get','v82-test-shared')),
    orphan:!!(await v6Blob('get','v82-test-orphan')),
    kept:state.projects.some(p=>p.title==='Keep Me'),
    removed:state.projects.some(p=>p.title==='Delete Me')
  }));
  expect(result).toEqual({shared:true,orphan:false,kept:true,removed:false});
  expect(errors).toEqual([]);
});

test('Service worker only deletes Canvas caches and never returns HTML as image or JS',async({request})=>{
  const response=await request.get(base+'sw.js');
  expect(response.ok()).toBe(true);
  const js=await response.text();
  expect(js).toContain("name.startsWith(PREFIX)");
  expect(js).toContain("request.mode==='navigate'");
  expect(js).toContain("return Response.error()");
  expect(js).toContain('polish-v82.js');
});
