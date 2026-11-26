const {test, expect} = require('@playwright/test');

async function openNativeCloud(page, mode = '') {
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(mode => {
    window.__authTestMode = mode;
    window.Capacitor = {
      isNativePlatform: () => true,
      isPluginAvailable: name => name === 'BlueprintGoogleSignIn',
      nativePromise: async (name, method) => {
        if (name !== 'BlueprintGoogleSignIn' || method !== 'signIn') throw Error('Unexpected native call');
        if (window.__authTestMode === 'native-stall') return new Promise(() => {});
        if (window.__authTestMode === 'cancel') throw Error('Google sign-in canceled.');
        return {idToken:'fixture-id',accessToken:'fixture-access'};
      },
    };
  }, mode);
  await page.route('**/firebase-client.json', route => route.fulfill({json:{
    apiKey:'fixture',authDomain:'fixture.test',projectId:'fixture',appId:'fixture',storageBucket:'fixture.test',
  }}));
  const modules = {
    'firebase-app.js': 'export const getApps = () => []; export const initializeApp = () => ({});',
    'firebase-auth.js': `
      let notify;
      const auth = {currentUser:null,authStateReady:() => window.__authTestMode === 'auth-stall' ? new Promise(()=>{}) : Promise.resolve()};
      export const indexedDBLocalPersistence = 'indexedDB';
      export const browserLocalPersistence = 'localStorage';
      export const initializeAuth = (_, options) => {
        window.__nativeAuthOptions = options;
        if ('popupRedirectResolver' in options) throw Error('Native must not initialize browser redirects');
        return auth;
      };
      export const getAuth = () => {throw Error('Browser auth initialized in native app');};
      export const onAuthStateChanged = (_, listener) => {notify = listener; listener(auth.currentUser); return () => {};};
      export const GoogleAuthProvider = {credential:(idToken,accessToken)=>({idToken,accessToken})};
      export const signInWithCredential = async (_, credential) => {
        if (credential.idToken !== 'fixture-id') throw Error('Wrong credential');
        auth.currentUser={uid:'fixture',email:'native@example.test'};
        notify(auth.currentUser);
      };
    `,
    'firebase-firestore.js': 'export const getFirestore = () => ({});',
    'firebase-storage.js': 'export const getStorage = () => ({});',
  };
  await page.route('https://www.gstatic.com/firebasejs/**', route => {
    if (mode === 'sdk-stall') return;
    return route.fulfill({contentType:'application/javascript',headers:{'access-control-allow-origin':'*'},
      body:modules[route.request().url().split('/').at(-1)]});
  });
  await page.goto('/');
  await page.locator('#paletteLauncher').click();
  const cloud = page.locator('#blueprint-cloud-backup');
  await expect(cloud.getByRole('button',{name:'Continue with Google'})).toBeEnabled();
  return cloud;
}

test('native sign-in omits browser redirects and completes credential exchange', async ({page}) => {
  const cloud=await openNativeCloud(page);
  await cloud.getByRole('button',{name:'Continue with Google'}).click();
  await expect(cloud.getByRole('status')).toHaveText('Signed in as native@example.test');
  expect(await page.evaluate(()=>window.__nativeAuthOptions)).toEqual({persistence:['indexedDB','localStorage']});
});

test('stalled saved sign-in releases the button and can be retried', async ({page}) => {
  const cloud=await openNativeCloud(page,'auth-stall');
  await page.clock.install();
  const signIn=cloud.getByRole('button',{name:'Continue with Google'});
  await signIn.click();
  await expect(cloud.getByRole('status')).toHaveText('Checking saved sign-in…');
  await page.clock.fastForward(20001);
  await expect(cloud.getByRole('status')).toContainText('Saved sign-in did not respond');
  await expect(signIn).toBeEnabled();
  await page.evaluate(()=>{window.__authTestMode='';});
  await signIn.click();
  await expect(cloud.getByRole('status')).toHaveText('Signed in as native@example.test');
});

test('stalled native bridge reports its stage and eventually releases the button', async ({page}) => {
  const cloud=await openNativeCloud(page,'native-stall');
  await page.clock.install();
  const signIn=cloud.getByRole('button',{name:'Continue with Google'});
  await signIn.click();
  await expect(cloud.getByRole('status')).toHaveText('Opening Google sign-in…');
  await page.clock.fastForward(120001);
  await expect(cloud.getByRole('status')).toContainText('Google sign-in did not respond');
  await expect(signIn).toBeEnabled();
});

test('a stalled SDK download gives a connection error rather than endless Working', async ({page}) => {
  const cloud=await openNativeCloud(page,'sdk-stall');
  await page.clock.install();
  const signIn=cloud.getByRole('button',{name:'Continue with Google'});
  await signIn.click();
  await expect(cloud.getByRole('status')).toHaveText('Connecting to Google services…');
  await page.clock.fastForward(30001);
  await expect(cloud.getByRole('status')).toContainText('Google services did not load');
  await expect(signIn).toBeEnabled();
});

test('native cancellation leaves sign-in available', async ({page}) => {
  const cloud=await openNativeCloud(page,'cancel');
  const signIn=cloud.getByRole('button',{name:'Continue with Google'});
  await signIn.click();
  await expect(cloud.getByRole('status')).toHaveText('Google sign-in canceled.');
  await expect(signIn).toBeEnabled();
});
