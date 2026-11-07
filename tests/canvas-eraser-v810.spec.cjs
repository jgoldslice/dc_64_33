const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';
test.use({browserName:'chromium',viewport:{width:834,height:1194},isMobile:true,hasTouch:true});

async function openNotebook(page){
  const errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  await page.goto(base);
  await page.locator('[data-tab="brainstorm"]').click();
  page.once('dialog',dialog=>dialog.accept('Eraser sweep test'));
  await page.locator('#newProject').click();
  await expect(page.locator('#v76Editor')).toBeVisible();
  return errors;
}

async function loadStrokes(page,strokes){
  await page.evaluate(strokes=>{
    const p=v6Project();
    const pg=p.notePages.find(x=>String(x.id)===String(p.activeNotePageId));
    if(!pg)throw Error('Page missing');
    pg.strokes=strokes;
    if(!save())throw Error('Could not seed strokes');
  },strokes);
  await page.reload();
  await page.locator('[data-tab="brainstorm"]').click();
  await page.locator('[data-v6-project]').filter({hasText:'Eraser sweep test'}).click();
  await expect(page.locator('#v76Editor')).toBeVisible();
  await expect(page.locator('#v76Ink path.v818-ink-stroke')).toHaveCount(strokes.length);
}
async function selectEraser(page){
  const eraser=page.locator('[data-v76-mode="erase"]');
  await eraser.click();
  await expect(eraser).toHaveAttribute('aria-pressed','true');
  await page.evaluate(()=>document.getElementById('v76Ink').scrollIntoView({block:'start'}));
}
async function viewportAtInk(page,{x,y}){
  return page.evaluate(({x,y})=>{
    const svg=document.getElementById('v76Ink'),m=svg.getScreenCTM();
    const pt=new DOMPoint(x,y).matrixTransform(m);
    return {x:pt.x,y:pt.y};
  },{x,y});
}
async function mouseSweep(page,start,end){
  const a=await viewportAtInk(page,start),b=await viewportAtInk(page,end);
  await page.mouse.move(a.x,a.y);
  await page.mouse.down();
  await page.mouse.move(b.x,b.y,{steps:12});
  await page.mouse.up();
}
async function penSweep(page,start,end){
  const a=await viewportAtInk(page,start),b=await viewportAtInk(page,end);
  const cdp=await page.context().newCDPSession(page);
  try{
    await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:a.x,y:a.y,buttons:0,pointerType:'pen'});
    await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x:a.x,y:a.y,button:'left',buttons:1,clickCount:1,pointerType:'pen'});
    for(let i=1;i<=7;i++){
      const t=i/7;
      await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,button:'left',buttons:1,pointerType:'pen'});
    }
    await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:b.x,y:b.y,button:'left',buttons:0,clickCount:1,pointerType:'pen'});
  }finally{await cdp.detach();}
}
function line(id,x1,y1,x2,y2){
  return {id,points:[{x:x1,y:y1},{x:x2,y:y2}],width:2.5,color:'#c6ae83'};
}

test('toolbar has clean eraser icon with no internal slash, and no Text/Pen/Misc headings',async({page})=>{
  const errors=await openNotebook(page);
  await expect(page.locator('.v79-tool-title')).toHaveCount(0);
  await expect(page.locator('.v79-tool-group[aria-label="Text"]')).toHaveCount(1);
  await expect(page.locator('.v79-tool-group[aria-label="Pen"]')).toHaveCount(1);
  await expect(page.locator('.v79-tool-group[aria-label="Misc"]')).toHaveCount(1);
  const eraser=page.locator('[data-v76-mode="erase"]');
  await expect(eraser.locator('svg.v79-tool-svg')).toBeVisible();
  expect(await eraser.locator('path').count()).toBe(2);
  const paths=await eraser.locator('path').evaluateAll(els=>els.map(x=>x.getAttribute('d')));
  expect(paths.join(' ')).not.toContain('m5 11 8 8');
  expect(paths.join(' ')).not.toContain('m5.5 12.5 6 6');
  await expect(eraser).toHaveAttribute('aria-label',/Erase drawing strokes/);
  await expect(page.locator('#v76AddImage')).toHaveAttribute('aria-label','Insert picture');
  expect(errors).toEqual([]);
});

