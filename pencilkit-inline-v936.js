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
  if(!native?.isNativePlatform?.()||typeof native.nativePromise!=='function'||
     !notes||!oldButton||!surface||!viewport||!pane)return;

  const invoke=(method,args={})=>native.nativePromise('BlueprintPencil',method,args);
  let supported=false,active=false,mounted=false,accepted=false;
  let lastPayload='',pending=false,running=null,scheduled=false;
  const button=document.createElement('button');
  button.type='button';
  button.id='v936InlineInk';
  button.className='v92-native-ink-primary';
  button.textContent='Draw on page';
  button.title='Draw directly on this Notes page using Apple PencilKit';
  button.setAttribute('aria-label','Draw on page with native PencilKit');
  button.setAttribute('aria-pressed','false');
  button.hidden=true;

  function status(message){
    const live=document.getElementById('v81A11yStatus');
    if(live)live.textContent=message;
  }
  function label(){
    button.textContent=active?'Edit content':'Draw on page';
    button.setAttribute('aria-pressed',String(active));
    button.title=active?'Turn off PencilKit drawing to edit Blueprint objects':
      'Draw on this page using native PencilKit';
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
    const n=pane.getBoundingClientRect();
    const left=Math.max(0,box.left,v.left,n.left);
    const top=Math.max(0,box.top,v.top,n.top);
    const right=Math.min(window.innerWidth,box.right,v.right,n.right);
    const bottom=Math.min(window.innerHeight,box.bottom,v.bottom,n.bottom);
    if(right-left<=2||bottom-top<=2||surface.clientWidth<1||surface.clientHeight<1)return null;
    return {
      projectId:String(ctx.p.id),pageId:String(ctx.page.id),
      surface:rect(box),clip:rect({left,top,width:right-left,height:bottom-top}),
      logicalWidth:surface.clientWidth,logicalHeight:surface.clientHeight,
      editing:active
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
  button.addEventListener('click',async()=>{
    if(button.disabled)return;
    if(!accepted){
      if(!confirm('In-page PencilKit is experimental. Native drawings are saved locally but are not part of Blueprint complete backups or sync. Use a disposable test project. Continue?'))return;
      accepted=true;
    }
    const previous=active;
    active=!active;
    if(active)notes.setMode?.('select');
    label();
    button.disabled=true;
    try{
      if(!(await refresh())){
        throw Error('Open a visible project Notes page first.');
      }
      status(active?'PencilKit drawing on this page. Tap Edit content for text/images.':
        'Blueprint text and image editing enabled. Native ink remains visible.');
    }catch(error){
      active=previous;
      label();
      alert(stopWithError(error));
    }finally{
      button.disabled=false;
    }
  });

  function watch(){
    window.addEventListener('scroll',schedule,true);
    document.addEventListener('scroll',schedule,true);
    window.addEventListener('resize',schedule);
    window.addEventListener('orientationchange',schedule);
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
    label();
    watch();
  }).catch(()=>{}); // Older installed binaries retain the working full-screen editor.
})();
