const CACHE='restorapp-shell-v5';
const CORE=['./','./manifest.webmanifest','./restorapp-icon.svg'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).catch(()=>null));
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('message',event=>{
  if(event.data&&event.data.type==='SKIP_WAITING')self.skipWaiting();
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;

  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;

  if(req.mode==='navigate'){
    event.respondWith(
      fetch(req,{cache:'no-store'})
        .then(res=>{
          if(res.ok){
            const clone=res.clone();
            caches.open(CACHE).then(cache=>cache.put('./',clone));
          }
          return res;
        })
        .catch(()=>caches.match('./'))
    );
    return;
  }

  const isHashedAsset=url.pathname.includes('/assets/');
  if(isHashedAsset){
    event.respondWith(
      caches.match(req).then(cached=>{
        if(cached)return cached;
        return fetch(req).then(res=>{
          if(res.ok){
            const clone=res.clone();
            caches.open(CACHE).then(cache=>cache.put(req,clone));
          }
          return res;
        });
      })
    );
    return;
  }

  event.respondWith(
    fetch(req,{cache:'no-cache'})
      .then(res=>{
        if(res.ok){
          const clone=res.clone();
          caches.open(CACHE).then(cache=>cache.put(req,clone));
        }
        return res;
      })
      .catch(()=>caches.match(req))
  );
});
