/* ==========================================================
   Noir Cinema · 15-expiry-sync.js
   مطابقة تواريخ الانتهاء مع الجرد
   تنبيه: ترتيب التحميل في index.html مهم - لا تغيره.
   ========================================================== */

/* ============================================================
   مطابقة ملف التواريخ مع الجرد تلقائياً بعد رفع الستوك
   - المنتج غير الموجود بالجرد (أو كميته صفر) يُحذف من التواريخ
   - إذا الكمية المسجلة أكبر من الجرد: نقص الباتشات الأقرب انتهاءً أولاً (FEFO)
     لأنها هي اللي تُباع أولاً، حتى يتساوى المجموع مع كمية الجرد
   - إذا الجرد أكبر: نتركها كما هي (بضاعة جديدة لم تُسجل تواريخها بعد)
   ============================================================ */
function reconcileExpiryPlan(){
  if (!latestSnap) return null;
  const del = [], upd = [];
  for (const rec of (expiryBatches||[])){
    const batches = (rec.batches||[]).filter(b=>+b.qty > 0);
    if (!batches.length) continue;
    const sLoc = stockLocFor(rec.loc);
    const items = sLoc ? latestSnap.items.filter(i=>i.loc===sLoc) : [];
    const m = items.length ? matchStockItem(rec.name, items) : null;
    const sys = m ? +m.qty : 0;
    if (!m || sys <= 0){ del.push({rec, reason: m ? "zero" : "missing"}); continue; }
    const sum = +batches.reduce((a,b)=>a+(+b.qty||0),0).toFixed(2);
    if (sum - sys <= 0.009) continue;                 /* مطابق أو أقل — ما نلمسه */
    /* نقص الفائض من الأقرب انتهاءً */
    const sorted = [...batches].sort((a,b)=>String(a.date||"").localeCompare(String(b.date||"")));
    let over = +(sum - sys).toFixed(2);
    const kept = [];
    for (const b of sorted){
      const q = +b.qty || 0;
      if (over <= 0.009){ kept.push(b); continue; }
      if (q <= over + 0.009){ over = +(over - q).toFixed(2); continue; }   /* الباتش انتهى بالكامل */
      kept.push({...b, qty: +(q - over).toFixed(2)}); over = 0;
    }
    upd.push({rec, batches: kept, from: sum, to: sys, removed: batches.length - kept.length});
  }
  return {del, upd};
}
let expReconcileBusy = false;
async function reconcileExpiryWithStock(silent){
  if (expReconcileBusy) return null;
  const plan = reconcileExpiryPlan();
  if (!plan) return null;
  if (!plan.del.length && !plan.upd.length){
    if (!silent) toast("✓ " + t("exp_sync_none"));
    return plan;
  }
  expReconcileBusy = true;
  try{
    for (const x of plan.del) await DB.del("expiry_batches", x.rec.id);
    for (const x of plan.upd){
      if (!x.batches.length) await DB.del("expiry_batches", x.rec.id);
      else await DB.set("expiry_batches", x.rec.id, {...x.rec, batches:x.batches, syncedAt:Date.now()});
    }
    await loadExpiry();
    toast("🔄 " + t("t_exp_synced", {d: plan.del.length, u: plan.upd.length}));
  }catch(e){ console.warn("expiry sync", e); toast("❌ " + t("err") + e.message); }
  finally{ expReconcileBusy = false; }
  return plan;
}
/* معاينة قبل التنفيذ — يظهر للمشرف بعد كل رفع ستوك */
function renderExpSyncPreview(){
  const el = $("expSyncBody"); if (!el) return;
  const plan = reconcileExpiryPlan();
  const btn = $("expSyncBtn");
  if (!plan){ el.innerHTML = emptyState("no_inv","box"); if (btn) btn.disabled = true; return; }
  const n = plan.del.length + plan.upd.length;
  if (btn) btn.disabled = !n;
  if (!n){ el.innerHTML = `<div class="empty"><svg class="ic"><use href="#i-check"/></svg><div>${t("exp_sync_none")}</div></div>`; return; }
  el.innerHTML = `<div class="statRow" style="margin-bottom:12px">
      <div class="stat"><div class="v" style="color:var(--red)">${plan.del.length}</div><div class="l">${t("exp_sync_del")}</div></div>
      <div class="stat"><div class="v" style="color:var(--amber)">${plan.upd.length}</div><div class="l">${t("exp_sync_upd")}</div></div>
    </div>
    <div class="tableWrap" style="max-height:340px"><table>
      <thead><tr><th>${t("th_product")}</th><th>${t("task_loc_lbl")}</th><th>${t("cmp_batch_sum")}</th><th>${t("phys_qty")}</th><th>${t("cmp_status")}</th></tr></thead>
      <tbody>
      ${plan.del.map(x=>`<tr><td>${esc(x.rec.name)}</td><td><span class="pill a">${esc(locLabel(x.rec.loc))}</span></td>
        <td class="num">${fmt((x.rec.batches||[]).reduce((a,b)=>a+(+b.qty||0),0))}</td><td class="num neg">0</td>
        <td><span class="pill r">${x.reason==="missing"?t("exp_sync_missing"):t("exp_sync_zero")}</span></td></tr>`).join("")}
      ${plan.upd.map(x=>`<tr><td>${esc(x.rec.name)}</td><td><span class="pill a">${esc(locLabel(x.rec.loc))}</span></td>
        <td class="num">${fmt(x.from)}</td><td class="num" style="color:var(--green)">${fmt(x.to)}</td>
        <td><span class="pill a">${t("exp_sync_trim",{n:x.removed})}</span></td></tr>`).join("")}
      </tbody></table></div>`;
}
/* ---------- حالة تسجيل المستودعات + التحقق التلقائي للكميات ---------- */
function expMismatches(){
  if (!latestSnap) return [];
  const out = [];
  for (const rec of expiryBatches){
    if (!(rec.batches||[]).length) continue;
    const sLoc = stockLocFor(rec.loc); if (!sLoc) continue;
    const m = matchStockItem(rec.name, latestSnap.items.filter(i=>i.loc===sLoc));
    if (!m) continue;
    const sum = rec.batches.reduce((s,b)=>s+(+b.qty||0),0);
    if (Math.abs(sum - m.qty) >= 0.01) out.push({name:rec.name, loc:rec.loc, sum, sys:m.qty, diff:+(sum-m.qty).toFixed(2)});
  }
  return out.sort((a,b)=>Math.abs(b.diff)-Math.abs(a.diff));
}
function expNotDated(){
  const map = {}; expiryBatches.forEach(r=>map[r.loc+"|"+r.name]=r);
  const out = [];
  for (const c of EXPIRY_CATALOG){
    const rec = map[c.loc+"|"+c.name];
    if (!rec || !(rec.batches||[]).length) out.push({name:c.name, loc:c.loc});
  }
  return out;
}
function expCompletionPct(){
  const total = EXPIRY_CATALOG.length;
  if (!total) return 100;
  return Math.round(((total - expNotDated().length) / total) * 100);
}
function renderExpStatus(){
  const row = $("expStatusRow"); if(!row) return;
  const mism = expMismatches();
  const notDated = expNotDated();
  const pct = expCompletionPct();
  const badge = $("expBadge");
  let notFull = 0;
  const cards = CATALOG_LOCS.map(loc=>{
    const total = EXPIRY_CATALOG.filter(c=>c.loc===loc).length;
    const rec = expiryBatches.filter(r=>r.loc===loc && (r.batches||[]).length).length;
    const locPct = total ? Math.round((rec/total)*100) : 100;
    const st = rec===0 ? ["st_not_recorded","var(--red)"] : rec<total ? ["st_partial","var(--amber)"] : ["st_recorded","var(--green)"];
    if (rec<total) notFull++;
    return `<div class="stat"><div class="v" style="color:${st[1]}">${locPct}% <small style="font-size:12px;color:var(--muted)">(${rec}/${total})</small></div>
      <div class="l">${esc(locLabel(loc))} — <b style="color:${st[1]}">${t(st[0])}</b></div></div>`;
  }).join("");
  const pctColor = pct>=95 ? "var(--green)" : pct>=70 ? "var(--amber)" : "var(--red)";
  row.innerHTML = cards
    + `<div class="stat"><div class="v" style="color:${pctColor}">${pct}%</div><div class="l">${t("exp_completion_pct")}</div></div>`
    + `<div class="stat"><div class="v" style="color:${notDated.length?"var(--red)":"var(--green)"}">${notDated.length}</div><div class="l">${t("exp_not_dated_count")}</div></div>`
    + `<div class="stat"><div class="v" style="color:${mism.length?"var(--red)":"var(--green)"}">${mism.length}</div><div class="l">${t("mismatches")}</div></div>`;
  if (badge){ const n = mism.length + notDated.length; badge.textContent = n; badge.classList.toggle("hidden", !n); }
  const ndWrap = $("expNotDatedWrap"), ndBody = $("expNotDatedBody");
  if (ndWrap){ ndWrap.classList.toggle("hidden", !notDated.length); }
  if (ndBody) ndBody.innerHTML = notDated.map(m=>`
    <tr><td>${esc(m.name)}</td><td><span class="pill a">${esc(locLabel(m.loc))}</span></td></tr>`).join("");
  const wrap = $("expMismatchWrap"), body = $("expMismatchBody");
  if (wrap){ wrap.classList.toggle("hidden", !mism.length); }
  if (body) body.innerHTML = mism.map(m=>`
    <tr><td>${esc(m.name)}</td><td><span class="pill">${esc(locLabel(m.loc))}</span></td>
    <td class="num">${fmt(m.sum)}</td><td class="num">${fmt(m.sys)}</td>
    <td><span class="num ${m.diff>0?"pos":"neg"}">${m.diff>0?"+":""}${fmt(m.diff)}</span></td></tr>`).join("");
  const pctRow = $("expXlsxPctRow");
  if (pctRow) pctRow.innerHTML = CATALOG_LOCS.map(loc=>{
    const total = EXPIRY_CATALOG.filter(c=>c.loc===loc).length;
    const rec = expiryBatches.filter(r=>r.loc===loc && (r.batches||[]).length).length;
    const locPct = total ? Math.round((rec/total)*100) : 100;
    const color = locPct>=95 ? "var(--green)" : locPct>=70 ? "var(--amber)" : "var(--red)";
    return `<div class="stat"><div class="v" style="color:${color}">${locPct}%</div><div class="l">${esc(locLabel(loc))}</div></div>`;
  }).join("");
}
/* ---------- تحقق المشرف: مقارنة مهام التواريخ مع آخر جرد ---------- */
let expDoneTasks = [];
async function loadExpPending(){
  expDoneTasks = (await DB.list("tasks")).filter(x=>x.type==="expiry" && x.status==="done").sort((a,b)=>b.submittedAt-a.submittedAt);
  renderExpPending();
}
function renderExpPending(){
  const el = $("expPendingList"); if(!el) return;
  el.innerHTML = expDoneTasks.length ? expDoneTasks.map(x=>{
    const n = Object.keys(x.batchResults||{}).length;
    return `<div class="taskItem">
      <div><b>${esc(x.empName)}</b> — ${esc(locLabel(x.warehouse))}
        <div style="font-size:12px;color:var(--muted)">${t("submitted")}: ${new Date(x.submittedAt).toLocaleString("en-GB")} · ${n} ${t("items")}</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn small" onclick="compareExpTask('${x.id}')">${ico("clip")}${t("cmp_btn")}</button>
        <button class="btn ghost small" onclick="resendExpTask('${x.id}')">${ico("swap")}${t("resend_btn")}</button>
      </div>
    </div>`;
  }).join("") : emptyState("no_pending_exp","check");
}
function normTokens(s){
  return String(s).toLowerCase().replace(/([a-z])(\d)/g,"$1 $2").replace(/(\d)([a-z])/g,"$1 $2")
    .replace(/[^a-z0-9\u0600-\u06FF ]/g," ").split(/\s+/).filter(w=>w && w!=="gm" && w!=="oz" && w!=="ml");
}
function lev1(a,b){
  if (a===b) return true;
  if (Math.abs(a.length-b.length)>1) return false;
  let i=0,j=0,ed=0;
  while(i<a.length&&j<b.length){ if(a[i]===b[j]){i++;j++;continue;} ed++; if(ed>1)return false;
    if(a.length>b.length)i++; else if(b.length>a.length)j++; else {i++;j++;} }
  return ed+(a.length-i)+(b.length-j)<=1;
}
function stockLocFor(catLoc){
  if (!latestSnap) return null;
  const want = locRank(catLoc);
  return latestSnap.locations.find(l=>locRank(l)===want) || null;
}
function matchStockItem(catName, stockItems){
  const ct = normTokens(catName);
  const cNums = ct.filter(w=>/^\d+$/.test(w));
  let best=null, bestScore=0;
  for (const it of stockItems){
    const st = normTokens(it.name);
    const sNums = st.filter(w=>/^\d+$/.test(w));
    if (cNums.length && sNums.length && !cNums.some(n=>sNums.includes(n))) continue;
    let hit=0;
    for (const w of ct){ if (st.some(v=>v===w || (w.length>=5&&v.length>=5&&(v.includes(w)||w.includes(v)||lev1(w,v))))) hit++; }
    const score = hit/Math.max(ct.length,1);
    if (score>bestScore){ bestScore=score; best=it; }
  }
  return bestScore>=0.5 ? best : null;
}
async function compareExpTask(id){
  const x = expDoneTasks.find(r=>r.id===id); if(!x) return;
  const card = $("cmpResultCard"); card.classList.remove("hidden");
  $("cmpMeta").textContent = `${x.empName} — ${locLabel(x.warehouse)} · ${new Date(x.submittedAt).toLocaleString("en-GB")}`;
  const sLoc = stockLocFor(x.warehouse);
  const stockItems = (latestSnap && sLoc) ? latestSnap.items.filter(i=>i.loc===sLoc) : [];
  const rows = Object.entries(x.batchResults||{}).map(([name, batches])=>{
    const sum = batches.reduce((s,b)=>s+(+b.qty||0),0);
    const m = matchStockItem(name, stockItems);
    const ok = m ? Math.abs(sum-m.qty)<0.01 : null;
    return {name, sum, sys:m?m.qty:null, ok};
  });
  $("cmpBody").innerHTML = rows.map(r=>`
    <tr><td>${esc(r.name)}</td><td class="num">${fmt(r.sum)}</td>
    <td class="num">${r.sys===null?"—":fmt(r.sys)}</td>
    <td>${r.ok===null?`<span class="pill a">${t("cmp_none")}</span>`:r.ok?`<span class="pill g">${ico("check")}${t("cmp_ok")}</span>`:`<span class="pill r">${ico("x")}${t("cmp_bad")} (${r.sum>r.sys?"+":""}${fmt(+(r.sum-r.sys).toFixed(2))})</span>`}</td></tr>`
  ).join("");
  card.scrollIntoView?.({behavior:"smooth"});
}
async function resendExpTask(id){
  const x = expDoneTasks.find(r=>r.id===id); if(!x) return;
  await DB.set("tasks", id, {...x, status:"pending", resent:true});
  toast("✅ " + t("t_resent"));
  loadExpPending(); loadTasks();
}
/* ---------- GRN: المشتريات والتقاطع المحاسبي ---------- */
let grnReports = [];
$("grnFile").addEventListener("change", async e=>{
  const f = e.target.files[0]; if(!f) return; e.target.value="";
  showLoadingCloud();
  try{
    $("grnStatus").textContent = t("grn_reading");
    const parsed = parseGRNLines(await pdfToLines(f));
    if (!parsed.rows.length){ $("grnStatus").textContent = "❌ " + t("grn_err"); return; }
    await DB.set("grn_reports", docId(`${parsed.from||"x"}_${parsed.to||"x"}`), {...parsed, ts:Date.now()});
    $("grnStatus").textContent = "✅ " + t("grn_ok",{p:`${parsed.from} → ${parsed.to}`, n:parsed.rows.length}) + ` · 📅 ${fileMonthTag(parsed.from, parsed.to)}`;
    toast(t("t_saved_grn"));
    await loadGRN();
  }catch(err){ $("grnStatus").textContent = "❌ " + t("err") + err.message; }
  finally{ hideLoading(); }
});
async function loadGRN(){ grnReports = await DB.list("grn_reports"); renderGRN(); renderFileTimestamps(); }
function dISO(d){ const m=String(d).match(/(\d{2})\/(\d{2})\/(\d{4})/); return m?`${m[3]}-${m[2]}-${m[1]}`:""; }
function grnAgg(){
  const m = {};
  grnReports.forEach(r=>(r.rows||[]).forEach(x=>{
    const a = m[x.name] = m[x.name] || {name:x.name, uom:x.uom, qty:0, net:0, tax:0, last:"", supplier:x.supplier};
    a.qty += x.qty; a.net += x.net; a.tax += x.tax;
    if (dISO(x.date) > dISO(a.last)) { a.last = x.date; a.supplier = x.supplier; }
  }));
  return Object.values(m);
}
function findQty(name, list){
  if (!list?.length) return null;
  const exact = list.find(i=>i.name.toLowerCase()===name.toLowerCase());
  if (exact) return exact.qty;
  const m = matchStockItem(name, list);
  return m ? m.qty : null;
}
function renderGRN(){
  const body = $("grnBody"); if(!body) return;
  const stats = $("grnStats");
  if (!grnReports.length){
    body.innerHTML = `<tr><td colspan="8">${emptyState("no_grn","down")}</td></tr>`;
    if (stats) stats.innerHTML=""; if ($("grnSummary")) $("grnSummary").textContent="";
    return;
  }
  const agg = grnAgg();
  const q = ($("grnSearch")?.value||"").toLowerCase();
  const stockAll = latestSnap ? Object.values(latestSnap.items.reduce((m,i)=>{ (m[i.name]=m[i.name]||{name:i.name,qty:0}).qty+=i.qty; return m; },{})) : [];
  const soldAll = salesData?.rows || [];
  let ok=0, bad=0;
  const rows = agg.map(a=>{
    const sold = findQty(a.name, soldAll);
    const stock = findQty(a.name, stockAll);
    const varc = (sold!==null && stock!==null) ? +(a.qty - sold - stock).toFixed(2) : null;
    const tol = Math.max(2, a.qty*0.1);
    const status = varc===null ? null : Math.abs(varc)<=tol;
    if (status===true) ok++; else if (status===false) bad++;
    return {...a, sold, stock, varc, status};
  }).sort((x,y)=> (x.status===false?-1:1) - (y.status===false?-1:1) || y.net - x.net);
  body.innerHTML = rows.filter(r=>!q||r.name.toLowerCase().includes(q)).map(r=>`
    <tr><td>${esc(r.name)}<div style="font-size:10.5px;color:var(--faint)">${esc(r.supplier||"")}</div></td>
    <td style="font-size:11px;color:var(--muted)">${esc(r.uom)}</td>
    <td class="num">${fmt(r.qty)}</td>
    <td class="num" style="font-size:12px">${esc(r.last)}</td>
    <td class="num">${r.sold===null?"—":fmt(r.sold)}</td>
    <td class="num">${r.stock===null?"—":fmt(r.stock)}</td>
    <td>${r.varc===null?"—":`<span class="num ${Math.abs(r.varc)<=Math.max(2,r.qty*0.1)?"zero":r.varc>0?"pos":"neg"}">${r.varc>0?"+":""}${fmt(r.varc)}</span>`}</td>
    <td>${r.status===null?`<span class="pill a">—</span>`:r.status?`<span class="pill g">${ico("check")}${t("grn_balanced")}</span>`:`<span class="pill r">${ico("alert")}${t("grn_check")}</span>`}</td></tr>`
  ).join("") || `<tr><td colspan="8">${emptyState("no_results_match","search")}</td></tr>`;
  const totNet = agg.reduce((s,a)=>s+a.net,0), totTax = agg.reduce((s,a)=>s+a.tax,0);
  const nEntries = grnReports.reduce((s,r)=>s+(r.rows||[]).length,0);
  const lastEntry = agg.reduce((m,a)=>dISO(a.last)>dISO(m)?a.last:m, "");
  const from = grnReports.map(r=>r.from).sort((a,b)=>dISO(a)<dISO(b)?-1:1)[0]||"";
  const to = grnReports.map(r=>r.to).sort((a,b)=>dISO(a)>dISO(b)?-1:1)[0]||"";
  if (stats) stats.innerHTML = `
    <div class="stat"><div class="v">${fmt(nEntries)}</div><div class="l">${t("grn_entries")}</div></div>
    <div class="stat"><div class="v">${fmt(totNet)}</div><div class="l">${t("grn_net")}</div></div>
    <div class="stat"><div class="v">${fmt(totTax)}</div><div class="l">${t("grn_tax")}</div></div>
    <div class="stat"><div class="v">${fmt(totNet+totTax)}</div><div class="l">${t("grn_gross")}</div></div>`;
  if ($("grnSummary")) $("grnSummary").textContent = t("grn_summary",{from, to, n:nEntries, net:fmt(totNet), tax:fmt(totTax), gross:fmt(totNet+totTax), ok, bad, last:lastEntry});
}
