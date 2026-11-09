'use strict';
/* Blueprint 8.9.2 — explicit, session-only iPad canvas focus.
   Uses the existing sidebar control, never writes application data. */
(function(){
  const actions=document.querySelector('#projectWorkspace .v82-project-header-actions');
  const sidebarToggle=document.querySelector('.canvas-ipad-collapse');
  if(!actions||!sidebarToggle||document.getElementById('v892FocusCanvas'))return;
  const focus=document.createElement('button');
  focus.type='button';
  focus.id='v892FocusCanvas';
  focus.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M13 9l-3 3 3 3"/></svg>';
  actions.prepend(focus);
  const tablet=window.matchMedia('(min-width:740px) and (min-height:600px)');
  function sync(){
    const expanded=document.body.classList.contains('canvas-ipad-sidebar-collapsed');
    focus.setAttribute('aria-pressed',String(expanded));
    const label=expanded?'Show navigation sidebar':'Expand project canvas';
    focus.setAttribute('aria-label',label);
    focus.title=label;
  }
  focus.addEventListener('click',()=>{
    if(!tablet.matches)return;
    // Keep the global toggle's own accessible state in sync.
    sidebarToggle.click();
    sync();
  });
  new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class']});
  sync();
})();
