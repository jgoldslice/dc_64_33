'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('node:fs/promises');
const base='http://127.0.0.1:8765/';

async function seed(page,count=1){
  await page.goto(base);
  await page.evaluate(n=>{
    state.projects=Array.from({length:n},(_,i)=>({id:'project-'+i,title:'Research project '+i,area:'Research',notes:[],actions:[],library:[]}));
    state.events=[];state.tasks=[];state.habits=[];
    if(!save(true))throw Error('Could not seed projects');render();v6Render();
  },count);
}
async function openProject(page){
  await page.locator('.bottom-nav [data-tab="brainstorm"]').click();
  await page.locator('[data-v6-project="project-0"]').click();
  await expect(page.locator('#bpProjectAppearance')).toBeVisible();
}
async function chooseIcon(page,icon,color){
  await page.locator('#bpProjectAppearance').click();
  const sheet=page.locator('#bpSheet');await expect(sheet).toBeVisible();
  await sheet.locator(`[data-project-icon-choice="${icon}"]`).click();
  await sheet.locator(`[data-project-color-choice="${color}"]`).click();
  await sheet.getByRole('button',{name:'Save',exact:true}).click();
  await expect(sheet).toHaveCount(0);
}

test('project icons and colors persist across Today, project list, Area, reload and complete backup',async({page,browser})=>{
  await seed(page);await openProject(page);
  await chooseIcon(page,'flask','ocean');
  await expect(page.locator('#bpProjectAppearance [data-project-icon="flask"]')).toHaveAttribute('data-project-color','ocean');
  await page.locator('.bottom-nav [data-tab="today"]').click();
  await expect(page.locator('#v77TodayProjects [data-v77-open-project="project-0"] [data-project-icon="flask"]')).toBeVisible();
  await page.locator('.bottom-nav [data-tab="brainstorm"]').click();await page.locator('#backProjects').click();
  await expect(page.locator('#projectGrid [data-v6-project="project-0"] [data-project-icon="flask"]')).toBeVisible();
  await page.reload();
  await expect(page.locator('#v77TodayProjects [data-project-icon="flask"]')).toHaveAttribute('data-project-color','ocean');
  await page.locator('.bottom-nav [data-tab="myplan"]').click();
  await page.locator('[data-bpa-open="Research"]').click();
  await expect(page.locator('[data-bpa-project="project-0"] [data-project-icon="flask"]')).toBeVisible();
  const [download]=await Promise.all([page.waitForEvent('download'),page.evaluate(()=>document.getElementById('exportData').click())]);
  const archive=JSON.parse(await fs.readFile(await download.path(),'utf8'));
  expect(archive.state.projects[0].projectAppearance).toEqual({icon:'flask',color:'ocean'});
  expect(archive.format).toBe('canvas-complete-backup');
});

test('an imported photo becomes a project logo and survives reload and backup restoration',async({page,browser})=>{
  await seed(page);await openProject(page);
  await page.locator('#bpProjectAppearance').click();
  const sheet=page.locator('#bpSheet');
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAMAAAADCAYAAABWKLW/AAAAEklEQVR4nGO4s0XjPwwz4OQAAN1IGHAHnFF3AAAAAElFTkSuQmCC','base64');
  await sheet.locator('[data-project-photo]').setInputFiles({name:'project.png',mimeType:'image/png',buffer:png});
  await expect(sheet.locator('.bp-project-picker-preview img')).toBeVisible();
  await expect(sheet.locator('[role="status"]')).toHaveText('Photo ready');
  await sheet.getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.locator('#bpProjectAppearance img')).toBeVisible();
  const data=await page.evaluate(()=>state.projects[0].projectAppearance.imageData);
  expect(data).toMatch(/^data:image\/png;base64,/);expect(data.length).toBeLessThanOrEqual(100000);
  await page.reload();
  await expect(page.locator('#v77TodayProjects img')).toHaveAttribute('src',data);
  const [download]=await Promise.all([page.waitForEvent('download'),page.evaluate(()=>document.getElementById('exportData').click())]);
  const archive=JSON.parse(await fs.readFile(await download.path(),'utf8'));
  expect(archive.state.projects[0].projectAppearance.imageData).toBe(data);
  const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
  try{
    const restored=await context.newPage();await restored.goto(base);
    restored.on('dialog',d=>d.accept());
    await restored.locator('#importFile').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(archive))});
    await expect.poll(()=>restored.evaluate(()=>state.projects?.[0]?.projectAppearance?.imageData),{timeout:12000}).toBe(data);
    await expect(restored.locator('#v77TodayProjects img')).toHaveAttribute('src',data);
  }finally{await context.close();}
});

