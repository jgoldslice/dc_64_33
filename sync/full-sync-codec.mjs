import {canonicalJSON} from './full-sync-merge.mjs';
export const hashBytes = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
export const jsonBytes = value => new TextEncoder().encode(canonicalJSON(value));
export const hashJSON = value => hashBytes(jsonBytes(value));
export const isHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const collections = ['tasks','events','habits','goals','weeklyGoals','ideas','projects'];
const key = (...parts) => JSON.stringify(parts.map(String));
function rewriteKeys(project, mapping) {
  for (const row of [...(project.library||[]),...(project.contentBlocks||[])])
    if(row.key) {if(!mapping.has(String(row.key)))throw Error('A sync attachment is missing.');row.key=mapping.get(String(row.key));}
  for(const page of project.notePages||[])for(const item of page.objects||[])
    if(item.type==='image'&&item.key){if(!mapping.has(String(item.key)))throw Error('A sync page image is missing.');item.key=mapping.get(String(item.key));}
}
// Canonical cloud IDs are independent of device-local staged media/page IDs.
// PKDrawing bytes and their PNG are atomic together; web text can merge separately.
export async function archiveToGraph(archive) {
  if(!archive || ![2,3].includes(archive.version) || !archive.state || !Array.isArray(archive.attachments))throw Error('A complete backup is required for sync.');
  const state=structuredClone(archive.state), graph=Object.create(null), objects=new Map(), mapping=new Map();
  async function put(value){const hash=await hashJSON(value);objects.set(hash,value);return hash;}
  for(const asset of archive.attachments){
    const hash=await put({kind:'asset',mime:asset.mime,base64:asset.base64,size:asset.size,sha256:asset.sha256});
    mapping.set(String(asset.key),'sync-'+hash);
  }
  const drawings=new Map((archive.drawings||[]).map(d=>[key(d.projectId,d.pageId),d]));
  for(const name of collections){
    const rows=state[name]||[];
    if(!Array.isArray(rows))throw Error('Invalid sync collection: '+name);
    const seen=new Set();
    for(const row of rows){
      if(row.id===undefined || seen.has(String(row.id)))throw Error('Sync needs unique '+name+' IDs.');
      seen.add(String(row.id));
      if(name==='projects'){
        rewriteKeys(row,mapping);
        const pages=row.notePages||[], refs=[];
        for(const page of pages){
          const original=String(page.id), identity=String(page.blueprintSyncPageId||page.id);
          if(refs.includes(identity))throw Error('Duplicate synced notebook page.');refs.push(identity);
          const drawing=drawings.get(key(row.id,original));
          const ink=drawing?.base64 ? await put({kind:'ink',base64:drawing.base64,...(drawing.preview?{preview:drawing.preview}:{})}) : null;
          page.id=identity;delete page.blueprintSyncPageId;
          graph[key('pages',row.id,identity)]={page,ink};
        }
        const draft=mapping.get('v6-draft-'+row.id)?.slice(5)||null;
        const data={...row};delete data.notePages;delete data.activeNotePageId;
        // Legacy projects can still store their only note in notebookText.
        // It is derived only after real note pages have been created.
        if(pages.length)delete data.notebookText;
        delete data.sketchDraftId;
        graph[key(name,row.id)]={data,pages:refs.map(id=>({id})),draft};
      }else graph[key(name,row.id)]=row;
    }
    graph[key('order',name)]=rows.map(row=>({id:String(row.id)}));delete state[name];
  }
  delete state.blueprintSyncGeneration;
  graph[key('settings')]=state;
  return {graph,objects};
}
export function graphReferences(graph) {
  const refs=new Set();
  function visit(value){
    if(Array.isArray(value))value.forEach(visit);
    else if(value&&typeof value==='object'){
      if(typeof value.key==='string'&&/^sync-[a-f0-9]{64}$/.test(value.key))refs.add(value.key.slice(5));
      Object.values(value).forEach(visit);
    }
  }
  for(const [id,value] of Object.entries(graph)){
    visit(value);
    const parts=JSON.parse(id);
    if(parts[0]==='pages'&&value.ink){if(!isHash(value.ink))throw Error('Invalid synced ink reference.');refs.add(value.ink);}
    if(parts[0]==='projects'&&value.draft){if(!isHash(value.draft))throw Error('Invalid synced draft reference.');refs.add(value.draft);}
  }
  return refs;
}
export async function graphToArchive(graph, readObject) {
  const state=structuredClone(graph[key('settings')]),attachments=new Map(),drawings=[];
  if(!state)throw Error('The shared planner settings are missing.');
  const objects=new Map();
  for(const hash of graphReferences(graph)){
    const value=await readObject(hash);
    if(await hashJSON(value)!==hash)throw Error('A shared planner file failed its checksum.');
    objects.set(hash,value);
    if(value.kind==='asset')attachments.set('sync-'+hash,{key:'sync-'+hash,...value});
    else if(value.kind!=='ink')throw Error('Unsupported shared file.');
  }
  for(const name of collections){
    const order=graph[key('order',name)];
    if(!Array.isArray(order))throw Error('A shared planner collection is missing.');
    const ids=new Set();state[name]=[];
    for(const {id} of order){
      if(ids.has(String(id)))throw Error('Duplicate shared planner identity.');ids.add(String(id));
      const value=graph[key(name,id)];if(!value)throw Error('A shared planner record is missing.');
      if(name!=='projects'){state[name].push(structuredClone(value));continue;}
      const project=structuredClone(value.data);project.notePages=[];
      for(const ref of value.pages){
        const record=graph[key('pages',id,ref.id)];if(!record)throw Error('A shared notebook page is missing.');
        const page=structuredClone(record.page);page.id=ref.id;page.blueprintSyncPageId=ref.id;project.notePages.push(page);
        const ink=record.ink?objects.get(record.ink):null;
        drawings.push({projectId:String(project.id),pageId:String(page.id),base64:ink?.base64??null,...(ink?.preview?{preview:ink.preview}:{})});
      }
      if(value.draft){const asset=objects.get(value.draft);if(asset?.kind!=='asset')throw Error('A shared sketch draft is missing.');attachments.set('v6-draft-'+id,{key:'v6-draft-'+id,...asset});}
      state[name].push(project);
    }
  }
  // Orphans are never silently discarded by a damaged order manifest.
  for(const id of Object.keys(graph)){
    const parts=JSON.parse(id);
    if(collections.includes(parts[0])&&!state[parts[0]].some(v=>String(v.id)===parts[1]))throw Error('A shared planner record has no order entry.');
    if(parts[0]==='pages'&&!state.projects.some(p=>String(p.id)===parts[1]&&p.notePages.some(pg=>String(pg.id)===parts[2])))throw Error('A shared page has no project.');
  }
  for(const task of state.tasks){
    for(const [field,collection] of [['projectId','projects'],['goalId','goals'],['ideaId','ideas']])
      if(task[field]!==undefined&&task[field]!==null&&task[field]!==''&&
         !state[collection].some(row=>String(row.id)===String(task[field])))
        throw Error('A related '+collection.slice(0,-1)+' was removed while its task changed. Review those records before syncing.');
  }
  for(const asset of attachments.values())delete asset.kind;
  const archive={format:'canvas-complete-backup',version:3,exportedAt:new Date().toISOString(),state,
    stateSha256:await hashJSONExact(state),attachments:[...attachments.values()],drawings,drawingsSha256:await hashJSONExact(drawings)};
  return archive;
}
// Existing backups checksum ordinary JSON, while cloud nodes use canonical JSON.
const hashJSONExact = value => hashBytes(new TextEncoder().encode(JSON.stringify(value)));
export {key as graphKey};

// Record existence is authoritative after a reviewed merge. Keep display-order
// references in step with those surviving records (including delete/edit choices).
export function reconcileGraphOrders(graph){
  const result=structuredClone(graph);
  const parts=Object.keys(result).map(id=>[id,JSON.parse(id)]);
  function order(existing,ids){
    const set=new Set(ids);const kept=existing.filter(ref=>set.has(String(ref.id)));
    const present=new Set(kept.map(ref=>String(ref.id)));
    return [...kept,...ids.filter(id=>!present.has(id)).sort().map(id=>({id}))];
  }
  for(const collection of collections){
    const id=key('order',collection);
    if(!Array.isArray(result[id]))continue;
    result[id]=order(result[id],parts.filter(([,p])=>p[0]===collection).map(([,p])=>p[1]));
  }
  for(const [id,p] of parts)if(p[0]==='projects'&&Array.isArray(result[id].pages))
    result[id].pages=order(result[id].pages,parts.filter(([,child])=>child[0]==='pages'&&child[1]===p[1]).map(([,child])=>child[2]));
  return result;
}
