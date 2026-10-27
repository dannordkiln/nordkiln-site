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
function priceHtml(x){return x.price_per_day?('<div class="price">'+fmt(x.price_per_day)+' <small>'+S.per_day+'</small></div>'):'<div class="price"><small>'+S.price_ask+'</small></div>'}
function card(x){
  var c=x.photo_credit,cr=c?(' · <a href="'+esc(c.source)+'" target="_blank" rel="noopener">'+esc(c.author)+', '+esc(c.license)+'</a>'):'';
  var img=x.photo?('<figure><img src="'+esc(x.photo)+'" alt="'+esc(t(x.title))+(x.photo_illustration?' ('+S.illus+')':'')+'" loading="lazy" width="800" height="600">'+(x.photo_illustration?'<figcaption>'+S.illus+cr+'</figcaption>':'')+'</figure>'):'';
  var tags=sizeTags(x);if(x.pickup!==false)tags.push(S.pickup+(S.m_free?' · '+S.m_free:''));if((x.meeting_points||[]).length)tags.push(S.m_opt_meet+': '+esc(x.meeting_points.map(function(m){return m.name}).join(', ')));if(x.delivery&&(x.delivery_price_per_km!=null||!NK.api))tags.push(S.delivery);if(x.size)tags.push(S.size+': '+esc(x.size));
  tags.push(S.deposit+': '+(x.deposit?fmt(x.deposit)+' kr':(S.m_dep_none||S.deposit_none)));
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
      m.bindPopup('<div class="pop"><b>📍 '+esc(p.place)+'</b>'+xs.map(function(x){return'<div style="margin-top:6px"><b>'+esc(t(x.title))+'</b><br>'+(x.price_per_day?fmt(x.price_per_day)+' '+S.per_day:S.price_ask)+'<br><a href="#" data-rent="'+esc(x.id)+'">'+S.rent_btn+' →</a></div>'}).join('')+'</div>');
      if(xs.length>1)m.bindTooltip(String(xs.length),{permanent:true,direction:'center',className:'cnt'});layer.addLayer(m);});
    var mp={};sel.forEach(function(x){(x.meeting_points||[]).forEach(function(q){if(q.lat!=null)(mp[q.name]=mp[q.name]||{q:q,xs:[]}).xs.push(x)})});
    Object.keys(mp).forEach(function(n){var o=mp[n];var mk=LF.circleMarker([o.q.lat,o.q.lng],{radius:7,color:'#b86e00',weight:3,fillColor:'#f4b860',fillOpacity:.95});
      mk.bindPopup('<div class="pop"><b>🤝 '+S.m_opt_meet+': '+esc(n)+'</b><div class="small">'+S.m_free+' · '+o.xs.map(function(x){return esc(t(x.title))}).join(', ')+'</div></div>');layer.addLayer(mk)});
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
var MODE='pickup',MEET=null,DEL={lat:null,lng:null,km:null,price:0,src:null,ok:false,busy:false};
function hm(m){return ('0'+Math.floor(m/60)).slice(-2)+':'+('0'+m%60).slice(-2)}
function mins(x){return +x.slice(0,2)*60+ +x.slice(3,5)}
function slotsFor(w,date){if(!date)return null;w=w||{weekday:{from:'16:00',to:'20:00'},weekend:{from:'10:00',to:'18:00'}};var dd=new Date(date+'T12:00:00Z').getUTCDay(),x=((dd===0||dd===6)?w.weekend:w.weekday);
  if(!x||!x.from||!x.to||mins(x.to)<=mins(x.from))return [];var a=mins(x.from),b=mins(x.to),o=[];for(var m=a;m<=b-60;m+=60)o.push(hm(m));return o.length?o:[x.from]}
function dmyS(v){var p=v.split('-');return (+p[2])+'.'+(+p[1])+'.'}
function slots(){var sel=$('m-slot');if(!sel||!cur)return;var a=$('m-from').value,keep=sel.value,l=slotsFor(cur.pickup_windows,a);
  var none=$('m-slot-none');if(l===null){sel.innerHTML='<option value="">'+S.m_slot_pick+'</option>';none.hidden=true}
  else if(!l.length){sel.innerHTML='<option value="">–</option>';none.hidden=false}
  else{none.hidden=true;sel.innerHTML='<option value="">'+S.m_slot+' …</option>'+l.map(function(h){var e=hm(Math.min(mins(h)+60,24*60-1));return '<option value="'+h+'"'+(h===keep?' selected':'')+'>'+h+'–'+e+'</option>'}).join('')}
  var b=$('m-to').value;$('m-ret').textContent=b?S.m_return_v.replace('{date}',dmyS(b)).replace('{time}',cur.return_by||'18:00'):'–'}
