/* LAND STATION — website publik. Semua data (layanan, harga/jam, media, event, venue) dibaca dari Supabase. */
const DEFAULT_SERVICES=[
  {id:'ps4',name:'PS4 Station',desc:'Console gaming untuk sesi santai, co-op, dan kompetisi antar teman.',price:25000,slot:11,img:'assets/ps4.svg',cat:'ps4'},
  {id:'ps5',name:'PS5 Station',desc:'Next-gen console experience untuk main bareng squad.',price:35000,slot:12,img:'assets/ps5.svg',cat:'ps5'},
  {id:'billiard',name:'Billiard Table Rent',desc:'Meja pool untuk casual play maupun friendly match.',price:50000,slot:5,img:'assets/billiard.svg',cat:'billiard'},
  {id:'arcade',name:'Arcade & Retro Gaming',desc:'Rhythm, fighting, dan retro games dalam satu zona.',price:10000,slot:30,img:'assets/arcade.svg',cat:'arcade'}];
const DEFAULT_CATS=[{id:'ps4',name:'PS4'},{id:'ps5',name:'PS5'},{id:'billiard',name:'Billiard'},{id:'arcade',name:'Arcade'}];
let services=DEFAULT_SERVICES,promos=[],categories=DEFAULT_CATS,activeCat='all';
let site={homepage_media:DEFAULT_HERO,gallery:{items:DEFAULT_GALLERY},event:DEFAULT_EVENT,venue:DEFAULT_VENUE};

