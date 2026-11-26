import {createFirebasePlannerStore} from './sync/firebase-planner-store.mjs';
import {createPlannerPilot} from './sync/planner-pilot.mjs';

const sdkBase = 'https://www.gstatic.com/firebasejs/12.10.0/';
export const maxBackupBytes = 100 * 1024 * 1024;
const maxLegacyBackupBytes = 750 * 1024;
const sha256 = async bytes => Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes)),
  byte => byte.toString(16).padStart(2, '0')).join('');

export function createCloudBackupStore({auth, db, firestore, storage, storageApi, authApi}) {
  const uid = auth.currentUser?.uid;
  function assertAccount() {
    if (!uid || auth.currentUser?.uid !== uid) throw new Error('Sign in again to use cloud backups.');
  }
  function backups() {
    assertAccount();
    return firestore.collection(db, 'users', uid, 'backups');
  }
  async function save(archive, onProgress = () => {}) {
    assertAccount();
    if (!(archive instanceof Blob) || archive.size === 0 || archive.size > maxBackupBytes) {
      throw new Error('Cloud backups support up to 100 MiB per backup. Use Export backup to keep a larger complete file.');
    }
    if (!storage || !storageApi) throw new Error('This build needs Firebase Storage configured for cloud backups.');
    const target = firestore.doc(backups());
    const path = 'users/' + uid + '/backups/' + target.id + '/archive.json';
    const bytes = new Uint8Array(await archive.arrayBuffer());
    const digest = await sha256(bytes);
    assertAccount();
    const upload = storageApi.uploadBytesResumable(storageApi.ref(storage, path), bytes, {
      contentType: 'application/json',
    });
    const stopProgress = upload.on('state_changed', snapshot => {
      if (auth.currentUser?.uid !== uid) { upload.cancel(); return; }
      onProgress(snapshot.totalBytes ? snapshot.bytesTransferred / snapshot.totalBytes : 0);
    });
    const stopAuth = authApi?.onAuthStateChanged(auth, user => {
      if (user?.uid !== uid) upload.cancel();
    });
    try {
      await upload;
    } finally {
      stopProgress();
      stopAuth?.();
    }
    assertAccount();
    // A failed/canceled upload never publishes a restorable backup. Files are immutable;
    // an interruption after upload can leave an unlisted file, never a partial restore.
    await firestore.setDoc(target, {
      version: 2, path, size: archive.size, sha256: digest,
      createdAt: firestore.serverTimestamp(),
    });
    assertAccount();
  }
  async function latest() {
    const query = firestore.query(backups(), firestore.orderBy('createdAt', 'desc'), firestore.limit(1));
    const snapshot = await firestore.getDocsFromServer(query);
    assertAccount();
    if (snapshot.empty) return null;
    const row = snapshot.docs[0], data = row.data();
    let bytes;
    if (data.version === 2) {
      const expectedPath = 'users/' + uid + '/backups/' + row.id + '/archive.json';
      if (data.path !== expectedPath || !Number.isInteger(data.size) || data.size <= 0
        || data.size > maxBackupBytes || !/^[a-f0-9]{64}$/.test(data.sha256)) {
        throw new Error('Invalid cloud backup metadata. No local data was changed.');
      }
      if (!storage || !storageApi) throw new Error('This build needs Firebase Storage to restore this backup.');
      const file = storageApi.ref(storage, expectedPath);
      const metadata = await storageApi.getMetadata(file);
      assertAccount();
      if (metadata.size !== data.size || metadata.contentType !== 'application/json') {
        throw new Error('Cloud backup size or file type does not match. No local data was changed.');
      }
      bytes = new Uint8Array(await storageApi.getBytes(file, data.size));
      assertAccount();
      const digest = await sha256(bytes);
      assertAccount();
      if (bytes.length !== data.size || digest !== data.sha256) {
        throw new Error('Cloud backup integrity check failed. No local data was changed.');
      }
    } else if (data.version === 1 && data.archive instanceof firestore.Bytes) {
      bytes = data.archive.toUint8Array();
      if (!bytes.length || bytes.length > maxLegacyBackupBytes) throw new Error('Invalid cloud backup size.');
    } else {
      throw new Error('This cloud backup format could not be read.');
    }
    return {
      archive: new Blob([bytes], {type: 'application/json'}),
      date: data.createdAt?.toDate(),
    };
  }
  return {save, latest, assertAccount};
}

