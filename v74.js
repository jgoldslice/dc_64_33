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
 document.addEventListener('click',e=>{
   const button=e.target.closest('[data-action-view]');
   if(button){const p=getProject();if(!p)return;p.actionView=button.dataset.actionView;save();v6RenderActions(p);return;}
   const add=e.target.closest('#v74AddBlock');
   if(add){const p=getProject();if(!p)return;const type=document.getElementById('v74BlockType').value;if(type==='image'){document.getElementById('v74BlockImage').click();return;}addBlock(p,type);return;}
   const del=e.target.closest('[data-v74-delete-block]');
   if(del){const p=getProject();if(!p||!confirm('Delete this block?'))return;p.contentBlocks=p.contentBlocks.filter(b=>String(b.id)!==del.dataset.v74DeleteBlock);save();renderBlocks(p);return;}
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
 document.addEventListener('click',e=>{const button=e.target.closest('[data-library-view]');if(!button)return;const p=getProject();if(!p)return;p.libraryView=button.dataset.libraryView;save();v6RenderLibrary(p);});
 // Portable JSON backup, including binary attachments and sketch drafts.
 const blobToBase64=blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});
 const base64ToBlob=(data,mime)=>{const binary=atob(data),parts=[];for(let i=0;i<binary.length;i+=32768){const slice=binary.slice(i,i+32768),bytes=new Uint8Array(slice.length);for(let j=0;j<slice.length;j++)bytes[j]=slice.charCodeAt(j);parts.push(bytes);}return new Blob(parts,{type:mime||'application/octet-stream'});};
 function referencedKeys(data){
   const keys=new Set();
   for(const p of data.projects||[]){
     for(const r of p.library||[])if(r.key)keys.add(String(r.key));
     for(const b of p.contentBlocks||[])if(b.key)keys.add(String(b.key));
     keys.add('v6-draft-'+p.id);
   }
   return [...keys];
 }
 async function exportCompleteBackup(){
   const attachments=[];
   for(const key of referencedKeys(state)){
     const blob=await v6Blob('get',key);
     if(!blob){if(!key.startsWith('v6-draft-'))throw Error('Missing saved attachment: '+key);continue;}
     attachments.push({key,mime:blob.type,base64:await blobToBase64(blob)});
   }
   const packageData={format:'canvas-complete-backup',version:1,exportedAt:new Date().toISOString(),state:structuredClone(state),attachments};
   const u=URL.createObjectURL(new Blob([JSON.stringify(packageData)],{type:'application/json'}));
   const a=document.createElement('a');a.href=u;a.download='canvas-complete-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),30000);
 }
 async function importCompleteBackup(file){
   const source=JSON.parse(await file.text());
   const complete=source?.format==='canvas-complete-backup'&&source.version===1;
   const data=complete?source.state:source;
   if(!data||!Array.isArray(data.tasks)||!Array.isArray(data.goals)||!Array.isArray(data.habits))throw Error('Unrecognized backup format');
   if(!confirm('Replace current Canvas data with this backup? Export your current data first.'))return;
   const oldState=state,created=[];
   try{
     const next=normalize(data);
     if(complete){
       if(!Array.isArray(source.attachments))throw Error('Backup has no attachment manifest');
       const byKey=new Map(source.attachments.map(item=>[item.key,item]));
       for(const key of referencedKeys(next)){
         if(key.startsWith('v6-draft-')&&!byKey.has(key))continue;
         if(!byKey.has(key))throw Error('Missing backup attachment: '+key);
       }
       const remap=new Map();
       for(const entry of source.attachments){
         if(typeof entry.key!=='string'||typeof entry.base64!=='string')throw Error('Invalid attachment entry');
         const key='v74-import-'+v6Id();await v6Blob('put',key,base64ToBlob(entry.base64,entry.mime));created.push(key);remap.set(entry.key,key);
       }
       for(const p of next.projects||[]){
         for(const r of p.library||[])if(r.key)r.key=remap.get(r.key)||r.key;
         for(const b of p.contentBlocks||[])if(b.key)b.key=remap.get(b.key)||b.key;
         // Existing draft keys are project-scoped and should not be moved into another project accidentally.
       }
       for(const p of next.projects||[]){
         const draft=remap.get('v6-draft-'+p.id);
         if(draft){const blob=await v6Blob('get',draft);await v6Blob('put','v6-draft-'+p.id,blob);}
       }
     }else if(!confirm('Legacy backup does not contain images, sketches or files. Continue importing text-only data?'))return;
     state=next;save();window.v6ActiveProjectId=null;v6Normalize();render();v6Render();alert('Canvas backup restored.');
   }catch(err){state=oldState;save();for(const key of created)await v6Blob('delete',key).catch(()=>{});throw err;}
 }
 document.getElementById('exportData').onclick=async()=>{try{await exportCompleteBackup();}catch(err){alert('Backup failed. No incomplete backup was downloaded. '+err.message);}};
 window.v74ImportBackup=importCompleteBackup;
})();
