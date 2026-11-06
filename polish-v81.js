'use strict';
/* Canvas 8.1: high-value, low-clutter ergonomics.
 * No extra top-level destinations, no forced cloud sync, no new note tools.
 */
(function(){
  const workspace=document.getElementById('projectWorkspace');
  if(!workspace)return;
  const htmlEsc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const folderIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';
  // Keep the current project-only workspace on phones. The rail is merely an
  // alternative presentation when there is enough space to show two panes.
  const layout=document.createElement('div');
  layout.className='v81-project-layout';
  const rail=document.createElement('aside');
  rail.className='v81-project-rail';
  rail.setAttribute('aria-label','Switch projects');
  const main=document.createElement('div');
  main.className='v81-project-main';
  while(workspace.firstChild)main.append(workspace.firstChild);
  layout.append(rail,main);
  workspace.append(layout);
  const orderByRecent=(a,b)=>(Number(b.lastOpenedAt)||0)-(Number(a.lastOpenedAt)||0);
  function renderRail(){
    const current=String(window.v6ActiveProjectId??'');
    const projects=(state.projects||[]).slice().sort(orderByRecent);
    const heading='<h3>Projects</h3>';
    rail.innerHTML=heading+projects.map(p=>
      '<button type="button" class="v81-project-switch" data-v81-switch-project="'+htmlEsc(p.id)+'" aria-current="'+(String(p.id)===current?'true':'false')+'">'+
      folderIcon+'<span>'+htmlEsc(p.title)+'</span></button>'
    ).join('');
  }
  const previousProjectRender=v6Render;
  v6Render=function(){
    previousProjectRender();
    renderRail();
  };
  const previousOpenProject=v6OpenProject;
  v6OpenProject=function(id){
    const p=(state.projects||[]).find(project=>String(project.id)===String(id));
    if(!p)return;
    p.lastOpenedAt=Date.now();
    save();
    previousOpenProject(id);
    renderRail();
    // Direct Today-to-Project navigation wins over a previously queued
    // per-tab scroll restoration. Keep this folder's header on screen.
    requestAnimationFrame(()=>{
      if(!workspace.hidden)workspace.scrollIntoView({behavior:'instant',block:'start'});
    });
  };
  rail.addEventListener('click',e=>{
    const button=e.target.closest('[data-v81-switch-project]');
    if(!button)return;
    v6OpenProject(button.dataset.v81SwitchProject);
  });
  // A compact, accessible status announcement rather than decorative toast spam.
  const announcement=document.createElement('div');
  announcement.id='v81A11yStatus';
  announcement.className='v76-sr';
  announcement.setAttribute('role','status');
  announcement.setAttribute('aria-live','polite');
  workspace.append(announcement);
  // Keep active tab semantics in sync even if a click handler sets .selected.
  const tabs=document.querySelectorAll('.bottom-nav button[data-tab]');
  tabs.forEach(button=>{
    button.setAttribute('aria-label',button.textContent.trim());
  });
  renderRail();
})();
