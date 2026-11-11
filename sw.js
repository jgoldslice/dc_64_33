/* Canvas 8.2 — cache only our own app's assets, never another site's caches. */
const CACHE='canvas-v97-manual-text-focus';
const PREFIX='canvas-';
const ASSETS=[
  './','./index.html','./manifest.webmanifest','./icon.svg',
  './v74.js','./v74.css','./polish.css','./v76.js','./v76.css',
  './v77.js','./v77.css','./polish-v81.css','./polish-v81.js',
  './polish-v82.css','./polish-v82.js','./fluid-navigation-v94.js','./fluid-navigation-v94.css','./ipad-v84.css','./ipad-v84.js','./video-v86.css','./video-v86.js','./week-events-v87.js','./week-events-v87.css','./ipad-polish-v88.css','./ipad-polish-v88.js','./device-workspace-v892.css','./device-workspace-v892.js','./pencilkit-entry-v92.js','./blueprint-notes-v93.css'
];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))
    .then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(names=>Promise.all(
    names.filter(name=>name.startsWith(PREFIX)&&name!==CACHE)
      .map(name=>caches.delete(name))
  )).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
  // Don't cache data downloads or requests from other GitHub Pages app paths.
  if(!new URL(request.url).pathname.startsWith(new URL(self.registration.scope).pathname))return;
  event.respondWith(fetch(request).then(response=>{
    if(response.ok){
      const copy=response.clone();
      caches.open(CACHE).then(cache=>cache.put(request,copy)).catch(()=>{});
    }
    return response;
  }).catch(async()=>{
    const cache=await caches.open(CACHE);
    const cached=await cache.match(request);
    if(cached)return cached;
    // A missing JS/image file is NOT an HTML document.
    if(request.mode==='navigate')return (await cache.match('./index.html'))||Response.error();
    return Response.error();
  }));
});
