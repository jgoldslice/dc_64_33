'use strict';
const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';
test.use({browserName:'chromium',viewport:{width:1024,height:900},isMobile:true,hasTouch:true});

async function openNotes(page){
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  await page.locator('[data-tab="brainstorm"]').click();
  page.once('dialog',d=>d.accept('Ink Response QA'));
  await page.locator('#newProject').click();
  await page.locator('[data-v919-project-open="notes"]').click();
  await expect(page.locator('#v76Ink')).toBeVisible();
  await page.locator('[data-v76-mode="pen"]').click();
  return errors;
}
const fastInk=String.raw`
  const api=window.BlueprintNotesBridge,ink=api.ink;
  const initial=ink.getScreenCTM();
  const makeEvent=(type,{x,y,p=.5,pointerType='pen',id=932,coalesced=null})=>{
    const screen=new DOMPoint(x,y).matrixTransform(initial);
    const evt=new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:id,
      pointerType,isPrimary:true,button:0,buttons:1,pressure:p,
      clientX:screen.x,clientY:screen.y});
    if(coalesced)Object.defineProperty(evt,'getCoalescedEvents',{value:()=>coalesced.map(pt=>
      makeEvent('pointermove',{...pt,id,pointerType}))});
    return evt;
  };
  const originalCapture=ink.setPointerCapture;
  ink.setPointerCapture=()=>{};
  try{
    const down=makeEvent('pointerdown',{x:95,y:90,p:.12});
    ink.dispatchEvent(down);
    const element=ink.querySelector('.v818-ink-stroke');
    const immediateDot={d:element.getAttribute('d'),fill:element.getAttribute('fill'),
      stroke:element.getAttribute('stroke'),points:api.current().page.strokes[0].points.length};
    const move=makeEvent('pointermove',{x:132,y:120,p:.88});
    ink.dispatchEvent(move);
    const live={d:element.getAttribute('d'),fill:element.getAttribute('fill'),
      stroke:element.getAttribute('stroke'),pathAttached:element.isConnected};
    ink.dispatchEvent(makeEvent('pointerup',{x:154,y:135,p:.45}));
    const finished={d:element.getAttribute('d'),fill:element.getAttribute('fill'),
      stroke:element.getAttribute('stroke'),points:api.current().page.strokes[0].points};
    return {immediateDot,live,finished};
  }finally{ink.setPointerCapture=originalCapture;}
`;

test('first Pencil dot and first movement are visible before any animation-frame callback',async({page})=>{
  const errors=await openNotes(page);
  const result=await page.evaluate(()=>{
    const api=window.BlueprintNotesBridge,ink=api.ink,matrix=ink.getScreenCTM(),
      originalCapture=ink.setPointerCapture,originalFrame=window.requestAnimationFrame;
    ink.setPointerCapture=()=>{};
    // With rAF deliberately deferred, first-contact feedback must still exist.
    let requestedFrames=0;
    window.requestAnimationFrame=()=>{requestedFrames++;return 1392;};
    try{
      const ev=(type,x,y,pressure)=>{
        const p=new DOMPoint(x,y).matrixTransform(matrix);
        return new PointerEvent(type,{bubbles:true,cancelable:true,
          pointerId:932,pointerType:'pen',isPrimary:true,button:0,
          pressure,clientX:p.x,clientY:p.y});
      };
      ink.dispatchEvent(ev('pointerdown',95,90,.12));
      const element=ink.querySelector('.v818-ink-stroke');
      const dot={d:element.getAttribute('d'),fill:element.getAttribute('fill'),
        stroke:element.getAttribute('stroke')};
      ink.dispatchEvent(ev('pointermove',125,119,.85));
      const live={d:element.getAttribute('d'),fill:element.getAttribute('fill'),
        attached:element.isConnected};
      ink.dispatchEvent(ev('pointerup',155,142,.47));
      return {dot,live,requestedFrames,
        final:{d:element.getAttribute('d'),fill:element.getAttribute('fill')},
        saved:api.current().page.strokes[0].points};
    }finally{
      ink.setPointerCapture=originalCapture;
      window.requestAnimationFrame=originalFrame;
    }
  });
  expect(result.dot.d).toContain('l0.01 0');
  expect(result.dot.fill).toBe('none');
  expect(result.dot.stroke).toBe('#111111');
  expect(result.live.d).toContain(' L125 119');
  expect(result.live.attached).toBe(true);
  expect(result.requestedFrames).toBe(0);
  expect(result.final.d).toContain('Z');
  expect(result.final.fill).toBe('#111111');
  expect(result.saved.some(p=>p.p>.8)).toBe(true);
  expect(errors).toEqual([]);
});

