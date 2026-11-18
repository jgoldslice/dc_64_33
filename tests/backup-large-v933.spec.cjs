'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('node:fs/promises');
const base='http://127.0.0.1:8765/';
test.use({browserName:'chromium',viewport:{width:390,height:844},isMobile:true,hasTouch:true});

test('large media backup keeps v2 checksums, pressure ink, and all attachment bytes',async({browser,page})=>{
  test.setTimeout(120000); // Multi-megabyte media and SHA-256 validation.
  await page.goto(base);
  await page.evaluate(async()=>{
    const sizes=[1048576,1310720,1572864];
    const library=[];
    for(let i=0;i<sizes.length;i++){
      const data=new Uint8Array(sizes[i]);data.fill(27+i);
      const key='large-backup-asset-'+i;
      await v6Blob('put',key,new Blob([data],{type:'image/png'}));
      library.push({id:'photo-'+i,type:'file',title:'Large '+i,
        key,mime:'image/png',size:sizes[i]});
    }
    state.projects=[{id:'large-media-project',title:'Large media and long handwriting',
      notes:[],actions:[],library,notePages:[{id:'note1',title:'Ink page',paperStyle:'graph',
        strokes:Array.from({length:20},(_,n)=>({
          id:'s'+n,width:2.5,color:'#112233',
          points:Array.from({length:180},(_,j)=>({x:j,y:n*10+j*.1,p:(j%100)/100}))
        })),objects:[]}]}];
    if(!save(true))throw Error('Unable to save large media fixture');
  });
  const [download]=await Promise.all([
    page.waitForEvent('download'),
    page.locator('#exportData').click()
  ]);
  const bytes=await fs.readFile(await download.path());
  const archive=JSON.parse(bytes.toString('utf8'));
  expect(archive.format).toBe('canvas-complete-backup');
  expect(archive.version).toBe(2);
  expect(archive.stateSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(archive.attachments.map(x=>x.size)).toEqual([1048576,1310720,1572864]);
  expect(archive.state.projects[0].notePages[0].paperStyle).toBe('graph');
  expect(archive.state.projects[0].notePages[0].strokes).toHaveLength(20);
  for(const [i,a] of archive.attachments.entries()){
    expect(a.sha256).toMatch(/^[a-f0-9]{64}$/);
    const media=Buffer.from(a.base64,'base64');
    expect(media.length).toBe(a.size);
    expect(media[0]).toBe(27+i);
    expect(media.at(-1)).toBe(27+i);
  }
  const context=await browser.newContext({acceptDownloads:true});
  const restored=await context.newPage();
  restored.on('dialog',async dialog=>dialog.accept());
  try{
    await restored.goto(base);
    await restored.locator('#importFile').setInputFiles({
      name:'large-complete-backup.json',mimeType:'application/json',buffer:bytes
    });
    await expect.poll(()=>restored.evaluate(()=>state.projects?.[0]?.title),{timeout:30000})
      .toBe('Large media and long handwriting');
    const checked=await restored.evaluate(async()=>{
      const project=state.projects[0],sizes=[];
      for(const record of project.library){
        const blob=await v6Blob('get',record.key);
        const a=new Uint8Array(await blob.arrayBuffer());
        sizes.push({size:a.length,first:a[0],last:a.at(-1)});
      }
      return {sizes,graph:project.notePages[0].paperStyle,
        strokes:project.notePages[0].strokes.length,
        pressure:project.notePages[0].strokes[0].points[99].p};
    });
    expect(checked).toEqual({sizes:[
      {size:1048576,first:27,last:27},
      {size:1310720,first:28,last:28},
      {size:1572864,first:29,last:29}
    ],graph:'graph',strokes:20,pressure:.99});
  }finally{await context.close();}
});
test('a missing large attachment blocks export instead of downloading an incomplete package',async({page})=>{
  await page.goto(base);
  await page.evaluate(()=>{
    state.projects=[{id:'missing',title:'Missing media',notes:[],actions:[],
      library:[{id:'missing-photo',type:'file',title:'Missing.png',
        mime:'image/png',key:'missing-large-media'}],notePages:[]}];
    if(!save(true))throw Error('Fixture save failed');
  });
  const warnings=[];
  page.on('dialog',async dialog=>{warnings.push(dialog.message());await dialog.dismiss();});
  let downloaded=false;
  page.on('download',()=>{downloaded=true;});
  await page.locator('#exportData').click();
  await expect.poll(()=>warnings.length).toBe(1);
  expect(warnings[0]).toContain('Missing saved attachment');
  expect(downloaded).toBe(false);
  expect(await page.evaluate(()=>state.projects[0].library[0].key)).toBe('missing-large-media');
});
