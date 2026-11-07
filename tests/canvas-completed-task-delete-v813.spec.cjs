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

test('canceling deletion leaves the completed task and check mark untouched',async({page})=>{
  await openTasks(page);
  let message='';
  page.once('dialog',async d=>{message=d.message();await d.dismiss();});
  await row(page,'done-b').locator('[data-delete-completed-task]').click();
  expect(message).toContain('Delete completed task "Make progress on research"?');
  expect(message).toContain('cannot be undone');
  await expect(row(page,'done-b')).toBeVisible();
  await expect(row(page,'done-b').locator('[data-task-check]')).toBeChecked();
  expect(await page.evaluate(()=>state.tasks.length)).toBe(3);
});

test('confirmed deletion removes only that completed task, persists through reload and keeps open tasks',async({page})=>{
  const errors=await openTasks(page);
  page.once('dialog',d=>d.accept());
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
  page.once('dialog',d=>d.accept());
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
