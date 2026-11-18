'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('node:fs/promises');
const base='http://127.0.0.1:8765/';
test.use({browserName:'chromium',viewport:{width:390,height:844},isMobile:true,hasTouch:true});

async function openSchedule(page){
  await page.goto(base);
  await page.locator('[data-tab="myplan"]').click();
  await page.locator('[data-wb-launch]').click();
  await page.locator('[data-wb-step="2"]').click();
  await expect(page.locator('#wbEventForm input[name="title"]')).toBeVisible();
}

test('rapid weekly-event draft typing writes once on blur, retaining the final title',async({page})=>{
  await openSchedule(page);
  const result=await page.evaluate(()=>{
    const input=document.querySelector('#wbEventForm input[name="title"]');
    const original=Storage.prototype.setItem;let writes=0;
    Storage.prototype.setItem=function(k,v){
      if(k==='blueprint-weekly-v918-draft')writes++;
      return original.call(this,k,v);
    };
    try{
      input.focus();
      for(let i=0;i<70;i++){
        input.value='Meeting '+i;
        input.dispatchEvent(new Event('input',{bubbles:true}));
      }
      const before={writes,pending:BlueprintWeekly.getDraft().eventForm.title};
      input.blur();
      const persisted=JSON.parse(localStorage.getItem('blueprint-weekly-v918-draft'));
      return {before,writes,pendingAfter:BlueprintWeekly.getDraft().eventForm.title,
        saved:persisted.eventForm.title};
    }finally{Storage.prototype.setItem=original;}
  });
  expect(result.before).toEqual({writes:0,pending:'Meeting 69'});
  expect(result.writes).toBe(1);
  expect(result.saved).toBe('Meeting 69');
  expect(result.pendingAfter).toBe('Meeting 69');
});

test('Weekly Blueprint pending input flushes on pagehide and resumes after reload',async({page})=>{
  await openSchedule(page);
  await page.evaluate(()=>{
    const input=document.querySelector('#wbEventForm input[name="title"]');
    input.value='Meeting after app background';
    input.dispatchEvent(new Event('input',{bubbles:true}));
    window.dispatchEvent(new Event('pagehide'));
  });
  const disk=await page.evaluate(()=>JSON.parse(localStorage.getItem('blueprint-weekly-v918-draft')).eventForm.title);
  expect(disk).toBe('Meeting after app background');
  await page.reload();
  await page.locator('[data-tab="myplan"]').click();
  await page.locator('[data-wb-launch]').click();
  await expect(page.locator('#wbEventForm input[name="title"]')).toHaveValue('Meeting after app background');
});

test('an unreadable saved weekly draft remains intact until explicit recovery action',async({page})=>{
  await page.goto(base);
  const broken='{"version":1,"step":[';
  await page.evaluate(value=>localStorage.setItem('blueprint-weekly-v918-draft',value),broken);
  await page.reload();
  await page.locator('[data-tab="myplan"]').click();
  await page.locator('[data-wb-launch]').click();
  await expect(page.locator('#wbDraftRecovery')).toBeVisible();
  await expect(page.locator('#wbNextButton')).toBeDisabled();
  expect(await page.evaluate(()=>localStorage.getItem('blueprint-weekly-v918-draft'))).toBe(broken);
  const [download]=await Promise.all([
    page.waitForEvent('download'),
    page.locator('#wbDownloadBadDraft').click()
  ]);
  expect(await fs.readFile(await download.path(),'utf8')).toBe(broken);
  expect(await page.evaluate(()=>localStorage.getItem('blueprint-weekly-v918-draft'))).toBe(broken);
  page.on('dialog',async d=>d.accept());
  await page.locator('#wbResetBadDraft').click();
  await expect(page.locator('#wbDraftRecovery')).toBeHidden();
  await expect(page.locator('#wbNextButton')).toBeEnabled();
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('blueprint-weekly-v918-draft')));
  expect(stored.version).toBe(1);
  expect(stored.step).toBe(0);
});

test('a Weekly Blueprint quota failure retains its unsaved draft and warns on exit',async({page})=>{
  await openSchedule(page);
  const result=await page.evaluate(()=>{
    const input=document.querySelector('#wbEventForm input[name="title"]');
    const original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){
      if(key==='blueprint-weekly-v918-draft')throw new DOMException('Quota','QuotaExceededError');
      return original.call(this,key,value);
    };
    try{
      input.focus();input.value='Uncommitted scheduled meeting';
      input.dispatchEvent(new Event('input',{bubbles:true}));
      input.blur();
      const event=new Event('beforeunload',{cancelable:true});
      window.dispatchEvent(event);
      return {inMemory:BlueprintWeekly.getDraft().eventForm.title,
        warned:document.querySelector('#wbStatus').textContent.includes('could not be saved'),
        blockedExit:event.defaultPrevented};
    }finally{Storage.prototype.setItem=original;}
  });
  expect(result).toEqual({
    inMemory:'Uncommitted scheduled meeting',warned:true,blockedExit:true
  });
});

test('applying a Weekly Blueprint Step deletion preserves the parent Goal link of its Habit',async({page})=>{
  await page.goto(base);
  await page.evaluate(()=>{
    state.goals=[{id:'wbg1',title:'Learn piano',category:'Personal',motivation:'',
      actions:[{id:'step1',title:'Practice scales',done:false},
        {id:'step2',title:'Learn a song',done:false,plannedDate:'2026-12-01',
         metadata:{source:'old-note'}}]}];
    state.habits=[{id:'habit1',title:'Practice daily',goalId:'wbg1',actionId:'step1',
      days:{'2026-11-16':true},schedule:[0,1,2,3,4,5,6],weeklyTarget:4,
      createdOn:'2026-11-16'}];
    state.tasks=[];state.events=[];state.ideas=[];
    if(!save(true))throw Error('Fixture failed to save');
    render();
  });
  await page.locator('[data-tab="myplan"]').click();
  await page.locator('[data-wb-launch]').click();
  await page.locator('[data-wb-step="1"]').click();
  await page.locator('[data-wb-goal-details="wbg1"] summary').click();
  await page.locator('[data-wb-step-delete="wbg1"][data-wb-step="step1"]').click();
  expect(await page.evaluate(()=>state.goals[0].actions)).toHaveLength(2);
  // Verify the edit remains staged and distinct from the real planner before
  // switching stages; this protects against accidental early mutation.
  const staged=await page.evaluate(()=>({
    pending:BlueprintWeekly.getDraft()?.goals?.wbg1?.actions?.map(a=>a.id)||[],
    original:state.goals[0].actions.map(a=>a.id)
  }));
  expect(staged).toEqual({pending:['step2'],original:['step1','step2']});
  await page.locator('[data-wb-step="4"]').click();
  await expect(page.locator('[data-wb-next]')).toBeEnabled();
  await page.locator('[data-wb-next]').click();
  const result=await page.evaluate(()=>({
    habit:structuredClone(state.habits[0]),
    steps:structuredClone(state.goals[0].actions)
  }));
  expect(result.habit.goalId).toBe('wbg1');
  expect(result.habit.actionId).toBe('');
  expect(result.habit.weeklyTarget).toBe(4);
  expect(result.habit.days['2026-11-16']).toBe(true);
  expect(result.steps).toHaveLength(1);
  expect(result.steps[0]).toMatchObject({
    id:'step2',plannedDate:'2026-12-01',metadata:{source:'old-note'}
  });
  await page.reload();
  expect(await page.evaluate(()=>state.habits[0].goalId)).toBe('wbg1');
});
