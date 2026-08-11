/* ==========================================================
   Noir Cinema · 11-profit.js
   الوصفات · قائمة الاسعار · تحليل الارباح
   تنبيه: ترتيب التحميل في index.html مهم - لا تغيره.
   ========================================================== */

/* ============================================================
   قائمة أسعار الموردين + الوصفات (Recipe Master List)
   ترفع مرة شهرياً — تعطي وحدة القياس الحقيقية وسعر الشراء والمورد،
   وتكلفة كل صنف بيع ومكوناته، فتُستخدم في تحليل الربح والطلب والنقل.
   ============================================================ */
const RCP_FURN = /^(Onaizah|Bldg No|Unaizah|Zip Code|Recipe Master List|Supplier Price List|As On|Page\s*:|User\s*:|Item Re\. Date|Supplier Raw Material|Page\d)/i;
const RCP_UOM = "No|Kg|Litres|ml|gms|Ltr|Gm";
const rnum = x => parseFloat(String(x).replace(/,/g, "")) || 0;

/* ---------- Supplier Price List ---------- */
const PRICE_RE = new RegExp(`^(.+?)\\s+(${RCP_UOM})\\s+(Individual|Group)\\s+([\\d,]+\\.\\d{2})$`, "i");
function parsePriceLines(lines){
  const out = []; let sup = "", buf = [];
  for (const raw of lines){
    const l = String(raw).replace(/\s+/g," ").trim();
    if (!l || RCP_FURN.test(l)) continue;
    const m = l.match(PRICE_RE);
    if (m){
      if (buf.length){
        let txt = buf.join(" ").trim();
        /* اسم المورد يتكرر كخاتمة للمجموعة السابقة — نشيل البادئة */
        if (sup && txt.toLowerCase().startsWith(sup.toLowerCase())) txt = txt.slice(sup.length).trim();
        if (txt) sup = txt;
        buf = [];
      }
      out.push({name:m[1].trim(), uom:m[2], type:m[3], rate:rnum(m[4]), supplier:sup});
      continue;
    }
    buf.push(l); if (buf.length > 4) buf = buf.slice(-4);
  }
  return out;
}

/* ---------- Recipe Master List ---------- */
const _RCP_FURN_UNUSED = /^(Onaizah|Bldg No|Unaizah|Zip Code|Recipe Master List|Supplier Price List|As On|Page\s*:|User\s*:|Item Re\. Date|Supplier Raw Material|Page\d)/i;
const UOM_W = RCP_UOM;
const num = rnum;

/* اسم + كمية + وحدة + سعر + مبلغ  (+ Y اختيارية) */
const ING_RE  = new RegExp(`^(.+?)\\s+([\\d,]+\\.\\d{2})\\s+(${UOM_W})\\s+([\\d,]+\\.\\d{2})\\s+([\\d,]+\\.\\d{2})(\\s+Y)?$`, "i");
/* السطر يبدأ بالأرقام لأن الاسم انقسم على السطر السابق */
const ING_NUM_RE = new RegExp(`^([\\d,]+\\.\\d{2})\\s+(${UOM_W})\\s+([\\d,]+\\.\\d{2})\\s+([\\d,]+\\.\\d{2})(\\s+Y)?$`, "i");
const DATE_RE = /^(\d{2}\/\d{2}\/\d{4})$/;
const DTOT_RE = /^(\d{2}\/\d{2}\/\d{4})\s+([\d,]+\.\d{2})$/;

