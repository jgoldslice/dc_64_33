'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../pencilkit-entry-v92.js'),'utf8');

function element(tag){
  const names=new Set();
  const handlers={};
  return {
    tag,children:[],attributes:{},hidden:false,disabled:false,textContent:'',
    classList:{
      add(name){names.add(name);},
      toggle(name,on){
        const active=on===undefined?!names.has(name):!!on;
        if(active)names.add(name);else names.delete(name);
      },
      contains(name){return names.has(name);}
    },
    setAttribute(name,value){this.attributes[name]=value;},
    append(child){this.children.push(child);},
    addEventListener(name,fn){handlers[name]=fn;},
    click(){return handlers.click?.();}
  };
}

function harness(nativePromise){
  const penGroup=element('pen-group');
  const saveGroup=element('save-group');
  const pen=element('pen');
  pen.closest=()=>penGroup;
  const saveButton=element('save');
  saveButton.closest=()=>saveGroup;
  const host=element('toolbar');
  const inserts=[];
  host.querySelector=selector=>selector==='[data-v76-mode="pen"]'?pen:selector==='#v819SaveSketch'?saveButton:null;
  host.insertBefore=(newNode,oldNode)=>inserts.push([newNode,oldNode]);
  const page={id:'page-7'};
  const project={id:'project-9',notePages:[page]};
  const selection=[],calls=[],alerts=[];
  const view={
    BlueprintNotesBridge:{
      current:()=>({p:project,page}),
      setMode:mode=>selection.push(mode)
    },
    Capacitor:{
      isNativePlatform:()=>true,
      nativePromise:(_,method,args)=>{
        calls.push(method);
        return nativePromise(method,args);
      }
    }
  };
  const status={textContent:''};
  const doc={
    querySelector:()=>host,
    getElementById:id=>id==='v92PencilKit'?null:id==='v81A11yStatus'?status:null,
    createElement:element
  };
  view.BlueprintSheet={allowInk:async()=>true};
  vm.runInNewContext(source,{window:view,document:doc,confirm:()=>true,
    alert:message=>alerts.push(message),setTimeout,clearTimeout});
  const group=inserts[0]?.[0];
  const button=group?.children[0];
  return {penGroup,saveGroup,group,button,inserts,calls,alerts,selection,status};
}

const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('native-capable iPad replaces duplicate web ink controls, preserves other tools',async()=>{
  const a=harness(method=>Promise.resolve(method==='capabilities'
    ?{available:true,schemaVersion:1,embeddedAvailable:true}:{opened:true}));
  await tick();
  assert.equal(a.inserts.length,1);
  assert.equal(a.inserts[0][1],a.penGroup);
  assert.equal(a.penGroup.classList.contains('v92-web-ink-collapsed'),true);
  assert.equal(a.saveGroup.classList.contains('v92-web-ink-collapsed'),true);
  assert.equal(a.group.children.length,1); // No extra Web tools button.
  assert.deepEqual(a.selection,['select']);
  await a.button.click();
  assert.equal(a.button.textContent,'Native ink');
  assert.equal(a.button.disabled,false);
  assert.match(a.status.textContent,/editor opened/);
});

test('older full-screen native plugin keeps the original web SVG tools',async()=>{
  const a=harness(()=>Promise.resolve({available:true,schemaVersion:1}));
  await tick();
  assert.equal(a.penGroup.classList.contains('v92-web-ink-collapsed'),false);
  assert.equal(a.saveGroup.classList.contains('v92-web-ink-collapsed'),false);
  assert.equal(a.group.children.length,1);
  assert.equal(a.selection.length,0);
});

test('unavailable PencilKit never hides old SVG tools',async()=>{
  const a=harness(()=>Promise.reject(Error('old build')));
  await tick();
  assert.equal(a.penGroup.classList.contains('v92-web-ink-collapsed'),false);
  assert.equal(a.saveGroup.classList.contains('v92-web-ink-collapsed'),false);
  assert.equal(a.group.children.length,1);
  assert.equal(a.selection.length,0);
});

test('older native plugin capability schema preserves web ink tools',async()=>{
  const a=harness(()=>Promise.resolve({available:true,schemaVersion:0}));
  await tick();
  assert.equal(a.penGroup.classList.contains('v92-web-ink-collapsed'),false);
  assert.equal(a.group.children.length,1);
});