const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';
test.use({browserName:'chromium',viewport:{width:390,height:844},isMobile:true,hasTouch:true});

async function openTasks(page){
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  await page.locator('[data-tab="myplan"]').click();
  await page.locator('[data-plan-tab="tasks"]').click();
  await expect(page.locator('#allTasks')).toBeVisible();
  await page.evaluate(()=>{
    state.tasks=[
      {id:'done-a',title:'Read chemistry notes',done:false,priority:false},
      {id:'done-b',title:'Make progress on research',done:true,priority:false},
      {id:'done-c',title:'Work on project',done:false,priority:false}
    ];
    if(!save())throw Error('Unable to save fixture');
    render();
  });
  return errors;
}
const row=(page,id)=>page.locator('#allTasks .entry').filter({has:page.locator('[data-task-check="'+id+'"]')});

test('completed tasks show Delete immediately beside Edit; open tasks show only Edit',async({page})=>{
  const errors=await openTasks(page);
  const done=row(page,'done-b'),active=row(page,'done-a');
  await expect(done).toBeVisible();
  await expect(active).toBeVisible();
  await expect(done.locator('.task-row-actions button')).toHaveText(['Edit','Delete']);
  await expect(done.locator('[data-delete-completed-task="done-b"]')).toHaveAttribute('aria-label','Delete completed task Make progress on research');
  await expect(active.locator('.task-row-actions button')).toHaveText(['Edit']);
  await expect(active.locator('[data-delete-completed-task]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('checking a task reveals Delete and unchecking it removes Delete without losing task data',async({page})=>{
  await openTasks(page);
  await expect(row(page,'done-a').locator('[data-delete-completed-task]')).toHaveCount(0);
  await row(page,'done-a').locator('[data-task-check="done-a"]').check();
  await expect(row(page,'done-a').locator('[data-delete-completed-task="done-a"]')).toBeVisible();
  await expect(row(page,'done-a').locator('.task-row-actions button')).toHaveText(['Edit','Delete']);
  await row(page,'done-a').locator('[data-task-check="done-a"]').uncheck();
  await expect(row(page,'done-a').locator('[data-delete-completed-task]')).toHaveCount(0);
  expect(await page.evaluate(()=>state.tasks.find(t=>t.id==='done-a').done)).toBe(false);
});

test('one tap deletes a completed task without showing a confirmation dialog',async({page})=>{
  await openTasks(page);
  const dialogs=[];
  page.on('dialog',async d=>{dialogs.push(d.message());await d.dismiss();});
  await row(page,'done-b').locator('[data-delete-completed-task]').click();
  await expect(row(page,'done-b')).toHaveCount(0);
  expect(dialogs).toEqual([]);
  expect(await page.evaluate(()=>state.tasks.map(t=>t.id))).toEqual(['done-a','done-c']);
});

test('one-tap deletion removes only that completed task, persists through reload and keeps open tasks',async({page})=>{
  const errors=await openTasks(page);
  await row(page,'done-b').locator('[data-delete-completed-task]').click();
  await expect(row(page,'done-b')).toHaveCount(0);
  await expect(row(page,'done-a')).toBeVisible();
  await expect(row(page,'done-c')).toBeVisible();
  const retained=await page.evaluate(()=>state.tasks.map(t=>t.id));
  expect(retained).toEqual(['done-a','done-c']);
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('jgold-planner-v1')).tasks.map(t=>t.id));
  expect(stored).toEqual(['done-a','done-c']);
  await page.reload();
  await page.locator('[data-tab="myplan"]').click();
  await page.locator('[data-plan-tab="tasks"]').click();
  await expect(row(page,'done-b')).toHaveCount(0);
  await expect(row(page,'done-a')).toBeVisible();
  expect(errors).toEqual([]);
});

test('inline delete preserves the existing Edit modal and uses the existing shared cleanup',async({page})=>{
  await openTasks(page);
  await row(page,'done-b').locator('[data-edit-task="done-b"]').click();
  await expect(page.locator('#modalBack')).toBeVisible();
  await expect(page.locator('#deleteModal')).toBeVisible();
  await page.locator('#cancelModal').click();
  await row(page,'done-b').locator('[data-delete-completed-task]').click();
  await expect(row(page,'done-b')).toHaveCount(0);
  await expect(row(page,'done-a').locator('[data-edit-task="done-a"]')).toBeVisible();
});

test('the inline Delete action works with long completed titles in a phone-width layout',async({page})=>{
  await openTasks(page);
  await page.evaluate(()=>{
    const t=state.tasks.find(t=>t.id==='done-b');
    t.title='Snoopy themed advent calendar with twenty four figurines';
    save();render();
  });
  const done=row(page,'done-b');
  await expect(done.locator('.task-row-actions button')).toHaveText(['Edit','Delete']);
  const geometry=await done.locator('.task-row-actions').evaluate(el=>{
    const card=el.closest('.entry').getBoundingClientRect(),area=el.getBoundingClientRect();
    return {left:area.left,right:area.right,cardRight:card.right,width:area.width};
  });
  expect(geometry.left).toBeGreaterThanOrEqual(0);
  expect(geometry.right).toBeLessThanOrEqual(geometry.cardRight+2);
  expect(geometry.width).toBeGreaterThan(50);
});

