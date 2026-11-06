'use strict';
// Canvas v8.2: a quieter project header and contextual settings menu.
// Existing project data and button behaviors remain in place.
(function(){
  const workspace=document.getElementById('projectWorkspace');
  const header=workspace?.querySelector('.v6-project-head');
  const toggle=document.getElementById('renameProject');
  const deleteButton=document.getElementById('deleteProject');
  const chat=document.getElementById('projectChat');
  const footer=workspace?.querySelector('.v6-project-footer');
  if(!workspace||!header||!toggle||!deleteButton||!chat||!footer)return;

  header.classList.add('v82-project-header');
  toggle.textContent='•••';
  toggle.type='button';
  toggle.setAttribute('aria-label','Project settings');
  toggle.setAttribute('aria-haspopup','menu');
  toggle.setAttribute('aria-controls','v82ProjectMenu');
  toggle.setAttribute('aria-expanded','false');
  toggle.title='Project settings';

  const right=document.createElement('div');
  right.className='v82-project-header-actions';
  chat.classList.remove('primary-button');
  chat.classList.add('v82-develop');
  chat.textContent='Develop ↗';
  chat.setAttribute('aria-label','Develop this project in ChatGPT');
  right.append(chat,toggle);
  header.append(right);

  const menu=document.createElement('div');
  menu.id='v82ProjectMenu';
  menu.className='v82-project-menu';
  menu.setAttribute('role','menu');
  menu.setAttribute('aria-label','Project settings');
  menu.hidden=true;

  const rename=document.createElement('button');
  rename.type='button';
  rename.id='v82RenameProject';
  rename.setAttribute('role','menuitem');
  rename.textContent='Rename project';

  const exportButton=document.createElement('button');
  exportButton.type='button';
  exportButton.id='v82ExportBackup';
  exportButton.setAttribute('role','menuitem');
  exportButton.textContent='Export complete backup';

  deleteButton.className='v82-delete-project';
  deleteButton.setAttribute('role','menuitem');
  deleteButton.textContent='Delete project';
  menu.append(rename,exportButton,deleteButton);
  header.append(menu);
  footer.hidden=true;

  function closeMenu({restoreFocus=false}={}){
    if(menu.hidden)return;
    menu.hidden=true;toggle.setAttribute('aria-expanded','false');
    if(restoreFocus&&workspace.isConnected&&!workspace.hidden)toggle.focus();
  }
  toggle.addEventListener('click',()=>{
    const opening=menu.hidden;
    menu.hidden=!opening;
    toggle.setAttribute('aria-expanded',String(opening));
    if(opening)rename.focus();
  });
  menu.addEventListener('keydown',e=>{
    if(!['ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
    e.preventDefault();
    const items=[...menu.querySelectorAll('button:not([disabled])')];
    const index=items.indexOf(document.activeElement);
    let next=e.key==='Home'?0:e.key==='End'?items.length-1:
      (index+(e.key==='ArrowDown'?1:-1)+items.length)%items.length;
    items[next]?.focus();
  });
  menu.addEventListener('click',e=>{
    if(!(e.target instanceof Element))return;
    if(e.target.closest('#v82ExportBackup')){
      closeMenu();
      document.getElementById('exportData')?.click();
      return;
    }
    if(e.target.closest('#v82RenameProject,#deleteProject'))closeMenu();
  });
  document.addEventListener('pointerdown',e=>{
    if(!(e.target instanceof Element)||menu.hidden)return;
    if(!e.target.closest('#v82ProjectMenu,#renameProject'))closeMenu();
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&!menu.hidden){e.preventDefault();closeMenu({restoreFocus:true});}
  });
  document.addEventListener('focusin',e=>{
    if(menu.hidden||!(e.target instanceof Element))return;
    if(!menu.contains(e.target)&&e.target!==toggle)closeMenu();
  });
  const formerRender=v6Render;
  v6Render=function(){
    closeMenu();
    formerRender();
  };
})();
