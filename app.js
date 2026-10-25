(function(){
var NK=window.NK,S=NK.s,LG=NK.lang,LF=window.L,$=function(i){return document.getElementById(i)};
var LOC={no:'nb-NO',de:'de-DE',zh:'zh-CN',en:'en-GB'}[LG]||'en-GB';
function fmt(n){return new Intl.NumberFormat(LOC).format(Math.round(n))}
function fee(sub){return Math.max(NK.feeMin,Math.round(sub*NK.fee/100))}
function t(o){if(!o)return'';if(typeof o==='string')return o;return o[LG]||o.en||o.no||o[Object.keys(o)[0]]||''}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function ls(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v)}catch(e){return null}}
var listings=[],cat=NK.cat||'all',map,layer,byId={};
var SZ={shoe:'',cloth:'',height:''};try{var _s=JSON.parse(ls('nk_size')||'{}');for(var k in SZ)if(_s[k])SZ[k]=String(_s[k])}catch(e){}
/* ---------- push (ntfy.sh, no personal data, fire-and-forget) ---------- */
function push(topic,msg){try{if(!topic||NK.api)return;var u=NK.ntfy+encodeURIComponent(topic)+'?title=NordKiln&priority=high&tags=ski&click='+encodeURIComponent(NK.domain+'/no/');
  var ok=false;if(navigator.sendBeacon){ok=navigator.sendBeacon(u,new Blob([msg],{type:'text/plain'}))}
  if(!ok&&window.fetch){fetch(u,{method:'POST',body:msg,mode:'no-cors',keepalive:true}).catch(function(){})}}catch(e){}}
function dmy(v){if(!v)return'';var p=v.split('-');return (+p[2])+'.'+(+p[1])+'.'}
function days(a,b){if(!a||!b)return 0;return Math.max(1,Math.round((new Date(b)-new Date(a))/864e5))}
/* ---------- sizes ---------- */
function rng(v){if(v==null||v==='')return null;return Array.isArray(v)?v:[v,v]}
function match(x){
  var r=rng(x.shoe_eu);if(SZ.shoe&&r&&(+SZ.shoe<r[0]||+SZ.shoe>r[1]))return false;
  if(SZ.cloth&&x.clothing_size&&x.clothing_size.length&&x.clothing_size.indexOf(SZ.cloth)<0)return false;
  var h=x.fits_height_cm;if(SZ.height&&h&&(+SZ.height<h[0]||+SZ.height>h[1]))return false;
  return true}
function szText(){var a=[];if(SZ.shoe)a.push('EU '+SZ.shoe);if(SZ.cloth)a.push(clothName(SZ.cloth));if(SZ.height)a.push(SZ.height+' cm');return a.join(', ')}
function clothName(c){return c.charAt(0)==='K'?S.sz_kids+' '+c.slice(1).replace('-','–'):c}
function sizeTags(x){var g=[],r=rng(x.shoe_eu);if(r)g.push(S.sz_shoe_tag+' '+(r[0]===r[1]?r[0]:r[0]+'–'+r[1]));
  if(x.clothing_size&&x.clothing_size.length)g.push(S.sz_cloth_tag+' '+x.clothing_size.map(clothName).join('/'));
  if(x.ski_length_cm)g.push(x.ski_length_cm+' cm');if(x.fits_height_cm)g.push(S.sz_height_tag+' '+x.fits_height_cm[0]+'–'+x.fits_height_cm[1]+' cm');return g}
function shoeHelp(){var h=$('sz-help');if(!h)return;var r=NK.shoeTable[SZ.shoe];h.textContent=r?('≈ UK '+r[0]+' · US M '+r[1]+(r[2]!=='-'?' / W '+r[2]:'')+' · CN '+r[3]):''}
function initSize(){var a=$('sz-shoe'),b=$('sz-cloth'),c=$('sz-height'),z=$('sz-reset');if(!a)return;
  a.value=SZ.shoe;b.value=SZ.cloth;c.value=SZ.height;shoeHelp();
  function upd(){SZ.shoe=a.value;SZ.cloth=b.value;SZ.height=c.value;ls('nk_size',JSON.stringify(SZ));shoeHelp();render()}
  a.addEventListener('change',upd);b.addEventListener('change',upd);c.addEventListener('input',upd);
  z.addEventListener('click',function(){a.value=b.value=c.value='';upd()})}
