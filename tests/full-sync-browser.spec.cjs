const {test,expect}=require('@playwright/test');
test.use({browserName:process.env.BLUEPRINT_SYNC_BROWSER||'chromium'});
test.setTimeout(120000);
function cloudBackend(){
  const docs=new Map(),files=new Map(),uploads=new Map();
  async function call(_,operation,payload){
    if(operation==='get')return docs.get(payload)||null;
    if(operation==='transaction'){
      for(const [path,expected] of Object.entries(payload.reads))if(JSON.stringify(docs.get(path)||null)!==JSON.stringify(expected))return false;
      for(const [path,value] of Object.entries(payload.writes))docs.set(path,value);return true;
    }
    if(operation==='put'){
      if(files.has(payload.path))throw Error('immutable object');
      files.set(payload.path,payload);uploads.set(payload.path,(uploads.get(payload.path)||0)+1);return;
    }
    if(operation==='file')return files.get(payload)||null;
    throw Error('Unexpected fake cloud request');
  }
  return {call,docs,files,uploads};
}
async function connected(context,backend){
  if(process.env.BLUEPRINT_SYNC_BROWSER==='webkit')await context.addInitScript(()=>{
    // This Mac's Playwright WebKit cannot persist Blob values. Keep actual
    // IndexedDB durability/relaunch, using typed arrays only for this fixture.
    document.addEventListener('DOMContentLoaded',()=>{
      const original=window.v6Blob;
      window.v6Blob=async(mode,key,value)=>{
        if(mode==='put'&&value instanceof Blob)
          return original(mode,key,{fixtureBlob:true,mime:value.type,bytes:new Uint8Array(await value.arrayBuffer())});
        const stored=await original(mode,key,value);
        return mode==='get'&&stored?.fixtureBlob?new Blob([stored.bytes],{type:stored.mime}):stored;
      };
    },{once:true});
  });
  await context.exposeBinding('__syncCloud',backend.call);
  await context.route('**/firebase-client.json',route=>route.fulfill({json:{apiKey:'fixture',authDomain:'fixture.test',projectId:'sync-fixture',appId:'fixture',storageBucket:'fixture.test'}}));
  const modules={
    'firebase-app.js':'export const getApps=()=>[];export const initializeApp=()=>({});',
    'firebase-auth.js':`
      let listener;const auth={currentUser:localStorage.getItem('__fixture-auth')?{uid:'fixture',email:'sync@example.test'}:null,authStateReady:async()=>{}};
      export const getAuth=()=>auth;
      export const onAuthStateChanged=(_,fn)=>{listener=fn;fn(auth.currentUser);};
      export class GoogleAuthProvider {setCustomParameters(){}}
      export const signInWithPopup=async()=>{localStorage.setItem('__fixture-auth','1');auth.currentUser={uid:'fixture',email:'sync@example.test'};listener(auth.currentUser);};
      export const signOut=async()=>{localStorage.removeItem('__fixture-auth');auth.currentUser=null;listener(null);};`,
    'firebase-firestore.js':`
      export const getFirestore=()=>({});
      export const doc=(_, ...parts)=>parts.join('/');
      export const serverTimestamp=()=>0;
      const snap=value=>({exists:()=>value!==null,data:()=>value,metadata:{fromCache:false}});
      export const getDocFromServer=async ref=>snap(await window.__syncCloud('get',ref));
      export const runTransaction=async(_,callback)=>{
        const reads={},writes={};
        const result=await callback({get:async ref=>{const data=await window.__syncCloud('get',ref);reads[ref]=data;return snap(data);},set:(ref,value)=>{writes[ref]=value;}});
        if(!await window.__syncCloud('transaction',{reads,writes}))throw Error('Cloud changed; retry');return result;
      };
      export const onSnapshot=(ref,options,next,failed)=>{
        let previous='';let stopped=false;
        const poll=async()=>{try{const value=await window.__syncCloud('get',ref);const text=JSON.stringify(value);if(!stopped&&text!==previous){previous=text;next(snap(value));}}catch(error){if(!stopped)failed(error);}};
        const timer=setInterval(poll,300);poll();return()=>{stopped=true;clearInterval(timer);};
      };`,
    'firebase-storage.js':`
      export const getStorage=()=>({});
      export const ref=(_,path)=>path;
      export const getMetadata=async path=>{const f=await window.__syncCloud('file',path);if(!f)throw Object.assign(Error('missing'),{code:'storage/object-not-found'});return {size:f.bytes.length,contentType:f.type};};
      export const getBytes=async path=>new Uint8Array((await window.__syncCloud('file',path)).bytes).buffer;
      export const uploadBytesResumable=(path,bytes,metadata)=>{
        const task=window.__syncCloud('put',{path,bytes:Array.from(bytes),type:metadata.contentType});task.cancel=()=>{};task.on=()=>()=>{};return task;
      };`,
  };
  await context.route('https://www.gstatic.com/firebasejs/**',route=>route.fulfill({contentType:'application/javascript',headers:{'access-control-allow-origin':'*'},body:modules[route.request().url().split('/').at(-1)]}));
  const page=await context.newPage();page.runtimeErrors=[];page.on('pageerror',error=>page.runtimeErrors.push({message:error.message,stack:error.stack}));await page.goto('/');
  return page;
}
async function signIn(page){
  await page.getByRole('button',{name:'Customize colors',exact:true}).click({timeout:10000});
  await page.locator('[data-cloud-sign-in]').click({timeout:10000});
  // A slow SDK load can deliberately require a second user gesture.
  if(await page.locator('#blueprint-cloud-backup > [role="status"]').textContent()==='Google sign-in is ready. Tap Continue with Google.')await page.locator('[data-cloud-sign-in]').click();
  await expect(page.locator('[data-full-sync-start]')).toBeEnabled();
}
async function seedInk(page){
  await page.evaluate(async()=>{
    state.tasks=[{id:'t',title:'Original task',done:false}];state.events=[];state.habits=[{id:'h',title:'Study',days:{}}];state.goals=[];state.ideas=[];state.weeklyGoals=[];
    state.projects=[{id:'p',title:'Shared Notes',notes:[],actions:[],library:[],contentBlocks:[],notePages:[{id:'ink',title:'Writing',height:900,objects:[{id:'text',type:'text',html:'Original text',x:20,y:20,width:210}],strokes:[]}]}];save(true);
    const c=document.createElement('canvas');c.width=100;c.height=100;c.getContext('2d').fillRect(5,5,50,4);
    const png=c.toDataURL('image/png').split(',')[1];
    await v6Blob('put','sync-fixture-photo',new Blob([Uint8Array.from(atob(png),ch=>ch.charCodeAt(0))],{type:'image/png'}));
    state.projects[0].library.push({id:'photo',title:'Photo',type:'file',key:'sync-fixture-photo',mime:'image/png'});save(true);
    const archive=JSON.parse(await (await v74BuildCompleteBackup()).text());
    archive.version=3;archive.drawings=[{projectId:'p',pageId:'ink',base64:'YWJj',preview:{base64:png,width:500,height:900}}];
    archive.drawingsSha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(archive.drawings)))),b=>b.toString(16).padStart(2,'0')).join('');
    window.confirm=()=>true;window.alert=()=>{};
    if(!await v74ImportBackup(new Blob([JSON.stringify(archive)])))throw Error('fixture import failed');
  });
}
async function confirmSetup(page,selector){
  await page.locator(selector).click();await page.locator('#bpSheet button[type="submit"]').click();
  await expect(page.locator('[data-full-sync-status]')).toContainText('Up to date',{timeout:20000});
}

