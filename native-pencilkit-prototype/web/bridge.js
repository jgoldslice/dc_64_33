'use strict';
/* Blueprint v9 native-ink transport prototype. NOT loaded by index.html.
   Existing notes remain in SVG/localStorage; this transports native sidecars.
   No automatic write-back or destructive migration is performed. */
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.BlueprintNativeInkBridge=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  const FORMAT='blueprint-native-ink-bundle';
  const PAGE_FORMAT='blueprint-pencilkit-page';
  const HEX=/^[a-f0-9]{64}$/i;
  const B64=/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
  const pluginFromCapacitor=()=>globalThis.Capacitor?.Plugins?.BlueprintPencil||null;
  const validId=s=>typeof s==='string'&&s.length>0&&
    new TextEncoder().encode(s).length<=200&&!/[\x00-\x1f\x7f]/.test(s);
  function decodeBase64(value){
    if(typeof value!=='string'||!value||!B64.test(value))throw Error('Invalid Base64 encoding');
    return typeof Buffer!=='undefined'
      ?new Uint8Array(Buffer.from(value,'base64'))
      :Uint8Array.from(atob(value),s=>s.charCodeAt(0));
  }
  async function digest(bytes){
    if(!globalThis.crypto?.subtle)throw Error('SHA-256 requires a secure context');
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)))
      .map(n=>n.toString(16).padStart(2,'0')).join('');
  }
  async function validatePage(entry){
    if(!entry||entry.format!==PAGE_FORMAT||entry.schemaVersion!==1||
      !validId(entry.projectId)||!validId(entry.pageId)||
      !(entry.pageWidth>100&&entry.pageWidth<=4096)||
      !(entry.pageHeight>100&&entry.pageHeight<=8192)||
      !HEX.test(entry.drawingSHA256||'')||!HEX.test(entry.previewSHA256||'')||
      entry.previewMIME!=='image/png')throw Error('Unsupported or invalid native page payload');
    const drawing=decodeBase64(entry.drawingBase64);
    const preview=decodeBase64(entry.previewBase64);
    if(drawing.byteLength>40*1024*1024||preview.byteLength>40*1024*1024)
      throw Error('Native ink exceeds safe size limit');
    if(await digest(drawing)!==entry.drawingSHA256.toLowerCase())
      throw Error('Native drawing checksum mismatch');
    if(await digest(preview)!==entry.previewSHA256.toLowerCase())
      throw Error('Native preview checksum mismatch');
    return entry;
  }
  async function validateBundle(bundle){
    if(!bundle||bundle.format!==FORMAT||bundle.version!==1||
      !Array.isArray(bundle.pages)||bundle.pages.length>500)
      throw Error('Unknown native ink bundle version');
    const seen=new Set();
    for(const page of bundle.pages){
      await validatePage(page);
      const key=JSON.stringify([page.projectId,page.pageId]);
      if(seen.has(key))throw Error('Duplicate native project/page ID');
      seen.add(key);
    }
    return bundle;
  }
  async function exportNativeBundle(plugin,projects){
    if(!plugin||typeof plugin.exportPage!=='function')
      throw Error('PencilKit native plugin is unavailable');
    const pages=[];
    for(const project of projects||[]){
      if(!validId(String(project.id||'')))continue;
      for(const page of project.notePages||[]){
        if(!validId(String(page.id||'')))continue;
        try{
          const value=await plugin.exportPage({projectId:String(project.id),pageId:String(page.id)});
          await validatePage(value);
          pages.push(value);
        }catch(error){
          // Missing native ink is normal on legacy SVG-only pages.
          if(!/No native drawing has been saved/i.test(String(error?.message||error)))throw error;
        }
      }
    }
    return {format:FORMAT,version:1,exportedAt:new Date().toISOString(),pages};
  }
  async function importNativeBundle(plugin,bundle,{allowOverwrite=false}={}){
    if(!plugin||typeof plugin.importPage!=='function')
      throw Error('PencilKit native plugin is unavailable');
    // Validate *all* bytes and identities before writing the first native page.
    await validateBundle(bundle);
    const imported=[];
    for(const page of bundle.pages){
      // Each import is atomic, but this bundle is NOT an all-or-nothing
      // transaction across pages. Never delete previously imported ink.
      const saved=await plugin.importPage({
        projectId:page.projectId,pageId:page.pageId,payload:page,allowOverwrite
      });
      imported.push(saved);
    }
    return imported;
  }
  async function openNativeProjectPage(plugin,project,pageId){
    if(!plugin||typeof plugin.openEditor!=='function')
      throw Error('PencilKit native plugin is unavailable');
    const pageIDs=(project.notePages||[]).map(page=>String(page.id));
    if(!pageIDs.includes(String(pageId)))throw Error('Page is not in this project');
    return plugin.openEditor({projectId:String(project.id),pageId:String(pageId),pageIds:pageIDs});
  }
  return Object.freeze({
    FORMAT,PAGE_FORMAT,pluginFromCapacitor,validatePage,validateBundle,
    exportNativeBundle,importNativeBundle,openNativeProjectPage
  });
});