test('coalesced Pencil samples use one geometry transform and all pressure samples remain saved',async({page})=>{
  const errors=await openNotes(page);
  const result=await page.evaluate(()=>{
    const api=window.BlueprintNotesBridge,ink=api.ink,matrix=ink.getScreenCTM(),
      originalCapture=ink.setPointerCapture,originalGet=ink.getScreenCTM;
    ink.setPointerCapture=()=>{};
    try{
      const event=(type,x,y,p=.5)=>{
        const pt=new DOMPoint(x,y).matrixTransform(matrix);
        return new PointerEvent(type,{bubbles:true,cancelable:true,
          pointerId:933,pointerType:'pen',isPrimary:true,button:0,
          clientX:pt.x,clientY:pt.y,pressure:p});
      };
      ink.dispatchEvent(event('pointerdown',50,70,.3));
      const samples=Array.from({length:180},(_,i)=>event('pointermove',
        52+i*1.2,73+i*.35,.1+(.8*i/179)));
      let geometryCalls=0;
      ink.getScreenCTM=function(){geometryCalls++;return originalGet.call(ink);};
      try{
        const batch=event('pointermove',266.8,135.65,.9);
        Object.defineProperty(batch,'getCoalescedEvents',{value:()=>samples});
        ink.dispatchEvent(batch);
      }finally{ink.getScreenCTM=originalGet;}
      const livePath=ink.querySelector('.v818-ink-stroke').getAttribute('d');
      ink.dispatchEvent(event('pointerup',266.8,135.65,.9));
      const stroke=api.current().page.strokes.at(-1);
      return {geometryCalls,liveLength:livePath.length,
        totalPoints:stroke.points.length,firstPressure:stroke.points[0].p,
        maxPressure:Math.max(...stroke.points.map(p=>p.p)),
        finalPath:ink.querySelector('.v818-ink-stroke').getAttribute('d'),
        persisted:JSON.parse(localStorage.getItem('jgold-planner-v1')).projects[0].notePages[0].strokes.at(-1).points.length};
    }finally{ink.setPointerCapture=originalCapture;}
  });
  expect(result.geometryCalls).toBe(1);
  expect(result.liveLength).toBeGreaterThan(15);
  expect(result.totalPoints).toBe(182);
  expect(result.maxPressure).toBeGreaterThan(.85);
  expect(result.firstPressure).toBeCloseTo(.3,2);
  expect(result.finalPath).toContain(' Q');
  expect(result.persisted).toBe(182);
  expect(errors).toEqual([]);
});

test('resizing while Pencil moves preserves the same live stroke path and its undo',async({page})=>{
  await openNotes(page);
  const result=await page.evaluate(()=>{
    const api=window.BlueprintNotesBridge,ink=api.ink,m=ink.getScreenCTM();
    const orig=ink.setPointerCapture;ink.setPointerCapture=()=>{};
    const fire=(type,x,y)=>{
      const p=new DOMPoint(x,y).matrixTransform(m);
      ink.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,
        pointerType:'pen',pointerId:934,isPrimary:true,button:0,
        pressure:.7,clientX:p.x,clientY:p.y}));
    };
    try{
      fire('pointerdown',190,180);
      fire('pointermove',225,195);
      const before=ink.lastElementChild;
      const beforePath=before.getAttribute('d');
      window.dispatchEvent(new Event('resize'));
      const during=ink.lastElementChild;
      fire('pointerup',250,210);
      return {sameElement:before===during,attached:during.isConnected,
        beforePath,finished:during.getAttribute('d'),total:api.current().page.strokes.length};
    }finally{ink.setPointerCapture=orig;}
  });
  expect(result.sameElement).toBe(true);
  expect(result.attached).toBe(true);
  expect(result.beforePath).toContain(' L225 195');
  expect(result.finished).toContain('Z');
  expect(result.total).toBe(1);
  await page.locator('#v76UndoInk').click();
  expect(await page.evaluate(()=>window.BlueprintNotesBridge.current().page.strokes.length)).toBe(0);
});

test('desktop mouse still creates fixed-width editable strokes and undo works',async({page})=>{
  await openNotes(page);
  const result=await page.evaluate(()=>{
    const api=window.BlueprintNotesBridge,ink=api.ink,m=ink.getScreenCTM();
    const orig=ink.setPointerCapture;ink.setPointerCapture=()=>{};
    const fire=(type,x,y)=>{
      const p=new DOMPoint(x,y).matrixTransform(m);
      ink.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,
        pointerType:'mouse',pointerId:935,isPrimary:true,button:0,
        pressure:.5,clientX:p.x,clientY:p.y}));
    };
    try{
      fire('pointerdown',120,145);
      fire('pointermove',165,185);
      fire('pointerup',185,201);
      const stroke=api.current().page.strokes[0];
      const path=ink.querySelector('.v818-ink-stroke');
      return {legacyNoPressure:stroke.points.every(p=>p.p===undefined),
        d:path.getAttribute('d'),fill:path.getAttribute('fill'),
        stroke:path.getAttribute('stroke')};
    }finally{ink.setPointerCapture=orig;}
  });
  expect(result.legacyNoPressure).toBe(true);
  expect(result.fill).toBe('none');
  expect(result.stroke).toBe('#111111');
  expect(result.d).toContain(' Q');
  await page.locator('#v76UndoInk').click();
  expect(await page.evaluate(()=>window.BlueprintNotesBridge.current().page.strokes.length)).toBe(0);
});