/* ---------- cards + map ---------- */
function priceHtml(x){return x.price_per_day?('<div class="price">'+fmt(x.price_per_day)+' <small>'+S.per_day+'</small></div><div class="small">'+S.fee_short+' (min. '+NK.feeMin+' kr)</div>'):'<div class="price"><small>'+S.price_ask+'</small></div>'}
function card(x){
  var c=x.photo_credit,cr=c?(' · <a href="'+esc(c.source)+'" target="_blank" rel="noopener">'+esc(c.author)+', '+esc(c.license)+'</a>'):'';
  var img=x.photo?('<figure><img src="'+esc(x.photo)+'" alt="'+esc(t(x.title))+(x.photo_illustration?' ('+S.illus+')':'')+'" loading="lazy" width="800" height="600">'+(x.photo_illustration?'<figcaption>'+S.illus+cr+'</figcaption>':'')+'</figure>'):'';
  var tags=sizeTags(x);if(x.pickup)tags.push(S.pickup);if(x.delivery)tags.push(S.delivery);if(x.size)tags.push(S.size+': '+esc(x.size));
  tags.push(S.deposit+': '+(x.deposit?fmt(x.deposit)+' kr':S.deposit_none));
  return '<article class="card" id="l-'+esc(x.id)+'">'+img+'<div class="b"><h3>'+esc(t(x.title))+'</h3><p class="meta">📍 '+esc(x.place)+' · '+NK.cats[x.category]+'</p>'+priceHtml(x)+'<p class="meta">'+esc(t(x.description))+'</p><div class="tags">'+tags.map(function(g){return'<span class="tag">'+g+'</span>'}).join('')+'</div><button class="btn sm rent" type="button" data-rent="'+esc(x.id)+'">'+S.rent_btn+'</button></div></article>';
}
function render(){
  var box=$('cards'),inCat=listings.filter(function(x){return cat==='all'||x.category===cat}),sel=inCat.filter(match);
  if(box){
    if(!listings.length){box.innerHTML='<div class="empty" style="grid-column:1/-1"><h3>'+S.empty_h+'</h3><p>'+S.empty_p+'</p><a class="btn sm" href="#request">'+S.need_h+'</a> <a class="btn teal sm" href="'+NK.ownersUrl+'">'+S.hero_cta2+'</a></div>';}
    else if(!inCat.length){box.innerHTML='<div class="empty" style="grid-column:1/-1"><p>'+S.empty_cat+'</p><a class="btn sm" href="#request" data-need="1">'+S.need_h+'</a></div>';}
    else if(!sel.length){box.innerHTML='<div class="empty" style="grid-column:1/-1"><h3>'+S.sz_nomatch+'</h3><p>'+esc(szText())+'</p><a class="btn sm" href="#request" data-need="1">'+S.sz_tell+'</a></div>';}
    else box.innerHTML=sel.map(card).join('');
  }
  if(layer){layer.clearLayers();var g={};
    sel.forEach(function(x){if(x.lat==null||x.lng==null)return;var k=x.lat.toFixed(3)+','+x.lng.toFixed(3);(g[k]=g[k]||[]).push(x)});
    Object.keys(g).forEach(function(k){var xs=g[k],p=xs[0];
      var m=LF.circleMarker([p.lat,p.lng],{radius:9+Math.min(xs.length,5),color:'#0a5f67',weight:3,fillColor:'#0e7c86',fillOpacity:.85});
      m.bindPopup('<div class="pop"><b>📍 '+esc(p.place)+'</b>'+xs.map(function(x){return'<div style="margin-top:6px"><b>'+esc(t(x.title))+'</b><br>'+(x.price_per_day?fmt(x.price_per_day)+' '+S.per_day+' '+S.fee_short:S.price_ask)+'<br><a href="#" data-rent="'+esc(x.id)+'">'+S.rent_btn+' →</a></div>'}).join('')+'</div>');
      if(xs.length>1)m.bindTooltip(String(xs.length),{permanent:true,direction:'center',className:'cnt'});layer.addLayer(m);});
  }
}
function initMap(){var el=$('map');if(!el||!LF)return;
  map=LF.map(el,{scrollWheelZoom:false});
  LF.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:17,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
  var area=[[67.75,12.6],[68.45,12.5],[69.25,15.4],[70.05,18.2],[70.3,21.2],[69.65,22.2],[68.95,20.4],[68.4,17.6],[67.95,15.2]];
  LF.polygon(area,{color:'#0e7c86',weight:2,dashArray:'6 6',fillColor:'#0e7c86',fillOpacity:.06,interactive:false}).addTo(map);
  map.fitBounds(LF.latLngBounds(area),{padding:[6,6]});layer=LF.layerGroup().addTo(map)}
