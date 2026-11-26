const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createAutomaticBackup,automaticBackupPolicy}=require('../automatic-cloud-backup.mjs');

function fixture() {
 const preferencesMap=new Map(), records=new Map(), remote=new Map(), calls=[], states=[];
 const preferences={getItem:k=>preferencesMap.get(k)||null,setItem:(k,v)=>preferencesMap.set(k,v),removeItem:k=>preferencesMap.delete(k)};
 const queue={get:async k=>structuredClone(records.get(k)),put:async(k,v)=>records.set(k,structuredClone(v))};
 let clock=Date.UTC(2026,10,25), fingerprint='a'.repeat(64), ready=true, account='owner', ids=0;
 let failAfterCommit=false, buildOverride, saveOverride, builds=0;
 const store={assertAccount:()=>{if(account!=='owner')throw Error('Account changed');},save:async(archive,options)=>{
  calls.push(options.backupId);
  options.assertCanWrite();
  if(saveOverride)return saveOverride(archive,options);
  const bytes=await archive.text();
  if(remote.has(options.backupId))assert.equal(remote.get(options.backupId),bytes);
  else remote.set(options.backupId,bytes);
  if(failAfterCommit){failAfterCommit=false;throw Object.assign(Error('Response lost'),{code:'unavailable'});}
 }};
 const opts={uid:'owner',projectId:'demo',store,preferences,queue,
  locks:{request:async(_,options,callback)=>callback({})},
  now:()=>clock,uuid:()=>`intent-${++ids}`,canRun:()=>ready,
  build:async()=>{builds++;return buildOverride?buildOverride():{archive:new Blob([JSON.stringify({fixture:fingerprint})]),fingerprint};},
  onState:s=>states.push(s)};
 return {opts,store,preferences,preferencesMap,queue,records,remote,calls,states,
  engine:()=>createAutomaticBackup(opts),advance:ms=>{clock+=ms;},setFingerprint:v=>{fingerprint=v;},
  offline:()=>{ready=false;},online:()=>{ready=true;},switchAccount:()=>{account='other';},
  failAfterCommit:()=>{failAfterCommit=true;},setBuild:f=>{buildOverride=f;},setSave:f=>{saveOverride=f;},get builds(){return builds;}};
}
const idle=automaticBackupPolicy.idleMs+1;
const interval=automaticBackupPolicy.intervalMs+1;

test('automatic backups stay off until explicit persisted consent and an idle interval',async()=>{
 const f=fixture(), engine=f.engine();f.advance(idle);await engine.tick();assert.equal(f.calls.length,0);
 await engine.enable();await engine.tick();assert.equal(f.calls.length,0);
 f.advance(idle);await engine.tick();assert.equal(f.remote.size,1);assert.equal(engine.enabled,true);
 assert.equal(f.records.get('demo:owner').pending,null);
});

test('unchanged state is deduplicated while changed state is rate-limited into another immutable version',async()=>{
 const f=fixture(), engine=f.engine();await engine.enable();f.advance(idle);await engine.tick();
 f.advance(interval);await engine.tick();assert.equal(f.remote.size,1);
 f.setFingerprint('b'.repeat(64));engine.changed();f.advance(idle);await engine.tick();assert.equal(f.remote.size,2);
 f.setFingerprint('c'.repeat(64));engine.changed();f.advance(idle);await engine.tick();assert.equal(f.remote.size,2);
 f.advance(interval);await engine.tick();assert.equal(f.remote.size,3);
});

test('a lost success response retries the exact persisted Blob and version after reload without duplication',async()=>{
 const f=fixture();let engine=f.engine();await engine.enable();f.failAfterCommit();f.advance(idle);await engine.tick();
 assert.equal(f.remote.size,1);const pending=f.records.get('demo:owner').pending;assert.ok(pending);
 engine=f.engine();f.advance(idle);await engine.tick();
 assert.deepEqual(f.calls,[pending.id,pending.id]);assert.equal(f.remote.size,1);assert.equal(f.records.get('demo:owner').pending,null);
});

test('offline work is retained and sent after reconnect, with no offline cloud call',async()=>{
 const f=fixture(), engine=f.engine();await engine.enable();f.offline();f.advance(idle);await engine.tick();assert.equal(f.calls.length,0);
 f.online();await engine.tick();assert.equal(f.remote.size,1);
});

