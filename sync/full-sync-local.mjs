import {archiveToGraph,graphToArchive} from './full-sync-codec.mjs';
const maxBytes=100*1024*1024;
export function createFullSyncLocal(){
  const api=globalThis.BlueprintFullSyncLocal;
  async function nativeIdle(){
    if(!globalThis.Capacitor?.isNativePlatform?.())return;
    const cap=await globalThis.Capacitor.nativePromise('BlueprintPencil','capabilities',{});
    if(cap.syncDrawingEventsVersion!==1)throw Error('Install the updated iOS build before syncing handwriting.');
    if(cap.fullEditorActive)throw Error('Finish full-screen handwriting to sync this device.');
  }
  async function snapshot(){
    await nativeIdle();
    api.prepare();
    const token=api.token();api.assert(token);
    const blob=await globalThis.v74BuildCompleteBackup();api.assert(token);
    if(blob.size>maxBytes)throw Error('This planner exceeds the 100 MiB sync limit. Local backups remain available.');
    const archive=JSON.parse(await blob.text());
    await api.inspect(archive);api.assert(token);
    const result=await archiveToGraph(archive);api.assert(token);
    return {...result,token,archive};
  }
  async function makeArchive(graph,readObject){
    const archive=await graphToArchive(graph,readObject);
    const blob=new Blob([JSON.stringify(archive)],{type:'application/json'});
    if(blob.size>maxBytes)throw Error('This shared planner exceeds the 100 MiB sync limit.');
    await api.inspect(archive);return {archive,blob};
  }
  async function validate(graph,readObject){await makeArchive(graph,readObject);}
  async function keepRecovery(snapshot){
    const key='blueprint-sync-recovery-'+crypto.randomUUID();
    const blob=new Blob([JSON.stringify(snapshot.archive)],{type:'application/json'});
    await globalThis.v6Blob('put',key,blob);
    const saved=await globalThis.v6Blob('get',key);
    if(!saved||await saved.text()!==await blob.text())throw Error('A local recovery copy could not be verified.');
    localStorage.setItem('blueprint-sync-last-recovery',key);
    if(localStorage.getItem('blueprint-sync-last-recovery')!==key)throw Error('The recovery-copy reference could not be saved.');
    return key;
  }
  async function apply(snapshot,graph,readObject,assertActive){
    const {blob}=await makeArchive(graph,readObject);await nativeIdle();assertActive();api.assert(snapshot.token);
    if(globalThis.Capacitor?.isNativePlatform?.()){
      await globalThis.Capacitor.nativePromise('BlueprintPencil','hideInline',{});
      assertActive();api.assert(snapshot.token);
    }
    const viewport=document.getElementById('v815ZoomViewport');
    const top=viewport?.scrollTop||0,left=viewport?.scrollLeft||0;
    const originalScrollY=scrollY;
    const result=await globalThis.v74ImportBackup(blob,assertActive,{sync:true,
      expectedManifest:snapshot.token.manifest,previousArchive:snapshot.archive,
      guard:()=>{assertActive();api.assert(snapshot.token);}});
    if(result!==true)throw Error('The shared planner could not be saved on this device.');
    if(viewport){viewport.scrollTop=top;viewport.scrollLeft=left;}
    scrollTo({top:originalScrollY,behavior:'instant'});
    window.dispatchEvent(new Event('resize'));
  }
  return {snapshot,validate,apply,keepRecovery,
    assertSnapshot:async snapshot=>{await nativeIdle();api.assert(snapshot.token);},
    assertSnapshotSync:snapshot=>api.assert(snapshot.token)};
}
export function syncCheckpoint(scope,guard=()=>{}){
  const key='blueprint-full-sync-checkpoint:'+scope;
  let expected;
  async function readText(){
    const stored=await globalThis.v6Blob('get',key);guard();
    if(stored==null)return null;
    // Checkpoints are structured JSON, not file attachments. Plain strings
    // avoid reopening a Blob resource as a document is being suspended.
    if(typeof stored==='string')return stored;
    if(stored instanceof Blob){const text=await stored.text();guard();return text;}
    throw Error('The sync checkpoint format is damaged.');
  }
  return {
    async read(){
      expected=await readText();guard();
      if(expected===null)return null;
      const value=JSON.parse(expected);
      if(value.schema!==1||!value.baseline)throw Error('The sync checkpoint is damaged. Preserve local data before recovery.');
      return value;
    },
    async write(value){
      if(await readText()!==(expected??null))throw Error('Another window changed the sync checkpoint.');
      guard();const text=JSON.stringify(value);
      await globalThis.v6Blob('put',key,text);guard();
      if(await readText()!==text)throw Error('The sync checkpoint could not be verified.');
      expected=text;
    }
  };
}
