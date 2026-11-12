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
  const CHUNK_BYTES=256*1024;
  function decode64(encoded){
    if(typeof encoded!=='string'||!encoded||encoded.length>MAX_FILE_BYTES*2)
      throw Error('Share payload is not valid Base64');
    // Some native/provider bridges produce line-wrapped, URL-safe or data-URL
    // Base64. Normalize these transports, but never relax size/hash checks.
    let normalized=encoded.trim()
      .replace(/^data:[^,]{0,160};base64,/i,'')
      .replace(/\s+/g,'').replace(/-/g,'+').replace(/_/g,'/');
    if(normalized.length>Math.ceil(MAX_FILE_BYTES/3)*4+8)
      throw Error('Shared file exceeds 20 MB');
    if(normalized.length%4===1)throw Error('Share payload is not valid Base64');
    normalized+='='.repeat((4-normalized.length%4)%4);
    if(!normalized||!BASE64.test(normalized))
      throw Error('Share payload is not valid Base64');
    try{
      return typeof Buffer!=='undefined'
        ?new Uint8Array(Buffer.from(normalized,'base64'))
        :Uint8Array.from(atob(normalized),c=>c.charCodeAt(0));
    }catch{
      throw Error('Share payload is not valid Base64');
    }
  }
  async function readNativeBytes(plugin,entry,item){
    // Avoid returning a multi-megabyte JSON/Base64 value through WKWebView.
    // Unsupported older native builds may still use the legacy readFile call.
    if(typeof plugin.readFileChunk==='function'){
      try{
        const all=new Uint8Array(item.size);
        for(let offset=0;offset<item.size;){
          const length=Math.min(CHUNK_BYTES,item.size-offset);
          const reply=await plugin.readFileChunk({id:entry.id,itemId:item.id,offset,length});
          if(reply?.sha256?.toLowerCase()!==item.sha256.toLowerCase()||
             reply?.size!==item.size||reply?.offset!==offset||
             reply?.length!==length||typeof reply.base64!=='string')
            throw Error('Native shared file chunk metadata mismatch');
          const piece=decode64(reply.base64);
          if(piece.length!==length)throw Error('Native shared file chunk length mismatch');
          all.set(piece,offset);
          offset+=length;
        }
        return all;
      }catch(error){
        // Capacitor proxies can expose a method name even when an older Swift
        // plugin has not registered it. Only then use the legacy readFile.
        const message=String(error?.message||error);
        if(error?.code!=='UNIMPLEMENTED'&&!/not implemented|unimplemented/i.test(message))
          throw error;
      }
    }
    const file=await plugin.readFile({id:entry.id,itemId:item.id});
    if(file?.sha256?.toLowerCase()!==item.sha256.toLowerCase()||
       file?.size!==item.size||typeof file.base64!=='string')
      throw Error('Native shared file metadata mismatch');
    return decode64(file.base64);
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
  function createImporter({plugin,projects,putBlob,getBlob,commit,refresh=()=>{},onProgress=()=>{}}){
    if(!plugin||!projects||!putBlob||!getBlob||!commit)throw Error('Missing Share Extension integration');
    let running=false;
    function reportProgress(info){
      // Cosmetic progress must not interfere with persistence or recovery.
      try{onProgress(info);}
      catch(error){console.warn('Share import progress callback failed',error);}
    }
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
      let needsRefresh=false;
      try{
        const response=await plugin.listPending();
        if(!Array.isArray(response?.entries))throw Error('Native inbox response is invalid');
        // Corrupt native manifests remain on disk for recovery, but should
        // not prevent valid shares from importing on the same app launch.
        for(const id of (Array.isArray(response.errors)?response.errors:[]))
          result.errors.push({id:String(id),message:'Queued share manifest is damaged; it was retained for recovery'});
        if(response.entries.length)reportProgress({phase:'importing',batches:response.entries.length});
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
                const bytes=await readNativeBytes(plugin,entry,item);
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
              needsRefresh=true;
            }
            await plugin.acknowledge({id:entry.id});
            result.acknowledged++;
            result.imported+=entry.items.length;
          }catch(error){
            result.errors.push({id:String(entry?.id||''),message:String(error?.message||error)});
          }
        }
      }finally{
        // Re-render once per import pass, not after each batch. This avoids
        // repeatedly decoding Library thumbnails while importing many images.
        // A confirmed planner save + IndexedDB readback are the durability
        // gates; UI rendering must not prevent native acknowledgement.
        if(needsRefresh){
          try{await refresh();}
          catch(error){
            result.refreshError=String(error?.message||error);
            console.warn('Shared items persisted; Library view refresh failed',error);
          }
        }
        running=false;
      }
      return result;
    }
    return Object.freeze({publishProjects,importPending});
  }
  return Object.freeze({MAX_FILE_BYTES,validateEnvelope,itemRecordId,createImporter});
});