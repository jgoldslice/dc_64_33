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
  async function save(archive) {
    assertAccount();
    if (!(archive instanceof Blob) || archive.size === 0 || archive.size > maxArchiveBytes) {
      throw new Error('Invalid cloud backup size (maximum 100 MiB). Use Export backup.');
    }
    if (archive.size <= maxBackupBytes) {
      const bytes = new Uint8Array(await archive.arrayBuffer());
      assertAccount();
      await firestore.addDoc(backups(), {
        version: 1, archive: firestore.Bytes.fromUint8Array(bytes),
        createdAt: firestore.serverTimestamp(),
      });
    } else {
      if (!storage || !storageApi) {
        throw new Error('This backup exceeds the 750 KiB cloud limit. Configure Storage or use Export backup.');
      }
      const target = firestore.doc(backups());
      const path = `users/${uid}/backups/${target.id}/archive.json`;
      const sha256 = await checksum(archive);
      assertAccount();
      await storageApi.uploadBytes(storageApi.ref(storage, path), archive, {contentType: 'application/json'});
      assertAccount();
      // Publish only after upload succeeds. A failed publication leaves an inert orphan;
      // never delete or overwrite objects on an ambiguous network result.
      await firestore.setDoc(target, {
        version: 2, path, size: archive.size, sha256, createdAt: firestore.serverTimestamp(),
      });
    }
    assertAccount();
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
  return {authApi, firestore, auth, persistent, db: firestore.getFirestore(app),
    storageApi, storage: storageApi?.getStorage(app)};
}

function install(card) {
  const status = card.querySelector('[role="status"]');
  const signIn = card.querySelector('[data-cloud-sign-in]');
  const signOut = card.querySelector('[data-cloud-sign-out]');
  const save = card.querySelector('[data-cloud-save]');
  const restore = card.querySelector('[data-cloud-restore]');
  const buttons = [signIn, signOut, save, restore];
  let client;
  let connecting;
  let busy = false;

  function render() {
    const account = client?.auth.currentUser;
    signIn.hidden = !!account;
    for (const button of [save, restore, signOut]) button.hidden = !account;
    for (const button of buttons) button.disabled = busy;
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

  async function initialize() {
    if (!connecting) connecting = (async () => {
      client = await connect();
      client.authApi.onAuthStateChanged(client.auth, () => {
        render();
        if (!busy) status.textContent = accountStatus();
      });
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
