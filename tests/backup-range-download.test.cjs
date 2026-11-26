const {test}=require('node:test');
const assert=require('node:assert/strict');
const api=import('../blueprint-cloud-backup.mjs');

function fixture(mode='') {
  const source=new Uint8Array(2*1024*1024+13);
  for(let i=0;i<source.length;i++)source[i]=i%251;
  const requests=[], progress=[];
  let owner=true;
  const args={user:{getIdToken:async()=> 'fixture-token'},file:{bucket:'fixture.test',fullPath:'users/owner/backups/id/archive.json'},
    size:source.length,assertAccount:()=>{if(!owner)throw Error('Account changed');},
    onProgress:(loaded)=>progress.push(loaded),
    createRequest:()=> {
      const request={headers:{},open(method,url){this.method=method;this.url=url;},
        setRequestHeader(key,value){this.headers[key]=value;},abort(){this.aborted=true;},
        getResponseHeader(){return this.range;},send(){
          requests.push(this);
          queueMicrotask(()=>{
            if(mode==='timeout'){this.ontimeout();return;}
            if(mode==='account')owner=false;
            const [,startText,endText]=/bytes=(\d+)-(\d+)/.exec(this.headers.Range);
            const start=Number(startText),end=Number(endText);
            this.status=mode==='denied'?403:206;
            this.range=mode==='wrong-range'?'bytes 0-1/2':`bytes ${start}-${end}/${source.length}`;
            this.response=source.slice(start,end+1).buffer;
            this.onprogress?.({loaded:mode==='overflow'?end-start+2:end-start+1});
            this.onload?.();
          });
        }};
      return request;
    }};
  return {args,source,requests,progress};
}

test('authenticated ranges reconstruct a multi-MiB backup and report byte progress',async()=>{
  const {downloadBackupChunks}=await api,f=fixture();
  const bytes=await downloadBackupChunks(f.args);
  assert.deepEqual(bytes,f.source);
  assert.equal(f.requests.length,3);
  assert.equal(f.requests[0].headers.Authorization,'Firebase fixture-token');
  assert.equal(f.requests[0].headers.Range,'bytes=0-1048575');
  assert.equal(f.progress.at(-1),f.source.length);
  assert.ok(f.requests.every(r=>r.url.startsWith('https://firebasestorage.googleapis.com/')));
  assert.ok(f.requests.every(r=>!r.url.includes('fixture-token')));
});

test('range failures abort without returning a partial backup',async()=>{
  const {downloadBackupChunks}=await api;
  for(const [mode,message] of [['timeout',/stopped/],['account',/Account changed/],
    ['wrong-range',/incomplete/],['overflow',/expected size/],['denied',/could not access/]]){
    const f=fixture(mode);
    await assert.rejects(downloadBackupChunks(f.args),message);
    assert.equal(f.requests.length,1);
    assert.equal(f.requests[0].aborted,true);
  }
});
