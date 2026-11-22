'use strict';
/* A real, pointer-following lift used by Today cards and Library tiles.
   Only a temporary, inert visual copy is moved. The original controls,
   media records and event listeners remain in their normal DOM tree. */
window.BlueprintDragPreview=Object.freeze({
  create(source,x,y){
    const rect=source.getBoundingClientRect();
    if(!rect.width||!rect.height)return null;
    const ghost=source.cloneNode(true);
    const original=[source,...source.querySelectorAll('*')];
    const copies=[ghost,...ghost.querySelectorAll('*')];
    // A floating copy must never duplicate document IDs, live regions or input
    // focus. Copy resolved styles because Library presentation is scoped to
    // its root, but the floating preview must escape all clipping ancestors.
    for(let i=0;i<copies.length;i++){
      const from=original[i],to=copies[i],style=getComputedStyle(from);
      for(let j=0;j<style.length;j++){
        const prop=style[j];
        if(prop==='animation'||prop.startsWith('transition'))continue;
        to.style.setProperty(prop,style.getPropertyValue(prop));
      }
      // The drag copy is presentation only; delegated actions and test
      // selectors must never mistake it for a real Today/Library record.
      for(const attr of [...to.attributes])
        if(attr.name.startsWith('data-'))to.removeAttribute(attr.name);
      to.removeAttribute('id');
      to.removeAttribute('aria-live');
      to.removeAttribute('aria-describedby');
      to.removeAttribute('aria-labelledby');
      if(to instanceof HTMLElement)to.tabIndex=-1;
    }
    ghost.classList.add('bp-follow-ghost');
    ghost.setAttribute('aria-hidden','true');
    ghost.inert=true;
    ghost.style.setProperty('width',rect.width+'px','important');
    ghost.style.setProperty('height',rect.height+'px','important');
    ghost.style.setProperty('margin','0','important');
    ghost.style.setProperty('position','fixed','important');
    ghost.style.setProperty('left','0px','important');
    ghost.style.setProperty('top','0px','important');
    ghost.style.setProperty('z-index','2147480000','important');
    ghost.style.setProperty('pointer-events','none','important');
    ghost.style.setProperty('overflow','hidden','important');
    ghost.style.setProperty('opacity','.96','important');
    ghost.style.setProperty('box-shadow','0 16px 34px #0005','important');
    ghost.style.setProperty('transition','none','important');
    const offsetX=x-rect.left,offsetY=y-rect.top;
    document.body.append(ghost);
    let removed=false;
    return {
      move(px,py){
        if(removed)return;
        ghost.style.setProperty('transform',
          'translate3d('+(px-offsetX)+'px,'+(py-offsetY)+'px,0) scale(1.025)','important');
      },
      remove(){removed=true;ghost.remove();}
    };
  }
});

