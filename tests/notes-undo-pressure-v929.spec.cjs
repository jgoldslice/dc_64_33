'use strict';
const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';
test.use({browserName:'chromium',viewport:{width:1024,height:900},isMobile:true,hasTouch:true});
async function openNotebook(page){
  const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
  await page.goto(base);
  await page.locator('[data-tab="brainstorm"]').click();
  page.once('dialog',d=>d.accept('Pressure and Ink Undo'));
  await page.locator('#newProject').click();
  await page.locator('[data-v919-project-open="notes"]').click();
  await expect(page.locator('#v76Ink')).toBeVisible();
  return pageErrors;
}
async function seedInk(page){
  await page.evaluate(()=>{
    const api=window.BlueprintNotesBridge,ctx=api.current();
    ctx.page.strokes=[
      {id:'original-one',color:'#101010',width:2.5,
        points:[{x:105,y:100},{x:140,y:105},{x:175,y:110}]},
      {id:'original-two',color:'#db3333',width:2.5,
        points:[{x:295,y:225,p:.2},{x:325,y:250,p:.8},{x:360,y:270,p:.3}]},
      {id:'untouched',color:'#3333dd',width:2.5,
        points:[{x:600,y:475},{x:670,y:500}]}
    ];
    api.persist();api.strokesView(ctx.page);
  });
}
async function stroke(page,mode,sequence){
  await page.locator('[data-v76-mode="'+mode+'"]').click();
  await page.evaluate(({sequence,mode})=>{
    const api=window.BlueprintNotesBridge,ink=api.ink,matrix=ink.getScreenCTM();
    // Synthetic stylus contact: browser integration, not a hardware Pencil test.
    const original=ink.setPointerCapture;
    ink.setPointerCapture=()=>{};
    try{
      sequence.forEach((item,i)=>{
        const p=new DOMPoint(item.x,item.y).matrixTransform(matrix);
        const type=i===0?'pointerdown':i===sequence.length-1?'pointerup':'pointermove';
        ink.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,
          pointerId:289,pointerType:'pen',isPrimary:true,button:0,
          pressure:item.p??.5,clientX:p.x,clientY:p.y}));
      });
    }finally{ink.setPointerCapture=original;}
  },{mode,sequence});
}
async function eraseWithCancel(page){
  await page.locator('[data-v76-mode="erase"]').click();
  await page.evaluate(()=>{
    const ink=window.BlueprintNotesBridge.ink,m=ink.getScreenCTM();
    const orig=ink.setPointerCapture;ink.setPointerCapture=()=>{};
    try{
      for(const [type,x,y] of [
        ['pointerdown',125,105],['pointermove',155,109],['pointercancel',155,109]]){
        const p=new DOMPoint(x,y).matrixTransform(m);
        ink.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,
          pointerId:290,pointerType:'pen',isPrimary:true,button:0,pressure:.5,
          clientX:p.x,clientY:p.y}));
      }
    }finally{ink.setPointerCapture=orig;}
  });
}
const ids=page=>page.evaluate(()=>window.BlueprintNotesBridge.current().page.strokes.map(s=>String(s.id)));