async function connect() {
  const response = await fetch(new URL('./firebase-client.json', import.meta.url), {cache: 'no-store'});
  if (!response.ok) throw new Error('Connect a Firebase project to enable Google sign-in.');
  const config = await response.json();
  if (!config?.apiKey || !config.authDomain || !config.projectId || !config.appId) {
    throw new Error('Connect a Firebase project to enable Google sign-in.');
  }
  const [appApi, authApi, firestore, storageApi] = await Promise.all([
    import(sdkBase + 'firebase-app.js'),
    import(sdkBase + 'firebase-auth.js'),
    import(sdkBase + 'firebase-firestore.js'),
    import(sdkBase + 'firebase-storage.js'),
  ]);
  const app = appApi.getApps().find(candidate => candidate.name === 'blueprint-cloud')
    ?? appApi.initializeApp(config, 'blueprint-cloud');
  return {authApi, firestore, storageApi, storage: storageApi.getStorage(app),
    auth: authApi.getAuth(app), db: firestore.getFirestore(app), projectId: config.projectId};
}

function install(card) {
  const status = card.querySelector('[role="status"]');
  const signIn = card.querySelector('[data-cloud-sign-in]');
  const signOut = card.querySelector('[data-cloud-sign-out]');
  const save = card.querySelector('[data-cloud-save]');
  const restore = card.querySelector('[data-cloud-restore]');
  const preview = card.querySelector('[data-cloud-preview]');
  const reviewPanel = card.querySelector('[data-cloud-review]');
  const apply = card.querySelector('[data-cloud-apply]');
  const buttons = [signIn, signOut, save, restore, preview, apply];
  let review = null, pilot = null, reviewUid = null;
  function clearReview() { review = null; pilot = null; reviewUid = null; reviewPanel.hidden = true; }
  let client;
  let busy = false;

  function render() {
    const account = client?.auth.currentUser;
    signIn.hidden = !!account;
    for (const button of [save, restore, preview, signOut]) button.hidden = !account;
    if (!account || (reviewUid && reviewUid !== account.uid)) clearReview();
    for (const button of buttons) button.disabled = busy;
    apply.disabled = busy || !review || !!review.conflicts.length;
  }

  function run(action, fallback) {
    return async () => {
      if (busy) return;
      busy = true;
      render();
      status.textContent = 'Working…';
      try {
        await action();
      } catch (error) {
        status.textContent = error instanceof Error && error.name === 'Error' && !error.code
          ? error.message : fallback;
      } finally {
        busy = false;
        render();
      }
    };
  }

  signIn.addEventListener('click', run(async () => {
    const native = globalThis.Capacitor?.isNativePlatform?.();
    if (native && !globalThis.Capacitor?.isPluginAvailable?.('BlueprintGoogleSignIn')) {
      throw new Error('This iOS build needs the Blueprint Google Sign-In bridge.');
    }
    if (!client) {
      client = await connect();
      client.authApi.onAuthStateChanged(client.auth, user => {
        render();
        if (!busy) status.textContent = user ? 'Signed in as ' + (user.email || 'Google account') : 'Signed out.';
      });
      await client.auth.authStateReady();
    }
    const {auth, authApi} = client;
    if (!auth.currentUser && !native && globalThis.navigator.userActivation?.isActive === false) {
      status.textContent = 'Google sign-in is ready. Tap Continue with Google.';
      return;
    }
    if (!auth.currentUser && native) {
      const {idToken, accessToken} = await globalThis.Capacitor.nativePromise('BlueprintGoogleSignIn', 'signIn', {});
      await authApi.signInWithCredential(auth, authApi.GoogleAuthProvider.credential(idToken, accessToken));
    } else if (!auth.currentUser) {
      const provider = new authApi.GoogleAuthProvider();
      provider.setCustomParameters({prompt: 'select_account'});
      await authApi.signInWithPopup(auth, provider);
    }
    status.textContent = 'Signed in as ' + (auth.currentUser.email || 'Google account');
  }, 'Google sign-in did not complete. Check your connection and try again.'));

  signOut.addEventListener('click', run(async () => {
    await client.authApi.signOut(client.auth);
    if (globalThis.Capacitor?.isNativePlatform?.()) {
      await globalThis.Capacitor.nativePromise('BlueprintGoogleSignIn', 'signOut', {});
    }
    status.textContent = 'Signed out.';
  }, 'Could not finish signing out.'));

  save.addEventListener('click', run(async () => {
    clearReview();
    const store = createCloudBackupStore(client);
    if (!await globalThis.BlueprintSheet.confirm('Save a complete copy of this device’s Blueprint data to your Google account?', 'Back up now', 'Confirm cloud backup')) {
      status.textContent = 'Cloud backup canceled.';
      return;
    }
    store.assertAccount();
    status.textContent = 'Preparing complete backup…';
    await store.save(await globalThis.v74BuildCompleteBackup(), fraction => {
      status.textContent = 'Uploading backup… ' + Math.round(fraction * 100) + '%';
    });
    status.textContent = 'Cloud backup saved.';
  }, 'Could not save the cloud backup. Check your connection and try again.'));

  restore.addEventListener('click', run(async () => {
    clearReview();
    const store = createCloudBackupStore(client);
    const backup = await store.latest();
    if (!backup) {
      status.textContent = 'This account has no cloud backup yet.';
      return;
    }
    const date = backup.date?.toLocaleString();
    status.textContent = date ? 'Latest cloud backup from ' + date : 'Latest cloud backup ready.';
    await globalThis.v74ImportBackup(backup.archive, store.assertAccount);
  }, 'Could not open the cloud backup. Check your connection and try again.'));

  preview.addEventListener('click', run(async () => {
    clearReview();
    const uid = client.auth.currentUser?.uid;
    const assertAccount = createCloudBackupStore(client).assertAccount;
    assertAccount();
    const local = globalThis.BlueprintSyncLocal;
    const snapshot = local.prepare();
    pilot = createPlannerPilot({store:createFirebasePlannerStore(client), local,
      storage:globalThis.localStorage, scope:JSON.stringify([client.projectId,uid,snapshot.generation]), assertAccount});
    const next = await pilot.preview();
    assertAccount();
    review = next;
    reviewUid = uid;
    reviewPanel.hidden = false;
    reviewPanel.querySelector('[data-cloud-summary]').textContent =
      next.uploads.length + ' upload(s), ' + next.downloads.length + ' download(s), ' +
      next.conflicts.length + ' conflict(s). ' + next.excluded.length + ' linked task(s) and ' +
      next.skippedDeletions.length + ' deletion(s) excluded. ' +
      (next.checkpoint.pending ? 'Previous sync interrupted; fresh preview required. ' : '') +
      'This pilot does not sync notes, projects, habits, or deletions.';
    reviewPanel.querySelector('[data-cloud-changes]').textContent = JSON.stringify({
      uploads:next.uploads, downloads:next.downloads, conflicts:next.conflicts,
      skippedDeletions:next.skippedDeletions, linkedTaskIds:next.excluded
    }, null, 2);
    status.textContent = next.conflicts.length ? 'Conflicts found. No sync changes applied.' : 'Preview ready. Review changes before applying.';
  }, 'Could not preview sync. Check your connection and try again.'));

  apply.addEventListener('click', run(async () => {
    if (!review || !pilot || reviewUid !== client.auth.currentUser?.uid) throw Error('Preview sync again.');
    if (!await globalThis.BlueprintSheet.confirm('Apply these reviewed task and event changes to this device and your Google account? No deletions will be synced.', 'Apply sync', 'Confirm planner sync')) {
      status.textContent = 'Sync canceled.';
      return;
    }
    const selected = review, engine = pilot;
    clearReview();
    const result = await engine.apply(selected);
    status.textContent = 'Sync complete: ' + result.uploads + ' uploaded, ' + result.downloads + ' downloaded.';
  }, 'Sync did not complete. Preview again; some cloud writes may have completed.'));

  render();
}

const card = globalThis.document?.getElementById('blueprint-cloud-backup');
if (card) install(card);
