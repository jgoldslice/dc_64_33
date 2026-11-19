'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const inline=fs.readFileSync(path.join(__dirname,'../pencilkit-inline-v936.js'),'utf8');
const workspace=fs.readFileSync(path.join(__dirname,'../notes-workspace-v928.js'),'utf8');

function element(name,b={left:0,top:0,right:800,bottom:900,width:800,height:900}){
  const handlers={},styles=new Set();
  return {
    name,handlers,hidden:false,disabled:false,textContent:'',children:[],
    attrs:{},clientWidth:b.width||800,clientHeight:b.height||900,
    classList:{add:x=>styles.add(x),remove:x=>styles.delete(x),
      contains:x=>styles.has(x)},
    getClientRects(){return this.hidden?[]:[{}];},
    getBoundingClientRect(){return this.rect||b;},
    addEventListener(name,callback){handlers[name]=callback;},
    setAttribute(name,value){this.attrs[name]=value;},
    insertBefore(child){this.children.push(child);},
    append(child){this.children.push(child);},
    querySelector(){return null;},
    click(){return handlers.click?.();}
  };
}
function setup(embedded=true){
  const calls=[],frames=[],events={},alerts=[],modes=[];
  const root=element('root',{left:0,top:0,right:1400,bottom:1100,width:1400,height:1100});
  const pane=element('pane',{left:200,top:0,right:1400,bottom:1100,width:1200,height:1100});
  const surface=element('surface',{left:500,top:200,right:1300,bottom:1200,width:800,height:1000});
  const viewport=element('viewport',{left:500,top:200,right:1300,bottom:1030,width:800,height:830});
  const old=element('old'),group=element('group'),bar=element('bar');
  const tools=element('tools'),menu=element('menu'),legacy=element('legacy');
  old.parentElement=group;
  bar.querySelector=()=>element('exit');
  const nodes={v92PencilKit:old,v76Surface:surface,v815ZoomViewport:viewport,
    projectNotes:pane,v928FocusBar:bar,v928FocusTools:tools,
    v928FocusMenu:menu,v92LegacyInkTools:legacy,
    v81A11yStatus:element('status'),v76PageSelect:element('select'),
    v811PageList:element('list'),projectWorkspace:element('workspace'),
    brainstorm:element('brainstorm')};
  const body={classList:{
    values:new Set(),add(k){this.values.add(k);},remove(k){this.values.delete(k);},
    contains(k){return this.values.has(k);}
  }};
  const window={
    innerWidth:1400,innerHeight:1100,
    requestAnimationFrame:fn=>frames.push(fn),addEventListener:(k,fn)=>events[k]=fn,
    Capacitor:{isNativePlatform:()=>true,
      nativePromise:(_name,method,args)=>{
        calls.push({method,args});
        if(method==='capabilities')return Promise.resolve({
          available:true,schemaVersion:1,embeddedAvailable:embedded
        });
        return Promise.resolve(method==='showInline'?{visible:true,embedded:true}:{hidden:true});
      }},
    BlueprintNotesBridge:{root,current:()=>({
      p:{id:'project-A',notePages:[{id:'page-A'}]},
      page:{id:'page-A'}
    }),setMode:mode=>modes.push(mode)}
  };
  const document={body,getElementById:id=>nodes[id]||null,
    createElement:()=>element('button'),addEventListener(){}};
  window.BlueprintSheet={allowInk:async()=>true};
  vm.runInNewContext(inline,{window,document,confirm:()=>true,
    alert:message=>alerts.push(message),setTimeout:()=>1,
    console:{error(){},warn(){}}});
  async function settle(){
    for(let i=0;i<15;i++)await Promise.resolve();
    let guard=0;
    while(frames.length&&guard++<12){
      frames.shift()();
      for(let i=0;i<20;i++)await Promise.resolve();
    }
  }
  return {root,pane,old,bar,tools,body,nodes,calls,events,alerts,modes,settle};
}

test('Focus retains inline native drawing after moving Notes outside hidden pane',async()=>{
  const a=setup(true);
  await a.settle();
  assert.equal(a.body.classList.contains('v937-pencilkit-native'),true);
  assert.equal(a.tools.hidden,true);
  assert.equal(a.old.hidden,true);
  const before=a.calls.filter(c=>c.method==='showInline').at(-1).args;
  assert.equal(before.focused,false);
  a.root.classList.add('v928-focus-mode');
  a.pane.rect={left:200,top:0,right:200,bottom:0,width:0,height:0};
  a.events['blueprint:notes-focus-change']({detail:{focused:true}});
  await a.settle();
  const focused=a.calls.filter(c=>c.method==='showInline').at(-1).args;
  assert.equal(focused.focused,true);
  assert.equal(focused.editing,true);
  assert.ok(focused.clip.width>0);
  assert.equal(a.bar.children[0].id,'v937FocusNativeInk');
  assert.equal(a.bar.children[0].textContent,'PencilKit');
  assert.equal(a.bar.children[0].attrs['aria-pressed'],'true');
  assert.deepEqual(a.modes,['select']);
  assert.ok(!a.calls.some(c=>c.method==='openEditor'));
  await a.bar.children[0].click();
  assert.equal(a.calls.filter(c=>c.method==='showInline').at(-1).args.editing,false);
  assert.equal(a.bar.children[0].textContent,'PencilKit');
  assert.equal(a.bar.children[0].attrs['aria-pressed'],'false');
  a.root.classList.remove('v928-focus-mode');
  delete a.pane.rect;
  a.events['blueprint:notes-focus-change']({detail:{focused:false}});
  await a.settle();
  assert.equal(a.calls.filter(c=>c.method==='showInline').at(-1).args.focused,false);
  assert.deepEqual(a.alerts,[]);
});

test('older native plugin leaves the existing full-screen and web controls in place',async()=>{
  const a=setup(false);
  await a.settle();
  assert.equal(a.old.hidden,false);
  assert.equal(a.bar.children.length,0);
  assert.equal(a.tools.hidden,false);
  assert.equal(a.body.classList.contains('v937-pencilkit-native'),false);
  assert.equal(a.calls.filter(c=>c.method==='showInline').length,0);
});

test('Focus enter and exit notify native overlay and avoid legacy pen on supported iOS',()=>{
  assert.match(workspace,/blueprint:notes-focus-change/);
  assert.match(workspace,/isAvailable\?\.\(\)/);
  assert.match(workspace,/api\.setMode\('select'\)/);
});
