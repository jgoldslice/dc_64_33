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