test('an eraser sweep restores multiple original strokes, order, and pressure points with Undo',async({page})=>{
  const errors=await openNotebook(page);await seedInk(page);
  const before=await page.evaluate(()=>structuredClone(window.BlueprintNotesBridge.current().page.strokes));
  await stroke(page,'erase',[
    {x:121,y:106},{x:180,y:126},{x:275,y:217},{x:350,y:260}
  ]);
  expect(await ids(page)).toEqual(['untouched']);
  await page.locator('#v76UndoInk').click();
  expect(await page.evaluate(()=>window.BlueprintNotesBridge.current().page.strokes)).toEqual(before);
  expect(errors).toEqual([]);
});
test('Undo reverses a new drawing before restoring the previous eraser gesture',async({page})=>{
  await openNotebook(page);await seedInk(page);
  await stroke(page,'erase',[{x:125,y:104},{x:145,y:108}]);
  expect(await ids(page)).toEqual(['original-two','untouched']);
  await stroke(page,'pen',[{x:430,y:130,p:.1},{x:470,y:170,p:.85},{x:510,y:190,p:.45}]);
  expect((await ids(page)).length).toBe(3);
  await page.locator('#v76UndoInk').click();
  expect(await ids(page)).toEqual(['original-two','untouched']);
  await page.locator('#v76UndoInk').click();
  expect(await ids(page)).toEqual(['original-one','original-two','untouched']);
});
test('canceling the eraser restores the page and adds no Undo command',async({page})=>{
  await openNotebook(page);await seedInk(page);
  await eraseWithCancel(page);
  expect(await ids(page)).toEqual(['original-one','original-two','untouched']);
  await page.locator('#v76UndoInk').click();
  expect(await ids(page)).toEqual(['original-one','original-two','untouched']);
});
test('Pencil pressure is stored for new ink and drawn as variable-width filled SVG, legacy strokes unchanged',async({page})=>{
  const errors=await openNotebook(page);await seedInk(page);
  await stroke(page,'pen',[
    {x:430,y:130,p:.12},{x:470,y:170,p:.85},{x:510,y:190,p:.35}
  ]);
  const result=await page.evaluate(()=>{
    const ctx=window.BlueprintNotesBridge.current(),last=ctx.page.strokes.at(-1);
    const paths=[...document.querySelectorAll('#v76Ink .v818-ink-stroke')];
    const saved=JSON.parse(localStorage.getItem('jgold-planner-v1'));
    return {
      pressure:last.points.map(pt=>pt.p),
      fill:paths.at(-1).getAttribute('fill'),
      line:paths.at(-1).getAttribute('stroke'),
      svgPath:paths.at(-1).getAttribute('d'),
      oldFill:paths[0].getAttribute('fill'),
      oldStroke:paths[0].getAttribute('stroke'),
      backupPressure:saved.projects[0].notePages[0].strokes.at(-1).points.map(pt=>pt.p)
    };
  });
  expect(result.pressure[0]).toBeCloseTo(.12,2);
  expect(result.pressure.some(p=>p>.8)).toBe(true);
  expect(result.pressure.at(-1)).toBeCloseTo(.35,2);
  expect(result.fill).toBe('#111111');
  expect(result.line).toBe('none');
  expect(result.svgPath).toContain('Q');
  expect(result.svgPath).toContain('Z');
  expect(result.oldFill).toBe('none');
  expect(result.oldStroke).toBe('#101010');
  expect(result.backupPressure).toEqual(result.pressure);
  await page.reload();
  await page.locator('[data-tab="brainstorm"]').click();
  await page.evaluate(()=>v6OpenProject(state.projects[0].id));
  await page.locator('[data-v919-project-open="notes"]').click();
  expect(await page.evaluate(()=>window.BlueprintNotesBridge.current().page.strokes.at(-1).points.map(p=>p.p))).toEqual(result.pressure);
  expect(errors).toEqual([]);
});
test('one Pencil tap makes a visible filled dot with adjustable pressure',async({page})=>{
  await openNotebook(page);
  await stroke(page,'pen',[{x:190,y:170,p:.9},{x:190,y:170,p:0}]);
  const dot=await page.evaluate(()=>{
    const path=document.querySelector('#v76Ink .v818-ink-stroke');
    return {d:path?.getAttribute('d'),fill:path?.getAttribute('fill')};
  });
  expect(dot.fill).toBe('#111111');
  expect(dot.d).toContain(' a');
  expect(dot.d).toContain('Z');
});

test('Focus tools and Command-Z use the same Undo history for pressure ink',async({page})=>{
  await openNotebook(page);
  await stroke(page,'pen',[{x:180,y:160,p:.2},{x:215,y:182,p:.8},{x:240,y:190,p:.5}]);
  expect((await ids(page)).length).toBe(1);
  await page.locator('#v928Focus').click();
  await page.locator('#v928FocusTools').click();
  await expect(page.locator('[data-v928-action="undo"]')).toBeVisible();
  await page.locator('[data-v928-action="undo"]').click();
  expect(await ids(page)).toEqual([]);
  await page.locator('#v928FocusExit').click();
  await stroke(page,'pen',[{x:150,y:120,p:.3},{x:160,y:130,p:.6}]);
  expect((await ids(page)).length).toBe(1);
  await page.keyboard.press('Control+z');
  expect(await ids(page)).toEqual([]);
});
