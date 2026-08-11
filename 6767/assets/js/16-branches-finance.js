/* ==========================================================
   Noir Cinema · 16-branches-finance.js
   مقارنة الفروع · المالية · الميزانية
   تنبيه: ترتيب التحميل في index.html مهم - لا تغيره.
   ========================================================== */

/* ============================================================
   أداء الفرع الشهري (Performance Analysis) — لوحة احترافية،
   خانة رفع لكل شهر، مقارنة بين الأشهر، ظاهر للفريق (قابل للإخفاء)،
   وحساب CEO لعرض القراءة فقط
   ============================================================ */
let perfReports = {}, perfHidden = false;
let perfSelectedMonth = null, perfSelectedMonthE = null, perfSelectedMonthC = null;
let perfUploadTargetMonth = null;
function perfMonthKey(y,m){ return `${y}-${String(m+1).padStart(2,"0")}`; }
function perfMonthLabel(key){
  const [y,m] = key.split("-").map(Number);
  const name = LANG==="ar" ? AR_MONTHS[m-1] : new Date(2000,m-1,1).toLocaleDateString("en-GB",{month:"long"});
  return `${name} ${y}`;
}
async function loadPerfReports(){
  const list = await DB.list("performance_reports");
  perfReports = {}; list.forEach(r=>perfReports[r.id]=r);
  const setting = await DB.get("app_settings", "perf_visibility").catch(()=>null);
  perfHidden = !!setting?.hidden;
  renderPerfMonthGrid("", session?.role==="admin");
  renderPerfMonthGrid("E", false);
  renderPerfMonthGrid("C", false);
  renderPerfCompare();
  renderPerfYTD();
  applyPerfVisibilityUI();
  renderFileTimestamps();
}
function applyPerfVisibilityUI(){
  const card = $("pPerfE");
  if (card) card.classList.toggle("hidden", perfHidden);
  const btn = $("perfHideBtnLbl");
  if (btn){ btn.textContent = t(perfHidden ? "perf_show_toggle" : "perf_hide_toggle"); btn.setAttribute("data-i18n", perfHidden ? "perf_show_toggle" : "perf_hide_toggle"); }
}
async function togglePerfHidden(){
  perfHidden = !perfHidden;
  await DB.set("app_settings", "perf_visibility", {hidden: perfHidden});
  applyPerfVisibilityUI();
  toast(perfHidden ? t("t_perf_hidden") : t("t_perf_shown"));
}
function renderPerfMonthGrid(scope, uploadable){
  const el = $("perfMonthGrid"+scope); if (!el) return;
  const year = new Date().getFullYear();
  const cards = [];
  for (let m=0; m<12; m++){
    const key = perfMonthKey(year, m);
    const rec = perfReports[key];
    const label = LANG==="ar" ? AR_MONTHS[m] : new Date(2000,m,1).toLocaleDateString("en-GB",{month:"long"});
    const clickAttr = rec ? `onclick="showPerfDashboard('${key}','${scope}')"` : (uploadable ? `onclick="onPerfMonthClick('${key}')"` : "");
    cards.push(`<div class="card" style="padding:12px;text-align:center;cursor:${(rec||uploadable)?"pointer":"default"};margin:0" ${clickAttr}>
      <div style="font-weight:800;font-size:13px">${label}</div>
      <div style="font-size:11px;margin-top:4px;color:${rec?"var(--green)":"var(--muted)"}">${rec?"✅ "+t("perf_uploaded"):"— "+t("perf_not_uploaded")}</div>
    </div>`);
  }
  el.innerHTML = cards.join("") || emptyState("perf_no_months","chart");
}
function onPerfMonthClick(key){
  perfUploadTargetMonth = key;
  $("perfFile").click();
}
$("perfFile")?.addEventListener("change", async e=>{
  const f = e.target.files[0]; if (!f) return; e.target.value = "";
  const key = perfUploadTargetMonth; if (!key) return;
  showLoadingCloud();
  try{
    toast(t("perf_reading"));
    const lines = await pdfToLines(f);
    const parsed = parsePerformanceLines(lines);
    const doc = {...parsed, month:key, uploadedAt: Date.now(), uploadedBy: session?.name || "Skylr"};
    await DB.set("performance_reports", key, doc);
    toast("✅ " + t("t_perf_saved"));
    await loadPerfReports();
    showPerfDashboard(key, "");
  }catch(err){ toast("❌ " + t("err") + err.message); }
  finally{ hideLoading(); }
});
function renderPerfCompare(){
  const body = $("perfCompareBody"); if (!body) return;
  const keys = Object.keys(perfReports).sort();
  body.innerHTML = keys.length ? keys.map(k=>{
    const s = perfReports[k].summary || {};
    return `<tr><td>${esc(perfMonthLabel(k))}</td><td class="num">${s.totalAdmits!=null?fmt(s.totalAdmits):"—"}</td>
      <td class="num">${s.totalRevenue!=null?fmt(s.totalRevenue):"—"}</td>
      <td class="num">${s.occupancyPct!=null?s.occupancyPct+"%":"—"}</td>
      <td class="num">${s.concessionNetRevenue!=null?fmt(s.concessionNetRevenue):"—"}</td></tr>`;
  }).join("") : `<tr><td colspan="5">${emptyState("perf_no_data","chart")}</td></tr>`;
}
function computeYTD(){
  const year = new Date().getFullYear();
  const keys = Object.keys(perfReports).filter(k=>k.startsWith(year+"-")).sort();
  if (!keys.length) return null;
  const sum = {totalAdmits:0,totalShows:0,totalTransactions:0,totalRevenue:0,bor:0,netBor:0,concessionNetRevenue:0,
    qtyItemsSold:0,costOfGoods:0,grossRevenue:0,profitStdCost:0,totalCapacity:0};
  keys.forEach(k=>{
    const s = perfReports[k].summary || {};
    Object.keys(sum).forEach(f=>{ sum[f] += (s[f]||0); });
  });
  const s = sum;
  s.occupancyPct = s.totalCapacity ? +((s.totalAdmits/s.totalCapacity)*100).toFixed(2) : null;
  s.atp = s.totalAdmits ? +(s.bor/s.totalAdmits).toFixed(2) : null;
  s.netAtp = s.totalAdmits ? +(s.netBor/s.totalAdmits).toFixed(2) : null;
  s.profitPct = s.grossRevenue ? +((s.profitStdCost/s.grossRevenue)*100).toFixed(2) : null;
  s.avgSalePerTx = s.totalTransactions ? +(s.grossRevenue/s.totalTransactions).toFixed(2) : null;
  s.spendPerHead = s.totalAdmits ? +(s.grossRevenue/s.totalAdmits).toFixed(2) : null;
  const filmMap = {};
  keys.forEach(k=>(perfReports[k].films||[]).forEach(f=>{
    if (!filmMap[f.name]) filmMap[f.name] = {name:f.name, shows:0, admits:0, bor:0, netBor:0};
    const m = filmMap[f.name];
    m.shows += f.shows||0; m.admits += f.admits||0; m.bor += f.bor||0; m.netBor += f.nettBor||0;
  }));
  const films = Object.values(filmMap).map(f=>({...f,
    atp: f.admits ? +(f.bor/f.admits).toFixed(2) : 0,
    netAtp: f.admits ? +(f.netBor/f.admits).toFixed(2) : 0
  })).sort((a,b)=>b.bor-a.bor);
  const prodMap = {};
  keys.forEach(k=>(perfReports[k].products||[]).forEach(p=>{
    if (!prodMap[p.name]) prodMap[p.name] = {name:p.name, category:p.category, qty:0, netSales:0, netProfit:0};
    const m = prodMap[p.name];
    m.qty += p.qty||0; m.netSales += p.netSales||0; m.netProfit += p.netProfit||0;
  }));
  const products = Object.values(prodMap).map(p=>({...p,
    salesMixPct: s.grossRevenue ? +((p.netSales/s.grossRevenue)*100).toFixed(1) : null
  })).sort((a,b)=>b.netSales-a.netSales);
  return {summary:s, films, products, monthsCount:keys.length, year};
}
function renderPerfYTDInto(ids){
  const card = ids.card ? $(ids.card) : null;
  const ytd = computeYTD();
  if (!ytd){ if (card) card.classList.add("hidden"); return; }
  if (card) card.classList.remove("hidden");
  const monthsEl = $(ids.months);
  if (monthsEl) monthsEl.textContent = `${ytd.monthsCount} / 12 — ${ytd.year}`;
  const kpiEl = $(ids.kpis);
  if (kpiEl) kpiEl.innerHTML = perfKpiHTML(ytd.summary);
  const films = ytd.films.slice(0, ids.limit||10);
  const maxBor = Math.max(1, ...films.map(f=>f.bor||0));
  const filmsEl = $(ids.films);
  if (filmsEl) filmsEl.innerHTML = films.length ? films.map((f,i)=>`
    <tr><td class="num">${perfRank(i)}</td>${posterCellHTML("filmPosterYtd"+ids.kpis+"_"+i)}<td>${esc(f.name)}</td><td class="num">${fmt(f.shows)}</td><td class="num">${fmt(f.admits)}</td>
    ${perfBarCell(f.bor||0, maxBor, "var(--p1)")}<td class="num">${fmt(f.atp)}</td></tr>`).join("")
    : `<tr><td colspan="7">${emptyState("no_results_match","search")}</td></tr>`;
  loadFilmPosters(films, "filmPosterYtd"+ids.kpis+"_");
  const products = ytd.products.slice(0, ids.limit?Math.min(ids.limit+5,15):15);
  const maxSales = Math.max(1, ...products.map(p=>p.netSales||0));
  const prodEl = $(ids.prods);
  if (prodEl) prodEl.innerHTML = products.length ? products.map((p,i)=>`
    <tr><td class="num">${perfRank(i)}</td><td>${esc(p.name)}</td><td>${perfCatLabel(p)}</td><td class="num">${fmt(p.qty)}</td>
    ${perfBarCell(p.netSales||0, maxSales, "var(--gold)")}<td class="num">${fmt(p.netProfit)}</td><td class="num">${p.salesMixPct!=null?p.salesMixPct+"%":"—"}</td></tr>`).join("")
    : `<tr><td colspan="7">${emptyState("no_results_match","search")}</td></tr>`;
}
function renderPerfYTD(){
  renderPerfYTDInto({card:"perfYtdCard", months:"perfYtdMonths", kpis:"perfYtdKpiRow", films:"perfYtdFilmsBody", prods:"perfYtdProductsBody"});
  renderPerfYTDInto({card:"perfYtdCardC", months:"perfYtdMonthsC", kpis:"perfYtdKpiRowC", films:"perfYtdFilmsBodyC", prods:"perfYtdProductsBodyC"});
}
function downloadYtdReport(){
  const ytd = computeYTD(); if (!ytd) return toast(t("perf_no_data"));
  const s = ytd.summary;
  const kpiRows = [
    [t("perf_kpi_admits"), s.totalAdmits],[t("perf_kpi_shows"), s.totalShows],
    [t("perf_kpi_occupancy"), s.occupancyPct!=null?s.occupancyPct+"%":"—"],
    [t("perf_kpi_bor"), s.bor],[t("perf_kpi_total_revenue"), s.totalRevenue],
    [t("perf_kpi_concession_net"), s.concessionNetRevenue],[t("perf_kpi_atp"), s.atp],
    [t("perf_kpi_cogs"), s.costOfGoods],[t("perf_kpi_profit_pct"), s.profitPct!=null?s.profitPct+"%":"—"],
    [t("perf_kpi_avg_sale_tx"), s.avgSalePerTx],[t("perf_kpi_items_sold"), s.qtyItemsSold],
    [t("perf_kpi_spend_head"), s.spendPerHead]
  ];
  const films = ytd.films.map((f,i)=>`<tr><td>${i+1}</td><td>${esc(f.name)}</td><td>${fmt(f.shows)}</td><td>${fmt(f.admits)}</td><td>${fmt(f.bor)}</td><td>${fmt(f.atp)}</td></tr>`).join("");
  const products = ytd.products.map((p,i)=>`<tr><td>${i+1}</td><td>${esc(p.name)}</td><td>${perfCatLabel(p)}</td><td>${fmt(p.qty)}</td><td>${fmt(p.netSales)}</td></tr>`).join("");
  const w = window.open("", "_blank");
  w.document.write(`<!DOCTYPE html><html lang="${LANG}" dir="${LANG==="ar"?"rtl":"ltr"}"><head><meta charset="UTF-8">
  <title>${t("perf_ytd_title")} - ${ytd.year}</title>
  <style>
    body{font-family:'Segoe UI',Tahoma,sans-serif;padding:30px;color:#111}
    h1{font-size:20px;color:#4c1d95} h2{font-size:15px;color:#4c1d95;margin-top:26px;border-bottom:2px solid #eee;padding-bottom:4px}
    .kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:14px 0}
    .kpi{border:1px solid #eee;border-radius:10px;padding:10px;text-align:center}
    .kpi b{display:block;font-size:15px;color:#4c1d95} .kpi span{font-size:11px;color:#777}
    table{width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:10px}
    th{background:#4c1d95;color:#fff;padding:8px;text-align:${LANG==="ar"?"right":"left"}}
    td{padding:7px 8px;border-bottom:1px solid #ddd}
    tr:nth-child(even) td{background:#f7f5fb}
    .foot{margin-top:24px;color:#999;font-size:11px;text-align:center}
  </style></head><body>
  <h1>${t("perf_ytd_title")} — ${ytd.year} (${ytd.monthsCount}/12)</h1>
  <div class="kpis">${kpiRows.map(([l,v])=>`<div class="kpi"><b>${v==null?"—":(typeof v==="number"?fmt(v):v)}</b><span>${l}</span></div>`).join("")}</div>
  <h2>${t("perf_films_title")}</h2>
  <table><thead><tr><th>#</th><th>${t("th_film")}</th><th>${t("th_shows")}</th><th>${t("th_admits")}</th><th>${t("th_bor")}</th><th>${t("th_atp")}</th></tr></thead><tbody>${films}</tbody></table>
  <h2>${t("perf_products_title")}</h2>
  <table><thead><tr><th>#</th><th>${t("th_product")}</th><th>${t("th_category")}</th><th>${t("th_qty_now")}</th><th>${t("th_net_sales")}</th></tr></thead><tbody>${products}</tbody></table>
  <div class="foot">© 2026 Skylr — All Rights Reserved</div>
  <script>window.onload=()=>window.print()<\/script></body></html>`);
  w.document.close();
}
/* ---------- مقارنة الفروع الخمسة (ملف الميزانية الأسبوعية) ---------- */
const BRANCH_LABELS_AR = {HAFAR:"حفر الباطن", KHAFJI:"الخفجي", UNAIZAH:"عنيزة", DAMMAM:"الدمام", MITHNAB:"المذنب"};
const BUDGET_MONTH_MAP = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,sept:9,oct:10,nov:11,dec:12};
let branchBudget = null;
function branchLabelName(key){ return LANG==="ar" ? (BRANCH_LABELS_AR[key]||key) : (key.charAt(0)+key.slice(1).toLowerCase()); }
function budgetNum(v){
  if (v==null) return null;
  if (typeof v === "object" && v.result!=null) v = v.result;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}
