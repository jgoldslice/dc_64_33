'use strict';
const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';

test('Today layout follows remaining workspace width, including iPad sidebar and compact screens',async({page})=>{
  await page.goto(base);
  await page.addStyleTag({content:'.shell,.bottom-nav{transition:none!important}'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const [width,height] of [[320,700],[390,844],[650,850],[740,1024],[768,1024],[834,1194],[900,850],[1024,768],[1194,834]]){
    await page.setViewportSize({width,height});
    const layout=await page.evaluate(()=>{
      const host=document.querySelector('#today');
      const grid=host.querySelector('.v917-today-grid');
      return {usable:host.getBoundingClientRect().width,
        areas:getComputedStyle(grid).gridTemplateAreas,
        overflow:document.documentElement.scrollWidth-window.innerWidth,
        cardPadding:getComputedStyle(grid.querySelector('.card:not([hidden])')).paddingLeft};
    });
    const paired=layout.areas.includes('"schedule habits"');
    expect(paired,width+' wide usable '+layout.usable).toBe(layout.usable>=520 && width>=650 && height>=600);
    expect(layout.overflow,width+' page overflow').toBeLessThanOrEqual(4);
  }
  await page.setViewportSize({width:834,height:1194});
  const original=await page.locator('#today').evaluate(el=>el.getBoundingClientRect().width);
  await page.evaluate(()=>document.body.classList.add('canvas-ipad-sidebar-collapsed'));
  const collapsed=await page.locator('#today').evaluate(el=>el.getBoundingClientRect().width);
  expect(collapsed).toBeGreaterThan(original+80);
  expect(errors).toEqual([]);
});

test('empty Today cards avoid excessive reserved space, dense data remains scrollable',async({page})=>{
  await page.setViewportSize({width:834,height:1194});
  await page.goto(base);
  // The app may include sample tasks and events on first load; a test of
  // *empty* card geometry must explicitly start with empty collections.
  await page.evaluate(()=>{
    state.events=[];
    state.tasks=[];
    state.habits=[];
    state.projects=[];
    render();
  });
  const dimensions=await page.evaluate(()=>{
    const c=n=>document.querySelector('#today .'+n).getBoundingClientRect().height;
    return [c('v917-schedule'),c('v917-habits'),c('v917-tasks'),c('v917-priorities'),c('v917-projects')];
  });
  expect(dimensions[0]).toBeLessThan(215);
  expect(dimensions[2]).toBeLessThan(180);
  expect(dimensions[4]).toBeLessThan(155);
  await page.evaluate(()=>{
    state.events=Array.from({length:30},(_,i)=>({id:'qa-event-'+i,title:'Meeting '+i,date:localToday(),time:'12:00'}));
    render();
  });
  const measure=await page.locator('#todayGlance').evaluate(el=>({scroll:el.scrollHeight,client:el.clientHeight,overflow:getComputedStyle(el).overflowY}));
  expect(measure.scroll).toBeGreaterThan(measure.client+20);
  expect(measure.overflow).toBe('auto');
});

test('Project Overview columns respond to its content width rather than full screen width',async({page})=>{
  await page.goto(base);
  await page.addStyleTag({content:'.shell,.bottom-nav{transition:none!important}'});
  await page.locator('[data-tab="brainstorm"]').click();
  page.once('dialog',dialog=>dialog.accept('Layout project'));
  await page.locator('#newProject').click();
  await expect(page.locator('#projectOverview')).toBeVisible();
  for(const [width,height] of [[320,700],[390,844],[740,1024],[768,1024],[834,1194],[900,850],[1194,834]]){
    await page.setViewportSize({width,height});
    const layout=await page.locator('#projectOverview').evaluate(host=>{
      const grid=host.querySelector('.v919-project-grid');
      const first=grid.children[0].getBoundingClientRect();
      const second=grid.children[1].getBoundingClientRect();
      return {usable:host.getBoundingClientRect().width,
        sameRow:Math.abs(first.top-second.top)<3,
        overlap:Math.min(first.right,second.right)-Math.max(first.left,second.left),
        overflow:document.documentElement.scrollWidth-window.innerWidth};
    });
    expect(layout.sameRow,width+' project usable '+layout.usable).toBe(layout.usable>=540);
    expect(layout.overflow,width+' page overflow').toBeLessThanOrEqual(4);
  }
});

test('phone Habit Tracker gives seven full-width day cells per habit without horizontal panning',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto(base);
  await page.locator('[data-tab="myplan"]').click();
  await page.locator('#myplan [data-plan-tab="habits"]').click();
  await page.evaluate(()=>{
    state.habits=['Study chemical kinetics','Practice guitar','Exercise'].map((title,i)=>({
      id:'qa-habit-'+i,title,createdOn:'2020-01-01',schedule:[0,1,2,3,4,5,6],days:{}
    }));
    render();
  });
  for(const width of [320,375,390,430]){
    await page.setViewportSize({width,height:844});
    const m=await page.locator('#habitsTracker').evaluate(el=>{
      const grid=el.querySelector('.week-table');
      const names=[...grid.querySelectorAll('.habit-name')].map(x=>x.getBoundingClientRect());
      const labels=[...grid.querySelectorAll('label')].map(x=>x.getBoundingClientRect());
      const root=el.getBoundingClientRect();
      return {client:el.clientWidth,scroll:el.scrollWidth,
        pageOverflow:document.documentElement.scrollWidth-window.innerWidth,
        cols:getComputedStyle(grid).gridTemplateColumns.split(' ').length,
        firstNameBottom:names[0].bottom,firstDayTop:labels[0].top,
        firstNameWidth:names[0].width,trackerWidth:root.width,
        smallestTarget:Math.min(...labels.map(x=>x.height))};
    });
    expect(m.pageOverflow,width+' page').toBeLessThanOrEqual(4);
    expect(m.scroll-m.client,width+' tracker').toBeLessThanOrEqual(2);
    expect(m.cols,width+' grid').toBe(7);
    expect(m.firstDayTop,width+' day below name').toBeGreaterThanOrEqual(m.firstNameBottom-2);
    expect(m.firstNameWidth,width+' full name').toBeGreaterThan(m.trackerWidth-8);
    expect(m.smallestTarget,width+' target').toBeGreaterThanOrEqual(43);
  }
  const first=page.locator('#habitsTracker [data-habit-check="qa-habit-0"]').first();
  const date=await first.getAttribute('data-date');
  await first.check();
  expect(await page.evaluate(d=>state.habits[0].days[d],date)).toBe(true);
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem(STORAGE_KEY)).habits[0].days);
  expect(stored[date]).toBe(true);
});


