'use strict';
/* Canvas 8.6: YouTube link cards in Project Library.
   A saved link is still only a link, so backups and cross-version imports
   keep exactly the same data. External playback loads only after a tap. */
(function(){
  if(typeof v6RenderLibrary!=='function')return;
  const oldRender=v6RenderLibrary;
  const YOUTUBE_ID=/^[A-Za-z0-9_-]{11}$/;
  function parseVideoLink(value){
    let url;
    try{url=new URL(String(value||''));}catch{return null;}
    if(!['https:','http:'].includes(url.protocol)||url.username||url.password)return null;
    const host=url.hostname.toLowerCase();
    const path=url.pathname.split('/').filter(Boolean);
    let id='',kind='Video';
    if(host==='youtu.be'||host==='www.youtu.be'){
      id=path.length===1?path[0]:'';
    }else if(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com'].includes(host)){
      if(url.pathname==='/watch')id=url.searchParams.get('v')||'';
      else if(path.length===2&&['shorts','embed','live'].includes(path[0])){
        id=path[1];
        if(path[0]==='shorts')kind='Short';
      }
    }else return null;
    if(!YOUTUBE_ID.test(id))return null;
    return {
      id,kind,
      thumbnail:'https://i.ytimg.com/vi/'+id+'/hqdefault.jpg',
      embed:'https://www.youtube-nocookie.com/embed/'+id+'?autoplay=1&playsinline=1&rel=0'
    };
  }
  // Exposed only for the existing "Add Link" prompt and deterministic tests.
  window.canvasVideoLink={
    parse:parseVideoLink,
    label:value=>{const info=parseVideoLink(value);return info?'YouTube '+info.kind:null;}
  };
  const root=document.getElementById('projectLibraryList');
  if(!root)return;
  function makeElement(tag,className,text){
    const el=document.createElement(tag);
    if(className)el.className=className;
    if(text!==undefined)el.textContent=text;
    return el;
  }
  function makeVideoCard(resource,video){
    const card=makeElement('article','v86-video-card');
    card.dataset.v86VideoId=String(resource.id);

    const media=makeElement('div','v86-video-media');
    const trigger=makeElement('button','v86-video-trigger');
    trigger.type='button';
    trigger.dataset.v86Play=String(resource.id);
    trigger.setAttribute('aria-label','Play '+(resource.title&&resource.title!==resource.url&& !/^https?:\/\//i.test(resource.title)?resource.title:'YouTube '+video.kind));
    const img=makeElement('img','v86-video-thumb');
    img.loading='lazy';
    img.alt='';
    img.referrerPolicy='no-referrer';
    img.src=video.thumbnail;
    img.addEventListener('error',()=>{img.hidden=true;trigger.classList.add('v86-video-no-thumbnail');},{once:true});
    const badge=makeElement('span','v86-video-play-symbol','▶');
    badge.setAttribute('aria-hidden','true');
    trigger.append(img,badge);
    media.append(trigger);

    const info=makeElement('div','v86-video-info');
    const source=makeElement('span','v86-video-source','YouTube · '+(video.kind==='Short'?'Shorts':'Video'));
    const title=(typeof resource.title==='string'&&resource.title.trim()&&!/^https?:\/\//i.test(resource.title))
      ?resource.title.trim():'YouTube '+video.kind;
    const heading=makeElement('strong','v86-video-title',title);
    const actions=makeElement('div','v86-video-actions');
    const open=makeElement('button','text-button v86-video-open','Open on YouTube');
    open.type='button';
    open.dataset.v6OpenResource=String(resource.id);
    const remove=makeElement('button','v6-icon-btn v86-video-remove','×');
    remove.type='button';
    remove.dataset.v6DeleteResource=String(resource.id);
    remove.setAttribute('aria-label','Remove video link: '+title);
    actions.append(open,remove);
    info.append(source,heading,actions);
    card.append(media,info);
    return card;
  }
  v6RenderLibrary=function(p){
    oldRender(p);
    if(!p||!Array.isArray(p.library))return;
    for(const resource of p.library){
      if(resource.type!=='link')continue;
      const video=parseVideoLink(resource.url);
      if(!video)continue;
      const oldButton=[...root.querySelectorAll('[data-v6-open-resource]')]
        .find(b=>b.dataset.v6OpenResource===String(resource.id));
      const original=oldButton?.closest('.v6-resource');
      if(original)original.replaceWith(makeVideoCard(resource,video));
    }
  };
  // Use event delegation: library elements are regenerated on project/tab changes.
  root.addEventListener('click',event=>{
    const trigger=event.target instanceof Element?event.target.closest('[data-v86-play]'):null;
    if(!trigger||!root.contains(trigger))return;
    const resource=v6Project()?.library?.find(item=>String(item.id)===trigger.dataset.v86Play);
    const video=resource?.type==='link'?parseVideoLink(resource.url):null;
    if(!video)return;
    const parent=trigger.parentElement;
    const iframe=document.createElement('iframe');
    iframe.className='v86-video-player';
    iframe.title='YouTube '+video.kind+': '+(resource.title||'Video');
    iframe.src=video.embed;
    iframe.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';
    iframe.allowFullscreen=true;
    iframe.referrerPolicy='strict-origin-when-cross-origin';
    parent.replaceChildren(iframe);
  });
})();
