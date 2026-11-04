/* 你吃啥？ Free / static GitHub Pages prototype.
   Data: © OpenStreetMap contributors (ODbL). Uses public Overpass and Nominatim on a best-effort basis.
   No Google Places API, no review scraping, no invented photos, ratings or prices. */
'use strict';
const $ = (s) => document.querySelector(s);
const state = {
  point: null, radius: 1000, mood: null, flavor: [], cuisine: [], meal: [], budget: 'all', time: 'now',
  fetched: [], remaining: [], seen: new Set(), busy: false, lastGeocode: 0, map: null, lastQueryKey: '', lastQueryAt: 0
};
const msg = (s) => { $('#app-message').textContent = s; };
const locMsg = (s) => { $('#location-status').textContent = s; };
const escapeHTML = (text) => String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function setPoint(lat, lon, label) {
  state.point = {lat:Number(lat),lon:Number(lon),label};
  locMsg(`已選擇：${label}（${state.point.lat.toFixed(4)}, ${state.point.lon.toFixed(4)}）`);
  state.lastQueryKey = '';
  state.remaining = [];
  $('#result-subtitle').textContent = '位置已更新，按下按鈕尋找附近餐廳';
}
function wireChoices(){
  document.querySelectorAll('[data-select]').forEach(group => {
    const key=group.dataset.select, multi=group.dataset.multiple==='true';
    group.querySelectorAll('button').forEach(button=>{
      button.setAttribute('aria-pressed',button.classList.contains('selected')?'true':'false');
      button.addEventListener('click',()=>{
        const value=button.dataset.value;
        if(multi){
          button.classList.toggle('selected');
          state[key]=[...group.querySelectorAll('.choice.selected')].map(b=>b.dataset.value);
        }else{
          const toggleOff=key==='mood'&&button.classList.contains('selected');
          group.querySelectorAll('button').forEach(b=>b.classList.remove('selected'));
          if(!toggleOff)button.classList.add('selected');
          state[key]=toggleOff?null:value;
        }
        group.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.classList.contains('selected')?'true':'false'));
        if(key==='time'){
          const later=state.time==='later';
          $('#meal-time').classList.toggle('hidden',!later);
          $('#meal-time-label').classList.toggle('hidden',!later);
          if(later&&!$('#meal-time').value){const d=new Date(Date.now()+3600000);d.setMinutes(0);$('#meal-time').value=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')+'T'+String(d.getHours()).padStart(2,'0')+':00';}
        }
      });
    });
  });
  document.querySelectorAll('[data-radius]').forEach(b=>{
    b.setAttribute('aria-pressed',b.classList.contains('selected')?'true':'false');
    b.addEventListener('click',()=>{
      document.querySelectorAll('[data-radius]').forEach(x=>{x.classList.remove('selected');x.setAttribute('aria-pressed','false');});
      b.classList.add('selected');b.setAttribute('aria-pressed','true');state.radius=Number(b.dataset.radius);state.lastQueryKey='';
    });
  });
}
$('#locate-btn').addEventListener('click',()=>{
  if(!navigator.geolocation){locMsg('你的瀏覽器不支援定位，請改用手動輸入或地圖選點');return;}
  locMsg('正在取得位置，請確認瀏覽器的定位權限');
  navigator.geolocation.getCurrentPosition(pos=>setPoint(pos.coords.latitude,pos.coords.longitude,'目前位置'),()=>locMsg('無法取得位置，請開啟定位權限，或改用地圖選點／手動輸入'),{enableHighAccuracy:false,timeout:14000,maximumAge:60000});
});
$('#address-form').addEventListener('submit',async e=>{
  e.preventDefault(); const q=$('#address').value.trim();if(q.length<2){locMsg('請輸入至少兩個字的地址或地標');return;}
  const time=Date.now(); if(time-state.lastGeocode<1200){locMsg('搜尋太頻繁，請稍後再試');return;}state.lastGeocode=time;
  const button=$('#address-form button[type=submit]');button.disabled=true;locMsg('正在查詢地點');
  try{
    const url='https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=zh-TW&q='+encodeURIComponent(q);
    const response=await fetch(url,{headers:{Accept:'application/json'}});
    if(!response.ok)throw new Error('搜尋服務暫時無法使用');
    const data=await response.json();if(!data.length){locMsg('沒有找到這個地點，試試更完整的地址或地標名稱');return;}
    setPoint(data[0].lat,data[0].lon,data[0].display_name.split(',').slice(0,2).join('、'));
  }catch(err){locMsg('地址搜尋暫時失敗，請改用地圖選點');}finally{button.disabled=false;}
});
$('#map-btn').addEventListener('click',()=>{
  if(!window.L){locMsg('地圖元件尚未載入，請確認網路連線後重試');return;}
  const dlg=$('#map-dialog');dlg.showModal();
  const origin=state.point||{lat:25.033,lon:121.5654};
  if(!state.map){
    state.map=L.map('map',{scrollWheelZoom:false}).setView([origin.lat,origin.lon],15);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>'}).addTo(state.map);
    state.map.on('moveend',()=>{const p=state.map.getCenter();$('#map-coordinates').textContent=p.lat.toFixed(5)+', '+p.lng.toFixed(5);});
  }else state.map.setView([origin.lat,origin.lon],15);
  setTimeout(()=>{state.map.invalidateSize();state.map.fire('moveend');},60);
});
$('#close-map').addEventListener('click',()=>$('#map-dialog').close());
$('#map-dialog').addEventListener('click',e=>{if(e.target===$('#map-dialog'))$('#map-dialog').close();});
$('#confirm-map').addEventListener('click',()=>{const p=state.map.getCenter();setPoint(p.lat,p.lng,'地圖選取位置');$('#map-dialog').close();});
const cuisineGroups={
  chinese:['chinese','taiwanese','regional','asian','dumpling','beef_noodle','hot_pot'],japanese:['japanese','sushi','ramen','udon'],korean:['korean'],thai:['thai'],italian:['italian','pizza','pasta'],american:['american','burger','steak','sandwich'],vietnamese:['vietnamese','pho'],indian:['indian']
};
const mealWords={rice:['rice','bento','donburi','curry','fried_rice'],noodle:['noodle','ramen','udon','soba','pasta','pho'],soup:['soup','hot_pot','stew','shabu'],snack:['snack','street_food','dumpling','bao','fast_food']};
const moodWords={comfort:['soup','noodle','ramen','hot_pot','cafe'],feast:['bbq','steak','hot_pot','restaurant','buffet'],adventure:['thai','indian','korean','mexican','vietnamese'],easy:['fast_food','sandwich','noodle','bento','cafe']};
const flavorWords={strong:['bbq','hot_pot','curry','beef_noodle'],light:['salad','vegetarian','vegan','soup','japanese'],spicy:['spicy','thai','sichuan','korean','indian'],sour:['thai','vietnamese','pho','sour']};
function haystack(x){return [x.tags.cuisine,x.tags.name,x.tags['name:en'],x.tags.description,x.tags.amenity,x.tags.shop].filter(Boolean).join(' ').toLowerCase().replaceAll(/[,;｜、]/g,' ');}
function containsAny(h,words){return words.some(word=>h.includes(word.replaceAll('_','_'))||h.includes(word.replaceAll('_',' ')));}
function preferenceScore(x){
  const h=haystack(x);let score=0;
  if(state.cuisine.length){const words=state.cuisine.flatMap(s=>cuisineGroups[s]||[]);if(!containsAny(h,words))return -1;score+=5;}
  if(state.meal.length){const words=state.meal.flatMap(s=>mealWords[s]||[]);if(!containsAny(h,words))return -1;score+=3;}
  if(state.mood&&containsAny(h,moodWords[state.mood]||[]))score+=2;
  for(const f of state.flavor)if(containsAny(h,flavorWords[f]||[]))score+=1;
  return score;
}
function haversine(lat1,lon1,lat2,lon2){const r=6371000,deg=Math.PI/180,dlat=(lat2-lat1)*deg,dlon=(lon2-lon1)*deg,a=Math.sin(dlat/2)**2+Math.cos(lat1*deg)*Math.cos(lat2*deg)*Math.sin(dlon/2)**2;return 2*r*Math.asin(Math.min(1,Math.sqrt(a)));}
function mealDate(){if(state.time==='later'&&$('#meal-time').value){const d=new Date($('#meal-time').value);if(Number.isFinite(d.getTime()))return d;}return new Date();}
/* Only claim open/closed where the uncomplicated weekly OSM syntax can be interpreted reliably.
   Everything else is explicitly UNKNOWN; no optimistic assumption. */