function rcalc(){if(!cur)return;slots();var a=$('m-from').value,b=$('m-to').value,o=$('m-total'),d=days(a,b),p=cur.price_per_day||0;
  $('m-days').textContent=d?('= '+d+' '+S.m_days):'';
  var t2=$('m-total2');
  if(!d||!p){o.innerHTML='<span class="small">'+S.m_pick_dates+'</span>';$('m-esth').value='';if(t2)t2.innerHTML='';return}
  var sub=p*d,f=fee(sub),dp=MODE==='delivery'&&DEL.ok?DEL.price:0,tot=sub+f+dp;
  o.innerHTML='<div class="row"><span>'+S.m_rent+': '+d+' × '+fmt(p)+' kr</span><span>'+fmt(sub)+' kr</span></div><div class="row"><span>'+S.est_fee.charAt(0).toUpperCase()+S.est_fee.slice(1)+'</span><span>'+fmt(f)+' kr</span></div>'+
    (MODE==='delivery'?'<div class="row"><span>'+S.m_deliv_line.replace('{km}',DEL.ok?String(DEL.km).replace('.',LG==='en'||LG==='zh'?'.':','):'?')+' <span class="small">('+S.m_deliv_owner+')</span></span><span>'+(DEL.ok?fmt(dp)+' kr':'–')+'</span></div>':'')+
    '<div class="row tot"><span>'+S.m_total+'</span><span>'+fmt(tot)+' kr</span></div><div class="small">'+fx(tot)+'</div>'+
    (cur.deposit?'<div class="row dep"><span>+ '+S.m_dep_line+'</span><span>'+fmt(cur.deposit)+' kr</span></div>':'');
  if(t2)t2.innerHTML='<span>'+S.m_total+'</span><span>'+fmt(tot)+' kr'+(cur.deposit?' <small>+ '+S.deposit+' '+fmt(cur.deposit)+' kr</small>':'')+'</span>';
  $('m-esth').value=tot+' NOK = '+d+' x '+p+' + fee '+f+(dp?' + delivery '+dp+' ('+DEL.km+' km)':'');$('m-daysh').value=d}
/* ---------- pickup / meeting point / delivery ---------- */
function rate(x){var r=S.m_deliv_rate.replace('{per}',fmt(x.delivery_price_per_km)).replace('{max}',x.delivery_max_km);return x.delivery_min_price?r+', '+S.m_deliv_min.replace('{min}',fmt(x.delivery_min_price)):r}
function renderModes(x){var h='<label class="opt1"><input type="radio" name="m_mode" value="pickup" checked><span><b>'+S.m_opt_pickup+'</b> · '+S.m_free+'<br><span class="small">📍 '+esc(x.place)+'</span></span></label>';
  (x.meeting_points||[]).forEach(function(m,i){h+='<label class="opt1"><input type="radio" name="m_mode" value="meet:'+i+'"><span><b>'+S.m_opt_meet+':</b> '+esc(m.name)+' · '+S.m_free+'</span></label>'});
  if(x.delivery&&x.delivery_price_per_km!=null&&x.delivery_max_km)h+='<label class="opt1"><input type="radio" name="m_mode" value="delivery"><span><b>'+S.m_opt_deliv+'</b><br><span class="small">'+rate(x)+'</span></span></label>';
  $('m-modes').innerHTML=h;MODE='pickup';MEET=null;DEL={lat:null,lng:null,km:null,price:0,src:null,ok:false,busy:false};setMode()}
function setMode(){var v=(document.querySelector('input[name=m_mode]:checked')||{}).value||'pickup';
  MODE=v==='delivery'?'delivery':v.indexOf('meet:')===0?'meeting':'pickup';MEET=MODE==='meeting'?cur.meeting_points[+v.slice(5)]:null;
  $('m-modeh').value=MODE==='delivery'?'Delivery':MODE==='meeting'?'Meeting point':'Pickup';$('m-meeth').value=MEET?MEET.name:'';
  $('m-delw').hidden=MODE!=='delivery';$('m-addr').required=MODE==='delivery';if(MODE==='delivery')initDmap();rcalc()}
