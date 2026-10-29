/* LAND STATION — modul booking dashboard:
   papan jadwal (drag nama kartu → jam kosong), pop up detail + reschedule,
   pesan WhatsApp otomatis untuk Confirm / Reschedule / Selesai / Cancel, dan overview omset. */

const ACTIVE=['PENDING','CONFIRMED','RESCHEDULED'];
const BADGE={PENDING:'Pending',CONFIRMED:'Confirmed',RESCHEDULED:'Reschedule',CANCELLED:'Cancelled',COMPLETED:'Selesai'};
const START_MIN=9*60,END_MIN=24*60,STEP=30,COL_W=64;
const SLOTS=[];for(let m=START_MIN;m<=END_MIN;m+=STEP)SLOTS.push(m);

const pad=n=>String(n).padStart(2,'0');
const minToLabel=m=>`${pad(Math.floor(m/60)%24)}.${pad(m%60)}`;
const labelToMin=l=>{const [h,m]=String(l).split('.').map(Number);return h===0&&m===0?1440:h*60+(m||0)};
const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const todayISO=()=>iso(new Date());
const fmtDate=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d).toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})};
const hoursOf=b=>Math.round(b.duration_minutes/60*10)/10;
const isActive=b=>ACTIVE.includes(b.status);
let boardDate=todayISO();

/* ---------- Overview (omset, total booking, dll) ---------- */
function animateNumber(el,to,isMoney){
  const from=+el.dataset.v||0;el.dataset.v=to;
  if(from===to||matchMedia('(prefers-reduced-motion:reduce)').matches){el.textContent=isMoney?money(to):to;return}
  const t0=performance.now(),dur=700;
  (function tick(t){const k=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-k,3),v=Math.round(from+(to-from)*e);el.textContent=isMoney?money(v):v;if(k<1)requestAnimationFrame(tick)})(t0);
}
function renderOverview(){
  const bk=state.bookings,today=todayISO(),ym=today.slice(0,7);
  const done=bk.filter(b=>b.status==='COMPLETED'),act=bk.filter(isActive);
  const sum=l=>l.reduce((a,b)=>a+(+b.total_price||0),0);
  const doneToday=done.filter(b=>b.booking_date===today),doneMonth=done.filter(b=>b.booking_date.startsWith(ym));
  const set=(id,v,m)=>{const el=$('#'+id);if(el)animateNumber(el,v,m)};
  set('revToday',sum(doneToday),true);set('revMonth',sum(doneMonth),true);set('revAll',sum(done),true);set('revPotential',sum(act),true);
  $('#revTodayNote').textContent=`${doneToday.length} booking selesai`;
  $('#revMonthNote').textContent=`${doneMonth.length} booking selesai`;
  const todays=bk.filter(b=>b.booking_date===today&&b.status!=='CANCELLED');
  set('bookToday',todays.length);$('#bookTodayNote').textContent=`${todays.filter(isActive).length} masih berjalan`;
  set('totalBookings',bk.length);
  set('pendingBookings',bk.filter(b=>b.status==='PENDING').length);
  set('confirmedBookings',bk.filter(b=>b.status==='CONFIRMED'||b.status==='RESCHEDULED').length);
  set('doneBookings',done.length);$('#cancelNote').textContent=`${bk.filter(b=>b.status==='CANCELLED').length} dibatalkan`;
  set('activePromos',state.promos.filter(p=>p.active&&p.slots>0).length);
  set('totalMedia',state.media.length);

  // grafik 7 hari
  const days=[...Array(7)].map((_,i)=>{const d=new Date();d.setHours(12);d.setDate(d.getDate()-(6-i));return d});
  const vals=days.map(d=>sum(done.filter(b=>b.booking_date===iso(d)))),max=Math.max(...vals,1);
  $('#revBars').innerHTML=days.map((d,i)=>`<div class="bar"><span class="bar-val">${vals[i]?money(vals[i]).replace('Rp','').trim():''}</span><i style="--h:${Math.max(vals[i]/max*100,vals[i]?6:2)}%;--d:${i*70}ms"></i><small>${d.toLocaleDateString('id-ID',{weekday:'short'})}</small></div>`).join('');

  // layanan terlaris (berdasarkan omset selesai, fallback jumlah booking)
  const m={};bk.filter(b=>b.status!=='CANCELLED').forEach(b=>{const r=m[b.service_name]||(m[b.service_name]={n:0,rev:0});r.n++;if(b.status==='COMPLETED')r.rev+=+b.total_price||0});
  const top=Object.entries(m).sort((a,b)=>b[1].rev-a[1].rev||b[1].n-a[1].n).slice(0,5);
  $('#topServices').innerHTML=top.length?top.map(([n,r],i)=>`<div class="rank-row" style="--d:${i*60}ms"><b>${i+1}</b><span>${esc(n)}</span><em>${r.n}× · ${money(r.rev)}</em></div>`).join(''):'<p class="fineprint">Belum ada data.</p>';
}

