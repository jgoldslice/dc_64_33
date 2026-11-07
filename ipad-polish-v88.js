'use strict';
/* Canvas v8.8 — lightweight DOM/touch refinements; no saved-note mutations. */
(function(){
  const brainstorm=document.getElementById('brainstorm');
  const workspace=document.getElementById('projectWorkspace');
  const notes=document.getElementById('projectNotes');
  const pad=document.getElementById('v815ZoomViewport');
  const page=document.getElementById('v76Surface');
  const root=document.getElementById('v76Editor');
  if(!brainstorm||!workspace||!notes||!pad||!page||!root)return;

  const tablet=window.matchMedia('(min-width:740px) and (min-height:600px)');
  let scheduled=false;
  function noteVisible(){
    return tablet.matches && brainstorm.classList.contains('active') &&
      !workspace.hidden && !notes.hidden;
  }
  function fitNotebook(){
    scheduled=false;
    const active=noteVisible();
    document.body.classList.toggle('canvas-v88-notes-fit',active);
    if(!active){pad.style.removeProperty('--v88-pad-height');return;}
    const visual=window.visualViewport;
    const bottom=visual
      ?Math.min(window.innerHeight,visual.offsetTop+visual.height)
      :window.innerHeight;
    const top=pad.getBoundingClientRect().top;
    // Leave a little room for the safe area and the rounded notebook border.
    const height=Math.max(240,Math.floor(bottom-top-14));
    const next=height+'px';
    if(pad.style.getPropertyValue('--v88-pad-height')!==next){
      pad.style.setProperty('--v88-pad-height',next);
    }
  }
  function scheduleFit(){
    if(scheduled)return;
    scheduled=true;requestAnimationFrame(fitNotebook);
  }
  const observer=new MutationObserver(scheduleFit);
  observer.observe(brainstorm,{attributes:true,attributeFilter:['class']});
  observer.observe(workspace,{attributes:true,attributeFilter:['hidden']});
  observer.observe(notes,{attributes:true,attributeFilter:['hidden']});
  window.addEventListener('resize',scheduleFit,{passive:true});
  window.addEventListener('orientationchange',scheduleFit,{passive:true});
  window.visualViewport?.addEventListener('resize',scheduleFit,{passive:true});
  tablet.addEventListener?.('change',scheduleFit);
  root.addEventListener('click',scheduleFit);
  scheduleFit();

  // Safari sometimes selects underlying text on a pencil-down, especially
  // if a note box was previously being edited. Only suppress it outside
  // genuine text-edit mode; selecting and copying typed text still works.
  function drawing(){return page.classList.contains('v76-is-drawing');}
  function editableTarget(node){
    const el=node instanceof Element?node:node?.parentElement;
    return !!el?.closest('.v76-item.v811-editing .v76-rich') && !drawing();
  }
  function withinPage(node){return !!node && (node===page||page.contains(node));}
  root.addEventListener('selectstart',e=>{
    if(withinPage(e.target)&&!editableTarget(e.target))e.preventDefault();
  },true);
  root.addEventListener('contextmenu',e=>{
    if(withinPage(e.target)&&!editableTarget(e.target))e.preventDefault();
  },true);
  document.addEventListener('selectionchange',()=>{
    const sel=window.getSelection();
    if(sel?.rangeCount && drawing() && withinPage(sel.anchorNode)){
      sel.removeAllRanges();
    }
  });
  root.addEventListener('click',e=>{
    const control=e.target instanceof Element
      ?e.target.closest('[data-v76-mode="pen"],[data-v76-mode="erase"]'):null;
    if(!control||!drawing())return;
    // Close an earlier text edit before the user writes ink over the box.
    const editor=page.querySelector('.v76-item.v811-editing .v76-rich');
    if(editor)editor.blur();
    const sel=window.getSelection();
    if(sel?.rangeCount&&withinPage(sel.anchorNode))sel.removeAllRanges();
  });
})();
