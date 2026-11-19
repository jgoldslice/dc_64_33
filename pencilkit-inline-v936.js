'use strict';
/* Opt-in in-page PKCanvasView overlay. SVG/text/image records are never migrated.
   Requires native BlueprintPencil capabilities.embeddedAvailable === true. */
(function(){
  const native=window.Capacitor;
  const notes=window.BlueprintNotesBridge;
  const oldButton=document.getElementById('v92PencilKit');
  const surface=document.getElementById('v76Surface');
  const viewport=document.getElementById('v815ZoomViewport');
  const pane=document.getElementById('projectNotes');
  const root=notes?.root;
  const focusBar=document.getElementById('v928FocusBar');
  const focusTools=document.getElementById('v928FocusTools');
  const focusMenu=document.getElementById('v928FocusMenu');
  if(!native?.isNativePlatform?.()||typeof native.nativePromise!=='function'||
     !notes||!oldButton||!surface||!viewport||!pane||!root)return;

  const invoke=(method,args={})=>native.nativePromise('BlueprintPencil',method,args);
  let supported=false,active=false,mounted=false,accepted=false;
  let lastPayload='',pending=false,running=null,scheduled=false;
  const button=document.createElement('button');
  button.type='button';
  button.id='v936InlineInk';
  button.className='v92-native-ink-primary';
  button.textContent='PencilKit';
  button.title='Enable native PencilKit drawing';
  button.setAttribute('aria-label','Enable native PencilKit drawing');
  button.setAttribute('aria-pressed','false');
  button.hidden=true;
  // Focus relocates the Notes root outside #projectNotes. It needs a native
  // mode switch in its own compact header, not the hidden SVG tool menu.
  const focusInkButton=document.createElement('button');
  focusInkButton.type='button';
  focusInkButton.id='v937FocusNativeInk';
  focusInkButton.hidden=true;
  focusInkButton.setAttribute('aria-label','Draw using native PencilKit');

  function status(message){
    const live=document.getElementById('v81A11yStatus');
    if(live)live.textContent=message;
  }
  function label(){
    // Keep a single stable name in regular and Focus toolbars. Native ink
    // state is conveyed by highlight and aria-pressed, not a changing label.
    button.textContent='PencilKit';
    button.setAttribute('aria-pressed',String(active));
    button.setAttribute('aria-label',active
      ?'Turn off PencilKit drawing to edit Blueprint content'
      :'Enable PencilKit drawing on this page');
    button.title=active?'PencilKit on — tap to edit text and images':
      'PencilKit off — tap to draw';
    focusInkButton.textContent='PencilKit';
    focusInkButton.setAttribute('aria-pressed',String(active));
    focusInkButton.setAttribute('aria-label',active
      ?'Turn off PencilKit drawing to edit Blueprint content'
      :'Enable PencilKit drawing in Focus');
    focusInkButton.title=button.title;
  }
  function rect(r){
    return {x:Math.round((r.left??r.x)*2)/2,y:Math.round((r.top??r.y)*2)/2,
      width:Math.round(r.width*2)/2,height:Math.round(r.height*2)/2};
  }
  function geometry(){
    const ctx=notes.current?.();
    if(!ctx?.p||!ctx?.page||!surface.getClientRects().length)return null;
    const box=surface.getBoundingClientRect();
    const v=viewport.getBoundingClientRect();
    // Focus moves #v76Editor into <body> and hides the former #projectNotes
    // ancestor. Clipping against that old container produced an empty rect
    // and removed the native overlay (including its PKToolPicker).
    const inFocus=root.classList.contains('v928-focus-mode');
    const n=(inFocus?root:pane).getBoundingClientRect();
    const left=Math.max(0,box.left,v.left,n.left);
    const top=Math.max(0,box.top,v.top,n.top);
    const right=Math.min(window.innerWidth,box.right,v.right,n.right);
    const bottom=Math.min(window.innerHeight,box.bottom,v.bottom,n.bottom);
    if(right-left<=2||bottom-top<=2||surface.clientWidth<1||surface.clientHeight<1)return null;
    return {
      projectId:String(ctx.p.id),pageId:String(ctx.page.id),
      surface:rect(box),clip:rect({left,top,width:right-left,height:bottom-top}),
      logicalWidth:surface.clientWidth,logicalHeight:surface.clientHeight,
      editing:active,focused:inFocus
    };
  }
  async function sync(){
    const payload=geometry();
    if(!payload){
      if(mounted){
        await invoke('hideInline');
        mounted=false;
        lastPayload='';
      }
      return false;
    }
    const key=JSON.stringify(payload);
    if(key!==lastPayload||!mounted){
      const result=await invoke('showInline',payload);
      if(result?.visible!==true||result?.embedded!==true)
        throw Error('Native PencilKit did not confirm the in-page drawing view.');
      mounted=true;
      lastPayload=key;
    }
    return true;
  }
  function refresh(){
    if(!supported)return Promise.resolve(false);
    pending=true;
    if(running)return running;
    running=(async()=>{
      let visible=false;
      do{
        pending=false;
        visible=await sync();
      }while(pending);
      return visible;
    })().finally(()=>{running=null;});
    return running;
  }
  function stopWithError(error){
    const message='In-page PencilKit unavailable: '+(error?.message||String(error));
    status(message);
    console.error('BLUEPRINT PENCIL INLINE:',error);
    // Preserve a functioning full-screen editor if the overlay cannot load.
    supported=false;
    active=false;
    button.hidden=true;
    focusInkButton.hidden=true;
    document.body.classList.remove('v937-pencilkit-native');
    if(focusTools)focusTools.hidden=false;
    oldButton.hidden=false;
    invoke('hideInline').catch(err=>console.warn('PencilKit cleanup failed:',err));
    return message;
  }
  function schedule(){
    if(!supported||scheduled)return;
    scheduled=true;
    (window.requestAnimationFrame||((fn)=>setTimeout(fn,16)))(()=>{
      scheduled=false;
      refresh().catch(stopWithError);
    });
  }
  async function setDrawingEnabled(next){
    if(button.disabled)return;
    if(!accepted){
      if(!confirm('In-page PencilKit is experimental. Native drawings are saved locally but are not part of Blueprint complete backups or sync. Use a disposable test project. Continue?'))return;
      accepted=true;
    }
    const previous=active;
    active=next;
    if(active)notes.setMode?.('select');
    label();
    button.disabled=true;
    focusInkButton.disabled=true;
    try{
      if(!(await refresh())){
        throw Error('Open a visible project Notes page first.');
      }
      status(active?'PencilKit drawing enabled. Tap PencilKit again to edit text and images.':
        'PencilKit drawing paused. Blueprint text and image editing enabled.');
    }catch(error){
      active=previous;
      label();
      alert(stopWithError(error));
    }finally{
      button.disabled=false;
      focusInkButton.disabled=false;
    }
  }
  button.addEventListener('click',()=>setDrawingEnabled(!active));
  focusInkButton.addEventListener('click',()=>setDrawingEnabled(!active));

  function focusChanged(entering){
    if(!supported)return false;
    // The root has already been moved before this hook runs, so its
    // new geometry is reflected by the next native showInline request.
    if(entering&&!active){
      void setDrawingEnabled(true);
    }else{
      schedule();
    }
    return true;
  }

  function watch(){
    window.addEventListener('scroll',schedule,true);
    window.addEventListener('blueprint:notes-viewport-change',schedule);
    // The native PKCanvasView receives finger gestures above the WKWebView;
    // forward them to the existing Notes zoom/scroll engine. Ignore stale
    // events arriving after a project/page switch or when drawing is paused.
    window.addEventListener('blueprint:pencil-navigation',event=>{
      if(!supported||!active)return;
      const detail=event.detail||{},ctx=notes.current?.();
      if(detail.pageId&&String(detail.pageId)!==String(ctx?.page?.id))return;
      if(detail.projectId&&String(detail.projectId)!==String(ctx?.p?.id))return;
      if(notes.handlePencilViewportGesture?.(detail))schedule();
    });
    document.addEventListener('scroll',schedule,true);
    window.addEventListener('resize',schedule);
    window.addEventListener('orientationchange',schedule);
    // Explicitly refresh after Notes is reparented in/out of Focus, even
    // when neither the viewport nor the sheet's dimensions have changed.
    window.addEventListener('blueprint:notes-focus-change',event=>{
      focusChanged(!!event.detail?.focused);
    });
    window.visualViewport?.addEventListener('resize',schedule);
    window.visualViewport?.addEventListener('scroll',schedule);
    document.addEventListener('visibilitychange',schedule);
    document.getElementById('v76PageSelect')?.addEventListener('change',schedule);
    // Page controls and nav are DOM-driven; update after their click handlers.
    document.addEventListener('click',event=>{
      const target=event.target?.closest?.(
        '[data-v76-mode="text"],#v76AddImage,#v92LegacyInkTools');
      if(target&&active){
        active=false;
        label();
      }
      schedule();
      setTimeout(schedule,80);
    },true);
    if(typeof ResizeObserver==='function'){
      const observer=new ResizeObserver(schedule);
      [surface,viewport,pane].forEach(node=>observer.observe(node));
    }
    if(typeof MutationObserver==='function'){
      const observer=new MutationObserver(schedule);
      const pages=document.getElementById('v811PageList');
      if(pages)observer.observe(pages,{childList:true});
      observer.observe(pane,{attributes:true,attributeFilter:['class','style','hidden']});
      const workspace=document.getElementById('projectWorkspace');
      if(workspace)observer.observe(workspace,
        {attributes:true,attributeFilter:['class','style','hidden']});
      const brainstorm=document.getElementById('brainstorm');
      if(brainstorm)observer.observe(brainstorm,
        {attributes:true,attributeFilter:['class','style','hidden']});
      observer.observe(root,{attributes:true,attributeFilter:['class','style','hidden']});
    }
    schedule();
  }

  invoke('capabilities').then(capabilities=>{
    if(capabilities?.available!==true||capabilities?.schemaVersion!==1||
       capabilities?.embeddedAvailable!==true)return;
    supported=true;
    const group=oldButton.parentElement;
    group.insertBefore(button,oldButton);
    oldButton.hidden=true;
    button.hidden=false;
    // Keep the SVG editor and its saved data as a fallback. PencilKit's
    // own PKToolPicker is the sole visible ink toolbar on capable iPads.
    document.body.classList.add('v937-pencilkit-native');
    if(focusBar){
      const exit=focusBar.querySelector('#v928FocusExit');
      focusBar.insertBefore(focusInkButton,exit||null);
      focusInkButton.hidden=false;
    }
    if(focusTools)focusTools.hidden=true;
    if(focusMenu)focusMenu.hidden=true;
    window.BlueprintPencilInline={isAvailable:()=>supported,focusChanged,
      isDrawing:()=>active};
    label();
    watch();
    if(root.classList.contains('v928-focus-mode'))focusChanged(true);
  }).catch(()=>{}); // Older installed binaries retain the working full-screen editor.
})();
