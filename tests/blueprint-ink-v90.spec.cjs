const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';
test.use({browserName:'chromium',viewport:{width:834,height:1194},isMobile:true,hasTouch:true,deviceScaleFactor:2});

async function openNotebook(page){
  await page.goto(base);
  await page.locator('[data-tab="brainstorm"]').click();
  page.once('dialog',dialog=>dialog.accept('Ink Quality A/B'));
  await page.locator('#newProject').click();
  await expect(page.locator('#v76Ink')).toBeVisible();
}

test('untransformed 100 percent page switches to CSS scale only on demand',async({page})=>{
  await openNotebook(page);
  const original=await page.evaluate(()=>JSON.stringify(v6Project().notePages));
  const surface=page.locator('#v76Surface');
  await expect.poll(()=>surface.evaluate(el=>el.style.transform)).toBe('none');
  const natural=await surface.boundingBox();
  for(const [steps,percent] of [[1,125],[2,150],[4,200]]){
    while(Number((await page.locator('#v815ZoomReset').textContent()).replace('%',''))<percent)
      await page.locator('#v815ZoomIn').click();
    await expect(page.locator('#v815ZoomReset')).toHaveText(percent+'%');
    const css=await surface.evaluate(el=>el.style.transform);
    expect(css).toMatch(/^scale\(/);
    const measured=await surface.boundingBox();
    expect(measured.width).toBeGreaterThan(natural.width*(percent/100-.03));
  }
  await page.locator('#v815ZoomReset').click();
  await expect.poll(()=>surface.evaluate(el=>el.style.transform)).toBe('none');
  expect(await page.evaluate(()=>JSON.stringify(v6Project().notePages))).toBe(original);
});

test('Retina PNG sketch export has higher resolution and preserves editable strokes',async({page})=>{
  await openNotebook(page);
  await page.locator('[data-v76-mode="pen"]').click();
  const ink=page.locator('#v76Ink');
  const rect=await ink.boundingBox();
  await page.mouse.move(rect.x+rect.width/2,rect.y+90);
  await page.mouse.down();
  await page.mouse.move(rect.x+rect.width/2+45,rect.y+120,{steps:6});
  await page.mouse.up();
  await expect(ink.locator('path.v818-ink-stroke')).toHaveCount(1);
  const before=await page.evaluate(()=>JSON.stringify(v6Project().notePages[0].strokes));
  page.once('dialog',dialog=>dialog.accept('Retina proof'));
  await page.locator('#v819SaveSketch').click();
  // Encoding PNG and committing IndexedDB/localStorage are asynchronous.
  await expect.poll(()=>page.evaluate(()=>v6Project().library.filter(r=>r.type==='sketch').length)).toBe(1);
  const result=await page.evaluate(async()=>{
    const item=v6Project().library.find(r=>r.type==='sketch');
    if(!item)throw Error('Sketch not saved');
    const png=await v6Blob('get',item.key);
    const bytes=new DataView(await png.arrayBuffer());
    const surface=document.getElementById('v76Surface');
    return {mime:png.type,bytes:png.size,width:bytes.getUint32(16),height:bytes.getUint32(20),
      surfaceWidth:surface.clientWidth,surfaceHeight:surface.clientHeight,
      dpr:devicePixelRatio,strokes:JSON.stringify(v6Project().notePages[0].strokes)};
  });
  expect(result.mime).toBe('image/png');
  expect(result.dpr).toBe(2);
  expect(result.width).toBeGreaterThanOrEqual(result.surfaceWidth*1.95);
  expect(result.height).toBeGreaterThanOrEqual(result.surfaceHeight*1.95);
  expect(result.strokes).toBe(before);
});

test('Notebook CSS avoids permanent compositor promotion',async({page})=>{
  await openNotebook(page);
  expect(await page.locator('#v76Surface').evaluate(el=>getComputedStyle(el).willChange)).toBe('auto');
  const text=await page.evaluate(()=>document.querySelector('#projectNotes .v76-toolbar').textContent);
  expect(text).toContain('Save sketch');
});
