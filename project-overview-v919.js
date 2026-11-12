
'use strict';
/* Blueprint v9.19 — project landing cards and reviewed resource capture.
   Existing notes, actions, and IndexedDB media remain the source of truth. */
(function(){
  const byId=id=>document.getElementById(id);
  const xss=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const currentProject=()=>v6Project();
  const isImage=r=>r&&(r.type==='sketch'||(r.type==='file'&&String(r.mime||'').startsWith('image/')));
  let previewURLs=[],previewToken=0,pendingCapture=null,captureMode='link',restoreFocus=null;
  const tokenSafe=(p,token)=>token===previewToken&&String(currentProject()?.id)===String(p.id);
  function textPreview(html){
    const temp=document.createElement('template');
    temp.innerHTML=String(html||'');
    return (temp.content.textContent||'').replace(/\s+/g,' ').trim();
  }
  function releasePreviews(){
    ++previewToken;
    for(const url of previewURLs)URL.revokeObjectURL(url);
    previewURLs=[];
  }
  function renderPreview(project){
    releasePreviews();
    if(!project)return;
    const notes=byId('v919NotesPreview'),tasks=byId('v919TodoPreview'),library=byId('v919LibraryPreview');
    if(!notes||!tasks||!library)return;
    const pages=Array.isArray(project.notePages)?project.notePages:[];
    const snippets=pages.map(p=>{
      const content=(p.objects||[]).filter(o=>o.type==='text')
        .map(o=>textPreview(o.html)).filter(Boolean).join(' ');
      return {title:p.title||'Notes',content};
    }).filter(x=>x.content).slice(0,3);
    if(!snippets.length&&String(project.notebookText||'').trim())
      snippets.push({title:'Notes',content:project.notebookText});
    notes.innerHTML=snippets.length
      ?snippets.map(n=>'<div class="v919-note-snippet"><strong>'+xss(n.title)+'</strong><p>'+xss(n.content.slice(0,220))+'</p></div>').join('')
      :'<p class="muted small">Your notes will appear here. Open Notes to start writing.</p>';

    const actions=Array.isArray(project.actions)?project.actions:[];
    const shown=[...actions.filter(a=>!a.done),...actions.filter(a=>a.done)].slice(0,4);
    tasks.innerHTML=shown.length
      ?shown.map(a=>'<div class="v919-todo-row '+(a.done?'is-done':'')+'"><input type="checkbox" data-v919-check="'+xss(a.id)+'" id="v919Task-'+xss(a.id)+'" aria-label="Complete '+xss(a.title)+'" '+(a.done?'checked':'')+'><label for="v919Task-'+xss(a.id)+'">'+xss(a.title)+'</label></div>').join('')
        +'<p class="v919-todo-count">'+actions.filter(a=>!a.done).length+' remaining · '+actions.filter(a=>a.done).length+' completed</p>'
      :'<p class="muted small">No to-dos yet. Add one below.</p>';
    // The preview is a window onto the actual Library order, not an
    // independently sorted image collection. Links count toward the same cap.
    const items=(Array.isArray(project.library)?project.library:[]).slice(0,3);
    const imageItems=items.filter(isImage);
    library.innerHTML=items.length?items.map(r=>{
      const title=xss(r.title|| (isImage(r)?'Image':r.type==='link'?'Link':'Resource'));
      if(isImage(r))return '<button type="button" class="v919-gallery-item" data-v6-view-image="'+xss(r.id)+'" aria-label="Open '+title+'">'+
        '<img alt="" loading="lazy" data-v919-image="'+xss(r.id)+'"><span>'+title+'</span></button>';
      // YouTube links retain their recognizable preview in Overview,
      // while still opening the original link with the normal Library action.
      const video=r.type==='link'?window.canvasVideoLink?.parse?.(r.url):null;
      if(video)return '<button type="button" class="v919-gallery-item v923-preview-youtube" data-v6-open-resource="'+xss(r.id)+'" aria-label="Open '+title+'">'+
        '<img alt="" loading="lazy" referrerpolicy="no-referrer" src="'+xss(video.thumbnail)+'"><span>'+title+'</span></button>';
      const kind=r.type==='link'?'Link':r.type==='code'?'Code':'File';
      let detail=kind;
      if(r.type==='link'){
        try{detail=new URL(r.url).hostname.replace(/^www\./,'');}
        catch{detail='Saved link';}
      }else if(r.type==='file')detail=r.mime||'File';
      return '<button type="button" class="v919-gallery-item v923-preview-resource" data-v6-open-resource="'+xss(r.id)+'" aria-label="Open '+title+'">'+
        '<span class="v923-preview-icon" aria-hidden="true">'+(r.type==='link'?'↗':r.type==='code'?'⌘':'▤')+'</span>'+
        '<strong>'+title+'</strong><small>'+xss(detail)+'</small></button>';
    }).join(''):'<div class="v919-gallery-empty">No Library items yet. Add a photo or link to this project.</div>';
    const token=previewToken,projectId=String(project.id);
    for(const r of imageItems){
      if(!r.key)continue;
      v6Blob('get',r.key).then(blob=>{
        if(!blob||!tokenSafe(project,token))return;
        const img=[...library.querySelectorAll('[data-v919-image]')]
          .find(el=>el.dataset.v919Image===String(r.id));
        if(!img||String(currentProject()?.id)!==projectId)return;
        const url=URL.createObjectURL(blob);
        previewURLs.push(url);img.src=url;
      }).catch(error=>console.warn('Could not load project preview',error));
    }
  }
  window.v919RenderProjectOverview=renderPreview;
  // v6Render() refreshes the overview at project entry and after normal edits.
  if(currentProject())renderPreview(currentProject());

  function showSection(section){
    if(!['overview','notes','actions','library'].includes(section)||!currentProject())return;
    v6ProjectTab=section;
    v6Render();
    // The notes surface should measure after it is visible, not while hidden.
    if(section==='notes')requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));
    byId(section==='overview'?'projectOverview':
      section==='notes'?'projectNotes':
      section==='actions'?'projectActions':'projectLibrary')?.scrollIntoView({block:'nearest',behavior:'instant'});
  }

  const capture=document.createElement('div');
  capture.id='v919CaptureBack';
  capture.className='v919-capture-back';
  capture.hidden=true;
  capture.innerHTML=
    '<section class="v919-capture-sheet" role="dialog" aria-modal="true" aria-labelledby="v919CaptureTitle">'+
    '<div class="v919-capture-heading"><h2 id="v919CaptureTitle">Save to a project</h2>'+
    '<button type="button" id="v919CaptureClose" aria-label="Close capture">×</button></div>'+
    '<p class="v919-capture-help">Select the project library where this resource belongs. Nothing is saved until you confirm.</p>'+
    '<label>Project<select id="v919CaptureProject" aria-label="Project library"></select></label>'+
    '<div class="v919-capture-switch" role="group" aria-label="Resource type">'+
    '<button type="button" data-v919-mode="link" aria-pressed="true">Link</button>'+
    '<button type="button" data-v919-mode="photo" aria-pressed="false">Photo / file</button></div>'+
    '<div class="v919-capture-choices" id="v919CaptureLink">'+
    '<label>Web address<input id="v919CaptureURL" type="url" inputmode="url" autocomplete="url" placeholder="https://…" required></label>'+
    '<label>Title<input id="v919CaptureName" maxlength="180" placeholder="Name this resource"></label></div>'+
    '<div class="v919-capture-choices" id="v919CapturePhoto" hidden>'+
    '<label>Select images or files<input type="file" id="v919CaptureFiles" accept="image/*,.pdf" multiple></label>'+
    '<p class="v919-capture-help">Images and PDFs are stored on this device, not uploaded to a server. Export a complete backup to preserve them.</p></div>'+
    '<p id="v919CaptureStatus" class="v919-capture-status" role="status" aria-live="polite"></p>'+
    '<div class="v919-capture-actions"><button type="button" class="v919-capture-open-btn" id="v919CaptureCancel">Cancel</button>'+
    '<button type="button" class="primary-button" id="v919CaptureSave">Save to Library</button></div>'+
    '</section>';
  document.body.append(capture);
  const status=(message,error=false)=>{
    const el=byId('v919CaptureStatus');el.textContent=message;
    el.setAttribute('role',error?'alert':'status');
  };
  function setMode(mode){
    captureMode=mode==='photo'?'photo':'link';
    for(const b of capture.querySelectorAll('[data-v919-mode]'))
      b.setAttribute('aria-pressed',String(b.dataset.v919Mode===captureMode));
    byId('v919CaptureLink').hidden=captureMode!=='link';
    byId('v919CapturePhoto').hidden=captureMode!=='photo';
    status('');
  }
  function openCapture({url='',title='',projectId='',mode='link'}={}){
    restoreFocus=document.activeElement;
    const selector=byId('v919CaptureProject');
    selector.replaceChildren();
    for(const p of state.projects||[]){
      const opt=document.createElement('option');
      opt.value=String(p.id);opt.textContent=p.title;
      selector.append(opt);
    }
    const requested=projectId||currentProject()?.id||'';
    if([...selector.options].some(o=>o.value===String(requested)))selector.value=String(requested);
    byId('v919CaptureURL').value=String(url||'');
    byId('v919CaptureName').value=String(title||'');
    byId('v919CaptureFiles').value='';
    pendingCapture=null;
    byId('v919CaptureSave').textContent='Save to Library';
    byId('v919CaptureSave').disabled=!selector.options.length;
    setMode(mode);
    if(!selector.options.length)status('Create a project in Brainstorm before saving a resource.',true);
    capture.hidden=false;
    capture.classList.add('open');
    byId('v919CaptureClose').focus({preventScroll:true});
  }
  function closeCapture(){
    if(pendingCapture){status('A file is awaiting a verified save. Use Retry save before closing or export a backup.',true);return;}
    capture.hidden=true;capture.classList.remove('open');
    if(restoreFocus?.isConnected)restoreFocus.focus({preventScroll:true});
    else byId('projectWorkspace')?.focus?.();
  }
  function verifyCurrentWindow(){
    // Safeguard concurrent Shortcut captures: the parent page might still be
    // open with an older in-memory copy of the same project library.
    if(canvasExternalChange||localStorage.getItem(STORAGE_KEY)!==canvasLastManifest){
      status('Another Blueprint window saved newer data. Export any unsaved work here, then reload the latest data before capturing.',true);
      canvasExternalChange=true;
      canvasUnsaved=true;
      canvasSaveStatus(true);
      return false;
    }
    return true;
  }
  async function saveCapture(){
    if(pendingCapture){
      if(!verifyCurrentWindow())return;
      if(save(true)){
        pendingCapture=null;byId('v919CaptureSave').textContent='Save to Library';
        status('Saved.');
        capture.hidden=true;capture.classList.remove('open');
        v6Render();renderPreview(currentProject());
      }else status('Your resource is retained in memory. Keep Blueprint open and retry the save.',true);
      return;
    }
    if(!verifyCurrentWindow())return;
    const project=state.projects.find(p=>String(p.id)===byId('v919CaptureProject').value);
    if(!project){status('Choose a project to continue.',true);return;}
    if(!Array.isArray(project.library))project.library=[];
    const button=byId('v919CaptureSave');
    button.disabled=true;
    try{
      if(captureMode==='link'){
        const raw=byId('v919CaptureURL').value.trim();
        let address;
        try{address=new URL(raw);if(!['http:','https:'].includes(address.protocol))throw Error();}catch{throw Error('Enter a valid https:// or http:// link.');}
        const url=address.href;
        const title=(byId('v919CaptureName').value.trim()||address.hostname).slice(0,180);
        if(project.library.some(item=>item.type==='link'&&item.url===url)){
          status('This link is already saved in the selected project.');return;
        }
        const record={id:v6Id(),type:'link',title,url,created:v6Now()};
        project.library.push(record);
        if(!save(true)){
          pendingCapture={projectId:project.id,recordId:record.id};
          button.textContent='Retry save';throw Error('Link retained in this window, but its library entry was not verified. Retry save.');
        }
      }else{
        const files=[...byId('v919CaptureFiles').files];
        if(!files.length)throw Error('Choose a photo or PDF first.');
        for(const file of files){
          if(file.size>40*1024*1024)throw Error(file.name+' exceeds the 40 MB limit.');
          const type=file.type||'application/octet-stream';
          if(!type.startsWith('image/')&&type!=='application/pdf')throw Error('Only images and PDF files are supported.');
        }
        for(const file of files){
          const id=v6Id(),key='v6-'+id;
          await v6Blob('put',key,file);
          const record={id,type:'file',title:file.name.slice(0,180),mime:file.type||'application/octet-stream',key,size:file.size,created:v6Now()};
          project.library.push(record);
          if(!save(true)){
            pendingCapture={projectId:project.id,recordId:id};
            button.textContent='Retry save';throw Error('File retained in IndexedDB and memory, but its library entry was not verified. Retry save.');
          }
        }
      }
      capture.hidden=true;capture.classList.remove('open');
      v6Render();renderPreview(currentProject());
    }catch(error){
      status('Could not save resource: '+error.message,true);
    }finally{button.disabled=false;}
  }
  function incomingShare(){
    const raw=location.hash||'';
    if(!/^#bp-share\?/i.test(raw))return;
    const args=new URLSearchParams(raw.slice(raw.indexOf('?')+1));
    const url=String(args.get('url')||args.get('text')||'').slice(0,3000);
    const title=String(args.get('title')||'').slice(0,180);
    // URL fragment is local-only: it isn't included in a GitHub Pages request.
    // Clearing it also avoids reopening capture after a browser refresh.
    history.replaceState(history.state,'',location.pathname+location.search);
    openCapture({url,title,projectId:args.get('project')||'',mode:'link'});
  }
  document.addEventListener('click',e=>{
    const el=e.target instanceof Element?e.target.closest('[data-v919-project-open],[data-v919-capture-open],#v919BackOverview'):null;
    if(!el)return;
    if(el.matches('[data-v919-capture-open]')){openCapture({projectId:currentProject()?.id});return;}
    if(el.id==='v919BackOverview')showSection('overview');
    else showSection(el.dataset.v919ProjectOpen);
  });
  document.addEventListener('change',e=>{
    const x=e.target;
    if(!x?.dataset?.v919Check)return;
    const p=currentProject(),item=p?.actions?.find(a=>String(a.id)===String(x.dataset.v919Check));
    if(!item)return;
    const previous=item.done;
    item.done=!!x.checked;
    const task=state.tasks.find(t=>String(t.id)===String(item.taskId));
    if(task)task.done=item.done;
    if(!save(true)){
      item.done=previous;
      if(task)task.done=previous;
      x.checked=previous;
    }
    v6RenderActions(p);
    render();
    renderPreview(p);
  });
  byId('v919QuickTodo').addEventListener('submit',e=>{
    e.preventDefault();
    const p=currentProject(),input=e.currentTarget.elements.title;
    const title=input.value.trim().slice(0,160);
    if(!p||!title)return;
    const action={id:v6Id(),title,done:false,taskId:''};
    p.actions.push(action);
    if(!save(true)){
      // Retain the new action in memory so the save-warning Retry or a
      // recovery export can rescue it; never discard a user's typed to-do.
      input.value='';v6RenderActions(p);renderPreview(p);return;
    }
    input.value='';v6RenderActions(p);renderPreview(p);
  });
  byId('v919CaptureSave').addEventListener('click',saveCapture);
  for(const name of ['v919CaptureClose','v919CaptureCancel'])
    byId(name).addEventListener('click',closeCapture);
  for(const button of capture.querySelectorAll('[data-v919-mode]'))
    button.addEventListener('click',()=>{if(!pendingCapture)setMode(button.dataset.v919Mode);});
  capture.addEventListener('click',e=>{if(e.target===capture)closeCapture();});
  capture.addEventListener('keydown',e=>{
    if(e.key==='Escape'){e.preventDefault();closeCapture();return;}
    if(e.key!=='Tab')return;
    const items=[...capture.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled])')]
      .filter(x=>x.getClientRects().length);
    if(!items.length)return;
    if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items.at(-1).focus();}
    else if(!e.shiftKey&&document.activeElement===items.at(-1)){e.preventDefault();items[0].focus();}
  });
  window.addEventListener('hashchange',incomingShare);
  setTimeout(incomingShare,0);
  window.BlueprintProjectCapture={open:openCapture,close:closeCapture};
})();
