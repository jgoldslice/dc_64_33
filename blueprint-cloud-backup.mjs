import {createFirebasePlannerStore} from './sync/firebase-planner-store.mjs';
import {createPlannerPilot} from './sync/planner-pilot.mjs';

const sdkBase = 'https://www.gstatic.com/firebasejs/12.10.0/';
export const maxBackupBytes = 100 * 1024 * 1024;
const maxLegacyBackupBytes = 750 * 1024;
const sha256 = async bytes => Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes)),
  byte => byte.toString(16).padStart(2, '0')).join('');

export async function withDeadline(operation, milliseconds, message) {
  let timer;
  try {
    return await Promise.race([operation, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

export function initializeBlueprintAuth(app, authApi, native) {
  // Native Google Sign-In supplies the credential. Its WKWebView must not start
  // the browser popup/redirect resolver and its proactive cross-origin iframe.
  return native ? authApi.initializeAuth(app, {
    persistence: [authApi.indexedDBLocalPersistence, authApi.browserLocalPersistence],
  }) : authApi.getAuth(app);
}

export function initializeBlueprintFirestore(app, firestore, native) {
  // WKWebView/network buffering can prevent streaming WebChannel responses from
  // completing. Native builds use Firestore's supported non-streaming transport.
  return native ? firestore.initializeFirestore(app, {experimentalForceLongPolling: true})
    : firestore.getFirestore(app);
}

export async function downloadBackupChunks({user, file, size, assertAccount, onProgress,
  createRequest = () => new XMLHttpRequest()}) {
  // Download small authenticated ranges instead of a single opaque WKWebView
  // array-buffer request. Never create a public download URL or log the token.
  assertAccount();
  if (!Number.isInteger(size) || size <= 0 || size > maxBackupBytes) throw Error('Invalid cloud backup size.');
  const token = await withDeadline(user.getIdToken(), 20000,
    'Could not authorize the backup download. Sign in again and retry.');
  assertAccount();
  const url = 'https://firebasestorage.googleapis.com/v0/b/' + encodeURIComponent(file.bucket)
    + '/o/' + encodeURIComponent(file.fullPath) + '?alt=media';
  const bytes = new Uint8Array(size), chunkSize = 1024 * 1024;
  for (let start = 0; start < size; start += chunkSize) {
    assertAccount();
    const end = Math.min(start + chunkSize, size) - 1, expected = end - start + 1;
    const chunk = await new Promise((resolve, reject) => {
      const request = createRequest();
      let settled = false;
      function finish(error, result) {
        if (settled) return;
        settled = true;
        request.onload = request.onerror = request.ontimeout = request.onabort = request.onprogress = null;
        if (error) { request.abort(); reject(error); } else resolve(result);
      }
      request.open('GET', url);
      request.responseType = 'arraybuffer';
      request.timeout = 30000;
      request.setRequestHeader('Authorization', 'Firebase ' + token);
      request.setRequestHeader('Range', 'bytes=' + start + '-' + end);
      request.onprogress = event => {
        try {
          assertAccount();
          if (event.loaded > expected) throw Error('The backup download exceeded its expected size. No local data was changed.');
          onProgress(start + event.loaded, size);
        } catch (error) { finish(error); }
      };
      request.onload = () => {
        try {
          assertAccount();
          if (request.status === 401 || request.status === 403) {
            throw Error('Your account could not access this backup. Sign out and sign in again, then retry.');
          }
          const range = request.getResponseHeader('Content-Range');
          const completeSmallFile = start === 0 && expected === size && request.status === 200;
          if (!(completeSmallFile || (request.status === 206 && range === 'bytes ' + start + '-' + end + '/' + size))
            || !(request.response instanceof ArrayBuffer) || request.response.byteLength !== expected) {
            throw Error('The backup download was incomplete. No local data was changed. Try Restore latest again.');
          }
          finish(null, new Uint8Array(request.response));
        } catch (error) { finish(error); }
      };
      request.onerror = request.ontimeout = request.onabort = () => finish(new Error(
        'The backup download stopped. No local data was changed. Check your connection and try Restore latest again.'));
      request.send();
    });
    assertAccount();
    bytes.set(chunk, start);
    onProgress(end + 1, size);
  }
  return bytes;
}

export function createCloudBackupStore({auth, db, firestore, storage, storageApi, authApi, native = false}) {
  const account = auth.currentUser;
  const uid = account?.uid;
  function assertAccount() {
    // The operation belongs to this Auth session, not merely its UID.
    // A sign-out followed by sign-in to the same account invalidates it.
    if (!uid || auth.currentUser !== account) throw new Error('Sign in again to use cloud backups.');
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
      if (auth.currentUser !== account) { upload.cancel(); return; }
      onProgress(snapshot.totalBytes ? snapshot.bytesTransferred / snapshot.totalBytes : 0);
    });
    const stopAuth = authApi?.onAuthStateChanged(auth, user => {
      if (user !== account) upload.cancel();
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
  async function latest(progress = () => {}) {
    progress('Looking for your latest cloud backup…');
    const query = firestore.query(backups(), firestore.orderBy('createdAt', 'desc'), firestore.limit(1));
    const snapshot = await withDeadline(firestore.getDocsFromServer(query), 20000,
      'The cloud backup list did not respond. Your local data has not changed. Check your connection and try Restore latest again.');
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
      progress('Checking the backup file…');
      const metadata = await withDeadline(storageApi.getMetadata(file), 20000,
        'The backup file did not respond. Your local data has not changed. Try Restore latest again.');
      assertAccount();
      if (metadata.size !== data.size || metadata.contentType !== 'application/json') {
        throw new Error('Cloud backup size or file type does not match. No local data was changed.');
      }
      progress('Downloading complete backup… ' + (data.size / 1024 / 1024).toFixed(1) + ' MiB');
      if (native) {
        bytes = await downloadBackupChunks({user:auth.currentUser,file,size:data.size,assertAccount,
          onProgress:(loaded,total) => progress('Downloading backup… '
            + Math.floor(loaded / total * 100) + '% · ' + (loaded / 1024 / 1024).toFixed(1)
            + ' of ' + (total / 1024 / 1024).toFixed(1) + ' MiB')});
      } else {
        bytes = new Uint8Array(await withDeadline(storageApi.getBytes(file, data.size), 180000,
          'The backup download timed out. Your local data has not changed. Check your connection and try Restore latest again.'));
      }
      assertAccount();
      progress('Verifying the downloaded backup…');
      const digest = await withDeadline(sha256(bytes), 60000,
        'Backup verification did not finish. Your local data has not changed. Close and reopen Blueprint, then try again.');
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

async function connect(progress = () => {}) {
  progress('Reading sign-in settings…');
  const controller = new AbortController();
  let config;
  try {
    config = await withDeadline((async () => {
      const response = await fetch(new URL('./firebase-client.json', import.meta.url), {
        cache: 'no-store', signal: controller.signal,
      });
      if (!response.ok) throw new Error('Connect a Firebase project to enable Google sign-in.');
      return response.json();
    })(), 15000, 'Could not read sign-in settings. Close and reopen Blueprint, then try again.');
  } finally { controller.abort(); }
  if (!config?.apiKey || !config.authDomain || !config.projectId || !config.appId) {
    throw new Error('Connect a Firebase project to enable Google sign-in.');
  }
  progress('Connecting to Google services…');
  const [appApi, authApi, firestore, storageApi] = await withDeadline(Promise.all([
    import(sdkBase + 'firebase-app.js'),
    import(sdkBase + 'firebase-auth.js'),
    import(sdkBase + 'firebase-firestore.js'),
    import(sdkBase + 'firebase-storage.js'),
  ]), 30000, 'Google services did not load. Check your internet connection and try again.');
  const app = appApi.getApps().find(candidate => candidate.name === 'blueprint-cloud')
    ?? appApi.initializeApp(config, 'blueprint-cloud');
  return {authApi, firestore, storageApi, storage: storageApi.getStorage(app),
    native: !!globalThis.Capacitor?.isNativePlatform?.(),
    auth: initializeBlueprintAuth(app, authApi, !!globalThis.Capacitor?.isNativePlatform?.()),
    db: initializeBlueprintFirestore(app, firestore, !!globalThis.Capacitor?.isNativePlatform?.()),
    projectId: config.projectId};
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
      client = await connect(message => { status.textContent = message; });
      client.authApi.onAuthStateChanged(client.auth, user => {
        render();
        if (!busy) status.textContent = user ? 'Signed in as ' + (user.email || 'Google account') : 'Signed out.';
      });
    }
    status.textContent = 'Checking saved sign-in…';
    await withDeadline(client.auth.authStateReady(), 20000,
      'Saved sign-in did not respond. Close and reopen Blueprint, then try again.');
    const {auth, authApi} = client;
    if (!auth.currentUser && !native && globalThis.navigator.userActivation?.isActive === false) {
      status.textContent = 'Google sign-in is ready. Tap Continue with Google.';
      return;
    }
    if (!auth.currentUser && native) {
      status.textContent = 'Opening Google sign-in…';
      const {idToken, accessToken} = await withDeadline(
        globalThis.Capacitor.nativePromise('BlueprintGoogleSignIn', 'signIn', {}), 120000,
        'Google sign-in did not respond. Close any Google sign-in screen and reopen Blueprint to try again.');
      status.textContent = 'Finishing Google sign-in…';
      await withDeadline(authApi.signInWithCredential(auth, authApi.GoogleAuthProvider.credential(idToken, accessToken)),
        30000, 'Google account verification timed out. Check your connection and try again.');
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
    const backup = await store.latest(message => { status.textContent = message; });
    if (!backup) {
      status.textContent = 'This account has no cloud backup yet.';
      return;
    }
    const date = backup.date?.toLocaleString();
    status.textContent = date ? 'Preparing restore from ' + date + '…' : 'Preparing complete backup restore…';
    const restored = await globalThis.v74ImportBackup(backup.archive, store.assertAccount);
    status.textContent = restored === false ? 'Restore canceled. Your local data has not changed.' : 'Cloud backup restored.';
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
