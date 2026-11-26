import {createFirebasePlannerStore} from './sync/firebase-planner-store.mjs';
import {createPlannerPilot} from './sync/planner-pilot.mjs';

const sdkBase = 'https://www.gstatic.com/firebasejs/12.10.0/';
const maxBackupBytes = 750 * 1024;

export function createCloudBackupStore({auth, db, firestore}) {
  const uid = auth.currentUser?.uid;
  function assertAccount() {
    if (!uid || auth.currentUser?.uid !== uid) throw new Error('Sign in again to use cloud backups.');
  }
  function backups() {
    assertAccount();
    return firestore.collection(db, 'users', uid, 'backups');
  }
  async function save(archive) {
    if (!(archive instanceof Blob) || archive.size === 0 || archive.size > maxBackupBytes) {
      throw new Error('This backup exceeds the 750 KiB cloud limit. Use Export backup to keep the complete file.');
    }
    const target = backups();
    const bytes = new Uint8Array(await archive.arrayBuffer());
    assertAccount();
    await firestore.addDoc(target, {
      version: 1, archive: firestore.Bytes.fromUint8Array(bytes),
      createdAt: firestore.serverTimestamp(),
    });
    assertAccount();
  }
  async function latest() {
    const query = firestore.query(backups(), firestore.orderBy('createdAt', 'desc'), firestore.limit(1));
    const snapshot = await firestore.getDocsFromServer(query);
    assertAccount();
    if (snapshot.empty) return null;
    const data = snapshot.docs[0].data();
    if (data.version !== 1 || !(data.archive instanceof firestore.Bytes)) {
      throw new Error('This cloud backup format could not be read.');
    }
    const bytes = data.archive.toUint8Array();
    if (!bytes.length || bytes.length > maxBackupBytes) throw new Error('Invalid cloud backup size.');
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
  const [appApi, authApi, firestore] = await Promise.all([
    import(sdkBase + 'firebase-app.js'),
    import(sdkBase + 'firebase-auth.js'),
    import(sdkBase + 'firebase-firestore.js'),
  ]);
  const app = appApi.getApps().find(candidate => candidate.name === 'blueprint-cloud')
    ?? appApi.initializeApp(config, 'blueprint-cloud');
  return {authApi, firestore, auth: authApi.getAuth(app), db: firestore.getFirestore(app), projectId: config.projectId};
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
    if (!await globalThis.BlueprintSheet.confirm('Save a complete copy of this device’s Blueprint data to your Google account?')) {
      status.textContent = 'Cloud backup canceled.';
      return;
    }
    store.assertAccount();
    await store.save(await globalThis.v74BuildCompleteBackup());
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
    if (!await globalThis.BlueprintSheet.confirm('Apply these reviewed task and event changes to this device and your Google account? No deletions will be synced.')) {
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
