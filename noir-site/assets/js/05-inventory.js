/* ==========================================================
   Noir Cinema · 05-inventory.js
   السيلز سبيس · التعبئة والنقل
   تنبيه: ترتيب التحميل في index.html مهم - لا تغيره.
   ========================================================== */

/* ============================================================
   تنظيم المنتجات (السيلز سبيس) — للمشرف فقط
   المشرف يحدد كمية كل منتج في منطقة الريفل، يحفظها، ثم يرسلها
   للموظف كمهمة جرد. الموظف يدخل العدد الفعلي ويطلع ✓ أو ✗.
   ============================================================ */
function parMapFor(loc){
  const m = {};
  parLevels.forEach(p=>{ if (!loc || p.loc===loc) m[p.name] = p.min; });
  return m;
}
/* الكمية المطلوبة لمنتج: المحددة يدوياً، وإلا الافتراضي للريفل */
function spaceTargetFor(loc, name){
  const p = parLevels.find(x=>x.loc===loc && x.name===name);
  if (p) return {min: p.min, isDefault: false};
  if (isRefuel(loc)) return {min: REFUEL_DEFAULT_MIN, isDefault: true};
  return {min: null, isDefault: false};
}
function fillParSelectors(){
  const ls = $("parLoc"); if(!ls) return;
  const cur = ls.value;
  const locs = latestSnap ? sortLocs(latestSnap.locations) : [];
  ls.innerHTML = locs.length ? locs.map(l=>`<option value="${esc(l)}">${esc(locLabel(l))}</option>`).join("") : `<option value="">—</option>`;
  if (cur && locs.includes(cur)) ls.value = cur;
  else { const rf = locs.find(isRefuel); if (rf) ls.value = rf; }   /* الريفل هو الافتراضي */
  const es = $("parEmp");
  if (es){
    const vEmps = visibleEmps();
    const curE = es.value;
    es.innerHTML = vEmps.length ? vEmps.map(e=>`<option value="${e.id}">${esc(e.name)} (${e.id})</option>`).join("") : `<option value="">—</option>`;
    if (curE) es.value = curE;
  }
  renderParGrid();
}
/* التوافق مع النداءات القديمة */
function fillParProducts(){ renderParGrid(); }

function renderParGrid(){
  const body = $("parBody"); if(!body) return;
  const loc = $("parLoc")?.value || "";
  const q = ($("parSearch")?.value || "").toLowerCase();
  if (!latestSnap || !loc){
    body.innerHTML = `<tr><td colspan="4">${emptyState("no_inv","box")}</td></tr>`;
    if ($("parCount")) $("parCount").textContent = "—";
    return;
  }
  const map = parMapFor(loc);
  const items = latestSnap.items
    .filter(i=>i.loc===loc && (!q || i.name.toLowerCase().includes(q)))
    .sort((a,b)=>a.name.localeCompare(b.name));
  body.innerHTML = items.length ? items.map(i=>{
    const set = map[i.name];
    const val = set===undefined ? "" : set;
    const target = set===undefined ? (isRefuel(loc)?REFUEL_DEFAULT_MIN:null) : set;
    let tag;
    if (target === null) tag = `<span class="pill" style="opacity:.6">${t("space_unset")}</span>`;
    else if (i.qty < target) tag = `<span class="pill r">${t("space_short")} ${fmt(+(target-i.qty).toFixed(2))}</span>`;
    else tag = `<span class="pill g">${ico("check")}${t("space_ok")}</span>`;
    return `<tr>
      <td>${esc(i.name)}</td>
      <td class="num">${fmt(i.qty)}</td>
      <td><input type="number" min="0" step="1" class="parInput cellInput" style="direction:ltr"
           data-name="${esc(i.name)}" value="${val}" placeholder="${isRefuel(loc)?REFUEL_DEFAULT_MIN:"—"}"></td>
      <td>${tag}</td></tr>`;
  }).join("") : `<tr><td colspan="4">${emptyState("no_results_match","search")}</td></tr>`;
  const setCount = items.filter(i=>map[i.name]!==undefined).length;
  if ($("parCount")) $("parCount").textContent = t("space_set_count", {a:setCount, b:items.length});
}

async function saveAllPars(){
  const loc = $("parLoc")?.value;
  if (!loc) return toast(t("t_upload_first"));
  const inputs = [...document.querySelectorAll(".parInput")];
  let saved = 0, cleared = 0;
  showLoadingCloud();
  try{
    for (const inp of inputs){
      const name = inp.dataset.name;
      const raw = inp.value.trim();
      const id = docId(loc+"__"+name);
      const existing = parLevels.find(p=>p.loc===loc && p.name===name);
      if (raw === ""){
        if (existing){ await DB.del("par_levels", id); cleared++; }
        continue;
      }
      const v = parseInt(raw, 10);
      if (!isFinite(v) || v < 0) continue;
      if (existing && existing.min === v) continue;      /* ما تغيّر — ما نكتب */
      await DB.set("par_levels", id, {loc, name, min:v, updatedAt:Date.now()});
      saved++;
    }
    await loadPars();
    renderInv();
    toast("✅ " + t("t_space_saved", {a:saved, b:cleared}));
  }catch(e){ toast("❌ " + t("err") + e.message); }
  finally{ hideLoading(); }
}

