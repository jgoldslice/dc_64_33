const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const mergeModule=import('../sync/full-sync-merge.mjs');
const codecModule=import('../sync/full-sync-codec.mjs');
const engineModule=import('../sync/full-sync-engine.mjs');
const key=(...p)=>JSON.stringify(p.map(String));
const graph=(title='first',done=false)=>({[key('tasks','t')]:{id:'t',title,done},[key('order','tasks')]:[{id:'t'}]});
const clone=structuredClone;

test('three-way merge keeps independent edits and detects overlapping text and delete/edit conflicts',async()=>{
  const {mergeJSON}=await mergeModule;
  const base={tasks:[{id:'t',title:'one',done:false}],habits:{days:{}}};
  const local=clone(base);local.tasks[0].done=true;local.habits.days['2026-11-26']=true;
  const remote=clone(base);remote.tasks[0].title='renamed';remote.habits.days['2026-11-27']=true;
  const result=mergeJSON(base,local,remote);
  assert.equal(result.conflicts.length,0);assert.deepEqual(JSON.parse(JSON.stringify(result.value)),{tasks:[{id:'t',title:'renamed',done:true}],habits:{days:{'2026-11-26':true,'2026-11-27':true}}});
  remote.tasks[0].done=true;remote.tasks[0].title='cloud';local.tasks[0].title='device';
  assert.equal(mergeJSON(base,local,remote).conflicts[0].reason,'edit-edit');
  local.tasks=[];assert.equal(mergeJSON(base,local,remote).conflicts[0].reason,'delete-edit');
});
test('independent additions converge deterministically and competing reorder operations require review',async()=>{
  const {mergeJSON,equal}=await mergeModule;
  const b=[{id:'a'},{id:'b'},{id:'c'}];
  const l=[...b,{id:'z'}],r=[...b,{id:'x'}];
  assert.ok(equal(mergeJSON(b,l,r).value,mergeJSON(b,r,l).value));
  assert.ok(mergeJSON(b,[b[1],b[0],b[2]],[b[0],b[2],b[1]]).conflicts.some(c=>c.reason==='order'));
  const resolved=mergeJSON(b,[b[1],{id:'a',title:'device edit'},b[2]],[b[0],{id:'c',title:'cloud edit'},b[1]],{choices:{'[]':'cloud'}});
  assert.equal(resolved.conflicts.length,0);
  assert.equal(resolved.value.find(v=>v.id==='a').title,'device edit');
  assert.equal(resolved.value.find(v=>v.id==='c').title,'cloud edit');
  assert.deepEqual(resolved.value.map(v=>v.id),['a','c','b']);
});
async function fixture(){
  const bytes=Buffer.from('image-fixture'),sha256=crypto.createHash('sha256').update(bytes).digest('hex');
  return {format:'canvas-complete-backup',version:3,state:{tasks:[],events:[],habits:[],goals:[],weeklyGoals:[],ideas:[],categories:['Research'],projects:[{id:'p',title:'A',activeNotePageId:'page',notebookText:'derived',notes:[],actions:[],library:[{id:'photo',key:'local-file',mime:'image/png'}],contentBlocks:[],notePages:[{id:'page',height:900,objects:[{id:'img',type:'image',key:'local-file',x:20}],strokes:[]}]}]},attachments:[{key:'local-file',mime:'image/png',base64:bytes.toString('base64'),size:bytes.length,sha256}],drawings:[{projectId:'p',pageId:'page',base64:'YWJj',preview:{base64:'preview-fixture',width:500,height:900}}]};
}
test('canonical graph preserves original ink and preview and converges despite local page/media ID remapping',async()=>{
  const {archiveToGraph,graphToArchive}=await codecModule;
  const {equal}=await mergeModule;
  const first=await archiveToGraph(await fixture());
  const portable=await graphToArchive(first.graph,hash=>first.objects.get(hash));
  const p=portable.state.projects[0];p.notePages[0].id='staged-on-other-device';p.activeNotePageId=p.notePages[0].id;
  portable.drawings[0].pageId=p.notePages[0].id;
  portable.attachments[0].key='different-idb-key';p.library[0].key='different-idb-key';p.notePages[0].objects[0].key='different-idb-key';
  const next=await archiveToGraph(portable);
  assert.ok(equal(first.graph,next.graph));
  assert.equal(portable.drawings[0].base64,'YWJj');assert.equal(portable.drawings[0].preview.base64,'preview-fixture');
});
test('missing or corrupted content and orphan page manifests fail instead of dropping data',async()=>{
  const {archiveToGraph,graphToArchive}=await codecModule;
  const {graph,objects}=await archiveToGraph(await fixture());
  await assert.rejects(graphToArchive(graph,()=>({kind:'asset'})),/checksum/);
  const broken=clone(graph);delete broken[key('projects','p')];broken[key('order','projects')]=[];
  await assert.rejects(graphToArchive(broken,hash=>objects.get(hash)),/no project/);
});
async function harness(){
  let device=graph(),token=1,checkpoint=null,head=null,cloud=null,number=0,afterPublish=null,active=true;
  let recoveries=0,applies=0,writes=0;
  const history=new Map();
  function guard(){if(!active)throw Error('account changed');}
  const store={guard,read:async()=>{guard();return clone({head,graph:cloud});},readObject:async()=>{throw Error('unexpected blob');},
    prepare:async(target,objects,parent)=>({hash:String(++number).padStart(64,'0'),graph:clone(target),parent}),
    publish:async(candidate,assertLocal)=>{guard();assertLocal();if(head?.hash!==candidate.parent?.hash)throw Error('revision changed');cloud=clone(candidate.graph);head={hash:candidate.hash,revision:(head?.revision||0)+1};history.set(candidate.hash,candidate.parent?.hash);writes++;afterPublish?.();return clone(head);},
    contains:async(h,hash)=>{let cursor=h?.hash;while(cursor){if(cursor===hash)return true;cursor=history.get(cursor);}return false;}};
  const local={snapshot:async()=>({graph:clone(device),token,objects:new Map()}),assertSnapshot:async s=>local.assertSnapshotSync(s),
    assertSnapshotSync:s=>{guard();if(s.token!==token)throw Error('local changed');},validate:async()=>{},
    apply:async(s,target,read,assertActive)=>{assertActive();local.assertSnapshotSync(s);device=clone(target);token++;applies++;},keepRecovery:async()=>{recoveries++;}};
  const disk={read:async()=>clone(checkpoint),write:async value=>{checkpoint=clone(value);}};
  const {createFullSyncEngine}=await engineModule;
  const engine=createFullSyncEngine({store,local,checkpoint:disk,assertActive:guard});
  return {engine,store,local,disk,device:()=>clone(device),cloud:()=>clone(cloud),checkpoint:()=>clone(checkpoint),stats:()=>({recoveries,applies,writes}),
    edit:fn=>{fn(device);token++;},remote:fn=>{fn(cloud);const old=head.hash;head={hash:String(++number).padStart(64,'0'),revision:head.revision+1};history.set(head.hash,old);},after:fn=>{afterPublish=fn;},signOut:()=>{active=false;}};
}
test('source setup requires empty cloud and keeps a recovery copy before publishing',async()=>{
  const h=await harness();await h.engine.start('source');assert.deepEqual(h.cloud(),h.device());assert.equal(h.stats().recoveries,1);
  await h.engine.start('source');assert.equal(h.stats().writes,1);
  const {createFullSyncEngine}=await engineModule;
  const fresh=createFullSyncEngine({store:h.store,local:h.local,checkpoint:{read:async()=>null,write:async()=>{}},assertActive:()=>{}});
  await assert.rejects(fresh.start('source'),/already exists/);
});
test('automatic cycle merges peers without reverting offline edits',async()=>{
  const h=await harness();await h.engine.start('source');h.edit(g=>g[key('tasks','t')].title='offline edit');h.remote(g=>g[key('tasks','t')].done=true);
  await h.engine.cycle();assert.deepEqual(h.device(),h.cloud());assert.equal(h.device()[key('tasks','t')].done,true);assert.equal(h.device()[key('tasks','t')].title,'offline edit');
});
test('a crash/local edit after cloud publication recovers from the durable pending snapshot',async()=>{
  const h=await harness();await h.engine.start('source');h.edit(g=>g[key('tasks','t')].title='first upload');h.remote(g=>g[key('tasks','t')].done=true);
  h.after(()=>{h.after(null);h.edit(g=>g[key('tasks','t')].title='newer local edit');});
  await assert.rejects(h.engine.cycle(),/local changed/);assert.ok(h.checkpoint().pending);
  await h.engine.cycle();assert.deepEqual(h.device(),h.cloud());assert.equal(h.device()[key('tasks','t')].title,'newer local edit');assert.equal(h.device()[key('tasks','t')].done,true);assert.equal(h.checkpoint().pending,null);
});
test('conflicts leave both sides unchanged until a reviewed choice; stale reviews cannot overwrite new edits',async()=>{
  const h=await harness();await h.engine.start('source');h.edit(g=>g[key('tasks','t')].title='device');h.remote(g=>g[key('tasks','t')].title='cloud');
  let conflict;try{await h.engine.cycle();}catch(error){conflict=error;}
  assert.equal(conflict.name,'SyncConflict');assert.equal(h.stats().writes,1);assert.equal(h.stats().applies,0);
  h.edit(g=>g[key('tasks','t')].done=true);
  await assert.rejects(h.engine.cycle({choice:'cloud',reviewContext:conflict.context}),/Review again/);
  try{await h.engine.cycle();}catch(error){conflict=error;}
  await h.engine.cycle({choice:'cloud',reviewContext:conflict.context});
  assert.equal(h.device()[key('tasks','t')].title,'cloud');assert.equal(h.device()[key('tasks','t')].done,true);assert.equal(h.stats().recoveries,2);
});
test('account replacement invalidates queued work and cannot apply or publish old data',async()=>{
  const h=await harness();await h.engine.start('source');h.edit(g=>g[key('tasks','t')].title='pending');h.signOut();
  await assert.rejects(h.engine.cycle(),/account changed/);assert.equal(h.stats().writes,1);assert.equal(h.stats().applies,0);
});

