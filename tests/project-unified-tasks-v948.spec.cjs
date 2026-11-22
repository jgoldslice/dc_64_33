'use strict';
const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';

test.use({browserName:'chromium'});
async function project(page,name='Research Project'){
  await page.goto(base);
  await page.evaluate(name=>v6CreateProject(name),name);
  await expect(page.locator('#projectOverview')).toBeVisible();
}
async function addTodo(page,title){
  await page.locator('#v919QuickTodo input[name="title"]').fill(title);
  await page.locator('#v919QuickTodo button[type="submit"]').click();
}

test('Project Overview To-Do is immediately a single Plan Task, can be prioritized and completed in either view',async({page})=>{
  await project(page);
  await addTodo(page,'Analyze catalyst yield');
  await expect(page.locator('#v919TodoPreview .v919-todo-row')).toHaveCount(1);
  expect(await page.evaluate(()=>{
    const p=v6Project(),a=p.actions[0];
    return {actions:p.actions.length,linked:state.tasks.filter(t=>String(t.projectId)===String(p.id)).length,
      idMatches:String(state.tasks.find(t=>String(t.projectId)===String(p.id))?.id)===String(a.taskId)};
  })).toEqual({actions:1,linked:1,idMatches:true});
  const star=page.locator('#v919TodoPreview [data-v6-priority]');
  await expect(star).toHaveAttribute('aria-pressed','false');
  await star.click();
  await expect(star).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#priorities')).toContainText('Analyze catalyst yield');
  await page.locator('#v919TodoPreview [data-v919-check]').check();
  expect(await page.evaluate(()=>{
    const p=v6Project(),a=p.actions[0],t=state.tasks.find(t=>String(t.id)===String(a.taskId));
    return [a.done,t.done,t.priority];
  })).toEqual([true,true,true]);
  await page.reload();
  const count=await page.evaluate(()=>state.tasks.filter(t=>t.projectActionId).length);
  expect(count).toBe(1);
});

test('Full project To-Do list and its board share task ID and priority with Plan',async({page})=>{
  await project(page);
  await page.locator('[data-v919-project-open="actions"]').click();
  await page.locator('#projectActionInput').fill('Assemble experiment');
  await page.locator('#projectActionForm button[type="submit"]').click();
  await expect(page.locator('#projectActionsList [data-v6-priority]')).toHaveCount(1);
  await page.locator('#projectActionsList [data-v6-priority]').click();
  await expect(page.locator('#projectActionsList [data-v6-priority]')).toHaveAttribute('aria-pressed','true');
  await page.locator('[data-action-view="board"]').click();
  await expect(page.locator('.v74-board [data-v6-priority]')).toHaveAttribute('aria-pressed','true');
  await page.locator('.bottom-nav button[data-tab="myplan"]').click();
  await page.locator('#myplan .plan-tabs [data-plan-tab="tasks"]').click();
  await expect(page.locator('#allTasks')).toContainText('Assemble experiment');
  await expect(page.locator('#tasksPriority')).toContainText('Assemble experiment');
});

test('Older project actions without linked tasks are upgraded exactly once and inherit project Area',async({page})=>{
  await project(page);
  await page.evaluate(()=>{
    const p=v6Project();
    p.area='Research';
    p.actions.push({id:'legacy-unlinked',title:'Prepare old results',done:false,taskId:''});
    save();
  });
  await page.reload();
  const snapshot=()=>page.evaluate(()=>{
    const p=state.projects.find(p=>p.actions.some(a=>a.id==='legacy-unlinked'));
    const a=p.actions.find(a=>a.id==='legacy-unlinked');
    const linked=state.tasks.filter(t=>String(t.projectId)===String(p.id)&&String(t.projectActionId)===String(a.id));
    return {count:linked.length,hasId:String(a.taskId)===String(linked[0]?.id),area:linked[0]?.area};
  });
  expect(await snapshot()).toEqual({count:1,hasId:true,area:'Research'});
  await expect(page.locator('#allTasks')).toContainText('Prepare old results');
  await page.reload();
  expect(await snapshot()).toEqual({count:1,hasId:true,area:'Research'});
});

test('Editing or deleting a Plan task updates its Project and does not resurrect a deleted task',async({page})=>{
  await project(page);
  await addTodo(page,'Initial title');
  await page.locator('.bottom-nav button[data-tab="myplan"]').click();
  await page.locator('#myplan .plan-tabs [data-plan-tab="tasks"]').click();
  const taskId=await page.evaluate(()=>state.projects[0].actions[0].taskId);
  await page.locator('#allTasks [data-edit-task="'+taskId+'"]').click();
  await page.locator('#modalFields [name="title"]').fill('Revised title');
  await page.locator('#modalFields [name="priority"]').check();
  await page.locator('#modalForm button[type="submit"]').click();
  expect(await page.evaluate(()=>{
    const p=state.projects[0],a=p.actions[0],t=state.tasks.find(t=>String(t.id)===String(a.taskId));
    return [a.title,t.title,t.priority];
  })).toEqual(['Revised title','Revised title',true]);
  await page.locator('.bottom-nav button[data-tab="brainstorm"]').click();
  await expect(page.locator('#v919TodoPreview')).toContainText('Revised title');
  await page.locator('.bottom-nav button[data-tab="myplan"]').click();
  await page.locator('#myplan .plan-tabs [data-plan-tab="tasks"]').click();
  await page.locator('#allTasks [data-task-check="'+taskId+'"]').check();
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#allTasks [data-delete-completed-task="'+taskId+'"]').click();
  // Deletion uses a confirmation dialog.
  await expect.poll(()=>page.evaluate(id=>state.tasks.some(t=>String(t.id)===String(id)),taskId)).toBe(false);
  await page.reload();
  expect(await page.evaluate(()=>[state.projects[0].actions.length,state.tasks.filter(t=>t.projectActionId).length])).toEqual([0,0]);
});

test('Two legacy To-Dos that refer to one task retain separate, stable links',async({page})=>{
  await project(page);
  await page.evaluate(()=>{
    const p=v6Project();
    state.tasks.push({id:'old-task',title:'First work item',done:false,priority:false,priorityRank:0,
      projectId:p.id,projectActionId:'old-action-1'});
    p.actions.push(
      {id:'old-action-1',title:'First work item',done:false,taskId:'old-task'},
      {id:'old-action-2',title:'Second work item',done:false,taskId:'old-task'}
    );
    save();
  });
  await page.reload();
  const snapshot=()=>page.evaluate(()=>{
    const p=state.projects[0];
    return p.actions.map(a=>({
      action:a.id,
      taskId:String(a.taskId),
      matching:state.tasks.filter(t=>String(t.projectId)===String(p.id)&&String(t.projectActionId)===String(a.id)).length
    }));
  });
  const first=await snapshot();
  expect(first).toHaveLength(2);
  expect(first.map(x=>x.matching)).toEqual([1,1]);
  expect(first[0].taskId).not.toBe(first[1].taskId);
  await page.reload();
  expect(await snapshot()).toEqual(first);
});