// Today and Project dashboards share the same input, drop and cancel behavior.
window.BlueprintCardReorder=function({
  board,names,dataset,selector,cardSelector,classPrefix,isActive,saveOrder,savedMessage
}){
  const customClass=classPrefix+'-custom-order';
  const placeholderClass=classPrefix+'-placeholder';
  const reorderingClass=classPrefix+'-reordering';
  const cards=new Map(names.map(id=>[id,board.querySelector(selector(id))]));
  if([...cards.values()].some(node=>!node))return;
  const keyFor=node=>node?.dataset?.[dataset];
  for(const [id,node] of cards){
    node.dataset[dataset]=id;
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
  let gesture=null,suppressClickUntil=0,suppressNode=null;
  const validOrder=order=>{
    const chosen=Array.isArray(order)?order.filter(id=>names.includes(id)):[];
    return [...new Set([...chosen,...names])];
  };
  const domOrder=()=>[...board.children].map(keyFor).filter(id=>cards.has(id));
  const sameOrder=(a,b)=>a.length===b.length&&a.every((id,i)=>id===b[i]);
  const syncClass=()=>board.classList.toggle(customClass,
    !sameOrder(domOrder(),names));
  const setOrder=order=>{
    const next=validOrder(order);
    if(!sameOrder(domOrder(),next))
      for(const id of next)board.append(cards.get(id));
    syncClass();
  };
  function announce(text){status.textContent=text;}
  function persist(previous){
    const order=domOrder();
    if(sameOrder(order,previous))return;
    if(!saveOrder(order)){
      setOrder(previous);
      announce('The card order could not be saved. Your earlier order was preserved.');
      return;
    }
    announce(savedMessage);
  }

  function reset(commit=false){
    if(!gesture)return;
    const old=gesture;
    gesture=null;
    clearTimeout(old.timer);
    cancelAnimationFrame(old.scrollFrame||0);
    old.preview?.remove();
    old.node.classList.remove(placeholderClass);
    board.classList.remove(reorderingClass);
    if(commit&&isActive())persist(old.before);
    else setOrder(old.before);
    syncClass();
  }
  function autoScroll(){
    if(!gesture?.active)return;
    const y=gesture.lastY,limit=window.innerHeight||document.documentElement.clientHeight;
    const edge=64;
    const velocity=y<edge?-Math.min(16,(edge-y)*.35):
      y>limit-edge?Math.min(16,(y-(limit-edge))*.35):0;
    if(!isActive()){reset();return;}
    if(velocity){
      const main=board.closest('.shell main');
      const scroller=main&&main.scrollHeight>main.clientHeight+1&&
        /^(auto|scroll)$/.test(getComputedStyle(main).overflowY)?main:document.scrollingElement;
      if(scroller){
        const previous=scroller.scrollTop;
        scroller.scrollBy(0,velocity);
        if(scroller.scrollTop!==previous)move(gesture.lastX,y,true);
      }
    }
    gesture.scrollFrame=requestAnimationFrame(autoScroll);
  }
  function start(node,kind,x,y){
    if(gesture||!node||!board.contains(node)||!isActive())return;
    const before=domOrder();
    const g={node,kind,x,y,lastX:x,lastY:y,active:false,before,preview:null,scrollFrame:0};
    gesture=g;
    g.timer=setTimeout(()=>{
      if(gesture!==g||!node.isConnected||!isActive()){
        reset();return;
      }
      g.active=true;
      window.getSelection()?.removeAllRanges();
      g.preview=window.BlueprintDragPreview.create(node,g.lastX,g.lastY);
      board.classList.add(customClass);
      node.classList.add(placeholderClass);
      board.classList.add(reorderingClass);
      if(g.preview)g.preview.move(g.lastX,g.lastY);
      announce('Moving '+node.querySelector('.card-heading :is(h2,h3)')?.textContent.trim()+'.');
      g.scrollFrame=requestAnimationFrame(autoScroll);
    },HOLD_MS);
  }
  function move(x,y,scrolled=false){
    const g=gesture;
    if(!g||(!scrolled&&x===g.lastX&&y===g.lastY))return;
    g.lastX=x;g.lastY=y;
    if(!g.active){
      if(Math.hypot(x-g.x,y-g.y)>DEAD_ZONE)reset();
      return;
    }
    g.preview?.move(x,y);
    // Rect-based hit testing remains reliable even as the active card
    // changes grid positions underneath the floating visual preview.
    // The preview itself tracks every movement independently.
    const target=[...board.children].find(card=>{
      if(card===g.node||!keyFor(card))return false;
      const rect=card.getBoundingClientRect();
      return x>=rect.left&&x<=rect.right&&y>=rect.top&&y<=rect.bottom;
    });
    // Unequal heights can leave a moved target under the same finger.
    // Require the finger to leave that target before it can swap back.
    if(target===g.lastTarget)return;
    g.lastTarget=target;
    if(!target)return;
    const nodes=domOrder(),from=nodes.indexOf(keyFor(g.node)),to=nodes.indexOf(keyFor(target));
    if(from<0||to<0||from===to)return;
    board.insertBefore(g.node,to>from?target.nextSibling:target);
  }
  const interactive=target=>target instanceof Element &&
    !!target.closest('button,input,select,textarea,a,label,[contenteditable],[role="button"],[role="link"]');
  const find=target=>target instanceof Element?target.closest(cardSelector):null;
  board.addEventListener('touchstart',event=>{
    if(event.touches.length!==1){if(gesture?.kind==='touch')reset();return;}
    if(interactive(event.target))return;
    const p=event.touches[0];start(find(event.target),'touch',p.clientX,p.clientY);
  },{passive:true});
  board.addEventListener('touchmove',event=>{
    if(gesture?.kind!=='touch')return;
    if(event.touches.length!==1){reset();return;}
    const p=event.touches[0];
    move(p.clientX,p.clientY);
    if(gesture?.active)event.preventDefault();
  },{passive:false});
  board.addEventListener('touchend',event=>{
    if(gesture?.kind!=='touch')return;
    if(gesture.active&&event.changedTouches.length){
      const p=event.changedTouches[0];move(p.clientX,p.clientY);
      suppressNode=gesture.node;
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
      suppressNode=gesture.node;
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
    if(gesture||!isActive()||!event.altKey||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key))return;
    const node=find(event.target);
    if(!node||interactive(event.target)&&node!==event.target)return;
    const order=domOrder(),index=order.indexOf(keyFor(node));
    const next=index+(['ArrowUp','ArrowLeft'].includes(event.key)?-1:1);
    if(index<0||next<0||next>=order.length)return;
    event.preventDefault();
    const old=order.slice(),target=cards.get(order[next]);
    board.classList.add(customClass);
    board.insertBefore(node,next>index?target.nextSibling:target);
    persist(old);
    syncClass();
    node.focus({preventScroll:true});
  });
  document.addEventListener('click',event=>{
    if(Date.now()>suppressClickUntil||!suppressNode?.contains(event.target))return;
    event.preventDefault();event.stopImmediatePropagation();
  },true);
  window.addEventListener('pagehide',()=>reset());
  return {sync(order){reset();setOrder(order);}};

};
