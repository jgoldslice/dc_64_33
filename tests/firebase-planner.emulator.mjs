import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {deleteApp, initializeApp} from 'firebase/app';
import {
  connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword, signOut,
} from 'firebase/auth';
import * as firestore from 'firebase/firestore';
import * as storageApi from 'firebase/storage';
import {createFirebasePlannerStore, StalePlannerRevision} from '../sync/firebase-planner-store.mjs';
import {planPlannerSync} from '../sync/planner-sync.mjs';
import {createCloudBackupStore} from '../blueprint-cloud-backup.mjs';

const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const dbHost = process.env.FIRESTORE_EMULATOR_HOST;
if (authHost !== '127.0.0.1:9099' || dbHost !== '127.0.0.1:8080'
    || process.env.FIREBASE_STORAGE_EMULATOR_HOST !== '127.0.0.1:9199') {
  throw new Error('Start the Blueprint Auth, Firestore and Storage emulators before running this test.');
}

function client(t) {
  const app = initializeApp({projectId: 'demo-blueprint-sync', apiKey: 'demo-key', storageBucket:'demo-blueprint-sync.appspot.com'}, randomUUID());
  t.after(() => deleteApp(app));
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://' + authHost, {disableWarnings: true});
  const db = firestore.getFirestore(app);
  firestore.connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const storage = storageApi.getStorage(app);
  storageApi.connectStorageEmulator(storage, '127.0.0.1', 9199);
  return {auth, db, firestore, storage, storageApi};
}

const task = {id: 42, title: 'Draft report', done: false};
const event = {id: 42, title: 'Office hours', date: '2026-11-24', time: '13:00'};
const password = 'emulator-only-password';
const permissionDenied = {code: 'permission-denied'};

