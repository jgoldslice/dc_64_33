'use strict';
const {submitSheet}=require('./sheet-helper.cjs');
const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';
test.use({browserName:'chromium',viewport:{width:1024,height:900},isMobile:true,hasTouch:true});
async function openNotes(page){
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  await page.locator('[data-tab="brainstorm"]').click();
  await page.locator('#newProject').click();
  await submitSheet(page, 'Notes Workspace QA');
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
  await penGesture(page,[[110,108],[110,108]]);
  await expect(page.locator('#v930InkContext')).toBeVisible();
  await expect(page.locator('[data-v930-action="copy"]')).toBeVisible();
  await expect(page.locator('[data-v930-action="delete"]')).toBeVisible();
  await expect(page.locator('[data-v930-action="paste"]')).toBeHidden();
  await page.locator('[data-v930-action="copy"]').click();
  await expect(page.locator('#v930InkContext')).toBeHidden();
  await penGesture(page,[[500,440],[500,440]]);
  await expect(page.locator('[data-v930-action="paste"]')).toBeVisible();
  await expect(page.locator('[data-v930-action="copy"]')).toBeHidden();
  await page.locator('[data-v930-action="paste"]').click();
  let state=await page.evaluate(()=>{
    const strokes=window.BlueprintNotesBridge.current().page.strokes;
    return {count:strokes.length,ids:strokes.map(s=>String(s.id)),
      newPoints:strokes.at(-1).points,original:strokes[0].points};
  });
  expect(state.count).toBe(3);
  expect(new Set(state.ids).size).toBe(3);
  expect(state.newPoints[0].x).toBe(500);
  expect(state.newPoints[0].y).toBe(440);
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
  await penGesture(page,[[110,108],[110,108]]);
  await expect(page.locator('[data-v930-action="delete"]')).toBeVisible();
  await page.locator('[data-v930-action="delete"]').click();
  expect(await page.evaluate(()=>window.BlueprintNotesBridge.current().page.strokes.map(s=>s.id))).toEqual(['ink-b']);
  await page.locator('#v76UndoInk').click();
  expect(await page.evaluate(()=>window.BlueprintNotesBridge.current().page.strokes.map(s=>s.id))).toEqual(['ink-a','ink-b']);
});
test('blank or graph paper is a saved preference for each page, not a bitmap overlay',async({page})=>{
  const errors=await openNotes(page);
  await expect(page.locator('#v928Paper')).toHaveAttribute('aria-pressed','false');
  await page.locator('#v928Paper').click();
  await expect(page.locator('#v928Paper')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#v76Surface')).toHaveAttribute('data-paper','graph');
  const result=await page.evaluate(()=>({
    style:window.BlueprintNotesBridge.current().page.paperStyle,
    strokeCount:window.BlueprintNotesBridge.current().page.strokes.length,
    stored:JSON.parse(localStorage.getItem('jgold-planner-v1')).projects[0].notePages[0].paperStyle
  }));
  expect(result).toEqual({style:'graph',strokeCount:0,stored:'graph'});
  await page.locator('#v811NewPage').click();
  await expect(page.locator('#v928Paper')).toHaveAttribute('aria-pressed','false');
  const first=await page.evaluate(()=>String(window.BlueprintNotesBridge.current().p.notePages[0].id));
  await page.locator('#v811PageList [data-v811-page-id="'+first+'"]').click();
  await expect(page.locator('#v928Paper')).toHaveAttribute('aria-pressed','true');
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
  await page.locator('#v928FocusPaper').click();
  await expect(page.locator('#v928FocusPaper')).toHaveAttribute('aria-pressed','true');
  await page.locator('#v928FocusExit').click();
  await expect(page.locator('#v76Editor')).not.toHaveClass(/v928-focus-mode/);
  expect(await page.evaluate(()=>document.getElementById('v76Editor').parentElement.id)).toBe('projectNotes');
  expect(await page.evaluate(()=>window.BlueprintNotesBridge.current().page.paperStyle)).toBe('graph');
  expect(errors).toEqual([]);
});

test('lasso actions are contextual and the toolbar stays compact on narrow screens',async({page})=>{
  const errors=await openNotes(page);await inkFixture(page);
  await expect(page.locator('#v928Copy,#v928Paste,#v928Delete')).toHaveCount(0);
  await expect(page.locator('#v928Lasso')).toBeVisible();
  await page.locator('#v928Lasso').click();
  await penGesture(page,[[480,420],[480,420]]);
  await expect(page.locator('#v930InkContext')).toBeHidden(); // Nothing copied yet.
  await penGesture(page,ring);
  await penGesture(page,[[110,108],[110,108]]);
  const position=await page.locator('#v930InkContext').boundingBox();
  expect(position.x).toBeGreaterThanOrEqual(0);
  expect(position.y).toBeGreaterThanOrEqual(0);
  await page.locator('[data-v930-action="copy"]').click();
  await page.setViewportSize({width:375,height:812});
  await page.locator('#v928Lasso').click(); // Select: blank paper is the paste target.
  await page.locator('#v76Surface').dispatchEvent('click',{bubbles:true,
    clientX:369,clientY:220});
  await expect(page.locator('[data-v930-action="paste"]')).toBeVisible();
  const box=await page.locator('#v930InkContext').boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x+box.width).toBeLessThanOrEqual(375);
  expect(box.y+box.height).toBeLessThanOrEqual(812);
  expect(errors).toEqual([]);
});
test('finger tap on selected writing opens Copy/Delete without selecting or moving strokes',async({page})=>{
  await openNotes(page);await inkFixture(page);
  await page.locator('#v928Lasso').click();
  await penGesture(page,ring);
  const before=await page.evaluate(()=>structuredClone(window.BlueprintNotesBridge.current().page.strokes));
  await page.evaluate(()=>{
    const ink=document.getElementById('v76Ink'),m=ink.getScreenCTM(),
      p=new DOMPoint(110,108).matrixTransform(m);
    for(const type of ['pointerdown','pointerup']){
      ink.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,
        pointerType:'touch',pointerId:77,isPrimary:true,clientX:p.x,clientY:p.y}));
    }
  });
  await expect(page.locator('[data-v930-action="copy"]')).toBeVisible();
  expect(await page.evaluate(()=>window.BlueprintNotesBridge.current().page.strokes)).toEqual(before);
});
test('blank paper in Select mode offers Paste and moving/swiping does not accidentally paste',async({page})=>{
  await openNotes(page);await inkFixture(page);
  await page.locator('#v928Lasso').click();
  await penGesture(page,ring);
  await penGesture(page,[[110,108],[110,108]]);
  await page.locator('[data-v930-action="copy"]').click();
  await page.locator('#v928Lasso').click(); // Return to ordinary Select.
  await page.locator('#v76Surface').click({position:{x:410,y:410}});
  await expect(page.locator('[data-v930-action="paste"]')).toBeVisible();
  await page.locator('[data-v930-action="paste"]').click();
  expect(await page.evaluate(()=>window.BlueprintNotesBridge.current().page.strokes.length)).toBe(3);
  await page.locator('#v928Lasso').click();
  await page.evaluate(()=>{
    const ink=document.getElementById('v76Ink'),m=ink.getScreenCTM();
    for(const [i,type] of ['pointerdown','pointermove','pointerup'].entries()){
      const p=new DOMPoint(470,420+i*50).matrixTransform(m);
      ink.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,
        pointerType:'touch',pointerId:78,isPrimary:true,clientX:p.x,clientY:p.y}));
    }
  });
  await expect(page.locator('#v930InkContext')).toBeHidden();
  expect(await page.evaluate(()=>window.BlueprintNotesBridge.current().page.strokes.length)).toBe(3);
});

