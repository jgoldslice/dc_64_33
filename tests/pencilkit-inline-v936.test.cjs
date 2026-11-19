'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../pencilkit-inline-v936.js'),'utf8');

function element(id,bounds={}){
  const handlers={},attributes={};
  return {
    id,handlers,attributes,hidden:false,textContent:'',disabled:false,
    clientWidth:bounds.width||800,clientHeight:bounds.height||1000,
    setAttribute(name,value){attributes[name]=value;},
    addEventListener(name,fn){handlers[name]=fn;},
    click(){return handlers.click?.();},
    getClientRects(){return bounds.hidden?[]:[1];},
    getBoundingClientRect(){
      const left=bounds.left??0,top=bounds.top??0;
      const width=bounds.width??800,height=bounds.height??1000;
      return {left,top,width,height,right:left+width,bottom:top+height};
    }
  };
}
function makeApp(embeddedAvailable=true){
  const calls=[],frames=[],alerts=[],modeCalls=[];
  const old=element('v92PencilKit'),group=element('group');
  const buttons=[];group.insertBefore=child=>buttons.push(child);old.parentElement=group;
  const surface=element('v76Surface',{left:450,top:150,width:800,height:1000});
  const viewport=element('v815ZoomViewport',{left:450,top:150,width:800,height:800});
  const pane=element('projectNotes',{left:200,top:0,width:1300,height:1000});
  const pageA={id:'pageA'},pageB={id:'pageB'};
  const project={id:'projectA',notePages:[pageA,pageB]};
  const context={p:project,page:pageA};
  const nodes={v92PencilKit:old,v76Surface:surface,v815ZoomViewport:viewport,
    projectNotes:pane,v81A11yStatus:element('status'),
    v76PageSelect:element('selector'),v811PageList:element('list'),
    projectWorkspace:element('workspace'),brainstorm:element('brainstorm')};
  const window={
    innerWidth:1400,innerHeight:1000,
    Capacitor:{
      isNativePlatform:()=>true,
      nativePromise:(plugin,method,args)=>{
        calls.push({plugin,method,args});
        if(method==='capabilities')return Promise.resolve({
          available:true,schemaVersion:1,embeddedAvailable
        });
        if(method==='showInline')return Promise.resolve({visible:true,embedded:true});
        return Promise.resolve({hidden:true});
      }
    },
    BlueprintNotesBridge:{current:()=>context,setMode:mode=>modeCalls.push(mode)},
    addEventListener(){},
    requestAnimationFrame:fn=>frames.push(fn)
  };
  const document={getElementById:id=>nodes[id]||null,
    createElement:()=>element('button'),addEventListener(){}};
  vm.runInNewContext(src,{window,document,confirm:()=>true,
    alert:msg=>alerts.push(msg),setTimeout:()=>0,console});
  async function settle(){
    for(let i=0;i<20;i++)await Promise.resolve();
    while(frames.length){
      frames.shift()();
      for(let i=0;i<20;i++)await Promise.resolve();
    }
  }
  return {old,buttons,nodes,calls,modeCalls,alerts,context,pageA,pageB,settle};
}
test('renders native ink over the current Notes page, not a modal',async()=>{
  const x=makeApp(true);await x.settle();
  assert.equal(x.old.hidden,true);
  const button=x.buttons[0];
  assert.equal(button.textContent,'PencilKit');
  assert.equal(button.attributes['aria-pressed'],'false');
  assert.equal(x.calls.filter(c=>c.method==='showInline').length,1);
  assert.equal(x.calls.at(-1).args.pageId,'pageA');
  assert.equal(x.calls.at(-1).args.editing,false);
  await button.click();
  assert.equal(button.textContent,'PencilKit');
  assert.equal(button.attributes['aria-pressed'],'true');
  assert.equal(x.calls.at(-1).method,'showInline');
  assert.equal(x.calls.at(-1).args.editing,true);
  assert.ok(!x.calls.some(c=>c.method==='openEditor'));
  await button.click();
  assert.equal(x.calls.at(-1).args.editing,false);
  assert.equal(button.textContent,'PencilKit');
  assert.equal(button.attributes['aria-pressed'],'false');
});
test('native ink tracks page switching and hides when Notes leaves view',async()=>{
  const x=makeApp(true);await x.settle();await x.buttons[0].click();
  x.context.page=x.pageB;x.nodes.v76PageSelect.handlers.change();
  await x.settle();
  assert.equal(x.calls.filter(c=>c.method==='showInline').at(-1).args.pageId,'pageB');
  x.nodes.v76Surface.getClientRects=()=>[];
  x.nodes.v76PageSelect.handlers.change();
  await x.settle();
  assert.ok(x.calls.some(c=>c.method==='hideInline'));
});
test('older installed Swift plugin keeps full-screen editor available',async()=>{
  const x=makeApp(false);await x.settle();
  assert.equal(x.old.hidden,false);
  assert.equal(x.buttons.length,0);
  assert.equal(x.calls.filter(c=>c.method==='showInline').length,0);
});
