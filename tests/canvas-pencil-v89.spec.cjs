const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';

async function openNotebook(page){
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base);
  await page.locator('[data-tab="brainstorm"]').click();
  page.once('dialog',dialog=>dialog.accept('Pencil alignment test'));
  await page.locator('#newProject').click();
  await expect(page.locator('#v76Editor')).toBeVisible();
  await page.locator('#v76Ink').scrollIntoViewIfNeeded();
  return errors;
}
async function contact(page){
  return await page.locator('#v76Ink').evaluate(el=>{
    const rect=el.getBoundingClientRect(),top=Math.max(rect.top+15,40);
    const bottom=Math.min(rect.bottom-15,window.innerHeight-40);
    const left=Math.max(rect.left+25,40);
    const right=Math.min(rect.right-20,window.innerWidth-40);
    if(bottom-top<80||right-left<125)throw Error('Not enough visible ink surface to test');
    return {x:left+Math.min(65,(right-left)/3),y:top+Math.min(65,(bottom-top)/3)};
  });
}
async function draw(page,pen=false){
  await page.locator('[data-v76-mode="pen"]').click();
  await page.locator('#v76Ink').scrollIntoViewIfNeeded();
  const start=await contact(page);
  const end={x:start.x+56,y:start.y+28};
  if(pen){
    const cdp=await page.context().newCDPSession(page);
    const props={button:'left',buttons:1,pointerType:'pen'};
    await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:start.x,y:start.y,buttons:0,pointerType:'pen'});
    await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x:start.x,y:start.y,clickCount:1,...props});
    await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:end.x,y:end.y,...props});
    await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:end.x,y:end.y,buttons:0,button:'left',clickCount:1,pointerType:'pen'});
    await cdp.detach();
  }else{
    await page.mouse.move(start.x,start.y);
    await page.mouse.down();
    await page.mouse.move(end.x,end.y,{steps:5});
    await page.mouse.up();
  }
  await expect(page.locator('#v76Ink path.v818-ink-stroke')).toHaveCount(1);
  const geo=await page.evaluate(()=>{
    const ink=document.getElementById('v76Ink');
    const surface=document.getElementById('v76Surface');
    const points=v6Project().notePages[0].strokes[0].points;
    const matrix=ink.getScreenCTM();
    const first=new DOMPoint(points[0].x,points[0].y).matrixTransform(matrix);
    const last=new DOMPoint(points.at(-1).x,points.at(-1).y).matrixTransform(matrix);
    return {
      first:{x:first.x,y:first.y},
      last:{x:last.x,y:last.y},
      viewHeight:ink.viewBox.baseVal.height,
      actualHeight:surface.clientHeight,
      storedHeight:v6Project().notePages[0].height,
      aspect:ink.getAttribute('preserveAspectRatio'),
      strokes:v6Project().notePages[0].strokes.length,
      storedFirst:v6Project().notePages[0].strokes[0].points[0]
    };
  });
  return {start,end,geo};
}
for(const viewport of [{width:834,height:1194},{width:1366,height:1024}]){
  test('Apple Pencil geometry matches contact on iPad '+viewport.width+'x'+viewport.height,async({page})=>{
    await page.setViewportSize(viewport);
    const errors=await openNotebook(page);
    const {start,end,geo}=await draw(page,true);
    expect(geo.actualHeight).toBeGreaterThan(geo.storedHeight);
    expect(geo.viewHeight).toBe(geo.actualHeight);
    expect(geo.aspect).toBe('none');
    expect(Math.hypot(geo.first.x-start.x,geo.first.y-start.y)).toBeLessThan(2);
    expect(Math.hypot(geo.last.x-end.x,geo.last.y-end.y)).toBeLessThan(2);
    expect(geo.strokes).toBe(1);
    expect(geo.storedFirst.x).toBeGreaterThan(0);
    expect(errors).toEqual([]);
    await page.reload();
    await page.locator('[data-tab="brainstorm"]').click();
    await page.locator('[data-v6-project]').filter({hasText:'Pencil alignment test'}).click();
    await expect(page.locator('#v76Ink path.v818-ink-stroke')).toHaveCount(1);
    const saved=await page.evaluate(()=>v6Project().notePages[0].strokes);
    expect(saved.length).toBe(1);
  });
}
test('notebook stays aligned for pointer input on compact and resized tablet windows',async({page})=>{
  await page.setViewportSize({width:600,height:900});
  await openNotebook(page);
  let result=await draw(page);
  expect(result.geo.viewHeight).toBe(result.geo.actualHeight);
  expect(Math.hypot(result.geo.first.x-result.start.x,result.geo.first.y-result.start.y)).toBeLessThan(2);
  await page.setViewportSize({width:390,height:844});
  await expect.poll(()=>page.evaluate(()=>{
    const surface=document.getElementById('v76Surface'),ink=document.getElementById('v76Ink');
    return ink.viewBox.baseVal.height===surface.clientHeight;
  })).toBe(true);
  await expect(page.locator('#v76Ink path.v818-ink-stroke')).toHaveCount(1);
});
test('erase and photo have descriptive SVG icons, labels and retain existing behavior',async({page})=>{
  await page.setViewportSize({width:834,height:1194});
  await openNotebook(page);
  const eraser=page.locator('[data-v76-mode="erase"]');
  const photo=page.locator('#v76AddImage');
  await expect(eraser).toHaveAttribute('aria-label',/Erase drawing strokes/);
  await expect(photo).toHaveAttribute('aria-label','Insert picture');
  await expect(eraser.locator('svg.v79-tool-svg[aria-hidden="true"]')).toBeVisible();
  await expect(photo.locator('svg.v79-tool-svg[aria-hidden="true"]')).toBeVisible();
  expect((await eraser.textContent()).trim()).toBe('');
  expect((await photo.textContent()).trim()).toBe('');
  await eraser.click();
  await expect(eraser).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#v76Surface')).toHaveClass(/v76-is-drawing/);
  await eraser.click();
  await expect(eraser).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('#v76Surface')).not.toHaveClass(/v76-is-drawing/);
  // The photo action still opens the same file input, not a destructive action.
  await page.evaluate(()=>{
    window.__imageInputActivated=false;
    document.getElementById('v76ImageInput').addEventListener('click',()=>window.__imageInputActivated=true,{once:true});
  });
  await photo.click();
  expect(await page.evaluate(()=>window.__imageInputActivated)).toBe(true);
});