/* ---------- Pesan WhatsApp otomatis ---------- */
function waNumber(p){let d=String(p||'').replace(/\D/g,'');if(d.startsWith('0'))d='62'+d.slice(1);else if(d.startsWith('8'))d='62'+d;return d}
function waMessage(b,action,prev){
  const ref=b.id.slice(0,8).toUpperCase(),name=b.customer_name,when=`${fmtDate(b.booking_date)}, pukul ${b.booking_time} WIB`;
  const detail=`• Layanan: ${b.service_name}\n• Jadwal: ${when}\n• Durasi: ${hoursOf(b)} jam\n• Total: ${money(b.total_price)}\n• Kode: ${ref}`;
  const sign='\n\nTerima kasih,\n*Land Station* 🎮';
  switch(action){
    case 'CONFIRMED':return `Halo ${name}! 👋\n\nBooking kamu di *Land Station* sudah *DIKONFIRMASI* ✅\n\n${detail}\n\nSampai jumpa, jangan telat ya!${sign}`;
    case 'RESCHEDULE':return `Halo ${name}! 👋\n\nJadwal booking kamu di *Land Station* telah *DIJADWALKAN ULANG* 🔄\n\n${prev?`Jadwal lama: ${fmtDate(prev.date)}, ${prev.time} WIB\n\n`:''}*Jadwal baru:*\n${detail}\n\nJika kurang cocok, balas pesan ini ya.${sign}`;
    case 'COMPLETED':return `Halo ${name}! 🎉\n\nSesi kamu di *Land Station* sudah *SELESAI*.\n\n${detail}\n\nTerima kasih sudah bermain! Sampai jumpa lagi 🕹️${sign}`;
    case 'CANCELLED':return `Halo ${name},\n\nMohon maaf, booking kamu di *Land Station* telah *DIBATALKAN* ❌\n\n${detail}\n\nKamu bisa membuat booking baru kapan saja lewat website kami.${sign}`;
  }
  return '';
}
const waURL=(b,msg)=>`https://wa.me/${waNumber(b.phone)}?text=${encodeURIComponent(msg)}`;
// Buka tab kosong SINKRON saat klik (agar tidak diblokir popup blocker), isi URL-nya setelah database berhasil diperbarui.
function preOpenWA(){let w=null;try{w=window.open('about:blank','_blank')}catch{}return w}
function sendWA(w,b,msg){
  const url=waURL(b,msg);
  if(w&&!w.closed){w.location.href=url;return}
  toast('Popup diblokir browser — ketuk "Kirim WA" di bawah.');
  showWAFallback(url,b.customer_name);
}
function showWAFallback(url,name){
  let el=$('#waFallback');if(!el){el=document.createElement('a');el.id='waFallback';el.className='wa-fallback';el.target='_blank';el.rel='noopener';document.body.appendChild(el)}
  el.href=url;el.textContent=`Kirim WA ke ${name} ↗`;el.classList.add('show');clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),15000);
  el.onclick=()=>el.classList.remove('show');
}

