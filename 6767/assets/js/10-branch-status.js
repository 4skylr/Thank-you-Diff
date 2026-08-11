/* ==========================================================
   Noir Cinema · 10-branch-status.js
   وضع الفرع · الاداء اليومي · تعبئة ملف الاكسل
   تنبيه: ترتيب التحميل في index.html مهم - لا تغيره.
   ========================================================== */

/* ============================================================
   وضع الفرع — تقرير أداء يومي + نافذة منبثقة للموظف والمشرف
   + تعبئة ملف الإكسل تلقائياً من قراءة الـ PDF
   ============================================================ */
let perfDaily = [], perfBookDoc = null;
async function loadPerfDaily(){ perfDaily = await DB.list("perf_daily").catch(()=>[]); renderBranchStatus();
  if (!$("pCharts")?.classList.contains("hidden")) renderCharts(); }
async function loadPerfBook(){ perfBookDoc = await DB.get("perf_book","latest").catch(()=>null); renderBookMeta(); }

/* تاريخ التقرير من سطر From */
function perfReportDate(lines){
  for (const raw of lines){
    const m = String(raw).match(/From\s*:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
    if (m) return `${m[3]}-${String(+m[2]).padStart(2,"0")}-${String(+m[1]).padStart(2,"0")}`;
  }
  return null;
}
const DAY_EN = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MON_EN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function dayNameOf(key){ const d=new Date(key+"T12:00:00"); return DAY_EN[d.getDay()]; }
function prevMonthSameDay(key){
  const [y,m,d] = key.split("-").map(Number);
  const pm = m===1 ? 12 : m-1, py = m===1 ? y-1 : y;
  const last = new Date(py, pm, 0).getDate();
  return `${py}-${String(pm).padStart(2,"0")}-${String(Math.min(d,last)).padStart(2,"0")}`;
}
function perfDayDoc(key){ return perfDaily.find(x=>x.date===key) || null; }
function latestPerfDay(){ return [...perfDaily].sort((a,b)=>a.date<b.date?1:-1)[0] || null; }
function monthDocs(ym){ return perfDaily.filter(x=>String(x.date).startsWith(ym)); }

/* رفع تقرير الأداء اليومي: يحفظ اليوم + يعبّي الإكسل */
$("perfDayFile")?.addEventListener("change", async e=>{
  const f = e.target.files[0]; if(!f) return; e.target.value="";
  showLoadingCloud();
  try{
    $("perfDayStatus").textContent = t("perf_reading");
    const lines = await pdfToLines(f);
    const parsed = parsePerformanceLines(lines);
    const date = perfReportDate(lines);
    if (!date || !parsed?.summary?.totalAdmits==null){ }
    if (!date){ $("perfDayStatus").textContent = "❌ " + t("bs_no_date"); return; }
    const doc = {date, day: dayNameOf(date), ...parsed, ts: Date.now(), branch: curBranch()};
    await DB.set("perf_daily", date, doc);
    await loadPerfDaily();
    let xl = "";
    if (perfBookDoc?.b64){
      const okRow = await fillPerfBook(doc);
      xl = okRow ? " · 📊 " + t("bs_book_filled") : " · ⚠️ " + t("bs_book_norow");
    } else xl = " · ⚠️ " + t("bs_book_missing");
    $("perfDayStatus").textContent = "✅ " + t("bs_saved",{d:date}) + xl;
    toast("✅ " + t("bs_saved",{d:date}));
    openBranchStatus();
  }catch(err){ console.error(err); $("perfDayStatus").textContent = "❌ " + t("err") + err.message; }
  finally{ hideLoading(); }
});

/* ---------- ملف الإكسل: رفعه مرة واحدة ثم يتعبّى تلقائياً ---------- */
function bufToB64(buf){
  const bytes = new Uint8Array(buf); let bin = "";
  for (let i=0;i<bytes.length;i+=0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i+0x8000));
  return btoa(bin);
}
function b64ToBuf2(b64){
  const bin = atob(b64); const out = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}
