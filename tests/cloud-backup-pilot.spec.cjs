const {test, expect} = require('@playwright/test');

async function openCloud(page) {
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('/');
  await page.locator('#paletteLauncher').click();
  const cloud = page.locator('#blueprint-cloud-backup');
  await expect(cloud).toBeVisible();
  return cloud;
}

test('an unconfigured build keeps local backups available', async ({page}) => {
  const cloud = await openCloud(page);
  await cloud.getByRole('button', {name: 'Continue with Google'}).click();
  await expect(cloud.getByRole('status')).toHaveText('Connect a Firebase project to enable Google sign-in.');
  await expect(cloud.getByRole('button', {name: 'Back up now'})).toBeHidden();
  await expect(page.getByRole('button', {name: 'Export backup'})).toBeVisible();
});

async function mockCloud(page, storage = false) {
  await page.route('**/firebase-client.json', route => route.fulfill({
    json: {apiKey: 'test', authDomain: 'example.test', projectId: 'test', appId: 'test', ...(storage ? {storageBucket: 'test'} : {})},
  }));
  const modules = {
    'firebase-app.js': 'export const getApps = () => []; export const initializeApp = () => ({});',
    'firebase-auth.js': `
      const auth = {currentUser: {uid: 'fixture', email: 'pilot@example.test'}, authStateReady: async () => {}};
      window.fixtureAuth = auth;
      export const getAuth = () => auth;
      export const setPersistence = async () => {};
      export const indexedDBLocalPersistence = {};
      export const browserLocalPersistence = {};
      export const inMemoryPersistence = {};
      export const onAuthStateChanged = (_, listener) => listener(auth.currentUser);
      export const signOut = async () => {auth.currentUser = null;};
    `,
    'firebase-storage.js': `
      const objects = new Map();
      export const getStorage = () => ({});
      export const ref = (_, path) => path;
      export const uploadBytes = async (path, blob) => {objects.set(path, blob);};
      export const getBlob = async path => {
        if (!objects.has(path)) throw Object.assign(Error('missing'), {code: 'storage/object-not-found'});
        return objects.get(path);
      };
    `,
    'firebase-firestore.js': `
      let latest;
      window.fixtureCloudWrites = 0;
      export class Bytes {
        static fromUint8Array(bytes) {return new Bytes(bytes);}
        constructor(bytes) {this.bytes = bytes;}
        toUint8Array() {return this.bytes;}
      }
      export const getFirestore = () => ({});
      export const collection = (_, ...path) => path.join('/');
      export const doc = (_, id) => ({id: id || 'version-1'});
      export const runTransaction = async (_, action) => {
        if (window.fixtureFailAuto) throw Object.assign(Error('offline'), {code: 'unavailable'});
        return action({
          get: async ref => ({exists: () => latest?.fixtureId === ref.id, data: () => latest}),
          set: (ref, data) => {latest = {...data, fixtureId: ref.id};window.fixtureCloudWrites++;},
        });
      };
      export const setDoc = async (_, data) => {latest = data;};
      export const query = path => path;
      export const orderBy = () => ({});
      export const limit = () => ({});
      export const serverTimestamp = () => ({toDate: () => new Date()});
      export const addDoc = async (path, data) => {
        if (path !== 'users/fixture/backups') throw Error('Wrong backup account.');
        latest = data;
        window.fixtureCloudWrites++;
      };
      export const getDocsFromServer = async () => ({empty: !latest, docs: [{id: 'version-1', data: () => latest}]});
    `,
  };
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.fulfill({
    contentType: 'application/javascript',
    headers: {'access-control-allow-origin': '*'},
    body: modules[route.request().url().split('/').at(-1)],
  }));
}