function parseRecipeLines(lines){
  const items = {};
  let curItem = null, curRev = null, nameBuf = [], pendName = "", splitTail = false;

  const flushName = () => {
    let n = nameBuf.join(" ").replace(/\s+/g, " ").trim();
    nameBuf = [];
    /* الاسم يتكرر كخاتمة للصنف السابق ثم يبدأ الصنف الجديد — نشيل البادئة */
    if (curItem && n.toLowerCase().startsWith(curItem.toLowerCase())) n = n.slice(curItem.length).trim();
    return n;
  };
  const rev = () => items[curItem]?.revs[curRev];
  const addIng = (name, qty, uom, rate, amount) => {
    const r = rev(); if (!r) return;
    r.ing.push({name:String(name).replace(/\s+/g," ").trim(), qty, uom, rate, amount});
  };

  for (const raw of lines){
    const l = String(raw).replace(/\s+/g, " ").trim();
    if (!l || RCP_FURN.test(l)) continue;

    let d = l.match(DTOT_RE);
    if (d){                                            /* نهاية نسخة: تاريخ + تكلفة */
      const r = rev(); if (r) r.cost = num(d[2]);
      curRev = null; nameBuf = []; pendName = ""; splitTail = false; continue;
    }
    d = l.match(DATE_RE);
    if (d){                                            /* بداية نسخة */
      const n = flushName();
      if (n) curItem = n;
      if (curItem){
        items[curItem] = items[curItem] || {name:curItem, revs:{}};
        items[curItem].revs[d[1]] = items[curItem].revs[d[1]] || {date:d[1], cost:0, ing:[]};
        curRev = d[1];
      }
      pendName = ""; splitTail = false; continue;
    }

    if (curRev){                                       /* داخل نسخة = مكوّنات */
      let m = l.match(ING_RE);
      if (m){
        addIng((pendName ? pendName + " " : "") + m[1], num(m[2]), m[3], num(m[4]), num(m[5]));
        pendName = ""; splitTail = false; continue;
      }
      m = l.match(ING_NUM_RE);
      if (m){                                          /* الاسم كان بالسطر السابق */
        addIng(pendName, num(m[1]), m[2], num(m[3]), num(m[4]));
        pendName = ""; splitTail = true; continue;     /* قد تأتي بقية الاسم بالسطر التالي */
      }
      const r = rev();
      if (splitTail && r && r.ing.length){             /* تكملة اسم آخر مكوّن */
        r.ing[r.ing.length-1].name = (r.ing[r.ing.length-1].name + " " + l).replace(/\s+/g," ").trim();
        splitTail = false;
      } else {
        pendName = (pendName ? pendName + " " : "") + l;
      }
      continue;
    }
    nameBuf.push(l);                                   /* خارج النسخ = اسم صنف */
    if (nameBuf.length > 10) nameBuf = nameBuf.slice(-10);
  }

  const dkey = s => { const [d,m,y] = s.split("/"); return y+m+d; };
  return Object.values(items).map(it=>{
    const revs = Object.values(it.revs).filter(r=>r.ing.length)
                 .sort((a,b)=>dkey(b.date).localeCompare(dkey(a.date)));
    const cur = revs[0];
    if (!cur) return null;
    const cost = cur.cost || +cur.ing.reduce((a,i)=>a+i.amount,0).toFixed(2);
    return {name:it.name, date:cur.date, cost, ing:cur.ing, versions:revs.length};
  }).filter(Boolean);
}


