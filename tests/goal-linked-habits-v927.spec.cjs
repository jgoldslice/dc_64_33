'use strict';
const {test,expect}=require('@playwright/test');
test.use({browserName:'chromium',viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const base='http://127.0.0.1:8765/';
async function setup(page){
  await page.goto(base);
  await page.locator('[data-tab="myplan"]').click();
  await page.locator('[data-plan-tab="goals"]').click();
  await page.evaluate(()=>{
    state.goals=[{id:'piano',title:'Learn My Song on Piano',category:'Personal',actions:[{id:'verse',title:'Learn first verse',done:false}]}];
    state.habits=[];
    state.tasks=[];
    if(!save(true))throw Error('Unable to persist fixture');
    render();
  });
  const goal=page.locator('details[data-goal="piano"]');
  await goal.locator('summary').click();
  await expect(goal).toHaveAttribute('open','');
  return goal;
}
async function createFromGoal(page){
  const goal=await setup(page);
  await goal.locator('[data-add-goal-habit="piano"]').click();
  await expect(page.locator('#modalTitle')).toHaveText('Add Habit');
  await expect(page.locator('#modalForm [name="goalId"]')).toHaveValue('piano');
  await page.locator('#modalForm input[name="title"]').fill('Practice piano');
  await page.locator('#modalForm input[name="weeklyTarget"]').fill('4');
  await page.locator('#modalForm button[type="submit"]').click();
  return goal;
}
test('create a habit from a goal and show it in the goal and Habits without duplicates',async({page})=>{
  const goal=await createFromGoal(page);
  await expect(goal.locator('.bp-goal-habit-row')).toHaveCount(1);
  await expect(goal.locator('.bp-goal-habit-row')).toContainText('Practice piano');
  await expect(goal.locator('.bp-goal-habit-row')).toContainText('0 / 4 this week');
  const record=await page.evaluate(()=>state.habits);
  expect(record).toHaveLength(1);
  expect(record[0]).toMatchObject({title:'Practice piano',goalId:'piano',actionId:'',weeklyTarget:4,days:{}});
  await page.locator('[data-plan-tab="habits"]').click();
  await expect(page.locator('#habitsTracker .bp-habit-goal')).toContainText('Learn My Song on Piano');
  await expect(page.locator('#habitManager .bp-habit-goal')).toContainText('Learn My Song on Piano');
  await page.reload();
  await page.locator('[data-tab="myplan"]').click();
  await page.locator('[data-plan-tab="habits"]').click();
  expect(await page.evaluate(()=>state.habits.filter(h=>h.goalId==='piano').length)).toBe(1);
  await expect(page.locator('#habitManager .bp-habit-goal')).toContainText('Learn My Song on Piano');
});
test('checking Today and the weekly tracker updates the same linked habit',async({page})=>{
  await createFromGoal(page);
  await page.locator('[data-tab="today"]').first().click();
  await expect(page.locator('#todayHabits .bp-habit-goal')).toContainText('Learn My Song on Piano');
  const today=await page.evaluate(()=>localToday());
  await page.locator('#todayHabits input[data-habit-check]').check();
  expect(await page.evaluate(date=>state.habits[0].days[date],today)).toBe(true);
  await page.locator('[data-tab="myplan"]').click();
  await page.locator('[data-plan-tab="goals"]').click();
  await expect(page.locator('details[data-goal="piano"] .bp-goal-habit-title small')).toContainText('this week');
  await page.locator('[data-plan-tab="habits"]').click();
  await expect(page.locator('#habitsTracker input[data-date="'+today+'"]')).toBeChecked();
});
test('editing a habit can change or remove its goal without losing history',async({page})=>{
  await createFromGoal(page);
  await page.evaluate(()=>{state.goals.push({id:'research',title:'Finish research paper',category:'Research',actions:[]});save(true);render();});
  await page.locator('[data-plan-tab="habits"]').click();
  await page.locator('#habitManager [data-edit-habit]').click();
  await expect(page.locator('#modalForm [name="goalId"]')).toHaveValue('piano');
  await page.locator('#modalForm [name="goalId"]').selectOption('research');
  await page.locator('#modalForm button[type="submit"]').click();
  expect(await page.evaluate(()=>state.habits[0].goalId)).toBe('research');
  await expect(page.locator('#habitManager .bp-habit-goal')).toHaveText('Finish research paper');
  await page.locator('#habitManager [data-edit-habit]').click();
  await page.locator('#modalForm [name="goalId"]').selectOption('');
  await page.locator('#modalForm button[type="submit"]').click();
  expect(await page.evaluate(()=>({goalId:state.habits[0].goalId,days:state.habits[0].days}))).toEqual({goalId:'',days:{}});
  await expect(page.locator('#habitManager .bp-habit-goal')).toHaveCount(0);
});
test('editing goal steps does not silently unlink a directly linked habit',async({page})=>{
  const goal=await createFromGoal(page);
  await goal.locator('[data-edit-goal="piano"]').click();
  await page.locator('#goalStepsEditor [data-step-remove]').click();
  await page.locator('#modalForm button[type="submit"]').click();
  const result=await page.evaluate(()=>({habits:state.habits,steps:state.goals[0].actions}));
  expect(result.steps).toEqual([]);
  expect(result.habits[0].goalId).toBe('piano');
  expect(result.habits[0].actionId).toBe('');
  await expect(page.locator('details[data-goal="piano"] .bp-goal-habit-row')).toHaveCount(1);
});
test('deleting a goal keeps its habits but disconnects the parent label',async({page})=>{
  const goal=await createFromGoal(page);
  page.once('dialog',d=>d.accept());
  await goal.locator('[data-delete-goal="piano"]').click();
  expect(await page.evaluate(()=>state.habits.map(h=>({title:h.title,goalId:h.goalId,actionId:h.actionId})))).toEqual([
    {title:'Practice piano',goalId:'',actionId:''}
  ]);
  await page.locator('[data-plan-tab="habits"]').click();
  await expect(page.locator('#habitManager .bp-habit-goal')).toHaveCount(0);
  await expect(page.locator('#habitManager')).toContainText('Practice piano');
});
