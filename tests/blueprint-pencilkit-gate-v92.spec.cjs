const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';
test.use({browserName:'chromium',viewport:{width:834,height:1194},isMobile:true,hasTouch:true});

test('Safari and PWAs never display PencilKit because it requires installed native Swift code',async({page})=>{
  await page.goto(base);
  await page.locator('[data-tab="brainstorm"]').click();
  page.once('dialog',dialog=>dialog.accept('Web-only project'));
  await page.locator('#newProject').click();
  await expect(page.locator('#v92PencilKit')).toHaveCount(0);
  await expect(page.locator('#v815ZoomViewport')).toBeVisible();
});

test('PencilKit native entry stays invisible if the plugin is unavailable',async({page})=>{
  await page.addInitScript(()=>{
    window.Capacitor={
      isNativePlatform:()=>true,isPluginAvailable:()=>false,
      Plugins:{BlueprintPencil:{capabilities:async()=>({available:true,schemaVersion:1}),openEditor:async()=>({})}}
    };
  });
  await page.goto(base);
  await expect(page.locator('#v92PencilKit')).toHaveCount(0);
});

test('native iPad offers opt-in PencilKit and never mutates original SVG/project data',async({page})=>{
  await page.addInitScript(()=>{
    window.__v92Calls=[];
    window.Capacitor={
      isNativePlatform:()=>true,isPluginAvailable:name=>name==='BlueprintPencil',
      Plugins:{BlueprintPencil:{
        capabilities:async()=>({available:true,schemaVersion:1}),
        openEditor:async options=>{window.__v92Calls.push(options);return {pageId:options.pageId};}
      }}
    };
  });
  await page.goto(base);
  await page.locator('[data-tab="brainstorm"]').click();
  page.once('dialog',dialog=>dialog.accept('Native bridge QA'));
  await page.locator('#newProject').click();
  const button=page.locator('#v92PencilKit');
  await expect(button).toBeVisible();
  const before=await page.evaluate(()=>JSON.stringify(v6Project()));
  page.once('dialog',dialog=>dialog.accept());
  await button.click();
  await expect.poll(()=>page.evaluate(()=>window.__v92Calls.length)).toBe(1);
  const info=await page.evaluate(()=>({
    calls:window.__v92Calls,
    project:JSON.stringify(v6Project()),
    announcement:document.getElementById('v81A11yStatus')?.textContent
  }));
  expect(info.calls[0].projectId).toBe(JSON.parse(before).id);
  expect(info.calls[0].pageId).toBe(JSON.parse(before).activeNotePageId);
  expect(info.calls[0].pageIds).toEqual(JSON.parse(before).notePages.map(p=>String(p.id)));
  expect(info.project).toBe(before);
  expect(info.announcement).toContain('saved separately');
  await expect(button).toBeEnabled();
});

test('native-only entry remains hidden on an iPhone-sized screen',async({page})=>{
  await page.addInitScript(()=>{
    window.Capacitor={
      isNativePlatform:()=>true,isPluginAvailable:()=>true,
      Plugins:{BlueprintPencil:{capabilities:async()=>({available:true,schemaVersion:1}),openEditor:async()=>({})}}
    };
  });
  await page.setViewportSize({width:390,height:844});
  await page.goto(base);
  await expect(page.locator('#v92PencilKit')).toBeHidden();
});
