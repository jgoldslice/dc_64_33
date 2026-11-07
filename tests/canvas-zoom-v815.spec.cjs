const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';
test.use({browserName:'chromium',viewport:{width:1366,height:1024},isMobile:true,hasTouch:true});

async function openNotebook(page,name='Zoom Test'){
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  await page.locator('[data-tab="brainstorm"]').click();
  page.once('dialog',d=>d.accept(name));
  await page.locator('#newProject').click();
  await expect(page.locator('#v76Editor')).toBeVisible();
  await expect(page.locator('#v815ZoomReset')).toHaveText('100%');
  return errors;
}
async function zoomTo(page,target){
  // Test only the user-visible toolbar controls, not private zoom state.
  for(let i=0;i<12;i++){
    const current=Number((await page.locator('#v815ZoomReset').textContent()).replace('%',''));
    if(current===target)return;
    if(current<target)await page.locator('#v815ZoomIn').click();
    else await page.locator('#v815ZoomOut').click();
  }
  throw Error('Zoom '+target+'% was not reached');
}
async function metrics(page){
  return page.evaluate(()=>{
    const viewport=document.getElementById('v815ZoomViewport');
    const stage=document.getElementById('v815ZoomStage');
    const surface=document.getElementById('v76Surface');
    const ink=document.getElementById('v76Ink');
    return {
      wrapWidth:viewport.clientWidth,
      stageWidth:stage.getBoundingClientRect().width,
      stageHeight:stage.getBoundingClientRect().height,
      paperWidth:surface.getBoundingClientRect().width,
      paperHeight:surface.getBoundingClientRect().height,
      baseWidth:surface.clientWidth,
      baseHeight:surface.clientHeight,
      inkViewWidth:ink.viewBox.baseVal.width,
      inkViewHeight:ink.viewBox.baseVal.height,
      cssTransform:getComputedStyle(surface).transform,
      zoomText:document.getElementById('v815ZoomReset').textContent,
      documentOverflow:document.documentElement.scrollWidth-innerWidth
    };
  });
}
function approx(a,b,tol=3){
  expect(Math.abs(a-b)).toBeLessThanOrEqual(tol);
}

test('zoom tools start at 100%, and both limits stop safely at 50% and 500%',async({page})=>{
  const errors=await openNotebook(page);
  await expect(page.locator('#v815ZoomOut')).toBeVisible();
  await expect(page.locator('#v815ZoomIn')).toBeVisible();
  await expect(page.locator('#v815ZoomReset')).toHaveText('100%');
  await zoomTo(page,500);
  await expect(page.locator('#v815ZoomIn')).toBeDisabled();
  const max=await metrics(page);
  approx(max.paperWidth,max.baseWidth*5,4);
  approx(max.stageHeight,max.baseHeight*5,4);
  expect(max.documentOverflow).toBeLessThanOrEqual(2);
  await zoomTo(page,50);
  await expect(page.locator('#v815ZoomOut')).toBeDisabled();
  const min=await metrics(page);
  approx(min.paperWidth,min.baseWidth*.5,4);
  await page.locator('#v815ZoomReset').click();
  await expect(page.locator('#v815ZoomReset')).toHaveText('100%');
  const normal=await metrics(page);
  approx(normal.paperWidth,normal.wrapWidth,2);
  expect(errors).toEqual([]);
});

test('zoom scales note images, text and ink together without modifying saved page data',async({page})=>{
  const errors=await openNotebook(page);
  const before=await page.evaluate(()=>JSON.stringify({
    pages:v6Project().notePages,library:v6Project().library
  }));
  const normal=await metrics(page);
  await zoomTo(page,200);
  const larger=await metrics(page);
  approx(larger.paperWidth,2*normal.paperWidth,4);
  approx(larger.paperHeight,2*normal.paperHeight,4);
  approx(larger.stageWidth,larger.paperWidth,3);
  approx(larger.inkViewWidth,larger.baseWidth,2);
  approx(larger.inkViewHeight,larger.baseHeight,2);
  const after=await page.evaluate(()=>JSON.stringify({
    pages:v6Project().notePages,library:v6Project().library
  }));
  expect(after).toBe(before);
  await page.locator('#v815ZoomReset').click();
  const reset=await metrics(page);
  approx(reset.paperWidth,normal.paperWidth,2);
  expect(errors).toEqual([]);
});

test('pinch gesture zooms at midpoint, clamps at 500% and never creates text boxes',async({page})=>{
  const errors=await openNotebook(page);
  const initial=await page.locator('#v76Surface .v76-text').count();
  async function pinch(ratio){
    return page.evaluate(ratio=>{
      const target=document.getElementById('v815ZoomViewport');
      const rect=target.getBoundingClientRect();
      const cx=rect.left+Math.min(170,rect.width/2);
      const cy=Math.min(innerHeight-100,Math.max(100,rect.top+190));
      const touches=(radius)=>[
        new Touch({identifier:1,target,clientX:cx-radius,clientY:cy}),
        new Touch({identifier:2,target,clientX:cx+radius,clientY:cy})
      ];
      const dispatch=(type,list)=>{
        const event=new TouchEvent(type,{bubbles:true,cancelable:true,
          touches:list,targetTouches:list,changedTouches:list});
        target.dispatchEvent(event);return event.defaultPrevented;
      };
      const start=dispatch('touchstart',touches(35));
      const moved=dispatch('touchmove',touches(35*ratio));
      dispatch('touchend',[]);
      return {start,moved};
    },ratio);
  }
  const zoomed=await pinch(3);
  expect(zoomed.start).toBe(true);
  expect(zoomed.moved).toBe(true);
  await expect(page.locator('#v815ZoomReset')).toHaveText('300%');
  await pinch(3);
  await expect(page.locator('#v815ZoomReset')).toHaveText('500%');
  await pinch(.001);
  await expect(page.locator('#v815ZoomReset')).toHaveText('50%');
  await expect(page.locator('#v76Surface .v76-text')).toHaveCount(initial);
  expect(errors).toEqual([]);
});

