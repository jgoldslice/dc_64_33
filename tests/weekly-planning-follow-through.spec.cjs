'use strict';
const {test,expect}=require('@playwright/test');

test('a calendar day creates a scheduled task with a separate deadline',async({page})=>{
  await page.clock.install({time:new Date('2026-11-22T19:00:00Z')});
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await page.locator('[data-tab="week"]').click();
  await page.locator('#weekGrid [data-week-event-date="2026-11-20"]').click();
  const sheet=page.locator('#bpDayBack');
  await expect(sheet.getByRole('button',{name:'+ Add event'})).toBeVisible();
  await sheet.getByRole('button',{name:'+ Add task'}).click();
  const fields=page.locator('#modalFields');
  await expect(fields.locator('[name="scheduledDate"]')).toHaveValue('2026-11-20');
  await expect(fields.locator('[name="dueDate"]')).toHaveValue('');
  await fields.locator('[name="title"]').fill('Calendar task');
  await page.locator('#modalBack').getByRole('button',{name:'Save',exact:true}).click();
  expect(await page.evaluate(()=>state.tasks.find(t=>t.title==='Calendar task'))).toMatchObject({
    scheduledDate:'2026-11-20',dueDate:''
  });
});

test('carry-forward and goal steps can be scheduled, reviewed, resumed and applied',async({page})=>{
  await page.clock.install({time:new Date('2026-11-22T19:00:00Z')});
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await page.evaluate(()=>{
    state.goals=[{id:'goal',title:'Manuscript',category:'Research',motivation:'',
      actions:[{id:'step',title:'Review spectra',done:false}]}];
    state.tasks=[{id:'carry',title:'Process data',dueDate:'2026-11-20',scheduledDate:'2026-11-19',scheduledTime:'09:00',done:false}];
    save(true);render();
  });
  await page.locator('[data-tab="week"]').click();
  const launch=page.locator('#wbWeekLaunch');
  await launch.click();
  await page.locator('[data-wb-carry="carry"]').check();
  await expect(page.getByLabel('New deadline for Process data')).toHaveValue('');
  await page.locator('#wbProgress [data-wb-stage="1"]').click();
  await page.locator('[data-wb-goal-details="goal"] summary').click();
  await page.getByRole('button',{name:'+ Make task'}).click();
  await expect(page.getByRole('button',{name:'+ Make task'})).toHaveCount(0);
  await page.locator('#wbProgress [data-wb-stage="3"]').click();
  await expect(page.getByLabel('Schedule Process data')).toHaveValue('2026-11-23');
  await page.getByLabel('Schedule Process data').selectOption('2026-11-25');
  await page.getByLabel('Schedule Review spectra').selectOption('2026-11-26');
  await page.locator('#wbProgress [data-wb-stage="4"]').click();
  await expect(page.locator('#wbMain')).toContainText('Process data · On calendar Nov 25');
  await expect(page.locator('#wbMain')).toContainText('Review spectra · On calendar Nov 26 · Research');
  await page.getByRole('button',{name:'Edit tasks',exact:true}).click();
  await expect(page.getByLabel('Schedule Review spectra')).toHaveValue('2026-11-26');
  expect(await page.evaluate(()=>state.tasks)).toHaveLength(1);
  await page.getByRole('button',{name:'Close weekly planning'}).click();
  await expect(launch).toContainText('Continue planning');
  await expect(launch).toContainText('Nov 23 – Nov 29');
  await page.reload();
  await page.locator('[data-tab="myplan"]').click();
  const areaLaunch=page.locator('[data-wb-launch]');
  await expect(areaLaunch).toContainText('Continue planning');
  await areaLaunch.click();
  await expect(page.getByLabel('Schedule Process data')).toHaveValue('2026-11-25');
  await page.locator('#wbProgress [data-wb-stage="4"]').click();
  await page.getByRole('button',{name:'Apply Weekly Blueprint'}).click();
  expect(await page.evaluate(()=>state.tasks)).toMatchObject([
    {id:'carry',dueDate:'2026-11-20',scheduledDate:'2026-11-25',scheduledTime:''},
    {title:'Review spectra',goalId:'goal',actionId:'step',area:'Research',dueDate:'',scheduledDate:'2026-11-26'}
  ]);
  await expect(areaLaunch).toContainText('Design Next Week');
});