var dmap=null,dmark=null,dcirc=null;
function initDmap(){if(!LF)return;var c=[cur.lat,cur.lng];
  if(!dmap){dmap=LF.map('m-dmap',{scrollWheelZoom:false});LF.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:17,attribution:'&copy; OpenStreetMap'}).addTo(dmap);
    dmap.on('click',function(e){setPin(e.latlng.lat,e.latlng.lng)})}
  if(dcirc)dmap.removeLayer(dcirc);if(dmark){dmap.removeLayer(dmark);dmark=null}
  dcirc=LF.circle(c,{radius:cur.delivery_max_km*1000/1.3,color:'#0e7c86',weight:1,fillOpacity:.05,interactive:false}).addTo(dmap);
  LF.circleMarker(c,{radius:7,color:'#0a5f67',fillColor:'#0e7c86',fillOpacity:1}).addTo(dmap);
  setTimeout(function(){dmap.invalidateSize();dmap.fitBounds(dcirc.getBounds(),{padding:[4,4]})},60);$('m-dinfo').textContent=S.m_pin_hint;$('m-dinfo').className='small'}
function hav(a,b){var R=6371,r=function(d){return d*Math.PI/180},dl=r(b[0]-a[0]),dn=r(b[1]-a[1]),h=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(r(a[0]))*Math.cos(r(b[0]))*Math.sin(dn/2)*Math.sin(dn/2);return 2*R*Math.asin(Math.sqrt(h))}
function setPin(lat,lng,label){DEL.lat=Math.round(lat*1e5)/1e5;DEL.lng=Math.round(lng*1e5)/1e5;DEL.ok=false;DEL.busy=true;
  if(dmark)dmark.setLatLng([lat,lng]);else{dmark=LF.marker([lat,lng],{draggable:true}).addTo(dmap);dmark.on('dragend',function(){var p=dmark.getLatLng();setPin(p.lat,p.lng)})}
  if(label&&!$('m-addr').value)$('m-addr').value=label;
  var info=$('m-dinfo');info.textContent=S.m_calc;info.className='small';rcalc();
  var from=[cur.lat,cur.lng],to=[DEL.lat,DEL.lng];
  fetch('https://router.project-osrm.org/route/v1/driving/'+from[1]+','+from[0]+';'+to[1]+','+to[0]+'?overview=false').then(function(r){return r.json()})
  .then(function(j){if(j.code==='Ok'&&j.routes&&j.routes[0])return{km:Math.round(j.routes[0].distance/100)/10,src:'osrm'};throw 0})
  .catch(function(){return{km:Math.round(hav(from,to)*1.3*10)/10,src:'straight'}})
  .then(function(r){if(DEL.lat!==to[0]||DEL.lng!==to[1])return;DEL.busy=false;DEL.km=r.km;DEL.src=r.src;
    if(r.km>cur.delivery_max_km){DEL.ok=false;info.textContent=S.m_too_far.replace('{km}',r.km).replace('{max}',cur.delivery_max_km);info.className='err'}
    else{DEL.ok=true;DEL.price=Math.max(cur.delivery_min_price||0,Math.round(r.km*cur.delivery_price_per_km));
      info.textContent=S.m_km.replace('{km}',r.km)+' = '+fmt(DEL.price)+' kr'+(r.src==='straight'?' ('+S.m_straight+')':'');info.className='small ok'}
    $('m-dkmh').value=DEL.ok?DEL.km:'';$('m-dpriceh').value=DEL.ok?DEL.price:'';$('m-dposh').value=DEL.lat+','+DEL.lng;rcalc()})}
function findAddr(){var q=$('m-addr').value.trim();if(!q)return;var info=$('m-dinfo');info.textContent=S.m_calc;
  fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=no&accept-language='+LG+'&q='+encodeURIComponent(q)).then(function(r){return r.json()})
  .then(function(a){if(!a.length){info.textContent=S.m_nores;info.className='err';return}var lat=+a[0].lat,lng=+a[0].lon;dmap.setView([lat,lng],13);setPin(lat,lng)})
  .catch(function(){info.textContent=S.m_nores;info.className='err'})}