/* ---------- Update booking + WA ---------- */
const TOAST_DONE={CONFIRMED:'Booking dikonfirmasi',RESCHEDULE:'Jadwal diperbarui',COMPLETED:'Booking selesai',CANCELLED:'Booking dibatalkan'};
async function applyAction(id,action,opts={}){
  const b=state.bookings.find(x=>x.id===id);if(!b)return false;
  const w=opts.waWindow===undefined?preOpenWA():opts.waWindow;
  const busyEl=document.activeElement?.closest?.('.abtn');busyEl?.classList.add('is-busy');
  try{return await doAction(b,id,action,opts,w)}finally{busyEl?.classList.remove('is-busy')}
}
async function doAction(b,id,action,opts,w){
  let patch,prev=null;
  if(action==='RESCHEDULE'){
    const date=opts.date||b.booking_date,time=opts.time||b.booking_time;
    if(date===b.booking_date&&time===b.booking_time){toast('Jadwal belum diubah.',true);w&&w.close();return false}
    prev={date:b.booking_date,time:b.booking_time};
    patch={booking_date:date,booking_time:time,status:'RESCHEDULED'};
  }else patch={status:action};
  toast('Menyimpan…');
  try{
    const {error}=await sb.from('bookings').update(patch).eq('id',id);if(error)throw error;
  }catch(e){w&&w.close();fail(e,'Gagal memperbarui booking');await loadBookingsOnly();return false}
  Object.assign(b,patch);
  const goneNow=(action==='COMPLETED'||action==='CANCELLED');
  if(goneNow)await collapseCard(id);
  renderBookings();renderOverview();
  sendWA(w,b,waMessage(b,action,prev));
  toast(TOAST_DONE[action]+' ✓ — pesan WhatsApp disiapkan');
  return true;
}
async function loadBookingsOnly(){const {data}=await sb.from('bookings').select('*').order('created_at',{ascending:false}).limit(3000);if(data)state.bookings=data;renderBookings();renderOverview()}
function collapseCard(id){ // animasi kartu menghilang saat Selesai / Cancel
  const els=$$(`[data-card="${CSS.escape(id)}"]`);if(!els.length)return Promise.resolve();
  els.forEach(el=>el.classList.add('leaving'));
  return new Promise(r=>setTimeout(r,matchMedia('(prefers-reduced-motion:reduce)').matches?0:420));
}

