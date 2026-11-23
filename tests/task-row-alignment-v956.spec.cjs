'use strict';
const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';
test.use({browserName:'chromium'});

test('Plan task rows keep long titles and actions in bounds across iPhone and iPad widths',async({page})=>{
  await page.goto(base);
  await page.evaluate(()=>{
    state.tasks=[
      {id:'align-open-short',title:'Review notes',done:false,priority:false,priorityRank:0,dueDate:'',date:''},
      {id:'align-done',title:'Email professor about research proposal',done:true,priority:true,priorityRank:1,dueDate:'2026-11-19',date:'2026-11-19'},
      {id:'align-ranked',title:'Prepare a considerably longer catalyst characterization presentation with many details',done:false,priority:true,priorityRank:2,dueDate:'2026-12-05',date:'2026-12-05'},
      {id:'align-undated-done',title:'Order materials',done:true,priority:false,priorityRank:0,dueDate:'',date:''}
    ];
    if(!save(true))throw Error('Unable to prepare Task fixtures');
    render();
  });
  await page.locator('[data-tab="myplan"]').click();
  await page.locator('#myplan .plan-tabs [data-plan-tab="tasks"]').click();

  const rows=page.locator('#allTasks [data-bp-task-row]');
  await expect(rows).toHaveCount(4);
  await expect(page.locator('#allTasks [data-bp-task-row="align-ranked"] .rank-badge')).toBeVisible();
  await expect(page.locator('#allTasks [data-bp-task-row="align-done"] .task-row-actions button')).toHaveText(['Edit','Delete']);
  await expect(page.locator('#allTasks [data-bp-task-row="align-open-short"] .task-row-actions button')).toHaveText(['Edit']);

  for(const width of [320,375,390,620,768,1024]){
    await page.setViewportSize({width,height:850});
    const geometry=await rows.evaluateAll(list=>list.map(row=>{
      const rect=sel=>{const r=row.querySelector(sel).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
      return {row:row.getBoundingClientRect().toJSON(),
        star:rect('.bp-task-star'),
        edit:rect('[data-bp-edit-task]'),actions:rect('.task-row-actions'),
        title:rect('.bp-task-title'),check:rect('.bp-task-check'),detail:rect('.bp-task-detail'),
        done:row.classList.contains('done'),deleteButton:row.querySelector('[data-delete-completed-task]')?.getBoundingClientRect().toJSON()};
    }));
    for(const field of width>620?['star','edit','title']:['title']){
      const left=geometry.map(g=>g[field].left);
      expect(Math.max(...left)-Math.min(...left),width+' '+field+' left alignment').toBeLessThanOrEqual(2);
    }
    for(const g of geometry){
      expect(g.check.height).toBeGreaterThanOrEqual(44);
      expect(g.star.height).toBeGreaterThanOrEqual(44);
      expect(g.title.left).toBeGreaterThanOrEqual(g.check.right-1);
      expect(g.detail.right).toBeLessThanOrEqual(g.star.left+1);
      expect(g.star.right).toBeLessThanOrEqual(g.row.right+1);
      if(width<=620){
        expect(g.edit.height).toBe(0);
        expect(g.title.height).toBeGreaterThanOrEqual(44);
        expect(g.row.height).toBeLessThan(g.detail.height+14);
      }else{
        expect(g.edit.height).toBeGreaterThanOrEqual(44);
      }
      if(g.done){
        expect(g.deleteButton.height).toBeGreaterThanOrEqual(44);
        expect(g.deleteButton.right).toBeLessThanOrEqual(g.row.right+1);
      }
    }
    const over=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
    expect(over,width+' horizontal overflow').toBeLessThanOrEqual(2);
  }
});

test('Plan star and Edit remain interactive without date popup',async({page})=>{
  await page.goto(base);
  await page.evaluate(()=>{
    state.tasks=[
      {id:'alignment-interactive',title:'Inspect columns',done:false,priority:false,priorityRank:0,dueDate:''},
      {id:'alignment-completed',title:'Finished report',done:true,priority:false,priorityRank:0,dueDate:'2026-11-20'}
    ];
    save(true);render();
  });
  await page.locator('[data-tab="myplan"]').click();
  await page.locator('#myplan .plan-tabs [data-plan-tab="tasks"]').click();
  await page.setViewportSize({width:390,height:844});
  const row=page.locator('#allTasks [data-bp-task-row="alignment-interactive"]');
  await row.locator('[data-bp-task-star]').click();
  await expect(row.locator('[data-bp-task-star]')).toHaveAttribute('aria-pressed','true');
  await expect(row.locator('[data-bp-task-date]')).toHaveCount(0);
  await expect(page.locator('#bpTaskDates')).toHaveCount(0);
  await expect(row.locator('[data-bp-edit-task]')).toBeHidden();
  await row.locator('[data-edit-task]').click();
  await expect(page.locator('#modalTitle')).toHaveText('Edit Task');
  await page.locator('#cancelModal').click();
  const done=page.locator('#allTasks [data-bp-task-row="alignment-completed"]');
  await expect(done.locator('[data-delete-completed-task]')).toBeVisible();
});

test('Today renders consistent task titles and readable dates without padded tiles',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto(base);
  await page.evaluate(()=>{
    state.appearance='dark';
    state.tasks=[
      {id:'preview-ranked',title:'Review the experimental characterization report',done:false,priority:true,priorityRank:1},
      {id:'preview-today',title:'Send field notes',done:false,priority:false,dueDate:localToday()}
    ];
    render();
  });
  const rows=page.locator('#v77TodayPriorities .bp-task-row');
  await expect(rows).toHaveCount(2);
  const details=await rows.evaluateAll(items=>items.map(row=>{
    const title=row.querySelector('.bp-task-title');
    return {left:title.getBoundingClientRect().left,font:getComputedStyle(title).fontSize,
      padding:getComputedStyle(row).paddingBlockStart,overflow:row.scrollWidth-row.clientWidth};
  }));
  expect(details[0].left).toBe(details[1].left);
  for(const row of details){
    expect(parseFloat(row.font)).toBeGreaterThanOrEqual(15);
    expect(row.padding).toBe('0px');
    expect(row.overflow).toBeLessThanOrEqual(1);
  }
  await expect(rows.locator('.bp-task-preview-due')).toHaveText('Due today');
  await expect(rows.locator('.rank-badge')).toHaveCount(1);
});
