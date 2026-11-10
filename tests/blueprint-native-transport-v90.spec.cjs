const {test,expect}=require('@playwright/test');
const {createHash,webcrypto}=require('node:crypto');
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const bridge=require('../native-pencilkit-prototype/web/bridge.js');
const sha=buffer=>createHash('sha256').update(buffer).digest('hex');
function payload(projectId='p1',pageId='page1'){
  const data=Buffer.from('sample-binary-pkdrawing');
  const png=Buffer.from([137,80,78,71,13,10,26,10,0,1]);
  return {
    format:bridge.PAGE_FORMAT,schemaVersion:1,
    projectId,pageId,pageWidth:1024,pageHeight:1440,
    drawingBase64:data.toString('base64'),drawingSHA256:sha(data),
    previewBase64:png.toString('base64'),previewSHA256:sha(png),
    previewMIME:'image/png',savedAt:'2026-11-09T12:00:00Z'
  };
}

test('native drawing sidecar exports only the existing native pages and leaves original project notes untouched',async()=>{
  const projects=[{id:'p1',notePages:[
    {id:'page1',strokes:[{id:'legacy-ink'}]},
    {id:'page2',objects:[{id:'legacy-text',type:'text'}]}
  ]}];
  const original=JSON.stringify(projects);
  const plugin={exportPage:async({pageId})=>{
    if(pageId==='page2')throw Error('No native drawing has been saved for this page.');
    return payload();
  }};
  const bundle=await bridge.exportNativeBundle(plugin,projects);
  expect(bundle.pages).toHaveLength(1);
  expect(bundle.format).toBe(bridge.FORMAT);
  expect(JSON.stringify(projects)).toBe(original);
  await expect(bridge.validateBundle(bundle)).resolves.toBe(bundle);
});

test('native ink bundle import validates everything before writing and refuses overwrite by default',async()=>{
  const one=payload('p1','page1'),two=payload('p1','page2'),received=[];
  const plugin={importPage:async(args)=>{received.push(args);return {pageId:args.pageId}}};
  const bundle={format:bridge.FORMAT,version:1,pages:[one,two]};
  const imported=await bridge.importNativeBundle(plugin,bundle);
  expect(imported.map(x=>x.pageId)).toEqual(['page1','page2']);
  expect(received.every(x=>x.allowOverwrite===false)).toBe(true);
  expect(received.map(x=>x.projectId)).toEqual(['p1','p1']);
});

test('corrupt second native drawing aborts bundle validation before first import',async()=>{
  const one=payload('p1','page1');
  const two={...payload('p1','page2'),drawingBase64:Buffer.from('wrong').toString('base64')};
  let writes=0;
  const plugin={importPage:async()=>{writes++}};
  await expect(bridge.importNativeBundle(plugin,{
    format:bridge.FORMAT,version:1,pages:[one,two]
  })).rejects.toThrow(/checksum/i);
  expect(writes).toBe(0);
});

test('duplicate IDs, tampered PNG and unknown version are rejected',async()=>{
  const one=payload();
  await expect(bridge.validateBundle({format:bridge.FORMAT,version:1,pages:[one,one]}))
    .rejects.toThrow(/Duplicate/);
  await expect(bridge.validatePage({...one,previewBase64:Buffer.from('bad').toString('base64')}))
    .rejects.toThrow(/preview checksum/i);
  await expect(bridge.validateBundle({format:bridge.FORMAT,version:77,pages:[]}))
    .rejects.toThrow(/Unknown/);
});

test('native editor requires stable project/page IDs and never changes legacy note objects',async()=>{
  const project={id:'p1',notePages:[{id:'page1',strokes:[{id:2}]},{id:'page2',objects:[{id:3}]}]};
  const original=JSON.stringify(project);
  let args;
  const plugin={openEditor:async opts=>{args=opts;return {pageId:opts.pageId}}};
  await bridge.openNativeProjectPage(plugin,project,'page2');
  expect(args).toEqual({projectId:'p1',pageId:'page2',pageIds:['page1','page2']});
  expect(JSON.stringify(project)).toBe(original);
  await expect(bridge.openNativeProjectPage(plugin,project,'elsewhere')).rejects.toThrow(/not in this project/);
});

test('native transport never accepts a plugin export for an unrelated project',async()=>{
  const plugin={exportPage:async()=>payload('attacker','page1')};
  await expect(bridge.exportNativeBundle(plugin,[{id:'p1',notePages:[{id:'page1'}]}]))
    .rejects.toThrow(/identity/);
});
