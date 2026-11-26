const {test,expect}=require('@playwright/test');
const engines=require('playwright');

for(const browserName of ['webkit','chromium']) {
  test.describe(browserName+' large attachment restore',()=>{
    test('a 12 MiB attachment roundtrips with checksums; malformed encoding still blocks import',async()=>{
      test.setTimeout(120000);
      const browser=await engines[browserName].launch();
      try {
      const page=await browser.newPage({baseURL:'http://127.0.0.1:8765',viewport:{width:390,height:844}});
      page.on('dialog',dialog=>dialog.accept());
      await page.goto('/');
      const result=await page.evaluate(async mockBlobStore=>{
        // Playwright's macOS WebKit cannot prepare large IndexedDB Blob values
        // in this environment. Exercise its real codec/checksum/import pipeline
        // with a Blob-store adapter; Chromium below uses the actual IndexedDB.
        if(mockBlobStore) {
          const blobs=new Map();
          window.v6Blob=async(method,key,value)=>{
            if(method==='put'){blobs.set(key,value);return key;}
            if(method==='delete'){blobs.delete(key);return;}
            return blobs.get(key);
          };
        }
        const size=12*1024*1024,data=new Uint8Array(size);data.fill(99);
        await v6Blob('put','large-restore-fixture',new Blob([data],{type:'image/png'}));
        state.projects=[{id:'large-fixture',title:'Large attachment project',notes:[],actions:[],
          library:[{id:'large-image',type:'file',title:'Large image',key:'large-restore-fixture',mime:'image/png'}],
          notePages:[{id:'large-page',title:'Image page',objects:[],strokes:[]}]}];
        if(!save(true))throw Error('Fixture save failed');
        const archive=await v74BuildCompleteBackup();
        const source=JSON.parse(await archive.text());
        state.projects=[];
        if(!save(true))throw Error('Fixture replacement failed');
        const restored=await v74ImportBackup(archive);
        const project=state.projects[0],media=await v6Blob('get',project.library[0].key);
        const restoredBytes=new Uint8Array(await media.arrayBuffer());
        const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',restoredBytes)),
          x=>x.toString(16).padStart(2,'0')).join('');
        const before=JSON.stringify(state);
        source.attachments[0].base64='*'+source.attachments[0].base64.slice(1);
        let malformedError;
        try {await v74ImportBackup(new Blob([JSON.stringify(source)],{type:'application/json'}));}
        catch(error){malformedError=error.message;}
        return {restored,title:project.title,size:restoredBytes.length,first:restoredBytes[0],last:restoredBytes.at(-1),
          digestMatches:digest===source.attachments[0].sha256,malformedError,unchanged:JSON.stringify(state)===before};
      },browserName==='webkit');
      expect(result).toEqual({restored:true,title:'Large attachment project',size:12*1024*1024,first:99,last:99,
        digestMatches:true,malformedError:'Corrupted attachment encoding',unchanged:true});
      } finally {await browser.close();}
    });
  });
}
