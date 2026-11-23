'use strict';
const {test,expect}=require('@playwright/test');
const {submitSheet}=require('./sheet-helper.cjs');
for(const viewport of [{width:375,height:720},{width:1180,height:800}]){
  test(`image viewer fits, zooms and shares the original at ${viewport.width}px`,async({page})=>{
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.locator('[data-tab="brainstorm"]').click();
    await page.locator('#newProject').click();
    await submitSheet(page,'Viewer test');
    await page.evaluate(async()=>{
      const canvas=document.createElement('canvas');canvas.width=500;canvas.height=1600;
      const ctx=canvas.getContext('2d');ctx.fillStyle='#09c';ctx.fillRect(0,0,500,1600);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
      await v6Blob('put','viewer-test-image',blob);
      v6Project().library.push({id:'viewer-image',type:'file',key:'viewer-test-image',mime:'image/png',title:'Tall note'});
      await v6ViewImage('viewer-image');
    });
    const image=page.locator('#v6ImageFull'),body=page.locator('.v6-image-viewer-body');
    await expect(image).toBeVisible();
    await expect.poll(()=>image.evaluate(el=>el.naturalHeight)).toBe(1600);
    const initial=await image.boundingBox(),container=await body.boundingBox();
    expect(initial.width).toBeLessThanOrEqual(container.width+1);
    expect(initial.height).toBeLessThanOrEqual(container.height+1);
    await image.click();
    await expect(page.locator('#v6ImageViewer')).toBeVisible();
    await page.locator('#v6ImageZoomIn').click();
    expect((await image.boundingBox()).height).toBeGreaterThan(initial.height*1.4);
    await page.locator('#v6ImageZoomReset').click();
    expect((await image.boundingBox()).height).toBeCloseTo(initial.height,0);
    await page.evaluate(()=>{
      Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});
      Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.sharedImage={size:data.files[0].size,type:data.files[0].type};}});
    });
    await page.locator('#v6ImageDownload').click();
    expect(await page.evaluate(()=>window.sharedImage.type)).toBe('image/png');
    expect(await page.evaluate(()=>window.sharedImage.size)).toBeGreaterThan(100);
    await page.locator('#v6CloseImage').click();
    await expect(page.locator('#v6ImageViewer')).toBeHidden();
  });
}