test('cloud backup reuses the complete archive and guided restore entry point', async ({page}) => {
  await mockCloud(page);
  const cloud = await openCloud(page);
  // A persisted account is available without pressing sign-in.
  await expect(cloud.getByRole('status')).toHaveText('Signed in as pilot@example.test');

  const before = await page.evaluate(() => localStorage.getItem(STORAGE_KEY));
  await cloud.getByRole('button', {name: 'Back up now'}).click();
  const confirmation = page.getByRole('dialog', {name: 'Save cloud backup'});
  await expect(confirmation).toBeVisible();
  await expect(confirmation.getByRole('button', {name: 'Delete', exact: true})).toHaveCount(0);
  await expect(confirmation.getByRole('button', {name: 'Back up now', exact: true})).not.toHaveClass(/bp-danger/);
  await confirmation.getByRole('button', {name: 'Cancel', exact: true}).click();
  await expect(cloud.getByRole('status')).toHaveText('Cloud backup canceled.');
  expect(await page.evaluate(() => window.fixtureCloudWrites)).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem(STORAGE_KEY))).toBe(before);

  await cloud.getByRole('button', {name: 'Back up now'}).click();
  await confirmation.getByRole('button', {name: 'Back up now', exact: true}).click();
  await expect(cloud.getByRole('status')).toHaveText('Cloud backup saved.');
  expect(await page.evaluate(() => window.fixtureCloudWrites)).toBe(1);
  const restorePrompt = page.waitForEvent('dialog');
  const restoreClick = cloud.getByRole('button', {name: 'Restore latest'}).click();
  const dialog = await restorePrompt;
  expect(dialog.message()).toContain('Replace your current Blueprint data');
  await dialog.dismiss();
  await restoreClick;

  await cloud.getByRole('button', {name: 'Sign out'}).click();
  await expect(cloud.getByRole('status')).toHaveText('Signed out.');
});

for (const phase of ['confirmation', 'staging']) {
  test(`account change during ${phase} leaves the saved planner intact`, async ({page}) => {
    await mockCloud(page);
    const cloud = await openCloud(page);
    await expect(cloud.getByRole('status')).toHaveText('Signed in as pilot@example.test');
    await page.evaluate(async () => {
      state.projects = [{id: 'cloud-source', title: 'Cloud source', notes: [], actions: [],
        library: [{id: 'photo', key: 'cloud-photo', title: 'Photo', type: 'file', mime: 'image/png'}], notePages: []}];
      await v6Blob('put', 'cloud-photo', new Blob(['photo bytes'], {type: 'image/png'}));
      if (!save(true)) throw Error('Fixture save failed');
      BlueprintSheet.confirm = async () => true;
    });
    await cloud.getByRole('button', {name: 'Back up now'}).click();
    await expect(cloud.getByRole('status')).toHaveText('Cloud backup saved.');
    const before = await page.evaluate(phase => {
      state.projects[0].title = 'Keep local edits';
      if (!save(true)) throw Error('Fixture save failed');
      const change = () => {fixtureAuth.currentUser = {uid: 'other'};};
      window.confirm = () => {if (phase === 'confirmation') change(); return true;};
      if (phase === 'staging') {
        const original = v6Blob;
        window.v6Blob = async (...args) => {
          const result = await original(...args);
          if (args[0] === 'put') change();
          return result;
        };
      }
      return localStorage.getItem(STORAGE_KEY);
    }, phase);
    await cloud.getByRole('button', {name: 'Restore latest'}).click();
    await expect(cloud.getByRole('status')).toHaveText('Sign in again to use cloud backups.');
    expect(await page.evaluate(() => localStorage.getItem(STORAGE_KEY))).toBe(before);
    expect(await page.evaluate(() => state.projects[0].title)).toBe('Keep local edits');
  });
}


