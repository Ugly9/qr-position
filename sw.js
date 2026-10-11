const CACHE="qr-position-v38";
const CORE=["./","./index.html","./manifest.webmanifest","./icon.svg","./qrcode.min.js","./volne-data.js","./qr-sync.js","./qr-working-guard.js"];

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

function isLayoutTask(url){
  return url.pathname.includes("/layouttask/");
}

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;

  // LayoutTask must always be served directly from GitHub Pages.
  // Never let the QR Position service worker cache or replace it.
  if(isLayoutTask(new URL(event.request.url)))return;

  if(event.request.mode==="navigate"){
    event.respondWith(
      fetch(event.request, {cache:"no-cache"})
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

  // Always fetch application scripts/styles from the network first. A stale
  // cached JavaScript file can make the UI disagree with confirmed server data.
  if (/\.(js|css)$/.test(new URL(event.request.url).pathname)) {
    event.respondWith(
      fetch(event.request, {cache:"no-cache"})
        .then(resp => {
          if (resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE).then(cache => cache.put(event.request, copy));
          }
          return resp;
        })
        .catch(() => caches.match(event.request))
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