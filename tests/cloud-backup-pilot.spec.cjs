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
      const rows = new Map([['users/fixture/events/r-700', {id:'700',revision:1,record:{id:'700',title:'Cloud appointment',date:'2026-11-25',time:'14:00'}}]]);
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
      export const getDocsFromServer = async path => {
        if (path.endsWith('/backups') && window.__cloudTestStage === 'list') {
          await new Promise(resolve => {window.__releaseBackupList = resolve;});
        }
        if (path.endsWith('/backups')) return {empty: !latest, docs: [{id: 'backup-1', data: () => latest}]};
        const docs = [...rows].filter(([key])=>key.startsWith(path+'/'))
          .map(([key,data])=>({id:key.split('/').at(-1),data:()=>data}));
        return {empty:!docs.length,docs};
      };
      export const doc = (_, ...parts) => parts.length ? parts.join('/') : {id:'backup-1'};
      export const setDoc = async (_, data) => {latest = data;};
      export const runTransaction = async (_, fn) => fn({
        get:async path=>({exists:()=>rows.has(path),id:path.split('/').at(-1),data:()=>rows.get(path)}),
        set:(path,data)=>rows.set(path,data)
      });
    `,
    'firebase-storage.js': `
      const files = new Map();
      export const getStorage = () => ({});
      export const ref = (_, path) => path;
      export function uploadBytesResumable(path, bytes, metadata) {
        files.set(path, {bytes: new Uint8Array(bytes), ...metadata});
        const task = Promise.resolve();
        task.cancel = () => true;
        task.on = (_, listener) => {
          listener({bytesTransferred:bytes.length,totalBytes:bytes.length});
          return () => {};
        };
        return task;
      }
      export const getMetadata = async path => {
        if (window.__cloudTestStage === 'metadata') await new Promise(()=>{});
        return {size:files.get(path).bytes.length,contentType:files.get(path).contentType};
      };
      export const getBytes = async path => {
        if (window.__cloudTestStage === 'download') await new Promise(()=>{});
        return files.get(path).bytes.buffer;
      };
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

  await cloud.getByRole('button', {name: 'Back up now'}).click();
  const sheet = page.locator('#bpSheet');
  await expect(sheet.getByRole('heading')).toHaveText('Confirm cloud backup');
  await expect(sheet.getByRole('button', {name:'Back up now', exact:true})).toBeVisible();
  await expect(sheet.locator('.bp-danger')).toHaveCount(0);
  await sheet.getByRole('button', {name:'Cancel', exact:true}).click();
  await expect(cloud.getByRole('status')).toHaveText('Cloud backup canceled.');

  await page.evaluate(() => {
    state.tasks=[{id:800,title:'Standalone task',done:false,date:'',dueDate:'',scheduledDate:'',scheduledTime:'',priority:false,priorityRank:0}];
    state.events=[];
    if(!save(true))throw Error('Fixture save failed');
  });
  await cloud.getByRole('button', {name:'Preview planner sync'}).click();
  await expect(cloud.getByRole('status')).toHaveText('Preview ready. Review changes before applying.');
  await expect(cloud.locator('[data-cloud-summary]')).toContainText('1 upload(s), 1 download(s), 0 conflict(s)');
  expect(await page.evaluate(()=>state.events.length)).toBe(0);
  await cloud.getByRole('button', {name:'Apply reviewed sync'}).click();
  await expect(sheet.getByRole('heading')).toHaveText('Confirm planner sync');
  await expect(sheet.locator('.bp-danger')).toHaveCount(0);
  await sheet.getByRole('button', {name:'Apply sync', exact:true}).click();
  await expect(cloud.getByRole('status')).toHaveText('Sync complete: 1 uploaded, 1 downloaded.');
  expect(await page.evaluate(()=>state.events.map(e=>e.title))).toEqual(['Cloud appointment']);
  await cloud.getByRole('button', {name:'Preview planner sync'}).click();
  await expect(cloud.locator('[data-cloud-summary]')).toContainText('0 upload(s), 0 download(s), 0 conflict(s)');
  await cloud.getByRole('button', {name: 'Back up now'}).click();
  await sheet.getByRole('button', {name:'Back up now', exact:true}).click();
  await expect(cloud.getByRole('status')).toHaveText('Cloud backup saved.');
  const beforeRestore = await page.evaluate(()=>JSON.stringify(state));
  await page.clock.install();
  for (const [stage, progress, elapsed, error] of [
    ['list','Looking for your latest cloud backup…',20001,'cloud backup list did not respond'],
    ['metadata','Checking the backup file…',20001,'backup file did not respond'],
    ['download','Downloading complete backup…',180001,'backup download timed out'],
  ]) {
    await page.evaluate(stage=>{window.__cloudTestStage=stage;},stage);
    await cloud.getByRole('button',{name:'Restore latest'}).click();
    await expect(cloud.getByRole('status')).toContainText(progress);
    await page.clock.fastForward(elapsed);
    await expect(cloud.getByRole('status')).toContainText(error);
    await expect(cloud.getByRole('button',{name:'Restore latest'})).toBeEnabled();
    expect(await page.evaluate(()=>JSON.stringify(state))).toBe(beforeRestore);
    if(stage==='list') {
      await page.evaluate(()=>window.__releaseBackupList());
      await expect(cloud.getByRole('status')).toContainText(error);
    }
  }
  await page.evaluate(()=>{window.__cloudTestStage='';});
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
