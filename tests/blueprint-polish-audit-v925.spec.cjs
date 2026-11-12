'use strict';
const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';
test.use({browserName:'chromium'});

test('main views fit phone, iPad, compact Split View and landscape without page-width clipping',async({page})=>{
  await page.goto(base);
  await page.addStyleTag({content:'.shell,.bottom-nav{transition:none!important}'});
  const widths=[[320,700],[390,844],[650,850],[740,1024],[834,1194],[1024,768],[1194,834]];
  const readings=[];
  for(const [width,height] of widths){
    await page.setViewportSize({width,height});
    for(const view of ['today','week','myplan','brainstorm']){
      await page.evaluate(view=>tab(view),view);
      const data=await page.evaluate(view=>{
        const target=document.getElementById(view);
        const rect=target.getBoundingClientRect();
        return {
          screen:innerWidth,
          width:Math.round(rect.width),
          overflow:document.documentElement.scrollWidth-innerWidth,
          active:target.classList.contains('active')
        };
      },view);
      readings.push({view,width,...data});
      expect(data.active).toBe(true);
      expect(data.overflow,`${width}px / ${view} horizontal page overflow`).toBeLessThanOrEqual(4);
      expect(data.width).toBeGreaterThan(140);
    }
  }
  console.log('Blueprint responsive audit:',JSON.stringify(readings));
});

test('two Library image cards use full row while list mode keeps one column',async({page})=>{
  await page.goto(base);
  await page.locator('[data-tab="brainstorm"]').click();
  page.once('dialog',d=>d.accept('Gallery columns QA'));
  await page.locator('#newProject').click();
  await page.evaluate(async()=>{
    const png=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP+ZJRdGAAAAABJRU5ErkJggg=='),c=>c.charCodeAt(0));
    const p=v6Project();
    for(let i=0;i<2;i++){
      const key='qa-image-col-'+i;
      await v6Blob('put',key,new Blob([png],{type:'image/png'}));
      p.library.push({id:'qa-col-'+i,title:'Screenshot '+i,type:'file',mime:'image/png',key,size:png.length});
    }
    if(!save(true))throw Error('Test setup save failed');
    v6Render();
  });
  await page.locator('[data-v919-project-open="library"]').click();
  for(const width of [390,834,1194]){
    await page.setViewportSize({width,height:850});
    const row=await page.locator('.v923-library-items').evaluate(grid=>{
      const cards=[...grid.children].map(x=>x.getBoundingClientRect());
      return {
        columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length,
        aligned:Math.abs(cards[0].top-cards[1].top)<2,
        imageFit:getComputedStyle(grid.querySelector('img')).objectFit,
        overflow:document.documentElement.scrollWidth-innerWidth
      };
    });
    expect(row.columns).toBe(2);
    expect(row.aligned).toBe(true);
    expect(row.imageFit).toBe('contain');
    expect(row.overflow).toBeLessThanOrEqual(4);
  }
  await page.locator('[data-library-view="list"]').click();
  const columns=await page.locator('.v923-library-items').evaluate(grid=>getComputedStyle(grid).gridTemplateColumns.split(' ').length);
  expect(columns).toBe(1);
});
