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