$("perfBookFile")?.addEventListener("change", async e=>{
  const f = e.target.files[0]; if(!f) return; e.target.value="";
  showLoadingCloud();
  try{
    const buf = await f.arrayBuffer();
    const b64 = bufToB64(buf);
    await DB.set("perf_book","latest",{b64, name:f.name, ts:Date.now(), savedOn:todayKey()});
    await loadPerfBook();
    toast("✅ " + t("bs_book_saved"));
    $("perfBookStatus").textContent = "✅ " + t("bs_book_saved") + ` (${(buf.byteLength/1024).toFixed(0)} KB)`;
  }catch(err){ console.error(err); $("perfBookStatus").textContent = "❌ " + t("err") + err.message; }
  finally{ hideLoading(); }
});
function sheetKeyOf(name){ return String(name).replace(/\s+/g,"").toLowerCase(); }
/* يكتب أرقام اليوم في صفّه داخل شيت الشهر — الباقي معادلات تحسب نفسها */
async function fillPerfBook(doc){
  if (!perfBookDoc?.b64 || typeof ExcelJS === "undefined") return false;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(b64ToBuf2(perfBookDoc.b64));
  const [y,m,d] = doc.date.split("-").map(Number);
  const want = sheetKeyOf(`${MON_EN[m-1]}${y}`);
  const ws = wb.worksheets.find(w=>sheetKeyOf(w.name) === want);
  if (!ws) return false;
  let row = null;
  ws.eachRow(r=>{
    const v = r.getCell(2).value;
    if (v instanceof Date && v.getFullYear()===y && v.getMonth()+1===m && v.getDate()===d) row = r;
  });
  if (!row) return false;
  const s = doc.summary || {};
  const put = (col, val) => { if (val!==null && val!==undefined && !isNaN(val)) row.getCell(col).value = +val; };
  put("E", s.totalShows);            /* Total Shows */
  put("F", s.totalCapacity);         /* Total Available Capacity */
  put("G", s.totalAdmits);           /* Admits */
  put("H", s.bor);                   /* Box Office Revenue */
  put("M", s.gcam);                  /* GCAM */
  put("P", s.grossRevenue);          /* Concession Rev */
  put("R", s.concessionTransactions);/* Transactions */
  put("V", s.qtyItemsSold);          /* Items Sold */
  put("X", s.costOfGoods);           /* Concessions Standard Cost */
  const out = await wb.xlsx.writeBuffer();
  await DB.set("perf_book","latest",{...perfBookDoc, b64: bufToB64(out), ts: Date.now(), lastDay: doc.date});
  await loadPerfBook();
  return true;
}
async function downloadPerfBook(){
  if (!perfBookDoc?.b64) return toast("❌ " + t("bs_book_missing"));
  try{
    const day = perfBookDoc.lastDay || latestPerfDay()?.date || todayKey();
    const [y,m,d] = day.split("-");
    const name = `NC-Performance Unaizah - ${dayNameOf(day)} ${d}-${m}-${y}.xlsx`;
    const blob = new Blob([b64ToBuf2(perfBookDoc.b64)],
      {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 8000);
    toast("✅ " + t("xlsx_done"));
  }catch(e){ toast("❌ " + t("err") + e.message); }
}
function renderBookMeta(){
  const el = $("perfBookMeta"); if (!el) return;
  el.innerHTML = perfBookDoc?.b64
    ? `<span class="pill g">✓ ${esc(perfBookDoc.name||"workbook.xlsx")}${perfBookDoc.lastDay?` · ${t("bs_book_upto")} ${esc(perfBookDoc.lastDay)}`:""}</span>`
    : `<span class="sub" style="margin:0">${t("bs_book_missing")}</span>`;
}

/* ---------- نافذة وضع الفرع ---------- */
function pctDelta(now, before){
  if (before === null || before === undefined || !before) return null;
  return +(((now - before) / before) * 100).toFixed(1);
}
function deltaChip(now, before){
  const p = pctDelta(now, before);
  if (p === null) return `<span class="bsDelta flat">—</span>`;
  const up = p >= 0;
  return `<span class="bsDelta ${up?"up":"down"}">${up?"▲":"▼"} ${Math.abs(p)}%</span>`;
}
function branchStatusData(){
  const last = latestPerfDay();
  if (!last) return null;
  const prevKey = prevMonthSameDay(last.date);
  const prev = perfDayDoc(prevKey);
  const ym = last.date.slice(0,7);
  const mtd = monthDocs(ym);
  const sum = (arr, f) => arr.reduce((a,x)=>a + (f(x)||0), 0);
  const s = last.summary || {};
  const films = (last.films||[]).slice().sort((a,b)=>(b.bor||0)-(a.bor||0));
  const top = films[0] || null;
  const b = branchBudget?.branches?.[curBranch()] || null;
  const monthNo = +last.date.slice(5,7);
  const mo = b?.monthly?.[monthNo] || null;
  return {
    last, prev, prevKey,
    admits: s.totalAdmits||0, bor: s.bor||0, conc: s.grossRevenue||0,
    items: s.qtyItemsSold||0, occ: s.occupancyPct, shows: s.totalShows||0,
    total: s.totalRevenue||0, sph: s.spendPerHead,
    mtdAdmits: sum(mtd, x=>x.summary?.totalAdmits),
    mtdRev:    sum(mtd, x=>x.summary?.totalRevenue),
    mtdDays:   mtd.length,
    targetAdmits: mo?.targetAdmits || b?.annualTargetAdmits || null,
    targetRev:    mo?.targetRev    || b?.annualTargetRev    || null,
    topFilm: top
  };
}
function renderBranchStatus(){
  const el = $("bsBody"); if (!el) return;
  const d = branchStatusData();
  /* احتفال عند بلوغ هدف الشهر (مرة واحدة لكل شهر) */
  if (d && d.targetAdmits && d.mtdAdmits >= d.targetAdmits){
    const k = "noir_goal_" + d.last.date.slice(0,7);
    try{ if (!localStorage.getItem(k)){ localStorage.setItem(k,"1"); setTimeout(()=>celebrate("big"), 700); } }catch(e){}
  }
  if (!d){ el.innerHTML = `<div class="empty" style="padding:28px 16px"><svg class="ic"><use href="#i-chart"/></svg><div>${t("bs_none")}</div></div>`; return; }
  const ps = d.prev?.summary || {};
  const remAdmits = d.targetAdmits!=null ? Math.max(0, d.targetAdmits - d.mtdAdmits) : null;
  const remRev    = d.targetRev!=null    ? Math.max(0, d.targetRev - d.mtdRev)       : null;
  const pctA = d.targetAdmits ? Math.min(100, (d.mtdAdmits/d.targetAdmits)*100) : 0;
  const pctR = d.targetRev    ? Math.min(100, (d.mtdRev/d.targetRev)*100)       : 0;
  el.innerHTML = `
    <div class="bsHead">
      <div class="bsDate">${esc(d.last.day || dayNameOf(d.last.date))} · ${esc(d.last.date)}</div>
      <div class="bsSub">${t("bs_last_night")}</div>
    </div>
    <div class="bsGrid">
      <div class="bsCard"><div class="bsIco">👥</div><div class="bsV">${fmt(d.admits)}</div><div class="bsL">${t("bs_visitors")}</div>${deltaChip(d.admits, ps.totalAdmits)}</div>
      <div class="bsCard"><div class="bsIco">🎟️</div><div class="bsV">${fmt(d.bor)}</div><div class="bsL">${t("bs_tickets")}</div>${deltaChip(d.bor, ps.bor)}</div>
      <div class="bsCard"><div class="bsIco">🍿</div><div class="bsV">${fmt(d.conc)}</div><div class="bsL">${t("bs_fnb")}</div>${deltaChip(d.conc, ps.grossRevenue)}</div>
      <div class="bsCard"><div class="bsIco">💰</div><div class="bsV">${fmt(d.total)}</div><div class="bsL">${t("bs_total")}</div>${deltaChip(d.total, ps.totalRevenue)}</div>
    </div>
    <div class="bsMini">
      <span>🎬 ${t("bs_shows")}: <b>${fmt(d.shows)}</b></span>
      <span>📊 ${t("bs_occ")}: <b>${d.occ!=null?d.occ+"%":"—"}</b></span>
      <span>🛒 ${t("bs_items")}: <b>${fmt(d.items)}</b></span>
      <span>💵 ${t("bs_sph")}: <b>${d.sph!=null?fmt(d.sph):"—"}</b></span>
    </div>

    ${d.topFilm ? `<div class="bsFilm">
      <div class="bsFilmTag">🏆 ${t("bs_top_film")}</div>
      <div class="bsFilmName">${esc(d.topFilm.name)}</div>
      <div class="bsMini" style="margin-top:6px">
        <span>👥 <b>${fmt(d.topFilm.admits||0)}</b></span>
        <span>💰 <b>${fmt(d.topFilm.bor||0)}</b></span>
        <span>🎬 <b>${fmt(d.topFilm.shows||0)}</b> ${t("bs_shows")}</span>
      </div></div>` : ""}

    <div class="bsSection">${t("bs_mtd")} — ${fmt(d.mtdDays)} ${t("days")}</div>
    <div class="bsGrid two">
      <div class="bsCard"><div class="bsIco">👥</div><div class="bsV">${fmt(d.mtdAdmits)}</div><div class="bsL">${t("bs_mtd_visitors")}</div></div>
      <div class="bsCard"><div class="bsIco">💰</div><div class="bsV">${fmt(d.mtdRev)}</div><div class="bsL">${t("bs_mtd_rev")}</div></div>
    </div>
    ${d.targetAdmits!=null || d.targetRev!=null ? `
      <div class="bsSection">${t("bs_target")}</div>
      ${d.targetAdmits!=null ? `<div class="bsBarRow">
        <div class="bsBarTop"><span>${t("bs_visitors")}</span><b>${fmt(d.mtdAdmits)} / ${fmt(d.targetAdmits)}</b></div>
        <div class="bsBar"><i style="width:${pctA.toFixed(1)}%"></i></div>
        <div class="bsRem">${remAdmits ? t("bs_remaining",{n:fmt(remAdmits)}) : "🎉 " + t("bs_reached")}</div>
      </div>` : ""}
      ${d.targetRev!=null ? `<div class="bsBarRow">
        <div class="bsBarTop"><span>${t("bs_revenue")}</span><b>${fmt(d.mtdRev)} / ${fmt(d.targetRev)}</b></div>
        <div class="bsBar"><i style="width:${pctR.toFixed(1)}%"></i></div>
        <div class="bsRem">${remRev ? t("bs_remaining_sar",{n:fmt(remRev)}) : "🎉 " + t("bs_reached")}</div>
      </div>` : ""}` : `<div class="bsSection">${t("bs_target")}</div><div class="sub" style="margin:0">${t("bs_no_target")}</div>`}

    <div class="bsSection">${t("bs_vs_last_month")} — ${esc(d.prevKey)}</div>
    ${d.prev ? `<div class="tableWrap"><table>
      <thead><tr><th>${t("bs_metric")}</th><th>${t("bs_now")}</th><th>${t("bs_then")}</th><th>${t("bs_change")}</th></tr></thead>
      <tbody>
        ${[[t("bs_visitors"), d.admits, ps.totalAdmits],
           [t("bs_tickets"),  d.bor,    ps.bor],
           [t("bs_fnb"),      d.conc,   ps.grossRevenue],
           [t("bs_items"),    d.items,  ps.qtyItemsSold]]
          .map(([k,a,b2])=>`<tr><td>${k}</td><td class="num">${fmt(a)}</td><td class="num">${b2!=null?fmt(b2):"—"}</td><td>${deltaChip(a,b2)}</td></tr>`).join("")}
      </tbody></table></div>` : `<div class="sub" style="margin:0">${t("bs_no_prev")}</div>`}`;
}
function openBranchStatus(){
  const m = $("bsModal"); if (!m) return;
  renderBranchStatus();
  m.classList.remove("hidden");
  try{ localStorage.setItem("noir_bs_seen", todayKey()); }catch(e){}
}
function closeBranchStatus(){ $("bsModal")?.classList.add("hidden"); }
/* تظهر تلقائياً أول فتح باليوم */
function maybeAutoBranchStatus(){
  try{ if (localStorage.getItem("noir_bs_seen") === todayKey()) return; }catch(e){}
  if (!latestPerfDay()) return;
  setTimeout(openBranchStatus, 1200);
}
