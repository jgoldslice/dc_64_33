import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {deleteApp, initializeApp} from 'firebase/app';
import {
  connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword, signOut,
} from 'firebase/auth';
import * as firestore from 'firebase/firestore';
import {createFirebasePlannerStore, StalePlannerRevision} from '../sync/firebase-planner-store.mjs';
import {planPlannerSync} from '../sync/planner-sync.mjs';

const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const dbHost = process.env.FIRESTORE_EMULATOR_HOST;
if (authHost !== '127.0.0.1:9099' || dbHost !== '127.0.0.1:8080') {
  throw new Error('Start the Blueprint Auth and Firestore emulators before running this test.');
}

function client(t) {
  const app = initializeApp({projectId: 'demo-blueprint-sync', apiKey: 'demo-key'}, randomUUID());
  t.after(() => deleteApp(app));
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://' + authHost, {disableWarnings: true});
  const db = firestore.getFirestore(app);
  firestore.connectFirestoreEmulator(db, '127.0.0.1', 8080);
  return {auth, db, firestore};
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