test('two devices automatically exchange full notes and habit edits, preserve ink, survive relaunch and pause on import',async({browser})=>{
  const backend=cloudBackend();
  const a=await browser.newContext({viewport:{width:1180,height:900},baseURL:'http://127.0.0.1:8765/'});
  const b=await browser.newContext({viewport:{width:1180,height:900},baseURL:'http://127.0.0.1:8765/'});
  try{
    const first=await connected(a,backend),second=await connected(b,backend);
    await seedInk(first);await signIn(first);await signIn(second);
    await confirmSetup(first,'[data-full-sync-start]');
    await confirmSetup(second,'[data-full-sync-join]');
    await expect.poll(()=>second.evaluate(()=>state.projects[0]?.title)).toBe('Shared Notes');
    const sourcePage=await first.evaluate(()=>state.projects[0].notePages[0].id);
    const receivingPage=await second.evaluate(()=>state.projects[0].notePages[0].id);
    await a.setOffline(true);
    await first.evaluate(()=>{state.projects[0].notePages[0].objects[0].html='Offline note edit';save(true);});
    const previousRevision=backend.docs.get('users/fixture/sync/current').revision;
    await second.evaluate(()=>{state.habits[0].days['2026-11-26']=true;save(true);});
    await expect.poll(()=>backend.docs.get('users/fixture/sync/current').revision,{timeout:15000}).toBeGreaterThan(previousRevision);
    // Reload the offline writer once connected: durable edits and consent survive.
    await a.setOffline(false);await first.reload();
    await expect.poll(()=>second.evaluate(()=>state.projects[0].notePages[0].objects[0].html),{timeout:25000}).toBe('Offline note edit');
    await expect.poll(()=>first.evaluate(()=>state.habits[0].days['2026-11-26']),{timeout:25000}).toBe(true);
    const archive=await second.evaluate(async()=>JSON.parse(await (await v74BuildCompleteBackup()).text()));
    expect(archive.attachments.some(file=>file.mime==='image/png'&&file.size>0)).toBe(true);
    expect(archive.drawings[0].base64).toBe('YWJj');expect(archive.drawings[0].preview).toBeTruthy();
    expect([...backend.uploads.values()].every(n=>n===1)).toBe(true);
    await second.locator('#closeCustomize').click();
    await second.locator('[data-tab="brainstorm"]').click();await second.locator('[data-v6-project="p"]').click();await second.locator('[data-v919-project-open="notes"]').click();
    await expect(second.locator('[data-browser-ink-preview]')).toBeVisible();
    expect(await first.evaluate(()=>state.projects[0].notePages[0].id)).toBe(sourcePage);
    expect(await second.evaluate(()=>state.projects[0].notePages[0].id)).toBe(receivingPage);
    await second.locator('[data-v76-mode="pen"]').click();
    await first.evaluate(()=>{state.tasks[0].title='Changed while Notes stays open';save(true);});
    await expect.poll(()=>second.evaluate(()=>state.tasks[0].title),{timeout:20000}).toBe('Changed while Notes stays open');
    expect(await second.evaluate(()=>BlueprintNotesBridge.getMode())).toBe('pen');
    expect(await second.evaluate(()=>state.projects[0].notePages[0].id)).toBe(receivingPage);
    await second.evaluate(()=>window.dispatchEvent(new Event('blueprint:before-import')));
    expect(await second.evaluate(()=>JSON.parse(localStorage.getItem('blueprint-full-sync-device-v1')).enabled)).toBe(false);
    expect(first.runtimeErrors).toEqual([]);expect(second.runtimeErrors).toEqual([]);
  }finally{await a.close();await b.close();}
});

