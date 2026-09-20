const CACHE="qr-position-v1";
const CORE=["./","./index.html","./manifest.webmanifest","./icon.svg"];
const QR="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(async cache=>{
    await cache.addAll(CORE);
    try{const r=await fetch(QR,{mode:"cors"});if(r.ok)await cache.put(QR,r);}catch(e){}
    self.skipWaiting();
  }));
});
self.addEventListener("activate",event=>event.waitUntil(self.clients.claim()));
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  event.respondWith(caches.match(event.request).then(cached=>{
    if(cached)return cached;
    return fetch(event.request).then(resp=>{
      if(resp.ok){
        const u=new URL(event.request.url);
        if(u.origin===location.origin||u.href===QR){const copy=resp.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));}
      }
      return resp;
    }).catch(()=>caches.match("./index.html"));
  }));
});