function budgetExtractMonth(label, prevMonth){
  const m = label.match(/\(([^)]*)\)/);
  if (!m) return prevMonth;
  const mm = m[1].match(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec/i);
  if (!mm) return prevMonth;
  return BUDGET_MONTH_MAP[mm[0].toLowerCase().slice(0,4)] || BUDGET_MONTH_MAP[mm[0].toLowerCase().slice(0,3)] || prevMonth;
}
async function parseBranchBudgetWorkbook(file){
  const buf = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const branches = {};
  wb.worksheets.forEach(ws=>{
    const m = ws.name.match(/NC\s*-?\s*([A-Za-z]+)\s*-\s*Weekly Target/i);
    if (!m) return;
    const key = m[1].toUpperCase();
    let currentMonth = 1;
    const monthly = {};
    let annualTargetAdmits = null, annualTargetRev = null, latestYtd = null;
    ws.eachRow(row=>{
      const label = row.getCell(2).value;
      const wTA = budgetNum(row.getCell(3).value), wAA = budgetNum(row.getCell(4).value);
      const wTR = budgetNum(row.getCell(5).value), wAR = budgetNum(row.getCell(6).value);
      const yTA = budgetNum(row.getCell(8).value), yAA = budgetNum(row.getCell(9).value);
      const yTR = budgetNum(row.getCell(10).value), yAR = budgetNum(row.getCell(11).value);
      if (typeof label === "string" && /^Week/i.test(label.trim())){
        currentMonth = budgetExtractMonth(label, currentMonth);
        if (!monthly[currentMonth]) monthly[currentMonth] = {targetAdmits:0, achAdmits:0, targetRev:0, achRev:0};
        const mo = monthly[currentMonth];
        mo.targetAdmits += wTA||0; mo.targetRev += wTR||0;
        if (wAA!=null) mo.achAdmits += wAA;
        if (wAR!=null) mo.achRev += wAR;
        if (wAA!=null || wAR!=null) latestYtd = {targetAdmits:yTA, achAdmits:yAA, targetRev:yTR, achRev:yAR};
      } else if ((!label || !String(label).trim()) && wTA!=null){
        annualTargetAdmits = wTA; annualTargetRev = wTR;
      }
    });
    if (latestYtd) branches[key] = {monthly, annualTargetAdmits, annualTargetRev, latestYtd};
  });
  return branches;
}
async function loadBranchBudget(){
  branchBudget = await DB.get("branch_budget", "latest").catch(()=>null);
  renderBranchBudget();
  renderFileTimestamps();
}
$("branchBudgetFile")?.addEventListener("change", async e=>{
  const f = e.target.files[0]; if (!f) return; e.target.value = "";
  showLoadingCloud();
  try{
    $("branchBudgetStatus").textContent = t("branches_reading");
    const branches = await parseBranchBudgetWorkbook(f);
    if (!Object.keys(branches).length){ $("branchBudgetStatus").textContent = "❌ " + t("branches_err"); return; }
    await DB.set("branch_budget", "latest", {branches, uploadedAt: Date.now(), uploadedBy: session?.name || "Skylr"});
    $("branchBudgetStatus").textContent = "✅ " + t("t_branch_saved");
    toast("✅ " + t("t_branch_saved"));
    await loadBranchBudget();
  }catch(err){ $("branchBudgetStatus").textContent = "❌ " + t("err") + err.message; }
  finally{ hideLoading(); }
});
function renderBranchBudget(){
  renderBranchBudgetInto("");
  renderBranchBudgetInto("C");
}
function renderBranchBudgetInto(scope){
  const rankCard = $("branchRankCard"+scope), monthCard = $("branchMonthlyCard"+scope);
  const branches = branchBudget?.branches;
  if (!branches || !Object.keys(branches).length){
    if (rankCard) rankCard.classList.add("hidden");
    if (monthCard) monthCard.classList.add("hidden");
    return;
  }
  if (rankCard) rankCard.classList.remove("hidden");
  if (monthCard) monthCard.classList.remove("hidden");
  const rows = Object.entries(branches).map(([key, b])=>{
    const pctAnnualRev = b.annualTargetRev ? (b.latestYtd.achRev/b.annualTargetRev*100) : 0;
    const pctAnnualAdmits = b.annualTargetAdmits ? (b.latestYtd.achAdmits/b.annualTargetAdmits*100) : 0;
    const paceRev = b.latestYtd.targetRev ? (b.latestYtd.achRev/b.latestYtd.targetRev*100) : 0;
    return {key, b, pctAnnualRev, pctAnnualAdmits, paceRev};
  }).sort((a,b)=>b.pctAnnualRev-a.pctAnnualRev);
  const maxPct = Math.max(1, ...rows.map(r=>r.pctAnnualRev));
  const rankBody = $("branchRankBody"+scope);
  if (rankBody) rankBody.innerHTML = rows.map((r,i)=>{
    const paceColor = r.paceRev>=100 ? "var(--green)" : r.paceRev>=85 ? "var(--amber)" : "var(--red)";
    const paceLabel = r.paceRev>=100 ? t("ahead") : r.paceRev>=85 ? t("on_track") : t("behind");
    const barWidth = Math.min(100, (r.pctAnnualRev/maxPct)*100);
    return `<div class="card" style="padding:14px 16px;margin:0 0 10px">
      <div class="toolRow" style="justify-content:space-between;margin-bottom:8px">
        <div style="font-weight:800;font-size:14px">${perfRank(i)} ${esc(branchLabelName(r.key))}</div>
        <div style="text-align:end">
          <span style="font-family:'JetBrains Mono';font-weight:800;font-size:18px;color:var(--p1)">${r.pctAnnualRev.toFixed(1)}%</span>
          <span style="font-size:11px;color:${paceColor};font-weight:700;margin-inline-start:6px">● ${paceLabel}</span>
        </div>
      </div>
      <div style="height:14px;border-radius:8px;background:rgba(139,92,246,.08);overflow:hidden;position:relative">
        <div style="height:100%;width:${barWidth}%;border-radius:8px;background:linear-gradient(90deg,var(--p2),var(--p1))"></div>
      </div>
      <div class="statRow" style="margin-top:10px;margin-bottom:0">
        <div class="stat" style="padding:10px"><div class="v" style="font-size:16px">${fmt(r.b.annualTargetRev)}</div><div class="l">${t("branches_annual_target")}</div></div>
        <div class="stat" style="padding:10px"><div class="v" style="font-size:16px">${fmt(r.b.latestYtd.achRev)}</div><div class="l">${t("branches_ytd_ach")}</div></div>
        <div class="stat" style="padding:10px"><div class="v" style="font-size:16px">${r.pctAnnualAdmits.toFixed(1)}%</div><div class="l">${t("branches_admits")}</div></div>
      </div>
    </div>`;
  }).join("");
  const monthsPresent = [...new Set(rows.flatMap(r=>Object.keys(r.b.monthly).map(Number)))].sort((a,b)=>a-b);
  const branchKeys = rows.map(r=>r.key);
  const headEl = $("branchMonthlyHead"+scope);
  if (headEl) headEl.innerHTML = `<th>${LANG==="ar"?"الشهر":"Month"}</th>` +
    branchKeys.map(k=>`<th>${esc(branchLabelName(k))}</th>`).join("");
  const bodyEl = $("branchMonthlyBody"+scope);
  if (bodyEl) bodyEl.innerHTML = monthsPresent.map(mo=>{
    const vals = branchKeys.map(k=>branches[k].monthly[mo]?.achRev || 0);
    const best = Math.max(...vals);
    const label = LANG==="ar" ? AR_MONTHS[mo-1] : new Date(2000,mo-1,1).toLocaleDateString("en-GB",{month:"long"});
    return `<tr><td style="font-weight:700">${label}</td>` + vals.map(v=>
      `<td class="num" style="${v===best && best>0 ? 'color:var(--green);font-weight:800':''}">${v>0?fmt(v):"—"}</td>`
    ).join("") + `</tr>`;
  }).join("");
}
/* ---------- المالية: التحصيل اليومي DCS ---------- */
let financeReports = {}, finSelectedMonth = null, finSelectedMonthC = null, finUploadTargetMonth = null;
const FIN_FIELDS = ["cash","credit","online","prepaid","voucher","other","jahez","offers","hunger","comp","total"];
const FIN_HEADER_MAP = [
  ["cash", /^cash$/i], ["credit", /credit/i], ["online", /^online$/i], ["prepaid", /pre[\s-]?paid/i],
  ["voucher", /voucher/i], ["other", /^other$/i], ["jahez", /jahez/i], ["offers", /buy one|free offer|offer/i],
  ["hunger", /hunger/i], ["comp", /^comp$/i], ["total", /^total$/i]
];
function finNum(v){ const n = parseFloat(String(v==null?"":v).replace(/,/g,"")); return isNaN(n) ? 0 : n; }
function parseDcsWorkbook(buf){
  const wb = XLSX.read(buf, {type:"array"});
  const days = [];
  for (const sheetName of wb.SheetNames){
    const dm = sheetName.match(/(\d{1,2})[\-_/](\d{1,2})[\-_/](\d{2,4})/);
    if (!dm) continue;
    const day = +dm[1], mon = +dm[2];
    let year = +dm[3]; if (year < 100) year += 2000;
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {header:1, raw:true, defval:null});
    /* إيجاد صف العناوين (يحتوي Cash و Credit) وربط كل عمود باسمه */
    let headerIdx = -1, colMap = {};
    for (let r=0; r<Math.min(rows.length, 8); r++){
      const cells = (rows[r]||[]).map(c=>String(c==null?"":c).trim());
      if (cells.some(c=>/^cash$/i.test(c)) && cells.some(c=>/credit/i.test(c))){
        headerIdx = r;
        cells.forEach((c,ci)=>{
          for (const [field, re] of FIN_HEADER_MAP){
            if (re.test(c) && colMap[field]===undefined){ colMap[field] = ci; break; }
          }
        });
        break;
      }
    }
    if (headerIdx < 0 || colMap.total===undefined) continue;
    /* صف الإجمالي اليومي = أول صف بعد العناوين خانة "User" فيه فارغة ومجموعه أكبر من صفر،
       وإن لم يوجد نجمع صفوف الموظفين يدوياً */
    let totalsRow = null;
    const userRows = [];
    for (let r=headerIdx+1; r<rows.length; r++){
      const row = rows[r]||[];
      const first = String(row[0]==null?"":row[0]).trim();
      const isNumericFirst = first!=="" && !isNaN(parseFloat(first)) && isFinite(first);
      if (first==="" || first==null){
        const tot = finNum(row[colMap.total]);
        const anyVals = FIN_FIELDS.some(f=>colMap[f]!==undefined && finNum(row[colMap[f]])!==0);
        if (!totalsRow && (tot>0 || anyVals)){ totalsRow = row; }
        continue;
      }
      if (isNumericFirst || /deposit|balance|final/i.test(first)) continue;
      if (/^user$/i.test(first)) continue;
      userRows.push(row);
    }
    const rec = {day, mon, year};
    if (totalsRow){
      FIN_FIELDS.forEach(f=>rec[f] = colMap[f]!==undefined ? finNum(totalsRow[colMap[f]]) : 0);
    } else {
      FIN_FIELDS.forEach(f=>rec[f] = 0);
      userRows.forEach(row=>FIN_FIELDS.forEach(f=>{ if (colMap[f]!==undefined) rec[f] += finNum(row[colMap[f]]); }));
    }
    if (!rec.total) rec.total = rec.cash+rec.credit+rec.online+rec.prepaid+rec.voucher+rec.other+rec.jahez+rec.offers+rec.hunger+rec.comp;
    days.push(rec);
  }
  days.sort((a,b)=>a.day-b.day);
  return days;
}
function finTotals(days){
  const s = {}; FIN_FIELDS.forEach(f=>s[f]=0);
  days.forEach(d=>FIN_FIELDS.forEach(f=>s[f]+= d[f]||0));
  return s;
}
async function loadFinanceReports(){
  const list = await DB.list("finance_reports");
  financeReports = {}; list.forEach(r=>financeReports[r.id]=r);
  renderFinMonthGrid("", session?.role==="admin");
  renderFinMonthGrid("C", false);
  renderFinCompare();
  renderFileTimestamps();
}
function renderFinMonthGrid(scope, uploadable){
  const el = $("finMonthGrid"+scope); if (!el) return;
  const year = new Date().getFullYear();
  const cards = [];
  for (let m=0; m<12; m++){
    const key = perfMonthKey(year, m);
    const rec = financeReports[key];
    const label = LANG==="ar" ? AR_MONTHS[m] : new Date(2000,m,1).toLocaleDateString("en-GB",{month:"long"});
    const clickAttr = rec ? `onclick="showFinanceDashboard('${key}','${scope}')"` : (uploadable ? `onclick="onFinMonthClick('${key}')"` : "");
    const info = rec ? `✅ ${t("fin_uploaded")} (${(rec.days||[]).length} ${LANG==="ar"?"يوم":"days"})` : "— " + t("fin_not_uploaded");
    cards.push(`<div class="card" style="padding:12px;text-align:center;cursor:${(rec||uploadable)?"pointer":"default"};margin:0" ${clickAttr}>
      <div style="font-weight:800;font-size:13px">${label}</div>
      <div style="font-size:11px;margin-top:4px;color:${rec?"var(--green)":"var(--muted)"}">${info}</div>
      ${rec && uploadable ? `<button class="btn ghost small" style="margin-top:6px" onclick="event.stopPropagation();onFinMonthClick('${key}')">↻</button>` : ""}
    </div>`);
  }
  el.innerHTML = cards.join("");
}
function onFinMonthClick(key){
  finUploadTargetMonth = key;
  $("finFile").click();
}
$("finFile")?.addEventListener("change", async e=>{
  const f = e.target.files[0]; if (!f) return; e.target.value = "";
  const key = finUploadTargetMonth; if (!key) return;
  showLoadingCloud();
  try{
    $("finStatus").textContent = t("fin_reading");
    const days = parseDcsWorkbook(await f.arrayBuffer());
    if (!days.length){ $("finStatus").textContent = "❌ " + t("fin_err"); return; }
    const doc = {month:key, days, totals: finTotals(days), uploadedAt: Date.now(), uploadedBy: session?.name || "Skylr"};
    await DB.set("finance_reports", key, doc);
    $("finStatus").textContent = "";
    toast("✅ " + t("t_fin_saved"));
    await loadFinanceReports();
    showFinanceDashboard(key, "");
  }catch(err){ $("finStatus").textContent = "❌ " + t("err") + err.message; }
  finally{ hideLoading(); }
});
function finKpiHTML(s, daysCount){
  const avg = daysCount ? s.total/daysCount : 0;
  const cards = [
    [fmt(s.total), t("fin_total"), "var(--p1)"],
    [fmt(s.cash), t("fin_cash"), "var(--green)"],
    [fmt(s.credit), t("fin_credit"), "var(--gold)"],
    [fmt(s.online), t("fin_online"), null],
    [fmt(s.prepaid), t("fin_prepaid"), null],
    [fmt(s.jahez), t("fin_jahez"), null],
    [fmt(s.hunger), t("fin_hunger"), null],
    [fmt(s.offers + s.voucher), t("fin_offers"), null],
    [daysCount, t("fin_days_count"), null],
    [fmt(+avg.toFixed(2)), t("fin_avg_day"), null],
  ];
  return `<div class="statRow">` + cards.map(([v,l,c])=>`<div class="stat"><div class="v"${c?` style="color:${c}"`:""}>${v}</div><div class="l">${l}</div></div>`).join("") + `</div>`;
}
function finMixBarsHTML(s){
  const items = [
    ["fin_cash", s.cash, "var(--green)"],
    ["fin_credit", s.credit, "var(--gold)"],
    ["fin_online", s.online, "var(--p1)"],
    ["fin_prepaid", s.prepaid, "#38bdf8"],
    ["fin_jahez", s.jahez, "#fb7185"],
    ["fin_hunger", s.hunger, "#fbbf24"],
    ["fin_offers", s.offers + s.voucher, "#a78bfa"],
  ].filter(x=>x[1]>0);
  const tot = s.total || items.reduce((a,x)=>a+x[1],0) || 1;
  return items.sort((a,b)=>b[1]-a[1]).map(([k,v,c])=>{
    const pct = (v/tot*100);
    return `<div style="margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
        <span style="font-weight:700">${t(k)}</span>
        <span style="font-family:'JetBrains Mono';font-weight:800;color:${c}">${fmt(+v.toFixed(2))} · ${pct.toFixed(1)}%</span>
      </div>
      <div style="height:10px;border-radius:6px;background:rgba(139,92,246,.08);overflow:hidden">
        <div style="height:100%;width:${Math.min(100,pct)}%;border-radius:6px;background:${c}"></div>
      </div>
    </div>`;
  }).join("") || emptyState("fin_no_data","chart");
}
function finVerifyHTML(key, s){
  const perf = perfReports[key];
  const nonCash = (s.voucher||0) + (s.comp||0) + (s.offers||0);
  const netCollected = (s.total||0) - nonCash;
  if (!perf?.summary?.totalRevenue){
    return `<div class="card" style="padding:12px 14px;margin:0;border:1px dashed var(--line2)">
      <div style="font-weight:800;font-size:13px;margin-bottom:4px">🔎 ${t("fin_verify_title")}</div>
      <div class="sub" style="margin:0">${t("fin_v_missing")}</div></div>`;
  }
  const perfRev = perf.summary.totalRevenue;
  const diff = +(netCollected - perfRev).toFixed(2);
  const diffPct = perfRev ? (diff/perfRev*100) : 0;
  const ok = Math.abs(diffPct) <= 5;
  const color = ok ? "var(--green)" : "var(--red)";
  return `<div class="card" style="padding:14px 16px;margin:0;border:1px solid ${ok?"rgba(52,211,153,.35)":"rgba(248,113,113,.4)"}">
    <div class="toolRow" style="justify-content:space-between;margin-bottom:10px">
      <div style="font-weight:800;font-size:13px">🔎 ${t("fin_verify_title")}</div>
      <span class="pill ${ok?"g":"r"}">${ok ? "✓ " + t("fin_v_ok") : "⚠ " + t("fin_v_review")}</span>
    </div>
    <div class="statRow" style="margin-bottom:8px">
      <div class="stat" style="padding:10px"><div class="v" style="font-size:16px">${fmt(s.total)}</div><div class="l">${t("fin_dcs_all")}</div></div>
      <div class="stat" style="padding:10px"><div class="v" style="font-size:16px">${fmt(+nonCash.toFixed(2))}</div><div class="l">${t("fin_noncash")}</div></div>
      <div class="stat" style="padding:10px"><div class="v" style="font-size:16px">${fmt(+netCollected.toFixed(2))}</div><div class="l">${t("fin_net_collected")}</div></div>
      <div class="stat" style="padding:10px"><div class="v" style="font-size:16px">${fmt(perfRev)}</div><div class="l">${t("fin_perf_rev")}</div></div>
      <div class="stat" style="padding:10px"><div class="v" style="font-size:16px;color:${color}">${diff>0?"+":""}${fmt(diff)} <small style="font-size:11px">(${diffPct>0?"+":""}${diffPct.toFixed(1)}%)</small></div><div class="l">${t("fin_diff")}</div></div>
    </div>
    <div class="sub" style="margin:0">${t("fin_v_note")}</div>
  </div>`;
}
function showFinanceDashboard(key, scope){
  const rec = financeReports[key]; if (!rec) return;
  if (scope==="C") finSelectedMonthC = key; else finSelectedMonth = key;
  const card = $("finDashCard"+scope); if (!card) return;
  card.classList.remove("hidden");
  const titleEl = $("finDashTitle"+scope);
  if (titleEl) titleEl.textContent = `${t("fin_dash_title")} — ${perfMonthLabel(key)}`;
  const s = rec.totals || finTotals(rec.days||[]);
  $("finKpiRow"+scope).innerHTML = finKpiHTML(s, (rec.days||[]).length);
  const verifyEl = $("finVerify"+scope);
  if (verifyEl) verifyEl.innerHTML = finVerifyHTML(key, s);
  $("finMixBars"+scope).innerHTML = finMixBarsHTML(s);
  const best = Math.max(1, ...(rec.days||[]).map(d=>d.total||0));
  $("finDailyBody"+scope).innerHTML = (rec.days||[]).map(d=>`
    <tr><td style="font-weight:700">${d.day}</td><td class="num">${fmt(d.cash)}</td><td class="num">${fmt(d.credit)}</td>
    <td class="num">${fmt(d.online)}</td><td class="num">${fmt(d.prepaid)}</td><td class="num">${fmt(d.jahez)}</td>
    <td class="num">${fmt(d.hunger)}</td><td class="num">${fmt(d.offers + (d.voucher||0))}</td>
    ${perfBarCell(d.total||0, best, "var(--p1)")}</tr>`).join("") || `<tr><td colspan="9">${emptyState("fin_no_data","chart")}</td></tr>`;
}
function renderFinCompare(){
  ["finMonthsDash","finMonthsDashC"].forEach(id=>{
    const el = $(id); if (!el) return;
    const keys = Object.keys(financeReports).sort();
    if (!keys.length){ el.innerHTML = emptyState("fin_no_data","chart"); return; }
    el.innerHTML = keys.map(k=>{
      const rec = financeReports[k];
      const s = rec.totals || finTotals(rec.days||[]);
      const cells = [
        [t("fin_cash"), s.cash, "var(--green)"],
        [t("fin_credit"), s.credit, "var(--gold)"],
        [t("fin_online"), s.online, "var(--p1)"],
        [t("fin_prepaid"), s.prepaid, "#38bdf8"],
        [t("fin_jahez"), s.jahez, "#fb7185"],
        [t("fin_hunger"), s.hunger, "#fbbf24"],
        [t("fin_offers"), (s.offers||0)+(s.voucher||0), "#a78bfa"],
      ];
      return `<div class="card" style="padding:14px;margin:0;cursor:pointer" onclick="showFinanceDashboard('${k}', '${id==="finMonthsDashC"?"C":""}')">
        <div class="toolRow" style="justify-content:space-between;margin-bottom:10px">
          <div style="font-weight:800;font-size:14px">${esc(perfMonthLabel(k))}</div>
          <div style="text-align:end">
            <div style="font-family:'JetBrains Mono';font-weight:800;font-size:18px;color:var(--p1)">${fmt(+(+s.total).toFixed(2))}</div>
            <div style="font-size:10.5px;color:var(--muted)">${t("fin_total")} · ${(rec.days||[]).length} ${LANG==="ar"?"يوم":"days"}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px">
          ${cells.map(([l,v,c])=>`<div style="border:1px solid var(--line);border-radius:9px;padding:7px 9px;display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:11px;color:var(--muted)">${l}</span>
            <span style="font-family:'JetBrains Mono';font-weight:800;font-size:12.5px;color:${c};direction:ltr">${fmt(+(+(v||0)).toFixed(2))}</span>
          </div>`).join("")}
        </div>
      </div>`;
    }).join("");
  });
}
function downloadFinanceReport(key){
  const rec = key ? financeReports[key] : null; if (!rec) return toast(t("fin_no_data"));
  const s = rec.totals || finTotals(rec.days||[]);
  const daysCount = (rec.days||[]).length;
  const kpis = [
    [t("fin_total"), s.total],[t("fin_cash"), s.cash],[t("fin_credit"), s.credit],[t("fin_online"), s.online],
    [t("fin_prepaid"), s.prepaid],[t("fin_jahez"), s.jahez],[t("fin_hunger"), s.hunger],[t("fin_offers"), s.offers+s.voucher],
    [t("fin_days_count"), daysCount],[t("fin_avg_day"), daysCount? +(s.total/daysCount).toFixed(2):0]
  ];
  const dailyRows = (rec.days||[]).map(d=>`<tr><td>${d.day}</td><td>${fmt(d.cash)}</td><td>${fmt(d.credit)}</td><td>${fmt(d.online)}</td><td>${fmt(d.prepaid)}</td><td>${fmt(d.jahez)}</td><td>${fmt(d.hunger)}</td><td>${fmt(d.offers+(d.voucher||0))}</td><td><b>${fmt(d.total)}</b></td></tr>`).join("");
  const w = window.open("", "_blank");
  w.document.write(`<!DOCTYPE html><html lang="${LANG}" dir="${LANG==="ar"?"rtl":"ltr"}"><head><meta charset="UTF-8">
  <title>${t("fin_report_title")} - ${key}</title>
  <style>
    body{font-family:'Segoe UI',Tahoma,sans-serif;padding:30px;color:#111}
    h1{font-size:20px;color:#4c1d95} h2{font-size:15px;color:#4c1d95;margin-top:22px;border-bottom:2px solid #eee;padding-bottom:4px}
    .kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:14px 0}
    .kpi{border:1px solid #eee;border-radius:10px;padding:10px;text-align:center}
    .kpi b{display:block;font-size:14px;color:#4c1d95} .kpi span{font-size:10.5px;color:#777}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th{background:#4c1d95;color:#fff;padding:7px;text-align:${LANG==="ar"?"right":"left"}}
    td{padding:6px 7px;border-bottom:1px solid #ddd}
    tr:nth-child(even) td{background:#f7f5fb}
    .foot{margin-top:24px;color:#999;font-size:11px;text-align:center}
  </style></head><body>
  <h1>${t("fin_report_title")} — ${perfMonthLabel(key)}</h1>
  <div class="kpis">${kpis.map(([l,v])=>`<div class="kpi"><b>${typeof v==="number"?fmt(v):v}</b><span>${l}</span></div>`).join("")}</div>
  <h2>${t("fin_daily_title")}</h2>
  <table><thead><tr><th>${t("fin_th_day")}</th><th>${t("fin_cash")}</th><th>${t("fin_credit")}</th><th>${t("fin_online")}</th><th>${t("fin_prepaid")}</th><th>${t("fin_jahez")}</th><th>${t("fin_hunger")}</th><th>${t("fin_offers")}</th><th>${t("fin_total")}</th></tr></thead><tbody>${dailyRows}</tbody></table>
  <div class="foot">© 2026 Skylr — All Rights Reserved</div>
  <script>window.onload=()=>window.print()<\/script></body></html>`);
  w.document.close();
}
const filmPosterCache = {};
async function fetchFilmPoster(name){
  if (filmPosterCache[name] !== undefined) return filmPosterCache[name];
  try{
    const clean = name.replace(/\(.*?\)/g,"").replace(/:.*$/,"").replace(/\s*-\s*$/,"").trim() || name;
    const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(clean)}&media=movie&entity=movie&limit=1`);
    const data = await res.json();
    const url = data?.results?.[0]?.artworkUrl100 ? data.results[0].artworkUrl100.replace("100x100bb","300x300bb") : null;
    filmPosterCache[name] = url;
    return url;
  }catch(e){ filmPosterCache[name] = null; return null; }
}
function posterCellHTML(id){
  return `<td style="padding:4px"><div id="${id}" style="width:32px;height:44px;border-radius:5px;background:var(--card2);display:flex;align-items:center;justify-content:center;font-size:16px;overflow:hidden">🎬</div></td>`;
}
function loadFilmPosters(films, idPrefix){
  films.forEach((f,i)=>{
    fetchFilmPoster(f.name).then(url=>{
      if (!url) return;
      const box = document.getElementById(idPrefix+i);
      if (box) box.innerHTML = `<img src="${url}" alt="" style="width:100%;height:100%;object-fit:cover">`;
    });
  });
}
function perfPrevMonthKey(key){
  const [y,m] = key.split("-").map(Number);
  const d = new Date(y, m-2, 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}
function perfTrendBadge(cur, prev){
  if (cur==null || prev==null || !prev) return "";
  const diff = ((cur-prev)/Math.abs(prev))*100;
  if (!isFinite(diff)) return "";
  const up = diff>=0;
  const color = up ? "var(--green)" : "var(--red)";
  const arrow = up ? "▲" : "▼";
  return `<span style="display:block;font-size:11px;font-weight:800;color:${color};margin-top:2px">${arrow} ${Math.abs(diff).toFixed(1)}%</span>`;
}
function perfStatCard(v, l, trendHTML){
  return `<div class="stat"><div class="v">${v==null?"—":(typeof v==="number"?fmt(v):v)}</div><div class="l">${l}</div>${trendHTML||""}</div>`;
}
function perfGroupHTML(icon, color, title, statsHTML){
  return `<div style="margin-top:14px">
    <div style="display:flex;align-items:center;gap:8px;font-weight:800;font-size:13px;color:${color};margin-bottom:8px">
      <svg class="ic"><use href="#i-${icon}"/></svg><span>${title}</span>
    </div>
    <div class="statRow">${statsHTML}</div>
  </div>`;
}
function perfKpiHTML(s, prevS){
  prevS = prevS || {};
  const boxOffice = [
    perfStatCard(s.totalAdmits, t("perf_kpi_admits"), perfTrendBadge(s.totalAdmits, prevS.totalAdmits)),
    perfStatCard(s.totalShows, t("perf_kpi_shows")),
    perfStatCard(s.occupancyPct!=null?s.occupancyPct+"%":null, t("perf_kpi_occupancy"), perfTrendBadge(s.occupancyPct, prevS.occupancyPct)),
    perfStatCard(s.bor, t("perf_kpi_bor")),
    perfStatCard(s.atp, t("perf_kpi_atp")),
  ].join("");
  const concessions = [
    perfStatCard(s.concessionNetRevenue, t("perf_kpi_concession_net")),
    perfStatCard(s.qtyItemsSold, t("perf_kpi_items_sold")),
    perfStatCard(s.spendPerHead, t("perf_kpi_spend_head")),
    perfStatCard(s.costOfGoods, t("perf_kpi_cogs")),
    perfStatCard(s.profitPct!=null?s.profitPct+"%":null, t("perf_kpi_profit_pct")),
  ].join("");
  const overallHTML = [
    perfStatCard(s.totalRevenue, t("perf_kpi_total_revenue"), perfTrendBadge(s.totalRevenue, prevS.totalRevenue)),
    perfStatCard(s.avgSalePerTx, t("perf_kpi_avg_sale_tx")),
  ].join("");
  return perfGroupHTML("chart", "var(--p1)", t("perf_grp_box"), boxOffice)
       + perfGroupHTML("box", "var(--gold)", t("perf_grp_concessions"), concessions)
       + perfGroupHTML("spark", "var(--green)", t("perf_grp_overall"), overallHTML);
}
function perfRank(i){ return i===0?"🥇":i===1?"🥈":i===2?"🥉":(i+1); }
function perfBarCell(value, max, color){
  const pct = max>0 ? Math.min(100, (value/max)*100) : 0;
  return `<td class="num" style="position:relative">
    <div style="position:absolute;inset:2px;border-radius:6px;background:linear-gradient(90deg, ${color} ${pct}%, transparent ${pct}%);opacity:.16"></div>
    <span style="position:relative">${fmt(value)}</span>
  </td>`;
}
function showPerfDashboard(key, scope){
  const rec = perfReports[key]; if (!rec) return;
  if (scope==="E") perfSelectedMonthE = key; else if (scope==="C") perfSelectedMonthC = key; else perfSelectedMonth = key;
  const card = $("perfDashCard"+scope); if (!card) return;
  card.classList.remove("hidden");
  const titleEl = $("perfDashTitle"+scope);
  if (titleEl) titleEl.textContent = `${t("perf_monthly_title")} — ${perfMonthLabel(key)}`;
  const prevRec = perfReports[perfPrevMonthKey(key)];
  $("perfKpiRow"+scope).innerHTML = perfKpiHTML(rec.summary || {}, prevRec?.summary);
  const films = [...(rec.films||[])].sort((a,b)=>(b.bor||0)-(a.bor||0)).slice(0, scope==="E"?6:10);
  const maxBor = Math.max(1, ...films.map(f=>f.bor||0));
  const filmsBody = $("perfFilmsBody"+scope);
  if (filmsBody) filmsBody.innerHTML = films.length ? films.map((f,i)=>`
    <tr><td class="num">${perfRank(i)}</td>${posterCellHTML("filmPoster"+scope+"_"+i)}<td>${esc(f.name)}</td><td class="num">${fmt(f.shows)}</td><td class="num">${fmt(f.admits)}</td>
    ${perfBarCell(f.bor||0, maxBor, "var(--p1)")}${scope!=="E"?`<td class="num">${fmt(f.atp)}</td>`:""}</tr>`).join("")
    : `<tr><td colspan="7">${emptyState("no_results_match","search")}</td></tr>`;
  loadFilmPosters(films, "filmPoster"+scope+"_");
  const products = [...(rec.products||[])].sort((a,b)=>(b.netSales||0)-(a.netSales||0)).slice(0, scope==="E"?8:15);
  const maxSales = Math.max(1, ...products.map(p=>p.netSales||0));
  const prodBody = $("perfProductsBody"+scope);
  if (prodBody) prodBody.innerHTML = products.length ? products.map((p,i)=> scope==="E" ?
    `<tr><td class="num">${perfRank(i)}</td><td>${esc(p.name)}</td>${perfBarCell(p.netSales||0, maxSales, "var(--gold)")}</tr>` :
    `<tr><td class="num">${perfRank(i)}</td><td>${esc(p.name)}</td><td>${perfCatLabel(p)}</td><td class="num">${fmt(p.qty)}</td>
    ${perfBarCell(p.netSales||0, maxSales, "var(--gold)")}<td class="num">${fmt(p.netProfit)}</td><td class="num">${p.salesMixPct!=null?p.salesMixPct+"%":"—"}</td></tr>`
  ).join("") : `<tr><td colspan="${scope==="E"?3:7}">${emptyState("no_results_match","search")}</td></tr>`;
  card.scrollIntoView?.({behavior:"smooth"});
}
function downloadPerfReport(key){
  const rec = key && perfReports[key]; if (!rec) return;
  const s = rec.summary || {};
  const films = [...(rec.films||[])].sort((a,b)=>(b.bor||0)-(a.bor||0));
  const products = [...(rec.products||[])].sort((a,b)=>(b.netSales||0)-(a.netSales||0));
  const kpiRows = [
    [t("perf_kpi_admits"), s.totalAdmits],[t("perf_kpi_shows"), s.totalShows],
    [t("perf_kpi_occupancy"), s.occupancyPct!=null?s.occupancyPct+"%":"—"],
    [t("perf_kpi_bor"), s.bor],[t("perf_kpi_total_revenue"), s.totalRevenue],
    [t("perf_kpi_concession_net"), s.concessionNetRevenue],[t("perf_kpi_atp"), s.atp],
    [t("perf_kpi_cogs"), s.costOfGoods],[t("perf_kpi_profit_pct"), s.profitPct!=null?s.profitPct+"%":"—"],
    [t("perf_kpi_avg_sale_tx"), s.avgSalePerTx],[t("perf_kpi_items_sold"), s.qtyItemsSold],
    [t("perf_kpi_spend_head"), s.spendPerHead]
  ];
  const w = window.open("", "_blank");
  w.document.write(`<!DOCTYPE html><html lang="${LANG}" dir="${LANG==="ar"?"rtl":"ltr"}"><head><meta charset="UTF-8">
  <title>${t("perf_dash_title")} - ${perfMonthLabel(key)}</title>
  <style>
    body{font-family:'Segoe UI',Tahoma,sans-serif;padding:30px;color:#111}
    h1{font-size:20px;color:#4c1d95} h2{font-size:15px;color:#4c1d95;margin-top:26px;border-bottom:2px solid #eee;padding-bottom:4px}
    .kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:14px 0}
    .kpi{border:1px solid #eee;border-radius:10px;padding:10px;text-align:center}
    .kpi b{display:block;font-size:15px;color:#4c1d95} .kpi span{font-size:11px;color:#777}
    table{width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:10px}
    th{background:#4c1d95;color:#fff;padding:8px;text-align:${LANG==="ar"?"right":"left"}}
    td{padding:7px 8px;border-bottom:1px solid #ddd}
    tr:nth-child(even) td{background:#f7f5fb}
    .foot{margin-top:24px;color:#999;font-size:11px;text-align:center}
  </style></head><body>
  <h1>${t("perf_dash_title")} — ${esc(perfMonthLabel(key))}</h1>
  <div class="kpis">${kpiRows.map(([l,v])=>`<div class="kpi"><b>${v==null?"—":(typeof v==="number"?fmt(v):v)}</b><span>${l}</span></div>`).join("")}</div>
  <h2>${t("perf_films_title")}</h2>
  <table><thead><tr><th>#</th><th>${t("th_film")}</th><th>${t("th_shows")}</th><th>${t("th_admits")}</th><th>${t("th_bor")}</th><th>${t("th_atp")}</th></tr></thead>
  <tbody>${films.map((f,i)=>`<tr><td>${i+1}</td><td>${esc(f.name)}</td><td>${fmt(f.shows)}</td><td>${fmt(f.admits)}</td><td>${fmt(f.bor)}</td><td>${fmt(f.atp)}</td></tr>`).join("")}</tbody></table>
  <h2>${t("perf_products_title")}</h2>
  <table><thead><tr><th>#</th><th>${t("th_product")}</th><th>${t("th_category")}</th><th>${t("th_qty_now")}</th><th>${t("th_net_sales")}</th><th>${t("th_net_profit")}</th><th>${t("th_sales_mix")}</th></tr></thead>
  <tbody>${products.map((p,i)=>`<tr><td>${i+1}</td><td>${esc(p.name)}</td><td>${perfCatLabel(p)}</td><td>${fmt(p.qty)}</td><td>${fmt(p.netSales)}</td><td>${fmt(p.netProfit)}</td><td>${p.salesMixPct!=null?p.salesMixPct+"%":"—"}</td></tr>`).join("")}</tbody></table>
  <div class="foot">© 2026 Skylr — All Rights Reserved</div>
  <script>window.onload=()=>window.print()<\/script></body></html>`);
  w.document.close();
}
async function saveCeoAccount(){
  try{
    const u = $("ceoUserInput").value.trim(), p = $("ceoPassInput").value.trim();
    if (!u || !p) return toast(t("t_ceo_need_both"));
    await DB.set("ceo_account", "main", {username:u, password:p, updatedAt: Date.now()});
    toast("✅ " + t("t_ceo_saved"));
  }catch(e){ toast("❌ " + t("err") + e.message); }
}
async function loadCeoAccountIntoForm(){
  try{
    const acc = await DB.get("ceo_account", "main");
    if (acc && $("ceoUserInput")) $("ceoUserInput").value = acc.username || "";
  }catch(e){}
}

/* ---------- employee tasks ---------- */
let myTasks = [], myOpenTask = null;
async function loadMyTasks(){
  const all = await DB.list("tasks");
  allTasks = all;
  myTasks = all.filter(x=>x.empCode===session.code).sort((a,b)=>b.createdAt-a.createdAt);
  renderMyTasks();
}
let showTaskArchive = false;
function toggleTaskArchive(){ showTaskArchive = !showTaskArchive; renderMyTasks(); }
function myTaskItemHTML(x){
  return `
    <div class="taskItem">
      <div><b>${taskTypeLabel(x.type)}</b>${x.type==="joker"?"":" — "+esc(locLabel(x.warehouse))}
        <div style="font-size:12px;color:var(--muted)">${x.createdOn}${x.type==="joker"?"":` · ${(x.items||[]).length} ${t("items")}`}${(x.type==="count"||x.type==="space")&&x.status==="done"?` · <span style="color:var(--gold)">✦ ${x.points||0} ${t("pts")}</span>`:""}</div>
      </div>
      ${x.status==="done"
        ? `<span class="pill g">${t("sent_pill")}</span>`
        : `<button class="btn small" onclick="openFill('${x.id}')">${ico("clip")}${t("start_fill")}</button>`}
    </div>`;
}
function renderMyTasks(){
  const el = $("myTasks"); if(!el) return;
  const pending = myTasks.filter(x=>x.status!=="done");
  const done = myTasks.filter(x=>x.status==="done").sort((a,b)=>(b.submittedAt||0)-(a.submittedAt||0));
  /* المهام المنجزة تُخفى تماماً — يبقى أمام الموظف اللي عليه فقط */
  let html = pending.length ? pending.map(myTaskItemHTML).join("")
                            : `<div class="empty"><svg class="ic"><use href="#i-check"/></svg><div>${t("tasks_all_clear")}</div></div>`;
  if (done.length) html += `<div class="doneChip">✅ ${t("tasks_done_count",{n:done.length})}</div>`;
  el.innerHTML = html;
}
let builderBatches = {}, wizIdx = 0, wizDone = false, usherRounds = [], usherPhoto = null, jokerPhoto = null;
function openFill(id){
  const x = myTasks.find(r=>r.id===id); if(!x) return;
  myOpenTask = x;
  builderBatches = {}; wizIdx = 0; wizDone = false; usherRounds = []; usherPhoto = null; jokerPhoto = null;
  $("fillCard").classList.remove("hidden");
  const type = x.type;
  $("fillTitle").textContent = taskTypeLabel(type) + " — " + locLabel(x.warehouse);
  $("fillSub").textContent = type==="count" ? t("fill_count_sub") : type==="usher" ? t("usher_pts_note") : type==="space" ? t("fill_space_sub") : t("fill_exp_sub");
  $("fillHead").innerHTML = "";
  if (type === "space"){
    const tg = x.targets || {};
    $("fillHead").innerHTML = `<tr><th>${t("th_product")}</th><th style="width:110px">${t("rf_th_space")}</th><th style="width:150px">${t("phys_qty")}</th><th style="width:120px">${t("cmp_status")}</th></tr>`;
    $("fillBody").innerHTML = x.items.map(name=>`
      <tr><td>${esc(name)}</td>
        <td class="num" style="color:var(--lav);font-weight:700">${fmt(tg[name])}</td>
        <td><input type="number" step="any" min="0" data-name="${esc(name)}" data-target="${tg[name]}"
             class="fillInput cellInput" style="direction:ltr" placeholder="0" oninput="markSpaceRow(this)"></td>
        <td class="spaceTag" style="font-size:12px;color:var(--faint)">—</td></tr>`).join("");
  } else if (type === "count"){
    $("fillHead").innerHTML = `<tr><th>${t("th_product")}</th><th style="width:190px">${t("phys_qty")}</th></tr>`;
    $("fillBody").innerHTML = x.items.map(name=>`
      <tr><td>${esc(name)}</td><td>
        <input type="number" step="any" min="0" data-name="${esc(name)}" class="fillInput cellInput" style="direction:ltr" placeholder="0">
      </td></tr>`).join("");
  } else if (type === "usher"){
    $("fillBody").innerHTML = `<tr><td style="padding:16px">
      <div class="bRow">
        ${[1,2,3,4].map(n=>`<div class="field"><label>${t("hall")} ${n} (${t("temp_ph")})</label><input type="number" step="0.1" id="uH${n}" class="cellInput" style="direction:ltr" placeholder="22"></div>`).join("")}
      </div>
      <div class="bRow">
        <div class="field"><label>${t("wc_lbl")}</label>
          <select id="uWC" class="cellInput"><option value="clean">${t("wc_clean")}</option><option value="mid">${t("wc_mid")}</option><option value="bad">${t("wc_bad")}</option></select></div>
        <div class="field"><label>${t("facade_lbl")}</label>
          <input type="file" id="uPhoto" accept="image/*" class="cellInput" style="padding:8px">
          <img id="uPrev" class="hidden" style="margin-top:8px;max-width:120px;border-radius:10px;border:1px solid var(--line)"></div>
      </div>
      <button class="btn ghost" onclick="addUsherRound()">${t("add_round")}</button>
      <div style="margin-top:14px;font-size:12.5px;color:var(--lav);font-weight:700">${t("rounds_lbl")}</div>
      <div id="roundsList" style="margin-top:8px"><span style="color:var(--faint);font-size:12px">—</span></div>
    </td></tr>`;
    $("uPhoto").addEventListener("change", async e=>{
      const f = e.target.files[0]; if(!f) return;
      try{
        usherPhoto = await fileToJpeg(f, {square:false, px:300}, .45);
        $("uPrev").src = usherPhoto; $("uPrev").classList.remove("hidden");
        toast("📷 ✓");
      }catch(err){ usherPhoto = null; toast("❌ " + t("t_photo_bad")); }
    });
  } else if (type === "joker"){
    $("fillBody").innerHTML = `<tr><td style="padding:16px">
      <div class="field"><label>${t("joker_note_lbl")}</label>
        <textarea id="jkNote" class="cellInput" rows="3" placeholder="${t("joker_note_ph")}"></textarea></div>
      <div class="field" style="margin-top:10px"><label>${t("joker_photo_lbl")}</label>
        <input type="file" id="jkPhoto" accept="image/*" class="cellInput" style="padding:8px">
        <img id="jkPrev" class="hidden" style="margin-top:8px;max-width:160px;border-radius:10px;border:1px solid var(--line)"></div>
      <div class="sub" style="margin-top:10px">${t("joker_privacy")}</div>
    </td></tr>`;
    $("jkPhoto").addEventListener("change", async e=>{
      const f = e.target.files[0]; if(!f) return;
      try{
        jokerPhoto = await fileToJpeg(f, {square:false, px:300}, .45);
        $("jkPrev").src = jokerPhoto; $("jkPrev").classList.remove("hidden");
        toast("📷 ✓");
      }catch(err){ jokerPhoto = null; toast("❌ " + t("t_photo_bad")); }
    });
  } else { /* expiry: معالج منتج-بمنتج */
    $("fillBody").innerHTML = `<tr><td style="padding:16px">
      <div style="height:6px;background:var(--bg2);border-radius:99px;overflow:hidden;margin-bottom:12px">
        <div id="wizBar" style="height:100%;width:0;background:linear-gradient(90deg,var(--p1),var(--lav));transition:width .3s var(--ease)"></div></div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span id="wizPos" class="pill"></span>
        <span id="wizDoneTag" class="pill g hidden">${t("wiz_done")}</span>
      </div>
      <div id="wizName" style="font-family:'Almarai';font-weight:800;font-size:18px;margin-bottom:12px"></div>
      <div class="bRow">
        <div class="field"><label>${t("exp_date_lbl")}</label>
          <div class="bDate"><select id="bY" class="cellInput"></select><select id="bM" class="cellInput"></select><select id="bD" class="cellInput"></select></div></div>
        <div class="field"><label>${t("qty_lbl")}</label><input type="number" id="bQty" class="cellInput" min="0" step="any" placeholder="0" style="direction:ltr"></div>
      </div>
      <button class="btn ghost" onclick="addBuilderBatch()">${t("add_batch")}</button>
      <div id="wizChips" style="margin-top:12px;min-height:30px"></div>
      <div style="display:flex;gap:10px;justify-content:space-between;margin-top:16px">
        <button class="btn ghost" id="wizPrev" onclick="wizGo(-1)">${t("wiz_prev")}</button>
        <button class="btn" id="wizNext" onclick="wizGo(1)">${t("wiz_next")}</button>
      </div>
    </td></tr>`;
    fillYMD("bY","bM","bD");
    wizRender();
  }
  $("fillCard").scrollIntoView?.({behavior:"smooth"});
}
/* علامة فورية للموظف: ✓ إذا العدد مطابق للمطلوب، ✗ إذا ناقص أو زايد */
function markSpaceRow(inp){
  const cell = inp.closest("tr")?.querySelector(".spaceTag");
  if (!cell) return;
  const target = parseFloat(inp.dataset.target);
  const raw = inp.value.trim();
  if (raw === ""){ cell.innerHTML = "—"; cell.style.color = "var(--faint)"; return; }
  const v = parseFloat(raw);
  if (!isFinite(v)){ cell.innerHTML = "—"; return; }
  const d = +(v - target).toFixed(2);
  cell.style.color = "";
  if (Math.abs(d) < 0.01) cell.innerHTML = `<span class="pill g">${ico("check")}${t("space_match")}</span>`;
  else if (d < 0) cell.innerHTML = `<span class="pill r">✗ ${t("space_short")} ${fmt(Math.abs(d))}</span>`;
  else cell.innerHTML = `<span class="pill a">✗ ${t("space_over")} +${fmt(d)}</span>`;
}
function wizRender(){
  const x = myOpenTask; if(!x) return;
  const name = x.items[wizIdx];
  $("wizName").textContent = name;
  $("wizPos").textContent = t("wiz_pos",{a:wizIdx+1, b:x.items.length});
  $("wizBar").style.width = (((wizIdx+1)/x.items.length)*100).toFixed(1)+"%";
  $("wizPrev").disabled = wizIdx===0;
  $("wizPrev").style.opacity = wizIdx===0? .4 : 1;
  if (wizIdx === x.items.length-1){ wizDone = true; $("wizNext").style.opacity=.4; $("wizNext").disabled=true; $("wizDoneTag").classList.remove("hidden"); }
  else { $("wizNext").disabled=false; $("wizNext").style.opacity=1; }
  renderWizChips(name);
}
function wizGo(d){
  const x = myOpenTask; if(!x) return;
  wizIdx = Math.min(Math.max(wizIdx+d,0), x.items.length-1);
  wizRender();
}
function renderWizChips(name){
  const el = $("wizChips"); if(!el) return;
  const list = builderBatches[name]||[];
  el.innerHTML = list.length ? list.map((b,i)=>`<span class="batchChip"><span class="num">${fmt(b.qty)}</span> × <span class="num">${b.date}</span><button class="bx" onclick="removeBuilderBatch(${i})">×</button></span>`).join("")
    : `<span style="color:var(--faint);font-size:12px">—</span>`;
}
function addBuilderBatch(){
  const x = myOpenTask; if(!x) return;
  const name = x.items[wizIdx];
  const qty = $("bQty").value;
  if (!qty || +qty<=0) return toast(t("pick_batch"));
  const list = builderBatches[name] = builderBatches[name] || [];
  if (list.length >= 4) return toast(t("batch_full"));
  list.push({qty:+qty, date: ymdVal("bY","bM","bD")});
  $("bQty").value = "";
  renderWizChips(name);
}
function removeBuilderBatch(i){
  const name = myOpenTask.items[wizIdx];
  builderBatches[name].splice(i,1);
  if (!builderBatches[name].length) delete builderBatches[name];
  renderWizChips(name);
}
function addUsherRound(){
  try{
  const temps = [1,2,3,4].map(n=>$("uH"+n).value);
  if (temps.some(v=>v==="")) return toast(t("fill_temps"));
  usherRounds.push({
    time: new Date().toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}),
    temps, wc: $("uWC").value, photo: usherPhoto
  });
  usherPhoto = null; $("uPrev").classList.add("hidden"); $("uPhoto").value="";
  [1,2,3,4].forEach(n=>$("uH"+n).value="");
  const el = $("roundsList");
  el.innerHTML = usherRounds.map((r,i)=>`<span class="batchChip"><span class="num">${esc(r.time)}</span> · ${r.temps.map(tv=>`<span class="num">${esc(tv)}°</span>`).join(" ")} ${r.photo?"📷":""}</span>`).join("");
  toast("✅ " + t("round") + " " + usherRounds.length);
  }catch(err){ toast("❌ " + t("err") + err.message); }
}
function finishTaskLocally(taskId, patch){
  /* نحدّث القائمة المحلية فوراً بغض النظر عن نجاح إعادة التحميل من الشبكة —
     هذا يمنع بقاء المهمة "معلّقة" بشاشة الموظف لو صار خلل شبكة مؤقت أثناء التحديث */
  const idx = myTasks.findIndex(x=>x.id===taskId);
  if (idx>-1) myTasks[idx] = {...myTasks[idx], ...patch};
  renderMyTasks();
}
async function submitTask(){
  if (!myOpenTask) return;
  try{
    if (myOpenTask.type === "joker"){
      const note = ($("jkNote")?.value || "").trim();
      if (!note && !jokerPhoto) return toast(t("joker_need"));
      if (!confirm(t("c_submit_joker"))) return;
      const taskId = myOpenTask.id;
      const patch = {note, photo: jokerPhoto, status:"done", submittedAt: Date.now(), points: 30};
      await DB.set("tasks", taskId, {...myOpenTask, ...patch});
      finishTaskLocally(taskId, patch);
      $("fillCard").classList.add("hidden");
      myOpenTask = null; jokerPhoto = null;
      toast("✅ " + t("t_sent_admin"));
      bumpEmployeeStreak(session.code).catch(()=>{});
      loadMyTasks().catch(()=>{});
      return;
    }
    if (myOpenTask.type === "usher"){
      if (!usherRounds.length) return toast(t("no_rounds"));
      if (!confirm(t("c_submit",{a:usherRounds.length,b:t("round")}))) return;
      const taskId = myOpenTask.id;
      const patch = {rounds: usherRounds, status:"done", submittedAt: Date.now(), points: 50};
      await DB.set("tasks", taskId, {...myOpenTask, ...patch});
      finishTaskLocally(taskId, patch);
      $("fillCard").classList.add("hidden");
      myOpenTask = null; usherRounds = [];
      toast("✅ " + t("t_sent_admin") + " · " + t("t_pts_won",{p:50})); celebrate();
      renderEmpPoints();
    bumpEmployeeStreak(session.code).catch(()=>{});
    seasonTasks.push({empName: session.name, points: 50, status:"done", submittedAt: Date.now()});
    renderRankBoards(); updateMyBestRank();
      loadMyTasks().catch(()=>{});
      return;
    }
    if (myOpenTask.type === "expiry"){
      if (!wizDone) return toast(t("wiz_must"));
      const entries = Object.entries(builderBatches);
      if (!entries.length) return toast(t("t_fill_one"));
      if (!confirm(t("c_submit",{a:entries.length,b:myOpenTask.items.length}))) return;
      const taskId = myOpenTask.id, warehouseE = myOpenTask.warehouse;
      /* كل منتج مسجل تُستبدل باتشاته بالمرسل — ويُضاف للإكسل مباشرة */
      for (const [name, list] of entries){
        const id = catKey(myOpenTask.warehouse, name);
        const cat = EXPIRY_CATALOG.find(c=>c.loc===myOpenTask.warehouse && c.name===name);
        const cur = (await DB.get("expiry_batches", id)) || {};
        await DB.set("expiry_batches", id, {
          loc: myOpenTask.warehouse, name, sec:cat?.sec||"", sr:cat?.sr||0,
          batches: list.slice(0,4), by: session.name, updatedAt: Date.now(),
          hidden: cur.hidden||false, taskId
        });
      }
      const patch = {batchResults: builderBatches, status:"done", submittedAt: Date.now()};
      await DB.set("tasks", taskId, {...myOpenTask, ...patch});
      finishTaskLocally(taskId, patch);
      $("fillCard").classList.add("hidden");
      myOpenTask = null; builderBatches = {};
      toast("✅ " + t("t_sent_admin"));
    bumpEmployeeStreak(session.code).catch(()=>{});
    seasonTasks.push({empName: session.name, points: 0, status:"done", submittedAt: Date.now()});
    renderRankBoards(); updateMyBestRank();
      loadMyTasks().catch(()=>{});
      loadExpiry().catch(()=>{});
      return;
    }
    const results = {};
    document.querySelectorAll(".fillInput").forEach(inp=>{ results[inp.dataset.name] = inp.value; });
    const filled = Object.values(results).filter(v=>v!=="").length;
    if (!filled) return toast(t("t_fill_one"));
    if (!confirm(t("c_submit",{a:filled,b:myOpenTask.items.length}))) return;

    if (myOpenTask.type === "space"){
      const tg = myOpenTask.targets || {};
      let ok = 0, bad = 0;
      for (const [name, v] of Object.entries(results)){
        if (v === "" || tg[name] === undefined) continue;
        if (Math.abs(parseFloat(v) - tg[name]) < 0.01) ok++; else bad++;
      }
      const pts = ok * 10;
      const patchS = {results, status:"done", submittedAt: Date.now(), matched: ok, mismatched: bad, points: pts};
      await DB.set("tasks", myOpenTask.id, {...myOpenTask, ...patchS});
      finishTaskLocally(myOpenTask.id, patchS);
      $("fillCard").classList.add("hidden");
      myOpenTask = null;
      toast("✅ " + t("t_sent_admin") + " · " + t("t_space_result",{a:ok,b:bad}) + (pts?" · "+t("t_pts_won",{p:pts}):""));
      renderEmpPoints();
      bumpEmployeeStreak(session.code).catch(()=>{});
      seasonTasks.push({empName: session.name, points: pts, status:"done", submittedAt: Date.now()});
      renderRankBoards(); updateMyBestRank();
      loadMyTasks().catch(()=>{});
      return;
    }
    const taskId = myOpenTask.id, warehouse = myOpenTask.warehouse, createdOn = myOpenTask.createdOn, snapId = myOpenTask.snapId;
    let matched = 0, points = 0;
    const snap = (snapId ? await DB.get("inv_snapshots", snapId) : null)
      || (await DB.get("inv_snapshots", createdOn)) || (await DB.get("inv_snapshots", todayKey()));
    const sysMap = {};
    if (snap) snap.items.filter(i=>i.loc===warehouse).forEach(i=>sysMap[i.name]=i.qty);
    for (const [name, v] of Object.entries(results)){
      if (v==="" || sysMap[name]===undefined) continue;
      if (Math.abs(parseFloat(v) - sysMap[name]) < 0.01) matched++;
    }
    points = matched * 10;
    const patch = {results, status:"done", submittedAt: Date.now(), snapshotDate: createdOn, matched, points};
    await DB.set("tasks", taskId, {...myOpenTask, ...patch});
    finishTaskLocally(taskId, patch);
    $("fillCard").classList.add("hidden");
    myOpenTask = null;
    toast("✅ " + t("t_sent_admin") + (points ? " · " + t("t_pts_won",{p:points}) : ""));
    renderEmpPoints();
    bumpEmployeeStreak(session.code).catch(()=>{});
    seasonTasks.push({empName: session.name, points: points, status:"done", submittedAt: Date.now()});
    renderRankBoards(); updateMyBestRank();
    loadMyTasks().catch(()=>{});
  }catch(e){ toast("❌ " + t("err") + e.message); }
}

