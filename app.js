'use strict';
const $=s=>document.querySelector(s);
const escapeHTML=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={ready:false,point:null,radius:1000,map:null,marker:null,geocoder:null,Place:null,busy:false,version:0,queryKey:'',fetched:[],seen:new Set(),mood:null,flavor:[],cuisine:[],meal:[],budget:'all',allowUnknown:false,attempted:new Set(),current:null};
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
 const p={lat,lng,label};state.point=p;state.version++;state.queryKey='';state.fetched=[];state.seen.clear();state.attempted.clear();state.current=null;
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
function criteriaChanged(){state.version++;state.seen.clear();state.attempted.clear();state.current=null;$('#result-subtitle').textContent='條件已更新，請按「今天吃這間」重新推薦';showEmpty('條件已更新','按「今天吃這間」套用新偏好與預算');}
document.querySelectorAll('[data-select]').forEach(group=>{
 const key=group.dataset.select;
 group.querySelectorAll('button').forEach(b=>{
  b.setAttribute('aria-pressed',b.classList.contains('selected')?'true':'false');
  b.addEventListener('click',()=>{
   if(group.dataset.multiple==='true'){b.classList.toggle('selected');state[key]=[...group.querySelectorAll('.selected')].map(x=>x.dataset.value);}
   else{const off=key==='mood'&&b.classList.contains('selected');group.querySelectorAll('button').forEach(x=>x.classList.remove('selected'));if(!off)b.classList.add('selected');state[key]=off?null:b.dataset.value;}
   group.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x.classList.contains('selected')?'true':'false'));
   if(key==='budget'){const custom=state.budget==='custom';$('#custom-budget').classList.toggle('hidden',!custom);$('#custom-budget-label').classList.toggle('hidden',!custom);}
   criteriaChanged();
  });
 });
});
$('#allow-unknown').addEventListener('change',()=>{state.allowUnknown=$('#allow-unknown').checked;criteriaChanged();});
$('#custom-budget').addEventListener('input',criteriaChanged);
// Rules are editorial recommendations, not verified nutritional or taste claims.
const RULES={
 cuisine:{chinese:['chinese','taiwanese','中式','台式','小吃','便當'],japanese:['japanese','sushi','ramen','日式','壽司','拉麵','丼'],korean:['korean','韓式','韓國'],thai:['thai','泰式','泰國'],italian:['italian','pizza','義式','義大利','披薩'],american:['american','hamburger','steak','美式','漢堡','牛排'],vietnamese:['vietnamese','越式','越南'],indian:['indian','印度']},
 meal:{rice:['rice','飯','便當','丼'],noodle:['noodle','ramen','pasta','麵'],soup:['soup','hot_pot','湯','鍋','粥'],snack:['snack','小吃','餃','包子','鹽酥']},
 flavor:{strong:['燒肉','咖哩','滷味','麻辣'],light:['salad','沙拉','清湯','蒸','蔬食'],spicy:['麻辣','辣炒','辣咖哩','香辣'],sour:['酸辣','酸菜','酸湯','冬蔭']},
 mood:{comfort:['湯','粥','鍋','noodle','ramen','家常'],feast:['steak','牛排','燒肉','壽司','海鮮'],adventure:['麻辣','辣炒','indian','vietnamese','印度','越南'],easy:['便當','麵','小吃','fast_food','sandwich','飯']}
};
const LABELS={comfort:'想被療癒',feast:'想吃好料',adventure:'想來點刺激',easy:'簡單吃就好',strong:'濃郁下飯',light:'清爽一點',spicy:'想吃辣',sour:'酸香開胃',chinese:'台式／中式',japanese:'日式',korean:'韓式',thai:'泰式',italian:'義式',american:'美式',vietnamese:'越式',indian:'印度',rice:'飯',noodle:'麵',soup:'湯／鍋物',snack:'小吃'};
function textOf(p){return [p.displayName,...(p.types||[])].join(' ').toLowerCase();}
function matches(p,key,values){const text=textOf(p);return values.filter(v=>(RULES[key]?.[v]||[]).some(w=>text.includes(w)));}
function fit(p){
 const cuisine=matches(p,'cuisine',state.cuisine),meal=matches(p,'meal',state.meal),flavor=matches(p,'flavor',state.flavor),mood=state.mood&&matches(p,'mood',[state.mood]).length;
 const eligible=(!state.cuisine.length||cuisine.length>0)&&(!state.meal.length||meal.length>0);
 return {eligible,cuisine,meal,flavor,mood,score:cuisine.length*8+meal.length*5+flavor.length*3+(mood?3:0)-p.distance/state.radius};
}
function budgetMax(){if(state.budget==='all')return Infinity;const n=Number(state.budget==='custom'?$('#custom-budget').value:state.budget);return Number.isFinite(n)&&n>=1&&n<=100000?n:NaN;}
function money(m){if(!m||m.currencyCode!=='TWD')return null;const n=Number(m.units||0)+Number(m.nanos||0)/1e9;return Number.isFinite(n)&&n>=0?n:null;}
function priceInfo(p){
 const lo=money(p.priceRange?.startPrice),hi=money(p.priceRange?.endPrice);
 if(lo!==null&&(hi===null||hi>=lo))return {known:true,lo,hi,label:hi===null?'NT$'+lo+' 起':'NT$'+lo+'–'+hi};
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
 await timeout(details.fetchFields({fields:['rating','userRatingCount','photos','priceRange','priceLevel']}));
 return details;
}
function rankedCandidates(){return state.fetched.filter(p=>fit(p).eligible).sort((a,b)=>fit(b).score-fit(a).score);}
function withVariety(list){const remaining=[...list];const out=[];while(remaining.length){const best=fit(remaining[0]).score;const top=remaining.filter(p=>fit(p).score>=best-1);const p=top[Math.floor(Math.random()*top.length)];out.push(p);remaining.splice(remaining.indexOf(p),1);}return out;}
async function pickOne(version,max){
 let list=rankedCandidates();
 if(!list.length){showEmpty('附近沒有符合料理／餐點條件的店家','可取消部分料理或餐點條件，或手動擴大搜尋範圍；不會自行放寬條件。');msg('Google 分類與店名線索有限，沒有足夠證據符合你選的條件');return;}
 let available=list.filter(p=>!state.seen.has(p.id)&&!state.attempted.has(p.id));
 if(!available.length){showEmpty('本輪候選已看完','可以按下方按鈕重新挑選，或調整地點與條件。');const b=document.createElement('button');b.className='button';b.textContent='重新挑選本輪餐廳';b.addEventListener('click',()=>{state.seen.clear();state.attempted.clear();recommend();});$('#result-panel').appendChild(b);msg('本輪已看完，不會自動重複推薦');return;}
 list=withVariety(available);let checked=0,failed=0,chosen=null;
 for(const p of list){
  if(version!==state.version)return;
  if(checked>=6)break;checked++;
  if(max!==Infinity){
   try{msg('正在確認預算，已檢查 '+checked+' 間…');await priceFor(p);}
   catch(e){failed++;if(version!==state.version)return;continue;}
   if(version!==state.version)return;
   if(!withinBudget(priceInfo(p),max,state.allowUnknown)){state.attempted.add(p.id);continue;}
  }
  chosen=p;break;
 }
 if(!chosen){
  const more=list.some(p=>!state.attempted.has(p.id));
  showEmpty(failed?'部分價格資料暫時無法查詢':'暫時沒找到符合預算的店家',failed?'可以稍後重試，或勾選接受價格未確認的店家；不會把查詢失敗當作已確認價格。':more?'可繼續找下一批候選，或調整範圍及價格未知選項。':'可擴大範圍或允許價格未知；不會自動提高預算。');
  if(more){const b=document.createElement('button');b.className='button button-green';b.textContent='繼續找';b.addEventListener('click',recommend);$('#result-panel').appendChild(b);}
  msg('未找到符合本次條件的推薦');return;
 }
 let details=null,detailsFailed=false;
 try{msg('正在載入推薦店家的照片與評分…');details=await detailsFor(chosen);}catch(e){detailsFailed=true;}
 if(version!==state.version)return;
 // The fresh detail response may contain newer prices; re-check before display.
 const price=details?priceInfo(details):priceInfo(chosen);
 if(max!==Infinity&&details&&!withinBudget(price,max,state.allowUnknown)){
  state.attempted.add(chosen.id);showEmpty('店家價格資料已更新','最新價格不符合這次預算，請按「今天吃這間」找下一間。');msg('已排除最新價格不符合條件的店家');return;
 }
 state.seen.add(chosen.id);state.current=chosen;
 renderPlace(chosen,details,price,detailsFailed,max);
 msg(detailsFailed?'餐廳已找到，但照片與評分暫時載入失敗，仍可查看地址與導航。':'推薦完成，可按「換一家」繼續挑選');
}
function renderPlace(p,d,price,failed,max){
 const f=fit(p),metres=Math.round(p.distance),dist=metres<1000?metres+' 公尺':(metres/1000).toFixed(1)+' 公里';
 const reasons=['距離搜尋位置約 '+dist];
 if(f.cuisine.length)reasons.push('店名／分類符合 '+f.cuisine.map(v=>LABELS[v]).join('、'));
 if(f.meal.length)reasons.push('餐點線索包含 '+f.meal.map(v=>LABELS[v]).join('、'));
 if(f.mood)reasons.push('依「'+LABELS[state.mood]+'」的網站規則加分');
 if(f.flavor.length)reasons.push('店名／分類有「'+f.flavor.map(v=>LABELS[v]).join('、')+'」線索，實際口味請確認');
 const tasteMissing=state.flavor.length&&!f.flavor.length?'未取得符合所選口味的明確線索，本次依其他條件推薦。':'';
 const rating=Number.isFinite(d?.rating)?'★ '+d.rating.toFixed(1)+(Number.isFinite(d.userRatingCount)?'（'+d.userRatingCount+' 則評分）':''):(failed?'評分暫時無法載入':'尚無評分資料');
 const priceText=price.label+(max!==Infinity&&!price.known?' · 本次允許價格未知':max!==Infinity?' · Google 區間上限在預算內':'');
 const link=mapURL(p.location.lat(),p.location.lng())+'&query_place_id='+encodeURIComponent(p.id);
 $('#result-subtitle').textContent='本輪 '+state.fetched.length+' 間候選中，依料理、距離與偏好推薦';
 $('#result-panel').className='result-panel';$('#result-panel').innerHTML=`<div class="result-visual"><img id="place-photo" class="is-illustration" src="${illustration}" alt="店面插畫，非店家實拍"><span id="photo-caption" class="visual-caption">${failed?'照片暫時無法載入，先顯示插畫':'店家未提供照片時顯示插畫'}</span><div id="photo-authors" class="photo-attribution"></div></div><div class="result-content"><span class="result-kicker">TODAY'S SUGGESTION</span><h3 class="result-name">${escapeHTML(p.displayName)}</h3><div class="result-meta"><span>${escapeHTML(rating)}</span><span>距離約 ${escapeHTML(dist)}（直線）</span></div><p class="result-details">${escapeHTML(p.formattedAddress||'地址未提供，請查看 Google 地圖')}</p><div class="result-price">${escapeHTML(priceText)}</div><div class="result-note"><strong>為什麼推薦這間？</strong><p>${escapeHTML(reasons.join('；'))}</p></div>${tasteMissing?'<p class="retry-note">'+escapeHTML(tasteMissing)+'</p>':''}<p class="result-disclaimer">價格為參考區間，實際依菜單、低消與服務費而定。營業時間請向店家確認。</p><div class="result-actions"><button class="button" id="next-btn">這間先不要，換一家 ↻</button><a class="button button-green" target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(p.location.lat()+','+p.location.lng())}&destination_place_id=${encodeURIComponent(p.id)}&travelmode=walking">就吃這家！帶我去 ↗</a><a class="button" target="_blank" rel="noopener noreferrer" href="${escapeHTML(link)}">看照片與評論 ↗</a></div><p class="source-note">餐廳資料、評分與照片來源：Google Maps<br>${sourceNotes(p)} ${d?sourceNotes(d):''}</p></div>`;
 $('#next-btn').addEventListener('click',recommend);
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
async function recommend(){
 if(!requireGoogle()||state.busy)return;
 if(!state.point){msg('請先定位、輸入地址或確認地圖選點');$('#location').scrollIntoView({behavior:'smooth'});return;}
 const max=budgetMax();if(Number.isNaN(max)){msg('請輸入有效的每人預算上限（NT$1–100,000）');$('#custom-budget').focus();return;}
 const point={...state.point},radius=state.radius,version=state.version,key=point.lat+','+point.lng+'|'+radius;
 state.busy=true;$('#recommend-btn').disabled=true;const next=$('#next-btn');if(next)next.disabled=true;
 try{
  if(state.queryKey!==key||Date.now()-state.queryAt>300000){
   msg('正在搜尋附近餐廳…');
   const {places}=await timeout(state.Place.searchNearby({fields:['id','displayName','location','formattedAddress','types','businessStatus'],locationRestriction:{center:{lat:point.lat,lng:point.lng},radius},includedTypes:['restaurant'],maxResultCount:20,rankPreference:google.maps.places.SearchNearbyRankPreference.DISTANCE}),20000);
   if(version!==state.version)return;
   state.fetched=(places||[]).filter(p=>p.location&&p.businessStatus!=='CLOSED_PERMANENTLY'&&p.businessStatus!=='CLOSED_TEMPORARILY').map(p=>{p.distance=distance(point,{lat:p.location.lat(),lng:p.location.lng()});return p;}).filter(p=>p.distance<=radius);
   state.seen.clear();state.attempted.clear();state.queryKey=key;state.queryAt=Date.now();
  }
  if(version!==state.version)return;
  if(!state.fetched.length){state.queryKey='';showEmpty('附近暫時沒有餐廳結果','請手動擴大範圍或更換地點');msg('搜尋完成，此範圍沒有可用餐廳');return;}
  await pickOne(version,max);
 }catch(e){if(version===state.version){state.queryKey='';showEmpty('餐廳搜尋暫時失敗','請稍後重試，或確認網站 API 與配額設定');msg('搜尋未成功，請稍後再試');}}
 finally{state.busy=false;$('#recommend-btn').disabled=false;const n=$('#next-btn');if(n)n.disabled=false;if(version!==state.version)msg('條件或位置已變更，請按「今天吃這間」重新推薦');}
}
$('#recommend-btn').addEventListener('click',recommend);

bootGoogle();
