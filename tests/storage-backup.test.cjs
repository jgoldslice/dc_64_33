const {test} = require('node:test');
const assert = require('node:assert/strict');

function fixture() {
  const auth = {currentUser:{uid:'owner'}};
  const files = new Map(), rows = [];
  let sequence = 0, listener;
  const hooks = {};
  class Bytes {
    constructor(bytes) {this.bytes = bytes;}
    toUint8Array() {return this.bytes;}
  }
  const firestore = {
    Bytes, collection:(_, ...parts) => parts.join('/'),
    doc:collection => ({id:String(++sequence),collection}),
    serverTimestamp:() => ({toDate:() => new Date(0)}),
    setDoc:async (ref, data) => {hooks.publish?.(); rows.unshift({id:ref.id,data:() => data});},
    query:x => x, orderBy:() => {}, limit:() => {},
    getDocsFromServer:async () => ({empty:!rows.length,docs:rows.slice(0,1)}),
  };
  const storageApi = {
    ref:(_, path) => path,
    uploadBytesResumable(path, bytes, metadata) {
      let canceled = false;
      const promise = Promise.resolve().then(() => {
        hooks.upload?.();
        if (canceled || hooks.failUpload) throw Error('Upload interrupted');
        files.set(path,{bytes:new Uint8Array(bytes),...metadata});
      });
      promise.cancel = () => {canceled = true;};
      promise.on = (_, notify) => {
        notify({bytesTransferred:bytes.length,totalBytes:bytes.length});
        return () => {};
      };
      return promise;
    },
    getMetadata:async path => {
      hooks.metadata?.();
      const file=files.get(path);
      return {size:file.bytes.length,contentType:file.contentType};
    },
    getBytes:async (path, limit) => {
      hooks.download?.();
      const bytes = files.get(path).bytes;
      assert.ok(bytes.length <= limit);
      return bytes.buffer;
    },
  };
  const authApi = {onAuthStateChanged:(_, notify) => {listener=notify;return () => {listener=null;};}};
  return {auth,db:{},firestore,storage:{},storageApi,authApi,files,rows,hooks,
    changeAccount(uid) {auth.currentUser=uid ? {uid} : null;listener?.(auth.currentUser);}};
}

const modulePromise = import('../blueprint-cloud-backup.mjs');

test('Storage roundtrip accepts a 2 MiB archive and publishes only after upload', async () => {
  const {createCloudBackupStore} = await modulePromise, f=fixture();
  const store=createCloudBackupStore(f), progress=[];
  const archive=new Blob(['x'.repeat(2*1024*1024)],{type:'application/json'});
  f.hooks.upload=() => assert.equal(f.rows.length,0);
  f.hooks.publish=() => assert.equal(f.files.size,1);
  await store.save(archive,x=>progress.push(x));
  assert.deepEqual(progress,[1]);
  const data=f.rows[0].data();
  assert.equal(data.version,2);
  assert.equal(data.size,archive.size);
  assert.equal(data.path,'users/owner/backups/1/archive.json');
  assert.match(data.sha256,/^[a-f0-9]{64}$/);
  assert.equal(await (await store.latest()).archive.text(),await archive.text());
});

test('interrupted uploads never publish and cannot replace the prior backup', async () => {
  const {createCloudBackupStore} = await modulePromise, f=fixture(),store=createCloudBackupStore(f);
  await store.save(new Blob(['previous']));
  f.hooks.failUpload=true;
  await assert.rejects(store.save(new Blob(['new'])),/interrupted/);
  assert.equal(f.rows.length,1);
  assert.equal(await (await store.latest()).archive.text(),'previous');
});

test('metadata write failure leaves the completed file unlisted', async () => {
  const {createCloudBackupStore} = await modulePromise, f=fixture();
  f.hooks.publish=() => {throw Error('Offline');};
  await assert.rejects(createCloudBackupStore(f).save(new Blob(['test'])),/Offline/);
  assert.equal(f.files.size,1);
  assert.equal(f.rows.length,0);
});