test('new pen strokes are dark, smooth curves and a six-color palette persists across reloads',async({page})=>{
  const errors=await openNotebook(page);
  const colorButton=page.locator('#v818InkColor');
  await colorButton.click();
  const options=page.locator('#v818InkPalette [data-ink-color]');
  await expect(options).toHaveCount(6);
  const names=await options.evaluateAll(elements=>elements.map(el=>el.getAttribute('aria-label')));
  expect(names).toEqual(['White','Black','Red','Yellow','Blue','Green']);
  await page.locator('#v818InkPalette [aria-label="Blue"]').click();
  await expect(colorButton).toHaveAttribute('aria-label','Pen color: Blue');
  await expect(page.locator('[data-v76-mode="pen"]')).toHaveAttribute('aria-pressed','true');
  const at=await contact(page);
  await page.mouse.move(at.x,at.y);
  await page.mouse.down();
  for(let i=1;i<=8;i++)await page.mouse.move(at.x+i*8,at.y+Math.sin(i/2)*15);
  await page.mouse.up();
  const path=page.locator('#v76Ink path.v818-ink-stroke');
  await expect(path).toHaveCount(1);
  await expect(path).toHaveAttribute('stroke','#2362dd');
  const d=await path.getAttribute('d');
  expect(d).toContain(' Q');
  expect(await page.evaluate(()=>v6Project().notePages[0].strokes[0].color)).toBe('#2362dd');
  await page.reload();
  await page.locator('[data-tab="brainstorm"]').click();
  await page.locator('[data-v6-project]').filter({hasText:'Pencil alignment test'}).click();
  await expect(page.locator('#v818InkColor')).toHaveAttribute('aria-label','Pen color: Blue');
  await expect(page.locator('#v76Ink path.v818-ink-stroke')).toHaveAttribute('stroke','#2362dd');
  await page.locator('#v818InkColor').click();
  await page.locator('#v818InkPalette [aria-label="Black"]').click();
  await expect(page.locator('#v818InkColor')).toHaveAttribute('aria-label','Pen color: Black');
  await expect(page.locator('#v818InkPalette')).toBeHidden();
  expect(errors).toEqual([]);
});
