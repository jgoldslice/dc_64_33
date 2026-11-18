'use strict';
/* Blueprint v9.28 — editable SVG ink lasso, page paper and immersive focus.
   No parallel note model: all operations use v76's saved page.strokes. */
(function(){
  const api=window.BlueprintNotesBridge;
  if(!api)return;
  const {root,surface,ink,zoomViewport}=api;
  const toolbar=root.querySelector('.v76-toolbar');
  const pageToolbar=document.createElement('div');
  pageToolbar.className='v79-tool-group v928-tool-group';
  pageToolbar.setAttribute('role','group');
  pageToolbar.setAttribute('aria-label','Ink selection and paper');
  pageToolbar.innerHTML=
    '<div class="v79-tool-buttons">'+
    '<button type="button" id="v928Lasso" aria-label="Lasso-select handwritten strokes" aria-pressed="false" title="Lasso">Lasso</button>'+
    '</div>';
  const paperGroup=document.createElement('div');
  paperGroup.className='v79-tool-group v928-paper-group';
  paperGroup.innerHTML='<label for="v928Paper">Paper</label>'+
    '<select id="v928Paper" aria-label="Page paper style"><option value="plain">Blank</option><option value="graph">Graph</option></select>';
  const focusButton=document.createElement('button');
  focusButton.type='button';focusButton.id='v928Focus';focusButton.textContent='Focus';
  focusButton.title='Full-screen writing workspace';
  focusButton.setAttribute('aria-label','Enter full-screen Notes focus mode');
  toolbar.insertBefore(pageToolbar,toolbar.querySelector('.v815-zoom-tools'));
  toolbar.insertBefore(paperGroup,toolbar.querySelector('.v815-zoom-tools'));
  toolbar.append(focusButton);

  const lassoButton=root.querySelector('#v928Lasso');
  const paperSelect=root.querySelector('#v928Paper');
  const svgNS='http://www.w3.org/2000/svg';
  const overlay=document.createElementNS(svgNS,'svg');
  overlay.id='v928InkOverlay';
  overlay.setAttribute('aria-hidden','true');
  surface.append(overlay);
  const focusBar=document.createElement('div');
  focusBar.id='v928FocusBar';focusBar.hidden=true;
  focusBar.innerHTML='<button type="button" id="v928FocusTools" aria-expanded="false" aria-controls="v928FocusMenu">Tools</button>'+
    '<button type="button" id="v928FocusExit" aria-label="Exit full-screen Notes">Done</button>'+
    '<div id="v928FocusMenu" hidden role="group" aria-label="Focus writing tools">'+
    '<button type="button" data-v928-mode="pen">Pen</button>'+
    '<button type="button" data-v928-mode="lasso">Lasso</button>'+
    '<button type="button" data-v928-mode="erase">Eraser</button>'+
    '<button type="button" data-v928-action="undo">Undo</button>'+
    '<label>Paper<select id="v928FocusPaper" aria-label="Paper style in focus"><option value="plain">Blank</option><option value="graph">Graph</option></select></label>'+
    '</div>';
  root.append(focusBar);
  const focusMenu=focusBar.querySelector('#v928FocusMenu');
  const focusPaper=focusBar.querySelector('#v928FocusPaper');
  let clipboard=null,pasteCount=0,selected=new Set(),gesture=null;
  let focus=false,placeholder=null,previousOverflow='';
  let activePageRef=null,touchTap=null;
  // A small contextual menu appears at the point of interaction; no
  // persistent Copy/Paste/Delete buttons occupy the notebook toolbar.
  const contextMenu=document.createElement('div');
  contextMenu.id='v930InkContext';
  contextMenu.hidden=true;
  contextMenu.setAttribute('role','menu');
  contextMenu.setAttribute('aria-label','Handwriting actions');
  contextMenu.innerHTML=
    '<button type="button" role="menuitem" data-v930-action="copy">Copy</button>'+
    '<button type="button" role="menuitem" data-v930-action="delete">Delete</button>'+
    '<button type="button" role="menuitem" data-v930-action="paste">Paste</button>';
  document.body.append(contextMenu);
  let contextPoint=null;
  const clone=value=>structuredClone(value);
  const present=()=>api.current();
  const samePage=()=>present()?.page===activePageRef;
  const round=n=>Math.round(n*100)/100;
  const svgNode=(name,props)=>{
    const el=document.createElementNS(svgNS,name);
    for(const [key,value] of Object.entries(props||{}))el.setAttribute(key,String(value));
    return el;
  };
  const selectable=event=>event.pointerType==='pen'||(event.pointerType==='mouse'&&event.button===0);
  const byId=(page)=>new Map((page.strokes||[]).map(stroke=>[String(stroke.id),stroke]));
  function bounds(page){
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(const stroke of page.strokes||[]){
      if(!selected.has(String(stroke.id)))continue;
      for(const point of stroke.points||[]){
        minX=Math.min(minX,point.x);minY=Math.min(minY,point.y);
        maxX=Math.max(maxX,point.x);maxY=Math.max(maxY,point.y);
      }
    }
    return minX===Infinity?null:{minX,minY,maxX,maxY};
  }
  function contains(p,poly){
    let inside=false;
    for(let i=0,j=poly.length-1;i<poly.length;j=i++){
      const a=poly[i],b=poly[j];
      if((a.y>p.y)!==(b.y>p.y) && p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
    }
    return inside;
  }
  function crosses(a,b,c,d){
    const cross=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
    const a1=cross(a,b,c),a2=cross(a,b,d),b1=cross(c,d,a),b2=cross(c,d,b);
    if(a1*a2<0&&b1*b2<0)return true;
    const on=(p,q,r)=>Math.abs(cross(p,q,r))<.001&&
      r.x>=Math.min(p.x,q.x)-.001&&r.x<=Math.max(p.x,q.x)+.001&&
      r.y>=Math.min(p.y,q.y)-.001&&r.y<=Math.max(p.y,q.y)+.001;
    return on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b);
  }
  function touched(stroke,poly){
    const pts=stroke.points||[];
    if(pts.some(p=>contains(p,poly)))return true;
    for(let i=1;i<pts.length;i++)for(let j=0;j<poly.length;j++)
      if(crosses(pts[i-1],pts[i],poly[j],poly[(j+1)%poly.length]))return true;
    return false;
  }
  let pendingOverlayFrame=0;
  function scheduleOverlay(){
    if(pendingOverlayFrame)return;
    pendingOverlayFrame=requestAnimationFrame(()=>{pendingOverlayFrame=0;renderSelection();});
  }
  function renderSelection(){
    const ctx=present();
    overlay.setAttribute('viewBox','0 0 '+Math.max(1,surface.clientWidth)+' '+Math.max(1,surface.clientHeight));
    overlay.replaceChildren();
    const paths=Array.from(ink.querySelectorAll('path.v818-ink-stroke'));
    paths.forEach((path,i)=>{
      path.classList.toggle('v928-selected-stroke',
        !!ctx&&selected.has(String(ctx.page.strokes?.[i]?.id)));
      path.removeAttribute('transform');
    });
    if(gesture?.type==='lasso'&&gesture.points.length){
      const d=gesture.points.map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join(' ')+' Z';
      overlay.append(svgNode('path',{d,class:'v928-lasso-outline'}));
    }
    const box=ctx?bounds(ctx.page):null;
    if(box){
      const rect=svgNode('rect',{x:round(box.minX-8),y:round(box.minY-8),
        width:Math.max(18,round(box.maxX-box.minX+16)),
        height:Math.max(18,round(box.maxY-box.minY+16)),rx:5,class:'v928-selection-bounds'});
      overlay.append(rect);
    }
    updateActions();
  }
  function updateActions(){
    lassoButton.setAttribute('aria-pressed',String(api.getMode()==='lasso'));
    focusBar.querySelectorAll('[data-v928-mode]').forEach(btn=>{
      btn.setAttribute('aria-pressed',String(btn.dataset.v928Mode===api.getMode()));
    });
  }
  function closeInkMenu(){
    contextMenu.hidden=true;
    contextPoint=null;
  }
  function showInkMenu(kind,e,point){
    const ctx=present();
    if(!ctx||api.getMode()!=='lasso'&&api.getMode()!=='select')return;
    if(kind==='selected'&&!selected.size)return;
    if(kind==='paste'&&!clipboard?.length)return;
    closeInkMenu();
    contextPoint=point;
    contextMenu.dataset.kind=kind;
    contextMenu.querySelectorAll('[data-v930-action]').forEach(btn=>{
      btn.hidden=kind==='selected'?(btn.dataset.v930Action==='paste'):
        (btn.dataset.v930Action!=='paste');
    });
    contextMenu.hidden=false;
    const width=contextMenu.offsetWidth,height=contextMenu.offsetHeight;
    // Place above the tap when possible, without clipping iPhone/iPad edges.
    const viewWidth=window.innerWidth,viewHeight=window.innerHeight;
    const left=Math.max(8,Math.min(viewWidth-width-8,e.clientX-width/2));
    const top=e.clientY-height-12<8?e.clientY+14:e.clientY-height-12;
    contextMenu.style.left=Math.round(left)+'px';
    contextMenu.style.top=Math.round(Math.max(8,Math.min(viewHeight-height-8,top)))+'px';
  }
  function withinSelection(point,page){
    if(!selected.size)return false;
    const b=bounds(page);
    return !!b&&point.x>=b.minX-12&&point.x<=b.maxX+12&&
      point.y>=b.minY-12&&point.y<=b.maxY+12;
  }
  function resetSelection(){closeInkMenu();selected.clear();gesture=null;renderSelection();}
  function paperFor(page){return page?.paperStyle==='graph'?'graph':'plain';}
  function setPaper(value){
    const ctx=present();if(!ctx)return;
    const mode=value==='graph'?'graph':'plain';
    if(paperFor(ctx.page)!==mode){
      ctx.page.paperStyle=mode;
      api.persist();
    }
    surface.dataset.paper=mode;paperSelect.value=mode;focusPaper.value=mode;
  }
  function onPageChange(project,page){
    closeInkMenu();touchTap=null;
    activePageRef=page;selected.clear();gesture=null;
    surface.dataset.paper=paperFor(page);paperSelect.value=paperFor(page);focusPaper.value=paperFor(page);
    renderSelection();
  }
  function onInkRedraw(page){
    if(page!==present()?.page)return;
    const available=new Set((page.strokes||[]).map(s=>String(s.id)));
    selected=new Set([...selected].filter(id=>available.has(id)));
    renderSelection();
  }
  function onModeChange(next){
    closeInkMenu();
    if(next!=='lasso'&&selected.size)resetSelection();
    else updateActions();
  }
  function onDirectInkEdit(){closeInkMenu();if(selected.size)resetSelection();}
  function cancelGesture(){
    touchTap=null;closeInkMenu();
    if(!gesture)return;
    gesture=null;renderSelection();
  }
  window.BlueprintNotesWorkspace={onPageChange,onInkRedraw,onModeChange,onDirectInkEdit,cancelGesture};

  function rememberUndo(action){const ctx=present();if(ctx)api.pushInkUndo(ctx.page,action);}
  function copySelection(){
    const ctx=present();if(!ctx||!selected.size)return;
    clipboard=ctx.page.strokes.filter(s=>selected.has(String(s.id))).map(clone);
    pasteCount=0;closeInkMenu();updateActions();
  }
  function pasteInk(at=null){
    const ctx=present();if(!ctx||!clipboard?.length)return;
    const pts=clipboard.flatMap(s=>s.points||[]);
    if(!pts.length)return;
    const offset=24+pasteCount*18;
    const dx=at?at.x-Math.min(...pts.map(p=>p.x)):offset;
    const dy=at?at.y-Math.min(...pts.map(p=>p.y)):offset;
    const copy=clipboard.map(stroke=>({...clone(stroke),id:v6Id(),
      points:(stroke.points||[]).map(p=>({...p,x:round(p.x+dx),y:round(p.y+dy)}))}));
    if(!copy.every(s=>s.points.length&&s.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))))return;
    ctx.page.strokes.push(...copy);
    rememberUndo({type:'paste',ids:copy.map(s=>String(s.id))});
    selected=new Set(copy.map(s=>String(s.id)));pasteCount++;
    closeInkMenu();
    const pastedPoints=copy.flatMap(s=>s.points);
    api.growPage(ctx.page,Math.max(...pastedPoints.map(p=>p.y))+70);
    api.growPageWidth(ctx.page,Math.max(...pastedPoints.map(p=>p.x))+60);
    api.persist();api.strokesView(ctx.page);
  }
  function deleteSelection(){
    const ctx=present();if(!ctx||!selected.size)return;
    closeInkMenu();
    const removed=ctx.page.strokes.map((stroke,index)=>({index,stroke:clone(stroke)}))
      .filter(x=>selected.has(String(x.stroke.id)));
    if(!removed.length)return;
    rememberUndo({type:'delete',removed});
    ctx.page.strokes=ctx.page.strokes.filter(s=>!selected.has(String(s.id)));
    selected.clear();api.persist();api.strokesView(ctx.page);
  }

  function finishLasso(points,page){
    if(points.length<3)return;
    const poly=points;
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(const p of poly){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);
      minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);}
    const bb={minX,maxX,minY,maxY};
    if((bb.maxX-bb.minX)*(bb.maxY-bb.minY)<120)return;
    selected=new Set((page.strokes||[]).filter(stroke=>touched(stroke,poly)).map(s=>String(s.id)));
  }
  function showMovePreview(dx,dy){
    const ctx=present();if(!ctx)return;
    ink.querySelectorAll('path.v818-ink-stroke').forEach((path,i)=>{
      if(selected.has(String(ctx.page.strokes?.[i]?.id)))
        path.setAttribute('transform','translate('+round(dx)+' '+round(dy)+')');
    });
    overlay.querySelector('.v928-selection-bounds')?.setAttribute('transform',
      'translate('+round(dx)+' '+round(dy)+')');
  }
  ink.addEventListener('pointerdown',e=>{
    if(api.getMode()!=='lasso'||gesture)return;
    closeInkMenu();
    // Finger taps may invoke the menu; their movements still belong to
    // existing finger pan/pinch, never to the Pencil drawing/lasso engine.
    if(e.pointerType==='touch'){
      touchTap={id:e.pointerId,startX:e.clientX,startY:e.clientY,
        page:present()?.page,moved:false};
      return;
    }
    if(!selectable(e))return;
    const ctx=present();if(!ctx)return;
    e.preventDefault();
    const point=api.inkPosition(e),bb=bounds(ctx.page);
    const canMove=bb&&point.x>=bb.minX-12&&point.x<=bb.maxX+12&&
      point.y>=bb.minY-12&&point.y<=bb.maxY+12;
    gesture={id:e.pointerId,page:ctx.page,type:canMove?'move':'lasso',
      start:point,startClientX:e.clientX,startClientY:e.clientY,
      dx:0,dy:0,points:[point]};
    if(!canMove)selected.clear();
    try{ink.setPointerCapture(e.pointerId);}catch(_){}
    renderSelection();
  });
  ink.addEventListener('pointermove',e=>{
    if(touchTap?.id===e.pointerId&&Math.hypot(e.clientX-touchTap.startX,e.clientY-touchTap.startY)>9)
      touchTap.moved=true;
    if(!gesture||e.pointerId!==gesture.id)return;
    if(e.cancelable)e.preventDefault();
    const samples=e.getCoalescedEvents?.()||[];
    const pts=samples.length?samples:[e];
    if(gesture.type==='lasso'){
      for(const sample of pts){
        const p=api.inkPosition(sample),last=gesture.points.at(-1);
        if(Math.hypot(p.x-last.x,p.y-last.y)>.6)gesture.points.push(p);
      }
      scheduleOverlay();
    }else{
      const p=api.inkPosition(e),box=bounds(gesture.page);
      gesture.dx=Math.max(-(box?.minX||0),p.x-gesture.start.x);
      gesture.dy=Math.max(-(box?.minY||0),p.y-gesture.start.y);
      showMovePreview(gesture.dx,gesture.dy);
    }
  });
  function finishLassoGesture(e){
    const g=gesture;
    if(!g||e.pointerId!==g.id)return;
    gesture=null;
    if(e.type==='pointercancel'||!samePage()||g.page!==present()?.page){
      if(samePage()&&g.page===present()?.page)api.strokesView(g.page);
      else{selected.clear();renderSelection();}
      return;
    }
    const isTap=g.type==='move'&&Math.hypot(g.dx,g.dy)<=1;
    const blankTap=g.type==='lasso'&&g.points.length<3&&
      Math.hypot(e.clientX-g.startClientX,e.clientY-g.startClientY)<10;
    if(g.type==='lasso'){
      const final=api.inkPosition(e);
      if(Math.hypot(final.x-g.points.at(-1).x,final.y-g.points.at(-1).y)>.6)g.points.push(final);
      finishLasso(g.points,g.page);
    }else if(Math.hypot(g.dx,g.dy)>1){
      const moved=g.page.strokes.filter(s=>selected.has(String(s.id)));
      rememberUndo({type:'move',before:moved.map(s=>({id:s.id,points:clone(s.points)}))});
      for(const s of moved)s.points=s.points.map(p=>({...p,
        x:round(p.x+g.dx),y:round(p.y+g.dy)}));
      const pts=moved.flatMap(s=>s.points);
      api.growPage(g.page,Math.max(...pts.map(p=>p.y))+70);
      api.growPageWidth(g.page,Math.max(...pts.map(p=>p.x))+60);
      api.persist();
    }
    api.strokesView(g.page);
    if(isTap)showInkMenu('selected',e,api.inkPosition(e));
    else if(blankTap)showInkMenu('paste',e,api.inkPosition(e));
  }
  ink.addEventListener('pointerup',finishLassoGesture);
  ink.addEventListener('pointercancel',finishLassoGesture);
  ink.addEventListener('pointerup',e=>{
    const t=touchTap;if(!t||t.id!==e.pointerId)return;
    touchTap=null;
    if(t.moved||t.page!==present()?.page||gesture)return;
    const point=api.inkPosition(e);
    if(withinSelection(point,t.page))showInkMenu('selected',e,point);
    else if(clipboard?.length){
      selected.clear();renderSelection();showInkMenu('paste',e,point);
    }
  });
  ink.addEventListener('pointercancel',e=>{
    if(touchTap?.id===e.pointerId)touchTap=null;
  });
  zoomViewport.addEventListener('touchstart',e=>{
    if((e.touches?.length||0)>1)touchTap=null;
  },{passive:true});
  // In ordinary Select mode the SVG is not hit-testable; the page itself
  // supplies Paste on an otherwise empty tap, not while editing text/images.
  surface.addEventListener('click',e=>{
    if(api.getMode()!=='select'||e.target!==surface||!clipboard?.length)return;
    showInkMenu('paste',e,api.inkPosition(e));
  });
  contextMenu.addEventListener('click',e=>{
    const action=e.target.closest('[data-v930-action]')?.dataset.v930Action;
    if(!action)return;
    if(action==='copy')copySelection();
    else if(action==='delete')deleteSelection();
    else if(action==='paste')pasteInk(contextPoint);
  });
  document.addEventListener('pointerdown',e=>{
    if(!contextMenu.hidden&&!contextMenu.contains(e.target)&&!ink.contains(e.target)&&e.target!==surface)
      closeInkMenu();
  },{capture:true});
  zoomViewport.addEventListener('scroll',closeInkMenu,{passive:true});
  window.addEventListener('resize',closeInkMenu);
  lassoButton.addEventListener('click',()=>api.setMode(api.getMode()==='lasso'?'select':'lasso'));
  paperSelect.addEventListener('change',()=>setPaper(paperSelect.value));

  const toggleFocusTools=open=>{
    focusMenu.hidden=!open;
    focusBar.querySelector('#v928FocusTools').setAttribute('aria-expanded',String(open));
  };
  const resizeNotebook=()=>requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));
  function exitFocus(){
    if(!focus)return;closeInkMenu();
    focus=false;toggleFocusTools(false);
    focusBar.hidden=true;root.classList.remove('v928-focus-mode');
    document.body.classList.remove('v928-notes-focus');
    document.body.style.overflow=previousOverflow;
    if(placeholder?.parentNode)placeholder.replaceWith(root);
    placeholder=null;resizeNotebook();
  }
  function enterFocus(){
    if(focus||!root.isConnected)return;
    closeInkMenu();focus=true;previousOverflow=document.body.style.overflow;
    placeholder=document.createComment('Notes original position');
    root.parentNode.insertBefore(placeholder,root);
    document.body.append(root);
    root.classList.add('v928-focus-mode');
    document.body.classList.add('v928-notes-focus');
    document.body.style.overflow='hidden';
    focusBar.hidden=false;toggleFocusTools(false);
    if(api.getMode()==='select')api.setMode('pen');
    resizeNotebook();
  }
  focusButton.addEventListener('click',enterFocus);
  focusBar.querySelector('#v928FocusExit').addEventListener('click',exitFocus);
  focusBar.querySelector('#v928FocusTools').addEventListener('click',()=>toggleFocusTools(focusMenu.hidden));
  focusBar.addEventListener('click',e=>{
    const mode=e.target.closest('[data-v928-mode]');
    if(mode){api.setMode(mode.dataset.v928Mode);toggleFocusTools(false);return;}
    const action=e.target.closest('[data-v928-action]');
    if(action?.dataset.v928Action==='undo'){
      document.getElementById('v76UndoInk').click();return;
    }
  });
  focusPaper.addEventListener('change',()=>setPaper(focusPaper.value));
  document.addEventListener('keydown',e=>{
    if(!root.isConnected||!present()||!root.getClientRects().length)return;
    const active=document.activeElement;
    if(active?.isContentEditable||['INPUT','TEXTAREA'].includes(active?.tagName))return;
    if(e.key==='Escape'){
      if(!contextMenu.hidden){e.preventDefault();closeInkMenu();return;}
      if(focus){e.preventDefault();exitFocus();}
      else if(api.getMode()==='lasso'){e.preventDefault();resetSelection();api.setMode('select');}
      return;
    }
    if((e.metaKey||e.ctrlKey)&&!e.shiftKey&&e.key.toLowerCase()==='z'){
      e.preventDefault();document.getElementById('v76UndoInk').click();return;
    }
    if(api.getMode()!=='lasso'||!(e.metaKey||e.ctrlKey))return;
    if(e.key.toLowerCase()==='c'&&selected.size){e.preventDefault();copySelection();}
    if(e.key.toLowerCase()==='v'&&clipboard?.length){e.preventDefault();pasteInk();}
  },true);
  if(present())onPageChange(present().p,present().page);
})();