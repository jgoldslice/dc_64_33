'use strict';
/* Blueprint v9.2: optional bridge entry point for a REGISTERED native PencilKit plugin.
   Invisible on Safari/PWA and on native apps lacking the plugin. Does not change
   existing SVG notes, backup files or application storage. Native source stays
   experimental until Swift/Xcode builds and complete backup are validated. */
(function(){
  const native=window.Capacitor;
  if(!native?.isNativePlatform?.()||!native?.isPluginAvailable?.('BlueprintPencil'))return;
  const plugin=native.Plugins?.BlueprintPencil;
  if(typeof plugin?.openEditor!=='function'||typeof plugin?.capabilities!=='function')return;
  const actions=document.querySelector('#projectWorkspace .v82-project-header-actions');
  if(!actions||document.getElementById('v92PencilKit'))return;

  const button=document.createElement('button');
  button.type='button';
  button.id='v92PencilKit';
  button.className='text-button v92-native-pencil-entry';
  button.textContent='PencilKit';
  button.title='Experimental native Apple Pencil editor (iPad only)';
  button.setAttribute('aria-label','Open experimental native PencilKit drawing editor');
  actions.append(button);
  let opening=false,acknowledged=false;

  button.addEventListener('click',async()=>{
    if(opening)return;
    const project=typeof v6Project==='function'?v6Project():null;
    const pages=project?.notePages;
    const id=project?.activeNotePageId;
    if(!project||!Array.isArray(pages)||!pages.some(page=>String(page.id)===String(id))){
      alert('Open a project notebook page before opening PencilKit.');
      return;
    }
    if(!acknowledged){
      const ok=confirm(
        'Experimental native PencilKit editor.\n\nNative drawings are currently saved separately on this device. '+
        'They are NOT included in Blueprint’s existing complete backup, and do NOT sync to your iPhone. '+
        'Your existing SVG notes remain unchanged.\n\nContinue only with a disposable test project.'
      );
      if(!ok)return;
      acknowledged=true;
    }
    opening=true;
    button.disabled=true;
    button.textContent='Opening…';
    try{
      const capabilities=await plugin.capabilities();
      if(capabilities?.available!==true||capabilities?.schemaVersion!==1){
        throw Error('Incompatible PencilKit plugin. Update the native iOS build.');
      }
      // Only existing stable page IDs are passed; opening native does not
      // create, migrate, or replace any web note.
      const result=await plugin.openEditor({
        projectId:String(project.id),
        pageId:String(id),
        pageIds:pages.map(page=>String(page.id))
      });
      const announce=document.getElementById('v81A11yStatus');
      if(announce)announce.textContent=result?.pageId
        ?'Native PencilKit drawing saved separately on this device.'
        :'Native PencilKit editor closed.';
    }catch(error){
      alert('Could not open or save native PencilKit drawing: '+(error?.message||String(error)));
    }finally{
      opening=false;
      button.disabled=false;
      button.textContent='PencilKit';
    }
  });
})();