/* ---------- availability calendar ---------- */
var BUSY=[];
function iso(d){return d.getUTCFullYear()+'-'+('0'+(d.getUTCMonth()+1)).slice(-2)+'-'+('0'+d.getUTCDate()).slice(-2)}
function addD(v,n){var d=new Date(v+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return iso(d)}
function isBusy(v){return BUSY.some(function(b){return v>=b.date_from&&v<=b.date_to})}
function rangeBusy(a,b){return BUSY.some(function(x){return a<=x.date_to&&b>=x.date_from})}
function loadBusy(x){BUSY=[];renderCal();if(!NK.api||!x.uuid)return;
  fetch(NK.api.url+'/rest/v1/rpc/listing_busy',{method:'POST',headers:{apikey:NK.api.key,'Content-Type':'application/json'},body:JSON.stringify({p_listing:x.uuid})})
  .then(function(r){return r.ok?r.json():[]}).then(function(b){if(cur!==x)return;BUSY=b||[];renderCal();checkTaken()}).catch(function(){})}
function checkTaken(){var a=$('m-from').value,b=$('m-to').value,bad=!!(a&&b&&rangeBusy(a,b))||!!(a&&!b&&isBusy(a));$('m-taken').hidden=!bad;$('m-to').setCustomValidity(bad?S.m_taken:'');return !bad}
function renderCal(){var box=$('m-cal');if(!box)return;var a=$('m-from').value,b=$('m-to').value,td=new Date().toISOString().slice(0,10);
  var base=new Date((a||td).slice(0,7)+'-01T00:00:00Z'),h='',loc={no:'nb-NO',de:'de-DE',zh:'zh-CN',en:'en-GB'}[LG]||'en-GB';
  var wd=[];for(var i=0;i<7;i++){wd.push(new Date(Date.UTC(2024,0,1+i)).toLocaleDateString(loc,{weekday:'narrow',timeZone:'UTC'}))}
  for(var m=0;m<2;m++){var first=new Date(Date.UTC(base.getUTCFullYear(),base.getUTCMonth()+m,1));
    h+='<div class="mh">'+first.toLocaleDateString(loc,{month:'long',year:'numeric',timeZone:'UTC'})+'</div>'+wd.map(function(w){return '<div class="wd">'+w+'</div>'}).join('');
    var pad=(first.getUTCDay()+6)%7;for(var k=0;k<pad;k++)h+='<div></div>';
    var n=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
    for(var dd=1;dd<=n;dd++){var v=iso(new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth(),dd))),bz=isBusy(v),past=v<td;
      var c=(v===a||v===b)?'sel':(a&&b&&v>a&&v<b)?'in':'';h+='<button type="button" data-d="'+v+'" class="'+c+(bz?' busy':'')+'"'+(bz||past?' disabled':'')+(bz?' title="'+S.m_booked+'"':'')+'>'+dd+'</button>'}}
  if(BUSY.length)h+='<div class="lg"><s>12</s> = '+S.m_booked+'</div>';box.innerHTML=h}
function calClick(ev){var bt=ev.target.closest('button[data-d]');if(!bt||bt.disabled)return;var v=bt.getAttribute('data-d'),f=$('m-from'),t=$('m-to');
  if(!f.value||t.value||v<=f.value){f.value=v;t.value='';t.min=v}else{t.value=v}
  rcalc();renderCal();checkTaken()}
function openRent(id){var x=byId[id];if(!x||!dlg)return;cur=x;
  $('m-form').hidden=false;$('m-ok').hidden=true;var ins=x.instant_book!==false;$('m-inst').hidden=!ins;$('m-send').textContent=ins?S.m_send:S.m_send_req;$('m-note').textContent=ins?S.m_note:S.m_note_req;loadBusy(x);
  $('m-h').textContent=t(x.title);$('m-sub').textContent=(x.price_per_day?fmt(x.price_per_day)+' '+S.per_day+' · ':'')+'📍 '+x.place;
  $('m-item').value=t(x.title)+' ['+x.id+']';$('m-id').value=x.id;
  var r=rng(x.shoe_eu);$('m-size').value=szText()||(r?'EU '+(r[0]===r[1]?r[0]:r[0]+'–'+r[1]):'');
  renderModes(x);rcalc();t0=Date.now();var me=$('m-err');if(me)me.hidden=true;
  if(dlg.showModal){dlg.showModal()}else{dlg.setAttribute('open','')}
  setTimeout(function(){if(!$('m-from').value)$('m-from').focus()},50)}
