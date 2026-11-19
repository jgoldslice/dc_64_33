'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const model=require('../areas-v939.js');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const sw=fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8');

const sample=()=>({
  categories:['Work','Personal','Fitness'],
  goals:[{id:'g1',title:'Publish paper',category:'Work'}],
  tasks:[
    {id:'t1',title:'Order supplies',area:'Work'},
    {id:'t2',title:'Run GC',goalId:'g1',area:'Personal'},
    {id:'t3',title:'Unassigned'},
    {id:'t4',title:'Project task',projectId:'p1'}
  ],
  habits:[
    {id:'h1',title:'Read literature',goalId:'g1'},
    {id:'h2',title:'Clean bench',area:'Work'},
    {id:'h3',title:'Stretch'}
  ],
  projects:[{id:'p1',title:'Catalysis',area:'Work'},{id:'p2',title:'Other'}]
});

test('Area exists without any Goal or Project',()=>{
  const data={categories:['Work'],goals:[],projects:[],tasks:[{id:1,area:'Work'}],habits:[{id:2,area:'Work'}]};
  const grouped=model.contents(data,'Work');
  assert.equal(grouped.goals.length,0);
  assert.equal(grouped.projects.length,0);
  assert.equal(grouped.tasks.length,1);
  assert.equal(grouped.habits.length,1);
});
test('Linked tasks and habits inherit the Goal Area instead of an old standalone Area',()=>{
  const data=sample();
  assert.deepEqual(model.contents(data,'Work').tasks.map(t=>t.id),['t1','t2','t4']);
  assert.deepEqual(model.contents(data,'Work').habits.map(h=>h.id),['h1','h2']);
  assert.equal(model.contents(data,'Personal').tasks.length,0);
});
test('Project tasks inherit their Project Area and remain separate records',()=>{
  const data=sample();
  assert.equal(model.itemArea(data.tasks[3],data.goals,data.projects,data.categories),'Work');
  assert.equal(data.projects[0].title,'Catalysis');
});
test('Unassigned items remain discoverable instead of silently being categorized',()=>{
  const data=sample(),orphan=model.contents(data,model.INBOX);
  assert.deepEqual(orphan.tasks.map(t=>t.id),['t3']);
  assert.deepEqual(orphan.habits.map(h=>h.id),['h3']);
  assert.deepEqual(orphan.projects.map(p=>p.id),['p2']);
});
test('Changing a Goal Area moves its linked tasks and habits without rewriting them',()=>{
  const data=sample();
  data.goals[0].category='Personal';
  assert.deepEqual(model.contents(data,'Personal').tasks.map(t=>t.id),['t2']);
  assert.deepEqual(model.contents(data,'Personal').habits.map(h=>h.id),['h1']);
});
test('Legacy category strings and unknown assignments are not deleted from data',()=>{
  const data=sample();
  data.tasks.push({id:'legacy',area:'Deleted Area',done:false});
  assert.equal(model.itemArea(data.tasks.at(-1),data.goals,data.projects,data.categories),'');
  assert.equal(data.tasks.at(-1).area,'Deleted Area');
});
test('Plan dashboard and offline files are registered',()=>{
  assert.match(html,/id="bpAreasRoot"/);
  assert.match(html,/>Areas<\/button>/);
  assert.match(html,/src="areas-v939\.js"/);
  assert.match(html,/href="areas-v939\.css"/);
  assert.match(sw,/areas-v939\.js/);
  assert.match(sw,/areas-v939\.css/);
});
test('Task, Habit, and Project Area writes use existing planner save and backup',()=>{
  assert.match(html,/const areaField=formLine\('Area'/);
  assert.match(html,/const area=targetGoal\?\.category/);
  assert.match(html,/area:target\?\.category/);
  assert.match(html,/title:name,area,notes:/);
  assert.match(html,/t\.area=item\.category;t\.goalId=''/);
});
