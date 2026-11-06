'use strict';
// Canvas v7.7 — goal-first Blueprint, contextual step actions and uncluttered Today.
(function(){
  const priorityHost=document.getElementById('v77TodayPriorities');
  const projectsHost=document.getElementById('v77TodayProjects');
  if(!priorityHost||!projectsHost)return;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const folderIcon='<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';
  function refreshTodayExtras(){
    const top=ranked().slice(0,5);
    priorityHost.innerHTML=top.length?top.map(taskRow).join(''):'<p class="muted small">No priorities yet. Mark an important task as a priority.</p>';
    const projects=(state.projects||[]).slice().sort((a,b)=>(Number(b.lastOpenedAt)||0)-(Number(a.lastOpenedAt)||0)).slice(0,4);
    projectsHost.innerHTML=projects.length?projects.map(p=>
      '<button class="v77-project-folder" type="button" data-v77-open-project="'+esc(p.id)+'" aria-label="Open project: '+esc(p.title)+'">'+
      folderIcon+'<span>'+esc(p.title)+'</span></button>'
    ).join(''):'<p class="muted small">No projects yet. Create one in Brainstorm.</p>';
  }
  const beforeRender=render;
  render=function(){beforeRender();refreshTodayExtras();};
  // Project creates/renames/deletes normally call v6Render(), not render().
  const beforeProjectRender=v6Render;
  v6Render=function(){beforeProjectRender();refreshTodayExtras();};
  function closeStepMenus(except){
    document.querySelectorAll('.v77-step-menu').forEach(menu=>{
      const button=menu.previousElementSibling;
      const isOpen=menu===except;
      menu.hidden=!isOpen;
      if(button)button.setAttribute('aria-expanded',String(isOpen));
    });
  }
  document.addEventListener('click',e=>{
    const project=e.target.closest('[data-v77-open-project]');
    if(project){
      const id=project.dataset.v77OpenProject;
      // Switch to Brainstorm before revealing the independent project workspace.
      tab('brainstorm');
      v6OpenProject(id);
      return;
    }
    if(e.target.closest('#v77ViewProjects')){
      window.v6ActiveProjectId=null;
      v6Render();
      tab('brainstorm');
      return;
    }
    if(e.target.closest('#v77ViewTasks')){planTab('tasks');return;}
    const step=e.target.closest('[data-v77-step-action]');
    if(step){
      const menu=step.nextElementSibling;
      if(menu&&menu.classList.contains('v77-step-menu')){
        const open=menu.hidden;
        closeStepMenus(open?menu:null);
      }
      return;
    }
    if(!e.target.closest('.v77-step-menu'))closeStepMenus(null);
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape')closeStepMenus(null);
  });
  refreshTodayExtras();
})();