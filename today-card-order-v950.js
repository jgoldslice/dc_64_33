'use strict';
/* Today card order is an optional preference in the existing planner. */
(function(){
  const board=document.querySelector('#today > .v917-today-grid');
  if(!board||!window.BlueprintCardReorder)return;
  const reorder=window.BlueprintCardReorder({
    board,
    names:['schedule','habits','tasks','priorities','projects'],
    dataset:'bpTodayCard',
    selector:id=>'.v917-'+id,
    cardSelector:'[data-bp-today-card]',
    classPrefix:'bp-today',
    isActive:()=>document.getElementById('today').classList.contains('active'),
    savedMessage:'Today card order saved.',
    saveOrder(order){
      const previous=state.todayCardOrder;
      state.todayCardOrder=order;
      if(save(true))return true;
      if(previous===undefined)delete state.todayCardOrder;
      else state.todayCardOrder=previous;
      return false;
    }
  });
  if(!reorder)return;
  reorder.sync(state.todayCardOrder);
  // Imports replace the planner in place.
  const importBackup=window.v74ImportBackup;
  if(typeof importBackup==='function'){
    window.v74ImportBackup=async function(...args){
      try{return await importBackup(...args);}
      finally{reorder.sync(state.todayCardOrder);}
    };
  }
})();
