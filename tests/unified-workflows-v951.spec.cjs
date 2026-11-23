'use strict';
const {test,expect}=require('@playwright/test');
const {submitSheet}=require('./sheet-helper.cjs');
const base='http://127.0.0.1:8765/';
test.use({browserName:'chromium'});

async function newProject(page){
  await page.goto(base);
  await page.locator('[data-tab="brainstorm"]').click();
  await page.locator('#newProject').click();
  await submitSheet(page,'Shared Workflow QA');
  await expect(page.locator('#projectOverview')).toBeVisible();
  return page.evaluate(()=>v6Project().id);
}
const setTitle=(page,title)=>page.locator('#modalForm input[name="title"]').fill(title);

test('Project quick creation reuses Task, Habit and Goal forms with inherited Project Area',async({page})=>{
  const projectId=await newProject(page);
  await page.evaluate(()=>{
    const p=v6Project();p.area='Research';state.categories.push('Research');
    if(!save(true))throw Error('Could not prepare Project');
  });
  await page.locator('[data-bp-project-add="goal"]').click();
  await expect(page.locator('#modalForm select[name="projectId"]')).toHaveValue(String(projectId));
  await setTitle(page,'Publish catalyst report');
  await page.locator('#modalForm button[type="submit"]').click();
  await expect(page.locator('#modalBack')).not.toHaveClass(/open/);

  await page.locator('[data-bp-project-add="habit"]').click();
  await expect(page.locator('#modalForm select[name="projectId"]')).toHaveValue(String(projectId));
  await setTitle(page,'Run GC every day');
  await page.locator('#modalForm button[type="submit"]').click();

  await page.locator('[data-bp-project-add="task"]').click();
  await expect(page.locator('#modalForm select[name="projectId"]')).toHaveValue(String(projectId));
  await setTitle(page,'Prepare vials');
  await page.locator('#modalForm button[type="submit"]').click();
  await expect(page.locator('#v919TodoPreview')).toContainText('Prepare vials');

  const result=await page.evaluate(()=>{
    const p=v6Project(),goal=state.goals.find(g=>g.title==='Publish catalyst report');
    const habit=state.habits.find(h=>h.title==='Run GC every day');
    const task=state.tasks.find(t=>t.title==='Prepare vials');
    return {
      goal:{projectId:goal?.projectId,area:goal?.category},
      habit:{projectId:habit?.projectId,area:habit?.area},
      task:{projectId:task?.projectId,actionId:task?.projectActionId},
      action:p.actions.find(a=>String(a.taskId)===String(task.id))?.title
    };
  });
  expect(result.goal).toEqual({projectId,area:'Research'});
  expect(result.habit).toEqual({projectId,area:'Research'});
  expect(result.task.projectId).toBe(projectId);
  expect(result.task.actionId).toBeTruthy();
  expect(result.action).toBe('Prepare vials');
  await expect(page.locator('#v951ProjectConnections')).toContainText('Publish catalyst report');
  await expect(page.locator('#v951ProjectConnections')).toContainText('Run GC every day');
  await expect(page.locator('#v951ProjectPulse')).toContainText('Tasks done');
  await page.locator('[data-tab="myplan"]').click();
  await page.locator('#myplan .plan-tabs [data-plan-tab="goals"]').click();
  await expect(page.locator('#goalsList')).toContainText('Publish catalyst report');
  await page.locator('#myplan .plan-tabs [data-plan-tab="habits"]').click();
  await expect(page.locator('#habitManager')).toContainText('Run GC every day');
  await page.locator('#myplan .plan-tabs [data-plan-tab="tasks"]').click();
  await expect(page.locator('#allTasks')).toContainText('Prepare vials');
});

test('Today unified priority title opens Plan, where dates and priority are edited',async({page})=>{
  await page.goto(base);
  await page.evaluate(()=>{
    state.tasks=[{id:'unified-task',title:'Design reactor',done:false,dueDate:localToday(),
      date:localToday(),scheduledDate:'',scheduledTime:'',priority:false,priorityRank:0}];
    if(!save(true))throw Error('Cannot seed Task');render();
  });
  const today=page.locator('#v77TodayPriorities [data-bp-task-row="unified-task"]');
  await expect(today).toContainText('Design reactor');
  await expect(today.locator('[data-bp-swipe-tomorrow],[data-bp-task-star],[data-bp-task-date],[data-bp-edit-task]')).toHaveCount(0);
  await today.locator('[data-bp-jump-task="unified-task"]').click();
  await expect(page.locator('#myplan')).toHaveClass(/active/);
  await expect(page.locator('#tasks')).toHaveClass(/active/);
  await expect(page.locator('#allTasks [data-bp-task-row="unified-task"]')).toHaveClass(/bp-plan-jump-highlight/);
  const row=page.locator('#allTasks [data-bp-task-row="unified-task"]');
  await row.locator('[data-bp-task-star]').click();
  expect(await page.evaluate(()=>state.tasks[0].priority)).toBe(true);
  await expect(row.locator('[data-bp-task-date]')).toHaveCount(0);
  await row.locator('[data-bp-edit-task]').click();
  await page.locator('#modalForm input[name="dueDate"]').fill('2026-12-10');
  await page.locator('#modalForm input[name="scheduledDate"]').fill('2026-12-09');
  await page.locator('#modalForm input[name="scheduledTime"]').fill('14:15');
  await page.locator('#modalForm button[type="submit"]').click();
  expect(await page.evaluate(()=>{const t=state.tasks[0];return {due:t.dueDate,day:t.scheduledDate,time:t.scheduledTime};}))
    .toEqual({due:'2026-12-10',day:'2026-12-09',time:'14:15'});
});

