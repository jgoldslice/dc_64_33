'use strict';
// Canvas v7.4 — progressive project-workspace enhancements. No external dependencies.
(function(){
 const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const getProject=()=>v6Project();
 const blockTypes=['paragraph','heading','checklist','code','image'];
 function actionStatus(a){return a.done?'done':a.status==='progress'?'progress':'todo';}
 function setActionStatus(id,status){
   const p=getProject(),a=p?.actions.find(a=>String(a.id)===String(id));
   if(!a)return;
   a.status=status;a.done=status==='done';
   const task=state.tasks.find(t=>String(t.id)===String(a.taskId));
   if(task)task.done=a.done;
   save();v6RenderActions(p);render();
 }
 const oldNotes=v6RenderNotes;
 v6RenderNotes=function(p){oldNotes(p);renderBlocks(p);};
 const oldActions=v6RenderActions;
 v6RenderActions=function(p){oldActions(p);
   const switcher=document.getElementById('v74ActionView');
   if(!switcher)return;
   const board=p.actionView==='board';
   switcher.querySelectorAll('button').forEach(b=>{b.classList.toggle('selected',b.dataset.actionView===(board?'board':'list'));b.setAttribute('aria-pressed',String(b.dataset.actionView===(board?'board':'list')));});
   const list=document.getElementById('projectActionsList');
   if(!board){
     list.classList.remove('v74-board');
     [...list.querySelectorAll('[data-v6-check]')].forEach(checkbox=>{
       const a=p.actions.find(a=>String(a.id)===String(checkbox.dataset.v6Check));
       if(!a)return;
       const select=document.createElement('select');
       select.className='v74-list-status';select.dataset.v74Status=a.id;
       select.setAttribute('aria-label','Status of '+a.title);
       [['todo','To Do'],['progress','In Progress'],['done','Done']].forEach(([id,label])=>{
         const option=document.createElement('option');option.value=id;option.textContent=label;select.appendChild(option);
       });
       select.value=actionStatus(a);checkbox.closest('.v6-action-row')?.appendChild(select);
     });
     return;
   }
   list.classList.add('v74-board');
   list.innerHTML=['todo','progress','done'].map(status=>{
     const label={todo:'To Do',progress:'In Progress',done:'Done'}[status];
     const actions=p.actions.filter(a=>actionStatus(a)===status);
     return '<section class="v74-lane"><h3>'+label+' <small>'+actions.length+'</small></h3>'+
       (actions.map(a=>'<div class="v74-action-card"><span>'+escapeHtml(a.title)+'</span><select data-v74-status="'+escapeHtml(a.id)+'" aria-label="Status of '+escapeHtml(a.title)+'">'+
         ['todo','progress','done'].map(s=>'<option value="'+s+'" '+(status===s?'selected':'')+'>'+({todo:'To Do',progress:'In Progress',done:'Done'}[s])+'</option>').join('')+
         '</select><div class="v74-action-tools"><button class="text-button" type="button" data-v6-task="'+escapeHtml(a.id)+'">→ Task</button><button class="text-button" type="button" data-v6-remove-action="'+escapeHtml(a.id)+'">Remove</button></div></div>').join('')||'<p class="muted small">No actions</p>')+
       '</section>';
   }).join('');
 };
 // Keep linked tasks and the completion-only existing model compatible with a third status.
 document.addEventListener('change',e=>{
   const x=e.target,p=getProject();if(!p)return;
   if(x.matches('[data-v74-status]'))setActionStatus(x.dataset.v74Status,x.value);
   if(x.matches('[data-v6-check]')){const a=p.actions.find(a=>String(a.id)===String(x.dataset.v6Check));if(a){a.status=x.checked?'done':'todo';save();}}
   if(x.matches('[data-task-check]')){const t=state.tasks.find(t=>String(t.id)===String(x.dataset.taskCheck));const a=state.projects.find(p=>String(p.id)===String(t?.projectId))?.actions.find(a=>String(a.id)===String(t?.projectActionId));if(a){a.status=t.done?'done':'todo';save();}}
 });
 document.addEventListener('click',e=>{if(!(e.target instanceof Element))return;
   const button=e.target.closest('[data-action-view]');
   if(button){const p=getProject();if(!p)return;p.actionView=button.dataset.actionView;save();v6RenderActions(p);return;}
   const add=e.target.closest('#v74AddBlock');
   if(add){const p=getProject();if(!p)return;const type=document.getElementById('v74BlockType').value;if(type==='image'){document.getElementById('v74BlockImage').click();return;}addBlock(p,type);return;}
   const del=e.target.closest('[data-v74-delete-block]');
   if(del){const p=getProject();if(!p||!confirm('Delete this block?'))return;const block=p.contentBlocks.find(b=>String(b.id)===String(del.dataset.v74DeleteBlock));p.contentBlocks=p.contentBlocks.filter(b=>String(b.id)!==del.dataset.v74DeleteBlock);save();renderBlocks(p);if(block?.type==='image'&&block.key)v6Blob('delete',block.key).catch(()=>{});return;}
   const move=e.target.closest('[data-v74-move-block]');
   if(move){const p=getProject();if(!p)return;const i=p.contentBlocks.findIndex(b=>String(b.id)===move.dataset.v74MoveBlock),next=i+(move.dataset.direction==='up'?-1:1);if(i<0||next<0||next>=p.contentBlocks.length)return;[p.contentBlocks[i],p.contentBlocks[next]]=[p.contentBlocks[next],p.contentBlocks[i]];save();renderBlocks(p);return;}
 });
 function addBlock(p,type,content='',key=''){
   if(!blockTypes.includes(type))return;
   if(!Array.isArray(p.contentBlocks))p.contentBlocks=[];
   p.contentBlocks.push({id:v6Id(),type,text:content,checked:false,key});
   save();renderBlocks(p);
 }
 function renderBlocks(p){
   const root=document.getElementById('v74Blocks');if(!root)return;
   if(!Array.isArray(p.contentBlocks))p.contentBlocks=[];
   root.innerHTML=p.contentBlocks.map((b,i)=>{
     const controls='<div class="v74-block-actions"><button type="button" data-v74-move-block="'+escapeHtml(b.id)+'" data-direction="up" '+(i===0?'disabled':'')+' aria-label="Move block up">↑</button><button type="button" data-v74-move-block="'+escapeHtml(b.id)+'" data-direction="down" '+(i===p.contentBlocks.length-1?'disabled':'')+' aria-label="Move block down">↓</button><button type="button" data-v74-delete-block="'+escapeHtml(b.id)+'" aria-label="Delete block">×</button></div>';
     let editor='';
     if(b.type==='image') editor='<img class="v74-block-image" data-v74-image="'+escapeHtml(b.key)+'" alt="Project note image"><input data-v74-block-text="'+escapeHtml(b.id)+'" placeholder="Image caption" value="'+escapeHtml(b.text)+'">';
     else if(b.type==='checklist')editor='<label class="v74-check-row"><input type="checkbox" data-v74-block-check="'+escapeHtml(b.id)+'" '+(b.checked?'checked':'')+'><input data-v74-block-text="'+escapeHtml(b.id)+'" placeholder="Checklist item" value="'+escapeHtml(b.text)+'"></label>';
     else if(b.type==='code')editor='<textarea spellcheck="false" class="v74-code" data-v74-block-text="'+escapeHtml(b.id)+'" placeholder="Code snippet">'+escapeHtml(b.text)+'</textarea>';
     else editor='<textarea class="'+(b.type==='heading'?'v74-heading':'')+'" data-v74-block-text="'+escapeHtml(b.id)+'" rows="'+(b.type==='heading'?1:2)+'" placeholder="'+(b.type==='heading'?'Heading':'Write a note...')+'">'+escapeHtml(b.text)+'</textarea>';
     return '<div class="v74-block" data-block-id="'+escapeHtml(b.id)+'"><span class="v74-block-label">'+escapeHtml(b.type)+'</span>'+controls+editor+'</div>';
   }).join('');
   const projectId=String(p.id);
   p.contentBlocks.filter(b=>b.type==='image'&&b.key).forEach(b=>v6Blob('get',b.key).then(blob=>{
     if(!blob||String(getProject()?.id)!==projectId)return;
     const img=[...root.querySelectorAll('[data-v74-image]')].find(img=>img.dataset.v74Image===b.key);
     if(img){const url=URL.createObjectURL(blob);img.onload=()=>URL.revokeObjectURL(url);img.src=url;}
   }).catch(()=>{}));
 }
 document.addEventListener('input',e=>{
   const x=e.target,id=x.dataset?.v74BlockText;if(!id)return;
   const block=getProject()?.contentBlocks?.find(b=>String(b.id)===String(id));if(!block)return;
   block.text=x.value;save();
 });
 document.addEventListener('change',e=>{
   const x=e.target,id=x.dataset?.v74BlockCheck;if(!id)return;
   const block=getProject()?.contentBlocks?.find(b=>String(b.id)===String(id));if(!block)return;
   block.checked=x.checked;save();
 });
 document.getElementById('v74BlockImage').addEventListener('change',async e=>{
   const p=getProject(),file=e.target.files?.[0];e.target.value='';
   if(!p||!file)return;
   if(!file.type.startsWith('image/')||file.size>40*1024*1024){alert('Select an image under 40 MB.');return;}
   const key='v74-note-'+v6Id();
   try{await v6Blob('put',key,file);addBlock(p,'image',file.name,key);}
   catch(err){alert('Could not store the image: '+err.message);}
 });
 // Library already provides a thumbnail gallery and full-screen viewer. Offer a compact file list mode.
 const oldLibrary=v6RenderLibrary;
 v6RenderLibrary=function(p){oldLibrary(p);const root=document.getElementById('projectLibraryList');if(root)root.classList.toggle('v74-library-list',p.libraryView==='list');const switcher=document.getElementById('v74LibraryView');if(switcher)switcher.querySelectorAll('button').forEach(b=>{b.classList.toggle('selected',b.dataset.libraryView===(p.libraryView==='list'?'list':'gallery'));b.setAttribute('aria-pressed',String(b.dataset.libraryView===(p.libraryView==='list'?'list':'gallery')));});};
 document.addEventListener('click',e=>{if(!(e.target instanceof Element))return;const button=e.target.closest('[data-library-view]');if(!button)return;const p=getProject();if(!p)return;p.libraryView=button.dataset.libraryView;save();v6RenderLibrary(p);});
 // Canvas v8.5: portable, integrity-checked and rollback-safe complete backups.
 // v1 backups stay importable. v2 adds SHA-256 for state and every attachment.
 const blobToBase64=blob=>new Promise((resolve,reject)=>{
   const reader=new FileReader();
   reader.onload=()=>resolve(String(reader.result).split(',')[1]);
   reader.onerror=()=>reject(reader.error||Error('Could not read an attachment'));
   reader.readAsDataURL(blob);
 });
 const base64ToBlob=(data,mime)=>{
   if(typeof data!=='string'||data.length%4!==0||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data))
     throw Error('Corrupted attachment encoding');
   const binary=atob(data),parts=[];
   for(let i=0;i<binary.length;i+=32768){
     const slice=binary.slice(i,i+32768),bytes=new Uint8Array(slice.length);
     for(let j=0;j<slice.length;j++)bytes[j]=slice.charCodeAt(j);
     parts.push(bytes);
   }
   return new Blob(parts,{type:mime||'application/octet-stream'});
 };
 const hashBytes=async bytes=>{
   if(!globalThis.crypto?.subtle)throw Error('A secure browser context is required to verify complete backups');
   return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))]
     .map(b=>b.toString(16).padStart(2,'0')).join('');
 };
 const hashState=stateData=>hashBytes(new TextEncoder().encode(JSON.stringify(stateData)));
 const hashBlob=blob=>blob.arrayBuffer().then(hashBytes);
 function attachmentKeys(data){
   const keys=new Set(),drafts=new Set();
   for(const p of data.projects||[]){
     for(const r of p.library||[])if(r.key)keys.add(String(r.key));
     for(const b of p.contentBlocks||[])if(b.key)keys.add(String(b.key));
     for(const page of p.notePages||[])
       for(const obj of page.objects||[])
         if(obj.type==='image'&&obj.key)keys.add(String(obj.key));
     drafts.add('v6-draft-'+p.id);
   }
   return {required:keys,drafts};
 }
 function validatePlannerShape(data){
   if(!data||typeof data!=='object'||Array.isArray(data)||
     !Array.isArray(data.tasks)||!Array.isArray(data.goals)||!Array.isArray(data.habits)||
     (data.projects!==undefined&&!Array.isArray(data.projects)))throw Error('Unrecognized Blueprint backup data');
   const ids=new Set();
   for(const p of data.projects||[]){
     if(!p||typeof p!=='object'||Array.isArray(p)||p.id==null)throw Error('Invalid project in backup');
     const id=String(p.id);
     if(ids.has(id))throw Error('Duplicate project ID in backup');
     ids.add(id);
     for(const prop of ['library','contentBlocks','notePages'])
       if(p[prop]!==undefined&&!Array.isArray(p[prop]))throw Error('Invalid project '+prop+' in backup');
     for(const page of p.notePages||[])
       if(!page||typeof page!=='object'||(page.objects!==undefined&&!Array.isArray(page.objects)))
         throw Error('Invalid notebook page in backup');
   }
 }
 // Validate all source bytes BEFORE asking permission or writing to this device.
 async function inspectBackup(source){
   const complete=source?.format==='canvas-complete-backup';
   if(!complete){
     if(source&&typeof source==='object'&&'format' in source)
       throw Error('Unsupported backup format');
     validatePlannerShape(source);
     return {complete:false,data:source,media:new Map()};
   }
   if(![1,2].includes(source.version))throw Error('Unsupported complete backup version');
   validatePlannerShape(source.state);
   if(!Array.isArray(source.attachments))throw Error('Backup has no attachment manifest');
   if(source.version===2){
     if(!/^[a-f0-9]{64}$/i.test(source.stateSha256||''))
       throw Error('Backup state checksum is missing');
     if(await hashState(source.state)!==source.stateSha256.toLowerCase())
       throw Error('Backup state checksum mismatch: backup is corrupted');
   }
   const {required,drafts}=attachmentKeys(source.state),media=new Map();
   for(const entry of source.attachments){
     if(!entry||typeof entry!=='object'||typeof entry.key!=='string'||!entry.key||
       typeof entry.base64!=='string'||typeof entry.mime!=='string')
       throw Error('Invalid attachment entry');
     if(media.has(entry.key))throw Error('Duplicate attachment key: '+entry.key);
     if(!required.has(entry.key)&&!drafts.has(entry.key))
       throw Error('Unreferenced attachment in backup: '+entry.key);
     const blob=base64ToBlob(entry.base64,entry.mime);
     if(blob.size>100*1024*1024)throw Error('Attachment exceeds safe import size: '+entry.key);
     if(source.version===2){
       if(!Number.isSafeInteger(entry.size)||entry.size!==blob.size||
         !/^[a-f0-9]{64}$/i.test(entry.sha256||''))
         throw Error('Missing or incorrect attachment integrity data: '+entry.key);
       if(await hashBlob(blob)!==entry.sha256.toLowerCase())
         throw Error('Attachment checksum mismatch: '+entry.key);
     }else if(entry.size!=null&&entry.size!==blob.size){
       throw Error('Attachment size mismatch: '+entry.key);
     }
     media.set(entry.key,blob);
   }
   for(const key of required)
     if(!media.has(key))throw Error('Backup is missing saved attachment: '+key);
   return {complete:true,data:source.state,media};
 }
 async function exportCompleteBackup(){
   const snapshot=structuredClone(state);
   const {required,drafts}=attachmentKeys(snapshot),attachments=[];
   for(const key of new Set([...required,...drafts])){
     const blob=await v6Blob('get',key);
     if(!blob){if(required.has(key))throw Error('Missing saved attachment: '+key);continue;}
     attachments.push({key,mime:blob.type||'application/octet-stream',
       size:blob.size,sha256:await hashBlob(blob),base64:await blobToBase64(blob)});
   }
   // Finish the integrity manifest before offering a download.
   const packageData={format:'canvas-complete-backup',version:2,
     exportedAt:new Date().toISOString(),state:snapshot,stateSha256:await hashState(snapshot),attachments};
   const u=URL.createObjectURL(new Blob([JSON.stringify(packageData)],{type:'application/json'}));
   const a=document.createElement('a');
   a.href=u;a.download='canvas-complete-'+new Date().toISOString().slice(0,10)+'.json';
   document.body.appendChild(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(u),30000);
 }
 async function importCompleteBackup(file){
   const source=JSON.parse(await file.text());
   const inspected=await inspectBackup(source);
   if(canvasUnsaved)throw Error('Some current edits have not been saved. Export your current work before importing');
   if(!inspected.complete &&
     !confirm('This is an older text-only backup; it may not contain files, sketches or images. Continue?'))return;
   if(!confirm('Replace your current Blueprint data with this backup? Export a complete backup of your current data first.'))return;

   const originalState=state,created=[],draftChanges=[];
   let next,committed=false;
   try{
     next=normalize(inspected.data);
     const remap=new Map();
     // Stage newly imported media under unique keys, never overwriting existing keys.
     for(const [sourceKey,blob] of inspected.media){
       if(sourceKey.startsWith('v6-draft-'))continue;
       const key='v85-import-'+crypto.randomUUID();
       await v6Blob('put',key,blob);
       created.push(key);remap.set(sourceKey,key);
     }
     for(const p of next.projects||[]){
       for(const item of p.library||[])if(item.key)item.key=remap.get(String(item.key))||item.key;
       for(const item of p.contentBlocks||[])if(item.key)item.key=remap.get(String(item.key))||item.key;
       for(const page of p.notePages||[])
         for(const item of page.objects||[])
           if(item.type==='image'&&item.key)item.key=remap.get(String(item.key))||item.key;
     }
     // Sketch drafts have fixed project-scoped keys. Snapshot them so both
     // replacement and deletion can be reversed if the import fails.
     const projectIds=new Set([...(originalState.projects||[]),...(next.projects||[])].map(p=>String(p.id)));
     for(const id of projectIds){
       const key='v6-draft-'+id;
       const before=await v6Blob('get',key);
       const after=inspected.media.get(key)||null;
       draftChanges.push({key,before,after,applied:false});
     }
     state=next;
     if(!save()||localStorage.getItem(STORAGE_KEY)!==JSON.stringify(next))
       throw Error('Planner storage is full or unavailable; existing data will be restored');
     committed=true;
     for(const change of draftChanges){
       if(change.after)await v6Blob('put',change.key,change.after);
       else await v6Blob('delete',change.key);
       change.applied=true;
     }
   }catch(error){
     const recoveryErrors=[];
     for(const change of [...draftChanges].reverse()){
       if(!change.applied)continue;
       try{
         if(change.before)await v6Blob('put',change.key,change.before);
         else await v6Blob('delete',change.key);
       }catch(e){recoveryErrors.push('Sketch draft: '+change.key);}
     }
     state=originalState;
     if(!save())recoveryErrors.push('Planner storage');
     for(const key of created){
       try{await v6Blob('delete',key);}catch(e){recoveryErrors.push('Temporary attachment: '+key);}
     }
     if(recoveryErrors.length)
       throw Error('Import failed and automatic recovery was incomplete ('+
         recoveryErrors.join(', ')+'). Do not clear browser storage. '+error.message);
     throw error;
   }
   // Rendering errors must never roll back a successfully committed import.
   window.v6ActiveProjectId=null;
   try{v6Normalize();render();v6Render();}
   catch(error){console.error('Imported data saved, but the view needs refresh',error);
     alert('Blueprint backup restored, but the view needs a reload. Your imported data was saved.');return;}
   alert('Blueprint backup restored. '+(inspected.complete?'All attachment checks passed.':'This was a text-only backup.'));
 }
 document.getElementById('exportData').onclick=async()=>{
   try{await exportCompleteBackup();}
   catch(err){alert('Backup failed. No incomplete backup was downloaded. '+err.message);}
 };
 window.v74ImportBackup=importCompleteBackup;

})();
