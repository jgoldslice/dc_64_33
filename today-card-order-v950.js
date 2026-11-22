'use strict';
/* Blueprint v9.50 — Today card order: visible pointer-following lift,
   saved as an optional planner preference. No new storage key or migration. */
(function(){
  const board=document.querySelector('#today > .v917-today-grid');
  if(!board||!window.BlueprintDragPreview)return;
  const names=['schedule','habits','tasks','priorities','projects'];
  const cards=new Map(names.map(id=>[id,board.querySelector('.v917-'+id)]));
  if([...cards.values()].some(node=>!node))return;
  const keyFor=node=>node?.dataset?.bpTodayCard;
  for(const [id,node] of cards){
    node.dataset.bpTodayCard=id;
    node.tabIndex=0;
    node.setAttribute('aria-keyshortcuts','Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight');
    node.title='Hold to move this card';
  }
  const status=document.createElement('span');
  status.className='bp-visually-hidden';
  status.setAttribute('role','status');
  status.setAttribute('aria-live','polite');
  board.after(status);
  const HOLD_MS=420,DEAD_ZONE=12;
  let gesture=null,suppressClickUntil=0;
  const validOrder=order=>{
    const chosen=Array.isArray(order)?order.filter(id=>names.includes(id)):[];
    return [...new Set([...chosen,...names])];
  };
  const domOrder=()=>[...board.children].map(keyFor).filter(id=>cards.has(id));
  const setOrder=order=>{
    for(const id of validOrder(order))board.append(cards.get(id));
  };
  function announce(text){status.textContent=text;}
  function persist(previous){
    const order=domOrder();
    if(order.join('|')===previous.join('|'))return;
    const old=state.todayCardOrder;
    state.todayCardOrder=order;
    if(!save(true)){
      if(old===undefined)delete state.todayCardOrder;
      else state.todayCardOrder=old;
      setOrder(previous);
      announce('The card order could not be saved. Your earlier order was preserved.');
      return;
    }
    announce('Today card order saved.');
  }
  // All existing state and complete-backup readers preserve optional planner
  // fields. Never create or write the setting merely by opening Today.
  setOrder(validOrder(state.todayCardOrder));
  // A complete-backup restore replaces the planner object in place without
  // reloading the web view. Reflect an imported order immediately after the
  // existing verified restore completes; decline/failure keeps the old order.
  const importBackup=window.v74ImportBackup;
  if(typeof importBackup==='function'){
    window.v74ImportBackup=async function(...args){
      try{return await importBackup(...args);}
      finally{if(!gesture)setOrder(validOrder(state.todayCardOrder));}
    };
  }

  function reset(commit=false){
    if(!gesture)return;
    const old=gesture;
    gesture=null;
    clearTimeout(old.timer);
    cancelAnimationFrame(old.scrollFrame||0);
    old.preview?.remove();
    old.node.classList.remove('bp-today-placeholder');
    board.classList.remove('bp-today-reordering');
    if(commit)persist(old.before);
    else setOrder(old.before);
  }
  function autoScroll(){
    if(!gesture?.active)return;
    const y=gesture.lastY,limit=window.innerHeight||document.documentElement.clientHeight;
    const edge=64;
    const velocity=y<edge?-Math.min(16,(edge-y)*.35):
      y>limit-edge?Math.min(16,(y-(limit-edge))*.35):0;
    if(velocity&&document.getElementById('today')?.classList.contains('active'))
      window.scrollBy(0,velocity);
    gesture.scrollFrame=requestAnimationFrame(autoScroll);
  }
  function start(node,kind,x,y){
    if(gesture||!node||!board.contains(node))return;
    const before=domOrder();
    const g={node,kind,x,y,lastX:x,lastY:y,active:false,before,preview:null,scrollFrame:0};
    gesture=g;
    g.timer=setTimeout(()=>{
      if(gesture!==g||!node.isConnected||!document.getElementById('today')?.classList.contains('active')){
        reset();return;
      }
      g.active=true;
      window.getSelection()?.removeAllRanges();
      g.preview=window.BlueprintDragPreview.create(node,g.lastX,g.lastY);
      node.classList.add('bp-today-placeholder');
      board.classList.add('bp-today-reordering');
      if(g.preview)g.preview.move(g.lastX,g.lastY);
      announce('Moving '+node.querySelector('.card-heading h2')?.textContent.trim()+'.');
      g.scrollFrame=requestAnimationFrame(autoScroll);
    },HOLD_MS);
  }
  function move(x,y){
    const g=gesture;
    if(!g)return;
    g.lastX=x;g.lastY=y;
    if(!g.active){
      if(Math.hypot(x-g.x,y-g.y)>DEAD_ZONE)reset();
      return;
    }
    g.preview?.move(x,y);
    // The preview has pointer-events:none, so hit testing still sees the
    // original grid. Use the target card, not a fixed crossing threshold for
    // the floating preview: it keeps tracking the finger continuously.
    const target=document.elementFromPoint(x,y)?.closest('[data-bp-today-card]');
    if(!target||target===g.node||target.parentElement!==board)return;
    const nodes=domOrder(),from=nodes.indexOf(keyFor(g.node)),to=nodes.indexOf(keyFor(target));
    if(from<0||to<0||from===to)return;
    board.insertBefore(g.node,to>from?target.nextSibling:target);
  }
  const interactive=target=>target instanceof Element &&
    !!target.closest('button,input,select,textarea,a,label,[contenteditable],[role="button"],[role="link"]');
  const find=target=>target instanceof Element?target.closest('[data-bp-today-card]'):null;
  board.addEventListener('touchstart',event=>{
    if(event.touches.length!==1||interactive(event.target))return;
    const p=event.touches[0];start(find(event.target),'touch',p.clientX,p.clientY);
  },{passive:true});
  board.addEventListener('touchmove',event=>{
    if(gesture?.kind!=='touch'||event.touches.length!==1)return;
    const p=event.touches[0];
    move(p.clientX,p.clientY);
    if(gesture?.active)event.preventDefault();
  },{passive:false});
  board.addEventListener('touchend',event=>{
    if(gesture?.kind!=='touch')return;
    if(gesture.active&&event.changedTouches.length){
      const p=event.changedTouches[0];move(p.clientX,p.clientY);
      suppressClickUntil=Date.now()+650;
    }
    reset(true);
  });
  board.addEventListener('touchcancel',()=>{if(gesture?.kind==='touch')reset();});
  board.addEventListener('pointerdown',event=>{
    if(event.pointerType==='touch'||event.button!==0||interactive(event.target))return;
    start(find(event.target),'pointer',event.clientX,event.clientY);
  });
  document.addEventListener('pointermove',event=>{
    if(gesture?.kind==='pointer')move(event.clientX,event.clientY);
  });
  document.addEventListener('pointerup',event=>{
    if(gesture?.kind!=='pointer')return;
    if(gesture.active){
      move(event.clientX,event.clientY);
      suppressClickUntil=Date.now()+650;
    }
    reset(true);
  });
  document.addEventListener('pointercancel',()=>{if(gesture?.kind==='pointer')reset();});
  board.addEventListener('dragstart',event=>{if(find(event.target))event.preventDefault();});
  board.addEventListener('contextmenu',event=>{
    if(find(event.target)&&!interactive(event.target))event.preventDefault();
  });
  board.addEventListener('selectstart',event=>{
    if(gesture?.active&&find(event.target))event.preventDefault();
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&gesture?.active){event.preventDefault();reset();}
  });
  board.addEventListener('keydown',event=>{
    if(!event.altKey||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key))return;
    const node=find(event.target);
    if(!node||interactive(event.target)&&node!==event.target)return;
    const order=domOrder(),index=order.indexOf(keyFor(node));
    const next=index+(['ArrowUp','ArrowLeft'].includes(event.key)?-1:1);
    if(index<0||next<0||next>=order.length)return;
    event.preventDefault();
    const old=order.slice(),target=cards.get(order[next]);
    board.insertBefore(node,next>index?target.nextSibling:target);
    persist(old);
    node.focus({preventScroll:true});
  });
  document.addEventListener('click',event=>{
    if(Date.now()>suppressClickUntil||!find(event.target))return;
    event.preventDefault();event.stopImmediatePropagation();
  },true);
  window.addEventListener('pagehide',()=>reset());
})();
