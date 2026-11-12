'use strict';
/* Blueprint v9.26 — Read-only local storage diagnostics.
   Does not alter existing localStorage/IndexedDB data or trigger cloud sync.
   Keep attachment reference rules aligned with v74 complete-backup format. */
(function(){
  function countSavedAttachmentKeys(data){
    const keys=new Set();
    for(const project of data.projects||[]){
      for(const record of project.library||[])
        if(record.key)keys.add(String(record.key));
      for(const block of project.contentBlocks||[])
        if(block.key)keys.add(String(block.key));
      for(const page of project.notePages||[]){
        for(const object of page.objects||[]){
          if(object.type==='image'&&object.key)
            keys.add(String(object.key));
        }
      }
    }
    return [...keys].sort();
  }

  function checkShape(data){
    if(!data||typeof data!=='object'||Array.isArray(data))
      throw Error('Saved planner JSON is not an object');
    for(const name of ['tasks','habits','goals','events','ideas','projects']){
      if(Object.hasOwn(data,name)&&!Array.isArray(data[name]))
        throw Error('Saved planner has invalid '+name+' records');
    }
    return data;
  }

  async function checkIndexedDB(keys){
    if(!keys.length)return {missing:[],fileBytes:0};
    const db=await v6DB();
    try{
      const missing=[], fileSizes=new Map();
      await new Promise((resolve,reject)=>{
        const transaction=db.transaction('blobs','readonly');
        const store=transaction.objectStore('blobs');
        for(const key of keys){
          const request=store.get(key);
          request.onsuccess=()=>{
            const file=request.result;
            if(!file||typeof file.size!=='number')missing.push(key);
            else fileSizes.set(key,file.size);
          };
        }
        transaction.oncomplete=resolve;
        transaction.onabort=()=>reject(transaction.error||Error('Attachment audit aborted'));
        transaction.onerror=()=>{ /* onabort provides the final failure */ };
      });
      return {missing:missing.sort(),fileBytes:[...fileSizes.values()].reduce((a,b)=>a+b,0)};
    }finally{db.close();}
  }

  async function inspect(){
    // Always inspect the last *persisted* snapshot, not unsaved screen state.
    const raw=localStorage.getItem('jgold-planner-v1');
    if(raw===null)return {saved:false,projects:0,attachments:0,missing:[],fileBytes:0,plannerBytes:0};
    const data=checkShape(JSON.parse(raw));
    const keys=countSavedAttachmentKeys(data);
    const files=await checkIndexedDB(keys);
    const report={
      saved:true,
      projects:(data.projects||[]).length,
      tasks:(data.tasks||[]).length,
      habits:(data.habits||[]).length,
      attachments:keys.length,
      missing:files.missing,
      fileBytes:files.fileBytes,
      plannerBytes:new Blob([raw]).size
    };
    try{
      const estimate=await navigator.storage?.estimate?.();
      if(Number.isFinite(estimate?.usage))report.estimatedDeviceUsage=estimate.usage;
      if(Number.isFinite(estimate?.quota))report.estimatedQuota=estimate.quota;
    }catch{/* Storage estimates are optional, not an integrity requirement. */}
    return report;
  }

  function formatBytes(n){
    if(n<1024)return n+' B';
    if(n<1024*1024)return (n/1024).toFixed(1)+' KB';
    return (n/1024/1024).toFixed(1)+' MB';
  }
  const button=document.getElementById('v926CheckLocal');
  const output=document.getElementById('v926StorageReport');
  if(!button||!output)return;
  button.addEventListener('click',async()=>{
    button.disabled=true;
    output.hidden=false;
    output.style.whiteSpace='pre-line';
    output.textContent='Checking saved planner and Library files on this device…';
    try{
      const r=await inspect();
      if(!r.saved){
        output.textContent='No saved planner snapshot was found on this device. New work will save here when created.';
      }else{
        const line=r.missing.length
          ?'WARNING: '+r.missing.length+' referenced Library file(s) are missing. Do not delete or reset app data.'
          :'All '+r.attachments+' referenced Library file(s) were found.';
        output.textContent='Saved locally: '+r.projects+' projects, '+r.tasks+' tasks, '+r.habits+' habits.\n'
          +line+'\nPlanner data: '+formatBytes(r.plannerBytes)
          +' · Referenced files: '+formatBytes(r.fileBytes)
          +(r.estimatedDeviceUsage!==undefined?'\nEstimated total app-origin storage (including caches): '+formatBytes(r.estimatedDeviceUsage):'')
          +'\nThis checks file presence, not hashes. Export a complete backup to verify contents.';
      }
    }catch(error){
      output.textContent='Local storage check could not finish: '+String(error?.message||error)
        +'. Do not clear data. Export or preserve a recovery copy before troubleshooting.';
      console.error('Blueprint local storage check failed',error);
    }finally{button.disabled=false;}
  });
  window.BlueprintStorageHealth=Object.freeze({inspect,countSavedAttachmentKeys});
})();