/* ---------- Papan jadwal ---------- */
function layoutLanes(items){ // susun booking yang tumpang tindih ke lajur berbeda
  const lanes=[];
  items.sort((a,b)=>a.s-b.s).forEach(it=>{let i=lanes.findIndex(end=>end<=it.s);if(i<0){i=lanes.length;lanes.push(0)}lanes[i]=it.e;it.lane=i});
  return Math.max(lanes.length,1);
}
function boardServices(){
  const act=state.bookings.filter(b=>isActive(b)&&b.booking_date===boardDate);
  const list=state.services.filter(s=>s.active||act.some(b=>b.service_id===s.id)).map(s=>({id:s.id,name:s.name,cap:s.slot}));
  act.forEach(b=>{if(!list.some(s=>s.id===b.service_id)&&!list.some(s=>s.name===b.service_name&&!s.id))list.push({id:b.service_id,name:b.service_name,cap:0})});
  return list;
}
function canPlace(b,svcCap,date,startMin){
  const now=new Date();
  if(date===todayISO()&&startMin<=now.getHours()*60+now.getMinutes())return {ok:false,why:'Jam sudah lewat'};
  if(startMin<START_MIN||startMin>END_MIN)return {ok:false,why:'Di luar jam operasional'};
  if(svcCap<=0)return {ok:false,why:'Layanan tidak punya unit'};
  for(let t=startMin;t<startMin+b.duration_minutes;t+=STEP){
    const n=state.bookings.filter(x=>isActive(x)&&x.id!==b.id&&x.service_id===b.service_id&&x.booking_date===date&&labelToMin(x.booking_time)<=t&&labelToMin(x.booking_time)+x.duration_minutes>t).length;
    if(n>=svcCap)return {ok:false,why:`Penuh pukul ${minToLabel(t)}`};
  }
  return {ok:true};
}
function renderBoard(){
  const board=$('#board');if(!board)return;
  $('#boardDate').value=boardDate;
  const svcs=boardServices(),items=state.bookings.filter(b=>isActive(b)&&b.booking_date===boardDate);
  const head=`<div class="b-row b-head"><div class="b-label">LAYANAN</div><div class="b-track" style="width:${SLOTS.length*COL_W}px">${SLOTS.map(m=>`<div class="b-hour ${m%60===0?'major':''}" style="width:${COL_W}px">${m%60===0?minToLabel(m):''}</div>`).join('')}</div></div>`;
  let rows='';
  svcs.forEach(sv=>{
    const mine=items.filter(b=>b.service_id===sv.id||(!b.service_id&&b.service_name===sv.name)).map(b=>({b,s:labelToMin(b.booking_time),e:labelToMin(b.booking_time)+b.duration_minutes}));
    const lanes=layoutLanes(mine),H=lanes*50+10;
    const cells=SLOTS.map((m,i)=>`<div class="b-cell ${m%60===0?'major':''}" data-svc="${esc(sv.id||'')}" data-min="${m}" style="left:${i*COL_W}px;width:${COL_W}px"></div>`).join('');
    rows+=`<div class="b-row" data-row="${esc(sv.id||'')}"><div class="b-label"><b>${esc(sv.name)}</b><small>${mine.length} booking · ${sv.cap} unit</small></div><div class="b-track" style="width:${SLOTS.length*COL_W}px;height:${H}px" data-cap="${sv.cap}">${cells}${mine.map(it=>cardHTML(it,sv)).join('')}</div></div>`;
  });
  board.innerHTML=svcs.length?head+rows:'<p class="muted" style="padding:20px">Belum ada layanan.</p>';
  const nowLine=boardDate===todayISO()?(()=>{const n=new Date(),m=n.getHours()*60+n.getMinutes();return m>=START_MIN&&m<=END_MIN?(m-START_MIN)/STEP*COL_W:null})():null;
  if(nowLine!==null)$$('.b-track',board).forEach(t=>{const l=document.createElement('div');l.className='now-line';l.style.left=nowLine+'px';t.appendChild(l)});
  bindBoard();
  autoScrollBoard(nowLine,items);
}
let lastScrolled='';
function autoScrollBoard(nowLine,items){ // geser papan ke jam sekarang / booking pertama, sekali per tanggal
  const sc=$('#boardScroll');if(!sc||!sc.clientWidth)return; // panel tersembunyi → tunda
  if(lastScrolled===boardDate)return;lastScrolled=boardDate;
  const firstMin=items.length?Math.min(...items.map(b=>labelToMin(b.booking_time))):START_MIN;
  const x=nowLine!==null?nowLine:(firstMin-START_MIN)/STEP*COL_W;
  requestAnimationFrame(()=>sc.scrollTo({left:Math.max(0,x-60),behavior:'smooth'}));
}
function cardHTML(it,sv){
  const b=it.b,left=(it.s-START_MIN)/STEP*COL_W,w=Math.max((Math.min(it.e,END_MIN+STEP)-it.s)/STEP*COL_W-4,COL_W-4);
  return `<div class="b-card st-${b.status}" data-card="${b.id}" data-open="${b.id}" style="left:${left+2}px;width:${w}px;top:${5+it.lane*50}px">
    <span class="b-name" data-drag="${b.id}" title="Tahan &amp; drag ke jam kosong"><i class="grip">⋮⋮</i>${esc(b.customer_name)}</span>
    <small>${esc(b.booking_time)} · ${hoursOf(b)}j · ${BADGE[b.status]}</small></div>`;
}

