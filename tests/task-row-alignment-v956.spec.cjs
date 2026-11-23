'use strict';
const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';
test.use({browserName:'chromium'});

test('Task stars, dates, Edit and optional Delete stay in columns across iPhone and iPad widths',async({page})=>{
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
        star:rect('.bp-task-star'),date:rect('.bp-task-due'),
        edit:rect('[data-bp-edit-task]'),actions:rect('.task-row-actions')};
    }));
    for(const field of ['star','date','edit']){
      const left=geometry.map(g=>g[field].left);
      expect(Math.max(...left)-Math.min(...left),width+' '+field+' left alignment').toBeLessThanOrEqual(2);
    }
    for(const g of geometry){
      expect(g.date.width,width+' deadline button width').toBeGreaterThanOrEqual(88);
      expect(g.edit.height,width+' Edit touch height').toBeGreaterThanOrEqual(44);
      expect(g.date.right,width+' deadline vs actions').toBeLessThanOrEqual(g.actions.left+1);
      expect(g.actions.right,width+' actions vs row edge').toBeLessThanOrEqual(g.row.right+1);
      expect(g.star.left,width+' star vs row edge').toBeGreaterThanOrEqual(g.row.left-1);
      expect(g.edit.right,width+' Edit within action area').toBeLessThanOrEqual(g.actions.right+1);
    }
    const over=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
    expect(over,width+' horizontal overflow').toBeLessThanOrEqual(2);
  }
});

test('Aligned Task date, star, Edit and Delete remain interactive',async({page})=>{
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
  const row=page.locator('#allTasks [data-bp-task-row="alignment-interactive"]');
  await row.locator('[data-bp-task-star]').click();
  await expect(row.locator('[data-bp-task-star]')).toHaveAttribute('aria-pressed','true');
  await row.locator('[data-bp-task-date]').click();
  await expect(page.locator('#bpTaskDates')).toBeVisible();
  await page.locator('#bpTaskDates [data-bp-date-preset="tomorrow"]').click();
  await row.locator('[data-bp-edit-task]').click();
  await expect(page.locator('#modalTitle')).toHaveText('Edit Task');
  await page.locator('#cancelModal').click();
  const done=page.locator('#allTasks [data-bp-task-row="alignment-completed"]');
  await expect(done.locator('[data-delete-completed-task]')).toBeVisible();
});
