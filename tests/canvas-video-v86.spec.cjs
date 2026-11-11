const {test,expect}=require('@playwright/test');
const base='http://127.0.0.1:8765/';
const youtube='https://youtube.com/shorts/QaB8oahyId8?si=cMzjaXARf1amSDiH';
const thumb='https://i.ytimg.com/vi/QaB8oahyId8/hqdefault.jpg';
test.use({browserName:'chromium',viewport:{width:390,height:844},isMobile:true,hasTouch:true});

async function setup(page){
  await page.route('https://i.ytimg.com/**',route=>route.fulfill({
    status:200,contentType:'image/png',
    body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLytQAAAABJRU5ErkJggg==','base64')
  }));
  await page.route('https://www.youtube-nocookie.com/**',route=>route.fulfill({
    status:200,contentType:'text/html',body:'<!doctype html><title>Mock player</title>'
  }));
  await page.goto(base);
  await page.locator('[data-tab="brainstorm"]').click();
  page.once('dialog',d=>d.accept('Video Link Test'));
  await page.locator('#newProject').click();
  await expect(page.locator('#projectWorkspace')).toBeVisible();
  await page.locator('[data-v919-project-open="library"]').click();
  await expect(page.locator('#projectLibrary')).toBeVisible();
}

test('existing YouTube Shorts links become thumbnail cards with click-to-play, without touching saved data',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await setup(page);
  const values=await page.evaluate(url=>{
    const project=v6Project();
    project.library.push({id:'existing-short',type:'link',url,title:url,created:'2026-11-06'});
    if(!save())throw Error('Failed to save fixture');
    v6RenderLibrary(project);
    return {url:project.library[0].url,title:project.library[0].title};
  },youtube);
  expect(values.url).toBe(youtube);
  const card=page.locator('[data-v86-video-id="existing-short"]');
  await expect(card).toBeVisible();
  await expect(card.locator('.v86-video-title')).toHaveText('YouTube Short');
  await expect(card.locator('.v86-video-thumb')).toHaveAttribute('src',thumb);
  await expect(card.locator('.v86-video-play-symbol')).toHaveText('▶');
  await expect(card.locator('iframe')).toHaveCount(0);
  await card.locator('[data-v86-play]').click();
  await expect(card.locator('iframe')).toHaveAttribute('src',
    'https://www.youtube-nocookie.com/embed/QaB8oahyId8?autoplay=1&playsinline=1&rel=0');
  expect(await page.evaluate(()=>v6Project().library[0].url)).toBe(youtube);
  await page.locator('[data-library-view="list"]').click();
  await expect(page.locator('#projectLibraryList')).toHaveClass(/v74-library-list/);
  await expect(card.locator('iframe')).toHaveCount(0);
  await expect(card.locator('[data-v86-play]')).toBeVisible();
  await page.reload();
  await page.locator('[data-tab="brainstorm"]').click();
  await page.locator('[data-v6-project]').filter({hasText:'Video Link Test'}).click();
  await page.locator('[data-v919-project-open="library"]').click();
  await expect(page.locator('[data-v86-video-id="existing-short"]')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Add Link uses a short human-friendly default title for YouTube Shorts',async({page})=>{
  await setup(page);
  await page.locator('#libraryAddToggle').click();
  let index=0;
  page.on('dialog',d=>{
    index++;
    if(index===1) d.accept(youtube);
    else if(index===2){
      expect(d.defaultValue()).toBe('YouTube Short');
      d.accept();
    }else d.dismiss();
  });
  await page.locator('[data-library-add="link"]').click();
  await expect(page.locator('.v86-video-card')).toHaveCount(1);
  const data=await page.evaluate(()=>v6Project().library[0]);
  expect(data.type).toBe('link');
  expect(data.url).toBe(youtube);
  expect(data.title).toBe('YouTube Short');
});

test('recognizes YouTube watch, youtu.be and Shorts links, not lookalike or unsupported domains',async({page})=>{
  await setup(page);
  const validated=await page.evaluate(()=>{
    const parse=window.canvasVideoLink.parse;
    return [
      parse('https://www.youtube.com/watch?v=M7lc1UVf-VE'),
      parse('https://youtu.be/M7lc1UVf-VE?t=3'),
      parse('https://m.youtube.com/shorts/QaB8oahyId8'),
      parse('https://youtube.com.evil.example/watch?v=M7lc1UVf-VE'),
      parse('https://www.youtube.com/watch?v=bad'),
      parse('javascript:alert(1)'),
      parse('https://vimeo.com/12345')
    ].map(x=>x?{id:x.id,kind:x.kind}:null);
  });
  expect(validated).toEqual([
    {id:'M7lc1UVf-VE',kind:'Video'},
    {id:'M7lc1UVf-VE',kind:'Video'},
    {id:'QaB8oahyId8',kind:'Short'},
    null,null,null,null
  ]);
  await page.evaluate(()=>{
    const project=v6Project();
    project.library.push({id:'ordinary',type:'link',title:'Minecraft build',url:'https://example.com/minecraft'},
      {id:'fake',type:'link',title:'Fake',url:'https://youtube.com.evil.example/watch?v=M7lc1UVf-VE'});
    save();v6RenderLibrary(project);
  });
  await expect(page.locator('.v86-video-card')).toHaveCount(0);
  await expect(page.locator('[data-v6-open-resource="ordinary"]')).toBeVisible();
  await expect(page.locator('[data-v6-open-resource="fake"]')).toBeVisible();
});

test('video preview has an original-link action and remains readable on wider screens',async({page})=>{
  await setup(page);
  await page.evaluate(url=>{
    const project=v6Project();
    project.library.push({id:'video-a',type:'link',url,title:'Narrow vertical windows'});
    save();v6RenderLibrary(project);
  },youtube);
  const card=page.locator('[data-v86-video-id="video-a"]');
  await expect(card.locator('.v86-video-title')).toHaveText('Narrow vertical windows');
  await expect(card.locator('[data-v6-open-resource="video-a"]')).toBeVisible();
  await expect(card.locator('[data-v6-delete-resource="video-a"]')).toHaveAttribute('aria-label','Remove video link: Narrow vertical windows');
  await page.setViewportSize({width:1024,height:768});
  await expect(card).toBeVisible();
  const rect=await card.boundingBox();
  expect(rect.width).toBeGreaterThan(200);
  await expect(card.locator('.v86-video-thumb')).toBeVisible();
});

test('offline cache includes preview script and style without trying to cache YouTube',async({request})=>{
  const res=await request.get(base+'sw.js');
  expect(res.ok()).toBe(true);
  const worker=await res.text();
  expect(worker).toContain('video-v86.js');
  expect(worker).toContain('video-v86.css');
  expect(worker).not.toContain('i.ytimg.com');
  expect(worker).not.toContain('youtube-nocookie.com');
});
