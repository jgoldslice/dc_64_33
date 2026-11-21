'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const js=fs.readFileSync(path.join(__dirname,'../v76.js'),'utf8');
const first=js.indexOf("  const textboxButton=root.querySelector('.v812-textbox-button');");
const last=js.indexOf("  const validSizes=new Set(['small','medium','large']);",first);
if(first<0||last<0)throw Error('Text-size toolbar code missing');
const fragment=js.slice(first,last);

function node(tag='div'){
  const listeners={};const children=[];
  const n={
    tag,id:'',hidden:false,style:{},attributes:{},children,listeners,dataset:{},value:'medium',
    textContent:'',htmlFor:'',title:'',className:'',
    setAttribute(k,v){this.attributes[k]=v;},
    append(...nodes){children.push(...nodes);for(const node of nodes)node.parent=n;},
    before(child){this.previousSibling=child;},
    focus(){this.focusCount=(this.focusCount||0)+1;},
    dispatchEvent(event){listeners[event.type]?.(event);},
    addEventListener(name,fn){listeners[name]=fn;},
    contains(target){return target===n||children.some(c=>c.contains?.(target));},
    getBoundingClientRect(){return {left:250,right:287,top:60,bottom:100};},
    click(){listeners.click?.({target:this});}
  };
  return n;
}
function setup(){
  const button=node('button'),select=node('select'),body=node('body');
  const docListeners={},winListeners={};
  const root={querySelector:()=>button};
  const document={
    body,createElement:node,
    addEventListener(name,fn){docListeners[name]=fn;}
  };
  const window={addEventListener(name,fn){winListeners[name]=fn;}};
  const render=vm.runInNewContext(
    '(function(root,document,window,textSizeSelect,innerWidth,innerHeight){\n'+fragment+
      '\nreturn {textTool,textSizeTrigger,textSizeMenu,textSizeChoices,sizeButtons,hideTextSizeMenu};})',
    {Event:class Event{constructor(type){this.type=type;}}}
  );
  return {...render(root,document,window,select,1024,768),
    button,select,body,docListeners,winListeners};
}
test('Textbox icon retains its original mode action and owns a compact size dropdown',()=>{
  const x=setup();
  assert.equal(x.textTool.children[0],x.button);
  assert.equal(x.textTool.children[1],x.textSizeTrigger);
  assert.equal(x.textSizeMenu.children.at(-1),x.select);
  assert.equal(x.textSizeTrigger.attributes['aria-controls'],'v938TextSizeMenu');
  assert.equal(x.textSizeTrigger.attributes['aria-expanded'],'false');
  assert.equal(x.textSizeMenu.hidden,true);
  assert.equal(x.body.children.includes(x.textSizeMenu),true);
  assert.equal(x.textSizeTrigger.textContent,'A');
  assert.equal(x.select.hidden,true);
  assert.equal(x.select.attributes['aria-hidden'],'true');
  assert.equal(x.sizeButtons.length,3);
});
test('size chooser opens, closes on change, and preserves original select',()=>{
  const x=setup();
  x.textSizeTrigger.click();
  assert.equal(x.textSizeMenu.hidden,false);
  assert.equal(x.textSizeTrigger.attributes['aria-expanded'],'true');
  assert.equal(x.sizeButtons[1].focusCount,1);
  assert.equal(x.select.focusCount||0,0);
  x.sizeButtons[2].click();
  assert.equal(x.select.value,'large');
  assert.equal(x.textSizeMenu.hidden,true);
  assert.equal(x.textSizeTrigger.attributes['aria-expanded'],'false');
  x.textSizeTrigger.click();
  x.textSizeTrigger.click();
  assert.equal(x.textSizeMenu.hidden,true);
});
test('outside tap, Escape and scrolling dismiss the text size popover',()=>{
  const x=setup();
  x.textSizeTrigger.click();
  x.docListeners.pointerdown({target:node('outside')});
  assert.equal(x.textSizeMenu.hidden,true);
  x.textSizeTrigger.click();
  let prevented=false;
  x.docListeners.keydown({key:'Escape',preventDefault(){prevented=true;}});
  assert.equal(prevented,true);
  assert.equal(x.textSizeMenu.hidden,true);
  x.textSizeTrigger.click();
  x.docListeners.scroll();
  assert.equal(x.textSizeMenu.hidden,true);
});
