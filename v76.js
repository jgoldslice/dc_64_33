'use strict';
// Canvas project notes v7.6: a simple, per-project, multi-page freeform notebook.
// The old notebookText/contentBlocks and saved sketch resources are retained.
(function(){
  const pane=document.getElementById('projectNotes');
  if(!pane)return;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const editorHtml='<div id="v76Editor" class="v76-notebook-ui">'+
    '<div class="v76-page-controls"><label for="v76PageSelect" class="v76-sr">Note page</label><select id="v76PageSelect" aria-label="Select note page"></select>'+
    '<button type="button" id="v76NewPage" class="secondary-button">+ Page</button>'+
    '<button type="button" id="v76PageMore" class="v76-icon" aria-label="Page options" aria-expanded="false" aria-controls="v76PageMenu" title="Page options">•••</button>'+
    '<div id="v76PageMenu" class="v76-page-menu" hidden><button type="button" id="v76RenamePage">Rename page</button>'+
    '<button type="button" id="v76DeletePage">Delete page</button></div></div>'+
    '<div class="v76-toolbar" role="toolbar" aria-label="Notebook tools">'+
      '<div class="v79-tool-group" role="group" aria-label="Text"><div class="v79-tool-buttons">'+
        '<button type="button" data-v76-format="insertUnorderedList" aria-label="Add or remove bullet list" title="Bullet list">'+
          '<svg class="v79-tool-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="4.5" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1" fill="currentColor" stroke="none"/><path d="M9 6h11M9 12h11M9 18h11"/></svg>'+
        '</button><select id="v80TextSize" class="v80-text-size" aria-label="Text size" title="Text size">'+
          '<option value="small">Small</option><option value="medium" selected>Medium</option><option value="large">Large</option>'+
        '</select></div></div>'+
      '<div class="v79-tool-group" role="group" aria-label="Pen"><div class="v79-tool-buttons">'+
        '<button type="button" data-v76-mode="pen" aria-label="Draw; tap again to stop drawing" aria-pressed="false" title="Draw">✎</button>'+
        '<button type="button" data-v76-mode="erase" aria-label="Erase drawing strokes; tap again to stop erasing" aria-pressed="false" title="Eraser">'+
          '<svg class="v79-tool-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.3 20.4 3.6 15.7a2.2 2.2 0 0 1 0-3.1l9-9a2.2 2.2 0 0 1 3.1 0l4.7 4.7a2.2 2.2 0 0 1 0 3.1l-9 9a2.2 2.2 0 0 1-3.1 0Z"/><path d="M12 21h9"/></svg></button>'+
        '<button type="button" id="v76UndoInk" aria-label="Undo last drawing stroke" title="Undo drawing">↶</button>'+
      '</div></div>'+
      '<div class="v79-tool-group" role="group" aria-label="Misc"><div class="v79-tool-buttons">'+
        '<button type="button" id="v76AddImage" aria-label="Insert picture" title="Insert picture">'+
          '<svg class="v79-tool-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg></button>'+
      '</div></div>'+
    '</div><div class="v811-note-body"><aside class="v811-page-rail" aria-label="Notebook pages"><div class="v811-pages-heading"><strong>Pages</strong><button type="button" id="v811NewPage" aria-label="Add note page" title="Add page">+</button></div><div id="v811PageList" class="v811-page-list"></div></aside><div class="v76-page-wrap"><div id="v76Surface" class="v76-page-surface" aria-label="Freeform notebook page"><svg id="v76Ink" xmlns="http://www.w3.org/2000/svg"></svg></div></div></div>'+
    '<p class="v76-tip">Tap an object to select it, drag to move, or use the handles to resize. Tap selected text again to edit. Tap blank space to type. Saves automatically.</p>'+
    '<input type="file" id="v76ImageInput" accept="image/*" hidden></div>';
  pane.insertAdjacentHTML('beforeend',editorHtml);
  const root=document.getElementById('v76Editor'),surface=document.getElementById('v76Surface'),ink=document.getElementById('v76Ink');
  const pageList=document.getElementById('v811PageList');
  const pageSelect=document.getElementById('v76PageSelect');
  const textSizeSelect=document.getElementById('v80TextSize');
  const validSizes=new Set(['small','medium','large']);
  const sizeName=value=>validSizes.has(value)?value:'medium';
  // These remain in the DOM for backwards compatibility, but are no longer the UI.
  for(const id of ['projectNotebook','v74Blocks','v74BlockImage','projectNotesList']){
    const el=document.getElementById(id);if(el)el.hidden=true;
  }
  const oldToolbar=pane.querySelector('.v74-block-toolbar');if(oldToolbar)oldToolbar.hidden=true;
  const sketchTab=document.querySelector('[data-project-tab="sketch"]');if(sketchTab)sketchTab.hidden=true;
  const todoTab=document.querySelector('[data-project-tab="actions"]');if(todoTab)todoTab.textContent='To-Do';
  const todoHeading=document.querySelector('#projectActions h2');if(todoHeading)todoHeading.textContent='To-Do';
  const todoInput=document.getElementById('projectActionInput');if(todoInput){todoInput.placeholder='Add a to-do...';todoInput.setAttribute('aria-label','New project to-do');}
  let mode='select',lastKey='',lastPageRef=null,selectedText=null,selectedItemId=null;
  const newId=()=>v6Id();
  function plainHTML(txt){return esc(txt).replace(/\r\n?/g,'\n').replace(/\n/g,'<br>');}
  function cleanHTML(html){
    const tmp=document.createElement('template');tmp.innerHTML=String(html||'');
    const allowed=new Set(['B','STRONG','I','EM','UL','LI','DIV','P','BR','SPAN']);
    function traverse(node){
      if(node.nodeType===3)return esc(node.textContent);
      if(node.nodeType!==1)return '';
      const inner=[...node.childNodes].map(traverse).join('');
      if(node.tagName==='BR')return '<br>';
      if(!allowed.has(node.tagName))return inner;
      return '<'+node.tagName.toLowerCase()+'>'+inner+'</'+node.tagName.toLowerCase()+'>';
    }
    return [...tmp.content.childNodes].map(traverse).join('');
  }
  function initializePages(p){
    if(Array.isArray(p.notePages)&&p.notePages.length){
      if(!p.notePages.some(pg=>String(pg.id)===String(p.activeNotePageId)))p.activeNotePageId=p.notePages[0].id;
      return;
    }
    let y=22,objects=[];
    const addText=(html,width=360)=>{
      objects.push({id:newId(),type:'text',x:14,y,width,html});y+=Math.max(100,Math.ceil(html.replace(/<[^>]*>/g,'').length/34)*33+45);
    };
    if(String(p.notebookText||'').trim())addText(plainHTML(p.notebookText));
    for(const b of p.contentBlocks||[]){
      if(b.type==='image'&&b.key){objects.push({id:newId(),type:'image',x:14,y,width:250,key:b.key,alt:b.text||'Note image'});y+=230;}
      else if(b.text){
        const prefix=b.type==='heading'?'<b>':'',suffix=b.type==='heading'?'</b>':'';
        const content=(b.type==='checklist'?(b.checked?'☑ ':'☐ '):'')+b.text;
        addText(prefix+plainHTML(content)+suffix);
      }
    }
    if(!objects.length)addText('');
    const page={id:newId(),title:'Page 1',height:Math.max(740,y+200),objects,strokes:[]};
    p.notePages=[page];p.activeNotePageId=page.id;
    save(); // The older notebook fields remain as a separate recovery copy.
  }
  function current(){
    const p=v6Project();if(!p)return null;
    initializePages(p);
    return {p,page:p.notePages.find(pg=>String(pg.id)===String(p.activeNotePageId))||p.notePages[0]};
  }
  function syncSummary(p){
    // Keep the existing "Develop in ChatGPT" handoff useful with new note pages.
    p.notebookText=p.notePages.map(pg=>pg.title+'\n'+pg.objects.filter(o=>o.type==='text').map(o=>{
      const t=document.createElement('div');t.innerHTML=cleanHTML(o.html);return t.textContent||'';
    }).join('\n')).join('\n\n').trim();
  }
  function persist(){const x=current();if(!x)return;syncSummary(x.p);save();}
  function selectionInEditor(){
    const el=document.activeElement?.closest?.('.v76-rich');
    if(el)selectedText=el;
    return selectedText&&surface.contains(selectedText)?selectedText:null;
  }
  function applyMode(next){
    mode=next;root.querySelectorAll('[data-v76-mode]').forEach(btn=>{
      const on=btn.dataset.v76Mode===next;btn.classList.toggle('v76-on',on);btn.setAttribute('aria-pressed',String(on));
    });
    surface.classList.toggle('v76-is-drawing',next==='pen'||next==='erase');
    ink.style.pointerEvents=(next==='pen'||next==='erase')?'auto':'none';
  }
  function strokesView(page){
    ink.replaceChildren();
    // A tablet media query can make the *displayed* page 800/980px high
    // even though page.height is still 740. Matching the actual drawing
    // surface avoids SVG's default centered letterbox and Pencil drift.
    ink.setAttribute('preserveAspectRatio','none');
    ink.setAttribute('viewBox','0 0 '+Math.max(1,surface.clientWidth)+' '+Math.max(1,surface.clientHeight));
    for(const stroke of page.strokes||[]){
      const poly=document.createElementNS('http://www.w3.org/2000/svg','polyline');
      poly.setAttribute('points',stroke.points.map(pt=>pt.x+','+pt.y).join(' '));
      poly.setAttribute('fill','none');poly.setAttribute('stroke',stroke.color||'#bda8da');
      poly.setAttribute('stroke-width',String(stroke.width||2.5));poly.setAttribute('stroke-linecap','round');
      poly.setAttribute('stroke-linejoin','round');ink.append(poly);
    }
  }
  function visibleWidth(item){
    // Responsive fallback is temporary: moving an object never alters its saved width.
    return Math.min(Math.max(135,Number(item.width)||250),Math.max(135,surface.clientWidth-18));
  }
  function placeBox(el,item){
    const width=visibleWidth(item);
    const maxX=Math.max(0,surface.clientWidth-width-8);
    el.style.left=Math.min(Math.max(0,Number(item.x)||0),maxX)+'px';
    el.style.top=Math.max(0,Number(item.y)||0)+'px';
    el.style.width=width+'px';
  }
  function addRenderedObject(item,p,page){
    const box=document.createElement('div');box.className='v76-item v76-'+item.type;box.dataset.v76Item=item.id;
    placeBox(box,item);
    const grip=document.createElement('button');grip.type='button';grip.className='v76-grip';grip.dataset.v76Drag=item.id;
    grip.textContent='⠿';grip.title='Drag left or right to resize';grip.setAttribute('aria-label','Resize '+item.type);box.append(grip);
    const remove=document.createElement('button');remove.type='button';remove.className='v76-remove';remove.dataset.v76Remove=item.id;
    remove.textContent='×';remove.setAttribute('aria-label','Remove '+item.type);
    if(item.type==='text'){
      const el=document.createElement('div');el.className='v76-rich';el.dataset.v76Text=item.id;
      el.contentEditable='true';el.spellcheck=true;el.setAttribute('role','textbox');el.setAttribute('aria-label','Editable note text');
      el.dataset.fontSize=sizeName(item.fontSize);
      el.innerHTML=cleanHTML(item.html);
      el.addEventListener('focus',()=>{
        selectedText=el;
        textSizeSelect.value=sizeName(item.fontSize);
        applyMode('select');
      });
      box.append(el);
    }else if(item.type==='image'){
      const img=document.createElement('img');img.className='v76-photo';img.alt=item.alt||'Note picture';img.draggable=false;img.dataset.v76ImageKey=item.key;
      box.append(img);
      const projectId=String(p.id),pageId=String(page.id),key=item.key;
      v6Blob('get',key).then(blob=>{
        if(!blob||String(v6Project()?.id)!==projectId||String(current()?.page.id)!==pageId||!box.isConnected)return;
        const url=URL.createObjectURL(blob);img.onload=()=>URL.revokeObjectURL(url);img.onerror=()=>URL.revokeObjectURL(url);img.src=url;
      }).catch(()=>{});
    }
    box.append(remove);surface.append(box);
  }
  function drawPage(p,page){
    surface.querySelectorAll('.v76-item').forEach(el=>el.remove());
    const height=Math.max(740,Number(page.height)||740);page.height=height;surface.style.height=height+'px';
    for(const item of page.objects||[])addRenderedObject(item,p,page);
    strokesView(page);
  }
  function renderPage(p,force=false){
    initializePages(p);
    const page=p.notePages.find(pg=>String(pg.id)===String(p.activeNotePageId))||p.notePages[0];
    const key=String(p.id)+':'+String(page.id);
    // After a full backup import, ids may be identical even though the
    // underlying page objects (including attachment keys) have changed.
    if(!force&&key===lastKey&&page===lastPageRef)return;
    lastKey=key;lastPageRef=page;selectedText=null;
    pageSelect.replaceChildren();
    p.notePages.forEach(pg=>{
      const opt=document.createElement('option');opt.value=pg.id;opt.textContent=pg.title;pageSelect.append(opt);
    });
    pageSelect.value=String(page.id);
    textSizeSelect.value=sizeName(page.defaultTextSize);
    drawPage(p,page);applyMode('select');
  }
  // v74 already wraps this function. Retain its existing save/import/backup behavior.
  const oldRenderNotes=v6RenderNotes;
  v6RenderNotes=function(p){oldRenderNotes(p);renderPage(p);};
  function growPage(page,needed){
    if(needed<=page.height)return;
    page.height=Math.ceil((needed+160)/180)*180;surface.style.height=page.height+'px';strokesView(page);
  }
  function createText(x,y){
    const ctx=current();if(!ctx)return;
    const {page}=ctx;
    const width=Math.max(170,Math.min(360,surface.clientWidth-Math.max(0,x)-20));
    const o={id:newId(),type:'text',x:Math.max(0,Math.round(x)),y:Math.max(0,Math.round(y)),width,html:'',fontSize:sizeName(page.defaultTextSize)};
    page.objects.push(o);growPage(page,y+150);persist();drawPage(ctx.p,page);
    const box=surface.querySelector('[data-v76-item="'+o.id+'"] .v76-rich');
    if(box){box.focus();selectedText=box;}applyMode('select');
  }
  function position(e){
    const rect=surface.getBoundingClientRect();
    return {x:Math.round(e.clientX-rect.left),y:Math.round(e.clientY-rect.top)};
  }
  surface.addEventListener('click',e=>{
    if(mode==='pen'||mode==='erase')return;
    if(e.target===surface||e.target===ink){const pt=position(e);createText(Math.max(8,pt.x-10),Math.max(8,pt.y-20));}
  });
  pageSelect.addEventListener('change',()=>{
    const ctx=current();if(!ctx)return;ctx.p.activeNotePageId=pageSelect.value;persist();renderPage(ctx.p,true);
  });
  document.getElementById('v76NewPage').addEventListener('click',()=>{
    const ctx=current();if(!ctx)return;
    const n=ctx.p.notePages.length+1;
    const title=(prompt('Page name','Page '+n)||'').trim();if(!title)return;
    const pg={id:newId(),title:title.slice(0,80),height:740,defaultTextSize:'medium',objects:[{id:newId(),type:'text',x:14,y:22,width:320,html:'',fontSize:'medium'}],strokes:[]};
    ctx.p.notePages.push(pg);ctx.p.activeNotePageId=pg.id;persist();renderPage(ctx.p,true);
  });
  const pageMore=document.getElementById('v76PageMore');
  const pageMenu=document.getElementById('v76PageMenu');
  const closePageMenu=()=>{pageMenu.hidden=true;pageMore.setAttribute('aria-expanded','false');};
  pageMore.addEventListener('click',()=>{
    pageMenu.hidden=!pageMenu.hidden;pageMore.setAttribute('aria-expanded',String(!pageMenu.hidden));
  });
  document.addEventListener('click',e=>{if(!(e.target instanceof Element))return;if(!e.target.closest('.v76-page-controls'))closePageMenu();});
  document.getElementById('v76RenamePage').addEventListener('click',()=>{
    closePageMenu();
    const ctx=current();if(!ctx)return;
    const title=(prompt('Rename page',ctx.page.title)||'').trim();if(!title)return;
    ctx.page.title=title.slice(0,80);persist();renderPage(ctx.p,true);
  });
  document.getElementById('v76DeletePage').addEventListener('click',()=>{
    closePageMenu();
    const ctx=current();if(!ctx)return;
    if(ctx.p.notePages.length<2){alert('Keep at least one page in each project.');return;}
    if(!confirm('Delete "'+ctx.page.title+'" and everything on this page? This cannot be undone.'))return;
    ctx.p.notePages=ctx.p.notePages.filter(pg=>pg!==ctx.page);
    ctx.p.activeNotePageId=ctx.p.notePages[0].id;persist();renderPage(ctx.p,true);
  });
  textSizeSelect.addEventListener('change',()=>{
    const next=sizeName(textSizeSelect.value),ctx=current();
    if(!ctx)return;
    // The chosen size is remembered for newly created boxes on this page.
    ctx.page.defaultTextSize=next;
    const rich=selectionInEditor();
    const item=rich&&ctx.page.objects.find(o=>String(o.id)===String(rich.dataset.v76Text));
    if(item&&item.type==='text'){
      item.fontSize=next;
      rich.dataset.fontSize=next; // No redraw or loss of the editing caret.
      growPage(ctx.page,rich.closest('.v76-item').offsetTop+rich.closest('.v76-item').offsetHeight+70);
    }
    persist();
  });
  root.addEventListener('pointerdown',e=>{
    const format=e.target.closest('[data-v76-format]');
    if(format)e.preventDefault(); // preserve the selected text on iPhone
  });
  root.addEventListener('click',e=>{
    const format=e.target.closest('[data-v76-format]');
    if(format){
      let el=selectionInEditor();
      if(!el){
        const ctx=current();if(!ctx)return;
        const nextY=Math.max(24,...ctx.page.objects.map(o=>(Number(o.y)||0)+(o.type==='image'?250:110)+14));
        createText(14,nextY);
        el=selectionInEditor();
      }
      if(!el)return;
      el.focus();
      document.execCommand(format.dataset.v76Format,false,null);
      const ctx=current(),item=ctx?.page.objects.find(o=>o.id===el.dataset.v76Text);
      if(item){item.html=cleanHTML(el.innerHTML);persist();}
      return;
    }
    const modeButton=e.target.closest('[data-v76-mode]');
    if(modeButton){
      const next=modeButton.dataset.v76Mode;
      applyMode(mode===next?'select':next);
      return;
    }
    const rem=e.target.closest('[data-v76-remove]');
    if(rem){
      const ctx=current();if(!ctx)return;
      ctx.page.objects=ctx.page.objects.filter(o=>String(o.id)!==String(rem.dataset.v76Remove));persist();drawPage(ctx.p,ctx.page);return;
    }
  });
  surface.addEventListener('focusin',e=>{if(e.target.matches('.v76-rich'))selectedText=e.target;});
  surface.addEventListener('input',e=>{
    const el=e.target.closest('.v76-rich');if(!el)return;
    const ctx=current(),item=ctx?.page.objects.find(o=>String(o.id)===el.dataset.v76Text);if(!item)return;
    item.html=cleanHTML(el.innerHTML);
    const container=el.closest('.v76-item');growPage(ctx.page,container.offsetTop+container.offsetHeight+60);
    persist(); // do not redraw: preserve caret and keyboard position
  });
  surface.addEventListener('paste',async e=>{
    const image=[...(e.clipboardData?.items||[])].find(item=>item.kind==='file'&&item.type.startsWith('image/'));
    if(image){e.preventDefault();const file=image.getAsFile();if(file)await insertImage(file);return;}
    if(e.target.closest('.v76-rich')){e.preventDefault();document.execCommand('insertText',false,e.clipboardData?.getData('text/plain')||'');}
  });
  async function insertImage(file){
    const ctx=current();if(!ctx||!file)return;
    if(!file.type.startsWith('image/')||file.size>40*1024*1024){alert('Choose an image under 40 MB.');return;}
    const key='v76-note-'+newId();
    try{
      await v6Blob('put',key,file);
      const y=Math.max(28,...ctx.page.objects.map(o=>(o.y||0)+(o.type==='image'?240:100)+16));
      ctx.page.objects.push({id:newId(),type:'image',x:16,y,width:260,key,alt:file.name||'Photo'});
      // Mirror the reference into the legacy attachment manifest for complete exports.
      if(!Array.isArray(ctx.p.contentBlocks))ctx.p.contentBlocks=[];
      ctx.p.contentBlocks.push({id:newId(),type:'image',text:'',checked:false,key});
      growPage(ctx.page,y+300);persist();drawPage(ctx.p,ctx.page);
    }catch(err){alert('Could not save image on this device: '+err.message);}
  }
  document.getElementById('v76AddImage').addEventListener('click',()=>document.getElementById('v76ImageInput').click());
  document.getElementById('v76ImageInput').addEventListener('change',async e=>{
    const file=e.target.files?.[0];e.target.value='';if(file)await insertImage(file);
  });
  // The six-dot handle changes the saved width ONLY. Long-pressing the object
  // (not its handle or controls) changes its saved position ONLY.
  const HOLD_MS=450;
  let interaction=null,pendingHold=null,holdTimer=null;
  function clearPendingHold(){
    if(holdTimer!==null)clearTimeout(holdTimer);
    if(pendingHold?.box)pendingHold.box.classList.remove('v80-touch-pending');
    holdTimer=null;pendingHold=null;
  }
  function startInteraction(session){
    interaction=session;
    session.box.classList.add(session.kind==='resize'?'v76-resizing':'v76-moving');
    try{session.capture.setPointerCapture(session.pointerId);}catch(_){}
  }
  root.addEventListener('pointerdown',e=>{
    if(e.button!==0||interaction||pendingHold)return;
    const grip=e.target.closest('[data-v76-drag]');
    if(grip){
      const ctx=current(),obj=ctx?.page.objects.find(o=>String(o.id)===String(grip.dataset.v76Drag));
      if(!obj)return;
      const box=grip.closest('.v76-item');
      // Commit the actual displayed anchor before changing width so a previously
      // edge-clamped box does not jump when it shrinks.
      obj.x=parseFloat(box.style.left)||0;
      e.preventDefault();
      startInteraction({kind:'resize',pointerId:e.pointerId,capture:grip,box,obj,page:ctx.page,
        x:e.clientX,startWidth:visibleWidth(obj),changed:false});
      return;
    }
    const box=e.target.closest('.v76-item');
    if(!box||e.target.closest('button,.v76-size-tools')||mode==='pen'||mode==='erase')return;
    const ctx=current(),obj=ctx?.page.objects.find(o=>String(o.id)===String(box.dataset.v76Item));
    if(!obj)return;
    const session={kind:'move',pointerId:e.pointerId,capture:box,box,obj,page:ctx.page,
      x:e.clientX,y:e.clientY,startX:parseFloat(box.style.left)||0,
      startY:parseFloat(box.style.top)||0,changed:false};
    pendingHold=session;
    // Temporarily disable native selection while classifying touch as
    // tap-to-edit or hold-to-move.
    if(e.pointerType==='touch'){
      box.classList.add('v80-touch-pending');
      e.preventDefault();
    }
    holdTimer=setTimeout(()=>{
      if(pendingHold!==session)return;
      clearPendingHold();
      if(document.activeElement?.isContentEditable)document.activeElement.blur();
      const selection=window.getSelection();
      if(selection)selection.removeAllRanges();
      startInteraction(session);
    },HOLD_MS);
  });
  root.addEventListener('pointermove',e=>{
    if(pendingHold&&pendingHold.pointerId===e.pointerId){
      if(Math.hypot(e.clientX-pendingHold.x,e.clientY-pendingHold.y)>10)clearPendingHold();
    }
    if(!interaction||interaction.pointerId!==e.pointerId)return;
    const d=interaction;
    if(d.kind==='resize'){
      // Dragging the handle right expands the box; left contracts it.
      const maxWidth=Math.max(135,surface.clientWidth-(parseFloat(d.box.style.left)||0)-8);
      const width=Math.min(maxWidth,Math.max(135,Math.round(d.startWidth+e.clientX-d.x)));
      if(width!==d.obj.width){d.obj.width=width;d.changed=true;}
    }else{
      const width=visibleWidth(d.obj);
      const maxX=Math.max(0,surface.clientWidth-width-8);
      const x=Math.min(maxX,Math.max(0,Math.round(d.startX+e.clientX-d.x)));
      const y=Math.max(0,Math.round(d.startY+e.clientY-d.y));
      if(x!==d.obj.x||y!==d.obj.y){d.obj.x=x;d.obj.y=y;d.changed=true;}
    }
    placeBox(d.box,d.obj);
    growPage(d.page,(parseFloat(d.box.style.top)||0)+d.box.offsetHeight+80);
  });
  function focusOnTap(e,session){
    if(session.obj.type!=='text')return;
    const rich=session.box.querySelector('.v76-rich');
    if(!rich)return;
    rich.focus({preventScroll:true});
    selectedText=rich;
    textSizeSelect.value=sizeName(session.obj.fontSize);
    // iOS Safari supports caretRangeFromPoint; position the cursor where
    // the finger landed rather than blindly appending all new text.
    const range=document.caretRangeFromPoint?.(e.clientX,e.clientY);
    if(range&&rich.contains(range.startContainer)){
      const selection=window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  }
  // iOS may select the entire editable block before the 450-ms hold.
  // Cancel native touch behavior for note content; restore short taps
  // explicitly so normal typing continues.
  const gestureElement=e=>e.target instanceof Element?e.target:e.target?.parentElement;
  root.addEventListener('touchstart',e=>{
    if(mode==='pen'||mode==='erase'||e.touches.length!==1)return;
    const el=gestureElement(e);
    if(el?.closest('.v76-item')&&!el.closest('button'))e.preventDefault();
  },{passive:false});
  root.addEventListener('contextmenu',e=>{
    if(gestureElement(e)?.closest('.v76-item')&&(pendingHold||interaction?.kind==='move'))e.preventDefault();
  });
  root.addEventListener('selectstart',e=>{
    // Selectstart can originate from a Text node rather than an Element.
    if(gestureElement(e)?.closest('.v76-item')&&(pendingHold||interaction?.kind==='move'))e.preventDefault();
  });
  function endInteraction(e){
    if(pendingHold?.pointerId===e.pointerId){
      const session=pendingHold;
      clearPendingHold();
      if(session.capture&&e.pointerType==='touch'&&e.type==='pointerup')focusOnTap(e,session);
    }
    if(!interaction||interaction.pointerId!==e.pointerId)return;
    const d=interaction;interaction=null;
    d.box.classList.remove('v76-moving','v76-resizing');
    if(d.changed)persist();
  }
  root.addEventListener('pointerup',endInteraction);
  root.addEventListener('pointercancel',endInteraction);
  // Prevent the native drag-image ghost from intercepting long-press movement.
  root.addEventListener('dragstart',e=>{if(e.target.closest('.v76-item'))e.preventDefault();});
  // Convert the Pencil's screen contact into actual SVG user coordinates.
  // getScreenCTM covers scrolling, Safari zoom, responsive sizing and CSS
  // transforms; unlike simple rect subtraction it also handles SVG scaling.
  function inkPosition(e){
    const matrix=ink.getScreenCTM?.();
    if(matrix&&typeof DOMPoint==='function'){
      const local=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());
      return {x:Math.round(local.x*100)/100,y:Math.round(local.y*100)/100};
    }
    // Fallback for browser versions lacking DOMPoint.
    const box=ink.getBoundingClientRect(),view=ink.viewBox.baseVal;
    return {x:Math.round((e.clientX-box.left)*view.width/Math.max(1,box.width)*100)/100,
      y:Math.round((e.clientY-box.top)*view.height/Math.max(1,box.height)*100)/100};
  }
  // Stroke eraser: continuously sweep a circular contact area along the
  // Pencil / finger path, removing every intersected stroke, not just strokes
  // with a saved point close to the initial tap. Crossing long sparse line
  // segments must also work (many drawn strokes have widely spaced points).
  const ERASER_RADIUS=18;
  const sqDistance=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2;
  function pointSegmentDistanceSq(point,start,end){
    const dx=end.x-start.x,dy=end.y-start.y,lenSq=dx*dx+dy*dy;
    if(lenSq===0)return sqDistance(point,start);
    const t=Math.max(0,Math.min(1,((point.x-start.x)*dx+(point.y-start.y)*dy)/lenSq));
    return sqDistance(point,{x:start.x+t*dx,y:start.y+t*dy});
  }
  function segmentsCross(a,b,c,d){
    const cross=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
    const ab1=cross(a,b,c),ab2=cross(a,b,d),cd1=cross(c,d,a),cd2=cross(c,d,b);
    // Collinear/endpoint contact is also handled by the distance checks.
    return (ab1*ab2<0&&cd1*cd2<0);
  }
  function crossesStroke(stroke,from,to){
    const points=stroke.points||[];
    if(!points.length)return false;
    const radiusSq=(ERASER_RADIUS+Math.max(0,Number(stroke.width)||2.5)/2)**2;
    if(points.length===1)return pointSegmentDistanceSq(points[0],from,to)<=radiusSq;
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i];
      if(segmentsCross(from,to,a,b)
        ||pointSegmentDistanceSq(a,from,to)<=radiusSq
        ||pointSegmentDistanceSq(b,from,to)<=radiusSq
        ||pointSegmentDistanceSq(from,a,b)<=radiusSq
        ||pointSegmentDistanceSq(to,a,b)<=radiusSq)return true;
    }
    return false;
  }
  function eraseSweep(page,from,positions){
    let previous=from;
    if(!positions.length)return previous;
    const path=positions.map(inkPosition);
    const passes=[previous,...path];
    const oldCount=(page.strokes||[]).length;
    page.strokes=page.strokes.filter(stroke=>{
      for(let i=1;i<passes.length;i++){
        if(crossesStroke(stroke,passes[i-1],passes[i]))return false;
      }
      return true;
    });
    previous=path[path.length-1];
    if(page.strokes.length!==oldCount){
      strokesView(page);
      persist(); // Save during a drag, not just at pointerup.
    }
    return previous;
  }
  const pointerSamples=e=>{
    const coalesced=e.getCoalescedEvents?.();
    return coalesced?.length?coalesced:[e];
  };
  let activeStroke=null,activeErase=null;
  ink.addEventListener('pointerdown',e=>{
    const ctx=current();if(!ctx||(mode!=='pen'&&mode!=='erase'))return;
    if(e.pointerType==='mouse'&&e.button!==0)return;
    e.preventDefault();ink.setPointerCapture(e.pointerId);
    const pt=inkPosition(e);
    if(mode==='erase'){
      activeErase={id:e.pointerId,page:ctx.page,last:pt};
      eraseSweep(ctx.page,pt,[e]); // A tap is also an eraser gesture.
      return;
    }
    const css=getComputedStyle(document.documentElement);
    const stroke={id:newId(),points:[pt,pt],width:2.5,color:css.getPropertyValue('--secondary-ui').trim()||'#a58a60'};
    ctx.page.strokes.push(stroke);activeStroke={id:e.pointerId,stroke,page:ctx.page};strokesView(ctx.page);
  });
  ink.addEventListener('pointermove',e=>{
    if(activeErase&&e.pointerId===activeErase.id){
      e.preventDefault();
      activeErase.last=eraseSweep(activeErase.page,activeErase.last,pointerSamples(e));
      return;
    }
    if(!activeStroke||e.pointerId!==activeStroke.id)return;
    activeStroke.stroke.points.push(...pointerSamples(e).map(inkPosition));
    strokesView(activeStroke.page);
  });
  const finishStroke=e=>{
    if(activeErase&&e.pointerId===activeErase.id){
      if(e.type==='pointerup')eraseSweep(activeErase.page,activeErase.last,[e]);
      activeErase=null;
    }
    if(activeStroke&&activeStroke.id===e.pointerId){activeStroke=null;persist();}
  };
  ink.addEventListener('pointerup',finishStroke);
  ink.addEventListener('pointercancel',finishStroke);
  document.getElementById('v76UndoInk').addEventListener('click',()=>{
    const ctx=current();if(!ctx||!ctx.page.strokes.length)return;ctx.page.strokes.pop();persist();strokesView(ctx.page);
  });
  window.addEventListener('resize',()=>{
    const ctx=current();if(ctx)strokesView(ctx.page);
  });
  applyMode('select');
  if(v6Project())renderPage(v6Project(),true);
})();