/* ---------- general request form ---------- */
function fillSelect(){var s=$('r-item');if(!s)return;
  listings.forEach(function(x){var o=document.createElement('option');o.value=t(x.title)+' ['+x.id+']';o.textContent=t(x.title)+(x.price_per_day?' – '+fmt(x.price_per_day)+' '+S.per_day:'');o.setAttribute('data-id',x.id);o.setAttribute('data-price',x.price_per_day||'');o.setAttribute('data-cat',x.category);s.insertBefore(o,s.lastElementChild)});
  if(!listings.length){s.parentNode.style.display='none'}}
function est(){var s=$('r-item'),a=$('r-from'),b=$('r-to'),o=$('r-est'),h=$('r-esth');if(!s||!o)return;
  var op=s.options[s.selectedIndex],p=op?+(op.getAttribute('data-price')||0):0;
  if(!p||!a.value||!b.value){o.className='full est';if(h)h.value='';return}
  var d=days(a.value,b.value),sub=p*d,f=fee(sub);
  o.innerHTML='<b>'+S.est_label+':</b> '+d+' '+S.est_days+' × '+fmt(p)+' kr = '+fmt(sub)+' kr + '+S.est_fee+' '+fmt(f)+' kr = <b>'+fmt(sub+f)+' kr '+S.est_total+'</b><br><span class="small">'+S.est_note+'</span>';o.className='full est on';
  if(h)h.value=(sub+f)+' NOK = '+d+' x '+p+' + fee '+f}
function prefillNeed(){var w=$('r-what'),c=$('r-cat'),s=$('r-item');if(s)s.selectedIndex=s.options.length-1;if(w&&szText())w.value=(w.value?w.value+'; ':'')+szText();if(c&&cat!=='all')c.value=cat;est()}
/* ---------- rent sheet ---------- */
var cur=null,dlg=$('rent');
function fx(n){var r=NK.fx;return S.m_ca+' €'+fmt(n/r.EUR)+' · $'+fmt(n/r.USD)+' · ¥'+fmt(n/r.CNY)}
function rcalc(){if(!cur)return;var a=$('m-from').value,b=$('m-to').value,o=$('m-total'),d=days(a,b),p=cur.price_per_day||0;
  $('m-days').textContent=d?('= '+d+' '+S.m_days):'';
  if(!d||!p){o.innerHTML='<span class="small">'+S.fee_short+' (min. '+NK.feeMin+' kr)</span>';$('m-esth').value='';return}
  var sub=p*d,f=fee(sub),tot=sub+f;
  o.innerHTML='<div class="row"><span>'+S.m_rent+': '+d+' × '+fmt(p)+' kr</span><span>'+fmt(sub)+' kr</span></div><div class="row"><span>'+S.est_fee+' ('+NK.fee+' %, min. '+NK.feeMin+' kr)</span><span>'+fmt(f)+' kr</span></div><div class="row tot"><span>'+S.m_total+'</span><span>'+fmt(tot)+' kr</span></div><div class="small">'+fx(tot)+'</div>';
  $('m-esth').value=tot+' NOK = '+d+' x '+p+' + fee '+f;$('m-daysh').value=d}
function openRent(id){var x=byId[id];if(!x||!dlg)return;cur=x;
  $('m-h').textContent=t(x.title);$('m-sub').textContent=(x.price_per_day?fmt(x.price_per_day)+' '+S.per_day+' · ':'')+'📍 '+x.place;
  $('m-item').value=t(x.title)+' ['+x.id+']';$('m-id').value=x.id;
  var r=rng(x.shoe_eu);$('m-size').value=szText()||(r?'EU '+(r[0]===r[1]?r[0]:r[0]+'–'+r[1]):'');
  $('m-deliv').parentNode.style.display=x.delivery?'':'none';if(!x.delivery){$('m-pick').checked=true}
  togAddr();rcalc();t0=Date.now();var me=$('m-err');if(me)me.hidden=true;
  if(dlg.showModal){dlg.showModal()}else{dlg.setAttribute('open','')}
  setTimeout(function(){if(!$('m-from').value)$('m-from').focus()},50)}
