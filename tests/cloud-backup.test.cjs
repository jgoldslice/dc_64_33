const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createCloudBackupStore, configurePersistence, maxArchiveBytes} = require('../blueprint-cloud-backup.mjs');

function fixture() {
  const auth = {currentUser: {uid: 'owner'}};
  const rows = [];
  const objects = new Map();
  const firestore = {
    Bytes: class Bytes {
      constructor(bytes) {this.bytes = bytes;}
      static fromUint8Array(bytes) {return new this(bytes);}
      toUint8Array() {return this.bytes;}
    },
    collection: (_, ...parts) => parts.join('/'),
    doc: (path, id) => ({id: id ?? String(rows.length), path}),
    runTransaction: async (_, action) => action({
      get: async ref => ({exists: () => rows.some(row => row.id === ref.id), data: () => rows.find(row => row.id === ref.id)?.data}),
      set: (ref, data) => rows.push({id: ref.id, data}),
    }),
    serverTimestamp: () => null,
    addDoc: async (path, data) => rows.push({id: String(rows.length), data}),
    setDoc: async (ref, data) => rows.push({id: ref.id, data}),
    query: path => path, orderBy: () => {}, limit: () => {},
    getDocsFromServer: async () => ({empty: !rows.length,
      docs: rows.slice(-1).map(row => ({id: row.id, data: () => row.data}))}),
  };
  const storageApi = {
    ref: (_, path) => path,
    uploadBytes: async (path, blob) => objects.set(path, blob),
    getBlob: async path => {
      if (!objects.has(path)) throw Object.assign(Error('missing'), {code: 'storage/object-not-found'});
      return objects.get(path);
    },
  };
  const client = {auth, db: {}, firestore, storage: {}, storageApi};
  return {client, rows, objects, store: createCloudBackupStore(client)};
}
const large = () => new Blob(['x'.repeat(768001)], {type: 'application/json'});

test('small legacy archives and large versioned archives round trip byte-for-byte', async () => {
  const {store, rows, objects} = fixture();
  await store.save(new Blob(['legacy']));
  assert.equal(rows[0].data.version, 1);
  assert.equal(await (await store.latest()).archive.text(), 'legacy');
  const archive = large();
  await store.save(archive);
  assert.equal(rows[1].data.version, 2);
  assert.equal(objects.size, 1);
  assert.equal(await (await store.latest()).archive.text(), await archive.text());
});

test('rejects changed bytes, size, checksum, path and unsupported versions before restore', async () => {
  for (const mutation of ['bytes', 'size', 'checksum', 'path', 'version']) {
    const {store, rows, objects} = fixture();
    await store.save(large());
    const row = rows[0].data;
    if (mutation === 'bytes') objects.set(row.path, new Blob(['y'.repeat(row.size)]));
    if (mutation === 'size') row.size++;
    if (mutation === 'checksum') row.sha256 = '0'.repeat(64);
    if (mutation === 'path') row.path = 'users/stranger/backups/0/archive.json';
    if (mutation === 'version') row.version = 3;
    await assert.rejects(store.latest(), /integrity|manifest|format/);
  }
});

test('upload failure publishes no manifest and publication failure retains recoverable bytes', async () => {
  const {store, client, rows, objects} = fixture();
  const upload = client.storageApi.uploadBytes;
  client.storageApi.uploadBytes = async () => {throw Error('offline');};
  await assert.rejects(store.save(large()), /offline/);
  assert.equal(rows.length, 0);
  client.storageApi.uploadBytes = upload;
  client.firestore.setDoc = async () => {throw Error('unconfirmed');};
  await assert.rejects(store.save(large()), /unconfirmed/);
  assert.equal(rows.length, 0);
  assert.equal(objects.size, 1);
});

test('account changes during upload/download prevent publication and restore', async () => {
  const first = fixture();
  first.client.storageApi.uploadBytes = async () => {first.client.auth.currentUser = {uid: 'other'};};
  await assert.rejects(first.store.save(large()), /Sign in again/);
  assert.equal(first.rows.length, 0);
  const second = fixture();
  await second.store.save(large());
  second.client.storageApi.getBlob = async path => {
    second.client.auth.currentUser = null;
    return second.objects.get(path);
  };
  await assert.rejects(second.store.latest(), /Sign in again/);
  const third = fixture();
  third.client.auth.currentUser = {uid: 'owner'};
  assert.throws(third.store.assertAccount, /Sign in again/);
});

test('missing Storage and oversize archives fail without publishing a backup', async () => {
  const {client, rows} = fixture();
  delete client.storage;
  const store = createCloudBackupStore(client);
  await assert.rejects(store.save(large()), /750 KiB/);
  await assert.rejects(store.save(new Blob([new Uint8Array(maxArchiveBytes + 1)])), /maximum/);
  assert.equal(rows.length, 0);
});

test('persistent authentication tries IndexedDB, local storage, then disclosed memory fallback', async () => {
  for (const failures of [0, 1, 2]) {
    const attempts = [];
    const api = {indexedDBLocalPersistence: 'idb', browserLocalPersistence: 'local', inMemoryPersistence: 'memory',
      setPersistence: async (_, mode) => {
        attempts.push(mode);
        if (attempts.length <= failures) throw Error('storage unavailable');
      }};
    assert.equal(await configurePersistence({}, api), failures < 2);
    assert.deepEqual(attempts, ['idb', 'local', 'memory'].slice(0, failures + 1));
  }
});


test('automatic version retries use one immutable transaction identity for small and large archives', async () => {
  for (const archive of [new Blob(['small archive']), large()]) {
    const {store, rows, objects} = fixture();
    await store.save(archive, {backupId: 'automatic-retry'});
    await store.save(archive, {backupId: 'automatic-retry'});
    assert.equal(rows.length, 1);
    assert.equal(objects.size, archive.size > 768000 ? 1 : 0);
    await assert.rejects(store.save(new Blob(['different']), {backupId: 'automatic-retry'}), /different data/);
  }
});

test('automatic Storage replay recovers an uploaded object after failed manifest publication', async () => {
  const {store, client, rows, objects} = fixture();
  const original = client.firestore.runTransaction;
  client.firestore.runTransaction = async () => {throw Error('offline');};
  const archive = large();
  await assert.rejects(store.save(archive, {backupId: 'pending-version'}), /offline/);
  assert.equal(rows.length, 0);assert.equal(objects.size, 1);
  client.firestore.runTransaction = original;
  await store.save(archive, {backupId: 'pending-version'});
  assert.equal(rows.length, 1);assert.equal(objects.size, 1);
  assert.equal(await (await store.latest()).archive.text(), await archive.text());
});

test('automatic write guard prevents publication after pause even under the same account', async () => {
  const {store, client, rows} = fixture();
  const original = client.firestore.runTransaction;
  let enabled = true;
  client.firestore.runTransaction = async (...args) => {enabled = false;return original(...args);};
  await assert.rejects(store.save(new Blob(['pending']), {backupId: 'paused-version',
    assertCanWrite: () => {if (!enabled) throw Error('paused');}}), /paused/);
  assert.equal(rows.length, 0);
});
