import {createFullSyncStore} from './full-sync-store.mjs';
import {createFullSyncEngine,SyncConflict} from './full-sync-engine.mjs';
import {createFullSyncLocal,syncCheckpoint} from './full-sync-local.mjs';
const preferenceKey='blueprint-full-sync-device-v1';
export function installFullSync(card,{getClient,downloadChunks}){
  const section=card.parentElement.querySelector('[data-full-sync]');
  const status=section.querySelector('[data-full-sync-status]');
  const start=section.querySelector('[data-full-sync-start]');
  const join=section.querySelector('[data-full-sync-join]');
  const pause=section.querySelector('[data-full-sync-pause]');
  const resume=section.querySelector('[data-full-sync-resume]');
  const recovery=section.querySelector('[data-full-sync-recovery]');
  const conflicts=section.querySelector('[data-full-sync-conflicts]');
  let client=null,session=null,timer=null,unsubscribe=null,dirty=true,busy=false,externalBusy=false,review=null;
  function readPreference(){
    const raw=localStorage.getItem(preferenceKey);
    if(raw===null)return {raw,value:null};
    const value=JSON.parse(raw);
    if(value.version!==1||typeof value.uid!=='string'||typeof value.projectId!=='string'||
      typeof value.generation!=='string'||typeof value.enabled!=='boolean'||typeof value.paired!=='boolean'||
      !['source','join'].includes(value.mode))throw Error('Sync setup could not be read. Preserve local data before recovery.');
    return {raw,value};
  }
  function writePreference(value,expected){
    if(localStorage.getItem(preferenceKey)!==expected)throw Error('Sync setup changed in another window.');
    const raw=JSON.stringify(value);localStorage.setItem(preferenceKey,raw);
    if(localStorage.getItem(preferenceKey)!==raw)throw Error('Sync setup could not be saved.');return raw;
  }
  function stop(){if(timer)clearTimeout(timer);timer=null;unsubscribe?.();unsubscribe=null;session=null;review=null;conflicts.hidden=true;}
  function render(){
    try{
      const pref=readPreference().value,account=client?.auth.currentUser;
      const matches=!!account&&pref?.uid===account.uid&&pref?.projectId===client.projectId&&
        pref?.generation===globalThis.BlueprintFullSyncLocal.generation();
      start.hidden=join.hidden=!!pref?.enabled;
      pause.hidden=!pref?.enabled;resume.hidden=!pref||pref.enabled||!matches;
      for(const b of [start,join,resume])b.disabled=busy||externalBusy||!account;
      pause.disabled=false;
      recovery.hidden=!localStorage.getItem('blueprint-sync-last-recovery');
      if(!account&&!busy)status.textContent='Sign in above to set up automatic sync.';
      else if(pref&&(!matches)&&!busy)status.textContent='Sync is paused: this device’s planner or account changed. Set up this device again to continue.';
    }catch(error){status.textContent=error.message;for(const b of [start,join,resume])b.disabled=true;}
  }
  function schedule(delay=4000){
    dirty=true;if(timer)clearTimeout(timer);
    timer=setTimeout(()=>{timer=null;void tick();},delay);
  }
  function makeSession(pref){
    const account=client.auth.currentUser;
    const current={account,raw:pref.raw,value:pref.value,store:null,engine:null};
    const guard=()=>{
      if(session!==current||client.auth.currentUser!==account||!current.value.enabled||
        localStorage.getItem(preferenceKey)!==current.raw||
        globalThis.BlueprintFullSyncLocal.generation()!==current.value.generation)throw Error('Sync was paused or the account changed.');
    };
    session=current;
    const store=createFullSyncStore({...client,downloadChunks,assertActive:guard});
    const local=createFullSyncLocal();
    const scope=JSON.stringify([client.projectId,account.uid,pref.value.generation]);
    current.scope=scope;current.store=store;current.local=local;
    current.engine=createFullSyncEngine({store,local,checkpoint:syncCheckpoint(scope,guard),assertActive:guard});
    current.guard=guard;
    unsubscribe=store.watch(()=>schedule(1000),error=>{if(session===current)status.textContent='Sync could not connect. '+error.message;});
    return current;
  }
  async function tick(resolution){
    if(busy||externalBusy||!session||(!dirty&&!resolution))return;
    const current=session;
    if(document.visibilityState==='hidden'||navigator.onLine===false){status.textContent='Offline. Changes are saved here and will sync when Blueprint reconnects.';return;}
    if(!globalThis.BlueprintFullSyncLocal.idle()){schedule();return;}
    if(review&&!resolution)return;
    busy=true;render();status.textContent='Syncing…';
    try{
      await navigator.locks.request('blueprint-full-sync:'+current.scope,{ifAvailable:true},async lock=>{
        if(!lock){dirty=true;status.textContent='Another Blueprint window is syncing. Waiting…';return;}
        current.guard();
        if(!current.value.paired){
          await current.engine.start(current.value.mode);current.guard();
          current.value={...current.value,paired:true};
          current.raw=writePreference(current.value,current.raw);
        }else await current.engine.cycle(resolution);
        current.guard();dirty=false;review=null;conflicts.hidden=true;
        status.textContent='Up to date · '+new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});
      });
    }catch(error){
      if(session!==current)return;
      dirty=true;
      if(error instanceof SyncConflict){
        review=error;conflicts.hidden=false;
        status.textContent=error.conflicts.length+' overlapping edit(s) need review. Both versions have been kept.';
      }else status.textContent=navigator.onLine===false?'Offline. Changes are saved here and will retry when connected.':error.message;
    }finally{busy=false;render();}
  }
  async function ensureNative(){
    if(!globalThis.Capacitor?.isNativePlatform?.())return;
    const cap=await globalThis.Capacitor.nativePromise('BlueprintPencil','capabilities',{});
    if(cap.syncDrawingEventsVersion!==1)throw Error('Install the new Blueprint iOS build before enabling handwriting sync.');
  }
  async function setup(mode){
    if(busy)return;
    busy=true;render();
    try{
      const connected=await getClient();await connected.auth.authStateReady();client=connected;
      if(!client.auth.currentUser)throw Error('Sign in above before setting up sync.');
      const account=client.auth.currentUser;
      await ensureNative();
      if(!navigator.locks)throw Error('This browser cannot coordinate sync safely. Use a current Safari or Chrome browser.');
      if(!globalThis.BlueprintFullSyncLocal.saved())throw Error('Save current edits before setting up sync.');
      const old=readPreference();
      if(old.value&&old.value.uid!==account.uid)throw Error('This planner was paired with another account. Sign back into that account before syncing.');
      const accepted=await globalThis.BlueprintSheet.confirm(mode==='source'
        ?'Start a shared planner from this device? Saved changes, notes, images and handwriting will sync to this Google account. A local recovery copy will be kept first.'
        :'Use the shared planner on this device? This replaces this device’s starting planner once, after keeping a complete local recovery copy. Future changes will merge automatically.',
        mode==='source'?'Start sync':'Join shared planner','Set up automatic sync');
      if(!accepted)return;
      if(client.auth.currentUser!==account)throw Error('The account changed. Set up sync again.');
      stop();const generation=globalThis.BlueprintFullSyncLocal.prepare();
      const value={version:1,projectId:client.projectId,uid:account.uid,generation,enabled:true,paired:false,mode};
      const raw=writePreference(value,old.raw);
      makeSession({value,raw});status.textContent='Preparing sync…';schedule(1700);
    }catch(error){status.textContent=error.message;}
    finally{busy=false;render();}
  }
  start.addEventListener('click',()=>void setup('source'));
  join.addEventListener('click',()=>void setup('join'));
  pause.addEventListener('click',()=>{
    try{const pref=readPreference();if(pref.value)writePreference({...pref.value,enabled:false},pref.raw);stop();status.textContent='Automatic sync paused. Local data and backups are unchanged.';render();}
    catch(error){stop();status.textContent=error.message;}
  });
  resume.addEventListener('click',async()=>{
    try{
      await ensureNative();const pref=readPreference();
      if(!pref.value||pref.value.uid!==client?.auth.currentUser?.uid||pref.value.generation!==globalThis.BlueprintFullSyncLocal.generation())throw Error('Set up this device again before syncing.');
      const value={...pref.value,enabled:true},raw=writePreference(value,pref.raw);stop();makeSession({value,raw});schedule(0);render();
    }catch(error){status.textContent=error.message;}
  });
  for(const button of conflicts.querySelectorAll('[data-full-sync-choice]'))button.addEventListener('click',async()=>{
    if(!review||busy)return;const selected=review,current=session;
    const choice=button.dataset.fullSyncChoice;
    const accepted=await globalThis.BlueprintSheet.confirm(
      'Use the '+(choice==='device'?'device':'shared')+' version for overlapping edits? Non-conflicting changes will still merge. A local recovery copy will be kept.',
      'Resolve and sync','Review conflicting edits');
    if(accepted&&session===current&&review===selected)void tick({choice,reviewContext:selected.context});
  });
  recovery.addEventListener('click',async()=>{
    try{
      const key=localStorage.getItem('blueprint-sync-last-recovery');
      const blob=await globalThis.v6Blob('get',key);if(!blob)throw Error('The local recovery copy is unavailable.');
      const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='blueprint-before-sync.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
    }catch(error){status.textContent=error.message;}
  });
  function refresh(nextClient){
    client=nextClient;
    if(session&&session.account!==client?.auth.currentUser)stop();
    try{
      const pref=readPreference();
      if(!session&&pref.value?.enabled&&pref.value.uid===client?.auth.currentUser?.uid&&
        pref.value.projectId===client.projectId&&pref.value.generation===globalThis.BlueprintFullSyncLocal.generation()){
        if(!navigator.locks)throw Error('Automatic sync needs a current browser.');
        // Older native builds must never resume without drawing-change support.
        void ensureNative().then(()=>{
          if(!session&&client?.auth.currentUser?.uid===pref.value.uid&&localStorage.getItem(preferenceKey)===pref.raw){makeSession(pref);schedule(0);}
        }).catch(error=>{status.textContent=error.message;});
      }
    }catch(error){status.textContent=error.message;}
    render();
  }
  window.addEventListener('blueprint:planner-saved',()=>schedule());
  window.addEventListener('blueprint:sync-dirty',()=>schedule());
  // Let a reconnect settle before opening files or starting cloud reads.
  window.addEventListener('online',()=>schedule(1000));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule(0);});
  window.addEventListener('storage',event=>{if(event.key===preferenceKey){stop();refresh(client);}});
  window.addEventListener('blueprint:before-import',()=>{
    const pref=readPreference();if(pref.value?.enabled)writePreference({...pref.value,enabled:false},pref.raw);
    stop();render();status.textContent='Sync paused for import. Set up this device again after restoring.';
  });
  const interval=setInterval(()=>{if(session&&dirty)void tick();},30000);
  window.addEventListener('pagehide',stop);
  window.addEventListener('pageshow',()=>{refresh(client);schedule(0);});
  // Connect only if the owner previously opted in on this device/account.
  try{if(readPreference().value?.enabled)void getClient().then(async connected=>{await connected.auth.authStateReady();refresh(connected);}).catch(error=>{status.textContent=error.message;});}
  catch(error){status.textContent=error.message;}
  render();
  return {refresh,setExternalBusy(value){externalBusy=value;if(!value&&session)schedule();},stop};
}
