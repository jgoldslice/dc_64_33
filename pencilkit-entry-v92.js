'use strict';
/* Native PencilKit test entry. Does not migrate SVG notes or native backup data. */
(function(){
  const native=window.Capacitor;
  if(!native?.isNativePlatform?.()||typeof native.nativePromise!=='function')return;
  const host=document.querySelector('#v76Editor .v76-toolbar')||
             document.querySelector('#projectWorkspace .v82-project-header-actions');
  if(!host||document.getElementById('v92PencilKit'))return;
  const button=document.createElement('button');
  button.type='button';
  button.id='v92PencilKit';
  button.className='secondary-button v92-native-pencil-entry';
  button.textContent='Native ink';
  button.title='Open native PencilKit for the current Notes page (experimental)';
  button.setAttribute('aria-label','Open native PencilKit for current note page');
  host.append(button);
  // Manually registered Capacitor 8 Swift plugins can be callable even if
  // they are missing from the global JS Plugins registry.
  const invoke=(method,args={})=>native.nativePromise('BlueprintPencil',method,args);
  let opening=false,acknowledged=false;
  const status=message=>{
    const live=document.getElementById('v81A11yStatus');
    if(live)live.textContent=message;
  };
  button.addEventListener('click',async()=>{
    if(opening)return;
    const ctx=window.BlueprintNotesBridge?.current?.();
    const project=ctx?.p,page=ctx?.page;
    if(!project||!page||!Array.isArray(project.notePages)){
      alert('Open a project Notes page before using native ink.');
      return;
    }
    opening=true;button.disabled=true;button.textContent='Opening…';
    try{
      let capabilities;
      try{capabilities=await invoke('capabilities');}
      catch(error){
        throw Error('The installed native plugin does not expose persistent PencilKit yet. Install the newer Swift files and rebuild in Xcode. Details: '+(error?.message||String(error)));
      }
      if(capabilities?.available!==true||capabilities?.schemaVersion!==1){
        throw Error('This PencilKit plugin is outdated or incompatible. Install the newer Swift files and rebuild.');
      }
      if(!acknowledged){
        const ok=confirm('Native PencilKit drawings save separately on this device. They are NOT visible alongside Blueprint text/images, included in the complete backup, or synced. Use a disposable test page. Continue?');
        if(!ok)return;
        acknowledged=true;
      }
      const result=await invoke('openEditor',{
        projectId:String(project.id),pageId:String(page.id),
        pageIds:project.notePages.map(p=>String(p.id))
      });
      status(result?.saved?'Native PencilKit drawing saved on this device.':'Native editor closed.');
    }catch(error){
      const message='Unable to open PencilKit: '+(error?.message||String(error));
      status(message);alert(message);
    }finally{
      opening=false;button.disabled=false;button.textContent='Native ink';
    }
  });
})();