/* ---------- تخزين وتحميل ---------- */
let recipeDoc = null, priceList = [];
async function loadRecipes(){
  recipeDoc = await DB.get("recipes","latest").catch(()=>null);
  renderRecipeMeta(); renderProfitPage();
}
async function loadPriceList(){
  const d = await DB.get("price_list","latest").catch(()=>null);
  priceList = d?.rows || [];
  renderPriceMeta(); renderProfitPage();
  if (!$("pOrder")?.classList.contains("hidden")) renderOrderTable();
}
/* بحث مرن عن مادة خام في قائمة الأسعار */
let _priceIdx = null;
function priceIndex(){
  if (_priceIdx && _priceIdx.n === priceList.length) return _priceIdx.map;
  const map = {};
  priceList.forEach(r=>{ map[normKey(r.name)] = r; map[String(r.name).toLowerCase()] = r; });
  _priceIdx = {n: priceList.length, map};
  return map;
}
function priceInfo(name){
  const map = priceIndex();
  return map[String(name).toLowerCase()] || map[normKey(name)] || null;
}
/* وحدة القياس الرسمية من قائمة الأسعار: No=حبة · Kg/gms=كيلو · Litres/ml=لتر */
function uomFromPrice(name){
  const p = priceInfo(name); if (!p) return null;
  const u = String(p.uom).toLowerCase();
  if (u === "kg" || u === "gms" || u === "gm") return "KG";
  if (u === "litres" || u === "ml" || u === "ltr") return "L";
  return "PCS";
}
function renderRecipeMeta(){
  const el = $("recipeStatus2"); if (!el) return;
  el.innerHTML = recipeDoc?.items?.length
    ? `<span class="pill g">✓ ${fmt(recipeDoc.items.length)} ${t("rcp_count")} · ${esc(recipeDoc.savedOn||"")}</span>`
    : `<span class="sub" style="margin:0">${t("rcp_none")}</span>`;
}
function renderPriceMeta(){
  const el = $("priceStatus2"); if (!el) return;
  const sups = [...new Set(priceList.map(r=>r.supplier).filter(Boolean))];
  el.innerHTML = priceList.length
    ? `<span class="pill g">✓ ${fmt(priceList.length)} ${t("prc_count")} · ${fmt(sups.length)} ${t("prc_sups")}</span>`
    : `<span class="sub" style="margin:0">${t("prc_none")}</span>`;
}
$("recipeFile")?.addEventListener("change", async e=>{
  const f = e.target.files[0]; if(!f) return; e.target.value="";
  showLoadingCloud();
  try{
    $("recipeStatus").textContent = t("rcp_reading");
    const items = parseRecipeLines(await pdfToLines(f));
    if (!items.length){ $("recipeStatus").textContent = "❌ " + t("rcp_err"); return; }
    await DB.set("recipes","latest",{items, ts:Date.now(), savedOn:todayKey()});
    $("recipeStatus").textContent = "✅ " + t("rcp_ok",{n:items.length});
    toast(t("t_saved_rcp")); await loadRecipes();
  }catch(err){ console.error(err); $("recipeStatus").textContent = "❌ " + t("err") + err.message; }
  finally{ hideLoading(); }
});
$("priceFile")?.addEventListener("change", async e=>{
  const f = e.target.files[0]; if(!f) return; e.target.value="";
  showLoadingCloud();
  try{
    $("priceStatus").textContent = t("prc_reading");
    const rows = parsePriceLines(await pdfToLines(f));
    if (!rows.length){ $("priceStatus").textContent = "❌ " + t("prc_err"); return; }
    await DB.set("price_list","latest",{rows, ts:Date.now(), savedOn:todayKey()});
    _priceIdx = null;
    $("priceStatus").textContent = "✅ " + t("prc_ok",{n:rows.length});
    toast(t("t_saved_prc")); await loadPriceList();
  }catch(err){ console.error(err); $("priceStatus").textContent = "❌ " + t("err") + err.message; }
  finally{ hideLoading(); }
});

/* ============================================================
   تحليل الربح: مبيعات الأصناف × تكلفة الوصفة
   ============================================================ */
