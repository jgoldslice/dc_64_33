'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../pencilkit-entry-v92.js'),'utf8');

function createApp(nativePromise,{web=false,missingPage=false}={}){
  const alerts=[],calls=[],handlers={};
  const button={
    setAttribute(){},addEventListener(event,handler){handlers[event]=handler;},
    click(){return handlers.click();}
  };
  let added=false;
  const toolbar={append(){added=true;}},status={textContent:''};
  const page={id:'page-a'},project={id:'project-z',notePages:[page]};
  const document={
    getElementById(id){
      if(id==='v76Editor')return {querySelector:()=>toolbar};
      if(id==='v92PencilKit')return added?button:null;
      if(id==='v81A11yStatus')return status;
      return null;
    },
    querySelector(selector){return selector==='#v76Editor .v76-toolbar'?toolbar:null;},
    createElement(){return button;}
  };
  const window={
    BlueprintNotesBridge:{current:()=>missingPage?null:{p:project,page}},
    Capacitor:web?undefined:{
      isNativePlatform:()=>true,
      nativePromise(plugin,method,args){calls.push({plugin,method,args});return nativePromise(method,args);}
    }
  };
  window.BlueprintSheet={allowInk:async()=>true};
  vm.runInNewContext(source,{document,window,alert:s=>alerts.push(s),confirm:()=>true,
    setTimeout:(fn,ms)=>setTimeout(fn,Math.min(ms,10)),clearTimeout});
  return {button,alerts,calls,status,added};
}

test('responds when native editor actually presents',async()=>{
  const app=createApp(method=>Promise.resolve(method==='capabilities'
    ?{available:true,schemaVersion:1}:{opened:true,pageId:'page-a'}));
  await app.button.click();
  assert.deepEqual(app.calls.map(c=>c.method),['capabilities','openEditor']);
  assert.equal(app.calls[1].args.projectId,'project-z');
  assert.equal(app.calls[1].args.pageId,'page-a');
  assert.equal(app.button.textContent,'Native ink');
  assert.equal(app.button.disabled,false);
  assert.match(app.status.textContent,/editor opened/);
});

test('unresolved native opening times out and resets the button',async()=>{
  const app=createApp(method=>method==='capabilities'
    ?Promise.resolve({available:true,schemaVersion:1}):new Promise(()=>{}));
  await app.button.click();
  assert.match(app.alerts[0],/No response from native openEditor/);
  assert.equal(app.button.disabled,false);
  assert.equal(app.button.textContent,'Native ink');
});

test('a stale close-to-resolve plugin does not falsely signal opened',async()=>{
  const app=createApp(method=>Promise.resolve(method==='capabilities'
    ?{available:true,schemaVersion:1}:{saved:true,pageId:'page-a'}));
  await app.button.click();
  assert.match(app.alerts[0],/did not confirm its presentation/);
  assert.equal(app.button.disabled,false);
});

test('native capability errors are surfaced',async()=>{
  const app=createApp(()=>Promise.reject(Error('no capabilities')));
  await app.button.click();
  assert.match(app.alerts[0],/no capabilities/);
  assert.equal(app.button.disabled,false);
});

test('no native button on the web and no native call without a page',async()=>{
  const web=createApp(()=>{throw Error('unexpected')},{web:true});
  assert.equal(web.added,false);
  const app=createApp(()=>{throw Error('unexpected')},{missingPage:true});
  await app.button.click();
  assert.equal(app.calls.length,0);
  assert.match(app.alerts[0],/Open a project Notes page/);
});
