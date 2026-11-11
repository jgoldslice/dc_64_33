'use strict';
/* Canvas 8.4: iPad navigation is a different presentation of the same four
   live tabs, not a second application, data store or set of tab buttons. */
(function(){
  const nav=document.querySelector('.bottom-nav');
  if(!nav||nav.querySelector('.canvas-ipad-nav-head'))return;
  const header=document.createElement('div');
  header.className='canvas-ipad-nav-head';
  // Reuse the existing palette artwork; do not duplicate the customize action.
  // The phone keeps its original header button, while iPad has the palette in
  // the navigation rail instead of the old half-filled circle emblem.
  header.innerHTML=
    '<div class="canvas-ipad-brand">'+
      '<button type="button" class="canvas-ipad-brand-mark canvas-ipad-palette-button" '+
        'id="canvasIpadPaletteButton" aria-label="Customize colors" title="Customize colors"></button>'+
      // The customization palette is the only sidebar brand mark.
    '</div>';
  const palette=document.getElementById('paletteLauncher');
  const railPalette=header.querySelector('#canvasIpadPaletteButton');
  if(palette){
    const artwork=palette.querySelector('svg');
    if(artwork)railPalette.append(artwork.cloneNode(true));
    railPalette.addEventListener('click',()=>palette.click());
  }
  nav.prepend(header);
  const footer=document.createElement('p');
  footer.className='canvas-ipad-nav-footer';
  footer.textContent='Out of small things proceedeth that which is great.';
  nav.append(footer);
  for(const button of nav.querySelectorAll('button[data-tab]')){
    button.title=button.querySelector('span')?.textContent?.trim()||'';
  }
  // The sidebar toggle lives adjacent to the nav, not among its four tabs.
  // Existing navigation logic and accessibility tests rely on precisely four.
  const toggle=document.createElement('button');
  toggle.className='canvas-ipad-collapse';
  toggle.type='button';
  toggle.setAttribute('aria-label','Collapse sidebar');
  toggle.setAttribute('aria-pressed','false');
  toggle.title='Collapse sidebar';
  toggle.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M13 10l-3 2 3 2"/></svg>';
  nav.after(toggle);
  toggle.addEventListener('click',()=>{
    const collapsed=document.body.classList.toggle('canvas-ipad-sidebar-collapsed');
    toggle.setAttribute('aria-pressed',String(collapsed));
    toggle.setAttribute('aria-label',collapsed?'Expand sidebar':'Collapse sidebar');
    toggle.title=collapsed?'Expand sidebar':'Collapse sidebar';
  });
})();
