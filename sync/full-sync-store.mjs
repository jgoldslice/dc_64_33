import {hashJSON,hashBytes,jsonBytes,isHash} from './full-sync-codec.mjs';
export class SyncMoved extends Error {constructor(){super('The shared planner changed. Sync will retry.');this.name='SyncMoved';}}
const limit=100*1024*1024;
async function bounded(operation,ms,message){let timer;try{return await Promise.race([operation,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),ms);})]);}finally{clearTimeout(timer);}}

export function createFullSyncStore({auth,db,firestore,storage,storageApi,native,downloadChunks,assertActive=()=>{}}){
  const account=auth.currentUser,uid=account?.uid;
  const cache=new Map();let cachedBytes=0;
  function remember(hash,value,size){
    if(size>32*1024*1024)return;
    while(cachedBytes+size>32*1024*1024||cache.size>=1000){const [id,entry]=cache.entries().next().value;cachedBytes-=entry.size;cache.delete(id);}
    if(!cache.has(hash)){cache.set(hash,{value,size});cachedBytes+=size;}
  }
  function guard(){if(!uid||auth.currentUser!==account)throw Error('The sync account changed.');assertActive();}
  guard();
  const headRef=firestore.doc(db,'users',uid,'sync','current');
  function parseHead(snapshot){
    if(!snapshot.exists())return null;
    const row=snapshot.data();
    if(row.schema!==1||!Number.isSafeInteger(row.revision)||row.revision<1||!isHash(row.hash))throw Error('Invalid shared planner head.');
    return {revision:row.revision,hash:row.hash};
  }
  const path=hash=>'users/'+uid+'/sync/objects/'+hash+'.json';
  async function readObject(hash){
    guard();if(!isHash(hash))throw Error('Invalid sync object identity.');
    if(cache.has(hash))return cache.get(hash).value;
    const file=storageApi.ref(storage,path(hash));
    const metadata=await bounded(storageApi.getMetadata(file),20000,'Sync file lookup timed out. Changes remain saved here.');guard();
    const size=Number(metadata.size);
    if(!Number.isSafeInteger(size)||size<1||size>limit||metadata.contentType!=='application/json')throw Error('Invalid shared file size or format.');
    const bytes=native?await bounded(downloadChunks({user:account,file,size,assertAccount:guard,onProgress:()=>{}}),180000,'Sync download timed out. Changes remain saved here.')
      :new Uint8Array(await bounded(storageApi.getBytes(file,limit),180000,'Sync download timed out. Changes remain saved here.'));
    guard();if(bytes.byteLength!==size||await hashBytes(bytes)!==hash)throw Error('A shared file failed its checksum.');
    const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
    guard();remember(hash,value,size);return value;
  }
  async function readHead(){
    guard();const head=parseHead(await bounded(firestore.getDocFromServer(headRef),20000,'Sync lookup timed out. Changes remain saved here.'));guard();return head;
  }
  async function read(){
    const head=await readHead();
    if(!head)return {head:null,graph:null};
    const manifest=await readObject(head.hash);
    if(manifest.schema!==1||!manifest.records||Array.isArray(manifest.records)||
      Object.keys(manifest.records).length>10000||!(manifest.parent===null||isHash(manifest.parent)))throw Error('Invalid shared planner manifest.');
    const graph=Object.create(null);
    for(const [key,hash] of Object.entries(manifest.records)){
      if(key.length>1024||!Array.isArray(JSON.parse(key)))throw Error('Invalid shared record identity.');
      graph[key]=await readObject(hash);
    }
    guard();return {head,graph};
  }
  async function prepare(graph,objects,parent){
    const nodes=new Map(objects),records=Object.create(null);
    for(const [key,value] of Object.entries(graph)){const hash=await hashJSON(value);nodes.set(hash,value);records[key]=hash;}
    if(Object.keys(records).length>10000)throw Error('This planner exceeds the sync record limit. Manual backups remain available.');
    const manifest={schema:1,parent:parent?.hash??null,records};
    const hash=await hashJSON(manifest);nodes.set(hash,manifest);
    return {parent,hash,nodes};
  }
  async function put(hash,value){
    guard();if(cache.has(hash))return;
    const bytes=jsonBytes(value);
    if(bytes.length>limit||await hashBytes(bytes)!==hash)throw Error('Invalid or oversized sync object.');
    const file=storageApi.ref(storage,path(hash));
    try {await readObject(hash);return;}
    catch(error){if(error.code!=='storage/object-not-found')throw error;}
    guard();
    const task=storageApi.uploadBytesResumable(file,bytes,{contentType:'application/json'});
    const off=task.on?.('state_changed',()=>{try{guard();}catch{task.cancel();}});
    try {await bounded(task,180000,'Sync upload timed out. Changes remain saved here.');guard();remember(hash,value,bytes.length);}
    catch(error){guard();try{await readObject(hash);}catch{throw error;}}
    finally{off?.();task.cancel?.();}
  }
  async function publish(candidate,assertLocal){
    for(const [hash,value] of candidate.nodes){guard();assertLocal();await put(hash,value);}
    guard();assertLocal();
    const head=await firestore.runTransaction(db,async transaction=>{
      guard();assertLocal();const current=parseHead(await transaction.get(headRef));guard();assertLocal();
      if(current?.hash===candidate.hash)return current;
      if((current?.revision??0)!==(candidate.parent?.revision??0)||current?.hash!==candidate.parent?.hash)throw new SyncMoved();
      const revision=(current?.revision??0)+1;
      transaction.set(headRef,{schema:1,revision,hash:candidate.hash,updatedAt:firestore.serverTimestamp()});
      return {revision,hash:candidate.hash};
    });guard();return head;
  }
  async function contains(head,hash){
    let cursor=head?.hash;
    for(let i=0;cursor&&i<50;i++){
      if(cursor===hash)return true;
      const manifest=await readObject(cursor);cursor=manifest.parent;
    }
    return false;
  }
  function watch(changed,failed){guard();return firestore.onSnapshot(headRef,{includeMetadataChanges:true},snapshot=>{
    try{guard();if(!snapshot.metadata.fromCache)changed();}catch(error){failed(error);}
  },failed);}
  return {read,head:readHead,readObject,prepare,publish,contains,watch,guard};
}