test('account changes cancel upload and block publication', async () => {
  const {createCloudBackupStore} = await modulePromise, f=fixture();
  f.hooks.upload=() => f.changeAccount('other');
  await assert.rejects(createCloudBackupStore(f).save(new Blob(['test'])),/interrupted/);
  assert.equal(f.files.size,0);
  assert.equal(f.rows.length,0);
});

test('an account change while reading the archive prevents any upload', async () => {
  const {createCloudBackupStore} = await modulePromise,f=fixture();
  class SwitchingArchive extends Blob {
    async arrayBuffer() {const bytes=await super.arrayBuffer();f.changeAccount('other');return bytes;}
  }
  await assert.rejects(createCloudBackupStore(f).save(new SwitchingArchive(['test'])),/Sign in again/);
  assert.equal(f.files.size,0);
  assert.equal(f.rows.length,0);
});

test('corruption, metadata mismatch and foreign paths never return an archive', async () => {
  const {createCloudBackupStore} = await modulePromise;
  for (const kind of ['hash','size','path','oversize','type']) {
    const f=fixture(),store=createCloudBackupStore(f);
    await store.save(new Blob(['original']));
    const data=f.rows[0].data(),file=f.files.get(data.path);
    if(kind==='hash')file.bytes[0]^=1;
    if(kind==='size')data.size++;
    if(kind==='oversize')data.size=100*1024*1024+1;
    if(kind==='path')data.path='users/other/backups/1/archive.json';
    if(kind==='type')file.contentType='text/html';
    await assert.rejects(store.latest(),/integrity|metadata|size or file type/);
  }
});

test('account changes during metadata fetch or download block returning backup', async () => {
  const {createCloudBackupStore} = await modulePromise;
  for (const phase of ['metadata','download']) {
    const f=fixture(),store=createCloudBackupStore(f);
    await store.save(new Blob(['test']));
    f.hooks[phase]=() => f.changeAccount('other');
    await assert.rejects(store.latest(),/Sign in again/);
  }
});

test('legacy inline Firestore backups remain readable', async () => {
  const {createCloudBackupStore} = await modulePromise,f=fixture();
  f.rows.push({id:'legacy',data:()=>({version:1,archive:new f.firestore.Bytes(new TextEncoder().encode('legacy'))})});
  assert.equal(await (await createCloudBackupStore(f).latest()).archive.text(),'legacy');
});

test('empty and oversized backups fail before upload; signed-out saves are rejected', async () => {
  const {createCloudBackupStore,maxBackupBytes} = await modulePromise,f=fixture(),store=createCloudBackupStore(f);
  await assert.rejects(store.save(new Blob()),/100 MiB/);
  class Oversize extends Blob {get size(){return maxBackupBytes+1;}}
  await assert.rejects(store.save(new Oversize(['x'])),/100 MiB/);
  f.changeAccount(null);
  await assert.rejects(store.save(new Blob(['x'])),/Sign in again/);
  assert.equal(f.files.size,0);
});

test('same-UID sign-out and re-sign-in invalidates a pending backup or restore', async () => {
  const {createCloudBackupStore} = await modulePromise;
  const f=fixture(),store=createCloudBackupStore(f);
  await store.save(new Blob(['previous']));
  const archive=await store.latest();
  assert.equal(await archive.archive.text(),'previous');
  f.changeAccount(null);
  f.changeAccount('owner');
  assert.throws(()=>store.assertAccount(),/Sign in again/);
  await assert.rejects(store.latest(),/Sign in again/);
  await assert.rejects(store.save(new Blob(['stale'])),/Sign in again/);
  const newStore=createCloudBackupStore(f);
  assert.equal(await (await newStore.latest()).archive.text(),'previous');
  assert.equal(f.rows.length,1);
});

test('same-UID session replacement during download blocks the old archive', async () => {
  const {createCloudBackupStore} = await modulePromise;
  for (const phase of ['metadata','download']) {
    const f=fixture(),store=createCloudBackupStore(f);
    await store.save(new Blob(['test']));
    f.hooks[phase]=() => {f.changeAccount(null);f.changeAccount('owner');};
    await assert.rejects(store.latest(),/Sign in again/);
    assert.equal(f.rows.length,1);
  }
});