test('failed project appearance save preserves the previous icon',async({page})=>{
  await seed(page);await openProject(page);await chooseIcon(page,'flask','ocean');
  await page.evaluate(()=>{const set=Storage.prototype.setItem;window.__restoreAppearanceStorage=()=>Storage.prototype.setItem=set;Storage.prototype.setItem=function(key,value){if(key===STORAGE_KEY)throw new Error('full');return set.call(this,key,value);};});
  await chooseIcon(page,'heart','rose');
  expect(await page.evaluate(()=>state.projects[0].projectAppearance)).toEqual({icon:'flask',color:'ocean'});
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem(STORAGE_KEY)).projects[0].projectAppearance.icon)).toBe('flask');
  await page.evaluate(()=>window.__restoreAppearanceStorage());
});

test('each project keeps its own icon and the header remains usable on phones, iPads and desktop',async({page})=>{
  await seed(page,2);await openProject(page);await chooseIcon(page,'flask','ocean');
  await page.locator('#backProjects').click();
  await page.locator('[data-v6-project="project-1"]').click();
  await chooseIcon(page,'heart','rose');
  await page.locator('#backProjects').click();
  await expect(page.locator('[data-v6-project="project-0"] [data-project-icon="flask"]')).toBeVisible();
  await expect(page.locator('[data-v6-project="project-1"] [data-project-icon="heart"]')).toBeVisible();
  await page.locator('[data-v6-project="project-0"]').click();
  for(const [width,height] of [[320,700],[390,844],[768,1024],[834,1194],[1024,768],[1440,900]]){
    await page.setViewportSize({width,height});
    const measure=await page.locator('#projectWorkspace').evaluate(root=>{
      const rects=['#backProjects','#v814ProjectSelect','#bpProjectAppearance','.v82-develop','#renameProject'].map(s=>root.querySelector(s).getBoundingClientRect());
      return {overflow:document.documentElement.scrollWidth-innerWidth,
        inside:rects.every(r=>r.width>0&&r.height>=40&&r.left>=-1&&r.right<=innerWidth+1)};
    });
    expect(measure.overflow,`${width}x${height}`).toBeLessThanOrEqual(4);
    expect(measure.inside,`${width}x${height}`).toBe(true);
  }
  await page.setViewportSize({width:320,height:700});
  await page.locator('#bpProjectAppearance').click();
  const sheet=page.locator('#bpSheet');
  await expect(sheet.locator('[data-project-icon-choice]')).toHaveCount(31);
  expect((await sheet.locator('[data-project-icon-choice]').allTextContents()).every(text=>!text.trim())).toBe(true);
  await expect(sheet.getByRole('button',{name:'Cancel'})).toBeVisible();
  await sheet.getByRole('button',{name:'Cancel'}).click();
});

test('Today shows project tiles without clipping or internal scrolling across devices',async({page})=>{
  await seed(page,4);
  for(const [width,height] of [[320,568],[390,844],[768,1024],[834,1194],[1024,768],[1440,900]]){
    await page.setViewportSize({width,height});
    const m=await page.locator('#v77TodayProjects').evaluate(host=>{
      const root=host.getBoundingClientRect(),card=host.closest('.card').getBoundingClientRect();
      const tiles=[...host.querySelectorAll('.v77-project-folder')].map(el=>el.getBoundingClientRect());
      return {count:tiles.length,scroll:host.scrollHeight-host.clientHeight,
        fits:tiles.every(r=>r.top>=root.top-1&&r.bottom<=root.bottom+1&&r.bottom<=card.bottom+1),
        pageOverflow:document.documentElement.scrollWidth-innerWidth};
    });
    expect(m.count).toBe(4);expect(m.scroll,`${width}x${height}`).toBeLessThanOrEqual(2);
    expect(m.fits,`${width}x${height}`).toBe(true);expect(m.pageOverflow).toBeLessThanOrEqual(3);
  }
});

test('Unassigned uses an inbox and Area customization uses sliders',async({page})=>{
  await seed(page);await page.evaluate(()=>{state.projects[0].area='';save(true);render();});
  await page.locator('.bottom-nav [data-tab="myplan"]').click();
  const inbox=page.locator('[data-bpa-open="__unassigned__"] .bp-area-badge svg');
  await expect(inbox.locator('path')).toHaveAttribute('d',/M4 4h16/);
  const customize=page.locator('[data-bpa-appearance="Research"]');
  await expect(customize.locator('circle')).toHaveCount(2);
  await expect(customize).toHaveAttribute('aria-label','Customize Research');
});
