'use strict';
/* Staged native Share Extension importer for Blueprint. NOT loaded by index.html.
   Import only in the signed Capacitor host after registering BlueprintShare.
   The extension's App Group inbox is not an IndexedDB store: acknowledge a
   queued item only after the existing web planner & attachments are verified. */
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.BlueprintNativeShareInbox=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  const MAX_FILE_BYTES=20*1024*1024;
  const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const ITEM=/^[a-z0-9_-]{1,60}$/i;
  const HEX=/^[0-9a-f]{64}$/i;
  const BASE64=/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
  const stamp=()=>new Date().toISOString();
  const cleanText=(s,max)=>String(s||'').trim().slice(0,max);
  const validLink=s=>{
    try{const u=new URL(s);return u.protocol==='https:'||u.protocol==='http:';}
    catch{return false;}
  };
  function decode64(encoded){
    if(typeof encoded!=='string'||!encoded||!BASE64.test(encoded))
      throw Error('Share payload is not valid Base64');
    if(encoded.length>Math.ceil(MAX_FILE_BYTES/3)*4+8)
      throw Error('Shared file exceeds 20 MB');
    return typeof Buffer!=='undefined'
      ?new Uint8Array(Buffer.from(encoded,'base64'))
      :Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
  }
  async function sha256(bytes){
    if(!globalThis.crypto?.subtle)throw Error('SHA-256 requires a secure context');
    return Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes)))
      .map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  function validateEnvelope(entry){
    if(!entry||entry.version!==1||!ID.test(entry.id||'')||
      typeof entry.projectId!=='string'||!entry.projectId||
      !Array.isArray(entry.items)||entry.items.length<1||entry.items.length>8)
      throw Error('Invalid Share Extension envelope');
    if(new Set(entry.items.map(i=>i.id)).size!==entry.items.length)
      throw Error('Duplicate item identifiers in shared envelope');
    for(const item of entry.items){
      if(!item||!ITEM.test(item.id||'')||!['link','file'].includes(item.kind))
        throw Error('Unrecognized shared item');
      if(item.kind==='link'){
        if(!validLink(item.url))throw Error('Unsupported shared URL');
      }else if(!HEX.test(item.sha256||'')||
                !Number.isSafeInteger(item.size)||item.size<1||item.size>MAX_FILE_BYTES||
                typeof item.mime!=='string'||item.mime.length>120||
                !(/^(image\/(png|jpeg|heic|heif|gif|webp)|application\/pdf)$/i).test(item.mime))
        throw Error('Invalid shared file metadata');
    }
    return entry;
  }
  const itemRecordId=(envelope,item)=>'bp-share-'+envelope.id+'-'+item.id;
  function createImporter({plugin,projects,putBlob,getBlob,commit,refresh=()=>{}}){
    if(!plugin||!projects||!putBlob||!getBlob||!commit)throw Error('Missing Share Extension integration');
    let running=false;
    async function publishProjects(){
      if(typeof plugin.publishProjects!=='function')throw Error('Native Share Extension is unavailable');
      const list=projects();
      if(!Array.isArray(list))throw Error('Project snapshot must be an array');
      const summaries=list.slice(0,500).map(p=>({id:String(p.id),title:cleanText(p.title,120)}))
        .filter(p=>p.id&&p.id.length<=200&&p.title);
      await plugin.publishProjects({projects:summaries});
      return summaries.length;
    }
    async function importPending(){
      if(running)return {busy:true,imported:0,acknowledged:0,errors:[]};
      running=true;
      const result={busy:false,imported:0,acknowledged:0,errors:[]};
      try{
        const response=await plugin.listPending();
        if(!Array.isArray(response?.entries))throw Error('Native inbox response is invalid');
        // Corrupt native manifests remain on disk for recovery, but should
        // not prevent valid shares from importing on the same app launch.
        for(const id of (Array.isArray(response.errors)?response.errors:[]))
          result.errors.push({id:String(id),message:'Queued share manifest is damaged; it was retained for recovery'});
        for(const entry of response.entries){
          try{
            validateEnvelope(entry);
            const project=projects().find(p=>String(p.id)===entry.projectId);
            if(!project)throw Error('Destination project no longer exists; item retained in inbox');
            if(!Array.isArray(project.library))project.library=[];
            let changed=false;
            for(const item of entry.items){
              const id=itemRecordId(entry,item);
              const already=project.library.find(r=>String(r.id)===id);
              if(item.kind==='link'){
                if(already||project.library.some(r=>r.type==='link'&&r.url===item.url))continue;
                project.library.push({id,type:'link',
                  title:cleanText(item.title,180)||item.url,url:item.url,created:stamp()});
                changed=true;
                continue;
              }
              // If the planner entry is already present after a previous
              // interrupted run, verify its bytes before skipping the file.
              const key='bp-share-file-'+entry.id+'-'+item.id;
              const actualKey=already?.key||key;
              let stored=await getBlob(actualKey);
              let healthy=false;
              if(stored&&stored.size===item.size){
                healthy=(await sha256(await stored.arrayBuffer()))===item.sha256.toLowerCase();
              }
              if(!healthy){
                const file=await plugin.readFile({id:entry.id,itemId:item.id});
                if(file?.sha256?.toLowerCase()!==item.sha256.toLowerCase()||
                   file?.size!==item.size||typeof file.base64!=='string')
                  throw Error('Native shared file metadata mismatch');
                const bytes=decode64(file.base64);
                if(bytes.length!==item.size||(await sha256(bytes))!==item.sha256.toLowerCase())
                  throw Error('Shared file checksum mismatch');
                const blob=new Blob([bytes],{type:item.mime});
                await putBlob(actualKey,blob);
                stored=await getBlob(actualKey);
                if(!stored||stored.size!==item.size||
                   (await sha256(await stored.arrayBuffer()))!==item.sha256.toLowerCase())
                  throw Error('IndexedDB shared file read-back verification failed');
              }
              if(!already){
                project.library.push({id,type:'file',title:cleanText(item.title||item.name,180)||'Shared file',
                  mime:item.mime,key:actualKey,size:item.size,created:stamp()});
                changed=true;
              }
            }
            // Commit even if all record IDs already exist, because an earlier
            // save could have failed while the in-memory state looked complete.
            if(changed||entry.items.length){
              if(!(await commit()))throw Error('Planner write not confirmed; shared item retained');
              await refresh();
            }
            await plugin.acknowledge({id:entry.id});
            result.acknowledged++;
            result.imported+=entry.items.length;
          }catch(error){
            result.errors.push({id:String(entry?.id||''),message:String(error?.message||error)});
          }
        }
      }finally{running=false;}
      return result;
    }
    return Object.freeze({publishProjects,importPending});
  }
  return Object.freeze({MAX_FILE_BYTES,validateEnvelope,itemRecordId,createImporter});
});