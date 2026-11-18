'use strict';
const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';
test.use({browserName:'chromium',viewport:{width:390,height:844},isMobile:true,hasTouch:true});

const invalid=[
  ['null task record',{tasks:[null]}],
  ['non-object goal record',{goals:[17]}],
  ['goal steps incorrectly encoded',{goals:[{id:'g',title:'Goal',actions:'lost steps'}]}],
  ['habit days incorrectly encoded',{habits:[{id:'h',title:'Habit',days:'lost history'}]}],
  ['habit schedule incorrectly encoded',{habits:[{id:'h',title:'Habit',days:{},schedule:'Mon-Fri'}]}],
  ['project Library incorrectly encoded',{projects:[{id:'p',title:'Project',library:{lost:true}}]}],
  ['note page stroke points incorrectly encoded',{projects:[{id:'p',title:'Project',
    notePages:[{id:'page',strokes:[{id:'s',points:'lost points'}]}]}]}],
  ['note page objects incorrectly encoded',{projects:[{id:'p',title:'Project',
    notePages:[{id:'page',objects:{lost:true}}]}]}]
];
for(const [description,record] of invalid){
  test('unreadable nested planner: '+description+' cannot be overwritten by the next save',async({page})=>{
    await page.goto(base);
    const raw=JSON.stringify(record);
    await page.evaluate(value=>localStorage.setItem('jgold-planner-v1',value),raw);
    await page.reload();
    await expect(page.locator('#canvasSaveWarning')).toBeVisible();
    const actual=await page.evaluate(()=>({
      loadedError:!!canvasLoadError,
      saved:save(true),
      raw:localStorage.getItem(STORAGE_KEY),
      recoverable:!document.getElementById('canvasSaveRecovery').hidden
    }));
    expect(actual).toEqual({loadedError:true,saved:false,raw,recoverable:true});
  });
}
test('partial legacy planner records with valid known arrays still load and remain writable',async({page})=>{
  await page.goto(base);
  const prior={tasks:[{id:5,title:'Legacy task',done:false}],
    goals:[{id:2,title:'Legacy goal',category:'Personal',actions:[{title:'Legacy step',done:false}]}],
    projects:[{id:'old-project',title:'Old project',library:[],notes:[]}]};
  await page.evaluate(value=>localStorage.setItem('jgold-planner-v1',JSON.stringify(value)),prior);
  await page.reload();
  const result=await page.evaluate(()=>({
    loadError:!!canvasLoadError,
    canSave:save(true),
    goalSteps:state.goals[0].actions.length,
    projectName:state.projects[0].title,
    history:JSON.parse(localStorage.getItem(STORAGE_KEY)).projects[0].title
  }));
  expect(result).toEqual({loadError:false,canSave:true,goalSteps:1,
    projectName:'Old project',history:'Old project'});
});