test('two Firebase clients synchronize planner records under one account', async t => {
  const phone = client(t);
  const tablet = client(t);
  const stranger = client(t);
  const signedOut = client(t);
  const email = randomUUID() + '@example.test';
  await createUserWithEmailAndPassword(phone.auth, email, password);
  await signInWithEmailAndPassword(tablet.auth, email, password);
  await createUserWithEmailAndPassword(stranger.auth, randomUUID() + '@example.test', password);
  const phoneStore = createFirebasePlannerStore(phone);
  const tabletStore = createFirebasePlannerStore(tablet);
  const uid = phone.auth.currentUser.uid;

  await t.test('seeds tasks and events and retries without increasing the revision', async () => {
    const {uploads} = planPlannerSync({planner: {tasks: [task], events: [event]}, remote: await phoneStore.list()});
    for (const upload of uploads) {
      const committed = await phoneStore.commit(upload);
      assert.equal(committed.revision, 1);
      assert.deepEqual(await phoneStore.commit(upload), committed);
    }
    const snapshot = await tabletStore.list();
    assert.deepEqual(snapshot.map(head => [head.collection, head.id, head.revision]),
      [['tasks', '42', 1], ['events', '42', 1]]);
  });

  await t.test('rejects a stale write and merges independent edits after refresh', async () => {
    const baseline = await tabletStore.list();
    const taskHead = baseline.find(head => head.collection === 'tasks');
    await phoneStore.commit({
      ...taskHead, expectedRevision: 1,
      record: {...taskHead.record, scheduledDate: '2026-11-26', scheduledTime: '09:00'},
    });
    const tabletPlanner = {tasks: [{...task, done: true}], events: [event]};
    const stale = planPlannerSync({planner: tabletPlanner, baseline, remote: baseline});
    await assert.rejects(tabletStore.commit(stale.uploads[0]), error =>
      error instanceof StalePlannerRevision && error.head.revision === 2);
    const fresh = planPlannerSync({planner: tabletPlanner, baseline, remote: await tabletStore.list()});
    assert.deepEqual(fresh.conflicts, []);
    const saved = await tabletStore.commit(fresh.uploads[0]);
    assert.equal(saved.revision, 3);
    assert.equal(saved.record.scheduledTime, '09:00');
    assert.equal(saved.record.done, true);
    assert.deepEqual((await phoneStore.list())[0], saved);
  });

  await t.test('cloud backup versions are immutable and isolated to the account', async () => {
    const phoneBackup = createCloudBackupStore(phone);
    const tabletBackup = createCloudBackupStore(tablet);
    assert.equal(await tabletBackup.latest(), null);
    await phoneBackup.save(new Blob(['first']));
    await phoneBackup.save(new Blob(['second']));
    assert.equal(await (await tabletBackup.latest()).archive.text(), 'second');
    const largeArchive = new Blob(['x'.repeat(2 * 1024 * 1024)], {type:'application/json'});
    await phoneBackup.save(largeArchive);
    assert.equal((await tabletBackup.latest()).archive.size,largeArchive.size);
    const backups = db => firestore.collection(db, 'users', uid, 'backups');
    await assert.rejects(firestore.getDocsFromServer(backups(stranger.db)), permissionDenied);
    await assert.rejects(firestore.addDoc(backups(stranger.db), {
      version: 1, archive: firestore.Bytes.fromUint8Array(new Uint8Array([1])),
      createdAt: firestore.serverTimestamp(),
    }), permissionDenied);
    const snapshots = await firestore.getDocsFromServer(backups(phone.db));
    assert.equal(snapshots.size, 3);
    await assert.rejects(firestore.deleteDoc(snapshots.docs[0].ref), permissionDenied);
    const backup = snapshots.docs[0].data();
    const file = c => storageApi.ref(c.storage, backup.path);
    await assert.rejects(storageApi.getBytes(file(stranger)), {code:'storage/unauthorized'});
    await assert.rejects(storageApi.getBytes(file(signedOut)), {code:'storage/unauthorized'});
    await assert.rejects(storageApi.uploadBytes(file(phone), new Uint8Array([1]), {contentType:'application/json'}),
      {code:'storage/unauthorized'});
    await assert.rejects(storageApi.deleteObject(file(phone)), {code:'storage/unauthorized'});
    const newPath = 'users/' + uid + '/backups/foreign-write/archive.json';
    await assert.rejects(storageApi.uploadBytes(storageApi.ref(stranger.storage,newPath), new Uint8Array([1]), {contentType:'application/json'}),
      {code:'storage/unauthorized'});
    await assert.rejects(storageApi.uploadBytes(storageApi.ref(phone.storage,newPath), new Uint8Array([1]), {contentType:'text/html'}),
      {code:'storage/unauthorized'});
    await assert.rejects(firestore.setDoc(firestore.doc(backups(phone.db)), {
      version:2,path:'users/another/backups/foreign/archive.json',size:1,sha256:'a'.repeat(64),createdAt:firestore.serverTimestamp(),
    }),permissionDenied);
    await assert.rejects(firestore.updateDoc(snapshots.docs[0].ref,{size:1}),permissionDenied);
    // An existing inline backup remains readable after this upgrade.
    await firestore.addDoc(backups(phone.db), {
      version:1,archive:firestore.Bytes.fromUint8Array(new TextEncoder().encode('legacy')),
      createdAt:firestore.serverTimestamp(),
    });
    assert.equal(await (await tabletBackup.latest()).archive.text(),'legacy');
  });

  await t.test('rules enforce account boundaries, schema, revisions and deletion markers', async () => {
    const taskPath = db => firestore.doc(db, 'users', uid, 'tasks', 'r-42');
    const taskHead = (await phoneStore.list())[0];
    const good = {id: '42', revision: 4, record: taskHead.record, updatedAt: firestore.serverTimestamp()};
    await assert.rejects(firestore.getDocFromServer(taskPath(stranger.db)), permissionDenied);
    await assert.rejects(firestore.getDocsFromServer(firestore.collection(stranger.db, 'users', uid, 'tasks')),
      permissionDenied);
    await assert.rejects(firestore.setDoc(taskPath(stranger.db), good), permissionDenied);
    await assert.rejects(firestore.getDocFromServer(taskPath(signedOut.db)), permissionDenied);
    await assert.rejects(firestore.setDoc(taskPath(phone.db), {...good, revision: 10}), permissionDenied);
    await assert.rejects(firestore.setDoc(taskPath(phone.db), {...good, record: {...good.record, title: 7}}),
      permissionDenied);
    await assert.rejects(firestore.setDoc(firestore.doc(phone.db, 'users', uid, 'tasks', 'r-mismatch'),
      {...good, revision: 1}), permissionDenied);
    await assert.rejects(firestore.deleteDoc(taskPath(phone.db)), permissionDenied);
    assert.equal((await phoneStore.commit({...taskHead, expectedRevision: 3, record: null})).revision, 4);
    assert.equal((await tabletStore.list())[0].record, null);
    await signOut(tablet.auth);
    await assert.rejects(tabletStore.list(), /same Blueprint account/);
  });
});
