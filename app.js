'use strict';
const $=s=>document.querySelector(s);
const escapeHTML=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={ready:false,point:null,radius:1000,map:null,marker:null,geocoder:null,Place:null,busy:false,version:0,queryKey:'',fetched:[],seen:new Set(),occasion:'all',intent:'any',cuisineChoice:'all',cuisine:[],meal:[],lastCategory:null,budget:'all',allowUnknown:false,attempted:new Set(),current:null};
const illustration=$('#result-panel img').getAttribute('src');
const locMsg=t=>$('#location-status').textContent=t;
const msg=t=>$('#app-message').textContent=t;
const configMsg=t=>$('#google-status').textContent=t;
const mapURL=(lat,lon)=>'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(lat+','+lon);
const distance=(a,b)=>{const d=Math.PI/180,x=(b.lat-a.lat)*d,y=(b.lng-a.lng)*d,z=Math.sin(x/2)**2+Math.cos(a.lat*d)*Math.cos(b.lat*d)*Math.sin(y/2)**2;return 6371000*2*Math.asin(Math.min(1,Math.sqrt(z)));};
function requireGoogle(){if(state.ready)return true;msg('地圖尚未就緒，請稍候；若持續無法載入，請查看上方提示');return false;}
window.gm_authFailure=()=>{state.ready=false;state.busy=false;$('#recommend-btn').disabled=false;configMsg('Google 驗證失敗：請確認網站限制、API 啟用狀態與計費帳戶。修正後重新整理。');$('#map-fallback').classList.remove('hidden');};
function timeout(promise,ms=15000){return new Promise((resolve,reject)=>{const id=setTimeout(()=>reject(new Error('連線逾時，請稍後重試')),ms);Promise.resolve(promise).then(v=>{clearTimeout(id);resolve(v)},e=>{clearTimeout(id);reject(e)});});}
window.initGoogleTest=async()=>{
 try{
  const [{Map},{Geocoder},{Place},{AdvancedMarkerElement}]=await Promise.all([google.maps.importLibrary('maps'),google.maps.importLibrary('geocoding'),google.maps.importLibrary('places'),google.maps.importLibrary('marker')]);
  state.geocoder=new Geocoder();state.Place=Place;
  state.map=new Map($('#inline-map'),{center:state.point||{lat:25.033,lng:121.5654},zoom:15,mapId:'DEMO_MAP_ID',mapTypeControl:false,streetViewControl:false,fullscreenControl:true,clickableIcons:false,gestureHandling:'greedy'});
  state.marker=new AdvancedMarkerElement({map:state.map,position:state.point||{lat:25.033,lng:121.5654},title:'搜尋位置'});
  state.map.addListener('center_changed',()=>{const c=state.map.getCenter();state.marker.position=c;$('#map-preview-status').textContent='候選位置：'+c.lat().toFixed(5)+', '+c.lng().toFixed(5)+'（按確認套用）';});
  state.map.addListener('click',e=>state.map.panTo(e.latLng));
  state.ready=true;configMsg('地圖已就緒，請設定搜尋位置');
  if(state.point)resolveAddress(state.point);msg('Google 已連接，請先設定位置');
 }catch(e){configMsg('Google 元件載入失敗，請檢查 API 設定並重新整理。');$('#map-fallback').classList.remove('hidden');}
};
function bootGoogle(){
 const key=String(window.NI_CHI_SHA_CONFIG?.googleMapsApiKey||'').trim();
 if(!key||key==='YOUR_GOOGLE_MAPS_API_KEY'){configMsg('網站尚未完成地圖設定，請站長在 config.js 填入網站金鑰後重新上傳。');$('#map-fallback').classList.remove('hidden');return;}
 if(location.protocol==='file:'){configMsg('請透過已授權的網站網址開啟，不支援直接開啟本機 HTML。');return;}
 const script=document.createElement('script');script.async=true;
 script.src='https://maps.googleapis.com/maps/api/js?key='+encodeURIComponent(key)+'&loading=async&callback=initGoogleTest&v=weekly&language=zh-TW&region=TW';
 script.onerror=()=>{configMsg('地圖載入失敗，請確認網路後重新整理');$('#map-fallback').classList.remove('hidden');};
 document.head.appendChild(script);
 setTimeout(()=>{if(!state.ready)configMsg('地圖尚未就緒。請檢查網路、網站金鑰限制、API 與計費設定後重新整理。');},20000);
}
function setPoint(lat,lng,label,reverse=true){
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180){locMsg('座標無效');return;}
 const p={lat,lng,label};state.point=p;state.version++;state.queryKey='';state.fetched=[];state.seen.clear();state.attempted.clear();state.current=null;state.searchBatch=0;
 locMsg('已設定：'+label+'（'+lat.toFixed(5)+', '+lng.toFixed(5)+'）');$('#map-preview-status').textContent=label;$('#address').value=reverse?'':label;
 const link=$('#location-google-link');link.href=mapURL(lat,lng);link.classList.remove('hidden');
 if(state.map){state.map.panTo(p);state.map.setZoom(16);state.marker.position=p;}
 $('#result-subtitle').textContent='位置已更新，請重新推薦';
 $('#result-panel').className='result-panel empty';$('#result-panel').innerHTML='<div class="empty-illustration"><img src="'+illustration+'" alt="餐廳店面插畫"></div><div class="empty-message"><h3>搜尋位置已設定</h3><p>按「今天吃這間」，尋找附近餐廳</p></div>';
 if(reverse&&state.ready)resolveAddress(p);
}
async function resolveAddress(p){
 locMsg('位置已取得，正在確認附近地址…');
 try{const {results}=await timeout(state.geocoder.geocode({location:{lat:p.lat,lng:p.lng}}));if(state.point!==p)return;if(!results.length)throw Error('無地址');p.label=results[0].formatted_address;$('#address').value=p.label;$('#map-preview-status').textContent=p.label;locMsg('所選位置附近地址：'+p.label);}
 catch(e){if(state.point===p)locMsg('座標已設定，但地址查詢失敗；仍可搜尋附近餐廳。請確認 Geocoding API 設定。');}
}
$('#locate-btn').addEventListener('click',()=>{
 if(!requireGoogle())return;if(!navigator.geolocation){locMsg('瀏覽器不支援定位，請輸入地址或地圖選點');return;}
 const button=$('#locate-btn');button.disabled=true;locMsg('正在定位，請允許瀏覽器使用位置');
 navigator.geolocation.getCurrentPosition(p=>{button.disabled=false;setPoint(p.coords.latitude,p.coords.longitude,'目前位置');},e=>{button.disabled=false;locMsg(e.code===1?'定位權限未開啟，請允許位置權限，或輸入地址／地圖選點':'無法取得位置，請輸入地址或地圖選點');},{enableHighAccuracy:true,timeout:15000,maximumAge:60000});
});
$('#address-form').addEventListener('submit',async e=>{
 e.preventDefault();if(!requireGoogle())return;const q=$('#address').value.trim();if(q.length<2)return;
 const c=q.match(/^(-?\d+(?:\.\d+)?)\s*[,，]\s*(-?\d+(?:\.\d+)?)$/);if(c){setPoint(Number(c[1]),Number(c[2]),'手動座標');return;}
 const button=$('#address-form button');button.disabled=true;const version=++state.version;locMsg('正在搜尋地址／地標…');
 try{const {results}=await timeout(state.geocoder.geocode({address:q,region:'TW'}));if(version!==state.version)return;if(!results.length)throw Error('找不到地點');const r=results[0];setPoint(r.geometry.location.lat(),r.geometry.location.lng(),r.formatted_address,false);}
 catch(e){if(version===state.version)locMsg('地址查詢失敗，請補上縣市、改用座標或地圖選點，並確認 Geocoding API 已啟用');}finally{button.disabled=false;}
});
$('#map-btn').addEventListener('click',()=>{if(requireGoogle()){$('#inline-map').scrollIntoView({behavior:'smooth',block:'center'});locMsg('在地圖內單指拖曳選位置，選好後按「選取圖釘位置」');}});
$('#inline-select-btn').addEventListener('click',()=>{if(!requireGoogle())return;const p=state.map.getCenter();setPoint(p.lat(),p.lng(),'地圖選點');});
document.querySelectorAll('[data-radius]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-radius]').forEach(x=>{x.classList.remove('selected');x.setAttribute('aria-pressed','false');});b.classList.add('selected');b.setAttribute('aria-pressed','true');state.radius=Number(b.dataset.radius);state.queryKey='';state.version++;}));
function criteriaChanged(){state.lastCategory=null;state.searchBatch=0;state.version++;state.queryKey='';state.seen.clear();state.attempted.clear();state.current=null;$('#result-subtitle').textContent='條件已更新，請按「今天吃這間」重新推薦';showEmpty('條件已更新','按「今天吃這間」套用新偏好與預算');}
function updateIntentOptions(){
 const tea=state.occasion==='tea';
 const options=tea?[['sweet','🍰','甜點','蛋糕、甜點'],['savory','🥪','鹹食','三明治、輕食'],['drink','☕','飲品','咖啡、茶飲'],['any','🎲','都可以','交給我們選']]:[['rice','🍚','想吃飯','便當、丼飯、飯類'],['noodle','🍜','想吃麵','麵店、拉麵、義大利麵'],['soup','🍲','想喝熱湯','湯品、鍋物'],['meat','🥩','想大口吃肉','燒肉、牛排、烤肉'],['light','🥗','想清爽一點','沙拉、輕食'],['any','🎲','沒想法，幫我選','附近找一間，換家有變化']];
 if(!options.some(o=>o[0]===state.intent))state.intent='any';
 document.querySelector('[data-select="intent"]').querySelectorAll('button').forEach((b,i)=>{
  b.hidden=!options[i];b.classList.toggle('hidden',!options[i]);
  if(!options[i])return;
  const [value,icon,title,description]=options[i];b.dataset.value=value;
  b.querySelector('span').textContent=icon;b.querySelector('strong').textContent=title;b.querySelector('small').textContent=description;
 });
}
function syncPreference(){
 state.meal=state.intent==='any'?[]:[state.intent];
 state.cuisine=['all','other'].includes(state.cuisineChoice)?[]:[state.cuisineChoice];
 document.querySelectorAll('[data-select="intent"], [data-select="cuisineChoice"], [data-select="occasion"]').forEach(group=>{
  group.querySelectorAll('button').forEach(b=>{const selected=b.dataset.value===state[group.dataset.select];b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',selected?'true':'false');});
 });
 const other=state.cuisineChoice==='other';$('#cuisine-other').classList.toggle('hidden',!other);$('#cuisine-other-label').classList.toggle('hidden',!other);
 $('#cuisine-summary').textContent=other?($('#cuisine-other').value.trim()||'其他'):state.cuisineChoice==='all'?'不限':LABELS[state.cuisineChoice];
}
document.querySelectorAll('[data-select]').forEach(group=>{
 const key=group.dataset.select;
 group.querySelectorAll('button').forEach(b=>{
  b.setAttribute('aria-pressed',b.classList.contains('selected')?'true':'false');
  b.addEventListener('click',()=>{
   state[key]=b.dataset.value;
   if(key==='occasion')updateIntentOptions();
   group.querySelectorAll('button').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',x===b?'true':'false');});
   if(key==='budget'){const custom=state.budget==='custom';$('#custom-budget').classList.toggle('hidden',!custom);$('#custom-budget-label').classList.toggle('hidden',!custom);}
   syncPreference();criteriaChanged();
  });
 });
});
$('#cuisine-other').addEventListener('input',()=>{syncPreference();criteriaChanged();});
$('#allow-unknown').addEventListener('change',()=>{state.allowUnknown=$('#allow-unknown').checked;criteriaChanged();});
$('#custom-budget').addEventListener('input',criteriaChanged);
// Meal directions map to concrete search terms; unknown tags do not veto Google results.
const RULES={
 cuisine:{chinese:['chinese','taiwanese','中式','台式','便當'],japanese:['japanese','sushi','ramen','日式','壽司','拉麵','丼'],korean:['korean','韓式','韓國'],thai:['thai','泰式','泰國'],italian:['italian','pizza','義式','義大利','披薩'],american:['american','hamburger','steak','美式','漢堡','牛排'],vietnamese:['vietnamese','越式','越南'],indian:['indian','印度']},
 meal:{sweet:['dessert','cake','甜點','蛋糕'],savory:['sandwich','三明治','輕食'],drink:['cafe','coffee','tea','咖啡','茶'],rice:['rice','飯','便當','丼'],noodle:['noodle','ramen','pasta','麵'],soup:['soup','hot_pot','湯','鍋'],meat:['steak','barbecue','燒肉','牛排','烤肉'],light:['salad','sandwich','沙拉','輕食']}
};
const LABELS={sweet:'甜點',savory:'鹹食',drink:'飲品',chinese:'台式／中式',japanese:'日式',korean:'韓式',thai:'泰式',italian:'義式',american:'美式',vietnamese:'越式',indian:'印度',rice:'想吃飯',noodle:'想吃麵',soup:'想喝熱湯',meat:'想大口吃肉',light:'想清爽一點',any:'沒想法，幫我選'};
function textOf(p){return [p.displayName,...(p.types||[])].join(' ').toLowerCase();}
function matches(p,key,values){const text=textOf(p);return values.filter(v=>(RULES[key]?.[v]||[]).some(w=>text.includes(w)));}
function fit(p){
 const cuisine=matches(p,'cuisine',state.cuisine),meal=matches(p,'meal',state.meal);
 return {eligible:true,cuisine,meal,score:cuisine.length*8+meal.length*5-p.distance/state.radius};
}
function categoryOf(p){
 const cuisines=matches(p,'cuisine',Object.keys(RULES.cuisine));if(cuisines.length)return cuisines[0];
 const meals=matches(p,'meal',Object.keys(RULES.meal));if(meals.length)return meals[0];return null;
}
function budgetMax(){if(state.budget==='all')return Infinity;const n=Number(state.budget==='custom'?$('#custom-budget').value:state.budget);return Number.isFinite(n)&&n>=1&&n<=100000?n:NaN;}
function money(m){if(!m||m.currencyCode!=='TWD')return null;const n=Number(m.units||0)+Number(m.nanos||0)/1e9;return Number.isFinite(n)&&n>=0?n:null;}
function priceInfo(p){
 const lo=money(p.priceRange?.startPrice),hi=money(p.priceRange?.endPrice);
 if(lo!==null&&(hi===null||hi>=lo))return {known:true,lo,hi,label:hi===null?'NT$'+lo+' 起':lo<=1?'NT$'+hi+' 以下':'NT$'+lo+'–'+hi};
 const levels={FREE:'免費',INEXPENSIVE:'平價級別',MODERATE:'中等價位級別',EXPENSIVE:'較高價位級別',VERY_EXPENSIVE:'高價位級別'};
 return {known:false,label:levels[p.priceLevel]?(levels[p.priceLevel]+' · 台幣金額未確認'):'價格未確認'};
}
function withinBudget(info,max,allowUnknown){if(max===Infinity)return true;if(!info.known)return allowUnknown;return info.hi!==null&&info.hi<=max;}
function showEmpty(title,detail){$('#result-panel').className='result-panel empty';$('#result-panel').innerHTML='<div class="empty-illustration"><img src="'+illustration+'" alt="餐廳店面插畫"></div><div class="empty-message"><h3>'+escapeHTML(title)+'</h3><p>'+escapeHTML(detail)+'</p></div>';}
function safeURL(v){try{const u=new URL(v);return u.protocol==='https:'?u.href:'';}catch{return '';}}
function sourceLink(name,url){const href=safeURL(url);return href?'<a target="_blank" rel="noopener noreferrer" href="'+escapeHTML(href)+'">'+escapeHTML(name)+'</a>':escapeHTML(name);}
function sourceNotes(p){return (p.attributions||[]).map(a=>sourceLink(a.provider||'資料提供者',a.providerURI)).join(' · ');}
async function priceFor(p){
 if(p._priceChecked)return;
 await timeout(p.fetchFields({fields:['priceRange','priceLevel']}));p._priceChecked=true;
}
async function detailsFor(p){
 // Fetch photos from a fresh Place object for each display; no photo/URI storage.
 const details=new state.Place({id:p.id,requestedLanguage:'zh-TW',requestedRegion:'TW'});
 await timeout(details.fetchFields({fields:['rating','userRatingCount','photos','priceRange','priceLevel','currentOpeningHours','utcOffsetMinutes','businessStatus']}));
 return details;
}
function rankedCandidates(){return state.fetched.filter(p=>fit(p).eligible).sort((a,b)=>fit(b).score-fit(a).score);}
function withVariety(list){
 const remaining=[...list],out=[];let last=state.lastCategory;
 while(remaining.length){
  // Prefer a different known cuisine, while keeping the selected meal direction.
  let pool=remaining.filter(p=>categoryOf(p)&&categoryOf(p)!==last);
  if(state.intent!=='any')pool=pool.filter(p=>fit(p).meal.length);
  if(!pool.length)pool=remaining;
  const best=Math.max(...pool.map(p=>fit(p).score));const top=pool.filter(p=>fit(p).score>=best-1);
  const p=top[Math.floor(Math.random()*top.length)];out.push(p);remaining.splice(remaining.indexOf(p),1);last=categoryOf(p);
 }
 return out;
}
function offerRandomChoice(){
 if(state.intent==='any'&&state.cuisineChoice==='all')return;
 const b=document.createElement('button');b.className='button button-green';b.textContent='取消餐點與料理限制，幫我隨機選';
 b.addEventListener('click',()=>{state.intent='any';state.cuisineChoice='all';syncPreference();criteriaChanged();recommend();});$('#result-panel').appendChild(b);
}
function openingNow(p,at=new Date()){
 if(p.businessStatus&&p.businessStatus!=='OPERATIONAL')return 'closed';
 const periods=p.currentOpeningHours?.periods,offset=p.utcOffsetMinutes;
 if(!Array.isArray(periods)||!Number.isFinite(offset))return 'unknown';
 if(!periods.length)return 'closed';
 const local=new Date(at.getTime()+offset*60000),week=7*1440,now=local.getUTCDay()*1440+local.getUTCHours()*60+local.getUTCMinutes();
 const tick=q=>q&&Number.isInteger(q.day)&&q.day>=0&&q.day<=6&&Number.isInteger(q.hour)&&q.hour>=0&&q.hour<=23&&Number.isInteger(q.minute)&&q.minute>=0&&q.minute<=59?q.day*1440+q.hour*60+q.minute:null;
 let unknown=false;
 for(const period of periods){const a=tick(period.open),b=tick(period.close);
  if(a===null){unknown=true;continue;}
  if(!period.close){if(a===0&&periods.length===1)return 'open';unknown=true;continue;}
  if(b===null||a===b){unknown=true;continue;}
  const duration=(b-a+week)%week,elapsed=(now-a+week)%week;if(elapsed<duration)return 'open';
 }
 return unknown?'unknown':'closed';
}
async function availabilityFor(p){
 const d=new state.Place({id:p.id,requestedLanguage:'zh-TW',requestedRegion:'TW'});
 await timeout(d.fetchFields({fields:['currentOpeningHours','utcOffsetMinutes','businessStatus','priceRange','priceLevel']}));return d;
}
function continueSearchButton(label='繼續找本輪其他餐廳'){
 const b=document.createElement('button');b.className='button button-green';b.textContent=label;b.addEventListener('click',recommend);$('#result-panel').appendChild(b);
}
function moreSearchButton(){
 const b=document.createElement('button');b.className='button';b.textContent='換一批搜尋結果';b.addEventListener('click',()=>{state.searchBatch=(state.searchBatch||0)+1;state.queryKey='';state.attempted.clear();state.seen.clear();recommend();});$('#result-panel').appendChild(b);
}
async function pickOne(version,max){
 const candidates=withVariety(rankedCandidates().filter(p=>!state.seen.has(p.id)&&!state.attempted.has(p.id)));
 let checked=0,closed=0,unknown=0,priceRejected=0,failed=0;
 for(const p of candidates){
  if(version!==state.version)return;if(checked>=18)break;checked++;
  let info;
  try{msg('正在確認營業狀態與參考價位，已檢查 '+checked+' 間…');info=await availabilityFor(p);}catch(e){failed++;state.attempted.add(p.id);continue;}
  if(version!==state.version)return;
  const status=openingNow(info);
  if(status!=='open'){state.attempted.add(p.id);status==='closed'?closed++:unknown++;continue;}
  const price=priceInfo(info);
  if(!withinBudget(price,max,state.allowUnknown)){state.attempted.add(p.id);priceRejected++;continue;}
  let details=null,detailsFailed=false;
  try{msg('正在載入這間店的照片與評分…');details=await detailsFor(p);}catch(e){detailsFailed=true;}
  if(version!==state.version)return;
  // A second current-hours check catches a closing-time boundary during selection.
  if(details&&openingNow(details)!=='open'){state.attempted.add(p.id);closed++;continue;}
  const finalPrice=details?priceInfo(details):price;
  if(!withinBudget(finalPrice,max,state.allowUnknown)){state.attempted.add(p.id);priceRejected++;continue;}
  state.seen.add(p.id);state.current=p;state.lastCategory=categoryOf(p);renderPlace(p,details,finalPrice,detailsFailed,max);
  const warning=$('#result-panel .result-content');
  if(warning){const note=document.createElement('p');note.className='source-note';note.textContent='營業狀態檢查於 '+new Date().toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'})+'，依店家當地時區；臨時異動以店家為準。';warning.appendChild(note);}
  msg(detailsFailed?'已確認營業中的餐廳；照片與評分暫時載入失敗。':'已確認營業中與參考價位，可按「換一家」');return;
 }
 if(version!==state.version)return;
 const remaining=state.fetched.some(p=>!state.attempted.has(p.id)&&!state.seen.has(p.id));
 showEmpty(remaining?'已達本次檢查上限，還有店家尚未確認':'本輪候選已檢查完成，暫無符合條件的店家','已排除打烊 '+closed+' 間、營業時間未知 '+unknown+' 間、參考價位不符 '+priceRejected+' 間'+(failed?'，另有 '+failed+' 間查詢失敗':'')+'。'+(remaining?'本次最多自動檢查 18 間；可按繼續找，檢查剩餘候選。':'可換一批搜尋，或調整偏好。')+'不會自動提高預算或加入已打烊店家。');
 if(remaining)continueSearchButton();moreSearchButton();offerRandomChoice();msg(remaining?'已達本次檢查上限，尚未確認所有候選；可繼續找':'本輪候選已檢查完成，暫無可確認符合條件的店家');
}
function renderPlace(p,d,price,failed,max){
 const f=fit(p),metres=Math.round(p.distance),dist=metres<1000?metres+' 公尺':(metres/1000).toFixed(1)+' 公里';
 const reasons=['距離搜尋位置約 '+dist];
 if(!f.cuisine.length&&state.cuisine.length)reasons.push('已用你的料理偏好搜尋，店家詳細分類未完整提供');
 if(!f.meal.length&&state.meal.length)reasons.push('已用你的餐點偏好搜尋，實際菜單請確認');
 if(f.cuisine.length)reasons.push('店名／分類符合 '+f.cuisine.map(v=>LABELS[v]).join('、'));
 if(f.meal.length)reasons.push('餐點線索包含 '+f.meal.map(v=>LABELS[v]).join('、'));
 const tasteMissing=state.intent==='any'?'這次交給我們選；換一家時優先嘗試不同料理。':!f.meal.length?'依「'+LABELS[state.intent]+'」方向向 Google 搜尋，詳細餐點仍請查看店家菜單。':'';
 if(state.intent==='light')reasons.push('清爽是料理方向，未驗證低油或低熱量');
 const rating=Number.isFinite(d?.rating)?'★ '+d.rating.toFixed(1)+(Number.isFinite(d.userRatingCount)?'（'+d.userRatingCount+' 則評分）':''):(failed?'評分暫時無法載入':'尚無評分資料');
 const priceText='Google 參考消費：'+price.label+(max!==Infinity&&!price.known?' · 本次允許價格未知':max!==Infinity?' · 區間上限符合設定（非菜單核價）':'');
 const link=mapURL(p.location.lat(),p.location.lng())+'&query_place_id='+encodeURIComponent(p.id);
 $('#result-subtitle').textContent='本輪 '+state.fetched.length+' 間候選中，依餐點方向、料理與距離推薦';
 $('#result-panel').className='result-panel';$('#result-panel').innerHTML=`<div class="result-visual"><img id="place-photo" class="is-illustration" src="${illustration}" alt="店面插畫，非店家實拍"><span id="photo-caption" class="visual-caption">${failed?'照片暫時無法載入，先顯示插畫':'店家未提供照片時顯示插畫'}</span><div id="photo-authors" class="photo-attribution"></div></div><div class="result-content"><span class="result-kicker">TODAY'S SUGGESTION</span><h3 class="result-name">${escapeHTML(p.displayName)}</h3><div class="result-meta"><span>${escapeHTML(rating)}</span><span>距離約 ${escapeHTML(dist)}（直線）</span><span>目前營業中（依 Google 時間資料）</span></div><p class="result-details">${escapeHTML(p.formattedAddress||'地址未提供，請查看 Google 地圖')}</p><div class="result-price">${escapeHTML(priceText)}</div><div class="result-note"><strong>為什麼推薦這間？</strong><p>${escapeHTML(reasons.join('；'))}</p></div>${tasteMissing?'<p class="retry-note">'+escapeHTML(tasteMissing)+'</p>':''}<p class="result-disclaimer">價格來自 Google 參考消費區間，未核實菜單；不保證實際點餐總額。低消、服務費及臨時營業變更請向店家確認。</p><section class="review-panel" aria-label="Google 評論重點"><strong>評論重點</strong><p class="source-note">僅依 Google 回傳的部分評論整理，不代表所有顧客意見。</p><button class="button" id="load-reviews-btn">載入評論重點</button><div id="review-content" aria-live="polite"></div></section><div class="result-actions"><button class="button" id="next-btn">這間先不要，換一家 ↻</button><a class="button button-green" target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(p.location.lat()+','+p.location.lng())}&destination_place_id=${encodeURIComponent(p.id)}&travelmode=walking">就吃這家！帶我去 ↗</a><a class="button" target="_blank" rel="noopener noreferrer" href="${escapeHTML(link)}">看照片與評論 ↗</a></div><p class="source-note">餐廳資料、評分與照片來源：Google Maps<br>${sourceNotes(p)} ${d?sourceNotes(d):''}</p></div>`;
 $('#next-btn').addEventListener('click',recommend);
 $('#load-reviews-btn').addEventListener('click',()=>loadReviewTopics(p,state.version));
 if(d?.photos?.length){
  try{
   const photo=d.photos[0],url=safeURL(photo.getURI({maxWidth:800,maxHeight:600}));
   if(url){
    const img=$('#place-photo'),caption=$('#photo-caption'),authors=$('#photo-authors');
    const onFail=()=>{img.onerror=null;img.onload=null;img.src=illustration;img.classList.add('is-illustration');img.alt='店面插畫，非店家實拍';caption.textContent='照片無法載入，先顯示插畫';authors.innerHTML='';};
    img.onerror=onFail;img.onload=()=>{caption.textContent='店家照片 · Google Maps';};
    img.alt=p.displayName+' 的店家照片';img.classList.remove('is-illustration');caption.textContent='正在載入店家照片…';
    authors.innerHTML=(photo.authorAttributions||[]).map(a=>sourceLink(a.displayName||'照片作者',a.uri)).join(' · ');img.src=url;
   }
  }catch(e){$('#photo-caption').textContent='照片暫時無法載入，先顯示插畫';}
 }
 $('#results').scrollIntoView({behavior:'smooth',block:'start'});
}

// Neutral topics retain the complete source review, including negation and mixed opinions.
const REVIEW_TOPICS=[
 ['排隊／等候',/排隊|等候|等很久|候位|等待|queue|wait(?:ed|ing)?/i],
 ['份量',/份量|分量|吃不飽|吃得飽|portion/i],
 ['價格',/價格|價錢|價位|便宜|貴|划算|CP值|price|expensive|cheap/i],
 ['服務',/服務|店員|態度|service|staff/i],
 ['環境',/環境|座位|乾淨|衛生|吵|氣氛|clean|atmosphere|noisy/i],
 ['口味',/口味|好吃|難吃|美味|味道|偏鹹|太鹹|清淡|油膩|taste|delicious|salty/i]
];
function reviewTopics(reviews){
 const list=(reviews||[]).slice(0,5).filter(r=>typeof r.text==='string'&&r.text.trim());
 return {list,topics:REVIEW_TOPICS.map(([label,pattern])=>({label,count:list.filter(r=>pattern.test(r.text)).length})).filter(t=>t.count)};
}
function renderReviewTopics(reviews){
 const {list,topics}=reviewTopics(reviews);
 if(!list.length)return '<p>Google 此次未提供可讀的文字評論，可點「看照片與評論」查看。</p>';
 const tags=topics.length?'<div class="review-tags">'+topics.map(t=>'<span>'+escapeHTML(t.label)+' · '+t.count+' 則提及</span>').join('')+'</div>':'<p>這些評論未找到預設主題，可展開閱讀原文。</p>';
 return '<p class="source-note">本次取得 '+list.length+' 則文字評論（Google 最多回傳 5 則）。主題僅代表提及，未判定正負面，也不是全店評論統計。</p>'+tags+'<details><summary>查看本次評論原文與作者</summary>'+list.map(r=>{
 const author=r.authorAttribution||{},href=safeURL(r.googleMapsURI)||safeURL(author.uri),name=author.displayName||'Google 評論者';
 return '<article class="review-source"><p>'+sourceLink(name,href)+(Number.isFinite(r.rating)?' · '+escapeHTML(r.rating)+' 星':'')+(r.relativePublishTimeDescription?' · '+escapeHTML(r.relativePublishTimeDescription):'')+'</p><p class="review-text">'+escapeHTML(r.text)+'</p>'+(safeURL(r.googleMapsURI)?sourceLink('查看此則 Google Maps 評論',r.googleMapsURI):'')+'</article>';
 }).join('')+'</details><p class="source-note">來源：Google Maps · '+sourceLink('Google 評論政策','https://support.google.com/contributionpolicy/answer/7400114')+'</p>';
}
async function loadReviewTopics(p,version){
 const button=$('#load-reviews-btn'),content=$('#review-content');
 if(button.disabled)return;button.disabled=true;button.textContent='正在載入評論…';
 try{
  const detail=new state.Place({id:p.id,requestedLanguage:'zh-TW',requestedRegion:'TW'});
  await timeout(detail.fetchFields({fields:['reviews']}));
  if(version!==state.version||state.current?.id!==p.id||$('#review-content')!==content)return;
  content.innerHTML=renderReviewTopics(detail.reviews);button.textContent='評論已載入';
 }catch(e){
  if(version!==state.version||state.current?.id!==p.id||$('#review-content')!==content)return;
  content.textContent='評論暫時無法載入；你仍可查看 Google Maps 原始評論。';button.disabled=false;button.textContent='重試載入評論';
 }
}

function searchPlans(){
 const cuisine=state.cuisineChoice==='other'?$('#cuisine-other').value.trim():state.cuisineChoice==='all'?'':LABELS[state.cuisineChoice];
 const terms={sweet:['甜點店','蛋糕店'],savory:['咖啡廳 鹹食','三明治 輕食'],drink:['咖啡廳','茶館'],any:['餐廳'],rice:['便當','丼飯','飯類餐廳'],noodle:['麵店','拉麵','義大利麵'],soup:['湯品','火鍋'],meat:['燒肉','牛排','烤肉'],light:['沙拉','輕食']};
 let choices=terms[state.intent]||terms.any;
 if(state.cuisineChoice==='japanese'&&state.occasion!=='tea')choices={rice:['日式丼飯','日式咖哩飯'],noodle:['拉麵','烏龍麵','蕎麥麵'],soup:['日式鍋物','日式湯品'],meat:['日式燒肉','日式牛排'],light:['日式沙拉','日式輕食'],any:['日式餐廳']}[state.intent];
 if(state.cuisineChoice==='italian'&&state.intent==='noodle')choices=['義大利麵'];
 if(state.occasion==='breakfast')choices=state.intent==='any'?['早餐店','早餐 蛋餅','早餐 三明治']:choices.map(t=>'早餐 '+t);
 if(state.occasion==='brunch')choices=state.intent==='any'?['早午餐']:choices.map(t=>'早午餐 '+t);
 if(state.occasion==='tea'&&state.intent==='any')choices=['咖啡廳','甜點店','茶館'];
 if(state.occasion==='late')choices=state.intent==='any'?['宵夜']:choices.map(t=>'宵夜 '+t);
 return [...new Set(choices.map(term=>[cuisine,term].filter(Boolean).join(' ')))];
}
async function recommend(){
 if(!requireGoogle()||state.busy)return;
 if(!state.point){msg('請先定位、輸入地址或確認地圖選點');$('#location').scrollIntoView({behavior:'smooth'});return;}
 if(state.cuisineChoice==='other'&&!$('#cuisine-other').value.trim()){msg('請填入料理名稱，或選「不限」');$('#cuisine-other').focus();return;}
 const max=budgetMax();if(Number.isNaN(max)){msg('請輸入有效的每人預算上限（NT$1–100,000）');$('#custom-budget').focus();return;}
 const point={...state.point},radius=state.radius,version=state.version,plans=searchPlans(),batch=state.searchBatch||0;
 const start=(batch*3)%plans.length,queries=[];for(let i=0;i<Math.min(3,plans.length);i++)queries.push(plans[(start+i)%plans.length]);
 const key=JSON.stringify([point.lat,point.lng,radius,queries,batch]);
 state.busy=true;$('#recommend-btn').disabled=true;const next=$('#next-btn');if(next)next.disabled=true;
 try{
  if(state.queryKey!==key||Date.now()-state.queryAt>60000){
   msg('正在依你的偏好搜尋目前營業中的店家…');
   const found=[],errors=[];
   const circle={center:{lat:point.lat,lng:point.lng},radius};
   for(const query of queries){
    if(version!==state.version)return;
    try{
     const {places}=await timeout(state.Place.searchByText({fields:['id','displayName','location','formattedAddress','types','businessStatus'],textQuery:query,isOpenNow:true,locationBias:circle,...(state.occasion==='tea'?{}:{includedType:'restaurant'}),useStrictTypeFiltering:false,maxResultCount:20,language:'zh-TW',region:'TW'}),20000);
     found.push(...(places||[]));
    }catch(e){errors.push(e);}
   }
   if(version!==state.version)return;if(!found.length&&errors.length)throw errors[0];
   const unique=new Map();
   for(const p of found){if(!p.location||p.businessStatus==='CLOSED_PERMANENTLY'||p.businessStatus==='CLOSED_TEMPORARILY')continue;p.distance=distance(point,{lat:p.location.lat(),lng:p.location.lng()});if(p.distance<=radius&&!unique.has(p.id))unique.set(p.id,p);}
   let list=[...unique.values()];
   // Explicitly requested new batch changes order; additional terms are rotated first.
   if(batch&&list.length){const offset=(batch*6)%list.length;list=list.slice(offset).concat(list.slice(0,offset));}
   state.fetched=list;state.seen.clear();state.attempted.clear();state.queryKey=key;state.queryAt=Date.now();
   if(!list.length){showEmpty('此範圍沒有找到符合搜尋的營業中店家','Google 地圖的結果可能使用不同排序與範圍。可取消部分偏好、換一批搜尋或手動擴大到 2 公里；不會偷偷擴大範圍。');moreSearchButton();offerRandomChoice();msg('文字搜尋已完成，未找到範圍內的目前營業中店家');return;}
  }
  if(version===state.version)await pickOne(version,max);
 }catch(e){if(version===state.version){state.queryKey='';showEmpty('搜尋服務暫時無法使用','請稍後再試；查詢失敗不代表附近沒有餐廳');msg('Google 搜尋或營業資訊查詢失敗，請稍後重試');}}
 finally{state.busy=false;$('#recommend-btn').disabled=false;const n=$('#next-btn');if(n)n.disabled=false;if(version!==state.version)msg('條件或位置已變更，請重新推薦');}
}
$('#recommend-btn').addEventListener('click',recommend);

bootGoogle();
