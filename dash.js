(function(){
var NK=window.NK,S=NK.s,A=NK.api,LG=NK.lang,$=function(i){return document.getElementById(i)};
if(!A||!window.supabase){var m=$('d-msg');if(m){m.textContent=S.d_offline;m.hidden=false}return}
var sb=window.supabase.createClient(A.url,A.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
var LOC={no:'nb-NO',de:'de-DE',zh:'zh-CN',en:'en-GB'}[LG]||'en-GB';
function fmt(n){return new Intl.NumberFormat(LOC).format(Math.round(n||0))}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function t(o){if(!o)return'';if(typeof o==='string')return o;return o[LG]||o.en||o.no||o[Object.keys(o)[0]]||''}
function dmy(v){if(!v)return'';var p=v.split('-');return (+p[2])+'.'+(+p[1])+'.'+p[0]}
function photoUrl(p){return /^(https?:)?\//.test(p)?p:A.url+'/storage/v1/object/public/listing-photos/'+p}
function show(id,on){var e=$(id);if(e)e.hidden=!on}
function toast(msg){var e=$('d-toast');e.textContent=msg;e.hidden=false;clearTimeout(e._t);e._t=setTimeout(function(){e.hidden=true},3500)}
var user=null,profile=null,listings=[],priv={},reqs=[],editing=null,photos=[],mps=[],mpActive=-1;
/* ---------- login (email code; link also works) ---------- */
var em='';
$('d-email-form').addEventListener('submit',function(e){e.preventDefault();em=$('d-email').value.trim().toLowerCase();var b=this.querySelector('button');b.disabled=true;
  sb.auth.signInWithOtp({email:em,options:{emailRedirectTo:location.origin+location.pathname,shouldCreateUser:true,data:{language:LG}}}).then(function(r){b.disabled=false;
    if(r.error){toast(r.error.message||S.f_err);return}
    $('d-code-sent').textContent=S.d_code_sent.replace('{email}',em);show('d-email-form',false);show('d-code-form',true);$('d-code').focus()})});
$('d-code-form').addEventListener('submit',function(e){e.preventDefault();var b=this.querySelector('button');b.disabled=true;
  sb.auth.verifyOtp({email:em,token:$('d-code').value.replace(/\s/g,''),type:'email'}).then(function(r){b.disabled=false;if(r.error)toast(r.error.message||S.f_err)})});
$('d-other').addEventListener('click',function(){show('d-code-form',false);show('d-email-form',true)});
$('d-logout').addEventListener('click',function(){sb.auth.signOut()});
sb.auth.onAuthStateChange(function(ev,session){var u=session&&session.user;
  if(u&&(!user||user.id!==u.id)){user=u;show('d-login',false);show('d-app',true);$('d-who').textContent=u.email;loadAll()}
  else if(!u){user=null;show('d-app',false);show('d-login',true)}});
/* ---------- data ---------- */
function loadAll(){loadProfile();loadListings();loadReqs();initNotif();initPay();loadRevs()}
function loadRevs(){sb.from('reviews').select('id,listing_id,renter_first_name,rating,rating_gear,rating_handover,body,owner_reply,created_at,listings(title)').eq('owner_id',user.id).order('created_at',{ascending:false}).limit(50).then(function(r){var l=r.data||[],box=$('d-rv-list');
  if(!l.length){box.innerHTML='<p class="small">'+S.d_rv_none+'</p>';return}
  var avg=l.reduce(function(a,v){return a+v.rating},0)/l.length;
  box.innerHTML='<p><b>'+S.d_rv_avg+': ★ '+avg.toFixed(1)+'</b> ('+l.length+')</p>'+l.map(function(v){return '<article class="rq"><div class="rqh"><b>'+esc(t(v.listings&&v.listings.title))+'</b><span>'+'★'.repeat(v.rating)+'</span></div>'+
    '<p class="small">'+esc(v.renter_first_name)+' · '+dmy(v.created_at.slice(0,10))+' · '+S.rv_gear+' '+v.rating_gear+'/5 · '+S.rv_hand+' '+v.rating_handover+'/5</p>'+(v.body?'<p>'+esc(v.body)+'</p>':'')+
    (v.owner_reply?'<p class="small"><b>'+S.rv_reply+':</b> '+esc(v.owner_reply)+'</p>':'<textarea id="rp-'+v.id+'" rows="2" maxlength="500" placeholder="'+esc(S.d_rv_reply_ph)+'"></textarea><button class="btn sm ghost2" data-act="reply" data-id="'+v.id+'">'+S.d_rv_reply+'</button>')+'</article>'}).join('')})}
function loadProfile(){sb.from('owners').select('name,phone,language,place').eq('id',user.id).maybeSingle().then(function(r){profile=r.data||{};
  $('p-name').value=profile.name||'';$('p-phone').value=profile.phone||'';$('p-place').value=profile.place||'';$('p-lang').value=profile.language||LG;
  show('d-profile-need',!(profile.name&&profile.phone))})}
$('d-profile-form').addEventListener('submit',function(e){e.preventDefault();
  var v={name:$('p-name').value.trim()||null,phone:$('p-phone').value.trim()||null,place:$('p-place').value.trim()||null,language:$('p-lang').value};
  sb.from('owners').update(v).eq('id',user.id).then(function(r){if(r.error){toast(S.f_err);return}profile=v;toast(S.d_saved);show('d-profile-need',!(v.name&&v.phone))})});
function loadListings(){sb.from('listings').select('*').eq('owner_id',user.id).order('created_at').then(function(r){listings=r.data||[];renderListings()});
  sb.from('listing_private').select('*').eq('owner_id',user.id).then(function(r){priv={};(r.data||[]).forEach(function(p){priv[p.listing_id]=p});renderListings()})}
function renderListings(){var box=$('d-list');
  if(!listings.length){box.innerHTML='<p class="small">'+S.d_none+'</p>';return}
  box.innerHTML=listings.map(function(x){var img=x.photos&&x.photos[0]?'<img src="'+esc(photoUrl(x.photos[0]))+'" alt="" loading="lazy">':'<div class="noimg">📷</div>';
    return '<div class="dl'+(x.active?'':' off')+'">'+img+'<div class="dlb"><b>'+esc(t(x.title))+'</b><span class="small">'+(x.price_per_day?fmt(x.price_per_day)+' '+S.per_day:'')+' · 📍 '+esc(x.place)+(x.deposit?' · '+S.d_dep_v+' '+fmt(x.deposit)+' kr':'')+'</span>'+(priv[x.id]&&priv[x.id].address_is_approx?'<span class="small warn">'+esc(S.f_addr_approx)+'</span>':'')+
    '<div class="dla"><label class="sw"><input type="checkbox" data-act="toggle" data-id="'+x.id+'"'+(x.active?' checked':'')+'> '+(x.active?S.d_active:S.d_hidden)+'</label><button class="linkbtn" data-act="edit" data-id="'+x.id+'">'+S.d_edit+'</button></div></div></div>'}).join('')}
var RQSEL='id,listing_id,renter_name,renter_email,renter_phone,date_from,date_to,days,mode,address,size,message,language,subtotal,fee,total,deposit,status,payment_status,deposit_status,owner_note,created_at,meeting_point,delivery_km,delivery_price,pickup_time,return_by,rules_version,rules_accepted_at,instant,cancel_reason,cancelled_by,listings(title)';
function loadReqs(){sb.from('rental_requests').select(RQSEL).order('created_at',{ascending:false}).limit(100).then(function(r){reqs=r.data||[];renderReqs();focusReq()})}
function badge(x){var m={pending:S.d_st_pending,confirmed:S.d_st_confirmed,accepted:S.d_st_accepted,declined:S.d_st_declined,cancelled:S.d_st_cancelled}[x.status];
  var b='<span class="badge '+x.status+'">'+m+'</span>';
  if(x.payment_status==='paid')b+=' <span class="badge accepted">'+S.d_paid+'</span>';else if(x.payment_status==='awaiting')b+=' <span class="badge pending">'+S.d_pay_await+'</span>';
  if(x.deposit_status==='authorized')b+=' <span class="badge accepted">'+S.d_dep_auth+'</span>';return b}
function contact(x){var a=[];if(x.renter_phone){var p=x.renter_phone.replace(/[^\d+]/g,'');a.push('<a class="btn sm teal" href="tel:'+esc(p)+'">📞 '+S.d_call+'</a>');a.push('<a class="btn sm ghost2" href="sms:'+esc(p)+'">'+S.d_sms+'</a>')}
  if(x.renter_email)a.push('<a class="btn sm ghost2" href="mailto:'+esc(x.renter_email)+'">✉ '+S.d_mail+'</a>');return '<div class="dla">'+a.join('')+'</div>'}
function renderReqs(){var box=$('d-req-list'),n=reqs.filter(function(x){return x.status==='pending'}).length;$('d-req-count').textContent=n?'('+n+')':'';
  if(!reqs.length){box.innerHTML='<p class="small">'+S.d_req_none+'</p>';return}
  box.innerHTML=reqs.map(function(x){var title=t(x.listings&&x.listings.title);
    var rows=[[S.m_dates,dmy(x.date_from)+' – '+dmy(x.date_to)+' ('+x.days+' '+S.d_days+')'],
      [S.f_mode,x.mode==='delivery'?S.d_deliv_km.replace('{km}',x.delivery_km)+(x.address?': '+x.address:''):x.mode==='meeting'?S.d_meet+': '+x.meeting_point:S.d_pick]];
    if(x.pickup_time)rows.push([S.d_pickup_t,dmy(x.date_from)+' '+x.pickup_time]);
    rows.push([S.d_return_t,S.m_return_v.replace('{date}',dmy(x.date_to)).replace('{time}',x.return_by||'18:00')]);
    if(x.renter_phone)rows.push([S.f_phone||'☎',x.renter_phone]);
    if(x.size)rows.push([S.size,x.size]);if(x.message)rows.push(['💬',x.message]);
    rows.push([S.d_you_get,fmt(x.subtotal)+(x.delivery_price?' + '+fmt(x.delivery_price):'')+' kr']);rows.push([S.d_total,fmt(x.total)+' kr']);if(x.deposit)rows.push([S.d_dep_v,fmt(x.deposit)+' kr (Vipps)']);
    if(x.rules_accepted_at)rows.push(['✓',S.d_rules_ok+' ('+x.rules_version+')']);
    var act='';
    if(x.status==='pending')act='<textarea id="n-'+x.id+'" rows="2" placeholder="'+esc(S.d_note_ph)+'"></textarea><div class="dla"><button class="btn sm" data-act="accept" data-id="'+x.id+'">✓ '+S.d_accept+'</button><button class="btn sm ghost2" data-act="decline" data-id="'+x.id+'">'+S.d_decline+'</button></div>';
    if((x.status==='confirmed'||x.status==='accepted')&&x.date_to>=new Date().toISOString().slice(0,10))act+='<details class="cxl"><summary class="linkbtn danger">'+S.d_cancel+'</summary><textarea id="c-'+x.id+'" rows="2" maxlength="1000" placeholder="'+esc(S.d_cancel_ph)+'"></textarea><button class="btn sm ghost2" data-act="cancel" data-id="'+x.id+'">'+S.d_cancel+'</button></details>';
    if(x.cancel_reason)rows.push([S.d_st_cancelled,x.cancel_reason]);
    if(x.deposit_status==='authorized')act+='<button class="linkbtn" data-act="release" data-id="'+x.id+'">'+S.d_release+'</button>';
    return '<article class="rq '+x.status+'" id="rq-'+x.id+'"><div class="rqh"><b>'+esc(title)+'</b>'+badge(x)+'</div><p class="rqn">👤 '+esc(x.renter_name)+' · '+esc((x.language||'').toUpperCase())+'</p>'+
      '<dl>'+rows.map(function(r){return '<dt>'+esc(r[0])+'</dt><dd>'+esc(r[1])+'</dd>'}).join('')+'</dl>'+(x.status!=='declined'?contact(x):'')+act+'</article>'}).join('')}
function focusReq(){var m=location.hash.match(/req=([0-9a-f-]{36})/);if(!m)return;var e=$('rq-'+m[1]);if(e){e.classList.add('hl');e.scrollIntoView({behavior:'smooth',block:'center'})}}
window.addEventListener('hashchange',focusReq);
function fn(name,body){return sb.auth.getSession().then(function(s){var tok=s.data.session&&s.data.session.access_token;
  return fetch(A.url+'/functions/v1/'+name,{method:'POST',headers:{'Content-Type':'application/json',apikey:A.key,Authorization:'Bearer '+tok},body:JSON.stringify(body||{})}).then(function(r){return r.json().then(function(j){j._status=r.status;return j})})})}
function respond(id,action,btn){btn.disabled=true;var n=$('n-'+id);
  fn('respond-request',{id:id,action:action,note:n?n.value.trim():''}).then(function(j){btn.disabled=false;
    if(!j.ok){toast(S.f_err);loadReqs();return}
    if(action==='accept')toast(j.mailed?S.d_accepted_msg:S.d_accepted_nomail+' '+(j.renter_phone||j.renter_email||''));
    loadReqs()}).catch(function(){btn.disabled=false;toast(S.d_offline)})}
/* ---------- clicks ---------- */
document.addEventListener('click',function(ev){var b=ev.target.closest('[data-act]');if(!b)return;var id=b.getAttribute('data-id'),a=b.getAttribute('data-act');
  if(a==='accept')respond(id,'accept',b);
  else if(a==='decline'){if(confirm(S.d_conf_decline))respond(id,'decline',b)}
  else if(a==='release')respond(id,'release_deposit',b);
  else if(a==='cancel'){var c=$('c-'+id),why=c?c.value.trim():'';if(why.length<3){toast(S.d_reason_need);if(c)c.focus();return}if(!confirm(S.d_conf_cancel_txt||S.d_cancel_conf))return;
    b.disabled=true;fn('respond-request',{id:id,action:'cancel',note:why}).then(function(j){b.disabled=false;toast(j.ok?S.d_cancelled_msg:S.f_err);loadReqs()}).catch(function(){b.disabled=false;toast(S.d_offline)})}
  else if(a==='reply'){var tx=$('rp-'+id),val=tx?tx.value.trim():'';if(!val)return;b.disabled=true;
    sb.from('reviews').update({owner_reply:val.slice(0,500)}).eq('id',id).then(function(r){b.disabled=false;if(r.error){toast(S.f_err);return}toast(S.d_saved);loadRevs()})}
  else if(a==='rmblock'){sb.from('listing_blocks').delete().eq('id',id).then(function(r){if(r.error)toast(S.f_err);loadBlocks()})}
  else if(a==='edit')openEdit(listings.filter(function(x){return x.id===id})[0]);
  else if(a==='rmphoto'){photos.splice(+b.getAttribute('data-i'),1);renderPhotos()}});
document.addEventListener('change',function(ev){var b=ev.target.closest('[data-act="toggle"]');if(!b)return;
  sb.from('listings').update({active:b.checked}).eq('id',b.getAttribute('data-id')).then(function(r){if(r.error)toast(S.f_err);loadListings()})});
/* ---------- edit sheet ---------- */
var dlg=$('d-edit'),F=$('d-edit-form');
$('d-new').addEventListener('click',function(){openEdit(null)});
$('e-cancel').addEventListener('click',closeEdit);$('e-x').addEventListener('click',closeEdit);
function closeEdit(){if(dlg.close)dlg.close();else dlg.removeAttribute('open')}
function setv(id,v){$(id).value=v==null?'':v}
function openEdit(x){editing=x||null;x=x||{category:'ski',pickup:true,delivery:false,active:true,clothing_sizes:[],photos:[],place:(profile&&profile.place)||''};
  setv('e-cat',x.category);setv('e-title',t(x.title));setv('e-desc',t(x.description));setv('e-price',x.price_per_day);setv('e-dep',x.deposit);
  setv('e-shoe1',x.shoe_eu_min!=null?Math.round(x.shoe_eu_min):'');setv('e-shoe2',x.shoe_eu_max!=null?Math.round(x.shoe_eu_max):'');setv('e-ski',x.ski_length_cm);setv('e-h1',x.fits_height_min);setv('e-h2',x.fits_height_max);
  document.querySelectorAll('#e-cloth input').forEach(function(c){c.checked=(x.clothing_sizes||[]).indexOf(c.value)>=0});
  var known=NK.places.some(function(p){return p[0]===x.place});$('e-place').value=known?x.place:(x.place?'__other':'');$('e-place2').value=known?'':(x.place||'');togPlace();
  gps=x.lat!=null&&!known?[x.lat,x.lng]:null;$('e-gps-ok').hidden=!gps;
  $('e-deliv').checked=!!x.delivery;setv('e-dper',x.delivery_price_per_km);setv('e-dmax',x.delivery_max_km);setv('e-dmin',x.delivery_min_price);togDeliv();$('e-dl').open=!!x.delivery;
  var w=x.pickup_windows||{weekday:{from:'16:00',to:'20:00'},weekend:{from:'10:00',to:'18:00'}};setWin('wd',w.weekday);setWin('we',w.weekend);setv('e-ret',x.return_by||'18:00');setv('e-note',x.handover_note);
  var pv=editing&&priv[editing.id];setv('e-addr',pv&&pv.pickup_address);$('e-addr-approx').hidden=!(pv&&pv.address_is_approx);
  mps=(x.meeting_points||[]).map(function(m){return{name:m.name,lat:m.lat,lng:m.lng}});mpActive=-1;renderMps();$('e-mp').open=mps.length>0;
  $('e-active').checked=x.active!==false;$('e-instant').checked=x.instant_book!==false;$('e-bl').hidden=!editing;if(editing)loadBlocks();
  $('e-del').hidden=!editing;photos=(x.photos||[]).map(function(p){return{path:p}});renderPhotos();
  $('e-sizes').open=!!(x.shoe_eu_min||x.ski_length_cm||x.fits_height_min||(x.clothing_sizes||[]).length);
  if(dlg.showModal)dlg.showModal();else dlg.setAttribute('open','')}
function togPlace(){$('e-place2w').hidden=$('e-place').value!=='__other'}
function togDeliv(){var on=$('e-deliv').checked;$('e-dlw').hidden=!on;$('e-dper').required=on;$('e-dmax').required=on}
$('e-deliv').addEventListener('change',togDeliv);
function setWin(k,w){$('e-'+k+'1').value=w?w.from:'';$('e-'+k+'2').value=w?w.to:'';$('e-'+k+'x').checked=!w}
function getWin(k){if($('e-'+k+'x').checked)return null;var a=$('e-'+k+'1').value,b=$('e-'+k+'2').value;return a&&b&&b>a?{from:a,to:b}:null}
$('e-presets').addEventListener('click',function(ev){var b=ev.target.closest('[data-pre]');if(!b)return;var p=b.getAttribute('data-pre').split('|');
  setWin('wd',{from:p[0].split('-')[0],to:p[0].split('-')[1]});setWin('we',{from:p[1].split('-')[0],to:p[1].split('-')[1]})});
var mpMap=null,mpLayer=null;
function renderMps(){$('e-mps').innerHTML=mps.map(function(m,i){return '<div class="mp'+(i===mpActive?' on':'')+'"><input data-mpn="'+i+'" maxlength="80" placeholder="'+esc(S.f_meet_name)+'" value="'+esc(m.name)+'">'+
  '<div class="dla"><button type="button" class="linkbtn" data-mpp="'+i+'">📍 '+(m.lat!=null?m.lat.toFixed(4)+', '+m.lng.toFixed(4):S.f_meet_pin)+'</button><button type="button" class="linkbtn danger" data-mpx="'+i+'">×</button></div></div>'}).join('');
  $('e-mp-add').hidden=mps.length>=6;drawMpMap()}
function drawMpMap(){var L=window.L,box=$('e-mpmap');if(!L)return;var show=mps.length>0;box.hidden=!show;$('e-mp-hint').hidden=!show;if(!show)return;
  if(!mpMap){mpMap=L.map(box,{scrollWheelZoom:false}).setView([69.3,19.4],8);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; OpenStreetMap'}).addTo(mpMap);mpLayer=L.layerGroup().addTo(mpMap);
    mpMap.on('click',function(e){var i=mpActive>=0?mpActive:mps.length-1;if(i<0)return;mps[i].lat=Math.round(e.latlng.lat*1e4)/1e4;mps[i].lng=Math.round(e.latlng.lng*1e4)/1e4;renderMps()})}
  mpLayer.clearLayers();var pts=[];mps.forEach(function(m,i){if(m.lat!=null){pts.push([m.lat,m.lng]);L.marker([m.lat,m.lng]).bindTooltip(m.name||String(i+1)).addTo(mpLayer)}});
  setTimeout(function(){mpMap.invalidateSize();if(pts.length===1)mpMap.setView(pts[0],12);else if(pts.length>1)mpMap.fitBounds(pts,{padding:[20,20]})},60)}
$('e-mp-add').addEventListener('click',function(){mps.push({name:'',lat:null,lng:null});mpActive=mps.length-1;renderMps();var q=document.querySelector('[data-mpn="'+mpActive+'"]');if(q)q.focus()});
$('e-mps').addEventListener('input',function(ev){var i=ev.target.getAttribute('data-mpn');if(i!=null)mps[+i].name=ev.target.value});
$('e-mps').addEventListener('click',function(ev){var p=ev.target.closest('[data-mpp]'),x=ev.target.closest('[data-mpx]');
  if(p){mpActive=+p.getAttribute('data-mpp');renderMps()}if(x){mps.splice(+x.getAttribute('data-mpx'),1);mpActive=-1;renderMps()}});
function loadBlocks(){if(!editing)return;var lid=editing.id;sb.from('listing_blocks').select('id,date_from,date_to').eq('listing_id',lid).gte('date_to',new Date().toISOString().slice(0,10)).order('date_from').then(function(r){
  if(!editing||editing.id!==lid)return;var l=r.data||[];$('e-blocks').innerHTML=l.length?l.map(function(b){return '<div class="dla"><span>🚫 '+dmy(b.date_from)+' – '+dmy(b.date_to)+'</span><button type="button" class="linkbtn danger" data-act="rmblock" data-id="'+b.id+'">×</button></div>'}).join(''):'<p class="small">'+S.d_block_none+'</p>'})}
$('e-b-add').addEventListener('click',function(){var a=$('e-b1').value,b=$('e-b2').value||a;if(!editing||!a||b<a){toast(S.f_err);return}
  sb.from('listing_blocks').insert({listing_id:editing.id,owner_id:user.id,date_from:a,date_to:b}).then(function(r){if(r.error){toast(/23P01|overlap|booked/.test((r.error.code||'')+r.error.message)?S.d_block_err:S.f_err);return}$('e-b1').value=$('e-b2').value='';loadBlocks()})});
function geocode(q){if(!q)return Promise.resolve(null);return fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=no&q='+encodeURIComponent(q)).then(function(r){return r.json()}).then(function(a){return a&&a[0]?[+(+a[0].lat).toFixed(5),+(+a[0].lon).toFixed(5)]:null}).catch(function(){return null})}
$('e-place').addEventListener('change',togPlace);
var gps=null;
$('e-gps').addEventListener('click',function(){if(!navigator.geolocation)return;navigator.geolocation.getCurrentPosition(function(p){gps=[Math.round(p.coords.latitude*100)/100,Math.round(p.coords.longitude*100)/100];$('e-gps-ok').hidden=false},function(){toast(S.f_err)},{maximumAge:6e5,timeout:15000})});
function renderPhotos(){$('e-photos').innerHTML=photos.map(function(p,i){return '<div class="ph"><img src="'+esc(p.preview||photoUrl(p.path))+'" alt=""><button type="button" class="x" data-act="rmphoto" data-i="'+i+'" aria-label="'+esc(S.f_remove)+'">×</button></div>'}).join('');$('e-file').disabled=photos.length>=6}
$('e-file').addEventListener('change',function(){var fs=[].slice.call(this.files||[]).slice(0,6-photos.length);fs.forEach(function(f){photos.push({file:f,preview:URL.createObjectURL(f)})});this.value='';renderPhotos()});
function shrink(file){return (window.createImageBitmap?createImageBitmap(file,{imageOrientation:'from-image'}):Promise.reject()).then(function(bm){
  var k=Math.min(1,1600/Math.max(bm.width,bm.height)),c=document.createElement('canvas');c.width=Math.round(bm.width*k);c.height=Math.round(bm.height*k);
  c.getContext('2d').drawImage(bm,0,0,c.width,c.height);return new Promise(function(res){c.toBlob(function(b){res(b||file)},'image/jpeg',0.82)})}).catch(function(){return file})}
function uuid(){return (crypto.randomUUID&&crypto.randomUUID())||(Date.now().toString(36)+Math.random().toString(36).slice(2))}
function uploadAll(){return Promise.all(photos.map(function(p){if(p.path)return p.path;return shrink(p.file).then(function(blob){var path=user.id+'/'+uuid()+'.jpg';
  return sb.storage.from('listing-photos').upload(path,blob,{contentType:'image/jpeg',cacheControl:'31536000',upsert:false}).then(function(r){if(r.error)throw r.error;return path})})}))}
function num(id){var v=$(id).value;return v===''?null:+v}
F.addEventListener('submit',function(e){e.preventDefault();if(!F.checkValidity()){F.reportValidity();return}
  var btn=$('e-save');btn.disabled=true;btn.textContent=S.f_uploading;
  var pl=$('e-place').value==='__other'?$('e-place2').value.trim():$('e-place').value,pp=NK.places.filter(function(p){return p[0]===pl})[0];
  var lat=gps?gps[0]:(pp?pp[1]:null),lng=gps?gps[1]:(pp?pp[2]:null);
  var lang=(profile&&profile.language)||LG,title=$('e-title').value.trim(),desc=$('e-desc').value.trim();
  var T0=editing&&editing.title||{},D0=editing&&editing.description||{};
  var tObj=(editing&&t(T0)===title)?T0:{};if(t(T0)!==title){tObj={};tObj[lang]=title}
  var dObj=(editing&&t(D0)===desc)?D0:{};if(t(D0)!==desc){dObj={};if(desc)dObj[lang]=desc}
  var s1=num('e-shoe1'),s2=num('e-shoe2');if(s1&&!s2)s2=s1;if(s2&&!s1)s1=s2;var h1=num('e-h1'),h2=num('e-h2');
  uploadAll().then(function(paths){
    var v={category:$('e-cat').value,source_lang:lang,title:tObj,description:dObj,price_per_day:num('e-price'),deposit:num('e-dep'),
      shoe_eu_min:s1,shoe_eu_max:s2,clothing_sizes:[].slice.call(document.querySelectorAll('#e-cloth input:checked')).map(function(c){return c.value}),
      ski_length_cm:num('e-ski'),fits_height_min:h1,fits_height_max:h2||h1,place:pl||'Troms',lat:lat,lng:lng,pickup:true,instant_book:$('e-instant').checked,delivery:$('e-deliv').checked,photos:paths,active:$('e-active').checked,
      delivery_price_per_km:$('e-deliv').checked?num('e-dper'):num('e-dper'),delivery_max_km:num('e-dmax'),delivery_min_price:num('e-dmin'),
      meeting_points:mps.filter(function(m){return m.name.trim()&&m.lat!=null}).map(function(m){return{name:m.name.trim().slice(0,80),lat:m.lat,lng:m.lng}}),
      pickup_windows:{weekday:getWin('wd'),weekend:getWin('we')},return_by:$('e-ret').value||'18:00',handover_note:$('e-note').value.trim()||null};
    var q=editing?sb.from('listings').update(v).eq('id',editing.id).select('id').single():sb.from('listings').insert(Object.assign({owner_id:user.id},v)).select('id').single();
    return q.then(function(r){if(r.error)throw r.error;var id=r.data.id,addr=$('e-addr').value.trim(),old=priv[id];
      if(!addr&&!old)return r;if(old&&old.pickup_address===addr)return r;
      return geocode(addr).then(function(g){var pv={listing_id:id,owner_id:user.id,pickup_address:addr||null,pickup_lat:g?g[0]:lat,pickup_lng:g?g[1]:lng,address_is_approx:!addr};
        return sb.from('listing_private').upsert(pv,{onConflict:'listing_id'})})})
  }).then(function(r){if(r&&r.error)throw r.error;closeEdit();toast(S.d_saved);loadListings()}).catch(function(err){console.error(err);toast(S.f_err+(err&&err.message?' ('+err.message+')':''))})
  .then(function(){btn.disabled=false;btn.textContent=S.f_save})});
$('e-del').addEventListener('click',function(){if(!editing||!confirm(S.d_conf_delete))return;
  var own=(editing.photos||[]).filter(function(p){return p.indexOf(user.id+'/')===0});
  sb.from('listings').delete().eq('id',editing.id).then(function(r){if(r.error){toast(S.f_err);return}if(own.length)sb.storage.from('listing-photos').remove(own);closeEdit();loadListings()})});
/* ---------- web push ---------- */
var isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
var standalone=(window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||navigator.standalone===true;
function b64u(s){s=s.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';var b=atob(s),a=new Uint8Array(b.length);for(var i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a}
function notifState(st){['d-n-ios','d-n-btn','d-n-on','d-n-denied','d-n-unsup'].forEach(function(i){show(i,false)});show(st,true);show('d-n-test',st==='d-n-on')}
function initNotif(){var ok='serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
  if(!ok){notifState(isIOS&&!standalone?'d-n-ios':'d-n-unsup');return}
  if(Notification.permission==='denied'){notifState('d-n-denied');return}
  navigator.serviceWorker.ready.then(function(reg){return reg.pushManager.getSubscription()}).then(function(s){
    if(s&&Notification.permission==='granted'){saveSub(s);notifState('d-n-on')}else notifState('d-n-btn')})}
function saveSub(s){var j=s.toJSON();return sb.from('push_subscriptions').upsert({user_id:user.id,endpoint:j.endpoint,p256dh:j.keys.p256dh,auth:j.keys.auth,user_agent:navigator.userAgent.slice(0,300)},{onConflict:'endpoint'})}
$('d-n-btn').addEventListener('click',function(){var b=this;b.disabled=true;
  Notification.requestPermission().then(function(p){if(p!=='granted'){notifState(p==='denied'?'d-n-denied':'d-n-btn');b.disabled=false;return}
    return navigator.serviceWorker.ready.then(function(reg){return reg.pushManager.getSubscription().then(function(old){return old||reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u(A.vapid)})})})
    .then(function(s){return saveSub(s).then(function(r){if(r.error){return s.unsubscribe().then(function(){return navigator.serviceWorker.ready}).then(function(reg){return reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u(A.vapid)})}).then(saveSub)}return r})})
    .then(function(){notifState('d-n-on');b.disabled=false;fn('test-push')})}).catch(function(e){console.error(e);b.disabled=false;toast(S.f_err)})});
$('d-n-test').addEventListener('click',function(){fn('test-push').then(function(j){toast(S.d_notif_tested.replace('{n}',j.sent||0))})});
/* ---------- payouts (Stripe Connect, behind flag) ---------- */
function initPay(){if(!A.payments){show('d-pay-on',false);show('d-pay-off',true);return}
  show('d-pay-on',true);show('d-pay-off',false);
  fn('stripe-connect',{action:'status',lang:LG}).then(function(j){show('d-pay-ok',!!j.charges_enabled);show('d-pay-btn',!j.charges_enabled);if(j.connected&&!j.charges_enabled)$('d-pay-btn').textContent=S.d_pay_pending})}
$('d-pay-btn').addEventListener('click',function(){var b=this;b.disabled=true;fn('stripe-connect',{action:'onboard',lang:LG}).then(function(j){if(j.url)location.href=j.url;else{b.disabled=false;toast(S.f_err)}})});
/* refresh when a push arrives or the app comes back */
if(navigator.serviceWorker)navigator.serviceWorker.addEventListener('message',function(e){if(e.data&&e.data.type==='nk-push'&&user)loadReqs()});
document.addEventListener('visibilitychange',function(){if(!document.hidden&&user)loadReqs()});
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(function(){});
})();