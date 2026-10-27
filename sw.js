
const V='nk-10',SHELL=["/no/", "/", "/de/", "/zh/", "/no/takk/", "/thanks/", "/de/danke/", "/zh/thanks/", "/no/mine/", "/my/", "/de/meine/", "/zh/my/", "/dash.js?v=10", "/style.css?v=10", "/app.js?v=10", "/favicon.svg", "/icons/icon-192.png", "/img/cross-country-skis.webp", "/img/snowshoes.webp", "/img/touring-skis.webp"];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
function netFirst(req){return fetch(req).then(r=>{if(r&&r.ok){const c=r.clone();caches.open(V).then(x=>x.put(req,c))}return r}).catch(()=>caches.match(req,{ignoreSearch:true}).then(r=>r||caches.match('/')))}
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);
  if(u.origin===location.origin){
    if(r.mode==='navigate'||u.pathname==='/listings.json'){e.respondWith(netFirst(r));return}
    e.respondWith(caches.match(r).then(c=>c||fetch(r).then(res=>{if(res.ok){const cl=res.clone();caches.open(V).then(x=>x.put(r,cl))}return res})));return}
  if(u.hostname==='unpkg.com'){e.respondWith(caches.match(r).then(c=>c||fetch(r).then(res=>{const cl=res.clone();caches.open(V).then(x=>x.put(r,cl));return res})))}
});
/* ---------- Web Push (owner alerts). Payload: {title, body, url, tag}; no personal data. ---------- */
self.addEventListener('push',e=>{let d={};try{d=e.data?e.data.json():{}}catch(_){d={body:e.data&&e.data.text()}}
  const title=d.title||'NordKiln',url=d.url||'/no/mine/';
  e.waitUntil(Promise.all([
    self.registration.showNotification(title,{body:d.body||'',icon:'/icons/icon-192.png',badge:'/icons/icon-192.png',tag:d.tag||'nk',renotify:true,data:{url}}),
    self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>cs.forEach(c=>c.postMessage({type:'nk-push',url})))]))});
self.addEventListener('notificationclick',e=>{e.notification.close();const url=new URL((e.notification.data&&e.notification.data.url)||'/no/mine/',self.location.origin).href;
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{
    for(const c of cs){const u=new URL(c.url);if(u.origin===self.location.origin&&u.pathname===new URL(url).pathname&&'focus' in c){c.postMessage({type:'nk-push',url});return c.navigate?c.navigate(url).then(x=>(x||c).focus()):c.focus()}}
    return self.clients.openWindow(url)}))});
self.addEventListener('pushsubscriptionchange',e=>{/* re-subscribe happens next time the owner opens Mine annonser */});