test('icon-only Lasso and Graph controls sit directly after Eraser with one-tap graph toggle',async({page})=>{
  const errors=await openNotes(page);
  const toolbar=page.locator('#v76Editor .v76-toolbar');
  const buttons=await page.locator('.v79-tool-group[aria-label="Pen"] .v79-tool-buttons').evaluate(el=>
    [...el.querySelectorAll(':scope > button')].map(btn=>btn.id||btn.dataset.v76Mode)
  );
  expect(buttons).toEqual(['pen','erase','v928Lasso','v818InkColor','v76UndoInk']);
  const pageButtons=await page.locator('.v79-tool-group[aria-label="Misc"] .v79-tool-buttons').evaluate(el=>
    [...el.querySelectorAll(':scope > button')].map(btn=>btn.id)
  );
  expect(pageButtons).toEqual(['v76AddImage','v928Paper']);
  await expect(page.locator('#v928Lasso .v79-tool-svg')).toHaveCount(1);
  await expect(page.locator('#v928Paper .v79-tool-svg')).toHaveCount(1);
  await expect(toolbar.locator('.v928-paper-group')).toHaveCount(0);
  await expect(page.locator('#v928Paper')).toHaveAttribute('aria-label','Show graph paper');
  await page.locator('#v928Paper').click();
  await expect(page.locator('#v76Surface')).toHaveAttribute('data-paper','graph');
  await expect(page.locator('#v928Paper')).toHaveAttribute('aria-label','Show blank paper');
  await page.locator('#v928Paper').click();
  await expect(page.locator('#v76Surface')).toHaveAttribute('data-paper','plain');
  await expect(page.locator('#v928Paper')).toHaveAttribute('aria-pressed','false');
  await page.locator('#v928Lasso').click();
  await expect(page.locator('#v928Lasso')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('[data-v76-mode="erase"]')).toHaveAttribute('aria-pressed','false');
  await page.locator('[data-v76-mode="erase"]').click();
  await expect(page.locator('#v928Lasso')).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('[data-v76-mode="erase"]')).toHaveAttribute('aria-pressed','true');
  expect(errors).toEqual([]);
});
test('graph icon stays within responsive toolbar bounds with 44px targets',async({page})=>{
  await openNotes(page);
  for(const [width,height] of [[320,700],[375,812],[430,932],[768,1024],[1024,768],[1366,1024]]){
    await page.setViewportSize({width,height});
    const measurements=await page.locator('#v76Editor .v76-toolbar').evaluate(toolbar=>{
      const t=toolbar.getBoundingClientRect();
      return ['v928Lasso','v928Paper'].map(id=>{
        const el=document.getElementById(id),r=el.getBoundingClientRect();
        return {id,left:r.left,right:r.right,top:r.top,bottom:r.bottom,w:r.width,h:r.height,
          scrollWidth:toolbar.scrollWidth,clientWidth:toolbar.clientWidth,toolbarLeft:t.left,toolbarRight:t.right};
      });
    });
    for(const m of measurements){
      expect(m.h,width+' '+m.id).toBeGreaterThanOrEqual(44);
      expect(m.w,width+' '+m.id).toBeGreaterThanOrEqual(44);
      expect(m.left,width+' '+m.id).toBeGreaterThanOrEqual(m.toolbarLeft-2);
      expect(m.right,width+' '+m.id).toBeLessThanOrEqual(m.toolbarRight+2);
      expect(m.scrollWidth-m.clientWidth,width+' toolbar overflow').toBeLessThanOrEqual(3);
    }
  }
});
