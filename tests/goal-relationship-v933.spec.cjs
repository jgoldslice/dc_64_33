'use strict';
const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';
test.use({browserName:'chromium',viewport:{width:1024,height:900}});

test('removing a Goal Step unlinks dependent actions without detaching the recurring Habit from its Goal',async({page})=>{
  await page.goto(base);
  const after=await page.evaluate(()=>{
    state.goals=[{id:'goal-alpha',title:'Become a pianist',category:'Personal',
      actions:[{id:'step-a',title:'Practice scales',done:false},
        {id:'step-b',title:'Learn a song',done:false}]}];
    state.habits=[{id:'habit-a',title:'Practice piano',goalId:'goal-alpha',
      actionId:'step-a',weeklyTarget:4,schedule:[0,1,2,3,4,5,6],
      days:{'2026-11-16':true},createdOn:'2026-11-16'}];
    state.tasks=[{id:'task-a',title:'Practice scales',goalId:'goal-alpha',
      actionId:'step-a',actionIndex:0,done:false,
      projectId:'project-alpha',projectActionId:'project-step-1'}];
    saveGoalSteps(state.goals[0],[state.goals[0].actions[1]]);
    if(!save(true))throw Error('Failed to commit test records');
    render();
    return {habit:structuredClone(state.habits[0]),task:structuredClone(state.tasks[0]),
      caption:document.getElementById('habitManager').textContent,
      totalHabits:state.habits.length};
  });
  expect(after.totalHabits).toBe(1);
  expect(after.habit.goalId).toBe('goal-alpha');
  expect(after.habit.actionId).toBe('');
  expect(after.habit.weeklyTarget).toBe(4);
  expect(after.habit.days['2026-11-16']).toBe(true);
  expect(after.task.goalId).toBe('');
  expect(after.task.actionId).toBe('');
  expect(after.task.projectId).toBe('project-alpha');
  expect(after.caption).toContain('Become a pianist');
  await page.reload();
  const persisted=await page.evaluate(()=>({habit:state.habits[0],task:state.tasks[0]}));
  expect(persisted.habit.goalId).toBe('goal-alpha');
  expect(persisted.habit.days['2026-11-16']).toBe(true);
  expect(persisted.task.projectActionId).toBe('project-step-1');
});

test('editing a Goal preserves metadata attached to existing Goal Steps',async({page})=>{
  await page.goto(base);
  const output=await page.evaluate(()=>{
    state.goals=[{id:'goal1',title:'Old Goal',category:'Personal',motivation:'Keep going',
      customGoalMetadata:'preserve-goal',
      actions:[{id:'a1',title:'Original title',done:true,
        scheduledDate:'2026-12-12',externalLinkId:'legacy-linked-item',
        customMetadata:{intact:true}}]}];
    if(!save(true))throw Error('Failed to seed goal');
    openModal('goal','goal1');
    const form=document.getElementById('modalForm');
    form.querySelector('[name="title"]').value='Renamed Goal';
    form.querySelector('[name="step"]').value='Updated Step';
    form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    return structuredClone(state.goals[0]);
  });
  expect(output.title).toBe('Renamed Goal');
  expect(output.actions).toHaveLength(1);
  expect(output.actions[0]).toMatchObject({
    id:'a1',title:'Updated Step',done:true,
    scheduledDate:'2026-12-12',externalLinkId:'legacy-linked-item',
    customMetadata:{intact:true}
  });
  expect(output.customGoalMetadata).toBe('preserve-goal');
  await page.reload();
  expect(await page.evaluate(()=>state.goals[0].actions[0].externalLinkId)).toBe('legacy-linked-item');
});

test('editing Events and Habits retains unrelated data and completion records',async({page})=>{
  await page.goto(base);
  const after=await page.evaluate(()=>{
    state.events=[{id:'event1',title:'Initial event',date:'2026-11-21',time:'13:45',
      location:'Preserve this location',projectId:'project-a'}];
    state.habits=[{id:'habit1',title:'Read',days:{'2026-11-16':true},
      createdOn:'2026-11-16',goalId:'',actionId:'',schedule:[0,1,2,3,4,5,6],
      metadata:{source:'historic'}}];
    save(true);
    openModal('event','event1');
    let form=document.getElementById('modalForm');
    form.querySelector('[name="title"]').value='Renamed event';
    form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    openModal('habit','habit1');
    form=document.getElementById('modalForm');
    form.querySelector('[name="title"]').value='Read books';
    form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    return {event:structuredClone(state.events[0]),habit:structuredClone(state.habits[0])};
  });
  expect(after.event).toMatchObject({
    title:'Renamed event',date:'2026-11-21',time:'13:45',
    location:'Preserve this location',projectId:'project-a'
  });
  expect(after.habit).toMatchObject({
    title:'Read books',createdOn:'2026-11-16',
    days:{'2026-11-16':true},metadata:{source:'historic'}
  });
});
