'use strict';
/* Canvas 8.4: iPad navigation is a different presentation of the same four
   live tabs, not a second application, data store or set of tab buttons. */
(function(){
  const nav=document.querySelector('.bottom-nav');
  if(!nav||nav.querySelector('.canvas-ipad-nav-head'))return;
  const header=document.createElement('div');
  header.className='canvas-ipad-nav-head';
  header.innerHTML=
    '<div class="canvas-ipad-brand" aria-hidden="true">'+
      '<span class="canvas-ipad-brand-mark">◒</span>'+
      '<span class="canvas-ipad-brand-copy"><strong>Blueprint</strong></span>'+
    '</div>';
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