function closeRent(){if(dlg.close)dlg.close();else dlg.removeAttribute('open')}
if(dlg){
  $('m-x').addEventListener('click',closeRent);
  dlg.addEventListener('click',function(e){if(e.target===dlg)closeRent()});
  ['m-from','m-to'].forEach(function(i){$(i).addEventListener('change',function(){if(i==='m-from'){$('m-to').min=$('m-from').value;if($('m-to').value&&$('m-to').value<=$('m-from').value)$('m-to').value=''}rcalc();renderCal();checkTaken()})});
  $('m-cal').addEventListener('click',calClick);
  $('m-modes').addEventListener('change',setMode);$('m-find').addEventListener('click',findAddr);
  $('m-addr').addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();findAddr()}});
  var ph=$('m-phone'),ru=$('m-rules'),sl=$('m-slot');function cv(){ph.setCustomValidity(/^[+\d][\d\s().-]{5,}$/.test(ph.value.trim())?'':S.b_phone);ru.setCustomValidity(ru.checked?'':S.m_rules_err);sl.setCustomValidity(sl.value?'':S.b_slot)}
  ph.addEventListener('input',cv);ru.addEventListener('change',cv);sl.addEventListener('change',cv);
  $('m-form').addEventListener('submit',function(e){cv();checkTaken();if(!this.checkValidity()){e.preventDefault();this.reportValidity();return}
    if(MODE==='delivery'&&!DEL.ok){e.preventDefault();var di=$('m-dinfo');if(!DEL.busy&&DEL.km==null){di.textContent=S.m_need_pin;di.className='err'}di.scrollIntoView({block:'center'});return}
    rcalc();var d=days($('m-from').value,$('m-to').value);
    if(NK.api&&cur&&cur.uuid&&!this._fallback){e.preventDefault();apiSubmit(this);return}});
}
/* ---------- backend (Supabase) ---------- */
var t0=0;
function apiSubmit(f){var btn=f.querySelector('button[type=submit]'),lbl=btn.textContent,err=$('m-err');btn.disabled=true;btn.textContent=S.b_sending;if(err)err.hidden=true;
  var body={listing_id:cur.uuid,date_from:$('m-from').value,date_to:$('m-to').value,name:$('m-name').value,email:$('m-email').value,phone:$('m-phone').value,
    pickup_time:$('m-slot').value,rules_accepted:$('m-rules').checked,rules_version:NK.rulesVersion,mode:MODE,meeting_point:MEET?MEET.name:null,delivery_lat:MODE==='delivery'?DEL.lat:null,delivery_lng:MODE==='delivery'?DEL.lng:null,delivery_price:MODE==='delivery'?DEL.price:null,
    address:MODE==='delivery'?$('m-addr').value:'',size:$('m-size').value,message:$('m-msg').value,language:LG,
    website:(f.querySelector('[name=_honey]')||{}).value||'',t_ms:Date.now()-t0};
  function fallback(){f._fallback=true;btn.disabled=false;btn.textContent=lbl;HTMLFormElement.prototype.submit.call(f)}
  fetch(NK.api.url+'/functions/v1/create-request',{method:'POST',headers:{'Content-Type':'application/json',apikey:NK.api.key},body:JSON.stringify(body)})
  .then(function(r){return r.json().catch(function(){return{}}).then(function(j){
    if(r.ok&&j.ok){showOk(j);return}
    if(r.status>=500||r.status===0){fallback();return}
    btn.disabled=false;btn.textContent=lbl;
    if(j.error==='price_changed'&&j.delivery_price!=null){DEL.km=j.km;DEL.price=j.delivery_price;rcalc();}
    if(j.error==='dates_taken'){loadBusy(cur);$('m-taken').hidden=false;$('m-taken').scrollIntoView({block:'center'})}
    var m=j.error==='dates_taken'?S.m_taken:r.status===429?S.b_rate:(r.status===404||j.error==='listing_unavailable')?S.b_unavail:j.error==='too_far'?S.m_too_far.replace('{km}',j.km).replace('{max}',j.max_km):j.error==='price_changed'?S.m_price_changed:(j.fields||[]).indexOf('phone')>=0?S.b_phone:(j.fields||[]).indexOf('pickup_time')>=0?S.b_slot:(j.fields||[]).indexOf('rules')>=0?S.m_rules_err:S.b_invalid;
    if(j.error==='invalid'&&(j.fields||[]).indexOf('pickup_time')>=0)slots();
    if(err){err.textContent=m;err.hidden=false}else alert(m)})}).catch(fallback)}
