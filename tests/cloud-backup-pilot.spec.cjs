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
      export const getBlob = async path => objects.get(path);
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
      export const doc = () => ({id: 'version-1'});
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
