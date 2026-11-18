'use strict';
const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';
test.use({browserName:'chromium',viewport:{width:390,height:844},isMobile:true,hasTouch:true});

const damaged=[
  ['Goal steps are not an array',{goals:[{id:'g',title:'Goal',actions:'corrupted steps'}]}],
  ['Library item is not an object',{projects:[{id:'p',title:'Project',library:[42]}]}],
  ['Habit completion history is invalid',{habits:[{id:'h',title:'Habit',schedule:[0,1],days:'corrupt'}]}],
  ['Ink stroke points are not objects',{projects:[{id:'p',title:'Project',
    notePages:[{id:'page',strokes:[{id:'stroke',points:[null]}]}]}]}]
];
for(const [caseName,changes] of damaged){
  test('checksum-valid backup with malformed nested data rejected before import: '+caseName,async({page})=>{
    await page.goto(base);
    const initial=await page.evaluate(()=>{
      state.todayFocus='Do not replace this work';
      if(!save(true))throw Error('Could not seed safe current data');
      return localStorage.getItem(STORAGE_KEY);
    });
    const archive=await page.evaluate(async changes=>{
      const data={tasks:[],goals:[],habits:[],ideas:[],events:[],projects:[],...changes};
      const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(data)));
      const hex=Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('');
      return {format:'canvas-complete-backup',version:2,
        state:data,stateSha256:hex,attachments:[]};
    },changes);
    const messages=[];
    page.on('dialog',async dialog=>{messages.push(dialog.message());await dialog.dismiss();});
    await page.locator('#importFile').setInputFiles({
      name:'damaged-complete-backup.json',mimeType:'application/json',
      buffer:Buffer.from(JSON.stringify(archive))
    });
    await expect.poll(()=>messages.length).toBe(1);
    expect(messages[0]).toContain('Could not import backup:');
    expect(await page.evaluate(()=>localStorage.getItem(STORAGE_KEY))).toBe(initial);
  });
}