function recipeFor(name){
  if (!recipeDoc?.items) return null;
  const n = String(name).toLowerCase().trim();
  let hit = recipeDoc.items.find(r=>r.name.toLowerCase().trim() === n);
  if (hit) return hit;
  const k = normKey(name);
  hit = recipeDoc.items.find(r=>normKey(r.name) === k);
  return hit || null;
}
function profitRows(){
  const agg = fnbByName();
  const sold = {};
  Object.values(agg).forEach(u=>Object.values(u.items).forEach(it=>{
    const r = sold[it.name] = sold[it.name] || {name:it.name, qty:0, revenue:0};
    r.qty += it.qty||0; r.revenue += it.gross||0;
  }));
  return Object.values(sold).map(r=>{
    const rc = recipeFor(r.name);
    const unitCost = rc ? rc.cost : null;
    const cost = unitCost===null ? null : +(unitCost * r.qty).toFixed(2);
    const price = r.qty ? +(r.revenue / r.qty).toFixed(2) : 0;
    const profit = cost===null ? null : +(r.revenue - cost).toFixed(2);
    const margin = (cost===null || !r.revenue) ? null : +((profit / r.revenue) * 100).toFixed(1);
    return {...r, unitCost, cost, price, profit, margin, hasRecipe: !!rc, ing: rc?.ing || []};
  }).sort((a,b)=>(b.profit||0)-(a.profit||0));
}
/* تفكيك الوصفات: كم مادة خام تحتاج فعلياً حسب ما بعته */
function rawNeedFromRecipes(){
  const need = {};
  profitRows().forEach(r=>{
    if (!r.hasRecipe) return;
    r.ing.forEach(i=>{
      const k = i.name;
      const n = need[k] = need[k] || {name:k, qty:0, uom:i.uom, cost:0};
      n.qty += (i.qty||0) * r.qty;
      n.cost += (i.amount||0) * r.qty;
    });
  });
  /* تحويل الجرامات والمللي إلى كيلو ولتر حتى تقارن بالجرد */
  return Object.values(need).map(n=>{
    let qty = n.qty, uom = n.uom;
    if (/^gms?$/i.test(uom)){ qty = +(qty/1000).toFixed(2); uom = "Kg"; }
    else if (/^ml$/i.test(uom)){ qty = +(qty/1000).toFixed(2); uom = "Litres"; }
    else qty = +qty.toFixed(2);
    return {...n, qty, uom, cost:+n.cost.toFixed(2)};
  }).sort((a,b)=>b.cost-a.cost);
}
/* ---------- عرض صفحة الأرباح ---------- */
/* ما الذي ينقص التحليل بالضبط؟ نخبر المشرف بدل رسالة عامة */
function profMissing(){
  const noRcp = !(recipeDoc?.items||[]).length;
  const noFnb = !Object.keys(fnbByName()).length;
  if (noRcp && noFnb) return t("prof_need_both");
  if (noRcp) return t("prof_need_rcp");
  if (noFnb) return t("prof_need_fnb");
  return null;
}
function missingBox(){
  const m = profMissing();
  return `<div class="empty" style="padding:26px 18px">
      <svg class="ic"><use href="#i-alert"/></svg>
      <div style="margin-bottom:12px">${esc(m || t("prof_none"))}</div>
      ${/سجل|F&B|log/i.test(m||"") ? `<button class="btn ghost small" onclick="goTab('pFiles')">${t("prof_go_files")}</button>` : ""}
    </div>`;
}
function renderProfitPage(){
  renderRecipeMeta(); renderPriceMeta();
  renderProfitStats(); renderProfitTable(); renderRawTable();
  const ml = $("monLinkState");
  if (ml) ml.innerHTML = `<div class="saleMini">
      <span>${(recipeDoc?.items||[]).length ? "✅" : "⚪"} ${t("rcp_count")}: ${fmt((recipeDoc?.items||[]).length)}</span>
      <span>${priceList.length ? "✅" : "⚪"} ${t("prc_count")}: ${fmt(priceList.length)}</span>
    </div>`;
}
function renderProfitStats(){
  const el = $("profStats"); if (!el) return;
  const rows = profitRows();
  const warn = $("profWarn");
  if (!rows.length){
    el.innerHTML = ""; if (warn) warn.innerHTML = missingBox(); return;
  }
  const withR = rows.filter(r=>r.hasRecipe);
  const rev  = +rows.reduce((a,r)=>a+r.revenue,0).toFixed(2);
  const cost = +withR.reduce((a,r)=>a+(r.cost||0),0).toFixed(2);
  const revR = +withR.reduce((a,r)=>a+r.revenue,0).toFixed(2);
  const prof = +(revR - cost).toFixed(2);
  const marg = revR ? +((prof/revR)*100).toFixed(1) : 0;
  const best = [...withR].sort((a,b)=>(b.margin||0)-(a.margin||0))[0];
  const worst= [...withR].filter(r=>r.margin!==null).sort((a,b)=>a.margin-b.margin)[0];
  el.innerHTML = `
    <div class="stat"><div class="v">${fmt(rev)}</div><div class="l">${t("prof_revenue")}</div></div>
    <div class="stat"><div class="v" style="color:var(--amber)">${fmt(cost)}</div><div class="l">${t("prof_cost")}</div></div>
    <div class="stat"><div class="v" style="color:var(--green)">${fmt(prof)}</div><div class="l">${t("prof_profit")}</div></div>
    <div class="stat"><div class="v" style="color:${marg>=60?"var(--green)":marg>=40?"var(--amber)":"var(--red)"}">${marg}%</div><div class="l">${t("prof_margin")}</div></div>
    <div class="stat"><div class="v" style="font-size:14px">${best?esc(best.name):"—"}</div><div class="l">${t("prof_best")} ${best?`(${best.margin}%)`:""}</div></div>
    <div class="stat"><div class="v" style="font-size:14px">${worst?esc(worst.name):"—"}</div><div class="l">${t("prof_worst")} ${worst?`(${worst.margin}%)`:""}</div></div>`;
  const missing = rows.filter(r=>!r.hasRecipe);
  if (warn) warn.innerHTML = missing.length
    ? `<div class="banner"><b>${t("prof_no_recipe",{n:missing.length})}</b><div style="margin-top:6px;font-size:12px">${missing.slice(0,14).map(m=>esc(m.name)).join(" · ")}</div></div>`
    : `<div class="banner">✓ ${t("prof_all_covered")}</div>`;
}
function renderProfitTable(){
  const body = $("profBody"); if (!body) return;
  let rows = profitRows();
  const q = ($("profSearch")?.value||"").toLowerCase();
  if (q) rows = rows.filter(r=>r.name.toLowerCase().includes(q));
  const sort = $("profSort")?.value || "profit";
  if (sort==="margin") rows.sort((a,b)=>(b.margin??-999)-(a.margin??-999));
  else if (sort==="worst") rows.sort((a,b)=>(a.margin??999)-(b.margin??999));
  else if (sort==="qty") rows.sort((a,b)=>b.qty-a.qty);
  else rows.sort((a,b)=>(b.profit??-1e9)-(a.profit??-1e9));
  body.innerHTML = rows.length ? rows.map(r=>{
    const mc = r.margin===null ? "var(--muted)" : r.margin>=60?"var(--green)":r.margin>=40?"var(--amber)":"var(--red)";
    return `<tr>
      <td>${esc(r.name)}${r.hasRecipe?"":` <span class="pill a" style="font-size:10px">${t("prof_norec")}</span>`}</td>
      <td class="num">${fmt(r.qty)}</td>
      <td class="num">${fmt(r.price)}</td>
      <td class="num">${fmt(r.revenue)}</td>
      <td class="num">${r.unitCost===null?"—":fmt(r.unitCost)}</td>
      <td class="num">${r.cost===null?"—":fmt(r.cost)}</td>
      <td class="num" style="color:${r.profit===null?"var(--muted)":"var(--green)"};font-weight:700">${r.profit===null?"—":fmt(r.profit)}</td>
      <td class="num" style="color:${mc};font-weight:700">${r.margin===null?"—":r.margin+"%"}</td>
    </tr>`;
  }).join("") : `<tr><td colspan="8">${missingBox()}</td></tr>`;
}
function renderRawTable(){
  const body = $("rawBody"); if (!body) return;
  const rows = rawNeedFromRecipes();
  if (!rows.length){ body.innerHTML = `<tr><td colspan="7">${missingBox()}</td></tr>`; return; }
  const stock = {};
  (latestSnap?.items||[]).forEach(i=>{ stock[normKey(i.name)] = (stock[normKey(i.name)]||0) + (i.qty||0); });
  body.innerHTML = rows.map(r=>{
    const have = stock[normKey(r.name)] ?? null;
    const cov = (have!==null && r.qty>0) ? +(have/r.qty).toFixed(2) : null;
    const pi = priceInfo(r.name);
    const cc = cov===null ? "var(--muted)" : cov<1 ? "var(--red)" : cov<2 ? "var(--amber)" : "var(--green)";
    return `<tr>
      <td>${esc(r.name)}</td>
      <td><span class="pill ${/no/i.test(r.uom)?"":"a"}">${esc(pi?.uom || r.uom)}</span></td>
      <td class="num">${fmt(r.qty)}</td>
      <td class="num">${fmt(r.cost)}</td>
      <td class="num">${have===null?"—":fmt(+have.toFixed(2))}</td>
      <td class="num" style="color:${cc};font-weight:700">${cov===null?"—":cov+" ×"}</td>
      <td style="font-size:12px;color:var(--muted)">${esc(pi?.supplier||"—")}</td>
    </tr>`;
  }).join("");
}