async function sendSpaceTask(){
  try{
    const loc = $("parLoc")?.value, empCode = $("parEmp")?.value;
    if (!latestSnap || !loc) return toast(t("t_upload_first"));
    if (!empCode) return toast(t("t_add_emp_first"));
    const emp = employees.find(e=>e.id===empCode);
    const map = parMapFor(loc);
    /* المنتجات اللي لها كمية محددة، وإلا كل منتجات الريفل بالافتراضي */
    const targets = {};
    latestSnap.items.filter(i=>i.loc===loc).forEach(i=>{
      const v = map[i.name];
      if (v !== undefined) targets[i.name] = v;
      else if (isRefuel(loc)) targets[i.name] = REFUEL_DEFAULT_MIN;
    });
    const items = Object.keys(targets).sort((a,b)=>a.localeCompare(b));
    if (!items.length) return toast(t("t_space_none"));
    const id = "T"+Date.now();
    await DB.set("tasks", id, {
      type:"space", warehouse: loc, empCode, empName: emp.name,
      branch: curBranch(), snapId: snapKeyFor(curBranch(), todayKey()),
      items, targets, status:"pending", createdAt: Date.now(), createdOn: todayKey()
    });
    toast("✅ " + t("t_task_sent",{n:emp.name}));
    loadTasks();
  }catch(e){ toast("❌ " + t("err") + e.message); }
}

/* أُبقيت للتوافق مع أي نداء قديم */
async function savePar(){ return saveAllPars(); }
async function delPar(id){
  if (!confirm(t("c_del_par"))) return;
  await DB.del("par_levels", id);
  loadPars();
}
function renderPars(){ renderParGrid(); }
/* كتالوج منتجات المستودع: كل صنف ظهر فيه بأي جرد سابق + أي صنف له سيلز سبيس.
   الفايدة: المنتج اللي خلص واختفى من ملف الستوك ما يضيع — يظهر بكمية صفر. */
function locCatalog(loc){
  const names = new Map();
  (allSnaps||[]).forEach(s=>(s.items||[]).forEach(i=>{ if (i.loc===loc) names.set(i.name, true); }));
  (parLevels||[]).forEach(p=>{ if (p.loc===loc) names.set(p.name, true); });
  return [...names.keys()];
}
/* كل أصناف المستودع بكمياتها الحالية، والمفقود منها = صفر */
function locItemsWithZeros(loc){
  const cur = {};
  (latestSnap?.items||[]).forEach(i=>{ if (i.loc===loc) cur[i.name] = i.qty; });
  return locCatalog(loc).map(name=>({
    name, loc,
    qty: cur[name]!==undefined ? cur[name] : 0,
    missing: cur[name]===undefined          /* اختفى من ملف الستوك = صفر */
  }));
}
function computeAlerts(){
  if (!latestSnap) return [];
  const parMap = {};
  parLevels.forEach(p=>parMap[p.loc+"|"+p.name]=p.min);
  const byName = {};
  (latestSnap.items||[]).forEach(i=>{ (byName[i.name]=byName[i.name]||{})[i.loc]=i.qty; });
  const locs = new Set([...(latestSnap.locations||[]), ...parLevels.map(p=>p.loc)]);
  const alerts = [];
  for (const loc of locs){
    for (const i of locItemsWithZeros(loc)){
      let min = parMap[loc+"|"+i.name];
      if (min===undefined && isRefuel(loc)) min = REFUEL_DEFAULT_MIN;
      if (min===undefined) continue;
      if (i.qty < min){
        const others = Object.entries(byName[i.name]||{})
          .filter(([l])=>l!==loc && (byName[i.name][l]||0)>0)
          .sort((a,b)=>locRank(a[0])-locRank(b[0]))
          .map(([l,q])=>`${locLabel(l)}: ${fmt(q)}`).join(" · ");
        alerts.push({name:i.name, loc, qty:i.qty, min, need:+(min-i.qty).toFixed(2),
                     avail:others||"—", isDefault: parMap[loc+"|"+i.name]===undefined, missing:i.missing});
      }
    }
  }
  return alerts.sort((a,b)=> (a.qty===0?-1:0)-(b.qty===0?-1:0) || b.need-a.need);
}