test('Review protects unfinished forms and keeps linked project checkoffs in Apply and Undo',async({page})=>{
  await page.clock.install({time:new Date('2026-11-22T19:00:00Z')});
  await page.goto('/');
  await page.evaluate(()=>{
    state.tasks=[{id:'linked',title:'Write report',dueDate:'2026-11-20',scheduledDate:'',done:false,projectId:'project',projectActionId:'action'}];
    state.projects=[{id:'project',title:'Research',actions:[{id:'action',taskId:'linked',title:'Write report',done:false,status:'todo'}],notes:[],library:[]}];
    state.events=[];
    save(true);render();
  });
  const stage=n=>page.locator('#wbProgress [data-wb-stage="'+n+'"]').click();
  await page.locator('[data-tab="week"]').click();
  await page.locator('#wbWeekLaunch').click();
  await page.locator('[data-wb-task-done="linked"]').check();
  await stage(2);
  await page.locator('[data-wb-select-day="2026-11-25"]:visible').click();
  await page.locator('#wbEventForm [name="title"]').fill('Lab meeting');
  await stage(3);
  await page.locator('[data-wb-task-toggle]').click();
  await page.locator('#wbNewTaskForm [name="title"]').fill('Unused task entry');
  await stage(4);
  const apply=page.getByRole('button',{name:'Apply Weekly Blueprint'});
  await expect(apply).toBeDisabled();
  await expect(page.getByText('Unfinished task')).toBeVisible();
  await page.getByRole('button',{name:'Discard task entry'}).click();
  await expect(apply).toBeDisabled();
  await page.getByRole('button',{name:'Finish event'}).click();
  await expect(page.locator('#wbEventForm [name="title"]')).toHaveValue('Lab meeting');
  await page.locator('#wbEventForm button[type="submit"]').click();
  await stage(4);
  await apply.click();
  const status=()=>page.evaluate(()=>({done:state.tasks[0].done,action:state.projects[0].actions[0].status,
    events:state.events.map(e=>e.title)}));
  expect(await status()).toEqual({done:true,action:'done',events:['Lab meeting']});
  await page.locator('[data-tab="myplan"]').click();
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('[data-wb-undo]').click();
  expect(await status()).toEqual({done:false,action:'todo',events:[]});
});

test('resumed goal drafts preserve newer fields and ask before overwriting conflicting edits',async({page})=>{
  await page.goto('/');
  await page.evaluate(()=>{
    state.goals=[{id:'goal',title:'Manuscript',category:'Research',motivation:'Original',actions:[]}];
    save(true);render();
  });
  await page.locator('[data-tab="week"]').click();
  const launch=page.locator('#wbWeekLaunch');
  const stage=n=>page.locator('#wbProgress [data-wb-stage="'+n+'"]').click();
  await launch.click();
  await stage(1);
  await page.locator('[data-wb-goal-details="goal"] summary').click();
  await page.locator('[data-wb-goal-field="motivation"]').fill('Draft motivation');
  await page.locator('[data-wb-goal-field="category"]').selectOption('Personal');
  await page.getByRole('button',{name:'Close weekly planning'}).click();
  await page.evaluate(()=>{
    Object.assign(state.goals[0],{title:'New saved name',motivation:'New saved motivation'});
    save(true);render();
  });
  await page.reload();
  await page.locator('[data-tab="week"]').click();
  await launch.click();
  await stage(4);
  const apply=page.getByRole('button',{name:'Apply Weekly Blueprint'});
  await expect(apply).toBeDisabled();
  await expect(page.getByRole('button',{name:'Use draft motivation'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Use draft name'})).toHaveCount(0);
  await page.getByRole('button',{name:'Keep saved motivation'}).click();
  await apply.click();
  expect(await page.evaluate(()=>state.goals[0])).toMatchObject({
    title:'New saved name',category:'Personal',motivation:'New saved motivation'
  });
});

test('Today collapses the backlog while keeping scheduled and starred work visible',async({page})=>{
  await page.clock.install({time:new Date('2026-11-22T19:00:00Z')});
  await page.goto('/');
  await page.evaluate(()=>{
    state.tasks=[
      ...[1,2,3].map(id=>({id,title:'Backlog '+id,dueDate:'2026-11-18',done:false})),
      {id:4,title:'Due today',dueDate:'2026-11-22',done:false},
      {id:5,title:'Scheduled today',dueDate:'2026-11-20',scheduledDate:'2026-11-22',done:false},
      {id:6,title:'Starred backlog',dueDate:'2026-11-20',priority:true,priorityRank:1,done:false}
    ];
    save(true);render();
  });
  const today=page.locator('#v77TodayPriorities');
  for(const title of ['Due today','Scheduled today','Starred backlog'])
    await expect(today.getByRole('button',{name:'Find '+title+' in Plan'})).toBeVisible();
  await expect(today.getByRole('button',{name:'Find Backlog 1 in Plan'})).toBeHidden();
  await today.locator('.bp-today-overdue summary').click();
  await expect(today.getByRole('button',{name:'Find Backlog 1 in Plan'})).toBeVisible();
});