function togAddr(){var d=$('m-deliv').checked,w=$('m-addrw');w.style.display=d?'':'none';$('m-addr').required=d}
function closeRent(){if(dlg.close)dlg.close();else dlg.removeAttribute('open')}
if(dlg){
  $('m-x').addEventListener('click',closeRent);
  dlg.addEventListener('click',function(e){if(e.target===dlg)closeRent()});
  ['m-from','m-to'].forEach(function(i){$(i).addEventListener('change',function(){if(i==='m-from'){$('m-to').min=$('m-from').value;if($('m-to').value&&$('m-to').value<=$('m-from').value)$('m-to').value=''}rcalc()})});
  $('m-pick').addEventListener('change',togAddr);$('m-deliv').addEventListener('change',togAddr);
  var em=$('m-email'),ph=$('m-phone');function cv(){var ok=em.value.trim()||ph.value.trim();em.setCustomValidity(ok?'':S.m_contact_err)}
  em.addEventListener('input',cv);ph.addEventListener('input',cv);
  $('m-form').addEventListener('submit',function(e){cv();if(!this.checkValidity()){e.preventDefault();this.reportValidity();return}
    rcalc();var d=days($('m-from').value,$('m-to').value);
    if(NK.api&&cur&&cur.uuid&&!this._fallback){e.preventDefault();apiSubmit(this);return}
    push(cur&&cur.owner_ntfy_topic||NK.admin,'Ny leieforespørsel: '+(cur?t(cur.title&&cur.title.no||cur.title):'utstyr')+', '+d+' dager, '+dmy($('m-from').value)+'–'+dmy($('m-to').value)+' Sjekk e-post.')});
}
var rf=$('request-form');if(rf)rf.addEventListener('submit',function(){var s=$('r-item'),op=s&&s.options[s.selectedIndex],id=op&&op.getAttribute('data-id'),x=id&&byId[id];
  var what=x?(x.title.no||t(x.title)):(NK.catsNo[$('r-cat').value]||'utstyr');
  push(x&&x.owner_ntfy_topic||NK.admin,'Ny forespørsel: '+what+', '+dmy($('r-from').value)+'–'+dmy($('r-to').value)+' Sjekk e-post.')});
var of=$('owner-form');if(of)of.addEventListener('submit',function(){push(NK.admin,'Ny utleier har meldt seg: '+(NK.catsNo[$('o-cat').value]||'utstyr')+'. Sjekk e-post.')});

/* ---------- backend (Supabase) ---------- */
var t0=0;
function apiSubmit(f){var btn=f.querySelector('button[type=submit]'),lbl=btn.textContent,err=$('m-err');btn.disabled=true;btn.textContent=S.b_sending;if(err)err.hidden=true;
  var body={listing_id:cur.uuid,date_from:$('m-from').value,date_to:$('m-to').value,name:$('m-name').value,email:$('m-email').value,phone:$('m-phone').value,
    mode:$('m-deliv').checked?'delivery':'pickup',address:$('m-addr').value,size:$('m-size').value,message:$('m-msg').value,language:LG,
    website:(f.querySelector('[name=_honey]')||{}).value||'',t_ms:Date.now()-t0};
  function fallback(){f._fallback=true;btn.disabled=false;btn.textContent=lbl;HTMLFormElement.prototype.submit.call(f)}
  fetch(NK.api.url+'/functions/v1/create-request',{method:'POST',headers:{'Content-Type':'application/json',apikey:NK.api.key},body:JSON.stringify(body)})
  .then(function(r){return r.json().catch(function(){return{}}).then(function(j){
    if(r.ok&&j.ok){location.href=NK.thanksUrl+'?r=1';return}
    if(r.status>=500||r.status===0){fallback();return}
    btn.disabled=false;btn.textContent=lbl;
    var m=r.status===429?S.b_rate:(r.status===404||j.error==='listing_unavailable')?S.b_unavail:S.b_invalid;
    if(err){err.textContent=m;err.hidden=false}else alert(m)})}).catch(fallback)}
