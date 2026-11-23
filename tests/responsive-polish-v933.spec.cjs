'use strict';
const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';
test.use({browserName:'chromium',viewport:{width:390,height:844}});

test('long project and Library labels remain readable without horizontal overflow in narrow iPad views',async({page})=>{
  await page.goto(base);
  await page.evaluate(()=>{
    const longTitle='An exceptionally long project name about chemical engineering catalyst development and handwritten design';
    const assetTitle='An unusually detailed photograph caption for a chemical reactor diagram and several important related notes';
    state.projects=[{id:'long-title-qa',title:longTitle,notes:[],actions:[],
      library:[{id:'long-title-image',type:'file',title:assetTitle,
        key:'missing-test-preview',mime:'image/png'}],
      notePages:[{id:'page1',title:'First page',objects:[],strokes:[]}]}];
    if(!save(true))throw Error('Unable to seed long titles');
    window.v6ActiveProjectId='long-title-qa';
    v6ProjectTab='library';
    tab('brainstorm');v6Render();
  });
  for(const viewport of [{width:320,height:700},{width:375,height:812},
    {width:580,height:850},{width:768,height:1024},{width:1180,height:820}]){
    await page.setViewportSize(viewport);
    const metrics=await page.evaluate(()=>{
      const caption=document.querySelector('#projectLibraryList .v923-item-caption');
      const title=document.querySelector('#projectWorkspace .v6-project-title');
      const more=document.querySelector('#projectLibraryList .v923-more-button');
      const rect=caption?.getBoundingClientRect();
      const moreRect=more?.getBoundingClientRect();
      return {scrollOverflow:document.documentElement.scrollWidth-innerWidth,
        titleText:title?.textContent||'',captionText:caption?.textContent||'',
        clamp:getComputedStyle(caption).webkitLineClamp,
        wrap:getComputedStyle(caption).overflowWrap,
        captionWidth:rect?.width||0,
        moreWidth:moreRect?.width||0,moreHeight:moreRect?.height||0};
    });
    expect(metrics.titleText,JSON.stringify(viewport)).toContain('chemical engineering');
    expect(metrics.captionText).toContain('photograph caption');
    expect(metrics.clamp).toBe('2');
    expect(metrics.wrap).toBe('anywhere');
    expect(metrics.captionWidth).toBeGreaterThan(30);
    expect(metrics.moreWidth).toBeGreaterThanOrEqual(44);
    expect(metrics.moreHeight).toBeGreaterThanOrEqual(44);
    expect(metrics.scrollOverflow,JSON.stringify(viewport)).toBeLessThanOrEqual(5);
  }
});

test('open Event form does not lose unsaved edits when the week changes',async({page})=>{
  await page.goto(base);
  const output=await page.evaluate(()=>{
    openModal('event');
    const form=document.getElementById('modalForm');
    form.querySelector('[name="title"]').value='Draft laboratory meeting';
    form.querySelector('[name="date"]').value='2026-12-04';
    form.querySelector('[name="time"]').value='14:30';
    const before=iso(selectedWeek);
    document.getElementById('nextWeek').click();
    return {before,after:iso(selectedWeek),
      title:form.querySelector('[name="title"]').value,
      date:form.querySelector('[name="date"]').value,
      time:form.querySelector('[name="time"]').value};
  });
  expect(output.before).not.toBe(output.after);
  expect(output.title).toBe('Draft laboratory meeting');
  expect(output.date).toBe('2026-12-04');
  expect(output.time).toBe('14:30');
});

test('Today Schedule adds an event and Tasks links to Plan for creation and editing',async({page})=>{
  await page.goto(base);
  const schedule=page.locator('#today .v917-schedule');
  await schedule.getByRole('button',{name:'Add event',exact:true}).click();
  const eventForm=page.getByRole('dialog',{name:'Add Event',exact:true});
  await expect(eventForm.getByLabel('Date',{exact:true})).toHaveValue(await page.evaluate(()=>localToday()));
  await eventForm.getByLabel('Title',{exact:true}).fill('Reactor lab meeting');
  await eventForm.getByLabel('Start time').fill('14:30');
  await eventForm.getByRole('button',{name:'Save',exact:true}).click();
  await expect(schedule.getByText('Reactor lab meeting')).toBeVisible();
  await page.reload();
  await expect(schedule.getByText('Reactor lab meeting')).toBeVisible();

  await page.locator('#today .v917-tasks').getByRole('button',{name:'View all',exact:true}).click();
  await expect(page.locator('#myplan')).toBeVisible();
  await expect(page.locator('#tasks')).toHaveClass(/active/);
  await page.locator('#tasks [data-open="task"]').click();
  const taskForm=page.getByRole('dialog',{name:'Add Task',exact:true});
  await expect(taskForm.getByLabel('Deadline')).toBeVisible();
});
