/**
 * Proposal-only Playwright tests — not included by playwright.config.cjs.
 * To try before approving integration:
 *   npx playwright test proposals/apple-polish/mobile-interactions.spec.cjs --config=playwright.config.cjs
 * Or copy these tests to tests/ after implementing the optional components.
 */
const { test, expect } = require('@playwright/test');
test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
test('horizontal swipe proposal honors touch targets, edges and axis intent',async({page})=>{
  await page.goto('http://127.0.0.1:8765/');
  const outcome=await page.evaluate(async()=>{
    const {createHorizontalSwipeRouter}=await import('/proposals/apple-polish/gesture-router.js');
    const root=document.createElement('div');root.style.cssText='position:fixed;inset:100px 20px 100px;background:transparent';
    const content=document.createElement('div');content.textContent='Safe swipe area';content.style.height='300px';
    const button=document.createElement('button');button.textContent='Protected tap target';root.append(content,button);
    document.body.append(root);
    const fired=[];
    const router=createHorizontalSwipeRouter({root,onSwipe:({direction})=>fired.push(direction)});
    let id=17;
    function drag(target,startX,startY,dx,dy){
      const pointerId=++id;
      for(const [type,x,y] of [['pointerdown',startX,startY],['pointermove',startX+dx,startY+dy],['pointerup',startX+dx,startY+dy]])
        target.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerType:'touch',isPrimary:true,button:0,pointerId,clientX:x,clientY:y}));
    }
    const rect=root.getBoundingClientRect();
    drag(content,rect.left+80,rect.top+30,-100,4);  // accept
    drag(content,rect.left+80,rect.top+30,3,100);   // vertical scrolling
    drag(content,rect.left+10,rect.top+30,100,1);  // system edge exclusion
    drag(button,rect.left+80,rect.top+30,100,1);   // protected button
    router.dispose();root.remove();
    return fired;
  });
  expect(outcome).toEqual(['left']);
});
test('proposed adaptive layout is one pane narrow and two panes wide',async({page})=>{
  await page.goto('http://127.0.0.1:8765/');
  await page.addStyleTag({path:'proposals/apple-polish/adaptive-layout.css'});
  await page.evaluate(()=>{
    const layout=document.createElement('div');layout.id='ap-test-layout';layout.className='ap-layout-host';
    layout.innerHTML='<div class="ap-two-pane" data-pane-view="split"><aside class="ap-pane-list">Projects</aside><article class="ap-pane-detail">Notes</article></div>';
    document.body.append(layout);
  });
  const cols=()=>page.locator('#ap-test-layout .ap-two-pane').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
  await expect.poll(cols).toBe(1);
  await page.setViewportSize({width:980,height:844});
  await expect.poll(cols).toBe(2);
});