function fromRow(x){var p=x.photos&&x.photos[0];return{id:x.slug||x.id,uuid:x.id,category:x.category,title:x.title,description:x.description,
  price_per_day:x.price_per_day,deposit:x.deposit,place:x.place,lat:x.lat,lng:x.lng,pickup:x.pickup,delivery:x.delivery,
  photo:p?(/^(https?:)?\//.test(p)?p:NK.api.url+'/storage/v1/object/public/listing-photos/'+p):null,photo_illustration:x.photo_illustration,photo_credit:x.photo_credit,
  shoe_eu:x.shoe_eu_min!=null?[+x.shoe_eu_min,+(x.shoe_eu_max!=null?x.shoe_eu_max:x.shoe_eu_min)]:null,clothing_size:x.clothing_sizes&&x.clothing_sizes.length?x.clothing_sizes:null,
  ski_length_cm:x.ski_length_cm,fits_height_cm:x.fits_height_min!=null?[x.fits_height_min,x.fits_height_max!=null?x.fits_height_max:x.fits_height_min]:null}}
var COLS='id,slug,category,title,description,price_per_day,deposit,shoe_eu_min,shoe_eu_max,clothing_sizes,ski_length_cm,fits_height_min,fits_height_max,place,lat,lng,pickup,delivery,photos,photo_illustration,photo_credit';
function loadListings(){var stat=function(){return fetch('/listings.json',{cache:'no-cache'}).then(function(r){return r.json()}).then(function(d){return d.listings||[]})};
  if(!NK.api)return stat();
  return fetch(NK.api.url+'/rest/v1/listings?select='+COLS+'&active=eq.true&order=created_at.asc',{headers:{apikey:NK.api.key}})
    .then(function(r){if(!r.ok)throw r;return r.json()}).then(function(rows){return rows.map(fromRow)}).catch(stat)}
/* ---------- events ---------- */
document.addEventListener('click',function(ev){
  var r=ev.target.closest('[data-rent]');if(r){ev.preventDefault();openRent(r.getAttribute('data-rent'));return}
  if(ev.target.closest('[data-need]'))prefillNeed();
  var c=ev.target.closest('.chip');if(c){cat=c.getAttribute('data-cat');document.querySelectorAll('.chip').forEach(function(x){x.classList.toggle('on',x===c)});render();var rc=$('r-cat');if(rc&&cat!=='all')rc.value=cat}
  var lg=ev.target.closest('.lang a');if(lg)ls('nk_lang',lg.getAttribute('data-l'))});
['r-item','r-from','r-to'].forEach(function(i){var x=$(i);if(x)x.addEventListener('change',est)});
var today=new Date().toISOString().slice(0,10);['r-from','r-to','m-from','m-to'].forEach(function(i){var x=$(i);if(x)x.min=today});
var fr=$('r-from');if(fr)fr.addEventListener('change',function(){$('r-to').min=fr.value;if($('r-to').value&&$('r-to').value<fr.value)$('r-to').value=fr.value});
initMap();initSize();
if($('cards')||$('r-item')){loadListings().then(function(ls){listings=ls;listings.forEach(function(x){byId[x.id]=x});fillSelect();render();
  var m=location.hash.match(/^#rent=([\w-]+)(?:&from=([\d-]+)&to=([\d-]+))?/);if(m){if(m[2]){$('m-from').value=m[2];$('m-to').value=m[3]}openRent(m[1])}}).catch(function(){render()})}
/* ---------- PWA ---------- */
if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}
var bar=$('inst'),dp=null,standalone=(window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||navigator.standalone;
function showBar(ios){if(!bar||standalone||ls('nk_inst'))return;$('inst-ios').style.display=ios?'':'none';$('inst-go').style.display=ios?'none':'';bar.hidden=false}
if(bar){$('inst-x').addEventListener('click',function(){bar.hidden=true;ls('nk_inst','1')});
  window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();dp=e;setTimeout(function(){showBar(false)},2500)});
  $('inst-go').addEventListener('click',function(){if(dp){dp.prompt();dp.userChoice.then(function(){bar.hidden=true;ls('nk_inst','1')});dp=null}});
  if(/iphone|ipad|ipod/i.test(navigator.userAgent)&&!standalone)setTimeout(function(){showBar(true)},4000)}
})();