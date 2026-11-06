'use strict';
// Canvas project notes v7.6: a simple, per-project, multi-page freeform notebook.
// The old notebookText/contentBlocks and saved sketch resources are retained.
(function(){
  const pane=document.getElementById('projectNotes');
  if(!pane)return;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const editorHtml='<div id="v76Editor" class="v76-notebook-ui">'+
    '<div class="v76-page-controls"><label for="v76PageSelect" class="v76-sr">Note page</label><select id="v76PageSelect" aria-label="Select note page"></select>'+
    '<button type="button" id="v76NewPage" class="secondary-button">+ Page</button><button type="button" id="v76RenamePage" class="v76-icon" aria-label="Rename current page" title="Rename page">✎</button>'+
    '<button type="button" id="v76DeletePage" class="v76-icon" aria-label="Delete current page" title="Delete page">⋯</button></div>'+
    '<div class="v76-toolbar" role="toolbar" aria-label="Notebook tools">'+
    '<button type="button" data-v76-format="bold" aria-label="Bold selected text" title="Bold"><b>B</b></button>'+
    '<button type="button" data-v76-format="italic" aria-label="Italicize selected text" title="Italic"><i>I</i></button>'+
    '<button type="button" data-v76-format="insertUnorderedList" aria-label="Bullet list" title="Bullets">☷</button>'+
    '<span class="v76-tool-divider" aria-hidden="true"></span>'+
    '<button type="button" data-v76-mode="select" aria-label="Select and move" title="Select">↖</button>'+
    '<button type="button" data-v76-mode="text" aria-label="Add text anywhere" title="Text">T</button>'+
    '<button type="button" id="v76AddImage" aria-label="Add picture" title="Picture">▧</button>'+
    '<button type="button" data-v76-mode="pen" aria-label="Draw with pen" title="Pen">✎</button>'+
    '<button type="button" data-v76-mode="erase" aria-label="Erase drawing strokes" title="Eraser">⌫</button>'+
    '<button type="button" id="v76UndoInk" aria-label="Undo last ink stroke" title="Undo ink">↶</button>'+
    '</div><div class="v76-page-wrap"><div id="v76Surface" class="v76-page-surface" aria-label="Freeform notebook page"><svg id="v76Ink" xmlns="http://www.w3.org/2000/svg"></svg></div></div>'+
    '<p class="v76-tip">Tap a blank spot to type. Drag the ⠿ handle to move text or pictures. Use Pen to draw. Everything saves automatically.</p>'+
    '<input type="file" id="v76ImageInput" accept="image/*" hidden></div>';
  pane.insertAdjacentHTML('beforeend',editorHtml);
  const root=document.getElementById('v76Editor'),surface=document.getElementById('v76Surface'),ink=document.getElementById('v76Ink');
  const pageSelect=document.getElementById('v76PageSelect');
  // These remain in the DOM for backwards compatibility, but are no longer the UI.
  for(const id of ['projectNotebook','v74Blocks','v74BlockImage','projectNotesList']){
    const el=document.getElementById(id);if(el)el.hidden=true;
  }
  const oldToolbar=pane.querySelector('.v74-block-toolbar');if(oldToolbar)oldToolbar.hidden=true;
  const sketchTab=document.querySelector('[data-project-tab="sketch"]');if(sketchTab)sketchTab.hidden=true;
  const todoTab=document.querySelector('[data-project-tab="actions"]');if(todoTab)todoTab.textContent='To-Do';
  const todoHeading=document.querySelector('#projectActions h2');if(todoHeading)todoHeading.textContent='To-Do';
  const todoInput=document.getElementById('projectActionInput');if(todoInput){todoInput.placeholder='Add a to-do...';todoInput.setAttribute('aria-label','New project to-do');}
  let mode='select',lastKey='',selectedText=null;
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
    ink.setAttribute('viewBox','0 0 '+Math.max(1,surface.clientWidth)+' '+page.height);
    for(const stroke of page.strokes||[]){
      const poly=document.createElementNS('http://www.w3.org/2000/svg','polyline');
      poly.setAttribute('points',stroke.points.map(pt=>pt.x+','+pt.y).join(' '));
      poly.setAttribute('fill','none');poly.setAttribute('stroke',stroke.color||'#bda8da');
      poly.setAttribute('stroke-width',String(stroke.width||2.5));poly.setAttribute('stroke-linecap','round');
      poly.setAttribute('stroke-linejoin','round');ink.append(poly);
    }
  }
  function placeBox(el,item){
    el.style.left=Math.max(0,item.x||0)+'px';el.style.top=Math.max(0,item.y||0)+'px';
    el.style.width='min('+Math.max(135,item.width||250)+'px, calc(100% - '+Math.max(0,item.x||0)+'px))';
  }
  function addRenderedObject(item,p,page){
    const box=document.createElement('div');box.className='v76-item v76-'+item.type;box.dataset.v76Item=item.id;
    placeBox(box,item);
    const grip=document.createElement('button');grip.type='button';grip.className='v76-grip';grip.dataset.v76Drag=item.id;
    grip.textContent='⠿';grip.title='Drag to move';grip.setAttribute('aria-label','Move '+item.type);box.append(grip);
    const remove=document.createElement('button');remove.type='button';remove.className='v76-remove';remove.dataset.v76Remove=item.id;
    remove.textContent='×';remove.setAttribute('aria-label','Remove '+item.type);
    if(item.type==='text'){
      const el=document.createElement('div');el.className='v76-rich';el.dataset.v76Text=item.id;
      el.contentEditable='true';el.spellcheck=true;el.setAttribute('role','textbox');el.setAttribute('aria-label','Editable note text');
      el.innerHTML=cleanHTML(item.html);
      el.addEventListener('focus',()=>{selectedText=el;applyMode('select');});
      box.append(el);
    }else if(item.type==='image'){
      const img=document.createElement('img');img.className='v76-photo';img.alt=item.alt||'Note picture';img.dataset.v76ImageKey=item.key;
      box.append(img);
      const size=document.createElement('div');size.className='v76-size-tools';
      size.innerHTML='<button type="button" aria-label="Make image smaller" data-v76-resize="'+esc(item.id)+'" data-step="-50">−</button>'+
        '<button type="button" aria-label="Make image larger" data-v76-resize="'+esc(item.id)+'" data-step="50">+</button>';
      box.append(size);
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
    if(!force&&key===lastKey)return;
    lastKey=key;selectedText=null;
    pageSelect.replaceChildren();
    p.notePages.forEach(pg=>{
      const opt=document.createElement('option');opt.value=pg.id;opt.textContent=pg.title;pageSelect.append(opt);
    });
    pageSelect.value=String(page.id);
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
    const o={id:newId(),type:'text',x:Math.max(0,Math.round(x)),y:Math.max(0,Math.round(y)),width,html:''};
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
    const pg={id:newId(),title:title.slice(0,80),height:740,objects:[{id:newId(),type:'text',x:14,y:22,width:320,html:''}],strokes:[]};
    ctx.p.notePages.push(pg);ctx.p.activeNotePageId=pg.id;persist();renderPage(ctx.p,true);
  });
  document.getElementById('v76RenamePage').addEventListener('click',()=>{
    const ctx=current();if(!ctx)return;
    const title=(prompt('Rename page',ctx.page.title)||'').trim();if(!title)return;
    ctx.page.title=title.slice(0,80);persist();renderPage(ctx.p,true);
  });
  document.getElementById('v76DeletePage').addEventListener('click',()=>{
    const ctx=current();if(!ctx)return;
    if(ctx.p.notePages.length<2){alert('Keep at least one page in each project.');return;}
    if(!confirm('Delete "'+ctx.page.title+'" and everything on this page? This cannot be undone.'))return;
    ctx.p.notePages=ctx.p.notePages.filter(pg=>pg!==ctx.page);
    ctx.p.activeNotePageId=ctx.p.notePages[0].id;persist();renderPage(ctx.p,true);
  });
  root.addEventListener('pointerdown',e=>{
    const format=e.target.closest('[data-v76-format]');
    if(format)e.preventDefault(); // preserve the selected text on iPhone
  });
  root.addEventListener('click',e=>{
    const format=e.target.closest('[data-v76-format]');
    if(format){
      const el=selectionInEditor();if(!el)return;el.focus();
      document.execCommand(format.dataset.v76Format,false,null);
      const ctx=current(),item=ctx?.page.objects.find(o=>o.id===el.dataset.v76Text);
      if(item){item.html=cleanHTML(el.innerHTML);persist();}
      return;
    }
    const modeButton=e.target.closest('[data-v76-mode]');
    if(modeButton){applyMode(modeButton.dataset.v76Mode);return;}
    const rem=e.target.closest('[data-v76-remove]');
    if(rem){
      const ctx=current();if(!ctx)return;
      ctx.page.objects=ctx.page.objects.filter(o=>String(o.id)!==String(rem.dataset.v76Remove));persist();drawPage(ctx.p,ctx.page);return;
    }
    const size=e.target.closest('[data-v76-resize]');
    if(size){const ctx=current(),obj=ctx?.page.objects.find(o=>o.id===size.dataset.v76Resize);if(!obj)return;
      obj.width=Math.max(140,Math.min(surface.clientWidth-20,(obj.width||250)+Number(size.dataset.step||0)));
      persist();drawPage(ctx.p,ctx.page);return;
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
  let dragging=null;
  root.addEventListener('pointerdown',e=>{
    const grip=e.target.closest('[data-v76-drag]');if(!grip)return;
    const ctx=current(),obj=ctx?.page.objects.find(o=>String(o.id)===grip.dataset.v76Drag);
    if(!obj)return;
    e.preventDefault();grip.setPointerCapture(e.pointerId);
    dragging={pointerId:e.pointerId,grip,obj,page:ctx.page,x:e.clientX,y:e.clientY,startX:obj.x,startY:obj.y};
  });
  root.addEventListener('pointermove',e=>{
    if(!dragging||dragging.pointerId!==e.pointerId)return;
    const d=dragging,box=surface.querySelector('[data-v76-item="'+d.obj.id+'"]');
    d.obj.x=Math.min(Math.max(0,d.startX+e.clientX-d.x),Math.max(0,surface.clientWidth-120));
    d.obj.y=Math.max(0,d.startY+e.clientY-d.y);
    if(box)placeBox(box,d.obj);
    growPage(d.page,d.obj.y+240);
  });
  function endDrag(e){if(!dragging||dragging.pointerId!==e.pointerId)return;dragging=null;persist();}
  root.addEventListener('pointerup',endDrag);root.addEventListener('pointercancel',endDrag);
  let activeStroke=null;
  ink.addEventListener('pointerdown',e=>{
    const ctx=current();if(!ctx||(mode!=='pen'&&mode!=='erase'))return;
    e.preventDefault();ink.setPointerCapture(e.pointerId);
    const pt=position(e);
    if(mode==='erase'){
      const before=ctx.page.strokes.length;
      ctx.page.strokes=ctx.page.strokes.filter(s=>!s.points.some(p=>Math.hypot(p.x-pt.x,p.y-pt.y)<18));
      if(ctx.page.strokes.length!==before){persist();strokesView(ctx.page);}
      return;
    }
    const css=getComputedStyle(document.documentElement);
    const stroke={id:newId(),points:[pt,pt],width:2.5,color:css.getPropertyValue('--secondary-ui').trim()||'#a58a60'};
    ctx.page.strokes.push(stroke);activeStroke={id:e.pointerId,stroke,page:ctx.page};strokesView(ctx.page);
  });
  ink.addEventListener('pointermove',e=>{
    if(!activeStroke||e.pointerId!==activeStroke.id)return;
    activeStroke.stroke.points.push(position(e));strokesView(activeStroke.page);
  });
  const finishStroke=e=>{if(activeStroke&&activeStroke.id===e.pointerId){activeStroke=null;persist();}};
  ink.addEventListener('pointerup',finishStroke);ink.addEventListener('pointercancel',finishStroke);
  document.getElementById('v76UndoInk').addEventListener('click',()=>{
    const ctx=current();if(!ctx||!ctx.page.strokes.length)return;ctx.page.strokes.pop();persist();strokesView(ctx.page);
  });
  window.addEventListener('resize',()=>{
    const ctx=current();if(ctx)strokesView(ctx.page);
  });
  applyMode('select');
  if(v6Project())renderPage(v6Project(),true);
})();