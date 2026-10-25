
const V='nk-4',SHELL=["/no/", "/", "/de/", "/zh/", "/no/takk/", "/thanks/", "/de/danke/", "/zh/thanks/", "/style.css?v=4", "/app.js?v=4", "/favicon.svg", "/icons/icon-192.png", "/img/cross-country-skis.webp", "/img/snowshoes.webp", "/img/touring-skis.webp"];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
function netFirst(req){return fetch(req).then(r=>{if(r&&r.ok){const c=r.clone();caches.open(V).then(x=>x.put(req,c))}return r}).catch(()=>caches.match(req,{ignoreSearch:true}).then(r=>r||caches.match('/')))}
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);
  if(u.origin===location.origin){
    if(r.mode==='navigate'||u.pathname==='/listings.json'){e.respondWith(netFirst(r));return}
    e.respondWith(caches.match(r).then(c=>c||fetch(r).then(res=>{if(res.ok){const cl=res.clone();caches.open(V).then(x=>x.put(r,cl))}return res})));return}
  if(u.hostname==='unpkg.com'){e.respondWith(caches.match(r).then(c=>c||fetch(r).then(res=>{const cl=res.clone();caches.open(V).then(x=>x.put(r,cl));return res})))}
});