/* ---------- أعمدة حالة المخزون ---------- */
let barFilter = "all";
function setBarFilter(f){ barFilter = f; renderStockBars(); }
function fillBarLoc(){
  const sel = $("barLoc"); if (!sel) return;
  const cur = sel.value;
  const locs = latestSnap ? sortLocs([...new Set([...(latestSnap.locations||[]), ...parLevels.map(p=>p.loc)])]) : [];
  sel.innerHTML = locs.length ? locs.map(l=>`<option value="${esc(l)}">${esc(locLabel(l))}</option>`).join("") : `<option value="">—</option>`;
  if (cur && locs.includes(cur)) sel.value = cur;
  else { const rf = locs.find(isRefuel); if (rf) sel.value = rf; }
  renderStockBars();
}
function renderStockBars(){
  const wrap = $("stockBars"); if (!wrap) return;
  const stats = $("barStats");
  ["all","need","zero"].forEach(f=>{
    const b = $("barFilter"+f[0].toUpperCase()+f.slice(1));
    if (b) b.classList.toggle("ghost", barFilter!==f);
  });
  const loc = $("barLoc")?.value || "";
  if (!latestSnap || !loc){ wrap.innerHTML = emptyState("no_inv","box"); if(stats) stats.innerHTML=""; return; }

  const q = ($("barSearch")?.value || "").toLowerCase();
  let items = locItemsWithZeros(loc).map(i=>{
    const sp = spaceTargetFor(loc, i.name);
    const target = sp.min;
    let state = "ok";
    if (i.qty <= 0) state = "zero";
    else if (target !== null && i.qty < target) state = "low";
    return {...i, target, isDefault: sp.isDefault, state};
  });
  const totals = {
    ok:   items.filter(i=>i.state==="ok").length,
    low:  items.filter(i=>i.state==="low").length,
    zero: items.filter(i=>i.state==="zero").length
  };
  if (barFilter==="need") items = items.filter(i=>i.state!=="ok");
  if (barFilter==="zero") items = items.filter(i=>i.state==="zero");
  if (q) items = items.filter(i=>i.name.toLowerCase().includes(q));

  const order = {zero:0, low:1, ok:2};
  items.sort((a,b)=> order[a.state]-order[b.state] || a.name.localeCompare(b.name));

  if (stats) stats.innerHTML = `
    <div class="stat"><div class="v" style="color:var(--green)">${fmt(totals.ok)}</div><div class="l">${t("bars_lg_ok")}</div></div>
    <div class="stat"><div class="v" style="color:var(--amber)">${fmt(totals.low)}</div><div class="l">${t("bars_lg_low")}</div></div>
    <div class="stat"><div class="v" style="color:var(--red)">${fmt(totals.zero)}</div><div class="l">${t("bars_lg_zero")}</div></div>
    <div class="stat"><div class="v">${fmt(totals.ok+totals.low+totals.zero)}</div><div class="l">${t("stat_items")}</div></div>`;

  const scaleMax = Math.max(1, ...items.map(i=>Math.max(i.qty, i.target||0)));
  wrap.innerHTML = items.length ? items.map(i=>{
    const pct = Math.max(i.qty>0 ? 6 : 3, Math.min(100, (i.qty/scaleMax)*100));
    const tag = i.state==="zero" ? t("bars_tag_zero")
              : i.state==="low"  ? t("bars_tag_low") + " +" + fmt(+(i.target-i.qty).toFixed(2))
              : t("bars_tag_ok");
    const tgt = i.target===null ? t("space_unset") : `${t("rf_th_space")}: ${fmt(i.target)}${i.isDefault?"*":""}`;
    return `<div class="barCol bc-${i.state}" title="${esc(i.name)}">
      <div class="bcName">${esc(i.name)}</div>
      <div class="bcTrack"><div class="bcFill" style="height:${pct.toFixed(1)}%"></div></div>
      <div class="bcNum">${fmt(i.qty)}</div>
      <div class="bcTarget">${esc(tgt)}</div>
      <div class="bcTag">${esc(tag)}</div>
    </div>`;
  }).join("") : emptyState("no_results_match","search");
}
function renderAlerts(){
  const body = $("alertBody"); if(!body) return;
  const alerts = computeAlerts();
  const badge = $("alertBadge");
  if (badge){ badge.textContent = alerts.length; badge.classList.toggle("hidden", !alerts.length); }
  body.innerHTML = alerts.length ? alerts.map(a=>`
    <tr><td>${esc(a.name)}${a.missing?` <span class="pill r" style="font-size:10px">${t("bars_tag_zero")}</span>`:""}</td>
    <td><span class="pill ${isRefuel(a.loc)?"r":"a"}">${esc(locLabel(a.loc))}</span></td>
    <td class="num neg">${fmt(a.qty)}</td>
    <td class="num">${a.min}${a.isDefault?` <span class="pill a" style="font-size:10px">${t("rf_default")}</span>`:""}</td>
    <td><span class="num" style="color:var(--amber);font-weight:700">+${fmt(a.need)}</span></td>
    <td style="font-size:12px;color:var(--muted)">${esc(a.avail)}</td></tr>`).join("")
    : `<tr><td colspan="6">${emptyState("no_alerts","check")}</td></tr>`;
  fillBarLoc();
}
