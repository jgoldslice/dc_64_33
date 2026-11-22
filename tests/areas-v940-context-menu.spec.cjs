const {submitSheet}=require('./sheet-helper.cjs');
const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';
async function openAreas(page){
  await page.goto(base);
  await page.locator('.bottom-nav button[data-tab="myplan"]').click();
  await expect(page.locator('#bpAreasRoot [data-bpa-new]')).toBeVisible();
  await expect(page.locator('#bpAreasRoot .bp-areas-header h1')).toHaveCount(0);
}
test('Area cards open normally, but right-click opens a rename/delete context menu',async({page})=>{
  await openAreas(page);
  await expect(page.locator('[data-bpa-manage],.bp-area-manager')).toHaveCount(0);
  const tile=page.locator('[data-bpa-open="Personal"]');
  await tile.click({button:'right'});
  const menu=page.getByRole('dialog',{name:'Options for Personal'});
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('button')).toHaveText(['Icon & color','Rename','Delete','Cancel']);
  await expect(page.locator('.bp-area-detail-title h1')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await tile.click();
  await expect(page.locator('.bp-area-detail-title h1')).toHaveText('Personal');
});
test('Touch long-press opens menu and suppresses the subsequent card click',async({page})=>{
  await openAreas(page);
  await page.evaluate(()=>{
    const tile=document.querySelector('[data-bpa-open="Research"]');
    tile.dispatchEvent(new PointerEvent('pointerdown',{
      bubbles:true,pointerId:13,pointerType:'touch',button:0,
      isPrimary:true,clientX:110,clientY:220
    }));
  });
  await expect(page.getByRole('dialog',{name:'Options for Research'})).toBeVisible({timeout:2500});
  await page.evaluate(()=>{
    const tile=document.querySelector('[data-bpa-open="Research"]');
    tile.dispatchEvent(new PointerEvent('pointerup',{
      bubbles:true,pointerId:13,pointerType:'touch',button:0,
      isPrimary:true,clientX:110,clientY:220
    }));
    tile.click();
  });
  await expect(page.locator('.bp-area-detail-title h1')).toHaveCount(0);
  await expect(page.getByRole('dialog',{name:'Options for Research'})).toBeVisible();
  await page.getByRole('button',{name:'Cancel'}).click();
  await expect(page.getByRole('dialog',{name:'Options for Research'})).toHaveCount(0);
});
test('A moving finger cancels long press, and keyboard opens the accessible menu',async({page})=>{
  await openAreas(page);
  await page.evaluate(()=>{
    const tile=document.querySelector('[data-bpa-open="Physical"]');
    const input=(type,x,y)=>tile.dispatchEvent(new PointerEvent(type,{
      bubbles:true,pointerId:10,pointerType:'touch',button:0,
      isPrimary:true,clientX:x,clientY:y
    }));
    input('pointerdown',100,200);
    input('pointermove',100,245);
  });
  await page.waitForTimeout(650);
  await expect(page.locator('.bp-area-context-menu')).toHaveCount(0);
  await page.locator('[data-bpa-open="Physical"]').focus();
  await page.keyboard.press('Shift+F10');
  await expect(page.getByRole('dialog',{name:'Options for Physical'})).toBeVisible();
});
test('Rename preserves goal links; Delete refuses an Area with content',async({page})=>{
  await openAreas(page);
  await page.locator('[data-bpa-open="Research"]').click({button:'right'});
  await page.getByRole('dialog',{name:'Options for Research'}).getByRole('button',{name:'Rename'}).click();
  await submitSheet(page, 'Research Lab');
  await expect(page.locator('[data-bpa-open="Research Lab"]')).toBeVisible();
  await page.locator('[data-bpa-open="Research Lab"]').click();
  await expect(page.locator('.bp-area-goal summary')).toContainText('Finish research manuscript');
  await page.locator('[data-bpa-back]').click();
  await page.locator('[data-bpa-open="Research Lab"]').click({button:'right'});
  const alerts=[];
  page.once('dialog',dialog=>{
    alerts.push(dialog.message());
    return dialog.accept();
  });
  await page.getByRole('dialog',{name:'Options for Research Lab'}).getByRole('button',{name:'Delete'}).click();
  expect(alerts).toHaveLength(1);
  expect(alerts[0]).toContain('Move the items out of this Area first');
  await expect(page.locator('[data-bpa-open="Research Lab"]')).toBeVisible();
});
test('Deleting an empty Area requires confirmation, leaves other Areas intact',async({page})=>{
  await openAreas(page);
  await page.locator('[data-bpa-new]').click();
  await submitSheet(page, 'Temporary');
  await page.locator('[data-bpa-back]').click();
  await expect(page.locator('[data-bpa-open="Temporary"]')).toBeVisible();
  await page.locator('[data-bpa-open="Temporary"]').click({button:'right'});
  await page.getByRole('dialog',{name:'Options for Temporary'}).getByRole('button',{name:'Delete'}).click();
  await submitSheet(page);
  await expect(page.locator('[data-bpa-open="Temporary"]')).toHaveCount(0);
  await expect(page.locator('[data-bpa-open="Research"]')).toBeVisible();
});
