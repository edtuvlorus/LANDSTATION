/* LAND STATION — dashboard admin. Semua upload & pengaturan disimpan ke Supabase (Storage + Database). */
const BUCKET=window.LS.bucket;
const state={services:[],packages:[],categories:[],promos:[],bookings:[],media:[],site:{}};

/* ---------- Util ---------- */
let toastTimer;
function toast(msg,error=false){const t=$('#toast');t.textContent=msg;t.className='toast show'+(error?' error':'');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),error?6000:2800)}
const fail=(err,ctx)=>{console.error(ctx,err);toast((ctx?ctx+': ':'')+(err?.message||err),true)};
const fmtSize=b=>b>1048576?(b/1048576).toFixed(1)+' MB':Math.max(1,Math.round(b/1024))+' KB';
const slug=s=>String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,30)||'layanan';

async function saveSetting(key,value){
  const {error}=await sb.from('site_settings').upsert({key,value},{onConflict:'key'});
  if(error)throw error;state.site[key]=value;
}

/* ---------- Upload ke Supabase Storage + catat di tabel media_files ---------- */
function shrinkImage(file,maxW=2400){
  return new Promise(resolve=>{
    if(!/^image\/(jpeg|png|webp)$/.test(file.type))return resolve({blob:file,type:file.type});
    const url=URL.createObjectURL(file),img=new Image();
    img.onerror=()=>{URL.revokeObjectURL(url);resolve({blob:file,type:file.type})};
    img.onload=()=>{
      URL.revokeObjectURL(url);
      if(img.width<=maxW&&file.size<=2.5*1048576)return resolve({blob:file,type:file.type});
      const k=Math.min(1,maxW/img.width),c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);
      const x=c.getContext('2d');x.fillStyle='#0b1018';x.fillRect(0,0,c.width,c.height);x.drawImage(img,0,0,c.width,c.height);
      c.toBlob(b=>b&&b.size<file.size?resolve({blob:b,type:'image/jpeg'}):resolve({blob:file,type:file.type}),'image/jpeg',.86);
    };
    img.src=url;
  });
}
async function uploadMedia(file,folder){
  const isVideo=file.type.startsWith('video/'),isImage=file.type.startsWith('image/');
  if(!isVideo&&!isImage)throw new Error('Format file tidak didukung (hanya foto/video).');
  const maxMB=isVideo?50:12;if(file.size>maxMB*1048576)throw new Error(`${file.name}: maksimal ${maxMB} MB untuk ${isVideo?'video':'foto'}.`);
  const {blob,type}=isImage?await shrinkImage(file):{blob:file,type:file.type};
  const ext=(type==='image/jpeg'?'jpg':type==='video/quicktime'?'mov':type.split('/')[1]||'bin').replace('svg+xml','svg');
  const path=`${folder}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
  const {error}=await sb.storage.from(BUCKET).upload(path,blob,{contentType:type,cacheControl:'31536000',upsert:false});
  if(error)throw error;
  const url=sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl,kind=isVideo?'video':'image';
  const {error:dbErr}=await sb.from('media_files').insert({path,url,kind,folder,mime:type,size_bytes:blob.size});
  if(dbErr){await sb.storage.from(BUCKET).remove([path]);throw dbErr}
  return {path,url,type:kind};
}
async function deleteMedia(path){
  if(!path)return;
  await sb.storage.from(BUCKET).remove([path]);
  await sb.from('media_files').delete().eq('path',path);
}
async function withBusy(label,fn){
  const btn=document.activeElement?.closest?.('.btn,.abtn');btn?.classList.add('is-busy');toast(label+'…');
  try{await fn()}catch(e){fail(e,'Gagal')}finally{btn?.classList.remove('is-busy')}
}

/* ---------- Auth ---------- */
const show=(id,v)=>{$(id).hidden=!v};
async function enter(){show('#loginView',false);show('#dashView',true);await loadAll()}
$('#loginForm').addEventListener('submit',async e=>{
  e.preventDefault();const btn=$('#loginBtn');btn.disabled=true;$('#loginMsg').textContent='';
  const {error}=await sb.auth.signInWithPassword({email:$('#loginEmail').value.trim(),password:$('#loginPass').value});
  btn.disabled=false;if(error){$('#loginMsg').textContent=/invalid login/i.test(error.message)?'Email atau password salah.':'Login gagal: '+error.message;return}
  $('#loginPass').value='';await enter();
});
$('#logoutBtn').addEventListener('click',async()=>{await sb.auth.signOut();show('#dashView',false);show('#loginView',true)});
(async()=>{const {data:{session}}=await sb.auth.getSession();if(session)await enter();else show('#loginView',true)})();
sb.auth.onAuthStateChange(ev=>{if(ev==='SIGNED_OUT'){show('#dashView',false);show('#loginView',true)}});

/* ---------- Tabs ---------- */
$$('.admin-side [data-tab]').forEach(b=>b.onclick=()=>{
  $$('.admin-side [data-tab]').forEach(x=>x.classList.toggle('active',x===b));
  $$('.admin-panel').forEach(p=>p.classList.toggle('active',p.id===b.dataset.tab));
});

/* ---------- Load semua data ---------- */
async function loadAll(){
  const [sv,pr,bk,md,st,pk,ct]=await Promise.all([
    sb.from('services').select('*').order('sort_order').order('name'),
    sb.from('promos').select('*').order('created_at',{ascending:false}),
    sb.from('bookings').select('*').order('created_at',{ascending:false}).limit(3000),
    sb.from('media_files').select('*').order('created_at',{ascending:false}),
    sb.from('site_settings').select('key,value'),
    sb.from('packages').select('*').order('sort_order').order('hours'),
    sb.from('service_categories').select('*').order('sort_order').order('name')]);
  for(const r of [sv,pr,bk,md,st,pk,ct])if(r.error){fail(r.error,'Memuat data');}
  state.services=sv.data||[];state.promos=pr.data||[];state.bookings=bk.data||[];state.media=md.data||[];state.packages=pk.data||[];state.categories=ct.data||[];
  state.site={};(st.data||[]).forEach(r=>state.site[r.key]=r.value);
  renderAll();
}
function renderAll(){renderOverview();renderHero();renderGallery();renderEventForm();renderCategories();renderPrices();renderServiceSelect();renderPackages();renderBookings();window.refreshExportHint?.();renderPromos();renderVenue();renderLibrary()}
/* ---------- Hero ---------- */
const previewHTML=(m,alt)=>m&&m.url?(m.type==='video'?`<video src="${esc(m.url)}" muted loop autoplay playsinline controls></video>`:`<img src="${esc(m.url)}" alt="${esc(alt)}">`):'<p class="fineprint">Belum ada media.</p>';
function renderHero(){$('#heroPreview').innerHTML=previewHTML(state.site.homepage_media||DEFAULT_HERO,'Preview hero')}
$('#heroFile').addEventListener('change',async e=>{
  const f=e.target.files[0];if(!f)return;
  await withBusy('Mengunggah hero',async()=>{
    const old=state.site.homepage_media?.path,up=await uploadMedia(f,'hero');
    await saveSetting('homepage_media',{url:up.url,type:up.type,path:up.path});
    await deleteMedia(old);await refreshMedia();renderHero();toast('Hero tersimpan di Supabase ✓');
  });e.target.value='';
});
$('#heroReset').addEventListener('click',async()=>{
  if(!confirm('Kembali ke hero bawaan? File hero yang di-upload akan dihapus dari Supabase.'))return;
  await withBusy('Mengatur ulang hero',async()=>{
    const old=state.site.homepage_media?.path;
    const {error}=await sb.from('site_settings').delete().eq('key','homepage_media');if(error)throw error;
    delete state.site.homepage_media;await deleteMedia(old);await refreshMedia();renderHero();toast('Hero dikembalikan ke bawaan ✓');
  });
});

/* ---------- Galeri ---------- */
const galleryItems=()=>state.site.gallery?.items||[];
function renderGallery(){
  const items=galleryItems(),box=$('#galleryAdmin');
  box.innerHTML=items.length?items.map((g,i)=>`<div class="thumb">${previewHTML(g,g.title)}<input data-g-title="${i}" value="${esc(g.title||'')}" aria-label="Judul ${i+1}" placeholder="Judul"><div class="thumb-actions"><label class="btn ghost small file-btn">GANTI<input type="file" hidden accept="image/*,video/mp4,video/webm,video/quicktime" data-g-rep="${i}"></label><button type="button" class="btn danger small" data-g-del="${i}">HAPUS</button></div></div>`).join(''):'<p class="fineprint">Belum ada file galeri — website memakai gambar bawaan. Upload file untuk menggantinya.</p>';
  $$('[data-g-title]',box).forEach(inp=>inp.onchange=()=>withBusy('Menyimpan judul',async()=>{const items=[...galleryItems()];items[+inp.dataset.gTitle]={...items[+inp.dataset.gTitle],title:inp.value.trim()};await saveSetting('gallery',{items});toast('Judul tersimpan ✓')}));
  $$('[data-g-rep]',box).forEach(inp=>inp.onchange=async()=>{
    const f=inp.files[0];if(!f)return;const idx=+inp.dataset.gRep;
    await withBusy('Mengganti file galeri',async()=>{
      const items=[...galleryItems()],old=items[idx];if(!old)return;
      const up=await uploadMedia(f,'gallery');
      items[idx]={...old,url:up.url,type:up.type,path:up.path};
      await saveSetting('gallery',{items});await deleteMedia(old.path);await refreshMedia();renderGallery();toast('File galeri diganti ✓');
    });inp.value='';
  });
  $$('[data-g-del]',box).forEach(b=>b.onclick=()=>{if(!confirm('Hapus file ini dari galeri dan dari Supabase?'))return;
    withBusy('Menghapus',async()=>{const items=[...galleryItems()],[gone]=items.splice(+b.dataset.gDel,1);await saveSetting('gallery',{items});await deleteMedia(gone?.path);await refreshMedia();renderGallery();toast('File galeri dihapus ✓')})});
}
$('#galleryFiles').addEventListener('change',async e=>{
  const files=[...e.target.files];if(!files.length)return;
  await withBusy(`Mengunggah ${files.length} file`,async()=>{
    const items=[...galleryItems()];let n=0;
    for(const f of files){try{const up=await uploadMedia(f,'gallery');items.push({url:up.url,type:up.type,path:up.path,title:f.name.replace(/\.[^.]+$/,'').replace(/[-_]+/g,' ').slice(0,40)});n++;await saveSetting('gallery',{items})}catch(err){fail(err,f.name)}}
    await refreshMedia();renderGallery();if(n)toast(`${n} file galeri tersimpan di Supabase ✓`);
  });e.target.value='';
});

/* ---------- Event ---------- */
const ev=()=>({...DEFAULT_EVENT,...(state.site.event||{})});
function renderEventForm(){
  const e=ev();$('#eventEnabled').checked=!!e.enabled;$('#eventTitleInput').value=state.site.event?e.title:'';$('#eventEyebrowInput').value=state.site.event?e.eyebrow:'';
  $('#eventDescriptionInput').value=state.site.event?e.description:'';$('#eventCtaInput').value=e.cta||'';
  $('#eventPreview').innerHTML=e.image?previewHTML({url:e.image,type:'image'},'Banner'):'';
}
const eventFromForm=()=>({...ev(),enabled:$('#eventEnabled').checked,title:$('#eventTitleInput').value.trim()||DEFAULT_EVENT.title,eyebrow:$('#eventEyebrowInput').value.trim()||DEFAULT_EVENT.eyebrow,description:$('#eventDescriptionInput').value.trim(),cta:$('#eventCtaInput').value.trim()||'#booking-info'});
$('#eventForm').addEventListener('submit',e=>{e.preventDefault();withBusy('Menyimpan banner',async()=>{await saveSetting('event',eventFromForm());renderEventForm();toast('Banner event tersimpan ✓')})});
$('#eventFile').addEventListener('change',async e=>{
  const f=e.target.files[0];if(!f)return;
  await withBusy('Mengunggah banner',async()=>{
    if(!f.type.startsWith('image/'))throw new Error('Banner harus berupa foto.');
    const old=state.site.event?.imagePath,up=await uploadMedia(f,'event');
    await saveSetting('event',{...eventFromForm(),enabled:true,image:up.url,imagePath:up.path});
    await deleteMedia(old);await refreshMedia();renderEventForm();toast('Foto banner tersimpan di Supabase ✓');
  });e.target.value='';
});

/* ---------- Layanan & harga per jam ---------- */
function renderPrices(){
  $('#priceTable').innerHTML=state.services.length?`<table><thead><tr><th>Layanan</th><th>Kategori</th><th>Harga / jam (Rp)</th><th>Jumlah</th><th>Aktif</th></tr></thead><tbody>${state.services.map(s=>`<tr><td><b>${esc(s.name)}</b></td><td>${esc(catNameOf(s.category_id)||'-')}</td><td><input type="number" min="0" step="500" value="${s.price}" data-price="${esc(s.id)}" aria-label="Harga ${esc(s.name)}"><span class="saved" data-saved="${esc(s.id)}"></span></td><td><input type="number" min="0" step="1" value="${s.slot}" data-slot="${esc(s.id)}" aria-label="Jumlah ${esc(s.name)}"></td><td><input type="checkbox" ${s.active?'checked':''} data-active="${esc(s.id)}" aria-label="Aktif ${esc(s.name)}"></td></tr>`).join('')}</tbody></table>`:'<p class="muted">Belum ada layanan.</p>';
  $$('[data-price]').forEach(inp=>inp.onchange=async()=>{
    const v=Math.max(0,Math.round(+inp.value||0)),id=inp.dataset.price,tag=$(`[data-saved="${CSS.escape(id)}"]`);
    const {error}=await sb.from('services').update({price:v}).eq('id',id);
    if(error){fail(error,'Harga gagal disimpan');return}
    state.services.find(s=>s.id===id).price=v;inp.value=v;tag.textContent='Tersimpan ✓';setTimeout(()=>tag.textContent='',2200);
  });
  $$('[data-slot]').forEach(inp=>inp.onchange=async()=>{const v=Math.max(0,Math.round(+inp.value||0)),id=inp.dataset.slot,{error}=await sb.from('services').update({slot:v}).eq('id',id);if(error){fail(error,'Jumlah gagal disimpan');return}state.services.find(s=>s.id===id).slot=v;inp.value=v;renderCategories();toast('Jumlah layanan tersimpan ✓')});
  $$('[data-active]').forEach(cb=>cb.onchange=async()=>{
    const {error}=await sb.from('services').update({active:cb.checked}).eq('id',cb.dataset.active);
    if(error){fail(error,'Status gagal disimpan');cb.checked=!cb.checked;return}
    state.services.find(s=>s.id===cb.dataset.active).active=cb.checked;toast('Status layanan tersimpan ✓');
  });
}
function renderServiceSelect(){
  const el=$('#serviceId'),old=el.value;el.innerHTML='<option value="new">+ Layanan baru</option>'+state.services.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');
  el.value=state.services.some(s=>s.id===old)?old:'new';fillServiceForm();
}
let serviceImg={url:'',path:''};
function fillServiceForm(){
  const s=state.services.find(x=>x.id===$('#serviceId').value);
  $('#serviceName').value=s?.name||'';$('#servicePrice').value=s?.price??'';$('#serviceSlot').value=s?.slot??'';$('#serviceDesc').value=s?.description||'';
  $('#serviceActive').value=String(s?s.active:true);$('#serviceCat').value=s?(s.category_id||''):(state.categories[0]?.id||'');serviceImg={url:s?.image_url||'',path:''};
  $('#servicePreview').innerHTML=serviceImg.url?previewHTML({url:serviceImg.url,type:'image'},'Foto layanan'):'';
}
$('#serviceId').addEventListener('change',fillServiceForm);
$('#serviceFile').addEventListener('change',async e=>{
  const f=e.target.files[0];if(!f)return;
  await withBusy('Mengunggah foto layanan',async()=>{
    if(!f.type.startsWith('image/'))throw new Error('Foto layanan harus berupa gambar.');
    const id=$('#serviceId').value,prevPath=serviceImg.path,oldUrl=state.services.find(s=>s.id===id)?.image_url,up=await uploadMedia(f,'services');serviceImg={url:up.url,path:up.path};
    $('#servicePreview').innerHTML=previewHTML({url:up.url,type:'image'},'Foto layanan');
    if(id!=='new'){ // layanan sudah ada → simpan otomatis
      const {error}=await sb.from('services').update({image_url:up.url}).eq('id',id);if(error)throw error;
      state.services.find(s=>s.id===id).image_url=up.url;const om=state.media.find(m=>m.url===oldUrl);if(om)await deleteMedia(om.path);toast('Foto layanan tersimpan di Supabase ✓');
    }else{if(prevPath)await deleteMedia(prevPath);toast('Foto ter-upload. Klik SIMPAN LAYANAN untuk menyimpan layanan baru.')}
    await refreshMedia();
  });e.target.value='';
});
$('#serviceForm').addEventListener('submit',e=>{e.preventDefault();withBusy('Menyimpan layanan',async()=>{
  const sel=$('#serviceId').value,isNew=sel==='new',name=$('#serviceName').value.trim();
  const row={name,description:$('#serviceDesc').value.trim(),price:Math.max(0,Math.round(+$('#servicePrice').value||0)),slot:Math.max(0,Math.round(+$('#serviceSlot').value||0)),image_url:serviceImg.url||'assets/arcade.svg',category_id:$('#serviceCat').value||null,active:$('#serviceActive').value==='true'};
  if(isNew){row.id=slug(name)+'-'+Math.random().toString(36).slice(2,5);row.sort_order=state.services.length+1;const {error}=await sb.from('services').insert(row);if(error)throw error}
  else{const {error}=await sb.from('services').update(row).eq('id',sel);if(error)throw error}
  await loadAll();if(isNew)$('#serviceId').value=row.id,fillServiceForm();toast('Layanan tersimpan di Supabase ✓');
})});
$('#deleteService').addEventListener('click',()=>{
  const id=$('#serviceId').value;if(id==='new')return;if(!confirm('Hapus layanan ini? Paket di layanan ini ikut terhapus, riwayat booking tetap tersimpan.'))return;
  withBusy('Menghapus layanan',async()=>{const {error}=await sb.from('services').delete().eq('id',id);if(error)throw error;const om=state.media.find(m=>m.url===state.services.find(s=>s.id===id)?.image_url);if(om)await deleteMedia(om.path);await loadAll();toast('Layanan dihapus ✓')});
});

/* ---------- Promo ---------- */
function renderPromos(){
  const box=$('#promoList');
  box.innerHTML=state.promos.length?`<table><thead><tr><th>Kode</th><th>Diskon</th><th>Slot</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${state.promos.map(p=>`<tr><td>${esc(p.code)}</td><td>${p.discount_type==='percent'?p.discount_value+'%':money(p.discount_value)}</td><td>${p.slots}</td><td>${p.active?'ON':'OFF'}</td><td><button data-ptoggle="${p.id}">${p.active?'OFF':'ON'}</button><button data-pdel="${p.id}">Hapus</button></td></tr>`).join('')}</tbody></table>`:'<p class="muted">Belum ada kode promo.</p>';
  $$('[data-ptoggle]',box).forEach(b=>b.onclick=()=>withBusy('Memperbarui promo',async()=>{const p=state.promos.find(x=>x.id===b.dataset.ptoggle),{error}=await sb.from('promos').update({active:!p.active}).eq('id',p.id);if(error)throw error;p.active=!p.active;renderPromos();renderOverview()}));
  $$('[data-pdel]',box).forEach(b=>b.onclick=()=>{if(!confirm('Hapus kode promo ini?'))return;withBusy('Menghapus promo',async()=>{const {error}=await sb.from('promos').delete().eq('id',b.dataset.pdel);if(error)throw error;await loadAll()})});
}
$('#promoForm').addEventListener('submit',e=>{e.preventDefault();withBusy('Menyimpan promo',async()=>{
  const row={code:$('#promoCode').value.trim().toUpperCase(),slots:Math.max(0,+$('#promoSlots').value||0),discount_type:$('#promoType').value,discount_value:Math.max(0,+$('#promoValue').value||0),active:$('#promoActive').value==='true'};
  const {error}=await sb.from('promos').upsert(row,{onConflict:'code'});if(error)throw error;e.target.reset();await loadAll();toast('Kode promo tersimpan ✓');
})});

/* ---------- Venue ---------- */
function renderVenue(){const v={...DEFAULT_VENUE,...(state.site.venue||{})};$('#venueAddress').value=v.address||'';$('#venueMaps').value=v.maps||'';$('#venueInstagram').value=v.instagram||''}
$('#venueForm').addEventListener('submit',e=>{e.preventDefault();withBusy('Menyimpan info',async()=>{
  await saveSetting('venue',{address:$('#venueAddress').value.trim(),maps:$('#venueMaps').value.trim()||DEFAULT_VENUE.maps,instagram:$('#venueInstagram').value.trim()||DEFAULT_VENUE.instagram});toast('Info venue tersimpan ✓');
})});

/* ---------- Media library ---------- */
async function refreshMedia(){const {data}=await sb.from('media_files').select('*').order('created_at',{ascending:false});state.media=data||[];renderLibrary();renderOverview()}
function usedUrls(){
  const u=new Set();const h=state.site.homepage_media;if(h?.url)u.add(h.url);galleryItems().forEach(g=>u.add(g.url));
  if(state.site.event?.image)u.add(state.site.event.image);state.services.forEach(s=>u.add(s.image_url));return u;
}
function renderLibrary(){
  const used=usedUrls(),box=$('#libraryGrid');
  box.innerHTML=state.media.length?state.media.map(m=>`<div class="thumb">${previewHTML({url:m.url,type:m.kind},m.path)}<span>${esc(m.folder)} · ${fmtSize(m.size_bytes)}</span>${used.has(m.url)?'<span class="tag-used">DIPAKAI WEBSITE</span>':`<button class="btn danger small" data-m-del="${esc(m.path)}">HAPUS</button>`}</div>`).join(''):'<p class="muted">Belum ada file yang di-upload.</p>';
  $$('[data-m-del]',box).forEach(b=>b.onclick=()=>{if(!confirm('Hapus file ini dari Supabase?'))return;withBusy('Menghapus file',async()=>{await deleteMedia(b.dataset.mDel);await refreshMedia();toast('File dihapus ✓')})});
}

/* ---------- Paket layanan (masuk ke kategori layanan) ---------- */
function pkgCapHint(){const s=state.services.find(x=>x.id===$('#pkgService').value);$('#pkgCap').textContent=s?`Paket ini memakai 1 unit dari layanan ${s.name} (jumlah ${s.slot} unit, diatur di tab Layanan & kategori).`:'Buat layanan dulu di tab Layanan & kategori.'}
function renderPackages(){
  const sel=$('#pkgService'),old=sel.value;
  const opt=s=>`<option value="${esc(s.id)}">${esc(s.name)} · ${s.slot} unit</option>`,groups=state.categories.map(c=>({n:c.name,l:state.services.filter(s=>s.category_id===c.id)})).filter(g=>g.l.length),loose=state.services.filter(s=>!state.categories.some(c=>c.id===s.category_id));
  sel.innerHTML=groups.map(g=>`<optgroup label="${esc(g.n)}">${g.l.map(opt).join('')}</optgroup>`).join('')+loose.map(opt).join('');
  if(state.services.some(s=>s.id===old))sel.value=old;pkgCapHint();
  const box=$('#pkgList'),svc=id=>state.services.find(s=>s.id===id);
  box.innerHTML=state.packages.length?`<table><thead><tr><th>Layanan</th><th>Paket</th><th>Durasi</th><th>Harga (Rp)</th><th>≈ / jam</th><th>Aktif</th><th></th></tr></thead><tbody>${state.packages.map(p=>{const s=svc(p.service_id);return `<tr><td><b>${esc(s?.name||p.service_id)}</b><br><small>${esc(catNameOf(s?.category_id)||'Tanpa kategori')} · ${s?.slot??0} unit</small></td><td>${esc(p.name)}</td><td>${p.hours} jam</td><td><input type="number" min="0" step="500" value="${p.price}" data-pk-price="${p.id}" aria-label="Harga ${esc(p.name)}"></td><td>${money(Math.round(p.price/p.hours))}</td><td><input type="checkbox" ${p.active?'checked':''} data-pk-active="${p.id}" aria-label="Aktif ${esc(p.name)}"></td><td><button type="button" data-pk-del="${p.id}">Hapus</button></td></tr>`}).join('')}</tbody></table>`:'<p class="muted">Belum ada paket.</p>';
  $$('[data-pk-price]',box).forEach(i=>i.onchange=()=>withBusy('Menyimpan harga paket',async()=>{const v=Math.max(0,Math.round(+i.value||0)),{error}=await sb.from('packages').update({price:v}).eq('id',i.dataset.pkPrice);if(error)throw error;state.packages.find(p=>p.id===i.dataset.pkPrice).price=v;renderPackages();toast('Harga paket tersimpan ✓')}));
  $$('[data-pk-active]',box).forEach(c=>c.onchange=()=>withBusy('Menyimpan status paket',async()=>{const {error}=await sb.from('packages').update({active:c.checked}).eq('id',c.dataset.pkActive);if(error){c.checked=!c.checked;throw error}state.packages.find(p=>p.id===c.dataset.pkActive).active=c.checked;toast('Status paket tersimpan ✓')}));
  $$('[data-pk-del]',box).forEach(b=>b.onclick=()=>{if(!confirm('Hapus paket ini?'))return;withBusy('Menghapus paket',async()=>{const {error}=await sb.from('packages').delete().eq('id',b.dataset.pkDel);if(error)throw error;await loadAll();toast('Paket dihapus ✓')})});
}
$('#pkgService').addEventListener('change',pkgCapHint);
$('#packageForm').addEventListener('submit',e=>{e.preventDefault();withBusy('Menyimpan paket',async()=>{
  const sid=$('#pkgService').value;if(!sid)throw new Error('Pilih layanan dulu.');
  const row={service_id:sid,name:$('#pkgName').value.trim(),hours:Math.min(12,Math.max(1,Math.round(+$('#pkgHours').value||1))),price:Math.max(0,Math.round(+$('#pkgPrice').value||0)),active:$('#pkgActive').value==='true',sort_order:state.packages.filter(p=>p.service_id===sid).length+1};
  const {error}=await sb.from('packages').insert(row);if(error)throw error;
  $('#pkgName').value='';$('#pkgPrice').value='';await loadAll();toast('Paket tersimpan ✓');
})});

/* ---------- Kategori layanan ---------- */
const catNameOf=id=>state.categories.find(c=>c.id===id)?.name||'';
function renderCategories(){
  const sc=$('#serviceCat'),old=sc.value;
  sc.innerHTML='<option value="">- Tanpa kategori -</option>'+state.categories.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
  sc.value=state.categories.some(c=>c.id===old)?old:'';
  const box=$('#catList');
  box.innerHTML=state.categories.length?`<table><thead><tr><th>Nama kategori</th><th>Layanan</th><th>Total unit</th><th></th></tr></thead><tbody>${state.categories.map(c=>{const l=state.services.filter(s=>s.category_id===c.id);return `<tr><td><input type="text" value="${esc(c.name)}" maxlength="40" data-cat-name="${esc(c.id)}" aria-label="Nama kategori"></td><td>${l.length}</td><td>${l.reduce((a,s)=>a+(+s.slot||0),0)}</td><td><button type="button" data-cat-del="${esc(c.id)}">Hapus</button></td></tr>`}).join('')}</tbody></table>`:'<p class="muted">Belum ada kategori.</p>';
  $$('[data-cat-name]',box).forEach(i=>i.onchange=()=>withBusy('Mengganti nama kategori',async()=>{const c=state.categories.find(x=>x.id===i.dataset.catName),v=i.value.trim();if(!v){i.value=c.name;return}const {error}=await sb.from('service_categories').update({name:v}).eq('id',c.id);if(error)throw error;c.name=v;renderCategories();renderPrices();renderPackages();toast('Nama kategori tersimpan ✓')}));
  $$('[data-cat-del]',box).forEach(b=>b.onclick=()=>{if(!confirm('Hapus kategori ini? Layanan di dalamnya tidak ikut terhapus.'))return;withBusy('Menghapus kategori',async()=>{const {error}=await sb.from('service_categories').delete().eq('id',b.dataset.catDel);if(error)throw error;await loadAll();toast('Kategori dihapus ✓')})});
}
$('#categoryForm').addEventListener('submit',e=>{e.preventDefault();withBusy('Menyimpan kategori',async()=>{
  const name=$('#catName').value.trim();if(!name)return;
  const {error}=await sb.from('service_categories').insert({id:slug(name)+'-'+Math.random().toString(36).slice(2,5),name,sort_order:state.categories.length+1});
  if(error)throw error;$('#catName').value='';await loadAll();toast('Kategori ditambahkan ✓');
})});
