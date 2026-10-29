const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const money=n=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(+n||0);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DEFAULT_GALLERY=[
  {url:'assets/arcade.svg',type:'image',title:'Arcade & Retro Gaming'},
  {url:'assets/ps5.svg',type:'image',title:'Console Gaming'},
  {url:'assets/billiard.svg',type:'image',title:'Billiard Lounge'},
  {url:'assets/ps4.svg',type:'image',title:'Gaming Station'}];
const DEFAULT_HERO={url:'assets/arcade.svg',type:'image'};
const DEFAULT_EVENT={enabled:false,title:'NEXT LEVEL COMPETITION',eyebrow:'LAND STATION EVENT',description:'Siap adu skill?',cta:'#booking-info',image:'assets/arcade.svg'};
const DEFAULT_VENUE={address:'',maps:'https://maps.google.com',instagram:'https://www.instagram.com/landstation.imy/'};
const mediaTag=(m,alt='')=>m.type==='video'
  ?`<video src="${esc(m.url)}" muted loop autoplay playsinline preload="metadata" aria-label="${esc(alt)}"></video>`
  :`<img src="${esc(m.url)}" alt="${esc(alt)}" loading="lazy">`;