const wd=['Su','Mo','Tu','We','Th','Fr','Sa'];
function openingStatus(raw,date){
  if(!raw)return 'unknown';
  const str=String(raw).trim();if(str==='24/7')return 'open';
  if(/PH|SH|sunrise|sunset|week|\[|\]|\+|off|closed|\/|"|\{/i.test(str))return 'unknown';
  let any=false,open=false;
  for(const clause of str.split(';')){
    const m=clause.trim().match(/^(?:(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?(?:,(Mo|Tu|We|Th|Fr|Sa|Su))?\s+)?(\d\d:\d\d-\d\d:\d\d(?:,\d\d:\d\d-\d\d:\d\d)*)$/);
    if(!m)return 'unknown';any=true;
    let days=[];if(!m[1])days=[0,1,2,3,4,5,6];else{
      const a=wd.indexOf(m[1]),b=m[2]?wd.indexOf(m[2]):a;
      let n=a;days=[n];while(n!==b){n=(n+1)%7;days.push(n);if(days.length>7)return 'unknown';}
      if(m[3])days.push(wd.indexOf(m[3]));
    }
    for(const range of m[4].split(',')){
      const [start,end]=range.split('-').map(v=>Number(v.slice(0,2))*60+Number(v.slice(3)));
      const mins=date.getHours()*60+date.getMinutes(),day=date.getDay();
      if(days.includes(day)&&end>start&&mins>=start&&mins<end)open=true;
      if(end<start&&((days.includes(day)&&mins>=start)||(days.includes((day+6)%7)&&mins<end)))open=true;
    }
  }
  return any?(open?'open':'closed'):'unknown';
}
function fromOverpass(el){const tags=el.tags||{},lat=el.lat??el.center?.lat,lon=el.lon??el.center?.lon;return {id:`${el.type}/${el.id}`,tags,lat,lon,name:tags['name:zh']||tags.name||tags['name:en']||'',distance:haversine(state.point.lat,state.point.lon,lat,lon)};}
async function fetchRestaurants(){
  const {lat,lon}=state.point,r=state.radius;
  const q=`[out:json][timeout:23];(nwr["amenity"~"^(restaurant|fast_food|food_court|cafe)$"](around:${r},${lat},${lon}););out center 120;`;
  const endpoints=['https://overpass.kumi.systems/api/interpreter','https://overpass-api.de/api/interpreter'];
  let lastErr;
  for(const endpoint of endpoints){try{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),26000);
    let response;try{response=await fetch(endpoint,{method:'POST',body:new URLSearchParams({data:q}),signal:controller.signal});}finally{clearTimeout(timer);}
    if(!response.ok)throw new Error('HTTP '+response.status);
    const data=await response.json();if(!Array.isArray(data.elements))throw new Error('invalid data');
    return data.elements.filter(x=>(x.tags?.name||x.tags?.['name:zh']||x.tags?.['name:en'])&&(x.lat??x.center?.lat)!==undefined).map(fromOverpass).filter(x=>Number.isFinite(x.distance)&&x.distance<=r);
  }catch(e){lastErr=e;}}
  throw lastErr||new Error('沒有回應');
}
function filtered(){
  const date=mealDate();
  return state.fetched.map(x=>({...x,opening:openingStatus(x.tags.opening_hours,date),score:preferenceScore(x)})).filter(x=>x.score>=0&&x.opening!=='closed');
}
function drawEmpty(title,detail){
  $('#result-panel').className='result-panel empty';
  $('#result-panel').innerHTML=`<div class="empty-illustration"><img src="assets/storefront.svg" alt="手繪餐廳店面插畫"></div><div class="empty-message"><span class="eyebrow">YOUR NEXT MEAL</span><h3>${escapeHTML(title)}</h3><p>${escapeHTML(detail)}</p></div>`;
}
function pickOne(){
  let candidates=filtered().filter(x=>!state.seen.has(x.id));
  if(!candidates.length){const any=filtered();if(!any.length){drawEmpty('這附近暫時沒有符合條件的店家','可以放寬料理／餐點類型，或調整搜尋範圍再試試');msg('目前沒有可推薦的店家');return;}
    state.seen.clear();candidates=any;msg('符合條件的店家已經看過一輪，重新開始推薦');
  }
  const weights=candidates.map(x=>Math.max(.25,3+x.score-x.distance/state.radius*1.7));const total=weights.reduce((a,b)=>a+b,0);let roll=Math.random()*total,idx=0;
  for(let i=0;i<weights.length;i++){roll-=weights[i];if(roll<=0){idx=i;break;}}
  const pick=candidates[idx];state.seen.add(pick.id);renderPlace(pick);
}
function classify(t){const v=(t.cuisine||'').split(/[;,]/).filter(Boolean).slice(0,3);const labels={chinese:'中式',taiwanese:'台式',japanese:'日式',korean:'韓式',thai:'泰式',italian:'義式',american:'美式',vietnamese:'越式',indian:'印度',pizza:'披薩',burger:'漢堡',ramen:'拉麵',noodle:'麵食',vegetarian:'蔬食',hot_pot:'鍋物',sushi:'壽司'};return v.map(x=>labels[x.trim()]||x.trim()).filter(Boolean);}
function makeAddress(t){return [t['addr:city'],t['addr:district'],t['addr:street'],t['addr:housenumber']].filter(Boolean).join('')||'未提供完整地址';}
function mapSearchUrl(x){const label=x.name+' '+makeAddress(x.tags);return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(label+' '+x.lat+','+x.lon);}
function mapDirUrl(x){return 'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(x.lat+','+x.lon)+'&travelmode=walking';}
function renderPlace(x){
  $('#result-subtitle').textContent='依你選的條件，在附近找到的一間店';
  const kind=classify(x.tags),meters=Math.round(x.distance),dist=meters<1000?`${meters} 公尺`:`${(meters/1000).toFixed(1)} 公里`;
  const status=x.opening==='open'?'營業中（依登錄時間推算）':'營業時間未知';
  const reason=[];if(kind.length)reason.push(`店家標註為${kind.join('／')}料理`);reason.push(`距離搜尋位置約 ${dist}`);if(state.mood)reason.push('已參考你的心情偏好進行排序');
  const notes=[];if(!x.tags.opening_hours)notes.push('沒有完整營業時間');if(state.budget!=='all')notes.push('預算未經確認');notes.push('店家與營業資訊以實際狀況為準');
  const tags=[...kind];if(x.tags.takeaway==='yes')tags.push('提供外帶');if(x.tags.outdoor_seating==='yes')tags.push('有戶外座位');if(x.tags.wheelchair==='yes')tags.push('無障礙入口（店家標註）');
  $('#result-panel').className='result-panel';
  $('#result-panel').innerHTML=`<div class="result-visual"><img src="assets/storefront.svg" alt="通用店面插畫，非實際店家照片"><span class="visual-caption">分類插畫・非店家實拍</span></div><div class="result-content"><span class="result-kicker">TODAY'S SUGGESTION</span><h3 class="result-name">${escapeHTML(x.name)}</h3><div class="result-meta"><span>◉ 距離 ${escapeHTML(dist)}</span><span>·</span><span>${escapeHTML(status)}</span></div><p class="result-details">${escapeHTML(makeAddress(x.tags))}</p><div class="result-note"><strong>為什麼推薦這間？</strong><p>${escapeHTML(reason.join('，'))}</p></div><div class="result-tags"><h4>這間店的已知特色</h4><div class="tag-row">${tags.length?tags.map(t=>`<span class="tag">${escapeHTML(t)}</span>`).join(''):'<span class="tag">目前沒有足夠的分類資訊</span>'}</div></div><p class="result-disclaimer">${escapeHTML(notes.join(' · '))}<br>本網站不直接取得 Google 評分、照片或評論</p><div class="result-actions"><button type="button" id="next-btn" class="button button-outline">這間先不要，換一家 ↻</button><a class="button button-green" target="_blank" rel="noopener noreferrer" id="directions-btn" href="${escapeHTML(mapDirUrl(x))}">就吃這家！帶我去 ↗</a><a class="button button-outline" target="_blank" rel="noopener noreferrer" href="${escapeHTML(mapSearchUrl(x))}">看 Google 地圖評論 ↗</a></div></div>`;
  $('#next-btn').addEventListener('click',pickOne);
  $('#results').scrollIntoView({behavior:'smooth',block:'start'});
}
$('#recommend-btn').addEventListener('click',async()=>{
  if(state.busy)return;if(!state.point){msg('請先取得位置、在地圖選點或輸入地址');$('#location').scrollIntoView({behavior:'smooth'});return;}
  if(state.time==='later'&&!$('#meal-time').value){msg('請選擇預計用餐時間');return;}
  const key=`${state.point.lat.toFixed(4)},${state.point.lon.toFixed(4)}|${state.radius}`;
  if(state.lastQueryKey!==key||Date.now()-state.lastQueryAt>10*60*1000){
    state.busy=true;$('#recommend-btn').disabled=true;msg('正在搜尋附近餐廳，資料由 OpenStreetMap 社群提供');
    try{
      state.fetched=await fetchRestaurants();state.lastQueryKey=key;state.lastQueryAt=Date.now();state.seen.clear();
      if(!state.fetched.length){drawEmpty('附近暫時沒有找到可用的餐廳資料','試試擴大搜尋範圍或移動地點');msg('沒有找到具備店名的餐廳資料');return;}
      msg(`附近找到 ${state.fetched.length} 間有店名的餐飲地點，正在篩選`);
    }catch(e){drawEmpty('地圖資料服務暫時無法使用','免費公開服務可能忙碌，請稍後再試');msg('目前無法讀取餐廳清單，請稍後重試');return;}
    finally{state.busy=false;$('#recommend-btn').disabled=false;}
  }
  if(state.budget!=='all')msg('已選預算，但免費資料無法確認價格；以下推薦未通過價格驗證');
  pickOne();
});
wireChoices();