test('Pencil stroke follows actual screen contact after 200% zoom',async({page})=>{
  const errors=await openNotebook(page);
  await zoomTo(page,200);
  await page.locator('[data-v76-mode="pen"]').click();
  const point=await page.evaluate(()=>{
    const rect=document.getElementById('v76Ink').getBoundingClientRect();
    const x=Math.max(70,Math.min(innerWidth-120,rect.left+Math.min(180,rect.width*.35)));
    const y=Math.max(100,Math.min(innerHeight-120,Math.max(rect.top+80,220)));
    return {x,y};
  });
  const cdp=await page.context().newCDPSession(page);
  try{
    await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x,y:point.y,buttons:0,pointerType:'pen'});
    await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,buttons:1,button:'left',clickCount:1,pointerType:'pen'});
    await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x+40,y:point.y+30,buttons:1,button:'left',pointerType:'pen'});
    await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x+40,y:point.y+30,buttons:0,button:'left',clickCount:1,pointerType:'pen'});
  }finally{await cdp.detach();}
  await expect(page.locator('#v76Ink polyline')).toHaveCount(1);
  const result=await page.evaluate(()=>{
    const ink=document.getElementById('v76Ink');
    const p=ink.querySelector('polyline').points.getItem(0);
    const screen=new DOMPoint(p.x,p.y).matrixTransform(ink.getScreenCTM());
    return {x:screen.x,y:screen.y,points:v6Project().notePages[0].strokes[0].points};
  });
  expect(Math.hypot(result.x-point.x,result.y-point.y)).toBeLessThan(2.5);
  await page.locator('#v815ZoomReset').click();
  await expect(page.locator('#v76Ink polyline')).toHaveCount(1);
  expect(await page.evaluate(()=>v6Project().notePages[0].strokes.length)).toBe(1);
  expect(errors).toEqual([]);
});

test('Textbox insertion uses correct note coordinates at 200% and does not create extra boxes',async({page})=>{
  await openNotebook(page);
  await zoomTo(page,200);
  await page.locator('[data-v76-mode="text"]').click();
  const before=await page.locator('#v76Surface .v76-text').count();
  const screen=await page.evaluate(()=>{
    const s=document.getElementById('v76Surface'),r=s.getBoundingClientRect();
    return {x:Math.max(65,Math.min(innerWidth-120,r.left+115)),
      y:Math.max(130,Math.min(innerHeight-130,Math.max(r.top+200,300)))};
  });
  await page.mouse.click(screen.x,screen.y);
  await expect(page.locator('#v76Surface .v76-text')).toHaveCount(before+1);
  const saved=await page.evaluate(screen=>{
    const p=v6Project().notePages[0],s=document.getElementById('v76Surface');
    const item=p.objects[p.objects.length-1],rect=s.getBoundingClientRect();
    return {item,expectedX:(screen.x-rect.left)/2-10,expectedY:(screen.y-rect.top)/2-20};
  },screen);
  expect(saved.item.type).toBe('text');
  approx(saved.item.x,saved.expectedX,3);
  approx(saved.item.y,saved.expectedY,3);
  await expect(page.locator('[data-v76-mode="text"]')).toHaveAttribute('aria-pressed','false');
  await page.mouse.click(screen.x+50,screen.y+100);
  await expect(page.locator('#v76Surface .v76-text')).toHaveCount(before+1);
});

test('changing pages resets zoom to 100% and keeps both pages intact',async({page})=>{
  const errors=await openNotebook(page,'Zoom Pages');
  await zoomTo(page,250);
  page.once('dialog',d=>d.accept('Page Two'));
  await page.locator('#v811NewPage').click();
  await expect(page.locator('#v815ZoomReset')).toHaveText('100%');
  await expect(page.locator('#v811PageList .v811-page-row')).toHaveCount(2);
  await zoomTo(page,150);
  const first=await page.evaluate(()=>String(v6Project().notePages[0].id));
  await page.locator('[data-v811-page-id="'+first+'"]').click();
  await expect(page.locator('#v815ZoomReset')).toHaveText('100%');
  await page.reload();
  await page.locator('[data-tab="brainstorm"]').click();
  await page.locator('[data-v6-project]').filter({hasText:'Zoom Pages'}).click();
  await expect(page.locator('#v815ZoomReset')).toHaveText('100%');
  await expect(page.locator('#v811PageList .v811-page-row')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('responsive iPad, compact Split View and phone layouts retain zoom controls and no document-wide horizontal overflow',async({page})=>{
  const errors=await openNotebook(page);
  for(const viewport of [{width:1366,height:1024},{width:834,height:1194},{width:600,height:900},{width:390,height:844}]){
    await page.setViewportSize(viewport);
    await expect(page.locator('#v815ZoomIn')).toBeVisible();
    await zoomTo(page,200);
    await expect.poll(async()=>{
      const m=await metrics(page);
      return Math.abs(m.paperWidth-m.baseWidth*2);
    }).toBeLessThan(4);
    const m=await metrics(page);
    expect(m.documentOverflow).toBeLessThanOrEqual(3);
    await page.locator('#v815ZoomReset').click();
  }
  expect(errors).toEqual([]);
});
