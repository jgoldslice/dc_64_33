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
      '<span class="canvas-ipad-brand-copy"><strong>Canvas</strong><small>Shape your days</small></span>'+
    '</div>'+
    '<button type="button" class="canvas-ipad-collapse" aria-label="Collapse sidebar" aria-pressed="false" title="Collapse sidebar">'+
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M13 10l-3 2 3 2"/></svg>'+
    '</button>';
  nav.prepend(header);
  const footer=document.createElement('p');
  footer.className='canvas-ipad-nav-footer';
  footer.textContent='Out of small things proceedeth that which is great.';
  nav.append(footer);
  for(const button of nav.querySelectorAll('button[data-tab]')){
    button.title=button.querySelector('span')?.textContent?.trim()||'';
  }
  const toggle=header.querySelector('.canvas-ipad-collapse');
  toggle.addEventListener('click',()=>{
    const collapsed=document.body.classList.toggle('canvas-ipad-sidebar-collapsed');
    toggle.setAttribute('aria-pressed',String(collapsed));
    toggle.setAttribute('aria-label',collapsed?'Expand sidebar':'Collapse sidebar');
    toggle.title=collapsed?'Expand sidebar':'Collapse sidebar';
  });
})();
