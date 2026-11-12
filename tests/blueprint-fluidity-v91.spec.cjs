const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';
test.use({browserName:'chromium',viewport:{width:390,height:844},isMobile:true,hasTouch:true});
async function start(page){
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  await expect(page.locator('#openingOverlay')).toBeHidden({timeout:10000});
  await page.evaluate(()=>window.scrollTo(0,0));
  return errors;
}
async function gesture(page,{from='today',dx=-135,dy=2,reverse=false,targetSelector,finish=true}={}){
  return page.evaluate(({from,dx,dy,reverse,targetSelector,finish})=>{
    const el=document.querySelector(targetSelector||'#'+from+' .view-header h1');
    if(!el)throw Error('No swipe target');
    const b=el.getBoundingClientRect(),x=b.x+Math.min(90,b.width/2),y=b.y+b.height/2;
    const t=(cx,cy)=>new Touch({identifier:63,target:el,clientX:cx,clientY:cy});
    const a=t(x,y),b1=t(x+dx,y+dy);
    const dispatch=(type,touches,changed)=>{
      el.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches,
        changedTouches:changed,targetTouches:touches}));
    };
    dispatch('touchstart',[a],[a]);
    dispatch('touchmove',[b1],[b1]);
    if(reverse)dispatch('touchmove',[t(x+3,y+dy)],[t(x+3,y+dy)]);
    if(finish)dispatch('touchend',[],[reverse?t(x+3,y+dy):b1]);
    return {...window.__blueprintMotionDebug,
      cloned:document.querySelectorAll('.canvas-turn-snapshot').length,
      active:document.querySelector('.view.active')?.id};
  },{from,dx,dy,reverse,targetSelector,finish});
}
test('repeated main swipes navigate exactly one tab and never create deep clones',async({page})=>{
  const errors=await start(page);
  const one=await gesture(page);
  expect(one.cloned).toBe(0);
  await expect(page.locator('#week')).toHaveClass(/active/);
  await gesture(page,{from:'week',dx:-150,targetSelector:'#weekTitle'});
  await expect(page.locator('#myplan')).toHaveClass(/active/);
  await expect(page.locator('.v94-live-pane')).toHaveCount(0);
  expect(await page.evaluate(()=>window.__blueprintMotionDebug.prepares)).toBe(2);
  expect(errors).toEqual([]);
});
test('reversing a drag cancels navigation and restores live view layout',async({page})=>{
  await start(page);
  const old=await page.locator('#today').evaluate(el=>el.getBoundingClientRect().width);
  await gesture(page,{reverse:true});
  await expect(page.locator('.v94-live-pane')).toHaveCount(0);
  await expect(page.locator('#today')).toHaveClass(/active/);
  const width=await page.locator('#today').evaluate(el=>el.getBoundingClientRect().width);
  expect(Math.abs(width-old)).toBeLessThan(1);
});
test('vertical movement never steals document scrolling',async({page})=>{
  await start(page);
  await gesture(page,{dx:-6,dy:150});
  expect(await page.evaluate(()=>window.__blueprintMotionDebug.prepares)).toBe(0);
  await expect(page.locator('#today')).toHaveClass(/active/);
});
test('reduced motion changes tabs without any transformed motion panes',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await start(page);
  await gesture(page,{dx:-140});
  await expect(page.locator('#week')).toHaveClass(/active/);
  expect(await page.evaluate(()=>window.__blueprintMotionDebug.prepares)).toBe(0);
  await expect(page.locator('.v94-live-pane')).toHaveCount(0);
});
test('a direct tab click interrupts animation and takes priority',async({page})=>{
  await start(page);
  await gesture(page,{dx:-135});
  await page.locator('[data-tab="brainstorm"]').click();
  await expect(page.locator('#brainstorm')).toHaveClass(/active/);
  await expect(page.locator('.v94-live-pane')).toHaveCount(0);
});