test('large cloud archive restores attachment bytes and native ink through existing v3 checks', async ({page}) => {
  await page.addInitScript(() => {
    window.stagedInk = [];
    window.Capacitor = {isNativePlatform: () => true, isPluginAvailable: () => true,
      nativePromise: async (_, method, args) => {
        if (method === 'capabilities') return {drawingArchiveVersion: 1};
        if (method === 'exportDrawing') return {base64: btoa('native ink bytes')};
        if (method === 'stageDrawing') {
          stagedInk.push(atob(args.base64));
          return {pageId: 'restored-native-page'};
        }
      }};
  });
  await mockCloud(page, true);
  const cloud = await openCloud(page);
  await expect(cloud.getByRole('status')).toHaveText('Signed in as pilot@example.test');
  await page.evaluate(async () => {
    const bytes = new Uint8Array(800000).fill(27);
    await v6Blob('put', 'large-cloud-photo', new Blob([bytes], {type: 'image/png'}));
    state.projects = [{id: 'cloud-native', title: 'Cloud native project', notes: [], actions: [],
      library: [{id: 'photo', key: 'large-cloud-photo', title: 'Photo', type: 'file', mime: 'image/png'}],
      notePages: [{id: 'native-page', title: 'Ink', strokes: [], objects: []}]}];
    if (!save(true)) throw Error('Fixture save failed');
    BlueprintSheet.confirm = async () => true;
  });
  await cloud.getByRole('button', {name: 'Back up now'}).click();
  await expect(cloud.getByRole('status')).toHaveText('Cloud backup saved.');
  await page.evaluate(() => {
    state.projects[0].title = 'Later local version';
    if (!save(true)) throw Error('Fixture save failed');
  });
  page.on('dialog', dialog => dialog.accept());
  await cloud.getByRole('button', {name: 'Restore latest'}).click();
  await expect.poll(() => page.evaluate(() => state.projects[0].title)).toBe('Cloud native project');
  const result = await page.evaluate(async () => {
    const project = state.projects[0];
    const photo = new Uint8Array(await (await v6Blob('get', project.library[0].key)).arrayBuffer());
    return {size: photo.length, first: photo[0], last: photo.at(-1),
      page: project.notePages[0].id, ink: stagedInk};
  });
  expect(result).toEqual({size: 800000, first: 27, last: 27,
    page: 'restored-native-page', ink: ['native ink bytes']});
});


async function enableAutomatic(page, cloud) {
  await cloud.locator('[data-cloud-auto]').click();
  const prompt = page.getByRole('dialog', {name: 'Automatic backups', exact: true});
  await expect(prompt).toBeVisible();
  await prompt.getByRole('button', {name: 'Enable automatic backups', exact: true}).click();
  await expect(cloud.getByRole('status')).toHaveText('Automatic backups enabled on this device.');
}

test('automatic backups require consent, deduplicate snapshots, follow saved edits and pause for restore', async ({page}) => {
  await page.clock.install({time: new Date('2026-11-25T12:00:00Z')});
  await mockCloud(page);
  const cloud = await openCloud(page);
  await expect(cloud.getByRole('status')).toHaveText('Signed in as pilot@example.test');
  await expect(cloud.locator('[data-cloud-auto]')).not.toBeChecked();
  await page.clock.fastForward(60000);
  expect(await page.evaluate(() => window.fixtureCloudWrites)).toBe(0);
  await enableAutomatic(page, cloud);
  await page.clock.fastForward(31000);
  await expect.poll(() => page.evaluate(() => window.fixtureCloudWrites)).toBe(1);
  await expect(cloud.locator('[data-cloud-auto-status]')).toContainText('Last automatic backup:');
  await page.clock.fastForward(301000);
  await expect(cloud.locator('[data-cloud-auto-status]')).toContainText('No duplicate');
  expect(await page.evaluate(() => window.fixtureCloudWrites)).toBe(1);
  await page.evaluate(() => {state.tasks.push({id: 'auto-task', title: 'Automatic backup fixture', done: false});if (!save(true)) throw Error('Fixture save failed');});
  await page.clock.fastForward(31000);
  await expect.poll(() => page.evaluate(() => window.fixtureCloudWrites)).toBe(2);
  const beforeRestore = await page.evaluate(() => localStorage.getItem(STORAGE_KEY));
  const restoreButton = cloud.getByRole('button', {name: 'Restore latest'});
  // Await cancellation itself, not just the automatic-backup pause which occurs
  // before the asynchronous archive read and confirmation dialog.
  await Promise.all([
    page.waitForEvent('dialog').then(async dialog => {
      expect(dialog.type()).toBe('confirm');
      expect(dialog.message()).toContain('Replace your current Blueprint data');
      await dialog.dismiss();
    }),
    restoreButton.click()
  ]);
  await expect(restoreButton).toBeEnabled();
  await expect(cloud.locator('[data-cloud-auto]')).not.toBeChecked();
  await expect(cloud.locator('[data-cloud-auto-status]')).toContainText('Restore paused');
  expect(await page.evaluate(() => localStorage.getItem(STORAGE_KEY))).toBe(beforeRestore);
  expect(await page.evaluate(() => window.fixtureCloudWrites)).toBe(2);
});