test('setup cancellation, sign-out and overlapping edits never silently replace the planner',async({browser})=>{
  const backend=cloudBackend();const a=await browser.newContext({baseURL:'http://127.0.0.1:8765/'}),b=await browser.newContext({baseURL:'http://127.0.0.1:8765/'});
  try{
    const first=await connected(a,backend),second=await connected(b,backend);await seedInk(first);await signIn(first);await signIn(second);
    await first.locator('[data-full-sync-start]').click();await first.locator('#bpSheet button[type="button"]').click();
    expect(backend.docs.size).toBe(0);expect(await first.evaluate(()=>localStorage.getItem('blueprint-full-sync-device-v1'))).toBeNull();
    await confirmSetup(first,'[data-full-sync-start]');await confirmSetup(second,'[data-full-sync-join]');
    await a.setOffline(true);await first.evaluate(()=>{state.tasks[0].title='Device wording';save(true);});
    await second.evaluate(()=>{state.tasks[0].title='Shared wording';save(true);});
    await expect.poll(()=>backend.docs.get('users/fixture/sync/current')?.revision,{timeout:15000}).toBeGreaterThan(1);
    await a.setOffline(false);
    await expect(first.locator('[data-full-sync-conflicts]')).toBeVisible({timeout:20000});
    expect(await first.evaluate(()=>state.tasks[0].title)).toBe('Device wording');
    expect(await second.evaluate(()=>state.tasks[0].title)).toBe('Shared wording');
    await first.locator('[data-full-sync-choice="cloud"]').click();await first.locator('#bpSheet button[type="submit"]').click();
    await expect.poll(()=>first.evaluate(()=>state.tasks[0].title),{timeout:15000}).toBe('Shared wording');
    await first.locator('[data-cloud-sign-out]').click();
    await second.evaluate(()=>{state.tasks[0].title='After sign-out';save(true);});
    await expect.poll(()=>backend.docs.get('users/fixture/sync/current')?.revision,{timeout:15000}).toBeGreaterThan(2);
    expect(await first.evaluate(()=>state.tasks[0].title)).toBe('Shared wording');
    expect(first.runtimeErrors).toEqual([]);expect(second.runtimeErrors).toEqual([]);
  }finally{await a.close();await b.close();}
});

test('an older native drawing bridge cannot enable incomplete handwriting sync',async({browser})=>{
  const backend=cloudBackend(),context=await browser.newContext({baseURL:'http://127.0.0.1:8765/'});
  try{
    const page=await connected(context,backend);await signIn(page);
    await page.setViewportSize({width:320,height:740});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.locator('[data-full-sync]').screenshot({path:require('node:path').join(__dirname,'../test-results/sync-setup-320.png')});
    await page.evaluate(()=>{window.Capacitor={isNativePlatform:()=>true,nativePromise:async()=>({drawingArchiveVersion:1})};});
    await page.locator('[data-full-sync-start]').click();
    await expect(page.locator('[data-full-sync-status]')).toContainText('Install the new Blueprint iOS build');
    expect(await page.evaluate(()=>localStorage.getItem('blueprint-full-sync-device-v1'))).toBeNull();
    expect(backend.docs.size).toBe(0);
  }finally{await context.close();}
});
