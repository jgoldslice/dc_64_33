/**
 * DRAFT ONLY: Non-mutating audit of media references in a Canvas backup.
 * Do not delete blobs solely based on this scan: some legacy versions may
 * keep draft keys outside the normalized state.
 */
export function collectReferencedMediaKeys(state) {
  const refs=new Map();
  const add=(key,where)=>{
    if(typeof key!=='string'||!key.trim())return;
    const list=refs.get(key)||[];list.push(where);refs.set(key,list);
  };
  for(const project of state?.projects||[]){
    const pid=String(project.id||'unknown');
    for(const resource of project.library||[])add(resource.key,'project:'+pid+'/library');
    for(const block of project.contentBlocks||[])add(block.key,'project:'+pid+'/legacy-notes');
    for(const page of project.notePages||[]){
      for(const object of page.objects||[])if(object.type==='image')add(object.key,'project:'+pid+'/page:'+String(page.id));
    }
  }
  return refs;
}
export async function auditMediaReferences(state,hasBlob){
  if(typeof hasBlob!=='function')throw new TypeError('hasBlob async function required');
  const refs=collectReferencedMediaKeys(state);
  const missing=[];
  for(const [key,owners] of refs){
    try{if(!(await hasBlob(key)))missing.push({key,owners});}
    catch(error){missing.push({key,owners,error:String(error)});}
  }
  return {
    checked:refs.size,
    missing,
    ok:missing.length===0,
    note:'Read-only audit. Does not change or delete files.'
  };
}
