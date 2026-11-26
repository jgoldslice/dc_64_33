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
    'firebase-firestore.js': `
      export const getFirestore = () => {throw Error('Native must initialize its transport explicitly');};
      export const initializeFirestore = (_, options) => {
        window.__nativeFirestoreOptions = options;
        return {};
      };
    `,
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
  expect(await page.evaluate(()=>window.__nativeFirestoreOptions)).toEqual({experimentalForceLongPolling:true});
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

test('native range downloader transfers a 21.4 MiB fixture with authenticated progress', async ({page}) => {
  const size=Math.floor(21.4*1024*1024), progress=[], ranges=[];
  await page.route('https://firebasestorage.googleapis.com/**', async route => {
    const headers={'access-control-allow-origin':'*','access-control-allow-methods':'GET, OPTIONS',
      'access-control-allow-headers':'Authorization, Range','access-control-expose-headers':'Content-Range'};
    if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
    const request=route.request().headers();
    expect(request.authorization).toBe('Firebase fixture-token');
    const [,a,b]=/bytes=(\d+)-(\d+)/.exec(request.range),start=Number(a),end=Number(b);
    ranges.push([start,end]);
    return route.fulfill({status:206,headers:{...headers,'content-range':`bytes ${start}-${end}/${size}`},
      body:Buffer.alloc(end-start+1,Math.floor(start/(1024*1024))+1)});
  });
  await page.goto('/');
  const result=await page.evaluate(async size=>{
    const {downloadBackupChunks}=await import('/blueprint-cloud-backup.mjs');
    const progress=[];
    const bytes=await downloadBackupChunks({user:{getIdToken:async()=> 'fixture-token'},
      file:{bucket:'fixture.test',fullPath:'users/fixture/backups/test/archive.json'},size,
      assertAccount:()=>{},onProgress:loaded=>progress.push(loaded)});
    return {size:bytes.length,first:bytes[0],last:bytes.at(-1),progress};
  },size);
  expect(result.size).toBe(size);
  expect(result.first).toBe(1);
  expect(result.last).toBe(22);
  expect(result.progress.at(-1)).toBe(size);
  expect(ranges.length).toBe(22);
});
