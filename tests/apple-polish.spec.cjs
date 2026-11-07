const { test, expect } = require('@playwright/test');
const fs=require('node:fs/promises');
const url='http://127.0.0.1:8765/';
test.use({browserName:'chromium',viewport:{width:390,height:844},isMobile:true,hasTouch:true});

async function openNewProject(page,title) {
  await page.locator('[data-tab="brainstorm"]').click();
  page.once('dialog',d=>d.accept(title));
  await page.locator('#newProject').click();
  await expect(page.locator('#projectWorkspace')).toBeVisible();
}
const onePixelPNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP+ZJRdGAAAAABJRU5ErkJggg==','base64');

test('tabs remember their own scroll positions without expanding navigation',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);
  await expect(page.locator('.bottom-nav button')).toHaveCount(4);
  await page.evaluate(()=>{
    document.getElementById('today').style.minHeight='2200px';
    document.getElementById('week').style.minHeight='2200px';
  });
  await page.evaluate(()=>window.scrollTo(0,430));
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeGreaterThan(300);
  const prior=await page.evaluate(()=>window.scrollY);
  await page.locator('[data-tab="week"]').click();
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeLessThan(50);
  await page.evaluate(()=>window.scrollTo(0,250));
  await page.locator('[data-tab="today"]').click();
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeGreaterThan(300);
  expect(Math.abs((await page.evaluate(()=>window.scrollY))-prior)).toBeLessThan(12);
  expect(errors).toEqual([]);
});

test('project workspace stays full-width with compact project switching at every viewport size',async({page})=>{
  await page.goto(url);
  await openNewProject(page,'Responsive Project');
  await expect(page.locator('.v81-project-layout')).toBeVisible();
  await expect(page.locator('.v81-project-rail')).toHaveCount(0);
  const picker=page.locator('#v814ProjectSelect');
  const id=await page.evaluate(()=>String(v6Project().id));
  await expect(picker).toHaveValue(id);
  for(const viewport of [{width:390,height:844},{width:1060,height:850},{width:1366,height:1024}]){
    await page.setViewportSize(viewport);
    await expect(picker).toBeVisible();
    const width=await page.evaluate(()=>{
      const outer=document.querySelector('.v81-project-layout').getBoundingClientRect();
      const inner=document.querySelector('.v81-project-main').getBoundingClientRect();
      return {outer:outer.width,inner:inner.width,overflow:document.documentElement.scrollWidth-innerWidth};
    });
    expect(Math.abs(width.outer-width.inner)).toBeLessThan(3);
    expect(width.overflow).toBeLessThanOrEqual(2);
    await expect(page.locator('.v81-project-main [data-project-tab="notes"]')).toBeVisible();
  }
  await expect(page.locator('#v76Editor')).toBeVisible();
});

test('Today project shortcuts order recent projects first and preserve folders',async({page})=>{
  await page.goto(url);
  await openNewProject(page,'First Project');
  await page.locator('#backProjects').click();
  await openNewProject(page,'Second Project');
  await page.locator('#backProjects').click();
  await page.locator('[data-v6-project]').filter({hasText:'First Project'}).click();
  await page.locator('[data-tab="today"]').click();
  const titles=await page.locator('#v77TodayProjects .v77-project-folder span').allTextContents();
  expect(titles).toEqual(['First Project','Second Project']);
  await page.locator('[data-v77-open-project]').filter({hasText:'Second Project'}).click();
  await expect(page.locator('#projectTitle')).toHaveText('Second Project');
});

test('complete backup includes page images and import remaps all referenced image keys',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);
  await openNewProject(page,'Backup Roundtrip');
  await page.locator('#v76ImageInput').setInputFiles({name:'tiny.png',mimeType:'image/png',buffer:onePixelPNG});
  const image=page.locator('#v76Surface .v76-image .v76-photo').first();
  await expect(image).toBeVisible();
  const originalKey=await image.getAttribute('data-v76-image-key');
  await page.locator('#canvasHomeButton').click();
  await page.locator('#paletteLauncher').click();
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#exportData').click()]);
  const payload=JSON.parse(await fs.readFile(await download.path(),'utf8'));
  const backupPage=payload.state.projects.find(p=>p.title==='Backup Roundtrip').notePages[0];
  expect(backupPage.objects.some(o=>o.key===originalKey)).toBe(true);
  expect(payload.attachments.some(a=>a.key===originalKey&&a.base64)).toBe(true);
  page.on('dialog',d=>d.accept());
  await page.evaluate(async backup=>{
    await window.v74ImportBackup(new File([JSON.stringify(backup)],'restore.json',{type:'application/json'}));
  },payload);
  await page.locator('[data-tab="brainstorm"]').click();
  await page.locator('[data-v6-project]').filter({hasText:'Backup Roundtrip'}).click();
  const restored=page.locator('#v76Surface .v76-image .v76-photo').first();
  await expect(restored).toBeVisible();
  await expect.poll(async()=>restored.evaluate(el=>el.complete&&el.naturalWidth>0)).toBe(true);
  const newKey=await restored.getAttribute('data-v76-image-key');
  expect(newKey).not.toBe(originalKey);
  expect(errors).toEqual([]);
});

test('removing an image from Library does not delete a blob used by Notes',async({page})=>{
  await page.goto(url);
  await openNewProject(page,'Shared Media');
  await page.locator('#v76ImageInput').setInputFiles({name:'shared.png',mimeType:'image/png',buffer:onePixelPNG});
  const key=await page.locator('.v76-photo').first().getAttribute('data-v76-image-key');
  // Simulate the same image being saved in a project Library.
  const id=await page.evaluate(async key=>{
    const p=v6Project();
    const id=v6Id();
    p.library.push({id,key,title:'Shared PNG',type:'file',mime:'image/png'});
    save();v6Render();
    return id;
  },key);
  page.once('dialog',d=>d.accept());
  await page.evaluate(async id=>await v6DeleteResource(id),id);
  const stillSaved=await page.evaluate(async key=>!!(await v6Blob('get',key)),key);
  expect(stillSaved).toBe(true);
  await expect(page.locator('.v76-photo')).toBeVisible();
});

test('default toolbar and motion settings remain calm and usable',async({page})=>{
  await page.goto(url);
  await openNewProject(page,'Tap Target Test');
  const result=await page.evaluate(()=>{
    const buttons=[...document.querySelectorAll('.bottom-nav button')].map(el=>el.getBoundingClientRect().height);
    const noteButtons=[...document.querySelectorAll('.v79-tool-buttons button')].map(el=>el.getBoundingClientRect().height);
    return {buttons,noteButtons,nav:document.querySelectorAll('.bottom-nav button').length};
  });
  expect(result.nav).toBe(4);
  expect(result.buttons.every(x=>x>=44)).toBe(true);
  expect(result.noteButtons.every(x=>x>=44)).toBe(true);
  await page.emulateMedia({reducedMotion:'reduce'});
  const duration=await page.locator('.v6-folder').first().evaluate(el=>getComputedStyle(el).transitionDuration).catch(()=>null);
  // Reduced motion must never introduce an animation regardless of active route.
  expect(duration===null||duration==='1e-05s'||duration==='0.00001s'||duration==='0s').toBe(true);
});
