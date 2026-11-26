import {
  plannerCollections,
  plannerId,
  projectPlannerRecord,
  samePlannerRecord,
  validatePlannerHead,
} from './planner-sync.mjs';

export class StalePlannerRevision extends Error {
  constructor(head) {
    super('The cloud record changed. Refresh the sync preview before retrying.');
    this.name = 'StalePlannerRevision';
    this.head = head;
  }
}

// firestore is the modular Firebase Cloud Firestore SDK. The caller owns
// initialization and sign-in. Each store is bound to the UID at creation.
export function createFirebasePlannerStore({auth, db, firestore}) {
  const uid = auth.currentUser?.uid;
  function assertOwner() {
    if (!uid || auth.currentUser?.uid !== uid) {
      throw new Error('Sign in to the same Blueprint account before syncing.');
    }
  }
  assertOwner();

  function readHead(collection, snapshot) {
    const head = validatePlannerHead(collection, snapshot.data());
    if (snapshot.id !== 'r-' + head.id) {
      throw new Error('Cloud planner record does not match its path.');
    }
    return head;
  }

  async function list() {
    assertOwner();
    const snapshots = await Promise.all(plannerCollections.map(collection =>
      firestore.getDocsFromServer(firestore.collection(db, 'users', uid, collection))));
    assertOwner();
    return snapshots.flatMap((snapshot, index) =>
      snapshot.docs.map(doc => readHead(plannerCollections[index], doc)));
  }

  async function commit({collection, id: rawId, expectedRevision, record: source}) {
    assertOwner();
    if (!plannerCollections.includes(collection) ||
        !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
      throw new TypeError('Invalid planner write intent');
    }
    const id = plannerId(rawId);
    const record = source === null ? null : projectPlannerRecord(collection, source);
    if (record ? record.id !== id : expectedRevision === 0) {
      throw new TypeError('Invalid planner write record');
    }
    const ref = firestore.doc(db, 'users', uid, collection, 'r-' + id);
    const committed = await firestore.runTransaction(db, async transaction => {
      assertOwner();
      const snapshot = await transaction.get(ref);
      assertOwner();
      const current = snapshot.exists() ? readHead(collection, snapshot) : null;
      if (current && samePlannerRecord(collection, current.record, record)) return current;
      if ((current?.revision ?? 0) !== expectedRevision) throw new StalePlannerRevision(current);
      const revision = expectedRevision + 1;
      transaction.set(ref, {id, revision, record, updatedAt: firestore.serverTimestamp()});
      return {collection, id, revision, record};
    });
    assertOwner();
    return committed;
  }

  return {list, commit};
}