test('pausing during archive preparation prevents every cloud write',async()=>{
 const f=fixture(), engine=f.engine();await engine.enable();let release;
 f.setBuild(()=>new Promise(resolve=>{release=resolve;}));f.advance(idle);
 const pending=engine.tick();while(!release)await new Promise(r=>setImmediate(r));
 engine.pause();release({archive:new Blob(['fixture']),fingerprint:'a'.repeat(64)});await pending;
 assert.equal(f.calls.length,0);assert.equal(engine.enabled,false);f.advance(interval);await f.engine().tick();assert.equal(f.calls.length,0);
});

test('pause/sign-out and another account cannot publish an in-flight queued archive',async()=>{
 const f=fixture(), engine=f.engine();await engine.enable();let release;
 f.setSave(async(_,options)=>{await new Promise(resolve=>{release=resolve;});options.assertCanWrite();});
 f.advance(idle);const pending=engine.tick();while(!release)await new Promise(r=>setImmediate(r));
 f.switchAccount();engine.dispose();release();await pending;assert.equal(f.remote.size,0);
 const other=createAutomaticBackup({...f.opts,uid:'other'});assert.equal(other.enabled,false);
});

test('daily version and byte budgets stop uploads without deleting history or disabling manual operations',async()=>{
 for(const existing of [{versions:12,bytes:0},{versions:1,bytes:automaticBackupPolicy.dailyBytes-1}]){
  const f=fixture();f.records.set('demo:owner',{version:1,lastFingerprint:'',lastSavedAt:0,day:'2026-11-25',pending:null,...existing});
  const engine=f.engine();await engine.enable();f.advance(idle);await engine.tick();assert.equal(f.calls.length,0);assert.equal(engine.enabled,true);
  assert.match(f.states.at(-1).message,/limit/);f.advance(86400000);await engine.tick();assert.equal(f.remote.size,1);
 }
});

test('edits during snapshot preparation postpone the upload and preserve the newest local state',async()=>{
 const f=fixture(), engine=f.engine();await engine.enable();let release;
 f.setBuild(()=>new Promise(resolve=>{release=resolve;}));f.advance(idle);const work=engine.tick();while(!release)await new Promise(r=>setImmediate(r));
 engine.changed();release({archive:new Blob(['older snapshot']),fingerprint:'a'.repeat(64)});await work;assert.equal(f.calls.length,0);
});

test('queue failure, corrupt pending bytes and absent lock support all fail closed',async()=>{
 const missing=fixture();missing.opts.locks=null;await assert.rejects(missing.engine().enable(),/lock/);assert.equal(missing.calls.length,0);
 const full=fixture();full.queue.put=async()=>{throw Object.assign(Error('full'),{name:'QuotaExceededError'});};
 await assert.rejects(full.engine().enable(),/full/);assert.equal(full.preferencesMap.size,0);
 const corrupt=fixture(), engine=corrupt.engine();await engine.enable();corrupt.failAfterCommit();corrupt.advance(idle);await engine.tick();
 const record=corrupt.records.get('demo:owner');record.pending.archive=new Blob(['corrupted']);corrupt.records.set('demo:owner',record);
 corrupt.advance(interval);await engine.tick();assert.equal(corrupt.calls.length,1);assert.equal(engine.enabled,false);assert.match(corrupt.states.at(-1).message,/integrity/);
});

test('a different tab holding the project lock prevents concurrent uploads',async()=>{
 const f=fixture();f.opts.locks={request:async(_,options,callback)=>callback(null)};const engine=f.engine();await engine.enable();f.advance(idle);await engine.tick();assert.equal(f.calls.length,0);assert.match(f.states.at(-1).message,/Another/);
});


test('new consent in another tab invalidates the older in-flight consent even for the same UID',async()=>{
 const f=fixture(), first=f.engine();await first.enable();let release;
 f.setSave(async(_,options)=>{await new Promise(resolve=>{release=resolve;});options.assertCanWrite();});
 f.advance(idle);const work=first.tick();while(!release)await new Promise(r=>setImmediate(r));
 const second=f.engine();await second.enable();release();await work;
 assert.equal(f.remote.size,0);assert.equal(first.enabled,false);assert.equal(second.enabled,true);
});