test('automatic pending Blob survives reload and explicit sign-out disables future uploads', async ({page}) => {
  await page.clock.install({time: new Date('2026-11-25T12:00:00Z')});
  await mockCloud(page);
  const cloud = await openCloud(page);
  await expect(cloud.getByRole('status')).toHaveText('Signed in as pilot@example.test');
  await enableAutomatic(page, cloud);
  await page.evaluate(() => {window.fixtureFailAuto = true;});
  await page.clock.fastForward(31000);
  await expect(cloud.locator('[data-cloud-auto-status]')).toContainText('Backup pending');
  const before = await page.evaluate(async () => {
    const {createBackupQueue} = await import('/automatic-cloud-backup.mjs');
    const record = await createBackupQueue().get('test:fixture');
    return {id: record.pending.id, bytes: await record.pending.archive.text()};
  });
  expect(before.bytes).toContain('canvas-complete-backup');
  await page.reload();
  await page.locator('#paletteLauncher').click();
  await expect(cloud.getByRole('status')).toHaveText('Signed in as pilot@example.test');
  await page.clock.fastForward(31000);
  await expect.poll(() => page.evaluate(() => window.fixtureCloudWrites)).toBe(1);
  const after = await page.evaluate(async () => {
    const {createBackupQueue} = await import('/automatic-cloud-backup.mjs');
    return createBackupQueue().get('test:fixture');
  });
  expect(after.pending).toBeNull();
  await cloud.getByRole('button', {name: 'Sign out'}).click();
  await expect(cloud.getByRole('status')).toHaveText('Signed out.');
  await page.reload();
  await page.locator('#paletteLauncher').click();
  await expect(cloud.getByRole('status')).toHaveText('Signed in as pilot@example.test');
  await expect(cloud.locator('[data-cloud-auto]')).not.toBeChecked();
  await page.clock.fastForward(31000);
  expect(await page.evaluate(() => window.fixtureCloudWrites)).toBe(0);
});

test('automatic fingerprints include native-only ink changes even when the planner manifest does not change', async ({page}) => {
  await page.clock.install({time: new Date('2026-11-25T12:00:00Z')});
  await page.addInitScript(() => {
    window.fixtureInk='ink-before';
    window.Capacitor={isNativePlatform:()=>true,isPluginAvailable:()=>true,nativePromise:async(_,method)=>{
      if(method==='capabilities')return {drawingArchiveVersion:1};
      if(method==='exportDrawing')return {base64:btoa(window.fixtureInk)};
    }};
  });
  await mockCloud(page);
  const cloud=await openCloud(page);
  await expect(cloud.getByRole('status')).toHaveText('Signed in as pilot@example.test');
  await page.evaluate(()=>{
    state.projects=[{id:'auto-native-project',title:'Native auto fixture',notes:[],actions:[],library:[],
      notePages:[{id:'ink-page',title:'Ink',strokes:[],objects:[]}]}];
    if(!save(true))throw Error('Fixture save failed');
  });
  const preparation=await page.evaluate(async()=>{try{return {fingerprint:(await v74BuildCloudBackupSnapshot()).fingerprint};}catch(error){return {error:error.message};}});
  expect(preparation).not.toHaveProperty('error');
  await enableAutomatic(page,cloud);
  await page.clock.fastForward(31000);
  await expect(cloud.locator('[data-cloud-auto-status]')).toContainText('Last automatic backup:');
  await expect.poll(()=>page.evaluate(()=>window.fixtureCloudWrites)).toBe(1);
  const before=await page.evaluate(()=>{window.fixtureInk='ink-after';return localStorage.getItem(STORAGE_KEY);});
  await page.clock.fastForward(301000);
  await expect.poll(()=>page.evaluate(()=>window.fixtureCloudWrites)).toBe(2);
  expect(await page.evaluate(()=>localStorage.getItem(STORAGE_KEY))).toBe(before);
});
