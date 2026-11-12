'use strict';
/* HOST-APP ONLY wiring example. Load AFTER native-share-extension/web/inbox.js
   and after the existing Blueprint page scripts, inside the Capacitor build.
   Do NOT add this file to the public web site's <script> tags until the
   actual Xcode plugin has been registered and tested with real iOS storage. */
(function(){
  const capacitor=window.Capacitor;
  // A local Swift CAPBridgedPlugin needs a JavaScript proxy registered
  // with its jsName; checking native availability alone is not sufficient.
  if(!capacitor?.isNativePlatform?.()||!capacitor?.isPluginAvailable?.('BlueprintShare')||
     !window.BlueprintNativeShareInbox)return;
  const plugin=capacitor.registerPlugin?.('BlueprintShare')||
    capacitor.Plugins?.BlueprintShare;
  if(!plugin)return;

  const importer=window.BlueprintNativeShareInbox.createImporter({
    plugin,
    projects:()=>state.projects,
    putBlob:(key,blob)=>v6Blob('put',key,blob),
    getBlob:key=>v6Blob('get',key),
    commit:()=>save(true),
    refresh:()=>v6Render(),
    onProgress:({batches})=>showNotice('Importing '+batches+' queued share batch'+(batches===1?'':'es')+'…')
  });

  let syncing=false;
  function showNotice(message,failed=false){
    let notice=document.getElementById('bpNativeShareNotice');
    if(!notice){
      notice=document.createElement('div');
      notice.id='bpNativeShareNotice';
      notice.setAttribute('role','status');
      notice.style.cssText='position:fixed;left:12px;right:12px;bottom:calc(env(safe-area-inset-bottom) + 80px);z-index:20002;max-width:480px;margin:auto;background:var(--surface);color:var(--ink);border:1px solid var(--line);box-shadow:0 8px 24px #0003;border-radius:12px;padding:12px 14px;font-size:14px;display:flex;align-items:center;gap:12px';
      const text=document.createElement('span');
      text.style.flex='1';
      const retry=document.createElement('button');
      retry.type='button';
      retry.textContent='Retry';
      retry.style.cssText='min-height:44px;border:1px solid var(--line);border-radius:9px;background:var(--wash);padding:8px;color:var(--ink)';
      retry.addEventListener('click',sync);
      const dismiss=document.createElement('button');
      dismiss.type='button';
      dismiss.textContent='Close';
      dismiss.style.cssText='min-height:44px;border:0;background:transparent;color:var(--ink)';
      dismiss.addEventListener('click',()=>notice.remove());
      notice.append(text,retry,dismiss);
      document.body.append(notice);
    }
    notice.firstChild.textContent=message;
    notice.children[1].hidden=!failed;
  }
  async function sync(){
    if(syncing||document.hidden)return;
    syncing=true;
    try{
      // Keep extension's lightweight project list current without copying
      // locally stored notes, files or full planner data into the App Group.
      await importer.publishProjects();
      const result=await importer.importPending();
      if(result.errors.length){
        const count=result.errors.length;
        const first=String(result.errors[0]?.message||'Import failed').slice(0,180);
        const prefix=result.acknowledged?'Imported '+result.acknowledged+' batch(es), but ':'';
        showNotice(prefix+count+' queued share batch(es) still need attention: '+first+'. Tap Retry after resolving the problem.',true);
        // Keep precise reasons visible for local Safari Web Inspector debugging.
        console.warn('Share inbox import retry required',result.errors);
      }else if(result.refreshError){
        showNotice('Shared files were saved, but the Library did not refresh. Reopen this project.');
        console.warn('Share inbox Library refresh failed',result.refreshError);
      }else if(result.acknowledged){
        showNotice('Added '+result.acknowledged+' shared batch(es) to your project Library.');
      }
    }catch(error){
      showNotice('Blueprint could not access the shared inbox. Your queued items are retained. Tap Retry.',true);
      console.warn('Share inbox unavailable:',error);
    }finally{syncing=false;}
  }

  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void sync();});
  window.addEventListener('pageshow',()=>void sync());
  if(document.readyState==='complete')void sync();
  else window.addEventListener('load',()=>void sync(),{once:true});
  window.BlueprintNativeShareSync=sync;
})();
