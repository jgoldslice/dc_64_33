'use strict';
const {test,expect}=require('@playwright/test');
const {webcrypto,createHash}=require('node:crypto');
if(!globalThis.crypto?.subtle)globalThis.crypto=webcrypto;
const inbox=require('../native-share-extension/web/inbox.js');

const uuid='123e4567-e89b-42d3-a456-426614174000';
const sha=buffer=>createHash('sha256').update(buffer).digest('hex');
function fake({items,projectId='project-1',failSave=false,failRead=false,projectExists=true}={}){
  const buffer=Buffer.from('PNG sample bytes for checksum QA');
  const file={id:'i1',kind:'file',title:'Lab figure.png',name:'Lab figure.png',
    mime:'image/png',size:buffer.length,sha256:sha(buffer)};
  const link={id:'i0',kind:'link',title:'Source',url:'https://example.org/research'};
  const entry={version:1,id:uuid,projectId,items:items??[link,file]};
  const projects=projectExists?[{id:'project-1',title:'Catalysis',library:[]}]:[];
  const blobs=new Map();
  const stats={reads:0,writes:0,commits:0,acks:[],published:[],saved:false};
  const plugin={
    publishProjects:async input=>{stats.published.push(input.projects);return {count:input.projects.length};},
    listPending:async()=>({entries:stats.acks.length?[]:[entry]}),
    readFile:async()=>{stats.reads++;if(failRead)throw Error('Storage unavailable');return {
      base64:buffer.toString('base64'),size:buffer.length,sha256:file.sha256,mime:'image/png'
    };},
    acknowledge:async({id})=>{stats.acks.push(id);return {acknowledged:true};}
  };
  const bridge=inbox.createImporter({
    plugin,projects:()=>projects,
    putBlob:async(key,blob)=>{blobs.set(key,blob);stats.writes++;},
    getBlob:async key=>blobs.get(key)||null,
    commit:async()=>{stats.commits++;stats.saved=!failSave;return !failSave;},
    refresh:()=>{}
  });
  return {entry,projects,blobs,stats,plugin,bridge,file,link};
}

test('native share exporter snapshots IDs/titles, not private project contents',async()=>{
  const f=fake();
  f.projects[0].privateNotes='secret';
  const count=await f.bridge.publishProjects();
  expect(count).toBe(1);
  expect(f.stats.published).toEqual([[{id:'project-1',title:'Catalysis'}]]);
});

test('native inbox imports URL + verified image into original project library, then acknowledges',async()=>{
  const f=fake();
  const result=await f.bridge.importPending();
  expect(result.errors).toEqual([]);
  expect(result.acknowledged).toBe(1);
  expect(f.stats.acks).toEqual([uuid]);
  expect(f.projects[0].library).toHaveLength(2);
  expect(f.projects[0].library[0]).toMatchObject({type:'link',url:'https://example.org/research'});
  expect(f.projects[0].library[1]).toMatchObject({type:'file',mime:'image/png',
    size:f.file.size,id:'bp-share-'+uuid+'-i1'});
  expect(f.stats.writes).toBe(1);
  expect(f.stats.reads).toBe(1);
  expect(f.stats.saved).toBe(true);
});

test('native inbox does not acknowledge bad bytes or overwrite a different project',async()=>{
  const f=fake();
  f.file.sha256='0'.repeat(64); // Native file response does not match queued metadata.
  f.entry.items[1]=f.file;
  const result=await f.bridge.importPending();
  expect(result.acknowledged).toBe(0);
  expect(result.errors).toHaveLength(1);
  expect(f.stats.acks).toHaveLength(0);
  expect(f.projects[0].library.find(x=>x.type==='file')).toBeUndefined();
  // The link may remain in memory; it is intentionally *not* acknowledged.
  const missing=fake({projectId:'missing'});
  const result2=await missing.bridge.importPending();
  expect(result2.acknowledged).toBe(0);
  expect(missing.projects[0].library).toHaveLength(0);
  expect(missing.stats.writes).toBe(0);
});

test('save failure leaves native queue intact; retry uses stable IDs and no duplicate files',async()=>{
  const f=fake({failSave:true});
  const first=await f.bridge.importPending();
  expect(first.acknowledged).toBe(0);
  expect(first.errors[0].message).toContain('not confirmed');
  expect(f.stats.acks).toEqual([]);
  expect(f.projects[0].library).toHaveLength(2);
  // Recreate a bridged importer to model a later app resume. The previous
  // in-memory library entries must not generate new IDs or duplicate bytes.
  let commits=0;
  const second=inbox.createImporter({
    plugin:f.plugin,projects:()=>f.projects,
    putBlob:async(k,b)=>{f.blobs.set(k,b);f.stats.writes++;},
    getBlob:async k=>f.blobs.get(k),
    commit:async()=>{commits++;return true;},
    refresh:()=>{}
  });
  const result=await second.importPending();
  expect(result.errors).toEqual([]);
  expect(result.acknowledged).toBe(1);
  expect(f.projects[0].library).toHaveLength(2);
  expect(f.stats.writes).toBe(1);
  expect(commits).toBe(1);
});

test('malformed path identifiers and unsupported URLs are rejected before writes',async()=>{
  const f=fake();
  f.entry.id='../etc/passwd';
  let result=await f.bridge.importPending();
  expect(result.errors).toHaveLength(1);
  expect(f.stats.writes).toBe(0);
  const other=fake({items:[{id:'i0',kind:'link',url:'javascript:alert(1)',title:'unsafe'}]});
  result=await other.bridge.importPending();
  expect(result.errors).toHaveLength(1);
  expect(other.stats.acks).toEqual([]);
});

test('unavailable native file bytes leave the queued item for a later retry',async()=>{
  const f=fake({failRead:true});
  const result=await f.bridge.importPending();
  expect(result.acknowledged).toBe(0);
  expect(result.errors).toHaveLength(1);
  expect(f.stats.acks).toEqual([]);
});
