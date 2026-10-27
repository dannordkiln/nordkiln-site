(function(){var NK=window.NK,S=NK.s,A=NK.api,LG=NK.lang,$=function(i){return document.getElementById(i)};
function t(o){if(!o)return'';return o[LG]||o.en||o.no||o[Object.keys(o)[0]]||''}
function dm(v){var p=v.split('-');return (+p[2])+'.'+(+p[1])+'.'}
var tok=(location.hash.match(/t=([\w.-]+)/)||[])[1]||'',box=$('rv-box'),msg=$('rv-msg');
function say(m,cls){msg.textContent=m;msg.className=cls||'err';msg.hidden=false}
document.querySelectorAll('.stars').forEach(function(g){g.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;var v=+b.getAttribute('data-v');g.setAttribute('data-val',v);
  g.querySelectorAll('button').forEach(function(x){var on=+x.getAttribute('data-v')<=v;x.classList.toggle('on',on);x.setAttribute('aria-pressed',on)})})});
var ta=$('rv-body'),cnt=$('rv-cnt');ta.addEventListener('input',function(){cnt.textContent=ta.value.length+'/500'});
if(!A||!tok){say(S.rv_invalid);return}
fetch(A.url+'/functions/v1/review?t='+encodeURIComponent(tok),{headers:{apikey:A.key}}).then(function(r){return r.json()}).then(function(j){
  if(!j.ok){say(S.rv_invalid);return}
  $('rv-intro').textContent=S.rv_page_intro.replace('{name}',j.first_name).replace('{item}',t(j.title)).replace('{dates}',dm(j.date_from)+'–'+dm(j.date_to));
  if(j.done){say(S.rv_done,'ok');return}if(j.too_early){say(S.rv_early);return}box.hidden=false}).catch(function(){say(S.rv_invalid)});
$('rv-form').addEventListener('submit',function(e){e.preventDefault();var v=function(id){return +($(id).getAttribute('data-val')||0)};
  var body={t:tok,rating:v('rv-r'),rating_gear:v('rv-g'),rating_handover:v('rv-h'),body:ta.value.trim(),language:LG};
  if(!body.rating||!body.rating_gear||!body.rating_handover){say(S.rv_need);return}
  var btn=this.querySelector('button[type=submit]');btn.disabled=true;
  fetch(A.url+'/functions/v1/review',{method:'POST',headers:{'Content-Type':'application/json',apikey:A.key},body:JSON.stringify(body)}).then(function(r){return r.json()}).then(function(j){btn.disabled=false;
    if(j.ok){box.hidden=true;say(S.rv_thanks_h+' '+S.rv_thanks_p,'ok');$('rv-see').hidden=false;return}
    var f=j.fields||[];say(j.error==='already'?S.rv_done:f.indexOf('language')>=0?S.rv_err_lang:f.indexOf('contact_info')>=0?S.rv_err_contact:j.error==='invalid_link'?S.rv_invalid:S.rv_need)})
  .catch(function(){btn.disabled=false;say(S.b_invalid)})});
})();