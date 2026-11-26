import {mergeJSON,equal} from './full-sync-merge.mjs';
import {graphReferences,hashJSON,reconcileGraphOrders} from './full-sync-codec.mjs';
export class SyncConflict extends Error {
  constructor(conflicts,context){super('Changes need review before syncing.');this.name='SyncConflict';this.conflicts=conflicts;this.context=context;}
}
// The checkpoint is durable before publishing. A crash after cloud commit can
// reconcile newer local edits against the exact snapshot we published.
export function createFullSyncEngine({store,local,checkpoint,assertActive}){
  const guard=()=>{assertActive();store.guard();};
  async function save(value){guard();await checkpoint.write(value);guard();}
  async function verifySnapshot(snapshot){guard();await local.assertSnapshot(snapshot);guard();}
  async function apply(snapshot,target,readObject){
    guard();await verifySnapshot(snapshot);
    if(!equal(snapshot.graph,target))await local.apply(snapshot,target,readObject,guard);
    guard();
  }
  async function start(mode){
    guard();const prior=await checkpoint.read();const snapshot=await local.snapshot();guard();
    const remote=await store.read();guard();await verifySnapshot(snapshot);
    if(prior&&(prior.head||prior.pending&&await store.contains(remote.head,prior.pending.hash))){await cycle();return;}
    if(mode==='source'){
      if(remote.head)throw Error('A shared planner already exists. Join it on this device.');
      await local.keepRecovery(snapshot);guard();await verifySnapshot(snapshot);
      const candidate=await store.prepare(snapshot.graph,snapshot.objects,null);
      await save({schema:1,baseline:snapshot.graph,pending:{before:snapshot.graph,target:snapshot.graph,hash:candidate.hash}});
      const head=await store.publish(candidate,()=>local.assertSnapshotSync(snapshot));guard();
      await save({schema:1,baseline:snapshot.graph,head,pending:null});
    }else if(mode==='join'){
      if(!remote.head)throw Error('Start sync on the source device first.');
      await local.keepRecovery(snapshot);guard();await verifySnapshot(snapshot);
      // Journal initial adoption too. Never infer consent from an empty planner.
      await save({schema:1,baseline:snapshot.graph,pending:{before:snapshot.graph,target:remote.graph,hash:remote.head.hash}});
      await apply(snapshot,remote.graph,store.readObject);
      await save({schema:1,baseline:remote.graph,head:remote.head,pending:null});
    }else throw Error('Choose how to set up this device.');
  }
  async function cycle({choice,reviewContext}={}){
    guard();const prior=await checkpoint.read();guard();
    if(prior?.schema!==1||!prior.baseline)throw Error('Set up sync on this device first.');
    const snapshot=await local.snapshot();guard();
    const remote=await store.read();guard();
    if(!remote.head)throw Error('The shared planner is missing. Local data is unchanged.');
    const context=await hashJSON({prior,device:snapshot.graph,remote});
    if(choice&&(!['device','cloud'].includes(choice)||context!==reviewContext))
      throw Error('Changes arrived while you reviewed the conflict. Review again.');
    if(choice){await local.keepRecovery(snapshot);guard();}
    function mergeChecked(base,device,cloud){
      let result=mergeJSON(base,device,cloud);
      if(result.conflicts.length&&choice){
        const choices=Object.fromEntries(result.conflicts.map(c=>[JSON.stringify(c.path),choice]));
        result=mergeJSON(base,device,cloud,{choices});
      }
      if(result.conflicts.length)throw new SyncConflict(result.conflicts,context);
      return result.value;
    }
    let base=prior.baseline,device=snapshot.graph;
    if(prior.pending){
      const p=prior.pending;
      if(await store.contains(remote.head,p.hash)){
        device=mergeChecked(p.before,device,p.target);base=p.target;
      }
      // If publication never completed, use the original baseline and read the
      // actual cloud again. A queued obsolete intent is never blindly replayed.
    }
    const target=reconcileGraphOrders(mergeChecked(base,device,remote.graph));
    await local.validate(target,hash=>snapshot.objects.has(hash)?snapshot.objects.get(hash):store.readObject(hash));guard();
    await verifySnapshot(snapshot);
    let head=remote.head;
    if(!equal(target,remote.graph)){
      const needed=new Map(),existing=graphReferences(remote.graph);
      for(const hash of graphReferences(target))if(snapshot.objects.has(hash)&&!existing.has(hash))needed.set(hash,snapshot.objects.get(hash));
      const candidate=await store.prepare(target,needed,remote.head);guard();
      await save({schema:1,baseline:prior.baseline,pending:{before:snapshot.graph,target,hash:candidate.hash}});
      head=await store.publish(candidate,()=>local.assertSnapshotSync(snapshot));guard();
    }else{
      await save({schema:1,baseline:prior.baseline,pending:{before:snapshot.graph,target,hash:head.hash}});
    }
    await apply(snapshot,target,hash=>snapshot.objects.has(hash)?snapshot.objects.get(hash):store.readObject(hash));
    await save({schema:1,baseline:target,head,pending:null});
    return {head,changed:!equal(target,snapshot.graph)};
  }
  return {start,cycle};
}