test('dragging the eraser across several strokes removes every crossed stroke and saves',async({page})=>{
  const errors=await openNotebook(page);
  await loadStrokes(page,[
    line('stroke-a',80,110,80,310),
    line('stroke-b',140,110,140,310),
    line('stroke-c',200,110,200,310),
    line('stroke-untouched',340,110,340,310)
  ]);
  const objects=await page.evaluate(()=>v6Project().notePages[0].objects.length);
  await selectEraser(page);
  await mouseSweep(page,{x:35,y:205},{x:237,y:205});
  await expect(page.locator('#v76Ink path.v818-ink-stroke')).toHaveCount(1);
  expect(await page.evaluate(()=>v6Project().notePages[0].strokes.map(s=>s.id))).toEqual(['stroke-untouched']);
  expect(await page.evaluate(()=>v6Project().notePages[0].objects.length)).toBe(objects);
  await page.reload();
  await page.locator('[data-tab="brainstorm"]').click();
  await page.locator('[data-v6-project]').filter({hasText:'Eraser sweep test'}).click();
  await expect(page.locator('#v76Ink path.v818-ink-stroke')).toHaveCount(1);
  expect(await page.evaluate(()=>v6Project().notePages[0].strokes.map(s=>s.id))).toEqual(['stroke-untouched']);
  expect(errors).toEqual([]);
});

test('crossing the middle of a sparse line erases it even when no saved point is near the eraser',async({page})=>{
  await openNotebook(page);
  await loadStrokes(page,[line('sparse',40,220,320,220),line('far',45,400,320,400)]);
  await selectEraser(page);
  await mouseSweep(page,{x:180,y:120},{x:180,y:295});
  await expect(page.locator('#v76Ink path.v818-ink-stroke')).toHaveCount(1);
  expect(await page.evaluate(()=>v6Project().notePages[0].strokes[0].id)).toBe('far');
});

test('eraser still removes one touched stroke on a simple tap and leaves distant strokes alone',async({page})=>{
  await openNotebook(page);
  await loadStrokes(page,[line('near',70,150,70,290),line('far',275,150,275,290)]);
  await selectEraser(page);
  const at=await viewportAtInk(page,{x:70,y:190});
  await page.mouse.move(at.x,at.y);
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.locator('#v76Ink path.v818-ink-stroke')).toHaveCount(1);
  expect(await page.evaluate(()=>v6Project().notePages[0].strokes.map(s=>s.id))).toEqual(['far']);
});

test('simulated Apple Pencil drag works on iPad landscape and preserves the original pen mode',async({page})=>{
  await page.setViewportSize({width:1366,height:1024});
  await openNotebook(page);
  await loadStrokes(page,[
    line('pencil-a',80,80,80,280),
    line('pencil-b',165,80,165,280),
    line('pencil-untouched',380,80,380,280)
  ]);
  await selectEraser(page);
  await penSweep(page,{x:35,y:180},{x:215,y:180});
  await expect(page.locator('#v76Ink path.v818-ink-stroke')).toHaveCount(1);
  expect(await page.evaluate(()=>v6Project().notePages[0].strokes[0].id)).toBe('pencil-untouched');
  await page.locator('[data-v76-mode="erase"]').click();
  await expect(page.locator('[data-v76-mode="erase"]')).toHaveAttribute('aria-pressed','false');
  await page.locator('[data-v76-mode="pen"]').click();
  await expect(page.locator('[data-v76-mode="pen"]')).toHaveAttribute('aria-pressed','true');
  expect(await page.evaluate(()=>v6Project().notePages[0].strokes.length)).toBe(1);
});

test('an eraser gesture on blank paper does not delete other marks',async({page})=>{
  await openNotebook(page);
  await loadStrokes(page,[line('top',50,90,250,90),line('bottom',50,420,250,420)]);
  await selectEraser(page);
  await mouseSweep(page,{x:40,y:255},{x:290,y:255});
  await expect(page.locator('#v76Ink path.v818-ink-stroke')).toHaveCount(2);
});
