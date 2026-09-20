const CACHE="qr-position-v4";
const CORE=["./","./index.html","./manifest.webmanifest","./icon.svg","./qrcode.min.js"];

self.addEventListener("install",event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(CORE))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(
      keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))
    )).then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;

  if(event.request.mode==="navigate"){
    event.respondWith(
      fetch(event.request)
        .then(resp=>{
          if(resp.ok){
            const copy=resp.clone();
            caches.open(CACHE).then(cache=>cache.put("./index.html",copy));
          }
          return resp;
        })
        .catch(()=>caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached=>{
      if(cached)return cached;
      return fetch(event.request).then(resp=>{
        if(resp.ok){
          const copy=resp.clone();
          caches.open(CACHE).then(cache=>cache.put(event.request,copy));
        }
        return resp;
      });
    })
  );
});