function showOk(j){var o=$('m-ok'),f=$('m-form');
  function row(k,v){return v?'<dt>'+esc(k)+'</dt><dd>'+v+'</dd>':''}
  if(j.instant){var ow=j.owner||{},ct=ow.phone?'<a href="tel:'+esc(ow.phone.replace(/[^\d+]/g,''))+'">'+esc(ow.phone)+'</a>':ow.email?'<a href="mailto:'+esc(ow.email)+'">'+esc(ow.email)+'</a>':'';
    o.innerHTML='<h2>✅ '+S.ok_h+'</h2><p><b>'+esc(t(cur.title))+'</b> · '+dmyS(j.date_from)+'–'+dmyS(j.date_to)+'</p><dl>'+
      row(S.ok_where,esc(j.place||'')+(j.map?' · <a href="'+esc(j.map)+'" target="_blank" rel="noopener">'+S.ok_map+'</a>':'')+(j.approx&&j.mode==='pickup'?'<br><span class="small">'+S.ok_approx+'</span>':''))+
      row(S.ok_time,dmyS(j.date_from)+' '+esc(j.pickup_time||''))+row(S.ok_ret,S.m_return_v.replace('{date}',dmyS(j.date_to)).replace('{time}',esc(j.return_by||'18:00')))+
      row(S.ok_owner,esc(ow.name||'')+(ct?'<br>'+ct:''))+row(S.ok_total,'<span class="big">'+fmt(j.total)+' kr</span>')+(j.deposit?row(S.ok_dep,fmt(j.deposit)+' kr'):'')+
      '</dl><p class="small">'+(j.mailed?S.ok_mail:'')+'</p><button type="button" class="btn wide" id="m-okx">'+S.ok_done+'</button>'}
  else o.innerHTML='<h2>📨 '+S.ok_req_h+'</h2><p>'+S.ok_req_p+'</p><p><b>'+S.ok_total+':</b> '+fmt(j.total)+' kr</p><button type="button" class="btn wide" id="m-okx">'+S.ok_done+'</button>';
  f.hidden=true;o.hidden=false;dlg.scrollTop=0;$('m-okx').addEventListener('click',closeRent);if(j.instant)loadBusy(cur)}
function fromRow(x){var p=x.photos&&x.photos[0];return{id:x.slug||x.id,uuid:x.id,category:x.category,title:x.title,description:x.description,
  price_per_day:x.price_per_day,deposit:x.deposit,place:x.place,lat:x.lat,lng:x.lng,pickup:x.pickup,delivery:x.delivery,
  photo:p?(/^(https?:)?\//.test(p)?p:NK.api.url+'/storage/v1/object/public/listing-photos/'+p):null,photo_illustration:x.photo_illustration,photo_credit:x.photo_credit,
  shoe_eu:x.shoe_eu_min!=null?[+x.shoe_eu_min,+(x.shoe_eu_max!=null?x.shoe_eu_max:x.shoe_eu_min)]:null,clothing_size:x.clothing_sizes&&x.clothing_sizes.length?x.clothing_sizes:null,
  meeting_points:x.meeting_points||[],pickup_windows:x.pickup_windows||null,instant_book:x.instant_book!==false,return_by:x.return_by||'18:00',handover_note:x.handover_note||null,delivery_price_per_km:x.delivery_price_per_km!=null?+x.delivery_price_per_km:null,delivery_max_km:x.delivery_max_km,delivery_min_price:x.delivery_min_price,
  ski_length_cm:x.ski_length_cm,fits_height_cm:x.fits_height_min!=null?[x.fits_height_min,x.fits_height_max!=null?x.fits_height_max:x.fits_height_min]:null}}
var COLS='id,slug,category,title,description,price_per_day,deposit,shoe_eu_min,shoe_eu_max,clothing_sizes,ski_length_cm,fits_height_min,fits_height_max,place,lat,lng,pickup,delivery,photos,photo_illustration,photo_credit,meeting_points,delivery_price_per_km,delivery_max_km,delivery_min_price,pickup_windows,return_by,handover_note,instant_book';
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