test('a short, fast flick advances once; a slow partial drag does not',async({page})=>{
  await start(page);
  async function flick(elapsed){
    return page.evaluate(async elapsed=>{
      const target=document.querySelector('#today .view-header h1');
      const r=target.getBoundingClientRect(),x=r.x+Math.min(90,r.width/2),y=r.y+r.height/2;
      const touch=dx=>new Touch({identifier:19,target,clientX:x+dx,clientY:y});
      const a=touch(0),mid=touch(-44),end=touch(-52);
      const send=(type,ts,change)=>target.dispatchEvent(new TouchEvent(type,{
        bubbles:true,cancelable:true,touches:ts,changedTouches:change,targetTouches:ts
      }));
      send('touchstart',[a],[a]);
      send('touchmove',[mid],[mid]);
      await new Promise(resolve=>setTimeout(resolve,elapsed));
      send('touchend',[],[end]);
    },elapsed);
  }
  await flick(210);
  await expect(page.locator('#today')).toHaveClass(/active/);
  await expect(page.locator('.v94-live-pane')).toHaveCount(0);
  await flick(24);
  await expect(page.locator('#week')).toHaveClass(/active/);
  await expect(page.locator('.v94-live-pane')).toHaveCount(0);
});

test('starting another gesture while settling never double-commits a tab',async({page})=>{
  await start(page);
  await page.evaluate(()=>{
    const target=document.querySelector('#today .view-header h1');
    const r=target.getBoundingClientRect(),x=r.x+80,y=r.y+r.height/2;
    const touch=dx=>new Touch({identifier:21,target,clientX:x+dx,clientY:y});
    const a=touch(0),b=touch(-135);
    const send=(type,ts,change)=>target.dispatchEvent(new TouchEvent(type,{
      bubbles:true,cancelable:true,touches:ts,changedTouches:change,targetTouches:ts
    }));
    send('touchstart',[a],[a]);
    send('touchmove',[b],[b]);
    send('touchend',[],[b]);
    // A second contact interrupts the settling animation. The previous
    // commitment finishes once; no phantom second tab change occurs.
    send('touchstart',[a],[a]);
  });
  await expect(page.locator('#week')).toHaveClass(/active/);
  await expect(page.locator('.v94-live-pane')).toHaveCount(0);
  expect(await page.evaluate(()=>window.__blueprintMotionDebug.interruptions)).toBe(1);
});

test('motion preparation is instrumented and never deep-clones either view',async({page})=>{
  await start(page);
  const result=await page.evaluate(()=>{
    const source=document.querySelector('#today .view-header h1');
    const original=Node.prototype.cloneNode;
    let deepClones=0;
    Node.prototype.cloneNode=function(deep){if(deep)deepClones++;return original.call(this,deep);};
    try{
      const rect=source.getBoundingClientRect(),x=rect.x+70,y=rect.y+20;
      const t=(dx)=>new Touch({identifier:2,target:source,clientX:x+dx,clientY:y});
      const a=t(0),b=t(-95);
      source.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,cancelable:true,touches:[a],changedTouches:[a]}));
      source.dispatchEvent(new TouchEvent('touchmove',{bubbles:true,cancelable:true,touches:[b],changedTouches:[b]}));
      return {deepClones,prepareMs:window.__blueprintMotionDebug.lastPrepareMs};
    }finally{Node.prototype.cloneNode=original;}
  });
  expect(result.deepClones).toBe(0);
  expect(result.prepareMs).toBeGreaterThanOrEqual(0);
  console.log('Blueprint v9.4 browser live-pane preparation:',result.prepareMs.toFixed(2),'ms (not an iPad FPS measurement)');
});


test('very fast release settles from latest finger position instead of a stale frame',async({page})=>{
  await start(page);
  const result=await page.evaluate(()=>{
    const target=document.querySelector('#today .view-header h1');
    const rect=target.getBoundingClientRect();
    const x=rect.left+Math.min(85,rect.width/2),y=rect.top+rect.height/2;
    const t=dx=>new Touch({identifier:552,target,clientX:x+dx,clientY:y});
    const dispatch=(type,touches,changed)=>target.dispatchEvent(new TouchEvent(type,{
      bubbles:true,cancelable:true,touches,changedTouches:changed,targetTouches:touches
    }));
    const start=t(0),moved=t(-112);
    dispatch('touchstart',[start],[start]);
    dispatch('touchmove',[moved],[moved]);
    // No await or requestAnimationFrame: the finger was lifted within one frame.
    dispatch('touchend',[],[moved]);
    return {
      duration:window.__blueprintMotionDebug.lastSettleMs,
      prepares:window.__blueprintMotionDebug.prepares
    };
  });
  expect(result.prepares).toBe(1);
  expect(result.duration).toBeGreaterThan(70);
  expect(result.duration).toBeLessThan(215);
  await expect(page.locator('#week')).toHaveClass(/active/);
  await expect(page.locator('.v94-live-pane')).toHaveCount(0);
});
