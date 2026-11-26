const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createPlannerPilot, buildPilotPreview} = require('../sync/planner-pilot.mjs');
const {projectPlannerRecord} = require('../sync/planner-sync.mjs');
const task = {id:42,title:'Local task',date:'2026-11-23',done:false};
const event = {id:11,title:'Cloud event',date:'2026-11-24',time:'10:00'};
const head = (collection,record,revision=1) => ({collection,id:String(record.id),revision,record:projectPlannerRecord(collection,record)});
const planner = (tasks=[],events=[]) => ({tasks,events});
function fixture(initial=planner([task]),remote=[head('events',event)]) {
  let current=structuredClone(initial), heads=structuredClone(remote), owner=true;
  const map=new Map();
  const storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};
  const local={snapshot:()=>({token:JSON.stringify(current),planner:structuredClone(current)}),
    apply(token,downloads) {
      assert.equal(token,JSON.stringify(current));
      for(const d of downloads) {
        const arr=current[d.collection], index=arr.findIndex(r=>String(r.id)===d.id);
        if(index<0)arr.push(d.record);else arr[index]={...arr[index],...d.record};
      }
    }};
  const store={list:async()=>structuredClone(heads),commit:async intent=>{
    const index=heads.findIndex(h=>h.collection===intent.collection&&h.id===intent.id);
    assert.equal(index<0?0:heads[index].revision,intent.expectedRevision);
    const h={collection:intent.collection,id:intent.id,revision:intent.expectedRevision+1,record:intent.record};
    if(index<0)heads.push(h);else heads[index]=h;
    return h;
  }};
  const assertAccount=()=>{if(!owner)throw Error('Account changed');};
  const engine=(scope='a')=>createPlannerPilot({store,local,storage,scope,assertAccount});
  return {engine,store,storage,local,edit:fn=>fn(current),changeAccount:()=>owner=false};
}
test('preview is read-only; explicit apply merges distinct local and cloud items and checkpoints',async()=>{
  const f=fixture(), e=f.engine(), p=await e.preview();
  assert.equal(p.uploads.length,1);assert.equal(p.downloads.length,1);
  assert.equal(f.storage.getItem('blueprint-sync-v1:a'),null);
  assert.deepEqual(await e.apply(p),{uploads:1,downloads:1});
  const next=await f.engine().preview();
  assert.equal(next.uploads.length+next.downloads.length+next.conflicts.length,0);
  assert.equal(next.checkpoint.pending,null);
  assert.equal(next.checkpoint.baseline.length,2);
  assert.equal((await f.engine('other').preview()).checkpoint.baseline.length,0);
});
test('independent edits merge after a durable checkpoint',async()=>{
  const f=fixture(), e=f.engine();await e.apply(await e.preview());
  f.edit(p=>p.tasks[0].done=true);
  await f.store.commit({collection:'tasks',id:'42',expectedRevision:1,record:projectPlannerRecord('tasks',{...task,title:'Cloud rename'})});
  const p=await f.engine().preview();assert.equal(p.conflicts.length,0);
  await f.engine().apply(p);
  assert.equal(f.local.snapshot().planner.tasks[0].title,'Cloud rename');
  assert.equal(f.local.snapshot().planner.tasks[0].done,true);
});
test('interrupted upload leaves journal; fresh review recovers without discarding edits',async()=>{
  const f=fixture(planner([task,{...task,id:43,title:'Second'}]),[]);
  const commit=f.store.commit;let count=0;
  f.store.commit=async x=>{if(++count===2)throw Error('Offline');return commit(x);};
  await assert.rejects(f.engine().apply(await f.engine().preview()),/Offline/);
  assert.equal(f.local.snapshot().planner.tasks.length,2);
  f.store.commit=commit;
  const p=await f.engine().preview();assert.ok(p.checkpoint.pending);
  assert.equal(p.uploads.length,1);
  await f.engine().apply(p);
  assert.equal((await f.engine().preview()).checkpoint.pending,null);
});
test('changes after preview, and account changes, block applying',async()=>{
  const f=fixture(), e=f.engine(), p=await e.preview();
  f.edit(x=>x.tasks[0].title='Edit after preview');
  await assert.rejects(e.apply(p),/changed since preview/);
  const p2=await e.preview();f.changeAccount();
  await assert.rejects(e.apply(p2),/Account changed/);
});
test('linked and back-referenced tasks and deletions never become writes',()=>{
  const original=head('tasks',task);
  const linked={...task,id:43,projectId:'p'};
  const p=buildPilotPreview({...planner([linked,{...task,id:44}]),linkedTaskIds:['44']},[original],[original]);
  assert.deepEqual(p.excluded.sort(),['43','44']);
  assert.deepEqual(p.uploads,[]);assert.deepEqual(p.downloads,[]);
  assert.deepEqual(p.skippedDeletions,['tasks:42']);
});
test('unresolved same-ID conflicts never apply',async()=>{
  const f=fixture(planner([task]),[head('tasks',{...task,title:'Different'})]);
  const p=await f.engine().preview();assert.equal(p.conflicts.length,1);
  await assert.rejects(f.engine().apply(p),/conflicting/);
});