test('long project titles receive a roomy switcher across iPad, phone, and Split View',async({page})=>{
  await page.goto(base);
  await page.addStyleTag({content:'.shell,.bottom-nav{transition:none!important}'});
  await page.locator('[data-tab="brainstorm"]').click();
  const name='Minecraft Crafting Hub and Storage Design With a Very Long Project Title';
  page.once('dialog',d=>d.accept(name));
  await page.locator('#newProject').click();
  await expect(page.locator('#projectOverview')).toBeVisible();
  for(const [width,height] of [[320,700],[390,844],[650,850],[740,1024],[834,1194],[1024,768],[1194,834]]){
    await page.setViewportSize({width,height});
    const m=await page.locator('#projectWorkspace').evaluate(workspace=>{
      const select=workspace.querySelector('#v814ProjectSelect');
      const header=workspace.querySelector('.v6-project-head');
      const back=workspace.querySelector('#backProjects');
      const selected=select.getBoundingClientRect();
      const parent=header.getBoundingClientRect();
      return {
        width:selected.width,parentWidth:parent.width,
        title:select.title,value:select.selectedOptions[0]?.textContent,
        long:workspace.classList.contains('v925-long-project'),
        backBottom:back.getBoundingClientRect().bottom,
        selectTop:selected.top,
        pageOverflow:document.documentElement.scrollWidth-innerWidth
      };
    });
    expect(m.long,width+' long-name switcher').toBe(true);
    expect(m.value).toBe(name);
    expect(m.title).toBe(name);
    expect(m.pageOverflow,width+' overflow').toBeLessThanOrEqual(4);
    expect(m.width,width+' switcher').toBeGreaterThan(width<=390?190:width<740?300:230);
    if(width<740)expect(m.selectTop,width+' wrapped on phone').toBeGreaterThanOrEqual(m.backBottom-2);
  }
});

test('library image thumbnails show whole images, while lists and project cards stay accessible',async({page})=>{
  await page.goto(base);
  await page.locator('[data-tab="brainstorm"]').click();
  page.once('dialog',d=>d.accept('Library QA'));
  await page.locator('#newProject').click();
  await page.evaluate(async()=>{
    const p=v6Project();
    const png=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP+ZJRdGAAAAABJRU5ErkJggg=='),c=>c.charCodeAt(0));
    const key='qa-visible-image';
    await v6Blob('put',key,new Blob([png],{type:'image/png'}));
    p.library.push({id:'image-preview-qa',type:'file',mime:'image/png',title:'Wide Screenshot',key,size:png.length});
    if(!save(true))throw Error('Failed to save QA image');
    v6Render();
  });
  await page.locator('[data-v919-project-open="library"]').click();
  for(const width of [320,390,650,834,1024]){
    await page.setViewportSize({width,height:850});
    const measure=await page.locator('[data-v923-item="image-preview-qa"]').evaluate(item=>{
      const image=item.querySelector('img');
      const tile=item.querySelector('.v6-gallery-tile');
      return {fit:getComputedStyle(image).objectFit,
        bg:getComputedStyle(image).backgroundColor,
        overflow:document.documentElement.scrollWidth-innerWidth,
        buttonWidth:tile.getBoundingClientRect().width};
    });
    expect(measure.fit).toBe('contain');
    expect(measure.buttonWidth).toBeGreaterThan(85);
    expect(measure.overflow).toBeLessThanOrEqual(4);
  }
  await page.locator('[data-library-view="list"]').click();
  await expect(page.locator('[data-v923-item="image-preview-qa"] img')).toHaveCSS('object-fit','contain');
});
