'use strict';
/* Blueprint v9.23 — one Library ordering for images, links and files.
   Reorder existing records in memory and persist with the current save(true).
   No attachment data or storage keys are changed. */
(function(){
  const root=document.getElementById('projectLibraryList');
  if(!root||typeof v6RenderLibrary!=='function')return;
  const oldRender=v6RenderLibrary;
  const HOLD_MS=420,THRESHOLD=12;
  let gesture=null,suppressClickUntil=0;

  const project=()=>v6Project();
  const list=()=>root.querySelector('.v923-library-items');
  const itemFrom=target=>target instanceof Element?target.closest('[data-v923-item]'):null;
  const current=(p)=>p&&String(project()?.id)===String(p.id);
  const interactive=target=>target instanceof Element&&
    !!target.closest('.v923-image-options,[data-v6-delete-resource]');

  function closeMenus(){
    for(const menu of root.querySelectorAll('.v923-image-menu'))menu.hidden=true;
    for(const toggle of root.querySelectorAll('[data-v923-more]'))
      toggle.setAttribute('aria-expanded','false');
  }
  function createImageMenu(record){
    const controls=document.createElement('div');
    controls.className='v923-image-options';
    const toggle=document.createElement('button');
    toggle.type='button';toggle.className='v923-more-button';
    toggle.dataset.v923More=String(record.id);
    toggle.textContent='…';
    toggle.setAttribute('aria-label','Options for '+String(record.title||'image'));
    toggle.setAttribute('aria-haspopup','menu');
    toggle.setAttribute('aria-expanded','false');
    const menu=document.createElement('div');
    menu.className='v923-image-menu';menu.hidden=true;
    menu.setAttribute('role','menu');
    for(const [action,title] of [['rename','Rename'],['remove','Delete']]){
      const button=document.createElement('button');
      button.type='button';
      button.className='v923-menu-action'+(action==='remove'?' v923-menu-danger':'');
      button.dataset[action==='rename'?'v923Rename':'v923Remove']=String(record.id);
      button.setAttribute('role','menuitem');
      button.textContent=title;
      menu.append(button);
    }
    controls.append(toggle,menu);
    return controls;
  }

  function renameImage(id){
    const p=project(),record=p?.library.find(r=>String(r.id)===String(id));
    if(!record||!current(p))return;
    const next=prompt('Rename image',String(record.title||'Image'));
    if(next===null)return;
    const title=next.trim().slice(0,180);
    if(!title){announce('An image name cannot be empty.');return;}
    if(title===record.title)return;
    const previous=record.title;
    record.title=title;
    if(!save(true)){
      record.title=previous;
      announce('Rename was not saved. Check the Blueprint save notice.');
      return;
    }
    v6Render();
    window.v919RenderProjectOverview?.(p);
    announce('Image renamed to '+title+'.');
  }

  function clearGesture(){
    if(gesture){
      clearTimeout(gesture.timer);
      gesture.node?.classList.remove('v923-dragging');
      gesture=null;
    }
  }
  function announce(message){
    const status=root.querySelector('#v923OrderStatus');
    if(status)status.textContent=message;
  }
  function recordOrder(p){
    const container=list();
    if(!current(p)||!container||!Array.isArray(p.library))return;
    const previous=p.library;
    const records=new Map(previous.map(r=>[String(r.id),r]));
    const ids=[...container.children].map(node=>node.dataset.v923Item);
    if(ids.length!==previous.length||new Set(ids).size!==ids.length||
       ids.some(id=>!records.has(id)))return;
    if(ids.every((id,i)=>id===String(previous[i].id)))return;
    // Preserve the existing objects and every attachment key. The array
    // order itself is the source of truth for Library and Overview.
    p.library=ids.map(id=>records.get(id));
    const saved=save(true);
    v6RenderLibrary(p);
    window.v919RenderProjectOverview?.(p);
    announce(saved?'Library order saved.':'Order changed but not saved. Use the Blueprint save recovery notice to retry.');
  }

  function buildOrderedLibrary(p){
    clearGesture();
    if(!current(p)||!Array.isArray(p.library)||!p.library.length)return;
    const imageNodes=new Map(
      [...root.querySelectorAll('.v6-library-gallery [data-v6-view-image]')]
        .map(node=>[String(node.dataset.v6ViewImage),node]));
    const otherNodes=new Map(
      [...root.querySelectorAll('.v6-library-other > .v6-resource, .v6-library-other > .v86-video-card')]
        .map(node=>{
          const control=node.querySelector('[data-v6-open-resource],[data-v6-delete-resource]');
          return [String(node.dataset.v86VideoId||
            control?.dataset.v6OpenResource||control?.dataset.v6DeleteResource),node];
        }));
    // If a prior version introduces an unknown item type, keep the existing
    // Library rendering intact rather than hiding any records.
    if(p.library.some(r=>!imageNodes.has(String(r.id))&&!otherNodes.has(String(r.id))))return;

    const grid=document.createElement('div');
    grid.className='v923-library-items';
    grid.setAttribute('role','list');
    grid.setAttribute('aria-label','Project Library, ordered');

    for(const r of p.library){
      const id=String(r.id),isImage=imageNodes.has(id);
      const source=isImage?imageNodes.get(id):otherNodes.get(id);
      const wrapper=document.createElement('div');
      wrapper.className='v923-library-item'+(isImage?' v923-has-image':' v923-has-resource');
      wrapper.dataset.v923Item=id;
      wrapper.setAttribute('role','listitem');
      wrapper.tabIndex=0;
      wrapper.setAttribute('aria-label',String(r.title||'Library item')+
        '. Press and hold to move, or Alt plus arrow keys to reorder.');
      wrapper.title='Press and hold to reorder';
      if(isImage){
        const image=source.querySelector('img');
        if(image)image.draggable=false;
        wrapper.append(source,createImageMenu(r));
        const caption=document.createElement('span');
        caption.className='v923-item-caption';
        caption.textContent=String(r.title||'Image');
        wrapper.append(caption);
      }else wrapper.append(source);
      grid.append(wrapper);
    }
    const hint=document.createElement('p');
    hint.className='v923-reorder-hint';
    hint.textContent='Press and hold an item to rearrange · Alt + arrow keys also work';
    const status=document.createElement('p');
    status.className='v923-reorder-status';
    status.id='v923OrderStatus';
    status.setAttribute('role','status');
    status.setAttribute('aria-live','polite');
    root.replaceChildren(hint,grid,status);
  }

  v6RenderLibrary=function(p){
    oldRender(p);
    buildOrderedLibrary(p);
  };
  if(project())v6RenderLibrary(project());

  function begin(node,kind,x,y){
    clearGesture();
    const p=project();
    if(!node||!current(p)||!list()?.contains(node))return;
    gesture={node,p,kind,x,y,active:false,moved:false,timer:setTimeout(()=>{
      if(!gesture||gesture.node!==node||!root.contains(node))return;
      gesture.active=true;
      // Clear any selection already begun by iOS before the hold timer fired.
      window.getSelection()?.removeAllRanges();
      node.classList.add('v923-dragging');
      announce('Reordering '+(p.library.find(r=>String(r.id)===node.dataset.v923Item)?.title||'item')+'. Drag to the desired position.');
    },HOLD_MS)};
  }
  function move(x,y){
    if(!gesture)return;
    if(!gesture.active){
      if(Math.hypot(x-gesture.x,y-gesture.y)>THRESHOLD)clearGesture();
      return;
    }
    const container=list(),node=gesture.node;
    if(!container||!container.contains(node)){clearGesture();return;}
    const target=itemFrom(document.elementFromPoint(x,y));
    if(!target||target===node||target.parentElement!==container)return;
    const bounds=target.getBoundingClientRect();
    const cy=bounds.top+bounds.height/2;
    const after=root.classList.contains('v74-library-list')
      ?y>cy
      :Math.abs(y-cy)<bounds.height*.38
        ?x>bounds.left+bounds.width/2
        :y>cy;
    const before=after?target.nextElementSibling:target;
    if(before!==node){
      container.insertBefore(node,before);
      gesture.moved=true;
    }
  }
  function end(kind){
    if(!gesture||gesture.kind!==kind)return;
    const old=gesture;
    clearGesture();
    if(old.active){
      suppressClickUntil=Date.now()+700;
      if(old.moved)recordOrder(old.p);
      else announce('Release an item over another position to rearrange it.');
    }
  }
  root.addEventListener('touchstart',event=>{
    if(event.touches.length!==1||interactive(event.target))return;
    const t=event.touches[0];
    begin(itemFrom(event.target),'touch',t.clientX,t.clientY);
  },{passive:true});
  root.addEventListener('touchmove',event=>{
    if(!gesture||gesture.kind!=='touch'||event.touches.length!==1)return;
    const t=event.touches[0];
    move(t.clientX,t.clientY);
    if(gesture?.active)event.preventDefault();
  },{passive:false});
  root.addEventListener('touchend',()=>end('touch'));
  root.addEventListener('touchcancel',clearGesture);

  root.addEventListener('pointerdown',event=>{
    if(event.pointerType==='touch'||event.button!==0||interactive(event.target))return;
    begin(itemFrom(event.target),'pointer',event.clientX,event.clientY);
  });
  document.addEventListener('pointermove',event=>{
    if(gesture?.kind==='pointer')move(event.clientX,event.clientY);
  });
  document.addEventListener('pointerup',()=>end('pointer'));
  document.addEventListener('pointercancel',()=>{
    if(gesture?.kind==='pointer')clearGesture();
  });
  root.addEventListener('dragstart',event=>{
    if(itemFrom(event.target))event.preventDefault();
  });
  root.addEventListener('contextmenu',event=>{
    if(itemFrom(event.target)&&!interactive(event.target))event.preventDefault();
  });
  root.addEventListener('selectstart',event=>{
    if(itemFrom(event.target)&&!interactive(event.target))event.preventDefault();
  });
  root.addEventListener('click',event=>{
    const control=event.target instanceof Element?
      event.target.closest('[data-v923-more],[data-v923-rename],[data-v923-remove]'):null;
    if(!control)return;
    event.preventDefault();event.stopPropagation();
    const wrapper=itemFrom(control);
    if(!wrapper||!list()?.contains(wrapper))return;
    const id=wrapper.dataset.v923Item;
    if(control.hasAttribute('data-v923-more')){
      const menu=wrapper.querySelector('.v923-image-menu');
      const opening=!!menu?.hidden;
      closeMenus();
      if(menu){menu.hidden=!opening;control.setAttribute('aria-expanded',String(opening));}
      return;
    }
    closeMenus();
    if(control.hasAttribute('data-v923-rename'))renameImage(id);
    else if(control.hasAttribute('data-v923-remove'))void v6DeleteResource(id);
  });
  document.addEventListener('click',event=>{
    if(!root.contains(event.target))closeMenus();
    else if(!event.target.closest('.v923-image-options'))closeMenus();
  });
  root.addEventListener('keydown',event=>{
    if(event.key!=='Escape')return;
    const toggle=root.querySelector('[data-v923-more][aria-expanded="true"]');
    if(toggle){event.preventDefault();closeMenus();toggle.focus({preventScroll:true});}
  });
  // The synthetic click following a completed touch hold must not open an
  // image or external URL. Ordinary short taps still work unmodified.
  document.addEventListener('click',event=>{
    if(Date.now()>suppressClickUntil||!itemFrom(event.target))return;
    event.preventDefault();
    event.stopImmediatePropagation();
  },true);
  root.addEventListener('keydown',event=>{
    if(!event.altKey||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key))return;
    const node=itemFrom(event.target);
    const container=list();
    if(!node||!container||!container.contains(node))return;
    const nodes=[...container.children],index=nodes.indexOf(node);
    const direction=['ArrowUp','ArrowLeft'].includes(event.key)?-1:1;
    const next=index+direction;
    if(next<0||next>=nodes.length)return;
    event.preventDefault();
    if(direction<0)container.insertBefore(node,nodes[next]);
    else container.insertBefore(node,nodes[next].nextSibling);
    const id=node.dataset.v923Item,p=project();
    recordOrder(p);
    [...root.querySelectorAll('[data-v923-item]')]
      .find(x=>x.dataset.v923Item===id)?.focus({preventScroll:true});
  });
})();
