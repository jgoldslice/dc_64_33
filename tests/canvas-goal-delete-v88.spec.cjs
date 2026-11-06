const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';
test.use({browserName:'chromium',viewport:{width:390,height:844},isMobile:true,hasTouch:true});
async function setup(page){
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  await page.locator('[data-tab="myplan"]').click();
  await page.locator('[data-plan-tab="goals"]').click();
  await page.evaluate(()=>{
    state.goals=[
      {id:'target-goal',title:'Feel the Spirit more',category:'Personal',motivation:'Be intentional',actions:[{id:'step-a',title:'Read scriptures',done:false}]},
      {id:'other-goal',title:'Keep learning',category:'Personal',actions:[]}
    ];
    state.tasks=[{id:'linked-task',title:'Scripture study',done:false,goalId:'target-goal',actionId:'step-a',actionIndex:0},
      {id:'other-task',title:'Study chemistry',done:false,goalId:'other-goal',actionId:''}];
    state.habits=[{id:'linked-habit',title:'Pray',goalId:'target-goal',actionId:'step-a',days:{},schedule:[0,1,2,3,4,5,6]}];
    if(!save())throw Error('Test fixture could not be saved');
    render();
  });
  const card=page.locator('#goalsList details[data-goal="target-goal"]');
  await card.locator('summary').click();
  await expect(card).toHaveAttribute('open','');
  return errors;
}
test('Delete goal appears beside Edit goal in the expanded Blueprint card',async({page})=>{
  const errors=await setup(page);
  const actions=page.locator('#goalsList details[data-goal="target-goal"] .row-buttons');
  const names=await actions.locator('button').allTextContents();
  expect(names.map(x=>x.trim())).toEqual(['+ Step','Edit goal','Delete goal']);
  await expect(actions.locator('[data-delete-goal="target-goal"]')).toHaveAttribute('aria-label','Delete goal: Feel the Spirit more');
  await expect(actions.locator('[data-delete-goal]')).toBeVisible();
  expect(errors).toEqual([]);
});
test('cancel the confirmation without deleting the goal or changing linked tasks and habits',async({page})=>{
  await setup(page);
  let confirmation='';
  page.once('dialog',async d=>{confirmation=d.message();await d.dismiss();});
  await page.locator('[data-delete-goal="target-goal"]').click();
  expect(confirmation).toContain('Feel the Spirit more');
  expect(confirmation).toContain('Connected tasks and habits will stay');
  expect(await page.evaluate(()=>state.goals.length)).toBe(2);
  expect(await page.evaluate(()=>state.tasks.find(t=>t.id==='linked-task').goalId)).toBe('target-goal');
  expect(await page.evaluate(()=>state.habits[0].goalId)).toBe('target-goal');
  await expect(page.locator('#goalsList details[data-goal="target-goal"]')).toBeVisible();
});
test('confirm Delete goal removes only that goal while keeping existing tasks/habits intact and unlinked',async({page})=>{
  const errors=await setup(page);
  page.once('dialog',d=>d.accept());
  await page.locator('[data-delete-goal="target-goal"]').click();
  await expect(page.locator('#goalsList details[data-goal="target-goal"]')).toHaveCount(0);
  await expect(page.locator('#goalsList details[data-goal="other-goal"]')).toHaveCount(1);
  const stateNow=await page.evaluate(()=>({
    goals:state.goals.map(g=>g.id),
    linkedTask:state.tasks.find(t=>t.id==='linked-task'),
    otherTask:state.tasks.find(t=>t.id==='other-task'),
    habit:state.habits.find(h=>h.id==='linked-habit'),
    stored:JSON.parse(localStorage.getItem('jgold-planner-v1'))
  }));
  expect(stateNow.goals).toEqual(['other-goal']);
  expect(stateNow.linkedTask).toMatchObject({title:'Scripture study',goalId:'',actionId:'',actionIndex:''});
  expect(stateNow.otherTask.goalId).toBe('other-goal');
  expect(stateNow.habit).toMatchObject({title:'Pray',goalId:'',actionId:''});
  expect(stateNow.stored.goals.map(g=>g.id)).toEqual(['other-goal']);
  await page.reload();
  await page.locator('[data-tab="myplan"]').click();
  await page.locator('[data-plan-tab="goals"]').click();
  await expect(page.locator('#goalsList details[data-goal="target-goal"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});
test('the existing Edit goal modal still deletes through the same preservation logic',async({page})=>{
  await setup(page);
  await page.locator('[data-edit-goal="target-goal"]').click();
  await expect(page.locator('#modalTitle')).toHaveText('Edit Goal');
  await expect(page.locator('#deleteModal')).toBeVisible();
  page.once('dialog',d=>d.accept());
  await page.locator('#deleteModal').click();
  await expect(page.locator('#goalsList details[data-goal="target-goal"]')).toHaveCount(0);
  expect(await page.evaluate(()=>state.tasks.find(t=>t.id==='linked-task').goalId)).toBe('');
  expect(await page.evaluate(()=>state.habits.find(h=>h.id==='linked-habit').goalId)).toBe('');
});