test('completed Task deletion from editor is immediate but unfinished Task deletion remains protected',async({page})=>{
  await openTasks(page);
  const dialogs=[];
  page.on('dialog',async d=>{dialogs.push(d.message());await d.dismiss();});
  await row(page,'done-b').locator('[data-edit-task="done-b"]').click();
  await page.locator('#deleteModal').click();
  await expect(row(page,'done-b')).toHaveCount(0);
  await expect(page.locator('#modalBack')).not.toHaveClass(/open/);
  expect(dialogs).toEqual([]);
  await row(page,'done-a').locator('[data-edit-task="done-a"]').click();
  await page.locator('#deleteModal').click();
  expect(dialogs).toHaveLength(1);
  expect(dialogs[0]).toContain('cannot be undone');
  await expect(row(page,'done-a')).toBeVisible();
  await expect(page.locator('#modalBack')).toHaveClass(/open/);
});

test('one-tap removal cleans Project actions and idea links without creating a duplicate Task',async({page})=>{
  await openTasks(page);
  await page.evaluate(()=>{
    const t=state.tasks.find(t=>t.id==='done-b');
    t.projectId='linked-project';
    t.projectActionId='linked-action';
    state.projects.push({id:'linked-project',title:'Research',actions:[
      {id:'linked-action',taskId:t.id,title:t.title,done:true},
      {id:'unrelated-action',taskId:'done-a',title:'Keep this action',done:false}
    ],library:[],notes:[]});
    state.ideas.push({id:'linked-idea',title:'Linked idea',actions:[
      {id:'idea-action',title:t.title,taskId:t.id,done:true}
    ]});
    if(!save(true))throw Error('Unable to seed linked Task');
    render();
  });
  const dialogs=[];page.on('dialog',d=>{dialogs.push(d.message());d.dismiss();});
  await row(page,'done-b').locator('[data-delete-completed-task]').click();
  const details=await page.evaluate(()=>{
    render();
    const saved=JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {
      taskExists:state.tasks.some(t=>t.id==='done-b'),
      linkedProjectActions:state.projects[0].actions.map(a=>a.id),
      ideaTaskId:state.ideas[0].actions[0].taskId,
      storedTaskExists:saved.tasks.some(t=>t.id==='done-b'),
      storedProjectActions:saved.projects[0].actions.map(a=>a.id),
      storedIdeaTaskId:saved.ideas[0].actions[0].taskId
    };
  });
  expect(dialogs).toEqual([]);
  expect(details).toEqual({taskExists:false,linkedProjectActions:['unrelated-action'],ideaTaskId:'',
    storedTaskExists:false,storedProjectActions:['unrelated-action'],storedIdeaTaskId:''});
});

test('failed storage write keeps completed Task and linked references visible',async({page})=>{
  await openTasks(page);
  await page.evaluate(()=>{
    const t=state.tasks.find(t=>t.id==='done-b');
    t.projectId='rollback-project';t.projectActionId='rollback-action';
    state.projects.push({id:'rollback-project',title:'Research',actions:[
      {id:'rollback-action',taskId:'done-b',title:t.title,done:true}
    ],library:[],notes:[]});
    state.ideas.push({id:'rollback-idea',title:'Research notes',actions:[
      {id:'rollback-idea-action',title:'Step',taskId:'done-b',done:true}
    ]});
    if(!save(true))throw Error('Unable to prepare linked Task');
    const original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(k,v){
      if(k===STORAGE_KEY)throw new DOMException('Storage full','QuotaExceededError');
      return original.call(this,k,v);
    };
    window.restoreTaskDeleteStorage=()=>{Storage.prototype.setItem=original;};
  });
  try{
    await row(page,'done-b').locator('[data-delete-completed-task]').click();
    await expect(row(page,'done-b')).toBeVisible();
    const result=await page.evaluate(()=>{
      const disk=JSON.parse(localStorage.getItem(STORAGE_KEY));
      return {
        taskExists:state.tasks.some(t=>t.id==='done-b'),
        projectActionCount:state.projects[0].actions.length,
        projectTaskId:state.projects[0].actions[0].taskId,
        ideaTaskId:state.ideas[0].actions[0].taskId,
        diskTaskExists:disk.tasks.some(t=>t.id==='done-b')
      };
    });
    expect(result).toEqual({taskExists:true,projectActionCount:1,projectTaskId:'done-b',ideaTaskId:'done-b',diskTaskExists:true});
  }finally{
    await page.evaluate(()=>window.restoreTaskDeleteStorage());
  }
});
