/* LAND STATION - export laporan booking ke PDF (harian / mingguan / bulanan).
   Memakai jsPDF + autoTable (CDN). Data diambil dari state.bookings dashboard. */
(function(){
  const typeEl=$('#expType'),dateEl=$('#expDate'),monthEl=$('#expMonth'),btn=$('#expBtn');
  if(!typeEl||!btn)return;
  dateEl.value=todayISO();monthEl.value=todayISO().slice(0,7);
  const short=d=>d.toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'});
  const rp=n=>'Rp '+(Math.round(+n)||0).toLocaleString('id-ID');
  const dmy=s=>s.split('-').reverse().join('/');
  const key=b=>b.booking_date+String(labelToMin(b.booking_time)).padStart(4,'0');

  function range(){
    if(typeEl.value==='month'){
      const [y,m]=(monthEl.value||todayISO().slice(0,7)).split('-').map(Number),a=new Date(y,m-1,1),b=new Date(y,m,0);
      return {kind:'Bulanan',from:iso(a),to:iso(b),label:a.toLocaleDateString('id-ID',{month:'long',year:'numeric'}),file:`${y}-${pad(m)}`};
    }
    const [y,m,d]=(dateEl.value||todayISO()).split('-').map(Number);
    if(typeEl.value==='week'){
      const dow=(new Date(y,m-1,d).getDay()+6)%7,a=new Date(y,m-1,d-dow),b=new Date(y,m-1,d-dow+6);
      return {kind:'Mingguan',from:iso(a),to:iso(b),label:`${short(a)} - ${short(b)}`,file:`${iso(a)}_sd_${iso(b)}`};
    }
    const a=new Date(y,m-1,d);
    return {kind:'Harian',from:iso(a),to:iso(a),label:fmtDate(iso(a)),file:iso(a)};
  }
  const pick=r=>state.bookings.filter(b=>b.booking_date>=r.from&&b.booking_date<=r.to).sort((a,b)=>key(a).localeCompare(key(b)));
  function hint(){const r=range();$('#expHint').textContent=`${r.kind}: ${r.label} - ${pick(r).length} booking`}
  function sync(){const mo=typeEl.value==='month';$('#expDateWrap').hidden=mo;$('#expMonthWrap').hidden=!mo;hint()}
  typeEl.addEventListener('change',sync);dateEl.addEventListener('change',hint);monthEl.addEventListener('change',hint);
  window.refreshExportHint=hint;sync();

  function build(){
    const J=window.jspdf;
    if(!J||!J.jsPDF){toast('Library PDF belum termuat. Periksa koneksi internet lalu muat ulang halaman.',true);return}
    const r=range(),list=pick(r);
    if(!list.length){toast('Tidak ada booking pada periode ini.',true);return}
    const doc=new J.jsPDF({orientation:'landscape',unit:'pt',format:'a4'});
    if(typeof doc.autoTable!=='function'){toast('Plugin tabel PDF belum termuat. Muat ulang halaman.',true);return}
    const W=doc.internal.pageSize.getWidth(),H=doc.internal.pageSize.getHeight(),M=36;
    const sum=l=>l.reduce((a,b)=>a+(+b.total_price||0),0),by=s=>list.filter(b=>b.status===s);
    const done=by('COMPLETED'),live=list.filter(isActive);

    doc.setFont('helvetica','bold');doc.setFontSize(18);doc.setTextColor(30,24,70);doc.text('LAND STATION - Laporan Booking '+r.kind,M,44);
    doc.setFont('helvetica','normal');doc.setFontSize(10);doc.setTextColor(90);
    doc.text('Periode: '+r.label,M,62);doc.text('Dicetak: '+new Date().toLocaleString('id-ID'),M,76);

    const head={fillColor:[30,24,70],textColor:255,fontStyle:'bold'};
    doc.autoTable({startY:92,margin:{left:M,right:M},tableWidth:330,theme:'grid',headStyles:head,styles:{fontSize:9,cellPadding:4},
      head:[['Ringkasan','Nilai']],
      body:[['Total booking',list.length],['Selesai',done.length],['Confirmed',by('CONFIRMED').length],['Pending / Reschedule',by('PENDING').length+by('RESCHEDULED').length],['Cancelled',by('CANCELLED').length],['OMSET (booking selesai)',rp(sum(done))],['Potensi omset (belum selesai)',rp(sum(live))]],
      columnStyles:{1:{halign:'right'}}});

    const svc={};list.forEach(b=>{const o=svc[b.service_name]||(svc[b.service_name]={n:0,d:0,c:0,rev:0});o.n++;if(b.status==='COMPLETED'){o.d++;o.rev+=+b.total_price||0}if(b.status==='CANCELLED')o.c++});
    doc.autoTable({startY:doc.lastAutoTable.finalY+14,margin:{left:M,right:M},tableWidth:460,theme:'grid',headStyles:head,styles:{fontSize:9,cellPadding:4},
      head:[['Layanan','Booking','Selesai','Batal','Omset (selesai)']],
      body:Object.entries(svc).sort((a,b)=>b[1].n-a[1].n).map(([k,o])=>[k,o.n,o.d,o.c,rp(o.rev)]),
      columnStyles:{1:{halign:'right'},2:{halign:'right'},3:{halign:'right'},4:{halign:'right'}}});

    doc.autoTable({startY:doc.lastAutoTable.finalY+18,margin:{left:M,right:M,bottom:34},theme:'striped',headStyles:head,footStyles:{fillColor:[235,233,255],textColor:[30,24,70],fontStyle:'bold'},styles:{fontSize:8,cellPadding:3.5,overflow:'linebreak'},
      showFoot:'lastPage',
      head:[['No','Kode','Customer','WhatsApp','Layanan / Paket','Tanggal','Jam','Durasi','Total','Status']],
      body:list.map((b,i)=>[i+1,b.id.slice(0,8).toUpperCase(),b.customer_name,b.phone,b.service_name+(b.package_name?' / '+b.package_name:''),dmy(b.booking_date),b.booking_time,hoursOf(b)+' jam',rp(b.total_price),BADGE[b.status]||b.status]),
      foot:[['','','','','','','','TOTAL OMSET (Selesai)',rp(sum(done)),'']],
      columnStyles:{0:{cellWidth:24},8:{halign:'right'}},
      didDrawPage:d=>{doc.setFontSize(8);doc.setTextColor(120);doc.text('Land Station - Laporan '+r.kind+' - Halaman '+d.pageNumber,W-M,H-16,{align:'right'})}});

    doc.save(`Laporan-LandStation-${r.kind}-${r.file}.pdf`);
    toast('PDF laporan diunduh ✓');
  }
  btn.addEventListener('click',()=>{btn.disabled=true;try{build()}catch(e){fail(e,'Export PDF gagal')}finally{btn.disabled=false}});
})();
