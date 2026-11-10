'use strict';
/* Canvas v8.14: keep projects selectable without sacrificing notebook width.
 * The project switcher now lives in the header; the notebook's own Pages
 * sidebar remains inside the notebook. Existing project data is unchanged.
 */
(function(){
  const workspace=document.getElementById('projectWorkspace');
  const picker=document.getElementById('v814ProjectSelect');
  if(!workspace||!picker)return;

  const layout=document.createElement('div');
  layout.className='v81-project-layout';
  const main=document.createElement('div');
  main.className='v81-project-main';
  while(workspace.firstChild)main.append(workspace.firstChild);
  layout.append(main);workspace.append(layout);

  function renderPicker(){
    const current=String(window.v6ActiveProjectId??'');
    const projects=(state.projects||[]).slice()
      .sort((a,b)=>(Number(b.lastOpenedAt)||0)-(Number(a.lastOpenedAt)||0));
    picker.replaceChildren();
    for(const project of projects){
      const option=document.createElement('option');
      option.value=String(project.id);
      option.textContent=project.title;
      picker.append(option);
    }
    if(projects.some(project=>String(project.id)===current))picker.value=current;
    picker.disabled=!projects.length;
  }

  const oldProjectRender=v6Render;
  v6Render=function(){
    oldProjectRender();
    renderPicker();
  };
  const oldOpenProject=v6OpenProject;
  v6OpenProject=function(id){
    const project=(state.projects||[]).find(p=>String(p.id)===String(id));
    if(!project)return;
    project.lastOpenedAt=Date.now();
    save();
    // Base v6OpenProject already scrolls instantly once. A second
    // requestAnimationFrame scroll here caused a redundant viewport movement
    // (and duplicate layout work) after every project selection.
    oldOpenProject(id);
    renderPicker();
  };
  picker.addEventListener('change',()=>{
    const projectId=picker.value;
    if(!projectId||String(projectId)===String(window.v6ActiveProjectId))return;
    v6OpenProject(projectId);
  });

  // Retain a quiet status node for existing accessibility announcements.
  const announcement=document.createElement('div');
  announcement.id='v81A11yStatus';
  announcement.className='v76-sr';
  announcement.setAttribute('role','status');
  announcement.setAttribute('aria-live','polite');
  workspace.append(announcement);
  document.querySelectorAll('.bottom-nav button[data-tab]').forEach(button=>{
    button.setAttribute('aria-label',button.textContent.trim());
  });
  renderPicker();
})();