test('reviewed delete/edit choices retain the chosen record and its ordering reference',async()=>{
  const {mergeJSON}=await mergeModule;
  const base=[{id:'a',title:'before'}];
  const merged=mergeJSON(base,[],[{id:'a',title:'after'}],{choices:{'["a"]':'cloud'}});
  assert.equal(merged.conflicts.length,0);assert.equal(merged.value[0].title,'after');
  const h=await harness();await h.engine.start('source');
  h.edit(g=>{delete g[key('tasks','t')];g[key('order','tasks')]=[];});
  h.remote(g=>g[key('tasks','t')].title='keep this');
  let conflict;try{await h.engine.cycle();}catch(error){conflict=error;}
  await h.engine.cycle({choice:'cloud',reviewContext:conflict.context});
  assert.equal(h.device()[key('tasks','t')].title,'keep this');assert.deepEqual(h.device()[key('order','tasks')],[{id:'t'}]);
});

test('legacy notebookText remains content until real note pages exist',async()=>{
  const {archiveToGraph,graphToArchive}=await codecModule;
  const archive=await fixture();delete archive.state.projects[0].notePages;
  archive.state.projects[0].notebookText='Older notes that have not been opened in the new editor';archive.drawings=[];
  const packed=await archiveToGraph(archive);
  const restored=await graphToArchive(packed.graph,hash=>packed.objects.get(hash));
  assert.equal(restored.state.projects[0].notebookText,archive.state.projects[0].notebookText);
});