/* ---------- Drag (pointer events: mouse + sentuh) ---------- */
let drag=null;
function bindBoard(){
  $$('[data-drag]').forEach(h=>h.addEventListener('pointerdown',onDragStart));
  $$('#board .b-card').forEach(c=>c.addEventListener('click',()=>{if(drag||c._justDragged)return;openBookingModal(c.dataset.open)}));
}
function onDragStart(e){
  if(e.button&&e.button!==0)return;
  const handle=e.currentTarget,card=handle.closest('.b-card'),b=state.bookings.find(x=>x.id===handle.dataset.drag);if(!b)return;
  e.preventDefault();e.stopPropagation();
  const rect=card.getBoundingClientRect();
  const ghost=card.cloneNode(true);ghost.classList.add('b-ghost');ghost.removeAttribute('data-card');ghost.removeAttribute('data-open');
  ghost.style.width=rect.width+'px';ghost.style.left=rect.left+'px';ghost.style.top=rect.top+'px';document.body.appendChild(ghost);
  card.classList.add('dragging');document.body.classList.add('is-dragging');
  const sv=state.services.find(s=>s.id===b.service_id);
  drag={b,card,ghost,offX:e.clientX-rect.left,offY:e.clientY-rect.top,cap:sv?sv.slot:0,target:null,moved:false,sx:e.clientX,sy:e.clientY};
  paintDropZones();
  window.addEventListener('pointermove',onDragMove);window.addEventListener('pointerup',onDragEnd);window.addEventListener('pointercancel',onDragCancel);
}
function paintDropZones(){ // beri warna hijau (kosong) / merah (penuh) pada seluruh sel lajur layanan ini
  $$('#board .b-cell').forEach(c=>{
    c.classList.remove('ok','no','hover');
    if(c.dataset.svc!==String(drag.b.service_id||''))return;
    c.classList.add(canPlace(drag.b,drag.cap,boardDate,+c.dataset.min).ok?'ok':'no');
  });
}
function onDragMove(e){
  if(!drag)return;
  if(Math.abs(e.clientX-drag.sx)+Math.abs(e.clientY-drag.sy)>4)drag.moved=true;
  drag.ghost.style.left=(e.clientX-drag.offX)+'px';drag.ghost.style.top=(e.clientY-drag.offY)+'px';
  // auto-scroll horizontal papan
  const sc=$('#boardScroll'),r=sc.getBoundingClientRect();
  if(e.clientX>r.right-60)sc.scrollLeft+=14;else if(e.clientX<r.left+110)sc.scrollLeft-=14;
  // cari sel di bawah titik kartu (tepi kiri ghost = jam mulai)
  const gx=e.clientX-drag.offX+8,gy=e.clientY;
  drag.ghost.style.visibility='hidden';
  const el=document.elementFromPoint(Math.max(gx,r.left+112),gy);drag.ghost.style.visibility='';
  const cell=el&&el.closest?.('.b-cell');
  $$('#board .b-cell.hover').forEach(c=>c.classList.remove('hover'));
  drag.target=null;drag.ghost.classList.remove('good','bad');
  if(cell&&cell.dataset.svc===String(drag.b.service_id||'')){
    const min=+cell.dataset.min,res=canPlace(drag.b,drag.cap,boardDate,min);
    drag.target={min,res};drag.ghost.classList.add(res.ok?'good':'bad');
    // sorot seluruh rentang durasi
    $$('#board .b-cell').forEach(c=>{if(c.dataset.svc===cell.dataset.svc){const m=+c.dataset.min;if(m>=min&&m<min+drag.b.duration_minutes)c.classList.add('hover')}});
    drag.ghost.dataset.tip=res.ok?`Pindah ke ${minToLabel(min)}`:res.why;
  }else drag.ghost.dataset.tip='Drag ke jam kosong (hijau)';
}
function endDragUI(){
  window.removeEventListener('pointermove',onDragMove);window.removeEventListener('pointerup',onDragEnd);window.removeEventListener('pointercancel',onDragCancel);
  document.body.classList.remove('is-dragging');
  $$('#board .b-cell').forEach(c=>c.classList.remove('ok','no','hover'));
  if(drag){drag.ghost.remove();drag.card.classList.remove('dragging');drag.card._justDragged=true;const c=drag.card;setTimeout(()=>c._justDragged=false,60)}
}
function onDragCancel(){endDragUI();drag=null}
function onDragEnd(){
  const d=drag;endDragUI();drag=null;if(!d)return;
  if(!d.moved){openBookingModal(d.b.id);return} // klik biasa pada nama → buka pop up
  if(!d.target){return}
  if(!d.target.res.ok){toast(d.target.res.why+' — pilih jam yang kosong.',true);return}
  const newLabel=minToLabel(d.target.min);
  if(newLabel===d.b.booking_time){return}
  askMove(d.b,boardDate,newLabel);
}
function askMove(b,date,time){
  $('#mvTitle').textContent=b.customer_name;
  $('#mvText').innerHTML=`${esc(b.service_name)}<br>Dari <b>${esc(b.booking_time)}</b> pindah ke <b>${esc(time)}</b> (${esc(fmtDate(date))}).<br>Customer akan dikirimi WhatsApp jadwal baru.`;
  openModalEl('#moveModal');
  $('#mvOk').onclick=async()=>{
    const w=preOpenWA();closeModalEl('#moveModal');
    await applyAction(b.id,'RESCHEDULE',{date,time,waWindow:w});
  };
  $('#mvNo').onclick=()=>closeModalEl('#moveModal');
}

