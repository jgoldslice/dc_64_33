import {createAutomaticBackup, clearAutomaticConsent} from './automatic-cloud-backup.mjs';
const sdkBase = 'https://www.gstatic.com/firebasejs/12.10.0/';
const maxBackupBytes = 750 * 1024;

export const maxArchiveBytes = 100 * 1024 * 1024;

async function checksum(archive) {
  const hash = await crypto.subtle.digest('SHA-256', await archive.arrayBuffer());
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function createCloudBackupStore({auth, db, firestore, storage, storageApi}) {
  const account = auth.currentUser;
  const uid = account?.uid;
  function assertAccount() {
    // Object identity also invalidates an operation after sign-out/sign-in to the same UID.
    if (!uid || auth.currentUser !== account) throw new Error('Sign in again to use cloud backups.');
  }
  function backups() {
    assertAccount();
    return firestore.collection(db, 'users', uid, 'backups');
  }
  async function save(archive, {backupId, assertCanWrite = () => {}} = {}) {
    function assertWrite() {assertAccount(); assertCanWrite();}
    assertWrite();
    if (backupId !== undefined && !/^[a-zA-Z0-9_-]{1,128}$/.test(backupId)) {
      throw new Error('Invalid backup version identity.');
    }
    async function publish(target, data) {
      assertWrite();
      if (!backupId) {await firestore.addDoc(target, data); return;}
      const ref = firestore.doc(target, backupId);
      // Transactions require a server connection. Automatic writes never enter
      // Firestore's offline write queue, and a retry uses the exact same version.
      await firestore.runTransaction(db, async transaction => {
        assertWrite();
        const snapshot = await transaction.get(ref);
        assertWrite();
        if (snapshot.exists()) {
          const previous = snapshot.data();
          let same = previous.version === data.version;
          if (same && data.version === 1) {
            const left = previous.archive instanceof firestore.Bytes ? previous.archive.toUint8Array() : [];
            const right = data.archive.toUint8Array();
            same = left.length === right.length && right.every((byte, i) => byte === left[i]);
          } else if (same) {
            same = previous.path === data.path && previous.size === data.size && previous.sha256 === data.sha256;
          }
          if (!same) throw new Error('This backup version already contains different data. Automatic backups paused.');
          return;
        }
        transaction.set(ref, data);
      });
    }
    if (!(archive instanceof Blob) || archive.size === 0 || archive.size > maxArchiveBytes) {
      throw new Error('Invalid cloud backup size (maximum 100 MiB). Use Export backup.');
    }
    if (archive.size <= maxBackupBytes) {
      const bytes = new Uint8Array(await archive.arrayBuffer());
      assertWrite();
      await publish(backups(), {
        version: 1, archive: firestore.Bytes.fromUint8Array(bytes),
        createdAt: firestore.serverTimestamp(),
      });
    } else {
      if (!storage || !storageApi) {
        throw new Error('This backup exceeds the 750 KiB cloud limit. Configure Storage or use Export backup.');
      }
      const target = backupId ? firestore.doc(backups(), backupId) : firestore.doc(backups());
      const path = `users/${uid}/backups/${target.id}/archive.json`;
      const sha256 = await checksum(archive);
      assertWrite();
      const object = storageApi.ref(storage, path);
      let uploaded = false;
      if (backupId) {
        try {
          const existing = await storageApi.getBlob(object, archive.size);
          assertWrite();
          if (existing.size !== archive.size || await checksum(existing) !== sha256) {
            throw new Error('Existing staged backup failed its integrity check. Automatic backups paused.');
          }
          uploaded = true;
        } catch (error) {
          if (error.code !== 'storage/object-not-found') throw error;
        }
      }
      assertWrite();
      if (!uploaded) await storageApi.uploadBytes(object, archive, {contentType: 'application/json'});
      assertWrite();
      // Publish only after upload succeeds. A failed publication leaves an inert orphan;
      // never delete or overwrite objects on an ambiguous network result.
      const data = {version: 2, path, size: archive.size, sha256, createdAt: firestore.serverTimestamp()};
      if (backupId) await publish(backups(), data);
      else await firestore.setDoc(target, data);
    }
    assertWrite();
  }
  async function latest() {
    const query = firestore.query(backups(), firestore.orderBy('createdAt', 'desc'), firestore.limit(1));
    const snapshot = await firestore.getDocsFromServer(query);
    assertAccount();
    if (snapshot.empty) return null;
    const document = snapshot.docs[0];
    const data = document.data();
    let archive;
    if (data.version === 1 && data.archive instanceof firestore.Bytes) {
      const bytes = data.archive.toUint8Array();
      if (!bytes.length || bytes.length > maxBackupBytes) throw new Error('Invalid cloud backup size.');
      archive = new Blob([bytes], {type: 'application/json'});
    } else if (data.version === 2) {
      const path = `users/${uid}/backups/${document.id}/archive.json`;
      if (data.path !== path || !Number.isSafeInteger(data.size) || data.size <= 0 ||
          data.size > maxArchiveBytes || !/^[a-f0-9]{64}$/.test(data.sha256)) {
        throw new Error('Invalid cloud backup manifest.');
      }
      if (!storage || !storageApi) throw new Error('Configure Storage to restore this cloud backup.');
      archive = await storageApi.getBlob(storageApi.ref(storage, path), data.size);
      assertAccount();
      if (archive.size !== data.size || await checksum(archive) !== data.sha256) {
        throw new Error('Cloud backup integrity check failed.');
      }
    } else {
      throw new Error('This cloud backup format could not be read.');
    }
    assertAccount();
    return {archive, date: data.createdAt?.toDate()};
  }
  return {save, latest, assertAccount};
}

export async function configurePersistence(auth, authApi) {
  try {
    await authApi.setPersistence(auth, authApi.indexedDBLocalPersistence);
    return true;
  } catch {
    try {
      await authApi.setPersistence(auth, authApi.browserLocalPersistence);
      return true;
    } catch {
      await authApi.setPersistence(auth, authApi.inMemoryPersistence);
      return false;
    }
  }
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
  const auth = authApi.getAuth(app);
  await auth.authStateReady();
  const persistent = await configurePersistence(auth, authApi);
  const storageApi = config.storageBucket ? await import(sdkBase + 'firebase-storage.js') : null;
  return {authApi, firestore, auth, persistent, projectId: config.projectId, db: firestore.getFirestore(app),
    storageApi, storage: storageApi?.getStorage(app)};
}

function install(card) {
  const status = card.querySelector('[role="status"]');
  const signIn = card.querySelector('[data-cloud-sign-in]');
  const signOut = card.querySelector('[data-cloud-sign-out]');
  const save = card.querySelector('[data-cloud-save]');
  const restore = card.querySelector('[data-cloud-restore]');
  const autoControls = card.querySelector('[data-cloud-auto-controls]');
  const autoToggle = card.querySelector('[data-cloud-auto]');
  const autoStatus = card.querySelector('[data-cloud-auto-status]');
  const buttons = [signIn, signOut, save, restore];
  let client;
  let connecting;
  let busy = false;
  let automatic;
  let automaticUser;

  function render() {
    const account = client?.auth.currentUser;
    signIn.hidden = !!account;
    for (const button of [save, restore, signOut]) button.hidden = !account;
    for (const button of buttons) button.disabled = busy || (button !== signOut && !!automatic?.running);
    autoControls.hidden = !account;
    autoToggle.disabled = busy;
    autoToggle.checked = !!automatic?.enabled;
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

  function accountStatus() {
    const account = client.auth.currentUser;
    return account ? 'Signed in as ' + (account.email || 'Google account') +
      (client.persistent ? '' : ' · Session only; sign in again after closing Blueprint.') : 'Signed out.';
  }

  function syncAutomaticAccount() {
    const user = client.auth.currentUser;
    if (user === automaticUser) return;
    automatic?.dispose();
    automatic = null; automaticUser = user;
    if (!user) {clearAutomaticConsent(client.projectId); render(); return;}
    const owner = user;
    const engine = createAutomaticBackup({uid: user.uid, projectId: client.projectId,
      store: createCloudBackupStore(client),
      build: () => globalThis.v74BuildCloudBackupSnapshot(),
      canRun: () => !busy && !globalThis.document.hidden && globalThis.navigator.onLine !== false && client.auth.currentUser === owner,
      onState(state) {
        if (client.auth.currentUser !== owner) return;
        autoStatus.textContent = state.message;
        // The callback can fire during engine construction; rendering is safe
        // before assignment and is repeated immediately afterward.
        render();
      },
    });
    automatic = engine;
    render();
  }
  autoToggle.addEventListener('change', () => {
    const requested = autoToggle.checked;
    run(async () => {
      const engine = automatic;
      const owner = client.auth.currentUser;
      if (!requested) {
        engine.pause(); status.textContent = 'Automatic backups paused.'; return;
      }
      const confirmed = await globalThis.BlueprintSheet.confirm(
        'Automatically save complete copies of this device’s data to this Google account while Blueprint is open? ' +
        'Files and supported drawings are included. Pending uploads resume when you reopen Blueprint. ' +
        'This device allows up to 12 automatic versions or 200 MiB per day, at least five minutes apart. ' +
        'Older versions remain stored and can add cloud costs. You can pause anytime. Restoring remains manual.',
        'Enable automatic backups', 'Automatic backups');
      if (!confirmed) {status.textContent = 'Automatic backups remain off.'; return;}
      if (automatic !== engine || client.auth.currentUser !== owner) throw Error('The account changed. Enable backups again for the current account.');
      await engine.enable();
      status.textContent = 'Automatic backups enabled on this device.';
    }, 'Could not enable automatic backups. Manual backup is still available.')();
  });
  globalThis.addEventListener('blueprint:local-saved', () => automatic?.changed());
  globalThis.addEventListener('blueprint:backup-import-start', () => automatic?.pause('Restore paused automatic backups. Enable them again when ready.'));
  globalThis.addEventListener('online', () => automatic?.tick());
  globalThis.addEventListener('storage', event => {
    if (event.key === 'blueprint-cloud-backup-auto-v1:' + client?.projectId) render();
  });
  // Periodic fingerprints also detect saved sketch/native-ink changes that do
  // not update the planner manifest. No background/closed-app guarantee.
  globalThis.setInterval(() => automatic?.tick(), 15_000);

  async function initialize() {
    if (!connecting) connecting = (async () => {
      client = await connect();
      client.authApi.onAuthStateChanged(client.auth, () => {
        syncAutomaticAccount();
        render();
        if (!busy) status.textContent = accountStatus();
      });
      syncAutomaticAccount();
      render();
    })().catch(error => {connecting = null; throw error;});
    return connecting;
  }

  signIn.addEventListener('click', run(async () => {
    const native = globalThis.Capacitor?.isNativePlatform?.();
    if (native && !globalThis.Capacitor?.isPluginAvailable?.('BlueprintGoogleSignIn')) {
      throw new Error('This iOS build needs the Blueprint Google Sign-In bridge.');
    }
    await initialize();
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
    status.textContent = accountStatus();
  }, 'Google sign-in did not complete. Check your connection and try again.'));

  signOut.addEventListener('click', run(async () => {
    automatic?.pause();
    await client.authApi.signOut(client.auth);
    if (globalThis.Capacitor?.isNativePlatform?.()) {
      await globalThis.Capacitor.nativePromise('BlueprintGoogleSignIn', 'signOut', {});
    }
    status.textContent = 'Signed out.';
  }, 'Could not finish signing out.'));

  save.addEventListener('click', run(async () => {
    const store = createCloudBackupStore(client);
    store.assertAccount();
    if (!await globalThis.BlueprintSheet.confirm(
      'Save a complete copy of this device’s Blueprint data to your Google account?',
      'Back up now', 'Save cloud backup', save)) {
      status.textContent = 'Cloud backup canceled.';
      return;
    }
    await store.save(await globalThis.v74BuildCompleteBackup());
    status.textContent = 'Cloud backup saved.';
  }, 'Could not save the cloud backup. Check your connection and try again.'));

  restore.addEventListener('click', run(async () => {
    automatic?.pause('Restore paused automatic backups. Enable them again when ready.');
    const store = createCloudBackupStore(client);
    const backup = await store.latest();
    if (!backup) {
      status.textContent = 'This account has no cloud backup yet.';
      return;
    }
    const date = backup.date?.toLocaleString();
    status.textContent = date ? 'Latest cloud backup from ' + date : 'Latest cloud backup ready.';
    await globalThis.v74ImportBackup(backup.archive, {assertCanCommit: store.assertAccount});
  }, 'Could not open the cloud backup. Check your connection and try again.'));

  render();
  // Restore an existing session without a popup or a cloud data write.
  run(async () => {await initialize(); status.textContent = accountStatus();},
    'Cloud sign-in is unavailable. Local backups remain available.')();
}

const card = globalThis.document?.getElementById('blueprint-cloud-backup');
if (card) install(card);
