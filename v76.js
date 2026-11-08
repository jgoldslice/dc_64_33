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
        '<button type="button" data-v76-mode="text" class="v812-textbox-button" aria-label="Textbox: tap the page to insert a text box" aria-pressed="false" title="Insert textbox">'+
          '<svg class="v79-tool-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="4" width="19" height="16" rx="2.5"/><path d="M7 9h10M12 9v7"/></svg></button>'+
        '<button type="button" data-v76-format="insertUnorderedList" aria-label="Add or remove bullet list" title="Bullet list">'+
          '<svg class="v79-tool-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="4.5" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1" fill="currentColor" stroke="none"/><path d="M9 6h11M9 12h11M9 18h11"/></svg>'+
        '</button><select id="v80TextSize" class="v80-text-size" aria-label="Text size" title="Text size">'+
          '<option value="small">Small</option><option value="medium" selected>Medium</option><option value="large">Large</option>'+
        '</select></div></div>'+
      '<div class="v79-tool-group" role="group" aria-label="Pen"><div class="v79-tool-buttons">'+
        '<button type="button" data-v76-mode="pen" aria-label="Draw; tap again to stop drawing" aria-pressed="false" title="Draw">✎</button>'+
        '<button type="button" data-v76-mode="erase" aria-label="Erase drawing strokes; tap again to stop erasing" aria-pressed="false" title="Eraser">'+
          '<svg class="v79-tool-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.3 20.4 3.6 15.7a2.2 2.2 0 0 1 0-3.1l9-9a2.2 2.2 0 0 1 3.1 0l4.7 4.7a2.2 2.2 0 0 1 0 3.1l-9 9a2.2 2.2 0 0 1-3.1 0Z"/><path d="M12 21h9"/></svg></button>'+
        '<button type="button" id="v818InkColor" class="v818-color-trigger" aria-label="Pen color: Black" aria-expanded="false" aria-haspopup="true" aria-controls="v818InkPalette" title="Choose drawing color"><span id="v818ColorPreview" class="v818-color-preview" aria-hidden="true"></span><span class="v818-color-chevron" aria-hidden="true">⌄</span></button>'+
        '<button type="button" id="v76UndoInk" aria-label="Undo last drawing stroke" title="Undo drawing">↶</button>'+
      '</div></div>'+
      '<div class="v79-tool-group" role="group" aria-label="Misc"><div class="v79-tool-buttons">'+
        '<button type="button" id="v76AddImage" aria-label="Insert picture" title="Insert picture">'+
          '<svg class="v79-tool-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg></button>'+
      '</div></div>'+
      '<div class="v79-tool-group" role="group" aria-label="Save drawing"><div class="v79-tool-buttons"><button type="button" id="v819SaveSketch" aria-label="Add drawing to project library" title="Save drawing to Library">Save sketch</button></div></div>'+
      '<div class="v79-tool-group v815-zoom-tools" role="group" aria-label="Notebook zoom">'+
        '<div class="v79-tool-buttons">'+
          '<button type="button" id="v815ZoomOut" aria-label="Zoom out" title="Zoom out">−</button>'+
          '<button type="button" id="v815ZoomReset" aria-label="Reset note zoom to 100 percent" title="Reset zoom to 100%">100%</button>'+
          '<button type="button" id="v815ZoomIn" aria-label="Zoom in" title="Zoom in">+</button>'+
        '</div></div>'+
    '</div><div class="v811-note-body"><aside class="v811-page-rail" aria-label="Notebook pages"><div class="v811-pages-heading"><strong>Pages</strong><button type="button" id="v811NewPage" aria-label="Add note page" title="Add page">+</button></div><div id="v811PageList" class="v811-page-list"></div></aside><div id="v815ZoomViewport" class="v76-page-wrap"><div id="v815ZoomStage" class="v815-zoom-stage"><div id="v76Surface" class="v76-page-surface" aria-label="Freeform notebook page"><svg id="v76Ink" xmlns="http://www.w3.org/2000/svg"></svg></div></div></div></div>'+
    '<input type="file" id="v76ImageInput" accept="image/*" hidden></div>';
  pane.insertAdjacentHTML('beforeend',editorHtml);
  const root=document.getElementById('v76Editor'),surface=document.getElementById('v76Surface'),ink=document.getElementById('v76Ink');
  const pageList=document.getElementById('v811PageList');
  const zoomViewport=document.getElementById('v815ZoomViewport');
  const zoomStage=document.getElementById('v815ZoomStage');
  const zoomOutButton=document.getElementById('v815ZoomOut');
  const zoomInButton=document.getElementById('v815ZoomIn');
  const zoomResetButton=document.getElementById('v815ZoomReset');
  const pageSelect=document.getElementById('v76PageSelect');
  const textSizeSelect=document.getElementById('v80TextSize');
  const validSizes=new Set(['small','medium','large']);
  const sizeName=value=>validSizes.has(value)?value:'medium';
  // Colors belong to the drawing tool, not the app theme; existing stroke
  // colors remain untouched. A remembered choice only affects NEW strokes.
  const inkColors=[
    {name:'White',hex:'#ffffff'}, {name:'Black',hex:'#111111'},
    {name:'Red',hex:'#d73537'}, {name:'Yellow',hex:'#e5b900'},
    {name:'Blue',hex:'#2362dd'}, {name:'Green',hex:'#16834b'}
  ];
  const colorButton=document.getElementById('v818InkColor');
  const colorPreview=document.getElementById('v818ColorPreview');
  const colorPalette=document.createElement('div');
  colorPalette.id='v818InkPalette';
  colorPalette.className='v818-ink-palette';
  colorPalette.setAttribute('role','group');
  colorPalette.setAttribute('aria-label','Drawing colors');
  colorPalette.hidden=true;
  colorPalette.innerHTML='<div class="v818-palette-caption">Pen color</div>'+
    '<div class="v818-palette-colors">'+inkColors.map(item=>
      '<button type="button" data-ink-color="'+item.hex+'" aria-label="'+item.name+
      '" aria-pressed="false" title="'+item.name+'" style="--ink-swatch:'+item.hex+
      '"><span aria-hidden="true"></span></button>').join('')+'</div>';
  // A body-level popover is not clipped by the horizontally scrolling toolbar.
  document.body.append(colorPalette);
  let selectedInkColor='#111111';
  try{
    const remembered=localStorage.getItem('canvas:penColor');
    if(inkColors.some(item=>item.hex===remembered))selectedInkColor=remembered;
  }catch(_){}
  function refreshInkColor(){
    const current=inkColors.find(item=>item.hex===selectedInkColor)||inkColors[1];
    colorPreview.style.background=current.hex;
    colorButton.setAttribute('aria-label','Pen color: '+current.name);
    colorButton.title='Pen color: '+current.name;
    colorPalette.querySelectorAll('[data-ink-color]').forEach(button=>
      button.setAttribute('aria-pressed',String(button.dataset.inkColor===selectedInkColor)));
  }
  function toggleInkPalette(open){
    colorPalette.hidden=!open;
    colorButton.setAttribute('aria-expanded',String(open));
    if(!open)return;
    const rect=colorButton.getBoundingClientRect();
    const width=250, gap=8;
    colorPalette.style.left=Math.max(10,Math.min(window.innerWidth-width-10,rect.left))+'px';
    const height=98;
    colorPalette.style.top=(rect.bottom+gap+height>window.innerHeight
      ?Math.max(10,rect.top-height-gap):rect.bottom+gap)+'px';
  }
  colorButton.addEventListener('click',()=>toggleInkPalette(colorPalette.hidden));
  colorPalette.addEventListener('click',event=>{
    const button=event.target.closest('[data-ink-color]');
    if(!button)return;
    selectedInkColor=button.dataset.inkColor;
    try{localStorage.setItem('canvas:penColor',selectedInkColor);}catch(_){}
    refreshInkColor();
    toggleInkPalette(false);
    applyMode('pen');
    colorButton.focus({preventScroll:true});
  });
  document.addEventListener('pointerdown',event=>{
    if(!colorPalette.hidden && !colorPalette.contains(event.target) &&
       !colorButton.contains(event.target))toggleInkPalette(false);
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!colorPalette.hidden){
      toggleInkPalette(false);colorButton.focus({preventScroll:true});
    }
  });
  window.addEventListener('resize',()=>{if(!colorPalette.hidden)toggleInkPalette(false);});
  refreshInkColor();
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
  // Notebook zoom is a viewing preference, NOT a data transformation.
  let noteZoom=1,activePinch=null,suppressPageClickUntil=0;
  const ZOOM_MIN=.5,ZOOM_MAX=5;
  const ZOOM_STEPS=[.5,.75,1,1.25,1.5,1.75,2,2.5,3,4,5];
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
    mode=next;if(next!=='select')selectBox(null);root.querySelectorAll('[data-v76-mode]').forEach(btn=>{
      const on=btn.dataset.v76Mode===next;btn.classList.toggle('v76-on',on);btn.setAttribute('aria-pressed',String(on));
    });
    surface.classList.toggle('v76-is-drawing',next==='pen'||next==='erase');
    ink.style.pointerEvents=(next==='pen'||next==='erase')?'auto':'none';
  }
  // v8.15: a bounded, whole-page visual zoom (50%–500%). The note's x/y,
  // dimensions, strokes and attachment keys always stay in unscaled units.
  function updateZoomControls(){
    zoomResetButton.textContent=Math.round(noteZoom*100)+'%';
    zoomResetButton.setAttribute('title','Reset note zoom to 100%');
    zoomOutButton.disabled=noteZoom<=ZOOM_MIN+.0001;
    zoomInButton.disabled=noteZoom>=ZOOM_MAX-.0001;
  }
  function syncZoomLayout(){
    if(!zoomViewport.clientWidth)return; // An inactive project may be hidden.
    const baseWidth=zoomViewport.clientWidth;
    const priorWidth=surface.clientWidth;
    surface.style.width=baseWidth+'px';
    const baseHeight=Math.max(1,surface.offsetHeight);
    zoomStage.style.width=Math.ceil(baseWidth*noteZoom)+'px';
    zoomStage.style.height=Math.ceil(baseHeight*noteZoom)+'px';
    surface.style.transform='scale('+noteZoom+')';
    // The ink's viewBox uses the *unscaled* surface dimensions; its screen
    // CTM includes the zoom and maps Pencil events accurately at any level.
    if(priorWidth!==surface.clientWidth){
      const ctx=current();if(ctx)strokesView(ctx.page);
    }
  }
  function zoomAnchor(){
    const rect=zoomViewport.getBoundingClientRect();
    const left=Math.max(rect.left,0),right=Math.min(rect.right,innerWidth);
    const top=Math.max(rect.top,0),bottom=Math.min(rect.bottom,innerHeight);
    return {
      x:left<right?(left+right)/2:rect.left+rect.width/2,
      y:top<bottom?(top+bottom)/2:rect.top+Math.min(rect.height/2,200)
    };
  }
  function setNoteZoom(value,anchor){
    const next=Math.round(Math.max(ZOOM_MIN,Math.min(ZOOM_MAX,value))*1000)/1000;
    if(!Number.isFinite(next)||Math.abs(next-noteZoom)<.0005)return;
    const before=surface.getBoundingClientRect();
    const focus=anchor||zoomAnchor();
    // Preserve the local point below the pinch center or the toolbar's
    // viewport center, even if the scrolled sheet was previously zoomed.
    const x=(focus.x-before.left)/noteZoom;
    const y=(focus.y-before.top)/noteZoom;
    noteZoom=next;
    syncZoomLayout();
    updateZoomControls();
    const after=surface.getBoundingClientRect();
    zoomViewport.scrollLeft+=after.left+x*noteZoom-focus.x;
    const deltaY=after.top+y*noteZoom-focus.y;
    // Zoom is confined to the notebook window. Never scroll the entire app:
    // that felt like Safari was enlarging and shifting the whole page.
    if(Math.abs(deltaY)>1&&Number.isFinite(deltaY))zoomViewport.scrollTop+=deltaY;
  }
  function changeZoomStep(direction){
    const next=direction>0
      ?ZOOM_STEPS.find(value=>value>noteZoom+.002)
      :ZOOM_STEPS.slice().reverse().find(value=>value<noteZoom-.002);
    if(next!==undefined)setNoteZoom(next);
  }
  zoomOutButton.addEventListener('click',()=>changeZoomStep(-1));
  zoomInButton.addEventListener('click',()=>changeZoomStep(1));
  zoomResetButton.addEventListener('click',()=>setNoteZoom(1));
  // Ctrl/Command+wheel includes common trackpad pinch gestures on desktop.
  zoomViewport.addEventListener('wheel',e=>{
    if(!e.ctrlKey&&!e.metaKey)return;
    e.preventDefault();
    setNoteZoom(noteZoom*Math.exp(-e.deltaY*.006),{x:e.clientX,y:e.clientY});
  },{passive:false});
  function cancelDrawingForPinch(){
    // iPad fingers should navigate the page without leaving stray Pencil marks
    // or moving a selected image while a second finger joins the gesture.
    if(activeStroke){
      // A second finger begins navigation, not Undo: retain sampled ink.
      flushInkRender();activeStroke=null;persist();
    }
    if(activeErase){
      const pending=activeErase;activeErase=null;
      pending.page.strokes=pending.originalStrokes;
      strokesView(pending.page);
      persist();
    }
    if(interaction){
      const d=interaction;interaction=null;
      for(const key of ['x','y','width','height']){
        if(d.original[key]===undefined)delete d.obj[key];
        else d.obj[key]=d.original[key];
      }
      d.box.classList.remove('v76-moving','v76-resizing');
      placeBox(d.box,d.obj);
    }
  }
  const touchDistance=(a,b)=>Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
  const touchMid=(a,b)=>({x:(a.clientX+b.clientX)/2,y:(a.clientY+b.clientY)/2});
  zoomViewport.addEventListener('touchstart',e=>{
    if(e.touches.length!==2)return;
    const d=touchDistance(e.touches[0],e.touches[1]);
    if(d<10)return;
    e.preventDefault();
    cancelDrawingForPinch();
    activePinch={startDistance:d,startZoom:noteZoom};
    suppressPageClickUntil=Date.now()+400;
  },{passive:false});
  zoomViewport.addEventListener('touchmove',e=>{
    if(!activePinch||e.touches.length!==2)return;
    e.preventDefault();
    const a=e.touches[0],b=e.touches[1];
    setNoteZoom(activePinch.startZoom*touchDistance(a,b)/activePinch.startDistance,touchMid(a,b));
    suppressPageClickUntil=Date.now()+400;
  },{passive:false});
  function endPinch(e){
    if(!activePinch||e.touches.length>=2)return;
    activePinch=null;
    suppressPageClickUntil=Date.now()+400;
  }
  zoomViewport.addEventListener('touchend',endPinch,{passive:true});
  zoomViewport.addEventListener('touchcancel',endPinch,{passive:true});
  // iPad Safari exposes GestureEvents on some builds. Prevent its native page
  // magnification inside the notebook and use the same bounded zoom.
  let safariGesture=null;
  zoomViewport.addEventListener('gesturestart',e=>{
    e.preventDefault();
    if(!activePinch)cancelDrawingForPinch();
    safariGesture={zoom:noteZoom};
    suppressPageClickUntil=Date.now()+400;
  },{passive:false});
  zoomViewport.addEventListener('gesturechange',e=>{
    if(!safariGesture)return;
    e.preventDefault();
    if(!activePinch)setNoteZoom(safariGesture.zoom*e.scale,{x:e.clientX,y:e.clientY});
    suppressPageClickUntil=Date.now()+400;
  },{passive:false});
  zoomViewport.addEventListener('gestureend',e=>{
    e.preventDefault();safariGesture=null;
    suppressPageClickUntil=Date.now()+400;
  },{passive:false});
  // Safari can dispatch native gesture events at the document capture phase
  // before the note's normal event handlers run. Constrain browser pinch to
  // the notebook only, leaving browser zoom outside the notebook untouched.
  document.addEventListener('gesturestart',e=>{
    if(zoomViewport.contains(e.target)&&e.cancelable)e.preventDefault();
  },{capture:true,passive:false});
  document.addEventListener('gesturechange',e=>{
    if(zoomViewport.contains(e.target)&&e.cancelable)e.preventDefault();
  },{capture:true,passive:false});
  // Page content or container dimensions may change after text editing,
  // rotation, Stage Manager resizing, or an iPad split-screen transition.
  if(typeof ResizeObserver==='function'){
    const observer=new ResizeObserver(()=>syncZoomLayout());
    observer.observe(zoomViewport);
    observer.observe(surface);
  }
  updateZoomControls();

  // Quadratic mid-point curves make Pencil handwriting fluid without
  // rewriting its saved raw points (which erasing, backups and undo use).
  function smoothInkPath(points){
    if(!points?.length)return '';
    const first=points[0],last=points[points.length-1];
    let path='M'+first.x+' '+first.y;
    if(points.length===1 || (points.length===2&&
      Math.hypot(last.x-first.x,last.y-first.y)<.01)){
      // A tiny capped segment renders a tap as a visible round dot.
      return path+' l0.01 0';
    }
    if(points.length===2)return path+' L'+last.x+' '+last.y;
    for(let i=1;i<points.length-1;i++){
      const p=points[i],n=points[i+1];
      path+=' Q'+p.x+' '+p.y+' '+((p.x+n.x)/2)+' '+((p.y+n.y)/2);
    }
    return path+' Q'+last.x+' '+last.y+' '+last.x+' '+last.y;
  }
  function makeInkElement(stroke){
    const el=document.createElementNS('http://www.w3.org/2000/svg','path');
    el.classList.add('v818-ink-stroke');
    el.setAttribute('d',smoothInkPath(stroke.points||[]));
    el.setAttribute('fill','none');
    el.setAttribute('stroke',stroke.color||'#111111');
    el.setAttribute('stroke-width',String(stroke.width||2.5));
    el.setAttribute('stroke-linecap','round');
    el.setAttribute('stroke-linejoin','round');
    return el;
  }
  function strokesView(page){
    ink.replaceChildren();
    // Match the displayed sheet, including iPad sizing and notebook zoom.
    ink.setAttribute('preserveAspectRatio','none');
    ink.setAttribute('viewBox','0 0 '+Math.max(1,surface.clientWidth)+' '+Math.max(1,surface.clientHeight));
    for(const stroke of page.strokes||[])ink.append(makeInkElement(stroke));
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
    const height=Number(item.height);
    const sized=Number.isFinite(height)&&height>=52;
    el.style.height=sized?height+'px':'';
    el.dataset.v811Sized=String(sized);
    el.classList.toggle('v811-near-top',(Number(item.y)||0)<62);
    // Keep existing images in their natural aspect ratio until explicitly resized.
  }
  function selectBox(id){
    selectedItemId=id==null?null:String(id);
    for(const box of surface.querySelectorAll('.v76-item')){
      const selected=box.dataset.v76Item===selectedItemId;
      box.classList.toggle('v811-selected',selected);
      box.setAttribute('aria-selected',String(selected));
      if(!selected){
        const rich=box.querySelector('.v76-rich');
        if(rich){rich.contentEditable='false';box.classList.remove('v811-editing');}
      }
    }
  }
  function enterTextEdit(box,point){
    if(!box?.classList.contains('v76-text'))return;
    selectBox(box.dataset.v76Item);
    box.classList.add('v811-editing');
    const rich=box.querySelector('.v76-rich');
    if(!rich)return;
    rich.contentEditable='true';
    rich.focus({preventScroll:true});
    selectedText=rich;
    const ctx=current(),obj=ctx?.page.objects.find(o=>String(o.id)===String(box.dataset.v76Item));
    if(obj)textSizeSelect.value=sizeName(obj.fontSize);
    if(point){
      const range=document.caretRangeFromPoint?.(point.x,point.y);
      if(range&&rich.contains(range.startContainer)){
        const selection=window.getSelection();
        selection?.removeAllRanges();selection?.addRange(range);
      }
    }
  }
  function addRenderedObject(item,p,page){
    const box=document.createElement('div');
    box.className='v76-item v76-'+item.type;
    box.dataset.v76Item=item.id;
    box.setAttribute('role','group');
    box.setAttribute('aria-label',item.type==='image'?'Notebook picture':'Notebook text');
    box.setAttribute('aria-selected','false');
    placeBox(box,item);
    if(item.type==='text'){
      const el=document.createElement('div');
      el.className='v76-rich';
      el.dataset.v76Text=item.id;
      el.contentEditable='false';
      el.spellcheck=true;el.setAttribute('role','textbox');
      el.setAttribute('aria-label','Editable note text');
      el.dataset.fontSize=sizeName(item.fontSize);
      el.innerHTML=cleanHTML(item.html);
      el.addEventListener('focus',()=>{
        selectedText=el;
        textSizeSelect.value=sizeName(item.fontSize);
        applyMode('select');
      });
      box.append(el);
    }else if(item.type==='image'){
      const img=document.createElement('img');
      img.className='v76-photo';
      img.alt=item.alt||'Note picture';
      img.draggable=false;
      img.dataset.v76ImageKey=item.key;
      box.append(img);
      const projectId=String(p.id),pageId=String(page.id),key=item.key;
      v6Blob('get',key).then(blob=>{
        if(!blob||String(v6Project()?.id)!==projectId||
           String(current()?.page.id)!==pageId||!box.isConnected)return;
        const url=URL.createObjectURL(blob);
        img.onload=()=>URL.revokeObjectURL(url);
        img.onerror=()=>URL.revokeObjectURL(url);
        img.src=url;
      }).catch(()=>{});
    }
    // A single tap selects; these 8 handles then resize in *both* directions.
    // The center control can move the selected item without a long-press.
    for(const edge of ['nw','n','ne','e','se','s','sw','w']){
      const handle=document.createElement('button');
      handle.type='button';
      handle.className='v811-resize-handle v811-handle-'+edge;
      handle.dataset.v811Resize=edge;
      handle.setAttribute('aria-label','Resize '+item.type+' from '+({
        nw:'top left',n:'top',ne:'top right',e:'right',
        se:'bottom right',s:'bottom',sw:'bottom left',w:'left'
      }[edge]));
      handle.title='Drag to resize';
      box.append(handle);
    }
    const move=document.createElement('button');
    move.type='button';move.className='v811-move-control';
    move.dataset.v811Move=String(item.id);
    move.title='Drag to move';move.setAttribute('aria-label','Move '+item.type);
    move.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20M2 12h20M12 2l-3 3m3-3 3 3M12 22l-3-3m3 3 3-3M2 12l3-3m-3 3 3 3M22 12l-3-3m3 3-3 3"/></svg>';
    box.append(move);
    const actions=document.createElement('div');
    actions.className='v811-object-actions';
    if(item.type==='text'){
      const edit=document.createElement('button');
      edit.type='button';edit.textContent='Edit';
      edit.dataset.v811Edit=String(item.id);
      edit.setAttribute('aria-label','Edit selected note text');
      actions.append(edit);
    }
    const remove=document.createElement('button');
    remove.type='button';remove.className='v811-delete';
    remove.dataset.v76Remove=item.id;
    remove.textContent='Delete';
    remove.setAttribute('aria-label','Delete selected '+item.type);
    actions.append(remove);
    box.append(actions);
    surface.append(box);
    if(selectedItemId===String(item.id))selectBox(selectedItemId);
  }
  function drawPage(p,page){
    surface.querySelectorAll('.v76-item').forEach(el=>el.remove());
    const height=Math.max(740,Number(page.height)||740);page.height=height;surface.style.height=height+'px';
    for(const item of page.objects||[])addRenderedObject(item,p,page);
    strokesView(page);
    syncZoomLayout();
  }
  function renderPageList(p){
    if(!pageList)return;
    pageList.replaceChildren();
    for(const page of p.notePages||[]){
      const active=String(page.id)===String(p.activeNotePageId);
      const row=document.createElement('div');
      row.className='v811-page-row';
      row.classList.toggle('v811-current',active);
      const open=document.createElement('button');
      open.type='button';
      open.className='v811-page-link';
      open.dataset.v811PageId=String(page.id);
      open.setAttribute('aria-current',active?'page':'false');
      const icon=document.createElement('span');
      icon.className='v811-page-icon';icon.setAttribute('aria-hidden','true');
      icon.textContent='▤';
      const copy=document.createElement('span');copy.className='v811-page-labels';
      const title=document.createElement('strong');
      title.textContent=page.title||'Untitled page';
      const preview=document.createElement('small');
      const words=(page.objects||[]).filter(o=>o.type==='text')
        .map(o=>String(o.html||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim())
        .filter(Boolean).join(' ');
      preview.textContent=words?words.slice(0,62):'No additional text';
      copy.append(title,preview);open.append(icon,copy);
      const rename=document.createElement('button');
      rename.type='button';rename.className='v811-page-rename';
      rename.dataset.v811RenameId=String(page.id);
      rename.textContent='•••';
      rename.title='Rename page';
      rename.setAttribute('aria-label','Rename '+(page.title||'page'));
      row.append(open,rename);
      pageList.append(row);
    }
  }
  function renderPage(p,force=false){
    initializePages(p);
    const page=p.notePages.find(pg=>String(pg.id)===String(p.activeNotePageId))||p.notePages[0];
    const key=String(p.id)+':'+String(page.id);
    // After a full backup import, ids may be identical even though the
    // underlying page objects (including attachment keys) have changed.
    if(!force&&key===lastKey&&page===lastPageRef)return;
    if(key!==lastKey){noteZoom=1;zoomViewport.scrollLeft=0;updateZoomControls();}
    lastKey=key;lastPageRef=page;selectedText=null;selectedItemId=null;
    pageSelect.replaceChildren();
    p.notePages.forEach(pg=>{
      const opt=document.createElement('option');opt.value=pg.id;opt.textContent=pg.title;pageSelect.append(opt);
    });
    pageSelect.value=String(page.id);
    renderPageList(p);
    textSizeSelect.value=sizeName(page.defaultTextSize);
    drawPage(p,page);applyMode('select');
  }
  // v74 already wraps this function. Retain its existing save/import/backup behavior.
  const oldRenderNotes=v6RenderNotes;
  v6RenderNotes=function(p){oldRenderNotes(p);renderPage(p);};
  function growPage(page,needed){
    if(needed<=page.height)return;
    page.height=Math.ceil((needed+160)/180)*180;surface.style.height=page.height+'px';strokesView(page);syncZoomLayout();
  }
  function createText(x,y){
    const ctx=current();if(!ctx)return;
    const {page}=ctx;
    const width=Math.max(170,Math.min(360,surface.clientWidth-Math.max(0,x)-20));
    const o={id:newId(),type:'text',x:Math.max(0,Math.round(x)),y:Math.max(0,Math.round(y)),width,html:'',fontSize:sizeName(page.defaultTextSize)};
    page.objects.push(o);growPage(page,y+150);persist();drawPage(ctx.p,page);
    const box=surface.querySelector('[data-v76-item="'+o.id+'"]');
    if(box)enterTextEdit(box);
    applyMode('select');
  }
  function position(e){
    const rect=surface.getBoundingClientRect();
    const sx=surface.clientWidth/Math.max(1,rect.width);
    const sy=surface.clientHeight/Math.max(1,rect.height);
    return {x:Math.round((e.clientX-rect.left)*sx),y:Math.round((e.clientY-rect.top)*sy)};
  }
  surface.addEventListener('click',e=>{
    if(Date.now()<suppressPageClickUntil)return;
    if(e.target!==surface&&e.target!==ink)return; // Existing objects never insert text.
    if(mode==='text'){
      const pt=position(e);
      createText(Math.max(8,pt.x-10),Math.max(8,pt.y-20));
      // createText returns to Select, preventing accidental extra boxes.
    }else if(mode==='select'){
      selectBox(null);
      // Dismiss the keyboard when tapping empty paper while editing text.
      const active=document.activeElement;
      if(active?.classList?.contains('v76-rich'))active.blur();
      selectedText=null;
    }
  });
  pageSelect.addEventListener('change',()=>{
    const ctx=current();if(!ctx)return;ctx.p.activeNotePageId=pageSelect.value;persist();renderPage(ctx.p,true);
  });
  // The iPad page rail and compact top selector use the same page data and
  // the existing New/Rename actions, so backups and notes remain unchanged.
  document.getElementById('v811NewPage').addEventListener('click',()=>{
    document.getElementById('v76NewPage').click();
  });
  pageList.addEventListener('click',e=>{
    const button=e.target.closest('button');if(!button)return;
    if(button.dataset.v811PageId){
      const id=button.dataset.v811PageId;
      if(id===pageSelect.value)return;
      pageSelect.value=id;
      pageSelect.dispatchEvent(new Event('change',{bubbles:true}));
      return;
    }
    if(button.dataset.v811RenameId){
      const ctx=current(),pg=ctx?.p.notePages.find(pg=>String(pg.id)===button.dataset.v811RenameId);
      if(!pg)return;
      const text=prompt('Rename page',pg.title||'Page');
      if(text===null)return;
      const title=text.trim().slice(0,80);
      if(!title)return;
      pg.title=title;persist();renderPage(ctx.p,true);
    }
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
      // Formatting an existing box must never create a new one implicitly.
      const el=selectionInEditor();
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
      ctx.page.objects=ctx.page.objects.filter(o=>String(o.id)!==String(rem.dataset.v76Remove));selectedItemId=null;persist();drawPage(ctx.p,ctx.page);return;
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
  document.getElementById('v819SaveSketch').addEventListener('click',async()=>{
    const ctx=current();if(!ctx)return;
    if(activeStroke){flushInkRender();activeStroke=null;persist();}
    if(!ctx.page.strokes?.length){alert('Draw something first to save a sketch.');return;}
    const title=prompt('Sketch name','Sketch '+((ctx.p.library||[]).filter(r=>r.type==='sketch').length+1));
    if(!title?.trim())return;
    try{
      // Export the page's ink as PNG; leave the original editable note intact.
      const width=Math.max(1,Math.round(surface.clientWidth));
      const height=Math.max(1,Math.round(surface.clientHeight));
      const clone=ink.cloneNode(true);
      clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
      clone.setAttribute('width',String(width));
      clone.setAttribute('height',String(height));
      clone.setAttribute('viewBox','0 0 '+width+' '+height);
      clone.setAttribute('preserveAspectRatio','none');
      const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml'}));
      try{
        const image=new Image();
        await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('Could not render sketch'));image.src=url;});
        const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
        canvas.getContext('2d').drawImage(image,0,0,width,height);
        const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
        if(!blob)throw Error('Could not encode sketch');
        const id=newId(),key='v6-'+id;
        await v6Blob('put',key,blob);
        if(!Array.isArray(ctx.p.library))ctx.p.library=[];
        ctx.p.library.push({id,type:'sketch',title:title.trim().slice(0,160),key,mime:'image/png',created:Date.now()});
        if(!save(true))throw Error('Sketch bytes are retained, but its library entry is not yet saved. Keep Blueprint open and tap Retry.');
        v6RenderLibrary(ctx.p);
      }finally{URL.revokeObjectURL(url);}
    }catch(err){alert('Could not add sketch to Library: '+err.message);}
  });
  document.getElementById('v76AddImage').addEventListener('click',()=>document.getElementById('v76ImageInput').click());
  document.getElementById('v76ImageInput').addEventListener('change',async e=>{
    const file=e.target.files?.[0];e.target.value='';if(file)await insertImage(file);
  });
  // OneNote-style object manipulation. Tap once to reveal selection handles.
  // Drag the selected object or center control to move. Drag any edge/corner
  // to resize in either direction. Tap selected text again to edit its content.
  let interaction=null;
  function startManipulation(e,box,obj,page,kind,edge=''){
    const capture=e.target.closest('button[data-v811-resize],button[data-v811-move]')||box;
    const scale=surface.getBoundingClientRect();
    const session={
      pointerId:e.pointerId,capture,box,obj,page,kind,edge,
      x:e.clientX,y:e.clientY,
      scaleX:surface.clientWidth/Math.max(1,scale.width),
      scaleY:surface.clientHeight/Math.max(1,scale.height),
      startX:parseFloat(box.style.left)||0,
      startY:parseFloat(box.style.top)||0,
      startWidth:box.offsetWidth,
      startHeight:box.offsetHeight,
      original:{x:obj.x,y:obj.y,width:obj.width,height:obj.height},
      changed:false
    };
    interaction=session;
    box.classList.add(kind==='resize'?'v76-resizing':'v76-moving');
    e.preventDefault();
    try{capture.setPointerCapture(e.pointerId);}catch(_){}
  }
  root.addEventListener('pointerdown',e=>{
    if(mode==='pen'||mode==='erase'||interaction||
      (e.pointerType==='mouse'&&e.button!==0))return;
    const el=e.target instanceof Element?e.target:e.target?.parentElement;
    if(!el)return;
    if(el.closest('[data-v76-remove],[data-v811-edit]'))return;
    const box=el.closest('.v76-item');
    if(!box||!surface.contains(box)){
      if(el===surface||el===ink)selectBox(null);
      return;
    }
    const ctx=current();
    const obj=ctx?.page.objects.find(o=>String(o.id)===box.dataset.v76Item);
    if(!obj)return;
    const wasSelected=selectedItemId===String(obj.id);
    selectBox(obj.id);
    const resize=el.closest('[data-v811-resize]');
    if(resize){
      startManipulation(e,box,obj,ctx.page,'resize',resize.dataset.v811Resize);
      return;
    }
    const move=el.closest('[data-v811-move]');
    if(move||wasSelected&&!box.classList.contains('v811-editing')){
      startManipulation(e,box,obj,ctx.page,'move');
      return;
    }
    if(!box.classList.contains('v811-editing'))e.preventDefault();
  });
  root.addEventListener('pointermove',e=>{
    const d=interaction;if(!d||e.pointerId!==d.pointerId)return;
    e.preventDefault();
    const dx=(e.clientX-d.x)*d.scaleX;
    const dy=(e.clientY-d.y)*d.scaleY;
    if(d.kind==='move'){
      if(!d.changed&&Math.hypot(dx,dy)<3)return;
      const maxX=Math.max(0,surface.clientWidth-d.startWidth-8);
      const x=Math.min(maxX,Math.max(0,Math.round(d.startX+dx)));
      const y=Math.max(0,Math.round(d.startY+dy));
      if(x!==Number(d.obj.x)||y!==Number(d.obj.y)){d.obj.x=x;d.obj.y=y;d.changed=true;}
    }else{
      const edge=d.edge;
      const minW=Math.min(120,Math.max(70,surface.clientWidth-18));
      const minH=52;
      const right=d.startX+d.startWidth,bottom=d.startY+d.startHeight;
      let x=d.startX,y=d.startY,w=d.startWidth,h=d.startHeight;
      if(edge.includes('w')){
        x=Math.min(right-minW,Math.max(0,Math.round(d.startX+dx)));
        w=right-x;
      }else if(edge.includes('e')){
        w=Math.min(Math.max(minW,Math.round(d.startWidth+dx)),
          Math.max(minW,surface.clientWidth-d.startX-8));
      }
      if(edge.includes('n')){
        y=Math.min(bottom-minH,Math.max(0,Math.round(d.startY+dy)));
        h=bottom-y;
      }else if(edge.includes('s')){
        h=Math.max(minH,Math.round(d.startHeight+dy));
      }
      if(x!==Number(d.obj.x)||y!==Number(d.obj.y)||
        w!==Number(d.obj.width)||h!==Number(d.obj.height)){
        d.obj.x=x;d.obj.y=y;d.obj.width=w;d.obj.height=h;
        d.changed=true;
      }
    }
    if(d.changed){
      placeBox(d.box,d.obj);
      growPage(d.page,(parseFloat(d.box.style.top)||0)+d.box.offsetHeight+90);
    }
  });
  function finishManipulation(e){
    const d=interaction;
    if(!d||e.pointerId!==d.pointerId)return;
    interaction=null;
    d.box.classList.remove('v76-moving','v76-resizing');
    if(d.changed)persist();
    else if(d.kind==='move'&&d.obj.type==='text'&&
      !e.target.closest('[data-v811-move]')&&e.type==='pointerup'){
      enterTextEdit(d.box,{x:e.clientX,y:e.clientY});
    }
  }
  root.addEventListener('pointerup',finishManipulation);
  root.addEventListener('pointercancel',finishManipulation);
  root.addEventListener('click',e=>{
    const edit=e.target.closest('[data-v811-edit]');
    if(edit){
      const box=edit.closest('.v76-item');
      enterTextEdit(box);
      return;
    }
  });
  root.addEventListener('dblclick',e=>{
    const box=e.target.closest('.v76-item.v76-text');
    if(box&&mode==='select')enterTextEdit(box,{x:e.clientX,y:e.clientY});
  });
  // The selected object's handles own touch input; normal text editing and
  // vertical page scrolling remain native when no object is selected.
  const gestureElement=e=>e.target instanceof Element?e.target:e.target?.parentElement;
  root.addEventListener('touchstart',e=>{
    if(mode==='pen'||mode==='erase'||e.touches.length!==1)return;
    const el=gestureElement(e);
    if(el?.closest('.v811-selected')&&!el.closest('.v811-editing .v76-rich')&&
      !el.closest('.v811-object-actions'))e.preventDefault();
  },{passive:false});
  root.addEventListener('contextmenu',e=>{
    if(gestureElement(e)?.closest('.v811-selected')&&!gestureElement(e)?.closest('.v811-editing .v76-rich'))e.preventDefault();
  });
  root.addEventListener('selectstart',e=>{
    if(gestureElement(e)?.closest('.v811-selected')&&
      !gestureElement(e)?.closest('.v811-editing .v76-rich'))e.preventDefault();
  });
  root.addEventListener('dragstart',e=>{
    if(gestureElement(e)?.closest('.v76-item'))e.preventDefault();
  });
  root.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&selectedItemId){
      const active=surface.querySelector('.v811-selected .v76-rich');
      if(active?.isContentEditable)active.blur();
      selectBox(null);
    }
  });
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
  let activeStroke=null,activeErase=null,inkFrame=0;
  function queueInkRender(){
    if(inkFrame)return;
    // Pencil can send several coalesced events per frame. Update the live
    // SVG path once per display frame, while retaining all sampled points.
    inkFrame=requestAnimationFrame(()=>{
      inkFrame=0;
      if(activeStroke)activeStroke.element.setAttribute('d',smoothInkPath(activeStroke.stroke.points));
    });
  }
  function flushInkRender(){
    if(inkFrame){cancelAnimationFrame(inkFrame);inkFrame=0;}
    if(activeStroke)activeStroke.element.setAttribute('d',smoothInkPath(activeStroke.stroke.points));
  }
  ink.addEventListener('pointerdown',e=>{
    const ctx=current();if(!ctx||(mode!=='pen'&&mode!=='erase'))return;
    if(e.pointerType==='mouse'&&e.button!==0)return;
    // Never allow a second touch to replace an active Pencil stroke; Safari
    // may dispatch pointerdown before touchstart detects a two-finger pinch.
    if(activePinch||activeStroke||activeErase||(e.pointerType==='touch'&&!e.isPrimary))return;
    e.preventDefault();ink.setPointerCapture(e.pointerId);
    const pt=inkPosition(e);
    if(mode==='erase'){
      activeErase={id:e.pointerId,page:ctx.page,last:pt,
        originalStrokes:(ctx.page.strokes||[]).slice()};
      eraseSweep(ctx.page,pt,[e]); // A tap is also an eraser gesture.
      return;
    }
    const stroke={id:newId(),points:[pt,pt],width:2.5,color:selectedInkColor};
    ctx.page.strokes.push(stroke);
    const element=makeInkElement(stroke);
    ink.append(element);
    activeStroke={id:e.pointerId,stroke,page:ctx.page,element};
  });
  ink.addEventListener('pointermove',e=>{
    if(activeErase&&e.pointerId===activeErase.id){
      e.preventDefault();
      activeErase.last=eraseSweep(activeErase.page,activeErase.last,pointerSamples(e));
      return;
    }
    if(!activeStroke||e.pointerId!==activeStroke.id)return;
    for(const sample of pointerSamples(e)){
      const point=inkPosition(sample);
      const last=activeStroke.stroke.points.at(-1);
      if(Math.hypot(point.x-last.x,point.y-last.y)>.12)activeStroke.stroke.points.push(point);
    }
    // Update only the active path instead of rebuilding every previous stroke.
    queueInkRender();
  });
  const finishStroke=e=>{
    if(activeErase&&e.pointerId===activeErase.id){
      const pending=activeErase;activeErase=null;
      if(e.type==='pointercancel'){
        // A cancelled pinch/gesture must not commit a partial eraser sweep.
        pending.page.strokes=pending.originalStrokes;
        strokesView(pending.page);persist();
      }else if(e.type==='pointerup')eraseSweep(pending.page,pending.last,[e]);
    }
    if(activeStroke&&activeStroke.id===e.pointerId){
      if(e.type==='pointercancel'){
        // Safari cancels a pen pointer during a pinch; keep the existing mark.
        flushInkRender();activeStroke=null;persist();return;
      }
      if(e.type==='pointerup'){
        const point=inkPosition(e),last=activeStroke.stroke.points.at(-1);
        if(Math.hypot(point.x-last.x,point.y-last.y)>.12)activeStroke.stroke.points.push(point);
      }
      flushInkRender();
      activeStroke=null;persist();
    }
  };
  ink.addEventListener('pointerup',finishStroke);
  ink.addEventListener('pointercancel',finishStroke);
  document.getElementById('v76UndoInk').addEventListener('click',()=>{
    const ctx=current();if(!ctx||!ctx.page.strokes.length)return;ctx.page.strokes.pop();persist();strokesView(ctx.page);
  });
  window.addEventListener('resize',()=>{
    syncZoomLayout();
    const ctx=current();if(ctx)strokesView(ctx.page);
  });
  applyMode('select');
  if(v6Project())renderPage(v6Project(),true);
})();