/* ---------- Modal ---------- */
function openModalEl(sel){const m=$(sel);m.classList.add('show');m.setAttribute('aria-hidden','false')}
function closeModalEl(sel){const m=$(sel);m.classList.remove('show');m.setAttribute('aria-hidden','true')}
let curBooking=null;
function timeOptions(_,selected){$('#rsTime').innerHTML=SLOTS.map(m=>`<option value="${minToLabel(m)}">${minToLabel(m)}</option>`).join('');$('#rsTime').value=selected}
function openBookingModal(id){
  const b=state.bookings.find(x=>x.id===id);if(!b)return;curBooking=b;
  $('#bkRef').textContent='BOOKING · '+b.id.slice(0,8).toUpperCase();$('#bkName').textContent=b.customer_name;
  $('#bkInfo').innerHTML=`<div><small>STATUS</small><b class="st-pill st-${b.status}">${BADGE[b.status]||esc(b.status)}</b></div>
    <div><small>WHATSAPP</small><b>${esc(b.phone)}</b></div>
    <div><small>LAYANAN</small><b>${esc(b.service_name)}</b></div>
    <div><small>DURASI</small><b>${hoursOf(b)} jam</b></div>
    <div><small>JADWAL</small><b>${esc(fmtDate(b.booking_date))} · ${esc(b.booking_time)}</b></div>
    <div><small>TOTAL</small><b>${money(b.total_price)}</b>${b.promo_code?`<br><small>Promo ${esc(b.promo_code)}</small>`:''}</div>
    ${b.notes?`<div class="full"><small>CATATAN</small><b>${esc(b.notes)}</b></div>`:''}`;
  $('#rsDate').value=b.booking_date;$('#rsDate').min=todayISO();timeOptions('#rsTime',b.booking_time);
  updateResHint();
  const live=isActive(b);
  $$('[data-bk-act]').forEach(btn=>{
    const a=btn.dataset.bkAct;btn.disabled=!live;
    if(a==='CONFIRMED'&&b.status==='CONFIRMED')btn.disabled=true;
  });
  $('.bk-resched').classList.toggle('muted-box',!live);
  openModalEl('#bkModal');
}
function updateResHint(){
  if(!curBooking)return;const b=curBooking,date=$('#rsDate').value,t=$('#rsTime').value;if(!date||!t)return;
  const sv=state.services.find(s=>s.id===b.service_id),cap=sv?sv.slot:0;
  let res={ok:true};
  const start=labelToMin(t),now=new Date();
  if(date===todayISO()&&start<=now.getHours()*60+now.getMinutes())res={ok:false,why:'Jam sudah lewat'};
  else for(let m=start;m<start+b.duration_minutes;m+=STEP){
    const used=state.bookings.filter(x=>isActive(x)&&x.id!==b.id&&x.service_id===b.service_id&&x.booking_date===date&&labelToMin(x.booking_time)<=m&&labelToMin(x.booking_time)+x.duration_minutes>m).length;
    if(used>=cap){res={ok:false,why:`Penuh pukul ${minToLabel(m)}`};break}
  }
  const el=$('#rsHint');el.textContent=res.ok?'✓ Jadwal kosong — aman untuk dipindahkan.':'✕ '+res.why+'. Pilih jam lain.';el.className='fineprint '+(res.ok?'hint-ok':'hint-bad');
}
$('#rsDate').addEventListener('change',updateResHint);$('#rsTime').addEventListener('change',updateResHint);
$$('[data-bk-close]').forEach(b=>b.onclick=()=>closeModalEl('#bkModal'));
$('#bkModal').addEventListener('click',e=>{if(e.target.id==='bkModal')closeModalEl('#bkModal')});
$('#moveModal').addEventListener('click',e=>{if(e.target.id==='moveModal')closeModalEl('#moveModal')});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModalEl('#bkModal');closeModalEl('#moveModal')}});
$$('[data-bk-act]').forEach(btn=>btn.onclick=async()=>{
  if(!curBooking)return;const id=curBooking.id,act=btn.dataset.bkAct;
  if(act==='CANCELLED'&&!confirm('Batalkan booking ini? Customer akan dikirimi WhatsApp.'))return;
  if(act==='COMPLETED'&&!confirm('Tandai selesai? Kartu akan hilang dari dashboard, data & omset tetap tersimpan.'))return;
  const w=preOpenWA();
  const opts={waWindow:w};if(act==='RESCHEDULE'){opts.date=$('#rsDate').value;opts.time=$('#rsTime').value}
  closeModalEl('#bkModal');
  await applyAction(id,act,opts);
});

