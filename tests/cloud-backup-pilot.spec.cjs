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

test('cloud backup reuses the complete archive and guided restore entry point', async ({page}) => {
  await page.route('**/firebase-client.json', route => route.fulfill({
    json: {apiKey: 'test', authDomain: 'example.test', projectId: 'test', appId: 'test'},
  }));
  const modules = {
    'firebase-app.js': 'export const getApps = () => []; export const initializeApp = () => ({});',
    'firebase-auth.js': `
      const auth = {currentUser: {uid: 'fixture', email: 'pilot@example.test'}, authStateReady: async () => {}};
      globalThis.__cloudTestAuth = auth;
      export const getAuth = () => auth;
      export const onAuthStateChanged = (_, listener) => listener(auth.currentUser);
      export const signOut = async () => {auth.currentUser = null;};
    `,
    'firebase-firestore.js': `
      let latest;
      export class Bytes {
        static fromUint8Array(bytes) {return new Bytes(bytes);}
        constructor(bytes) {this.bytes = bytes;}
        toUint8Array() {return this.bytes;}
      }
      export const getFirestore = () => ({});
      export const collection = (_, ...path) => path.join('/');
      export const query = path => path;
      export const orderBy = () => ({});
      export const limit = () => ({});
      export const serverTimestamp = () => ({toDate: () => new Date()});
      export const addDoc = async (path, data) => {
        if (path !== 'users/fixture/backups') throw Error('Wrong backup account.');
        latest = data;
      };
      export const getDocsFromServer = async () => ({empty: !latest, docs: [{data: () => latest}]});
    `,
  };
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.fulfill({
    contentType: 'application/javascript',
    headers: {'access-control-allow-origin': '*'},
    body: modules[route.request().url().split('/').at(-1)],
  }));
  const cloud = await openCloud(page);
  await cloud.getByRole('button', {name: 'Continue with Google'}).click();
  await expect(cloud.getByRole('status')).toHaveText('Signed in as pilot@example.test');

  await page.evaluate(() => {BlueprintSheet.confirm = async () => true;});
  await cloud.getByRole('button', {name: 'Back up now'}).click();
  await expect(cloud.getByRole('status')).toHaveText('Cloud backup saved.');
  const restorePrompt = page.waitForEvent('dialog');
  const restoreClick = cloud.getByRole('button', {name: 'Restore latest'}).click();
  const dialog = await restorePrompt;
  expect(dialog.message()).toContain('Replace your current Blueprint data');
  await dialog.dismiss();
  await restoreClick;

  // A different account must never receive a backup authorized for the
  // original account, even if the change occurs during confirmation.
  await page.evaluate(() => {
    BlueprintSheet.confirm = async () => {
      globalThis.__cloudTestAuth.currentUser = {uid: 'other', email: 'other@example.test'};
      return true;
    };
  });
  await cloud.getByRole('button', {name: 'Back up now'}).click();
  await expect(cloud.getByRole('status')).toHaveText('Sign in again to use cloud backups.');

  // The downloaded archive still belongs to fixture; changing accounts at
  // the replacement confirmation must prevent the local manifest commit.
  await page.evaluate(() => {
    globalThis.__cloudTestAuth.currentUser = {uid: 'fixture', email: 'pilot@example.test'};
    window.confirm = () => {
      globalThis.__cloudTestAuth.currentUser = {uid: 'other', email: 'other@example.test'};
      return true;
    };
    window.__cloudRestoreAlerts = [];
    window.alert = message => window.__cloudRestoreAlerts.push(message);
  });
  await cloud.getByRole('button', {name: 'Restore latest'}).click();
  await expect(cloud.getByRole('status')).toHaveText('Sign in again to use cloud backups.');
  expect(await page.evaluate(() => window.__cloudRestoreAlerts)).toEqual([]);

  await cloud.getByRole('button', {name: 'Sign out'}).click();
  await expect(cloud.getByRole('status')).toHaveText('Signed out.');
});