/* ----- Navigasi ----- */
const hamb=$('#hamb'),menu=$('#menu');
const closeMenu=()=>{menu.classList.remove('open');hamb.classList.remove('active')};
hamb.onclick=()=>{hamb.classList.toggle('active');menu.classList.toggle('open')};
document.addEventListener('click',e=>{if(!menu.contains(e.target)&&!hamb.contains(e.target))closeMenu()});
$$('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{const t=$(a.getAttribute('href'));if(!t)return;e.preventDefault();closeMenu();t.scrollIntoView({behavior:'smooth',block:'start'});history.replaceState(null,'',a.getAttribute('href'))}));

/* ----- Render ----- */
const catName=s=>categories.find(c=>c.id===s.cat)?.name||'';
function renderCatFilter(){
  const box=$('#catFilter'),used=categories.filter(c=>services.some(s=>s.cat===c.id));
  if(used.length<2){box.innerHTML='';activeCat='all';return}
  if(activeCat!=='all'&&!used.some(c=>c.id===activeCat))activeCat='all';
  box.innerHTML=[{id:'all',name:'Semua'},...used].map(c=>`<button type="button" class="chip${c.id===activeCat?' active':''}" data-cat="${esc(c.id)}">${esc(c.name)}</button>`).join('');
  $$('[data-cat]',box).forEach(b=>b.onclick=()=>{activeCat=b.dataset.cat;renderServices()});
}
const priceFor=(s,date)=>{const d=date?new Date(date+'T12:00:00'):new Date();return d.getDay()===0||d.getDay()===6?Number(s.price_weekend??s.price):Number(s.price_weekday??s.price)};
function renderServices(){
  renderCatFilter();$('#servicesGrid').innerHTML=services.filter(s=>activeCat==='all'||s.cat===activeCat).map(s=>`<article class="service-card"><img src="${esc(s.img||'assets/arcade.svg')}" alt="${esc(s.name)}" loading="lazy"><div class="body"><span class="eyebrow">${esc(catName(s)||'LAYANAN')} · ${String(s.slot).padStart(2,'0')} UNIT</span><h3>${esc(s.name)}</h3><p>${esc(s.desc)}</p><div class="price">${money(priceFor(s))} <small>/ jam</small></div><button class="btn" data-open>BOOK THIS ZONE ↗</button></div></article>`).join('');
  $$('#servicesGrid [data-open]').forEach(b=>b.onclick=openModal);
}
function renderHero(){
  const m=site.homepage_media&&site.homepage_media.url?site.homepage_media:DEFAULT_HERO,slot=$('#heroSlot');
  slot.innerHTML=m.type==='video'
    ?`<video id="heroPhoto" src="${esc(m.url)}" muted loop autoplay playsinline aria-label="Land Station hero video"></video>`
    :`<img id="heroPhoto" src="${esc(m.url)}" alt="Land Station neon arcade">`;
  const v=$('#heroPhoto');if(v.tagName==='VIDEO')v.play?.().catch(()=>{});
}
function renderGallery(){
  const items=site.gallery?.items?.length?site.gallery.items:DEFAULT_GALLERY;
  $('#venueGallery').innerHTML=items.map(g=>`<article class="gallery-card">${mediaTag(g,g.title||'Land Station')}<span>${esc(g.title||'Land Station')}</span></article>`).join('');
}
function renderEvent(){
  const ev={...DEFAULT_EVENT,...(site.event||{})},sec=$('#eventSection');sec.hidden=!ev.enabled;if(!ev.enabled)return;
  $('#eventPhoto').src=ev.image||DEFAULT_EVENT.image;$('#eventTitle').textContent=ev.title;$('#eventEyebrow').textContent=ev.eyebrow;
  $('#eventDescription').textContent=ev.description||'';$('#eventCta').href=ev.cta||'#booking-info';$('#eventLink').href=ev.cta||'#booking-info';
}
function renderVenue(){
  const v={...DEFAULT_VENUE,...(site.venue||{})};
  $('#mapsLink').href=v.maps||DEFAULT_VENUE.maps;$('#instagramLink').href=v.instagram||DEFAULT_VENUE.instagram;
  if(v.address){$('#venueAddressText').textContent=v.address;$('#mapFrame').src='https://maps.google.com/maps?q='+encodeURIComponent(v.address)+'&t=&z=15&ie=UTF8&iwloc=&output=embed'}
}
function renderAll(){renderServices();renderHero();renderGallery();renderEvent();renderVenue();if(PL.finished)setupReveal()}

async function loadData(){
  const [svc,set,pr,ct]=await Promise.allSettled([
    sb.from('services').select('id,name,description,price,price_weekday,price_weekend,slot,image_url,category_id').eq('active',true).order('sort_order').order('name'),
    sb.from('site_settings').select('key,value'),
    sb.from('promos').select('code,discount_type,discount_value,slots'),
    sb.from('service_categories').select('id,name').order('sort_order')]);
  if(svc.status==='fulfilled'&&!svc.value.error&&svc.value.data?.length)
    services=svc.value.data.map(s=>({id:s.id,name:s.name,desc:s.description,price:s.price,price_weekday:s.price_weekday??s.price,price_weekend:s.price_weekend??s.price,slot:s.slot,img:s.image_url,cat:s.category_id}));
  if(set.status==='fulfilled'&&!set.value.error)(set.value.data||[]).forEach(r=>{site[r.key]=r.value});
  if(pr.status==='fulfilled'&&!pr.value.error)promos=pr.value.data||[];
  if(ct.status==='fulfilled'&&!ct.value.error&&ct.value.data?.length)categories=ct.value.data;
  renderAll();
}
/* ----- Preloader: progres nyata (font, data Supabase, media hero, halaman) ----- */
const PL={done:0,total:4,t0:performance.now(),finished:false};
(function buildTitle(){const t=document.querySelector('.pl-title');if(t)t.innerHTML=[...'LAND STATION'].map((c,i)=>`<span style="--i:${i}">${c===' '?'&nbsp;':c}</span>`).join('')})();
const PL_LABELS=['MENYIAPKAN STATION','MEMUAT LAYANAN & HARGA','MEMUAT VISUAL','HAMPIR SIAP'];
function plStep(){
  PL.done=Math.min(PL.done+1,PL.total);const p=Math.round(PL.done/PL.total*100);
  $('#plBar').style.setProperty('--p',p+'%');$('#plPct').textContent=p+'%';$('#plLabel').textContent=PL_LABELS[Math.min(PL.done,PL_LABELS.length-1)];
  if(PL.done>=PL.total)plFinish();
}
function plFinish(){
  if(PL.finished)return;PL.finished=true;
  const wait=Math.max(0,1500-(performance.now()-PL.t0));
  setTimeout(()=>{
    $('#plBar').style.setProperty('--p','100%');$('#plPct').textContent='100%';
    $('#preloader').classList.add('done');document.body.classList.remove('is-loading');document.body.classList.add('ready');
    setTimeout(()=>{$('#preloader')?.remove();setupReveal()},900);
  },wait);
}
const heroReady=()=>new Promise(res=>{
  const el=$('#heroPhoto');if(!el)return res();
  if(el.tagName==='VIDEO'){if(el.readyState>=2)return res();el.addEventListener('loadeddata',res,{once:true});el.addEventListener('error',res,{once:true})}
  else{if(el.complete&&el.naturalWidth)return res();el.addEventListener('load',res,{once:true});el.addEventListener('error',res,{once:true})}
});
setTimeout(()=>{PL.done=PL.total-1;plStep()},8000); // pengaman: jangan menahan pengunjung lebih dari 8 detik
(document.fonts?.ready||Promise.resolve()).then(plStep);
(document.readyState==='complete'?Promise.resolve():new Promise(r=>addEventListener('load',r,{once:true}))).then(plStep);

/* ----- Reveal saat scroll ----- */
let revealIO=null;
function setupReveal(){
  if(matchMedia('(prefers-reduced-motion:reduce)').matches||!('IntersectionObserver' in window))return;
  revealIO=revealIO||new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');revealIO.unobserve(e.target)}}),{threshold:.12,rootMargin:'0px 0px -40px 0px'});
  document.querySelectorAll('.section-top,.mini-grid article,.service-card,.gallery-card,.booking-strip,.mapbox,.event-banner,.intro').forEach((el,i)=>{
    if(el.classList.contains('rv'))return;
    el.style.setProperty('--rd',(i%4)*80+'ms');el.classList.add('rv');revealIO.observe(el);
  });
}

renderAll();
loadData().finally(async()=>{plStep();await Promise.race([heroReady(),new Promise(r=>setTimeout(r,4000))]);plStep();if(PL.finished)setupReveal()});

/* ----- Booking modal ----- */
const modal=$('#bookingModal');
let openedAt=0;
function openModal(){openedAt=Date.now();modal.classList.add('show');modal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';renderBookingServices();renderServicePicker();renderDates();renderHours();renderTimes();loadAvailability()}
function closeModal(){modal.classList.remove('show');modal.setAttribute('aria-hidden','true');document.body.style.overflow=''}
$$('[data-open]').filter(b=>!b.closest('#servicesGrid')).forEach(b=>b.addEventListener('click',openModal));
$$('[data-close]').forEach(b=>b.addEventListener('click',closeModal));
modal.addEventListener('click',e=>{if(e.target===modal)closeModal()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});

function renderBookingServices(){const el=$('#bookService'),old=el.value;el.innerHTML=services.map(s=>`<option value="${esc(s.id)}">${esc(s.name)} — ${money(priceFor(s,$('#selectedDate')?.value))}/jam</option>`).join('');if(services.some(s=>s.id===old))el.value=old;el.onchange=()=>{renderHours();loadAvailability()}}
function renderHours(){
  const el=$('#bookHours'),old=el.value,s=services.find(x=>x.id===$('#bookService').value),price=s?priceFor(s,$('#selectedDate').value):0;
  el.innerHTML=[1,2,3,4,5,6,8,10,12].map(h=>`<option value="h:${h}">${h} jam${s?' — '+money(price*h):''}</option>`).join('');
  if([...el.options].some(o=>o.value===old))el.value=old;
  el.onchange=()=>renderTimes();
}
function selDur(){const v=$('#bookHours').value||'h:1';return{hours:+v.slice(2)||1,pkg:null}}
const dayISO=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
function renderDates(){
  const strip=$('#dateStrip'),chosen=$('#selectedDate');strip.innerHTML='';
  for(let i=0;i<21;i++){const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+i);const iso=dayISO(d),t=document.createElement('button');
    t.type='button';t.className='date-tile'+(chosen.value===iso?' selected':'');
    t.innerHTML=`<span>${i===0?'HARI INI':d.toLocaleDateString('id-ID',{weekday:'short'}).toUpperCase()}</span><b>${d.getDate()}</b><span>${d.toLocaleDateString('id-ID',{month:'short'}).toUpperCase()}</span>`;
    t.onclick=()=>{chosen.value=iso;$$('.date-tile',strip).forEach(x=>x.classList.remove('selected'));t.classList.add('selected');renderHours();loadAvailability()};strip.appendChild(t)}
  if(!chosen.value){chosen.value=dayISO(new Date());$('.date-tile',strip)?.classList.add('selected')}
}
const toMin=label=>{const [h,m]=label.split('.').map(Number);return h===0&&m===0?1440:h*60+m};
let avail=null,availToken=0;
async function loadAvailability(){
  const sid=$('#bookService').value,date=$('#selectedDate').value,tok=++availToken;
  if(!sid||!date){avail=null;renderTimes();return}
  const {data,error}=await sb.rpc('get_availability',{p_service_id:sid,p_date:date});
  if(tok!==availToken)return; // respons usang
  avail=error?null:data;renderTimes();
}
function slotFree(startMin,hours){
  const now=new Date(),isToday=$('#selectedDate').value===dayISO(now);
  if(isToday&&startMin<=now.getHours()*60+now.getMinutes())return false;
  if(!avail)return true;
  if(avail.capacity<=0)return false;
  for(let t=startMin;t<startMin+hours*60;t+=30){if(t<=1440&&(+avail.used[t]||0)>=avail.capacity)return false}
  return true;
}
function renderTimes(){
  const grid=$('#timeGrid'),chosen=$('#selectedTime'),hours=selDur().hours;grid.innerHTML='';
  for(let m=9*60;m<=24*60;m+=30){
    const label=`${String(Math.floor(m/60)%24).padStart(2,'0')}.${String(m%60).padStart(2,'0')}`,b=document.createElement('button'),ok=slotFree(m,hours);
    b.type='button';b.textContent=label;b.disabled=!ok;b.className='time-tile'+(chosen.value===label&&ok?' selected':'');
    b.onclick=()=>{chosen.value=label;$$('.time-tile',grid).forEach(x=>x.classList.remove('selected'));b.classList.add('selected');updateSummary()};
    if(chosen.value===label&&!ok)chosen.value='';
    grid.appendChild(b);
  }
  updateSummary();
}
function findPromo(code){code=String(code||'').trim().toUpperCase();return code?promos.find(p=>p.code.toUpperCase()===code&&p.slots>0):null}
function calc(){
  const s=services.find(x=>x.id===$('#bookService').value),d=selDur(),h=d.hours;if(!s)return null;
  const base=priceFor(s,$('#selectedDate').value)*h,p=findPromo($('#promoInput').value);
  let total=base;if(p)total=Math.max(0,p.discount_type==='percent'?base-Math.floor(base*p.discount_value/100):base-p.discount_value);
  return {s,h,base,total,p,pkg:null};
}
function updateSummary(){
  const c=calc(),box=$('#bookingSummary');if(!c){box.textContent='Pilih layanan.';return}
  box.innerHTML=`<b>${esc(c.s.name)}</b><br>${money(priceFor(c.s,$('#selectedDate').value))+' / jam × '+c.h+' jam'} · ${$('#selectedDate').value||'Pilih tanggal'} · ${$('#selectedTime').value||'Pilih jam'}<br>Total: <strong>${money(c.total)}</strong>${c.p?` <small>(sudah termasuk promo ${esc(c.p.code)})</small>`:''}`;
}
$('#promoInput').addEventListener('input',()=>{const code=$('#promoInput').value.trim(),p=findPromo(code);
  $('#promoMsg').textContent=code?(p?`Promo aktif: ${p.discount_type==='percent'?p.discount_value+'%':'potongan '+money(p.discount_value)} (sisa slot promo: ${p.slots})`:'Kode tidak ditemukan / tidak aktif.'):'';updateSummary()});

function renderServicePicker(){
  const options=$('#servicePickerOptions'),label=$('#servicePickerLabel'),select=$('#bookService');
  options.innerHTML='<div class="service-picker-options-inner">'+services.map(s=>`<button type="button" class="service-option${select.value===s.id?' selected':''}" data-service-id="${esc(s.id)}"><img src="${esc(s.img||'assets/arcade.svg')}" alt=""><span class="service-option-copy"><b>${esc(s.name)}</b><small>${catName(s)?esc(catName(s))+' · ':''}${money(priceFor(s,$('#selectedDate')?.value))} / jam · ${s.slot} unit</small></span><span>↗</span></button>`).join('')+'</div>';
  const chosen=services.find(s=>s.id===select.value)||services[0];if(chosen){select.value=chosen.id;label.textContent=`${chosen.name} — ${money(priceFor(chosen,$('#selectedDate').value))}/jam`}
  $$('[data-service-id]',options).forEach(b=>b.onclick=()=>{select.value=b.dataset.serviceId;const s=services.find(x=>x.id===select.value);label.textContent=`${s.name} — ${money(priceFor(s,$('#selectedDate')?.value))}/jam`;
    $$('.service-option',options).forEach(x=>x.classList.toggle('selected',x===b));$('#servicePicker').classList.remove('open');$('#servicePickerTrigger').setAttribute('aria-expanded','false');renderHours();loadAvailability()});
}
const picker=$('#servicePicker'),trigger=$('#servicePickerTrigger');
trigger.addEventListener('click',()=>{const o=picker.classList.toggle('open');trigger.setAttribute('aria-expanded',String(o))});
document.addEventListener('click',e=>{if(!picker.contains(e.target)){picker.classList.remove('open');trigger.setAttribute('aria-expanded','false')}});

$('#bookingForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const f=new FormData(e.target),result=$('#bookingResult'),btn=e.target.querySelector('[type=submit]');
  result.className='success';
  if(!f.get('date')||!f.get('time')){result.textContent='Pilih tanggal dan jam mulai terlebih dahulu.';result.classList.add('show','error');return}
  // Anti-spam sisi browser (perlindungan utama tetap di server/RPC)
  if(f.get('website')){result.textContent='Booking berhasil dikirim.';result.classList.add('show');return} // honeypot: bot mengisi kolom tersembunyi
  if(Date.now()-openedAt<2500){result.textContent='Terlalu cepat. Periksa data lalu kirim kembali.';result.classList.add('show','error');return}
  const last=+localStorage.getItem('ls_last_booking')||0,wait=30000-(Date.now()-last);
  if(wait>0){result.textContent=`Tunggu ${Math.ceil(wait/1000)} detik sebelum membuat booking lagi.`;result.classList.add('show','error');return}
  btn.disabled=true;btn.textContent='MENGIRIM BOOKING...';
  try{
    const {data,error}=await sb.rpc('create_booking',{p_name:f.get('name'),p_phone:f.get('phone'),p_service_id:f.get('service'),p_date:f.get('date'),p_time:f.get('time'),p_hours:selDur().hours,p_package_id:null,p_promo:String(f.get('promo')||'').trim()||null,p_notes:f.get('notes')||'',p_website:''});
    if(error)throw error;
    try{localStorage.setItem('ls_last_booking',String(Date.now()))}catch{}
    result.innerHTML=`Booking berhasil dikirim. Kode referensi <b>${esc(String(data.id).slice(0,8).toUpperCase())}</b> · Total ${money(data.total_price)} (${data.hours} jam).`;
    result.classList.add('show');e.target.reset();$('#selectedDate').value='';$('#selectedTime').value='';renderDates();renderTimes();renderHours();renderBookingServices();renderServicePicker();updateSummary();$('#promoMsg').textContent='';
    loadData();loadAvailability();
  }catch(err){
    console.error('Booking error:',err);
    result.textContent='Booking belum terkirim: '+(err.message||'periksa koneksi dan pastikan schema.sql sudah dijalankan.');result.classList.add('show','error');loadAvailability();
  }finally{btn.disabled=false;btn.innerHTML='KIRIM BOOKING ↗'}
});