/* ---------- Antrian (kartu) & riwayat ---------- */
function bkCard(b,i){
  return `<article class="bk-card st-${b.status}" data-card="${b.id}" style="--d:${Math.min(i,10)*45}ms">
    <div class="bk-top"><b>${esc(b.customer_name)}</b><span class="st-pill st-${b.status}">${BADGE[b.status]}</span></div>
    <div class="bk-meta">${esc(b.service_name)} · ${hoursOf(b)} jam<br>${esc(b.booking_date)} · ${esc(b.booking_time)}<br><small>${esc(b.phone)} · ${money(b.total_price)}${b.promo_code?' · '+esc(b.promo_code):''}</small>${b.notes?`<br><small>${esc(b.notes)}</small>`:''}</div>
    <div class="bk-btns"><button class="abtn ok" data-q="CONFIRMED" data-id="${b.id}" ${b.status==='CONFIRMED'?'disabled':''}>Confirm</button><button class="abtn blue" data-q="OPEN" data-id="${b.id}">Reschedule</button><button class="abtn done" data-q="COMPLETED" data-id="${b.id}">Selesai</button><button class="abtn bad" data-q="CANCELLED" data-id="${b.id}">Cancel</button></div></article>`;
}
function renderQueue(){
  const live=state.bookings.filter(isActive).sort((a,b)=>(a.booking_date+a.booking_time).localeCompare(b.booking_date+b.booking_time));
  const box=$('#bookingList');
  $('#queueCount').textContent=live.length?`(${live.length})`:'';
  box.innerHTML=live.length?live.map(bkCard).join(''):'<p class="muted">Tidak ada booking aktif. Booking yang selesai/dibatalkan pindah ke riwayat.</p>';
  $$('[data-q]',box).forEach(btn=>btn.onclick=async()=>{
    const id=btn.dataset.id,a=btn.dataset.q;
    if(a==='OPEN'){openBookingModal(id);return}
    if(a==='CANCELLED'&&!confirm('Batalkan booking ini? Customer akan dikirimi WhatsApp.'))return;
    if(a==='COMPLETED'&&!confirm('Tandai selesai? Kartu akan hilang dari dashboard, data & omset tetap tersimpan.'))return;
    await applyAction(id,a);
  });
  $$('.bk-card',box).forEach(c=>c.addEventListener('click',e=>{if(e.target.closest('button'))return;openBookingModal(c.dataset.card)}));
  const hist=state.bookings.filter(b=>!isActive(b));
  $('#historyCount').textContent=hist.length?`(${hist.length})`:'';
  $('#historyList').innerHTML=hist.length?`<table><thead><tr><th>Booking</th><th>Jadwal</th><th>Total</th><th>Status</th></tr></thead><tbody>${hist.slice(0,200).map(b=>`<tr><td><b>${esc(b.id.slice(0,8).toUpperCase())}</b><br>${esc(b.customer_name)}<br><small>${esc(b.phone)}</small></td><td>${esc(b.service_name)}<br>${esc(b.booking_date)} · ${esc(b.booking_time)}</td><td>${money(b.total_price)}</td><td><span class="st-pill st-${b.status}">${BADGE[b.status]}</span></td></tr>`).join('')}</tbody></table>`:'<p class="muted">Belum ada riwayat.</p>';
}
function renderBookings(){renderBoard();renderQueue()}

/* ---------- Kontrol tanggal papan ---------- */
const shiftDay=n=>{const [y,m,d]=boardDate.split('-').map(Number);const t=new Date(y,m-1,d+n);boardDate=iso(t);renderBoard()};
$('#dayPrev').onclick=()=>shiftDay(-1);$('#dayNext').onclick=()=>shiftDay(1);
$('#dayToday').onclick=()=>{boardDate=todayISO();renderBoard()};
$('#boardDate').addEventListener('change',e=>{if(e.target.value){boardDate=e.target.value;renderBoard()}});
// jaga agar papan segar: muat ulang tiap 60 detik & saat tab kembali aktif
setInterval(()=>{if(!document.hidden&&!drag&&!$('#bkModal').classList.contains('show')&&$('#dashView')&&!$('#dashView').hidden)loadBookingsOnly()},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!$('#dashView').hidden)loadBookingsOnly()});

// saat tab Booking dibuka, papan dirender ulang agar bisa menggulir ke jam yang relevan
$$('.admin-side [data-tab="bookings"]').forEach(b=>b.addEventListener('click',()=>setTimeout(renderBoard,0)));