test('Week calendar checkoff persists and Task name navigates to Plan without Add Event',async({page})=>{
  await page.goto(base);
  await page.evaluate(()=>{
    selectedWeek=startOfWeek(new Date('2026-12-09T12:00:00'));
    state.tasks=[{id:'calendar-task',title:'Run the reactor',done:false,dueDate:'2026-12-12',
      date:'2026-12-12',scheduledDate:'2026-12-09',scheduledTime:'11:30',priority:false,priorityRank:0}];
    state.events=[{id:'calendar-event',title:'Lab meeting',date:'2026-12-09',time:'09:00'}];
    if(!save(true))throw Error('Cannot seed Week');render();
  });
  await page.locator('[data-tab="week"]').click();
  const wednesday=page.locator('#weekGrid [data-week-event-date="2026-12-09"]');
  await expect(wednesday).toContainText('Lab meeting');
  await expect(wednesday).toContainText('Run the reactor');
  await wednesday.locator('[data-task-check="calendar-task"]').check();
  await expect(wednesday.locator('[data-task-check="calendar-task"]')).toBeChecked();
  await expect(page.locator('#v87EventBack')).toBeHidden();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem(STORAGE_KEY)).tasks[0].done)).toBe(true);
  await wednesday.locator('[data-bp-jump-task="calendar-task"]').click();
  await expect(page.locator('#tasks')).toHaveClass(/active/);
  await expect(page.locator('#allTasks [data-bp-task-row="calendar-task"]')).toHaveClass(/bp-plan-jump-highlight/);
});

test('Week linked Project Task checkoff stays synchronized without swipe actions',async({page})=>{
  await newProject(page);
  await page.locator('[data-bp-project-add="task"]').click();
  await setTitle(page,'Inspect catalyst');
  await page.locator('#modalForm button[type="submit"]').click();
  const task=await page.evaluate(()=>{
    const t=state.tasks.find(t=>t.title==='Inspect catalyst');
    t.scheduledDate=localToday();t.dueDate=localToday();t.date=t.dueDate;
    t.priority=true;t.priorityRank=1;
    if(!save(true))throw Error('Cannot seed linked Task');render();return t.id;
  });
  await page.locator('[data-tab="week"]').click();
  const today=await page.evaluate(()=>localToday());
  const row=page.locator('#priorities [data-bp-task-row="'+task+'"]');
  await expect(row).toBeVisible();
  await expect(row.locator('[data-bp-swipe-done],[data-bp-swipe-tomorrow]')).toHaveCount(0);
  await page.locator('#weekGrid [data-week-event-date="'+today+'"] [data-task-check="'+task+'"]').check();
  const changed=await page.evaluate(id=>{
    const t=state.tasks.find(t=>String(t.id)===String(id));
    const p=state.projects.find(p=>String(p.id)===String(t.projectId));
    const a=p.actions.find(a=>String(a.id)===String(t.projectActionId));
    const disk=JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {done:t.done,actionDone:a.done,diskTask:disk.tasks.find(x=>String(x.id)===String(id))?.done,
      diskAction:disk.projects[0].actions.find(x=>String(x.id)===String(a.id))?.done};
  },task);
  expect(changed).toEqual({done:true,actionDone:true,diskTask:true,diskAction:true});
});
test('Project removal detaches but does not delete linked Tasks, Habits, or Goals',async({page})=>{
  const id=await newProject(page);
  await page.evaluate(id=>{
    const project=v6Project();project.area='Research';
    state.goals.push({id:'keep-goal',title:'Keep this goal',category:'Research',projectId:id,actions:[]});
    state.habits.push({id:'keep-habit',title:'Keep this habit',projectId:id,goalId:'keep-goal',schedule:[0,1,2,3,4,5,6],days:{},area:'Research'});
    save(true);render();
  },id);
  // The established Project delete flow uses a native-style confirmation sheet.
  await page.locator('#renameProject').click();
  await expect(page.locator('#deleteProject')).toBeVisible();
  await page.locator('#deleteProject').click();
  await submitSheet(page);
  await expect.poll(()=>page.evaluate(()=>state.projects.some(p=>p.title==='Shared Workflow QA'))).toBe(false);
  const result=await page.evaluate(()=>({
    goal:state.goals.find(g=>g.id==='keep-goal'),
    habit:state.habits.find(h=>h.id==='keep-habit')
  }));
  expect(result.goal.projectId).toBe('');
  expect(result.goal.category).toBe('Research');
  expect(result.habit.projectId).toBe('');
  expect(result.habit.area).toBe('Research');
});

