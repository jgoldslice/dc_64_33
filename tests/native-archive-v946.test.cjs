'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {runInNewContext}=require('node:vm');
const src=readFileSync(require.resolve('../drawing-archive.js'),'utf8');
function fixture(stageFailure=false){
  const state={projects:[{id:'project',activeNotePageId:'one',notePages:[{id:'one',strokes:[1]},{id:'two'}]}]};
  const window={Capacitor:{isNativePlatform:()=>true,nativePromise:async(methodSpace,method,args)=>{
    if(method==='capabilities')return {drawingArchiveVersion:1};
    if(method==='exportDrawing')return args.pageId==='one'?{base64:'YWJj'}:{missing:true};
    if(stageFailure)throw Error('Disk full');
    return {pageId:'staged'};
  }}};
  runInNewContext(src,{window,crypto:require('node:crypto').webcrypto});
  return {archive:window.BlueprintDrawingArchive,state};
}
test('preserves legacy ink and active page while restoring native bytes under fresh IDs',async()=>{
  const {state,archive}=fixture(), entries=await archive.collect(state);
  await archive.validate(state,entries);
  const candidate=structuredClone(state);
  await archive.stage(candidate,entries);
  assert.deepEqual(candidate.projects[0].notePages[0],{id:'staged',strokes:[1]});
  assert.equal(candidate.projects[0].activeNotePageId,'staged');
  assert.notEqual(candidate.projects[0].notePages[1].id,'two');
  assert.equal(state.projects[0].activeNotePageId,'one');
});
test('rejects incomplete manifests, wrong page bindings and duplicate page IDs',async()=>{
  const {state,archive}=fixture(),entries=await archive.collect(state);
  await assert.rejects(archive.validate(state,[]),/Incomplete/);
  await assert.rejects(archive.validate(state,entries.reverse()),/relationship/);
  state.projects[0].notePages[1].id='one';
  await assert.rejects(archive.collect(state),/duplicate/);
});
test('failed native staging leaves original planner and page identifiers intact',async()=>{
  const {state,archive}=fixture(true),before=structuredClone(state);
  await assert.rejects(archive.stage(structuredClone(state),await archive.collect(state)),/Disk full/);
  assert.deepEqual(state,before);
});
