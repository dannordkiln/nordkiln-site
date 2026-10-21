(function(){
var NK=window.NK,S=NK.s,LG=NK.lang,LF=window.L;
function fmt(n){return new Intl.NumberFormat(LG==='no'?'nb-NO':(LG==='de'?'de-DE':'en-GB')).format(Math.round(n))}
function fee(sub){return Math.max(NK.feeMin,Math.round(sub*NK.fee/100))}
function t(o){if(!o)return'';if(typeof o==='string')return o;return o[LG]||o.en||o.no||''}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
var listings=[],cat=NK.cat||'all',map,layer;
function priceHtml(x){return x.price_per_day?('<div class="price">'+fmt(x.price_per_day)+' <small>'+S.per_day+'</small></div><div class="small">'+S.fee_short+' (min. '+NK.feeMin+' kr)</div>'):'<div class="price"><small>'+S.price_ask+'</small></div>'}
function card(x){
  var c=x.photo_credit,cr=c?(' · <a href="'+esc(c.source)+'" target="_blank" rel="noopener">'+esc(c.author)+', '+esc(c.license)+'</a>'):'';
  var img=x.photo?('<figure><img src="'+esc(x.photo)+'" alt="'+esc(t(x.title))+(x.photo_illustration?' ('+S.illus+')':'')+'" loading="lazy" width="800" height="600">'+(x.photo_illustration?'<figcaption>'+S.illus+cr+'</figcaption>':'')+'</figure>'):'';
  var tags=[];if(x.pickup)tags.push(S.pickup);if(x.delivery)tags.push(S.delivery);if(x.size)tags.push(S.size+': '+esc(x.size));
  tags.push(S.deposit+': '+(x.deposit?fmt(x.deposit)+' kr':S.deposit_none));
  return '<article class="card" id="l-'+esc(x.id)+'">'+img+'<div class="b"><h3>'+esc(t(x.title))+'</h3><p class="meta">📍 '+esc(x.place)+' · '+NK.cats[x.category]+'</p>'+priceHtml(x)+'<p class="meta">'+esc(t(x.description))+'</p><div class="tags">'+tags.map(function(g){return'<span class="tag">'+g+'</span>'}).join('')+'</div><a class="btn teal sm" href="#request" data-item="'+esc(x.id)+'">'+S.request_btn+'</a></div></article>';
}
function render(){
  var box=document.getElementById('cards');
  var sel=listings.filter(function(x){return cat==='all'||x.category===cat});
  if(box){
    if(!listings.length){box.innerHTML='<div class="empty" style="grid-column:1/-1"><h3>'+S.empty_h+'</h3><p>'+S.empty_p+'</p><a class="btn sm" href="#request">'+S.need_h+'</a> <a class="btn teal sm" href="'+NK.ownersUrl+'">'+S.hero_cta2+'</a></div>';}
    else if(!sel.length){box.innerHTML='<div class="empty" style="grid-column:1/-1"><p>'+S.empty_cat+'</p><a class="btn sm" href="#request">'+S.need_h+'</a></div>';}
    else box.innerHTML=sel.map(card).join('');
  }
  if(layer){layer.clearLayers();var g={};
    sel.forEach(function(x){if(x.lat==null||x.lng==null)return;var k=x.lat.toFixed(3)+','+x.lng.toFixed(3);(g[k]=g[k]||[]).push(x)});
    Object.keys(g).forEach(function(k){var xs=g[k],p=xs[0];
      var m=LF.circleMarker([p.lat,p.lng],{radius:9+Math.min(xs.length,5),color:'#0a5f67',weight:3,fillColor:'#0e7c86',fillOpacity:.85});
      var h='<div class="pop"><b>📍 '+esc(p.place)+'</b>'+xs.map(function(x){return'<div style="margin-top:6px"><b>'+esc(t(x.title))+'</b><br>'+(x.price_per_day?fmt(x.price_per_day)+' '+S.per_day+' '+S.fee_short:S.price_ask)+'<br>'+[x.pickup?S.pickup:'',x.delivery?S.delivery:''].filter(Boolean).join(' · ')+'<br><a href="#request" data-item="'+esc(x.id)+'">'+S.request_btn+' →</a></div>'}).join('')+'</div>';
      m.bindPopup(h);if(xs.length>1)m.bindTooltip(String(xs.length),{permanent:true,direction:'center',className:'cnt'});layer.addLayer(m);});
  }
}
function initMap(){
  var el=document.getElementById('map');if(!el||!LF)return;
  map=LF.map(el,{scrollWheelZoom:false});
  LF.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:17,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
  var area=[[67.75,12.6],[68.45,12.5],[69.25,15.4],[70.05,18.2],[70.3,21.2],[69.65,22.2],[68.95,20.4],[68.4,17.6],[67.95,15.2]];
  LF.polygon(area,{color:'#0e7c86',weight:2,dashArray:'6 6',fillColor:'#0e7c86',fillOpacity:.06,interactive:false}).addTo(map);
  map.fitBounds(LF.latLngBounds(area),{padding:[6,6]});
  layer=LF.layerGroup().addTo(map);
}
function fillSelect(){
  var s=document.getElementById('r-item');if(!s)return;
  listings.forEach(function(x){var o=document.createElement('option');o.value=t(x.title)+' ['+x.id+']';o.textContent=t(x.title)+(x.price_per_day?' – '+fmt(x.price_per_day)+' '+S.per_day:'');o.setAttribute('data-id',x.id);o.setAttribute('data-price',x.price_per_day||'');o.setAttribute('data-cat',x.category);s.insertBefore(o,s.lastElementChild)});
  if(!listings.length){s.parentNode.style.display='none'}
}
function pick(id){var s=document.getElementById('r-item');if(!s)return;for(var i=0;i<s.options.length;i++){if(s.options[i].getAttribute('data-id')===id){s.selectedIndex=i;var rc=document.getElementById('r-cat');if(rc)rc.value=s.options[i].getAttribute('data-cat');break}}est();}
function est(){
  var s=document.getElementById('r-item'),a=document.getElementById('r-from'),b=document.getElementById('r-to'),o=document.getElementById('r-est'),h=document.getElementById('r-esth');if(!s||!o)return;
  var op=s.options[s.selectedIndex],p=op?+(op.getAttribute('data-price')||0):0;
  if(!p||!a.value||!b.value){o.className='full est';if(h)h.value='';return}
  var d=Math.max(1,Math.round((new Date(b.value)-new Date(a.value))/864e5));var sub=p*d,f=fee(sub);
  o.innerHTML='<b>'+S.est_label+':</b> '+d+' '+S.est_days+' × '+fmt(p)+' kr = '+fmt(sub)+' kr + '+S.est_fee+' '+fmt(f)+' kr = <b>'+fmt(sub+f)+' kr '+S.est_total+'</b><br><span class="small">'+S.est_note+'</span>';o.className='full est on';
  if(h)h.value=(sub+f)+' NOK = '+d+' x '+p+' + fee '+f;
}
document.addEventListener('click',function(ev){
  var a=ev.target.closest('[data-item]');if(a){pick(a.getAttribute('data-item'))}
  var c=ev.target.closest('.chip');if(c){cat=c.getAttribute('data-cat');document.querySelectorAll('.chip').forEach(function(x){x.classList.toggle('on',x===c)});render();var rc=document.getElementById('r-cat');if(rc&&cat!=='all')rc.value=cat;}
  var lg=ev.target.closest('.lang a');if(lg){try{localStorage.setItem('nk_lang',lg.getAttribute('data-l'))}catch(e){}}
});
['r-item','r-from','r-to'].forEach(function(i){var x=document.getElementById(i);if(x)x.addEventListener('change',est)});
var fr=document.getElementById('r-from'),to=document.getElementById('r-to'),today=new Date().toISOString().slice(0,10);
if(fr){fr.min=today;fr.addEventListener('change',function(){to.min=fr.value;if(to.value&&to.value<fr.value)to.value=fr.value})}if(to)to.min=today;
initMap();
if(document.getElementById('cards')||document.getElementById('r-item')){
  fetch('/listings.json',{cache:'no-cache'}).then(function(r){return r.json()}).then(function(d){listings=d.listings||[];fillSelect();render();}).catch(function(){render()});
}
})();