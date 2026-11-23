'use strict';
/* Project icon choices reuse the Area palette. Small photo thumbnails live in
   the existing planner manifest, so old backups need no new attachment store. */
(function(){
  const options=window.BlueprintAppearanceOptions;
  const header=document.querySelector('#projectWorkspace .v82-project-header-actions');
  if(!options||!header)return;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icons=new Set(options.icons.map(entry=>entry.key));
  const colors=new Map(options.colors.map(entry=>[entry.key,entry]));
  const validPhoto=data=>typeof data==='string'&&data.length<=100000&&
    /^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(data);
  function appearance(project){
    const stored=project?.projectAppearance;
    return {
      icon:icons.has(stored?.icon)?stored.icon:'plan',
      color:colors.has(stored?.color)?stored.color:'theme',
      imageData:validPhoto(stored?.imageData)?stored.imageData:''
    };
  }
  function markup(project){
    const style=appearance(project),color=colors.get(style.color).value;
    const visual=style.imageData?'<img src="'+esc(style.imageData)+'" alt="">':options.iconMarkup(style.icon);
    return '<i class="bp-project-mark'+(style.imageData?' has-photo':'')+'" data-project-icon="'+style.icon+'" data-project-color="'+style.color+'" aria-hidden="true" style="--project-accent:'+color+'">'+visual+'</i>';
  }
  window.BlueprintProjectAppearance=Object.freeze({markup,appearance});
  const edit=document.createElement('button');
  edit.type='button';edit.className='bp-project-icon-edit';edit.id='bpProjectAppearance';
  edit.setAttribute('aria-label','Change project icon');edit.setAttribute('aria-haspopup','dialog');
  edit.title='Change project icon';header.prepend(edit);
  function syncHeader(){
    const p=v6Project();edit.hidden=!p;
    if(p)edit.innerHTML=markup(p);
  }
  // Bound photo dimensions and bytes before adding them to the planner.
  // Keep transparency for PNG and fall back to a smaller thumbnail if needed.
  async function photoThumbnail(file){
    if(!file||!String(file.type||'').startsWith('image/'))throw Error('Choose an image file.');
    if(file.size>20*1024*1024)throw Error('Choose an image under 20 MB.');
    const url=URL.createObjectURL(file),image=new Image();
    try{
      await new Promise((resolve,reject)=>{
        image.onload=resolve;image.onerror=()=>reject(Error('This image could not be opened on this device.'));image.src=url;
      });
      const width=image.naturalWidth,height=image.naturalHeight;
      if(!width||!height||width*height>40000000)throw Error('Choose an image smaller than 40 megapixels.');
      const mime=/^image\/jpe?g$/i.test(file.type)?'image/jpeg':'image/png';
      for(const max of [128,96,72]){
        const scale=Math.min(1,max/Math.max(width,height));
        const canvas=document.createElement('canvas');
        canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
        const context=canvas.getContext('2d');if(!context)throw Error('Image processing is unavailable.');
        context.drawImage(image,0,0,canvas.width,canvas.height);
        const result=canvas.toDataURL(mime,.82);
        if(validPhoto(result))return result;
      }
      throw Error('This image could not be made small enough for a project icon.');
    }finally{URL.revokeObjectURL(url);}
  }
  async function choose(project,anchor){
    const draft={...appearance(project)};
    const content=document.createElement('div');content.className='bp-project-picker';
    content.innerHTML='<div class="bp-project-picker-preview" aria-hidden="true"></div>'+
      '<div class="bp-project-photo-controls"><label class="bp-project-photo-select">Choose photo<input type="file" accept="image/*" data-project-photo></label>'+
      '<button type="button" class="text-button" data-project-photo-remove>Remove photo</button></div>'+
      '<p class="bp-project-photo-status" role="status" aria-live="polite"></p>'+
      '<fieldset><legend>Icon</legend><div class="bp-project-picker-icons">'+
      options.icons.map(item=>'<button type="button" data-project-icon-choice="'+item.key+'" aria-label="'+esc(item.label)+'" aria-pressed="false">'+options.iconMarkup(item.key)+'</button>').join('')+
      '</div></fieldset><fieldset><legend>Color</legend><div class="bp-project-picker-colors">'+
      options.colors.map(item=>'<button type="button" data-project-color-choice="'+item.key+'" aria-label="'+esc(item.name)+'" aria-pressed="false"><i style="--project-accent:'+item.value+'"></i></button>').join('')+
      '</div></fieldset>';
    const preview=content.querySelector('.bp-project-picker-preview');
    const remove=content.querySelector('[data-project-photo-remove]');
    const status=content.querySelector('.bp-project-photo-status');
    const input=content.querySelector('[data-project-photo]');
    let photoRevision=0;
    const submitButton=()=>content.closest('form')?.querySelector('button[type="submit"]');
    function cancelPendingPhoto(){
      photoRevision++;
      const submit=submitButton();if(submit)submit.disabled=false;
    }
    function refresh(){
      preview.innerHTML=markup({projectAppearance:draft});
      remove.hidden=!draft.imageData;
      content.querySelectorAll('[data-project-icon-choice]').forEach(button=>button.setAttribute('aria-pressed',String(!draft.imageData&&button.dataset.projectIconChoice===draft.icon)));
      content.querySelectorAll('[data-project-color-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.projectColorChoice===draft.color)));
    }
    content.addEventListener('click',event=>{
      const button=event.target.closest('button');if(!button)return;
      if(button.hasAttribute('data-project-icon-choice')){cancelPendingPhoto();draft.icon=button.dataset.projectIconChoice;draft.imageData='';status.textContent='';refresh();}
      else if(button.hasAttribute('data-project-color-choice')){draft.color=button.dataset.projectColorChoice;refresh();}
      else if(button.hasAttribute('data-project-photo-remove')){cancelPendingPhoto();draft.imageData='';status.textContent='';refresh();}
    });
    input.addEventListener('change',async()=>{
      const file=input.files?.[0];if(!file)return;
      const revision=++photoRevision,submit=submitButton();
      if(submit)submit.disabled=true;status.textContent='Preparing photo…';
      try{const photo=await photoThumbnail(file);if(revision===photoRevision){draft.imageData=photo;status.textContent='Photo ready';refresh();}}
      catch(error){if(revision===photoRevision)status.textContent=String(error?.message||error);}
      finally{if(revision===photoRevision){input.value='';if(submit)submit.disabled=false;}}
    });
    refresh();
    const result=await BlueprintSheet.open({title:'Project icon',content,anchor});
    if(result===null)return;
    // An import or deletion can replace the project while the sheet is open.
    if(state.projects.find(item=>String(item.id)===String(project.id))!==project)return;
    const before=project.projectAppearance;
    project.projectAppearance={icon:draft.icon,color:draft.color,...(draft.imageData?{imageData:draft.imageData}:{})};
    if(!save(true)){
      if(before===undefined)delete project.projectAppearance;else project.projectAppearance=before;
      BlueprintSheet.toast('Project icon was not saved.');return;
    }
    v6Render();render();
  }
  edit.addEventListener('click',()=>{const project=v6Project();if(project)choose(project,edit);});
  const previousRender=v6Render;
  v6Render=function(...args){const result=previousRender.apply(this,args);syncHeader();return result;};
  // Initial page markup was drawn before this module loaded.
  v6Render();window.blueprintAreas?.refresh();
})();
