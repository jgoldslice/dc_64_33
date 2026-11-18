'use strict';
const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';
test.use({browserName:'chromium',viewport:{width:1024,height:900},isMobile:true,hasTouch:true});
async function openNotes(page){
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  await page.locator('[data-tab="brainstorm"]').click();
  page.once('dialog',d=>d.accept('Notes Workspace QA'));
  await page.locator('#newProject').click();
  await page.locator('[data-v919-project-open="notes"]').click();
  await expect(page.locator('#v76Editor')).toBeVisible();
  await expect(page.locator('#v928Lasso')).toBeVisible();
  return errors;
}
async function inkFixture(page){
  await page.evaluate(()=>{
    const api=window.BlueprintNotesBridge,ctx=api.current();
    ctx.page.strokes=[
      {id:'ink-a',color:'#111111',width:2.5,
        points:[{x:80,y:88},{x:105,y:103},{x:130,y:115},{x:149,y:122}]},
      {id:'ink-b',color:'#d73537',width:2.5,
        points:[{x:310,y:310},{x:338,y:338},{x:370,y:361}]}
    ];
    api.persist();api.strokesView(ctx.page);
  });
}
async function penGesture(page,points){
  await page.evaluate(points=>{
    const ink=document.getElementById('v76Ink');
    const matrix=ink.getScreenCTM();
    const fire=(type,pt)=>{
      const p=new DOMPoint(pt[0],pt[1]).matrixTransform(matrix);
      const e=new PointerEvent(type,{bubbles:true,cancelable:true,
        pointerId:928,pointerType:'pen',isPrimary:true,button:0,
        clientX:p.x,clientY:p.y});
      ink.dispatchEvent(e);
    };
    fire('pointerdown',points[0]);
    for(const pt of points.slice(1,-1))fire('pointermove',pt);
    fire('pointerup',points.at(-1));
  },points);
}
const ring=[[52,58],[180,58],[180,165],[52,165],[52,58]];

test('vector lasso selects only intersecting strokes, copies, pastes and survives reload',async({page})=>{
  const errors=await openNotes(page);await inkFixture(page);
  await page.locator('#v928Lasso').click();
  await penGesture(page,ring);
  await expect(page.locator('#v76Ink .v928-selected-stroke')).toHaveCount(1);
  await expect(page.locator('#v928Copy')).toBeEnabled();
  await page.locator('#v928Copy').click();
  await page.locator('#v928Paste').click();
  let state=await page.evaluate(()=>{
    const strokes=window.BlueprintNotesBridge.current().page.strokes;
    return {count:strokes.length,ids:strokes.map(s=>String(s.id)),
      newPoints:strokes.at(-1).points,original:strokes[0].points};
  });
  expect(state.count).toBe(3);
  expect(new Set(state.ids).size).toBe(3);
  expect(state.newPoints[0].x).toBe(state.original[0].x+24);
  await page.reload();
  expect(await page.evaluate(()=>state.projects[0].notePages[0].strokes.length)).toBe(3);
  expect(errors).toEqual([]);
});
test('lasso move and Undo restore exact original editable points',async({page})=>{
  await openNotes(page);await inkFixture(page);
  await page.locator('#v928Lasso').click();
  await penGesture(page,ring);
  const before=await page.evaluate(()=>structuredClone(window.BlueprintNotesBridge.current().page.strokes[0].points));
  await penGesture(page,[[110,108],[142,131],[142,131]]);
  const after=await page.evaluate(()=>window.BlueprintNotesBridge.current().page.strokes[0].points);
  expect(after[0].x).toBeGreaterThan(before[0].x+20);
  expect(after[0].y).toBeGreaterThan(before[0].y+10);
  await page.locator('#v76UndoInk').click();
  expect(await page.evaluate(()=>window.BlueprintNotesBridge.current().page.strokes[0].points)).toEqual(before);
  expect(await page.evaluate(()=>window.BlueprintNotesBridge.current().page.strokes.length)).toBe(2);
});
test('delete selected ink can be undone without changing unrelated strokes',async({page})=>{
  await openNotes(page);await inkFixture(page);
  await page.locator('#v928Lasso').click();
  await penGesture(page,ring);
  await page.locator('#v928Delete').click();
  expect(await page.evaluate(()=>window.BlueprintNotesBridge.current().page.strokes.map(s=>s.id))).toEqual(['ink-b']);
  await page.locator('#v76UndoInk').click();
  expect(await page.evaluate(()=>window.BlueprintNotesBridge.current().page.strokes.map(s=>s.id))).toEqual(['ink-a','ink-b']);
});
test('blank or graph paper is a saved preference for each page, not a bitmap overlay',async({page})=>{
  const errors=await openNotes(page);
  await page.locator('#v928Paper').selectOption('graph');
  await expect(page.locator('#v76Surface')).toHaveAttribute('data-paper','graph');
  const result=await page.evaluate(()=>({
    style:window.BlueprintNotesBridge.current().page.paperStyle,
    strokeCount:window.BlueprintNotesBridge.current().page.strokes.length,
    stored:JSON.parse(localStorage.getItem('jgold-planner-v1')).projects[0].notePages[0].paperStyle
  }));
  expect(result).toEqual({style:'graph',strokeCount:0,stored:'graph'});
  await page.locator('#v811NewPage').click();
  await expect(page.locator('#v928Paper')).toHaveValue('plain');
  const first=await page.evaluate(()=>String(window.BlueprintNotesBridge.current().p.notePages[0].id));
  await page.locator('#v811PageList [data-v811-page-id="'+first+'"]').click();
  await expect(page.locator('#v928Paper')).toHaveValue('graph');
  expect(errors).toEqual([]);
});
test('focus mode hides navigation, expands paper and restores the same notebook afterwards',async({page})=>{
  const errors=await openNotes(page);
  await page.locator('#v928Focus').click();
  await expect(page.locator('#v76Editor')).toHaveClass(/v928-focus-mode/);
  await expect(page.locator('#v811PageList')).toBeHidden();
  await expect(page.locator('#v928FocusExit')).toBeVisible();
  const focusMetrics=await page.evaluate(()=>({
    parent:document.getElementById('v76Editor').parentElement.tagName,
    viewport:document.getElementById('v815ZoomViewport').getBoundingClientRect().height,
    window:innerHeight
  }));
  expect(focusMetrics.parent).toBe('BODY');
  expect(focusMetrics.viewport).toBeGreaterThan(focusMetrics.window-20);
  await page.locator('#v928FocusTools').click();
  await page.locator('[data-v928-mode="lasso"]').click();
  await expect(page.locator('#v928Lasso')).toHaveAttribute('aria-pressed','true');
  await page.locator('#v928FocusTools').click();
  await page.locator('#v928FocusPaper').selectOption('graph');
  await page.locator('#v928FocusExit').click();
  await expect(page.locator('#v76Editor')).not.toHaveClass(/v928-focus-mode/);
  expect(await page.evaluate(()=>document.getElementById('v76Editor').parentElement.id)).toBe('projectNotes');
  expect(await page.evaluate(()=>window.BlueprintNotesBridge.current().page.paperStyle)).toBe('graph');
  expect(errors).toEqual([]);
});