test('Plan priority save failure restores the prior task and on-screen star',async({page})=>{
  await page.goto(base);
  await page.evaluate(()=>{
    state.tasks=[{id:'save-guard',title:'Safe Task',done:false,dueDate:localToday(),priority:false,priorityRank:0}];
    save(true);render();
    const original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(k,v){
      if(k===STORAGE_KEY)throw new DOMException('Storage full','QuotaExceededError');
      return original.call(this,k,v);
    };
    window.restoreWrite=()=>Storage.prototype.setItem=original;
  });
  try{
    await page.locator('[data-tab="myplan"]').click();
    await page.locator('#myplan .plan-tabs [data-plan-tab="tasks"]').click();
    await page.locator('#allTasks [data-bp-task-star="save-guard"]').click();
    expect(await page.evaluate(()=>state.tasks[0].priority)).toBe(false);
    await expect(page.locator('#allTasks [data-bp-task-star="save-guard"]')).toHaveAttribute('aria-pressed','false');
  }finally{await page.evaluate(()=>window.restoreWrite());}
});

test('Quick Add opens the existing shared form and inherits the active Project or Area',async({page})=>{
  const projectId=await newProject(page);
  await page.locator('#bpQuickAdd').click();
  await expect(page.locator('#bpQuickAddMenu')).toBeVisible();
  await page.locator('[data-bp-quick-kind="habit"]').click();
  await expect(page.locator('#modalTitle')).toHaveText('Add Habit');
  await expect(page.locator('#modalForm select[name="projectId"]')).toHaveValue(String(projectId));
  await setTitle(page,'Shared quick habit');
  await page.locator('#modalForm button[type="submit"]').click();
  expect(await page.evaluate(()=>state.habits.find(h=>h.title==='Shared quick habit')?.projectId)).toBe(projectId);

  await page.locator('[data-tab="myplan"]').click();
  await page.locator('#bpAreasRoot [data-bpa-open="Research"]').click();
  await page.locator('#bpQuickAdd').click();
  await page.locator('[data-bp-quick-kind="task"]').click();
  await expect(page.locator('#modalForm select[name="area"]')).toHaveValue('Research');
  await expect(page.locator('#modalForm select[name="projectId"]')).toHaveValue('');
  await setTitle(page,'Area quick task');
  await page.locator('#modalForm button[type="submit"]').click();
  const task=await page.evaluate(()=>state.tasks.find(t=>t.title==='Area quick task'));
  expect(task.area).toBe('Research');
  expect(task.projectId).toBe('');
});

test('Goal step conversion inherits a Project and avoids duplicate Task/Habit records',async({page})=>{
  const projectId=await newProject(page);
  await page.evaluate(id=>{
    const p=v6Project();p.area='Research';
    state.goals.push({id:'linked-goal',title:'Linked goal',projectId:id,category:'Research',
      actions:[{id:'step-1',title:'Analyze spectra',done:false}]});
    save(true);render();
  },projectId);
  await page.locator('[data-tab="myplan"]').click();
  await page.locator('#myplan .plan-tabs [data-plan-tab="goals"]').click();
  const goal=page.locator('#goalsList [data-goal="linked-goal"]');
  await goal.locator('summary').click();
  await goal.locator('[data-v77-step-action]').click();
  await goal.locator('[data-action-to-task]').click();
  const afterTask=await page.evaluate(()=>{
    const t=state.tasks.find(t=>t.title==='Analyze spectra');
    return {count:state.tasks.filter(t=>t.title==='Analyze spectra').length,
      projectId:t?.projectId,projectAction:state.projects[0].actions.some(a=>String(a.taskId)===String(t?.id))};
  });
  expect(afterTask).toEqual({count:1,projectId,projectAction:true});

  await page.locator('#myplan .plan-tabs [data-plan-tab="goals"]').click();
  const sameGoal=page.locator('#goalsList [data-goal="linked-goal"]');
  await sameGoal.locator('[data-v77-step-action]').click();
  await sameGoal.locator('[data-action-to-habit]').click();
  await expect(page.locator('#modalTitle')).toHaveText('Edit Habit');
  await page.locator('#cancelModal').click();
  expect(await page.evaluate(()=>({
    count:state.habits.filter(h=>h.title==='Analyze spectra').length,
    projectId:state.habits.find(h=>h.title==='Analyze spectra')?.projectId
  }))).toEqual({count:1,projectId});
});
