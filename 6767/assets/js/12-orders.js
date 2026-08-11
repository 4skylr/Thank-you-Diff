/* ==========================================================
   Noir Cinema · 12-orders.js
   طلبات المنتجات · نموذج الشراء · مبيعات التذاكر والاكل
   تنبيه: ترتيب التحميل في index.html مهم - لا تغيره.
   ========================================================== */

/* ============================================================
   طلبات المنتجات — الكميات بكل المستودعات + تحليل استهلاك + نموذج طلب شراء
   (للمشرف فقط — داخل لوحة الإدارة)
   ============================================================ */
/* --- وحدة القياس: حبة / كيلو / لتر --- */
const UNIT_PCS_RE = /(sachet|cup|lid|tub\b|tray|straw|napkin|\bcan\b|\bbun\b|stirrer|bottle|glass|\bml\b|\boz\b|\bgm\b|\bbox\b|frankfurt|spoon|dummy|comp\b|dip)/i;
const UNIT_L_RE   = /(\boil\b|\bbib\b|syrup|\bco2\b|slush\s*-\s*(blue|pome|straw|mango|cola|raspberry)|lemonade)/i;
const UNIT_KG_RE  = /(corn\b|caramel|masala|\bsalt\b|\bsugar\b|\bmix\b|flossine|chips|salsa|jalapeno|sauce|ketchup|mustard|lemon|mint|floss|cheese)/i;
/* أصناف تُشترى بالكرتون (Case) — زيوت وصلصات وذرة وشراب البيب وغيرها */
const UNIT_CASE_RE = /(\boil\b|\bbib\b|syrup|corn\b|caramel|masala|salsa|chips|jalapeno|sauce|ketchup|mustard|\bmix\b|flossine|frankfurt|floss\b)/i;
function unitOf(name){
  const n = String(name||"");
  const saved = uomOverrides[n.toLowerCase()];
  if (saved) return saved;                         /* اعتماد ما سجّله المشرف */
  const fromPrice = uomFromPrice(n);               /* الوحدة الرسمية من قائمة أسعار الموردين */
  if (fromPrice) return fromPrice === "PCS" && UNIT_CASE_RE.test(n) ? "Case" : fromPrice;
  if (UNIT_PCS_RE.test(n))  return "PCS";
  if (UNIT_CASE_RE.test(n)) return "Case";         /* يُشترى بالكرتون */
  if (UNIT_L_RE.test(n))    return "L";
  if (UNIT_KG_RE.test(n))   return "KG";
  return "PCS";
}
/* وحدات القياس المحفوظة في السحابة — يتعلمها النظام من تعديلاتك */
let uomOverrides = {};
async function loadUOM(){
  try{ uomOverrides = (await DB.get("app_settings","uom"))?.map || {}; }catch(e){ uomOverrides = {}; }
}
async function saveUOM(name, unit){
  uomOverrides[String(name).toLowerCase()] = unit;
  try{ await DB.set("app_settings","uom",{map:uomOverrides, ts:Date.now()}); }catch(e){ console.warn(e); }
}
function unitLabel(u){ return u==="KG" ? t("unit_kg") : u==="L" ? t("unit_l") : u==="Case" ? t("unit_case") : t("unit_pcs"); }

/* --- تقارير الاستهلاك: تُخزَّن بالفترة، والمعدل = الكمية ÷ الأيام × 30 --- */
let consReports = [];
async function loadConsReports(){
  consReports = await DB.list("consumption_reports").catch(()=>[]);
  renderConsList(); renderFileTimestamps();
  if (!$("pOrder")?.classList.contains("hidden")) renderOrderTable();
}
function dmyToDate(x){
  const m = String(x||"").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? new Date(+m[3], +m[2]-1, +m[1]) : null;
}
function daysBetween(a,b){
  const d1 = dmyToDate(a), d2 = dmyToDate(b);
  if (!d1 || !d2) return 30;
  return Math.max(1, Math.round((d2-d1)/86400000) + 1);
}
$("consFile")?.addEventListener("change", async e=>{
  const f = e.target.files[0]; if(!f) return; e.target.value="";
  showLoadingCloud();
  try{
    $("consStatus").textContent = t("sales_reading");
    const parsed = parseSalesLines(await pdfToLines(f));
    if (!parsed.rows.length){ $("consStatus").textContent = "❌ " + t("sales_err"); return; }
    parsed.rows = parsed.rows.filter(r=>isRealProduct(r.name));
    if (!parsed.rows.length){ $("consStatus").textContent = "❌ " + t("sales_err"); return; }
    const days = daysBetween(parsed.from, parsed.to);
    const key  = docId(`${parsed.from||"na"}__${parsed.to||"na"}`);
    await DB.set("consumption_reports", key, {...parsed, days, ts:Date.now(), branch:curBranch()});
    $("consStatus").textContent = "✅ " + t("ord_ok",{n:parsed.rows.length, d:days}) + ` · 📅 ${parsed.from||"—"} → ${parsed.to||"—"}`;
    toast(t("t_saved_cons"));
    await loadConsReports();
    renderOrderTable();
  }catch(err){ console.error(err); $("consStatus").textContent = "❌ " + t("err") + err.message; }
  finally{ hideLoading(); }
});
/* رفع الستوك الحالي من هذه الصفحة مباشرة (نفس مخزن الجرد اليومي) */
$("ordStockFile")?.addEventListener("change", async e=>{
  const f = e.target.files[0]; if(!f) return; e.target.value="";
  showLoadingCloud();
  try{
    $("ordStockStatus").textContent = t("inv_reading");
    const parsed = parseStockLines(await pdfToLines(f));
    if (!parsed.items.length){ $("ordStockStatus").textContent = "❌ " + t("inv_err_parse"); return; }
    parsed.items = parsed.items.filter(i=>isRealProduct(i.name));
    const key = todayKey(), b = curBranch();
    await DB.set("inv_snapshots", snapKeyFor(b, key),
      {date:key, branch:b, ts:Date.now(), locations:parsed.locations, items:parsed.items, reportFrom:""});
    $("ordStockStatus").textContent = "✅ " + t("inv_ok",{d:key, a:parsed.items.length, b:parsed.locations.length});
    toast(t("t_saved_inv"));
    await loadInventory();
    renderOrderTable();
  }catch(err){ console.error(err); $("ordStockStatus").textContent = "❌ " + t("err") + err.message; }
  finally{ hideLoading(); }
});
function renderConsList(){
  const el = $("consList"); if (!el) return;
  const list = [...consReports].sort((a,b)=>(b.ts||0)-(a.ts||0));
  if (!list.length){ el.innerHTML = `<div class="sub" style="margin:0">${t("ord_no_cons")}</div>`; return; }
  const totalDays = list.reduce((a,r)=>a+(r.days||30),0);
  el.innerHTML = `<div class="saleMini">${list.map(r=>`
      <span>📅 ${esc(r.from||"—")} → ${esc(r.to||"—")} · ${r.days} ${t("days")} · ${fmt((r.rows||[]).length)} ${t("stat_products")}
      <b style="color:var(--red);cursor:pointer;margin-inline-start:6px" onclick="delConsReport('${r.id}')">✕</b></span>`).join("")}
    </div><div class="sub" style="margin:8px 0 0">${t("ord_cons_span",{d:totalDays, m:(totalDays/30).toFixed(1)})}</div>`;
}
async function delConsReport(id){
  if (!confirm(t("ord_del_cons"))) return;
  await DB.del("consumption_reports", id);
  await loadConsReports(); renderOrderTable();
}
/* معدل الاستهلاك الشهري لكل منتج = مجموع الكميات ÷ مجموع الأيام × 30 */
function monthlyRates(){
  const sum = {}, days = {};
  consReports.forEach(r=>{
    const d = r.days || 30;
    (r.rows||[]).forEach(x=>{
      sum[x.name]  = (sum[x.name]||0) + (x.qty||0);
      days[x.name] = (days[x.name]||0) + d;
    });
  });
  const out = {};
  Object.keys(sum).forEach(n=>{ out[n] = days[n] ? +(sum[n]/days[n]*30).toFixed(2) : 0; });
  return out;
}
/* أسطر ليست منتجات: عناوين التقرير والعناوين والمجاميع — تُستبعد نهائياً */
const NOT_A_PRODUCT_RE = /(zip\s*code|bldg|dist\b|cinema|othaim|unaizah|onaizah|grand\s*total|^total$|page\s*\d|report|as\s*on|^from\b|^to\b|user\s*name|raw\s*material|location|system\s*stock|sale\s*unpunched|nett\s*amount|gross\s*amount|tax\s*amount)/i;
function isRealProduct(name){
  const n = String(name||"").trim();
  if (n.length < 2 || n.length > 70) return false;
  if (NOT_A_PRODUCT_RE.test(n)) return false;
  if (!/[A-Za-z]/.test(n)) return false;
  if (/^\d[\d\s.,-]*$/.test(n)) return false;
  if (/^[\d,.\s-]+$/.test(n)) return false;
  return true;
}
/* مطابقة اسم منتج بين ملف الاستهلاك وملف الستوك (الأسماء تختلف قليلاً) */
function normKey(n){
  return String(n).toLowerCase()
    .replace(/[^a-z0-9]+/g," ")
    .replace(/\b(oz|ml|gm|gr|kg|ltr|l|pcs|pc|tub|can|pet|cup|tray|comp|no|the)\b/g," ")
    .replace(/\s+/g," ").trim();
}
function findRateFor(name, rates){
  const exact = Object.keys(rates).find(k=>k.toLowerCase()===String(name).toLowerCase());
  if (exact) return rates[exact];
  const key = normKey(name);
  if (!key) return 0;
  const hit = Object.keys(rates).find(k=>normKey(k)===key);
  if (hit) return rates[hit];
  /* مطابقة جزئية: نفس الكلمات الأساسية (مثل Maltesers 175Gm ↔ Maltesers 37Gm) */
  const kw = key.split(" ").filter(w=>w.length>2);
  if (!kw.length) return 0;
  const part = Object.keys(rates).find(k=>{
    const other = normKey(k).split(" ").filter(w=>w.length>2);
    if (!other.length) return false;
    const shared = kw.filter(w=>other.includes(w)).length;
    return shared === Math.min(kw.length, other.length) && shared > 0;
  });
  return part ? rates[part] : 0;
}
/* كل منتج بكمياته في كل مستودع */
function orderRows(){
  const rates = monthlyRates();
  const byName = {};
  (latestSnap?.items||[]).forEach(i=>{
    if (!isRealProduct(i.name)) return;
    const r = byName[i.name] = byName[i.name] || {name:i.name, locs:{}, total:0};
    r.locs[i.loc] = (r.locs[i.loc]||0) + (i.qty||0);
    r.total += (i.qty||0);
  });
  /* منتجات تُستهلك لكن ما لقيناها بالجرد = صفر (ما تضيع من الطلب) */
  Object.keys(rates).forEach(n=>{
    if (!isRealProduct(n)) return;
    const hit = Object.keys(byName).find(k=>normKey(k)===normKey(n));
    if (!hit) byName[n] = {name:n, locs:{}, total:0, notInStock:true};
  });
  const cover = parseFloat($("ordCover")?.value || "1") || 1;
  return Object.values(byName).map(r=>{
    const rate = findRateFor(r.name, rates);
    const need = +(rate*cover - r.total).toFixed(2);
    const coverMonths = rate > 0 ? +(r.total/rate).toFixed(2) : null;
    return {...r, unit:unitOf(r.name), rate, cover, suggest: need > 0 ? Math.ceil(need) : 0, coverMonths};
  }).sort((a,b)=> b.suggest - a.suggest || a.name.localeCompare(b.name));
}
function locBuckets(){
  const locs = latestSnap?.locations || [];
  return {
    mini:  locs.filter(l=>/mini/i.test(l)),
    refuel:locs.filter(l=>isRefuel(l)),
    store: locs.filter(l=>/store/i.test(l) && !/mini/i.test(l))
  };
}
function sumLocs(r, arr){ return arr.reduce((a,l)=>a+(r.locs[l]||0), 0); }
function renderOrderPage(){
  loadPRs().catch(()=>{});
  const d = $("prDate"), n = $("prNeed");
  if (d && !d.value) d.value = new Date().toISOString().slice(0,10);
  if (n && !n.value){ const x = new Date(); x.setDate(x.getDate()+7); n.value = x.toISOString().slice(0,10); }
  if ($("prBy") && !$("prBy").value) $("prBy").value = session?.name || "";
  renderConsList(); renderOrderTable(); renderPRTable(); renderPRHistory();
}
function renderOrderTable(){
  const body = $("ordBody"); if (!body) return;
  if (!latestSnap){ body.innerHTML = `<tr><td colspan="10">${emptyState("no_inv","box")}</td></tr>`; if($("ordStats"))$("ordStats").innerHTML=""; return; }
  const b = locBuckets();
  let rows = orderRows();
  const need = rows.filter(r=>r.suggest>0).length;
  const noRate = rows.filter(r=>!r.rate).length;
  if ($("ordStats")) $("ordStats").innerHTML = `
    <div class="stat"><div class="v">${fmt(rows.length)}</div><div class="l">${t("stat_products")}</div></div>
    <div class="stat"><div class="v" style="color:var(--amber)">${fmt(need)}</div><div class="l">${t("ord_need_count")}</div></div>
    <div class="stat"><div class="v">${fmt(consReports.length)}</div><div class="l">${t("ord_reports")}</div></div>
    <div class="stat"><div class="v" style="color:${noRate?"var(--red)":"var(--green)"}">${fmt(noRate)}</div><div class="l">${t("ord_no_rate")}</div></div>`;
  const q = ($("ordSearch")?.value||"").toLowerCase();
  if (($("ordOnly")?.value||"need")==="need") rows = rows.filter(r=>r.suggest>0);
  if (q) rows = rows.filter(r=>r.name.toLowerCase().includes(q));
  body.innerHTML = rows.length ? rows.map(r=>{
    const cov = r.coverMonths===null ? "—"
      : `<span style="color:${r.coverMonths<1?"var(--red)":r.coverMonths<1.5?"var(--amber)":"var(--green)"}">${r.coverMonths} ${t("months_short")}</span>`;
    return `<tr>
      <td><input type="checkbox" class="ordChk" data-name="${esc(r.name)}" ${(r.suggest>0 && !r.notInStock)?"checked":""}></td>
      <td>${esc(r.name)}${r.notInStock?` <span class="pill r" style="font-size:10px">${t("ord_not_in_stock")}</span>`:""}${(priceList.length && !priceInfo(r.name))?` <span class="pill a" style="font-size:10px">${t("ord_no_price")}</span>`:""}</td>
      <td><span class="pill ${r.unit==="PCS"?"":"a"}">${unitLabel(r.unit)}</span></td>
      <td class="num">${fmt(sumLocs(r,b.mini))}</td>
      <td class="num">${fmt(sumLocs(r,b.refuel))}</td>
      <td class="num">${fmt(sumLocs(r,b.store))}</td>
      <td class="num"><b>${fmt(r.total)}</b></td>
      <td class="num">${r.rate?fmt(r.rate):"—"}</td>
      <td class="num">${cov}</td>
      <td class="num" style="color:${r.suggest?"var(--gold)":"var(--muted)"};font-weight:700">${r.suggest?"+"+fmt(r.suggest):"—"}</td>
    </tr>`;
  }).join("") : `<tr><td colspan="10">${emptyState("no_results_match","search")}</td></tr>`;
}
function toggleAllOrder(cb){ document.querySelectorAll(".ordChk").forEach(x=>x.checked = cb.checked); }
function selectSuggested(){
  const map = {}; orderRows().forEach(r=>map[r.name]=r);
  document.querySelectorAll(".ordChk").forEach(x=>{
    const r = map[x.dataset.name];
    x.checked = !!r && r.suggest > 0 && !r.notInStock;   /* اللي مو بالجرد ما يُحدد تلقائياً */
  });
}

/* --- نموذج طلب الشراء --- */
let prItems = [];
function pushSelectedToPR(){
  const rows = {}; orderRows().forEach(r=>rows[r.name]=r);
  let added = 0;
  document.querySelectorAll(".ordChk:checked").forEach(x=>{
    const r = rows[x.dataset.name]; if (!r) return;
    if (prItems.some(i=>i.desc===r.name)) return;
    const pi = priceInfo(r.name);
    prItems.push({desc:r.name, unit:r.unit, stock:r.total, qty:r.suggest || 1,
                  rem: pi?.supplier ? pi.supplier : "", supplier: pi?.supplier || "", rate: pi?.rate || 0});
    added++;
  });
  if (!added) return toast(t("ord_none_sel"));
  renderPRTable(); toast("✅ " + t("ord_added",{n:added}));
}
function addPRRow(){
  prItems.push({desc:"", unit:$("prUnitDef")?.value||"Case", stock:0, qty:1, rem:""});
  renderPRTable();
}
function delPRRow(i){ prItems.splice(i,1); renderPRTable(); }
function clearPR(){ if (!prItems.length || confirm(t("pr_clear_c"))){ prItems=[]; renderPRTable(); } }
function updPR(i, field, val){
  if (!prItems[i]) return;
  prItems[i][field] = (field==="qty"||field==="stock") ? (parseFloat(val)||0) : val;
}
function renderPRTable(){
  const body = $("prBody"); if (!body) return;
  if (!prItems.length){ body.innerHTML = `<tr><td colspan="7">${emptyState("pr_empty","clip")}</td></tr>`; return; }
  body.innerHTML = prItems.map((r,i)=>`<tr>
    <td class="num">${i+1}</td>
    <td><input class="cellInput" value="${esc(r.desc)}" oninput="updPR(${i},'desc',this.value)"></td>
    <td><select class="cellInput" onchange="updPR(${i},'unit',this.value);saveUOM(prItems[${i}].desc,this.value)">
        ${["Case","PCS","KG","L","Box"].map(u=>`<option value="${u}" ${r.unit===u?"selected":""}>${u}</option>`).join("")}
      </select></td>
    <td><input class="cellInput num" type="number" step="0.01" value="${r.stock}" oninput="updPR(${i},'stock',this.value)"></td>
    <td><input class="cellInput num" type="number" step="0.01" value="${r.qty}" oninput="updPR(${i},'qty',this.value)"></td>
    <td><input class="cellInput" value="${esc(r.rem||"")}" oninput="updPR(${i},'rem',this.value)"></td>
    <td><button class="btn danger small" onclick="delPRRow(${i})">✕</button></td>
  </tr>`).join("");
}
function ddmmyyyy(v){
  if (!v) return "";
  const [y,m,d] = String(v).split("-");
  return (d&&m&&y) ? `${d}-${m}-${y}` : v;
}
const PR_LOGO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAANgAAAEFBAMAAABz2TSbAAAAMFBMVEX////+/v79/f38/Pz29vbm5ubJycmkpKR8fHxVVVUwMDAfHx8UFBQJCQkCAgIAAAB31uVsAAAp1ElEQVR42u2823Mc15kn+PsSFFkFEpXnZFEkAYqozCxQEimJQF0gq2XJIgFQHrfdbYsU5Zkez0yMZXt6JuZhIzZmOmIj9h/YjX3ah5lYy9MdvRvrtUlK6rY9bUsASN3cloAqAKJISgIqswq8oEii8pwskKwEyMozDwWAuJKgjX7Z8HmQhFJW/uq7nO9+DvDH9f/7xef/zcD+aYG0LmaALBNAEl3EQAyME6MNfr9pw0jEo221vZPHDz4yxgLgzzPbyoHBZFR7fLKzvLFXbHkYyiq48rrNCvBHcLPjJfUeKcmpYhIxuelgyjz/P3f3sE/C/wOE/S9XTFf5GTtxko0dGt1sNkZoy4k/e14FO29PF0n7lhVOXIzMbv+z5yNj+0c3KPOHoExPHk2pQl70mAxQSioTWmn/0czTG1WQhwDTdma+jfGB/oHiFhsgADPJQ5Ype7OfxrtSpHVtoszI//R/Kd0dcItiGgIAhAzr8kACW9LE5GTnuc1UENr33HfEz949gy2vhAsaU0pwvap6XnRvnkiws5upjdUOeXforC3YKWonQJegaulbpEA6fyR7qPJ+uHkyU1WLBsdM33Z1SCJA+VXzpgHGiPvFeK+t/iAFWaFkXI95o349z6GgAECi3bakI5lBxCZ51x+ojfEUxc0Fy5siJeBJJaSSCgBYbMQyvbyLeniE6ygCxH9vMMUqY0wV5/8KGZRcRqwkk3dVnBI1getMSIDU70/ZlnTKtrsWX81o0a0oMIgSwJVwBfgkN0Mv8Ydpo+5AIrXARiHBxKI8CQA++x4pAQIZbLoCQGnJevH3BAtvHrO88XmT3iTnERaJA2wuxFtfJ5BBjmSAur9LXRdM6xTx3F9mrHr/B40PhAJxxEOjPhPT5RNKgu/bbZGAJOJcOtUZBnbp31ZKVh5cPBxYeKndezb7OpQa//CuBECj0reOyFAT9cmXJAjK22eboQSAFA/dQd6Rjx/L1MfCdVm5roJoz9Dlvu9LJXu7vQYflRDpfXnk/JnjSYAxqfmUiImEAreY8poMz5jMnuj7zmVPe1htVO+1HD9RvDuIy7be+ED3zPh+XYvv681YJoeqd13i5E0zoYjrYSVF/o7jr+KRV19QzkOrftdvj3a2n+4f1VM9DaE/VijN9L6aq5zPvMqaoAOKkr4oFRUMiynpTtMjR9upfX93nPGHVBA1+fox8e7w38UP34hJkAL8N1/+dnZEk/azTJz9EYOmjnHpvk/Sty6Zn8ww+diTPdVp13zVfZPW3t3rU5Z5Vp/ODd9witAyaQBUDId5ta+3t7uzLkLAp0+NTuYypchIKedsAeeziZaBfv3RnkOgh2MjM75WEuPFtCuFV/EZEGqPFf4bM44ePWIOTjBR0hUHC4WISWEw4caS9eM9fi6X+3u82r0vZA9HmSJlwSRwIeIVA1CwKv1vGtzSh3Jnzfxw3tNFKSZIFwBwQ2c3s51hbig/pK4cz8J6KJlJd/Twjo4PvL/UiX1waATQ6iM0xkIOLzdUhVOoi7qTb57WAQJCqRV6k77yPnts+O3vxNJda+7r9c1VZfg7IjO8NQP7Kzv/umsUYbpIT/1EMXgTY11jiVxlhjtD13xPTAlTeNWSnnkJnHRtIJlmnAtLbDBu7J3sLJNV2t8au7bjW2x7SjR99kQQBKRK9fzVzwaLQS1Q7vliLfxYd8ukHd1DH54Ppv/1c8Gs2Orf+sR6/PyF8VBuDIxE61RkuzNrH9GC+J9Ga9yaC9+rWVO1AJSeJQQIEIAFQRBOuSDKpNTwX89973vkRVPl8Yl2eBcrX6pgY2DxsGZLae6vdnCWuTIgDe1P/D10NQCA2YiaajwVAGRNWRKx7d8MP/r17GvfuP2r63ufKN68+Ll+4WKz2GD4XTtw+bmRzmtzXzzzeHOsP+fOpaoHcHUEABAJgiU/WWtVEs2lvY/+asT4c375l8V0cy0oPp4vBtHaBsGM6jeTu0dxfXfrN6Ne/69G9Wqq+fF3qAwAy7BQU2VgtkMLPr0W/9aT734wGT/QdeEj3zdJsGCD2pjMHu7P8aKXe6+TCVcNkJ5613fXEK5ZtFzwc5frxdBCzHufD/fE4HMozn1GYiOUbev+15nd5d88MVk8mJo9/1v/keu4cn4stkbGJyGBmtr621m2s/uJXzRv+5jfvvBRDb6ulQ8iUd4AWGRnVt97uz667dGmFyKqMjd5i3vnPt69fno5aweRLS/s+extZ1tUnf8cIOYyfiEINgDW/MUBWz5Z/l14p9jxnOm+vW/Pe2rukXJwv3BldrLvSXHJuibFR801oJooP21NbQRs9pnZ+IEm/dZQVG9N39ha/fj6MyOzU3vuk8pGQZFMT2Tq46vhhbldEqRPv/qCnt8ImJob5R06x43I59H9iT3lM4kbUbN2vyQ9Ctp3J8tr48ZkV6QIXrv7+gt/Fp7fiMww2/JFa89cQl6Ijh48Muc5tfI2975MDILabCn5ZKp8hVe96EF3yw+yJyKx4WuR4MFgKnh8bovZpDx5OfmYdXnEDYIHRrvRejxLzH+rfSZ28eUfdH9TsfCji9gAGLD3jLlXpafGk6NWeP7D4gYyqu2J61pq5+07M4WOF1547blZRGp5UdpQtaB8qErfmOws/jTkjvPJ1gcThlrgNT+2+1D/P3T3Zf/VHiGjka1vXr32QDAyItEnm35rND3XrLZdKG/7x0c2UsCxbrT+bk/r+c+Tme5/Wdv6qzKny78aeYDMCFpiKgjK1/ViawcOTIUXwi/tqY1kpoHcN6suXMs+01OjD38728Y//H8eoCBmle++/OpX03bEV9T85J3n3N9CLMXikYAFliRL2xYJAOILrwsA+hxXH/vu4QBDA8W2HvXOmVpwPzZq5tTuKz/46kE7uu23c27ro0/MTH9+cYWSW2VQJJBRJQFLLH1dwC5cOvGK1D/sH2p50bzxt1Le3+qLnvd/8PIrwEQ/cjJnJMyVzLKVJCZtXq1XLQlpxJZoKtne/rgMTw3nPvyrrth/+eXdB1n96NMv/wsZBHtZIL6YNuB9NLFijwUIDra1GnsukvIjSizZSVric13rOPzL/HDx5dfMc+/4D7L6d66feH1Wyeba9ienPjLKkasTY8vLe0Fwp7fN4oza6td02crLS71brXw95eWGS7d++MrW//utMFK+LxuJxbtVOCCNvnBL75cf3B0wJ8QSF9j0TGnmGOPElAs77YLjhi+Ymv814SijsFAfmgmPZ/wvhl1zlBLFZUH/cjC170Cn9pu85OKEyuz/W7MyvYws/ZI6ZluNXI0M7nN94u+WxNlKUJi/8d7hpoy5Y2CMV9MuIVFS67Ix+Mo3bvyq/9eRqWuZudiE5vkrIqFbR3hz0orauOpqmUiUBXevYakBpPDGbq37e7tP/hzUGhaZXBYYL6dM22Jp+WEZG9b9+LfTibdX6K429kMObjPFOws/rn69p1QhY/kDjMfo3H+wxj/+ACYePQHz7FKRr1D9Ko85Z3midCk+dFh1EMxlNphlTWlwRZDK6it5SeNdacil+Qq1j2b819Mif/kY5xykOxKj64GFR7gnukZDg9cLYy/x1OBy0vx0KLvTE/kMo57+kpCr8qL6pCUvZRMxmTS4ZVjAl+PuumxknCtP7xyV1HXm64e5MpZU9ZrYvl3MiVvMGfWPyR0xXTABJUkt/UGeZ/akQbaRtJkigXTy7LpgPhQLRxmgfOWBdL9lqXXBc/XSs6bwhunsK3eqo9+F5AxqBaslb5eUBVcFN27Ch1wXTAf8eLwAMF8pHdCX1iupal3kPdBFv4ZwB4iUMGxnVfIsqpaArORd6kgJvZ7KrwcmhYwbxa5RQHECpLdUHtSnyygjRxifCBVzLC4ks1lXcblcm9zBw54rPEcmochxw/VV/8x3fftFH6DYo4YUl5ZyiDRLycjY3gHpd44zXaRtqSjOwZYHDbI6fkcKz53exW2p//T99fcZxTzVmz+Zzlv6I7byiktFpnEu3js69EXONUXyXcPiiRBKszXOlrUQVEuuADEYvtybTGB4aFmRYjlY/a7D3Iw4hdiZf98eTteXckj5pJC3YsNVz/fhf/ovmMeBVLu/PH9Q6l0mefhyJptW06f+Rt3H6rfRjgMWWtuuv/Din7S8sSziJu2b9TGvdOcGgqhnRF44agaBCtoufLE8pKRIW9A29exX+45c2/nGL5cnCMtLE5pfcNTMiWwmk+2pvjkmV5anZeru2VAAhllNp8KcS/pMenTl1ha+d7T3RIoee+MdrXgfF6PkM8OZTr+XJ3ea9Vx1dV2QlK2Ix4pjvR3t/YIMHrO/PbjyqUO3ske7/MrJdy6tyOJXgOmfnbdZQssyKT9xljcFQo3AFaCFhXiWJ48UXAmgK55+a3Ul6uhhP3ay/xcvzrj3i0E8UsOsLyWIDQ28vaIDoQA52kn5bstmPJ446RpKCMRtpsn6UqeGpN0lYyeH30ycZfdPcxUNcOVYjjc8dHhwVU9B0UjmNdvmNjc9QTwsCp/bqRXbmkrEvFMDw+kc5INy6pdOK28CXmGmbrnLsdi1pLDTtp0WTBVbJMBdgdAyx1ZqSOgODQxpjll8YAI/uu/nWYZ+0quJFYQpTHT3ZtO6gBBGC5iCLiCELXVvueCd/vEfc8jE/UM5FqDpdlPEocJTkWbrwnIw7YVwZ7avdY+UEJjd7cxOBUJLS827rC3f13Nl/VJk8uCu0fuVACnlE9+H0LBDqnuykFopsnjmaFp3HCUA5RtKOJIDsPiKYn5K0OP7e+qXUmhaXsBdxkbRZwl0A1ASybefWek9KF3qEkJCAlC+VfCKSc4Eu4MVBY+7ts2SnnBOdcQIwlkbLLG1r9H/EADCQyuwQo2yhrOoYLKTc0BjAE+MLte64nPdCeYWOBseTbjWOpTFn82aQjTA+PTQWvmmWLrrDEOGArLFWJV2WTpl7MqA0eGW1nExNPYXR6hhtMDlNazYJQS1NDomSLIKrg/lx+XyEN1U+SNKYOcP88MDBb5OKEdGsUE0IyHBVvXwuZBLXQl4qjJT1EGc6cseLV0eGjf6mNI6LM6H1lOQG46jWFHXbEZwZ0ZXtAKW1+rJ5VXDmPF0yVh1uYZ48WHEdx4uNFnx17gqWiVvNZiKFTzoEohrXbF6fv2CDjEAEsQF1yCILLOwokwvCru+7g1Xk2nW53lnvbUo25fjCri7tZczv+44trfSDrN5LGKCgdkkDQNQxNsry36Z7XkdY9ALY8Lp4735t9dk41g67xn7rhyPJ/wd//uIWNVQIdkginQB4tzwXGICIGCFeJWsQOnT426Gvk+WvqjDyzy13GdXdr2eSbOWNz7Jw1nFSE7csDO2LiVgczBuNkhWywNxR6JqSqJk/bRHCkKtRZleKdZfzrzWJcNT7/5Ci81jkS4BMMlvgiwONewKJcG5YTGuAOUb1DEqjVCSms+PtJjGJMDcS8c4dGhyLbCbnfVdfX2dmP7/cm/pi6m+0aIxQGn8JoGHeccREkpybiR7QQAnUPI1b7iUQQGpEQBIFYQ5CajPXrcz5Lm0mKMtM1fOzr4fKtHvfPz3XSP36HV1h/spA3Gmco7jnJr//KhQGcY5NK5nDGE7p5ARDW56M12lTtCu49l0in42wSpruZjO8RMnrKsf5c6//9zns5mFUovaW8441pRQj5nnc84HZ3uMttZmq9n6SIOYfSoS5VEc4K3RtoOtA0YjrpcZuetc3/NTxtEn6ZOBQiDXAtsS/8vD8rPz7395RUi26KUjrY9Zu0tK7rTZlZODbVeLV68fKCq6kNzyK00FRgRKUjSesYKorRpfarp1be9Xn061Hdg2+9nAB2flmqrf8tzXpOe4TZYFIFyIQKz8d7vc/QDgePu7eUaq/kHmW1TQUv1KFDgHAKbxDLeHc40XU1/aTilosVO53DmbCmsZ4qYkq+pkNIy4J72mAgC4pp/kEoAQ8Q7GIRR3J4ohMVnUh97tSDNOjBjxZJ+ans/3zcyrFpO88JvcyUldrGP1/4MPMhqTD6xQmDcgMybilgtAgBjnSirDTrveABMwKmxiAluOcc5AzL8+z/rOc/8xLXwMDTiFkr5uFsMk03qlwZQE1dXMfNwotxb/bXoEIM4gAAMZx+HCmI6Dpxvmi3Fwm40PTDSUuESG4IVcYfjN+LIceJkhtogzSBsCXNxzGvrlmwVf2QLEoADB4Wftwoih5o0XOMDJYPXc8NsN1ZdNqvKu43pnjJbKuqGcmHjMZwCICZp2RqzifJ79WO70MZhFzwMAKRkU7+jwhCtADODKT/mMq3dzA/OBYvvl8evO0BnYjrdu3KgSE3fl/Egh93KLeVfLuVErtC2xwBIBaDolVfqUC6UkoPXFMZ3rH6T5RmfRLqjxsyAvvm90XcpybmrRYaniwohLXSLzxuvCse4ZWyE5Kxi68lxiEKqpuzMcyL2RcsSC0S9IxaSSqKwfEZt+ociUJAXDw1IHI3YMesbiFAooFJgeMTKcf/l2d+ru2Vt9153CG5nF7WS5eQj2gNaxBDEQBzFY3lKVdbvkyS1GetFrCandzcV3fg1e3M5UxNbK+CdnM14yd+9N6sGzBUIAWkpJCLEsqmBFZOpFrUUubhHgjlBGn9OT7PtkPzlfnks5YjH0cymtHPkAMA4IhHkGcKilfT0V10NfyBaAQwAgEH+8Gha5ZTPlG6owExYtY3HkxHJdJdkDWseiUQ6e3UbBVBBdkpZHpqai/rWsKRGlbQEA4ixoiwbRWBFXHT/ypjNbq5Xv1R2DWoBggw3WIAiWVSwRAETy+YOolTkiASiKObsVZFRc4V6dY5UysOT1we83UbY0iNnhEFOFHG8oEQwTSkC46pTY8JDvxgfztPwoscLAGYNDCcBzAWWFkg5v+A0PM9+YF3z6ToHrFpOAEgAU58KkxgjW5lKGdoelmipvDLj3xliqGBES8NnmggnhFQqjxCd35O6l9ZK4epOAotxsylSXNyA5rImRJbUzntA9wNx8NpYGCm/KepF7xXtcsw6FRWxYGzeuIFr1mdOhSuf5yGKWSIrvlMvy0U2jTPl733CU5izJkpnBCVDFTQcLQ9fvzI+afGmqyxltYdLo2mw2Aijqknv3DJyI83Ghb2GeCDedjYAlmRGvsMU9LAoDDkuhLor/BGCOlq1Ic3E2jdX783kwJiz8E4CBjBN1LKa7tsi9W9VpPsnebDDGuH245IoGaYat5rdcuPmUETFTGvs1VzQoUR4lj6sxhckNnnp4iJMIoM65C9v3P3GnuTmtAoBqF8rR2ujeA7URbBDtYTb1Ob0p773arUQRAOlezgVXFoTvb7rMNH4sgZb8h5n2QUEAU0IIyTtJn9Cl3OxNTTeTd0M/l/ufcrcUAKF4EkaM3YYW6r/vPmNrGnGyEKaS3ND3Fi5l0koCICOdPGqCQyapa82aU5w9gDIj4a7FFOVmQ6tjh4SWO/PnPikAZDpiqEKG5RVVbI1vSB5z76+N2gExt22NUEwzI25HZteNaKkl/lVLNtpfuRHhfNL3hKO3XVyL7XtcWjEwt5yNZBZcby1ph8ibQtpxJfTcewvKJ7zCfyvtTCewpsiUu7I8ulJmsZm+1JoyK/YpV3B77NDYYGHeyUgjbXWlElv2+3ItmSHb27nCji0HUyWL22vOADclszou2S9NWndyjXqdqmYzPGYxSltfW0vKxDmM+1JmEFeGXMtUJdNFSemkX0wV5ssolEwpZZjSTmhrfYORzWPyfmAFy+bta+6yDutQIZFMf0fKfIGzBqM89zKHaOp+b63wSnAen+y6n4J0Eae1kkZi3Ip5ozMZOzbztNNQCCsc9KqWUtXefzW6loswLKXuR5kC2WytkDNMSYM5o2FH5lV9y6DDAXB9KOekuBAw9q+lICalWtqL92Njkaf5Wo5AZ8royE8wrTdzJL8vX2XgRkvuJ9Qo4/I1eKE+5VY8vr6CWI3KLNld2opvWze5V02/4JxVTZnMsbpTBIg7ubSyTAmlY3WBF7pmzHDfYNo6YDJl37TJfiHWtLwpACaOsVAms6cHGLozvVnhERDmndxWCwokVs3Gkm3YNuO2IzOJdcxVRAYvHmUJZ3JkhcW6s/dg62xb1Ju5PtfKmlsDam1m3gVn7un0U3vK1Nzyd+WVc0hTrVdfPD676/K2j8U6lLEm09a9meSIqi7X5dDnUK6RyQ4O9xf5zt40mPJypUxv2hSAcksr2agZiZu2LozsWGfTOpT5T372o4Q0YmG1vuyX0kv7ng9ItR4Ucz/bE8io0Wqw2847j544GIUEx8TfrJzcoyfKR49G5I5b03eurg3Gm71/86e6hOWeOjC7tFhATdndU61yri1xbfvPtgkxm2lV4vz7mW/tiYgAzS0f/qZ9hYybY4VvPY8auopvdS2pO8yDGTVg7vZLR5+QwWzzHvXfg1bJowsDg9bN7+llXqPWZjZb/+XnCD8n64pLyXTNlUDzrdOfL1UoS2rbRPm1Pl0g2K7fzsu9fme54Wu2LOzmpAUje1hJKJnsIyHtexMq4p8l5yQxL9+bVGSc7vdszzlEtqHnJQDlOIdGlllgi3M7aypAyYxrCMnqyylr9TN2MvN8RARAEG2LRgnufEGDBduzz9+eolbPR/PBSPSA6h9TsllRayQIALRe/lksIpcYtmrmYPLpI4EKgGA7B0UirmwwaUFmc0m7o2/PVMMH703Vgto/RhpgkbbrvZGgVrJRq4m79oFZtD5y8XeWjZrPA4DgXb6zZBaa0Hxwb/dXWaOxR8nnhRBT82ALqs8ZoC/8oS+dWmMEKN/yihZcd7io9fX1HU3vzRUZPJcBShqZ5bMcHEBisWsvV2kjRaqtkdpUlCEAqFX1XxBTU/NstGa19DaKXqruZQFq3sW5zMGA49eWHUhEAZCx7c6N3dbCZqHIrAWv1BqRALh9PueUb18MlrExUJqqubPfDCSI7+kfcEVhYVK5rLIHI9Jg/y9v46o2JSX2plqx9WfpAwEoAiDKg39IUPlelWxW1cScpQJQc6z/I3fqqjtfzlrcZ55THjZmusrgxuWB//NqfnZBDHEjmwoCsm79rpVHZCQIPKe4t0du23swIqN7AmC2bdvW3yyzAhcu5Nr2RgJwfm7gJ1culFdt6nhra6sb7dgto7v73zwQ+ItTuU/e7WWzQW07u/4lmlt5REkxJbZ8ZTaImwuHIw+Km5eWlJSa2+y9/3DAjgRt+07/9Z6ovae8EqwmZvXItb1d5ccu/+LaF1vvNb1u9B3cVmY1/yDdKEUDHgECyKt+lOKmjAAAotUnPi8sLU/eLtb239lrVq1f/sYrKWdxqnURjEeMbVqlOdmqv/vTbaRmF5/Y8i9blYgGAs3cGwmC2TYexe0pMdv2VG1eFLOt5kdnlnDxKao+bvw6fZDd/vC/Mgt+dBVYEIjyFLZ3HKi8e3VEleextM5o38EIQBEhjdYgfHMbkbEnEsANEGXzD8nmbb+tLbHFUwJlN/bYU62X+/NyaYV1eQwwW8qkzp26eG+al0/OfJNv8yGiKpBBq2H2f8wCSa1RXC3L5Pypnki0/fTUSsM/S3v/5Be/Wn6yZcX42lMOcz94bInxQY8JgAkYcIVt4MT4z7f0pO0kVz/emjy88KA7rVaXJ6UnJuV9sphQClcsHXqWLybNEgRnwuBCesrg3Bh8B0pYWfy1c7hhH0gfkqvC6LDdiwmzcr+UiStHhF1LwsAZ2ypCCS4Es10hDCvJtemcZ8vejJdPN6wSU86nq0ohFBcjcnR5sr0ilHOFQ3L0Xj5X/xQQPhPEPWlYDMKRyd4OIb8s5IxsbL5GQfq0uaowpwrhyMqaxQrK5LKZD1DGDn0mEy7nruBkcNeRPAsxoPeDOuX8oyQmlVidxQghVsR4TSui7OZoOLYo7KDpqYMRqgWWV26LCGm0okaYomxU/0drQjP2yHhCAgbO/YOYXXkqS3siHpmeE/fLPIO922rle4Gc0XZQVXcXm3Zf0P6k5s62RmYZzl/b8f3y3WpEkg1pq4CiiXd/Cm0lmGrVItdU+X6UmZ+3BlP3duEcZWLXvuHMHrlajEdQC7Q9AK4ELS+V/7uM/SZp1XwbUevuz2Ww+iDdXDRwgvuy0Zy9VRILB4m0hO/3bfWzV8qPxLwgGbk6FeW1WUP/L3ue2eqppp1am5pqbo20ffaWkqt6IjT7SN5X9z1jUQ5wT6qEyFzf7vKjLW7zNy662//CnZIGk9SqlXa84vxasNFkwpFtV53zP40VVyf9CrMIHlC7WvL/1XbR1/3ERTpyobwvdlU+0lmbKidVOc4HI8/suiSutWtPXf7YCM9PDa55XCx4qHKStu9oxraYt8UUxV6rUujoNb1qVyjTL/zkTLJjRtBgyRpwVMENRzehdnUl++pLrhCSq8pMGoXRZEYfzjCnaX/zsGErsxi69osC06c3o8ukpGH25yUpxkLXNj3X7zGdDy1vsjftfNrzNSnqXjwhWBNttItwX8pUpT+X8y0GCaXZSrAqH3R6E4VU+6Brx8mkwfMdrm9b9ib0YtTThbwjuU0CBN9SAuAvFQzmXIrrgmxZ9EMnPeJbLaVNqTfmXaMjna67EoAJSFBMzFiiaghH451Qj1XSXytypsxNANNcw870Tg+4xBmkBBhCUgSfQ/mcGfAF7RAW6ZvR+PG58Vosl3dKSYvrJwlMKb8NkJIpIYkRlPCtMpjaBNXXigwTpwYc18haquAQl0qcY1CjoH0gBgaoS3HhG5c2gTKlu5V+4ZKR6WGV3PAuDiF8rguwKZICTUWdqyp3fa424YYhpamCN70lk+yrTDj5X/ynFBt3eLLiHGZTotEjkTclisRpUwrSsYHuI7yjd3rA9YaOJZnMF3pSzkK9MVRSq4o9yufYBAsCz0/x7qO9N/pzH/94ayZN07lLSeYUKSGJKQlGBMXURjsxD1CQBHlosm+cGvjxrdd6s4n6QO5y5m7uMysmZighBINQ4ExY+zZhUys/NjlYaBl459TR3mxvlxrOnfl+l+PwpFBgTAEU42Bd4Ka5CdoooN0tvDH8wWu2nbVUJe9szSZ+V0pbSnQZShaLxGcUKcHjo5uhIKBDhbu545kMs5QaGPJeP+Lkna9wUSlxpYoAJBATbDNcDIB6cWD8VrKvxw4xnKteyCYqEzu5KaRvKEFQkgihIshNAYMMi5nuLlfQ3dyE/H6qlL9cTTJRPAIIBUgGDunzzekyxZsSjH+nKGQ4+En1UkfXDifXk/bEOW6KOgMIDEzMcHNTZOZBQpw9rKiS+8D/Ydp3XIMn6u4h3qieMh985+c+l2sc5X94ypSSsjDsJ/XBoX3H0131fCFpM8+5ZHN3vidFGJHMsMRmyAzAeP6M8AqXrti9CJ1RnvSVqMaVKxuFIZ8paekaNgfM7Dg9zJxCe0+WIV+I211CEudKQgKKgbjyuHI3CUzLbXdOO5MfJrtIOWc0y9TdSoqFCgB0gEh3LWtjjdoHg411Np3O5Z0jSSY8UU0bUohRloAsMQCME3/a04zN6nnWRxEv3DDsFMRdL2XZFDodFpRgAmDEwJlXtbncJAUBWgY/qCa7tIRbgGFBiJLBGEYkAAbFjZFP7YS+aWBGBb4hFbxLVZYQouIbSipqpNPCTroOxexNA8sT9AkXELB4kSl5hBPEgs9ssr824W5s9GpDYCbXRWGgqKucYYAJyTiJUJeABiKkWgp5X26OggCQEvRz4k9Lk6cg5NiTTEGBSQhAJzJ+AtPfPDBA4SSri5uG6TI0/JeSgFDEcgOV1EgRmwbWMIMD3rTPQVKZpJMJcxSAyt0YyH+wb9NvpvTCN2OqMphkKH2DKUIRgBTD47lTVAc2GawpWZDMYY4pbQgumyQA5HU1ocX8DWYWTUvbw+x+F1hoW693VkeZks7vrOCqUxhlAZm3Ry4Ewb2hTRZsDIwHGu3275v0qnItLCsx9YWppqauBGVABksuEiXjCV7eGFgAJErsgXdz1JyLoYiIqaAw16ioLGmMzD3xuw0LBXbmwTd1cm5RhiwwW2Oru6qpjcqs+/mPdt+pPQgsCBBV+syTRd1fNcrxYnok2Jg2Ntld+t88mHoOqYRmEZXMld55SzIxPSo3BEbJ3hAtS5+1VZHHioDl80p8YYpcEBNQBfCVl7kRu5n82vQHIF2CFm9DNAS3w/zqfUbZwuGBpTTIEMSAlPS8pqalCQAUIOCtrJxC6+4HKaMjzC/GWn6TF86k86s3tTRV0xJbwJmLsAigtPO4PnRmQzaUKUo4DrcXT0CGdvX7Yf9qF6NIqmWWwG1E1WOwn33d3qBCJ0BaunqvFK7V01/pNdfwZwy0hDVNjElLSYC4b9lsufov+8e9AiODD0m8K7f4cQw8ldLZSjbqUsnQWESjlp1HK28wJgH/phTLNqAAKSweCF0UGSkJoeG4pczFI9Z6XMq51droA0tOinVVO3otTw2wURx240PXXIBgsk/3FaGlksqpNyXDtw41Weq0AgAuDL1xxu6Zrdl0yNxRNK4obsp3vxNbnAZYx+rzLdmjqVCvvA2MHHqfTeQApekjKAJq8jV9+/uXv9tSH92fjU2fBQBhFiuZTwnQPvtPr1oq4cmFAzyaM6zOPiAGOXvuaKpQfbWDACk5vzEDIPboicMmAH/X6zultf/1hDCe7WnoQtOWH/3AAwDW+6w5PLIrs2REhKbTD/BniT996ZMz8b5MZ1GG1ZlMXVagZZKp8Q8AQFXtmFTVJiaVbTQ292RHe+UygIr97fGTW37Q87PRRpvG3/d4pv5/3Z8yupV0cv0Dbk8XwCbp2d40gFL8h7YJEBQDFwAvqYXLTBX2H0sCSjYZcuB/+8mIsRAi7/Dp2Z6uNcGU4pwBHNy3YuPidFGL+5pkMFMGcVVk0tpngesA0GiuLvCKMVVlAJRm1J1M3dXi87EdtyhhLSb4i2CMETRDCJ9zDoApF7rg3Oa2jqIEs9NoHLAMJRQIpKQBACYYoORCyMpjYqTd87lpAsR5NVTyXn6v3QvXBMLGNvNIMghtTFcAKqqoJFMiJ7qElBDch4IYLSpdeWJhoy3eOUJUrKdcQWzepMeK0l87IlZnzQWzKBkkmAR8TVqARJy5gMQM4xwS0JgCzFHMRwXUqebhFIcnJaBRQyLJRvqxShs5pciAkqBYsYfP6ebYXxBVSHmccQqb7NzLnLc7DIBSoSRZN3aBNTDonk8w9n+qKyGLmgklIWNM3RPtEnMlrNRP5uW309bvJt/axUv28dxk/Z/r1eThv1cdhkp3vGW7jzMinmW0c+TfmUqaLoBwFAoA0SGvmhk6x4FDo42TTU0/SuiLoxOLYPsEjI4fLfi8/TqSP9yZ4pmiTTJpUkY+rjQL8cxfIWNwP/mDeBd1/NA2Pc+FBBpDqUxnFQ+9I0/EKfmVx+eFmKZ7Y6eLYKXdY519i/0lG9VebacpO44KIE5IEiTZXB6NA5RR2bhhUl/coJGGSjWaMSRpxjn7nRNOE8saEhAcoCT7tVzFRjl4tKuDLTjBcMDv67PHx5CRDKowms0CCE82vZJlUJIjiYnJnl6/Jff3DXHPNEIGyMG02ZVUvpaZnyWV7Ibz3irKLH/Y7FlwGd7E8KR27MbpouxlgioDRdnLlDuR11RaAXA5JgZ8cTw85bDGQcI4iKlKCNWSU8NGD4XuwiBE5XReX0WZUqfZxLwkGbxPzrNpb/xvUeGCi8LZHg8Kldw5FJiSAIco+KKiCvNsTFwBqKVwyjX5O046k+w86Ta0gpiovL1vFZirHXrjlUaiLDi8954eMNXpztOHCcD4nZ+8AsnGZ9pzDFASzNdPqyzXJ2YAEEuMfp1LVT0dKlZhbjHOvIkzHMpnkDoK94aylrhgSsyndKQA5qccJv2FXJlV2y+/Hmr6l+9hYRqTq8ZlvtA6Z9KZo+3/9X+1ip0intSp49XtfzU6ev+USVXvhTWexAjzJcgGAAeS++mM0jp//oE+//uEMGw4AKDc2/85Y+4Q5HB/5tbLJo/T4KdjmQX5r3PXxJI2ulz4a6HJrqq8u92QlldZ9biqdu832TtuwpXka8YPfLqRk1rF31gy2GAUx5LxVQIg7pw5smYJgkYKh8fzI4JD6YaosuH+M95DZp7LKoihhBgK/YpLbI3DROHEyUrO1UJo7S2Fk6E3hOqhmQeAiTWr7YuVF1PBu7Hkg8X/ClXOU6cRAmGxuEVX7kCXkv5Gb+1dc4XRiYtBfu2cyA+mFi4ZvEo1Cq/VZIA/ZDV1aWlmrF3npszi50mQBY4/fPF1X5IxV6Y0f+Aia93L+q0l8+vGZhBGYPH1i4TsXlJ4Hwb8cf1x/XH9cf1x/XH9cT3c+h88mJZkKQCQVwAAAABJRU5ErkJggg==";
/* حفظ الطلب في السحابة حتى لا يضيع ويقدر يُفتح لاحقاً */
async function savePR(){
  try{
    const doc = {
      loc:$("prLoc").value, from:$("prFrom").value, by:$("prBy").value,
      date:$("prDate").value, need:$("prNeed").value,
      items: prItems, ts: Date.now(), branch: curBranch()
    };
    await DB.set("purchase_requests", "PR"+Date.now(), doc);
    await DB.set("purchase_requests", "draft", {...doc, isDraft:true});
    await loadPRs();
    return true;
  }catch(e){ console.warn("savePR", e); toast("⚠️ " + t("pr_save_fail")); return false; }
}
let prSaved = [];
async function loadPRs(){
  prSaved = (await DB.list("purchase_requests").catch(()=>[])).filter(x=>!x.isDraft)
            .sort((a,b)=>(b.ts||0)-(a.ts||0));
  renderPRHistory();
}
function renderPRHistory(){
  const el = $("prHistory"); if (!el) return;
  if (!prSaved.length){ el.innerHTML = `<div class="sub" style="margin:0">${t("pr_no_saved")}</div>`; return; }
  el.innerHTML = `<div class="saleMini">${prSaved.slice(0,12).map(r=>`
    <span style="cursor:pointer" onclick="openPR('${r.id}')">📄 ${esc(r.date||"—")} · ${esc(r.loc||"")} · ${(r.items||[]).length} ${t("items")}
    <b style="color:var(--red);margin-inline-start:6px" onclick="event.stopPropagation();delPR('${r.id}')">✕</b></span>`).join("")}</div>`;
}
function openPR(id){
  const r = prSaved.find(x=>x.id===id); if (!r) return;
  $("prLoc").value = r.loc||""; $("prFrom").value = r.from||""; $("prBy").value = r.by||"";
  $("prDate").value = r.date||""; $("prNeed").value = r.need||"";
  prItems = JSON.parse(JSON.stringify(r.items||[]));
  renderPRTable(); toast("📄 " + t("pr_loaded"));
}
async function delPR(id){
  if (!confirm(t("pr_del_c"))) return;
  await DB.del("purchase_requests", id); await loadPRs();
}
function ddmmyyyy(v){
  if (!v) return "";
  const [y,m,d] = String(v).split("-");
  return (d&&m&&y) ? `${d}-${m}-${y}` : v;
}
/* الورقة النهائية — إنجليزية بالكامل وبنفس قالب النموذج المعتمد */
async function buildPRPdf(){
  const rows = prItems.filter(r=>String(r.desc).trim());
  if (!rows.length) return toast(t("pr_empty_toast"));
  await savePR();
  rows.sort((a,b)=>String(a.supplier||"zzz").localeCompare(String(b.supplier||"zzz")) || String(a.desc).localeCompare(String(b.desc)));
  const blanks = Math.max(0, 9 - rows.length);
  const totalQty = rows.reduce((a,r)=>a+(+r.qty||0),0);
  const w = window.open("", "_blank");
  if (!w) return toast(t("pr_popup"));
  const esc2 = x => String(x==null?"":x).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  w.document.write(`<!DOCTYPE html><html lang="en" dir="ltr"><head><meta charset="UTF-8">
  <title>Purchase Requisition - ${esc2($("prLoc").value)}</title>
  <style>
    @page{size:A4 landscape;margin:12mm}
    *{box-sizing:border-box}
    body{font-family:Verdana,'Segoe UI',Arial,sans-serif;color:#000;margin:0;padding:6px 10px}
    .sheet{max-width:1180px;margin:0 auto}
    .top{display:flex;align-items:flex-start;gap:24px}
    .top img{width:150px;height:auto;flex-shrink:0}
    .right{flex:1}
    h1{font-size:34px;font-weight:800;margin:6px 0 20px;text-align:right;letter-spacing:.3px}
    .fld{font-size:15px;margin:8px 0;display:flex;justify-content:flex-end;align-items:baseline;gap:8px}
    .fld b{font-weight:700}
    .val{display:inline-block;min-width:210px;border-bottom:1px dashed #333;padding:0 8px 2px;text-align:center;font-size:14px}
    .row2{display:flex;justify-content:space-between;align-items:baseline;margin:14px 0 0}
    .row2 .fld{margin:0}
    .lead{font-size:15px;font-weight:700;margin:16px 0 12px;display:flex;align-items:baseline;gap:8px}
    table{width:100%;border-collapse:collapse;font-size:14px}
    th,td{border:1.6px solid #000;padding:5px 8px;height:27px}
    th{font-weight:700;text-align:center}
    td.c{text-align:center}
    .w1{width:56px}.w3{width:86px}.w4{width:124px}.w5{width:124px}.w6{width:200px}
    .sig{display:flex;justify-content:space-around;margin-top:40px;font-size:15px;font-weight:700;text-align:center}
    .sig div{width:28%}
    .sig .line{border-bottom:1px dashed #333;height:22px;margin-bottom:6px;font-weight:400;font-size:14px}
    .noprint{margin:18px 0 0;text-align:center}
    .noprint button{padding:10px 26px;font-size:14px;cursor:pointer;border-radius:6px}
    @media print{.noprint{display:none}}
  </style></head><body><div class="sheet">
    <div class="top">
      <img src="${PR_LOGO}" alt="Noir Cinema">
      <div class="right">
        <h1>PURCHASE REQUISITION</h1>
        <div class="fld"><b>LOCATION</b><span class="val">${esc2($("prLoc").value)}</span></div>
        <div class="fld"><b>Date :</b><span class="val">${esc2(ddmmyyyy($("prDate").value))}</span></div>
      </div>
    </div>
    <div class="row2">
      <div class="fld" style="justify-content:flex-start"><b>From :</b><span class="val" style="min-width:340px">${esc2($("prFrom").value)}</span></div>
      <div class="fld"><b>To : Purchase/Store incharge</b></div>
    </div>
    <div class="lead">Kindly arrange to purchase the following materials on or before
      <span class="val">${esc2(ddmmyyyy($("prNeed").value))}</span></div>
    <table>
      <thead><tr>
        <th class="w1">S.No.</th><th>Description with Specification</th>
        <th class="w3">Unit</th><th class="w4">Current Stock</th>
        <th class="w5">Required Qty</th><th class="w6">Remarks</th>
      </tr></thead>
      <tbody>
        ${rows.map((r,i)=>`<tr><td class="c">${i+1}.</td><td>${esc2(r.desc)}</td>
          <td class="c">${esc2(r.unit)}</td><td class="c">${(+r.stock).toFixed(1)}</td>
          <td class="c">${(+r.qty).toFixed(1)}</td><td>${esc2(r.rem||"")}</td></tr>`).join("")}
        ${Array.from({length:blanks}).map(()=>`<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td></tr>`).join("")}
        <tr><td></td><td class="c" style="font-weight:700">Total</td><td></td><td></td>
            <td class="c" style="font-weight:700">${totalQty.toFixed(1)}</td><td></td></tr>
      </tbody>
    </table>
    <div class="sig">
      <div><div class="line">${esc2($("prBy").value)}</div>Requested by</div>
      <div><div class="line">&nbsp;</div>Verified by</div>
      <div><div class="line">&nbsp;</div>Approved by</div>
    </div>
    <div class="noprint"><button onclick="window.print()">Print / Save as PDF</button></div>
  </div></body></html>`);
  w.document.close();
  setTimeout(()=>{ try{ w.focus(); w.print(); }catch(e){} }, 900);
}

/* ---------- sales (products) ---------- */
let salesData = null;
$("salesFile").addEventListener("change", async e=>{
  const f = e.target.files[0]; if(!f) return; e.target.value="";
  showLoadingCloud();
  try{
    $("salesStatus").textContent = t("sales_reading");
    const parsed = parseSalesLines(await pdfToLines(f));
    if (!parsed.rows.length){ $("salesStatus").textContent = "❌ " + t("sales_err"); return; }
    const salesDoc = {...parsed, ts:Date.now(), savedOn: todayKey()};
    await DB.set("sales_reports","latest", salesDoc);
    await DB.set("sales_history", todayKey(), salesDoc); /* أرشيف يومي لا يُمسح */
    $("salesStatus").textContent = "✅ " + t("sales_ok",{n:parsed.rows.length}) + (parsed.from ? ` · 📅 ${t("file_of")}: ${fileMonthTag(parsed.from, parsed.to)}` : "");
    toast(t("t_saved_sales"));
    await loadSales();
  }catch(err){ $("salesStatus").textContent = "❌ " + t("err") + err.message; }
  finally{ hideLoading(); }
});
async function loadSales(){ salesData = await DB.get("sales_reports","latest"); renderSales(); renderFileTimestamps(); }
function renderSales(){
  const body = $("salesTable")?.querySelector("tbody"); if(!body) return;
  const stats=$("salesStats");
  if (!salesData){ body.innerHTML=`<tr><td colspan="4">${emptyState("no_sales","chart")}</td></tr>`; stats.innerHTML=""; $("salesMeta").textContent=""; return; }
  $("salesMeta").textContent = `${t("period")}: ${salesData.from||t("from_start")} → ${salesData.to||t("to_now")} · ${t("updated")}: ${salesData.savedOn}`;
  const q = ($("salesSearch").value||"").toLowerCase();
  const total = salesData.rows.reduce((s,r)=>s+r.qty,0);
  const rows = salesData.rows.filter(r=>!q||r.name.toLowerCase().includes(q)).sort((a,b)=>b.qty-a.qty);
  body.innerHTML = rows.map((r,i)=>`<tr><td class="num">${i+1}</td><td>${esc(r.name)}</td>
    <td class="num">${fmt(r.qty)}</td><td class="num">${total?((r.qty/total*100).toFixed(1)+"%"):"—"}</td></tr>`).join("")
    || `<tr><td colspan="4">${emptyState("no_results_match","search")}</td></tr>`;
  const top = [...salesData.rows].sort((a,b)=>b.qty-a.qty)[0];
  stats.innerHTML = `
    <div class="stat"><div class="v">${fmt(total)}</div><div class="l">${t("stat_total_units")}</div></div>
    <div class="stat"><div class="v">${salesData.rows.length}</div><div class="l">${t("stat_products")}</div></div>
    <div class="stat"><div class="v" style="font-size:14px">${top?esc(top.name):"—"}</div><div class="l">${t("stat_top")} (${top?fmt(top.qty):0})</div></div>`;
}

/* ---------- leaderboard & points ---------- */
let sellerReports = [], employees = [], allTasks = [];
$("topFile").addEventListener("change", async e=>{
  const f = e.target.files[0]; if(!f) return; e.target.value="";
  showLoadingCloud();
  try{
    $("topStatus").textContent = t("top_reading");
    const parsed = parseSellersLines(await pdfToLines(f));
    if (!parsed.sellers.length){ $("topStatus").textContent = "❌ " + t("top_err"); return; }
    const period = `${parsed.from||"x"}_${parsed.to||"x"}`;
    await DB.set("seller_reports", docId(period), {...parsed, ts:Date.now()});
    for (const s of parsed.sellers) await ensureStaff(s.name);
    $("topStatus").textContent = "✅ " + t("top_ok",{p:`${parsed.from} → ${parsed.to}`, n:parsed.sellers.length}) + ` · 📅 ${fileMonthTag(parsed.from, parsed.to)}`;
    toast(t("t_saved_lb"));
    await loadLeaderboard(); await loadStaffList();
    await updateStreak(parsed);
  }catch(err){ $("topStatus").textContent = "❌ " + t("err") + err.message; }
  finally{ hideLoading(); }
});
async function loadLeaderboard(){ sellerReports = await DB.list("seller_reports"); streakInfo = (await DB.get("streaks","current")) || streakInfo; renderLeaderboard(); renderEmpPoints(); renderFileTimestamps(); }
/* ---------- مبيعات الموظفين بالكميات (تقرير يومي تراكمي من بداية الشهر) ---------- */
let empSalesDetail = {};
function empDetailMonthKey(fromStr){
  const m = String(fromStr||"").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${String(+m[2]).padStart(2,"0")}`;
}
async function loadEmpSalesDetail(){
  const list = await DB.list("emp_sales_detail").catch(()=>[]);
  empSalesDetail = {}; list.forEach(r=>empSalesDetail[r.id]=r);
  renderFileTimestamps();
  renderMyQtySales();
}
/* بيانات الأصناف صارت تجي من سجل الأكل الجديد؛ ولو ما فيه، نرجع للملف القديم */
function fnbAsDetailDoc(){
  const agg = fnbByName();
  const names = Object.keys(agg);
  if (!names.length) return null;
  const froms = (fnbReports||[]).map(r=>r.from).filter(Boolean).sort();
  const tos   = (fnbReports||[]).map(r=>r.to).filter(Boolean).sort();
  return {
    from: froms[0] || "", to: tos[tos.length-1] || "",
    users: names.map(n=>{
      const u = agg[n];
      return {
        code:u.code, name:u.name,
        items: Object.values(u.items).map(i=>({name:i.name, qty:i.qty, gross:i.gross, combo:i.combo}))
                     .sort((a,b)=>b.qty-a.qty),
        totalQty:+u.qty.toFixed(2), totalGross:+u.gross.toFixed(2),
        comboQty:+u.comboQty.toFixed(2), comboGross:+u.comboGross.toFixed(2)
      };
    }).sort((a,b)=>b.totalQty-a.totalQty)
  };
}
function curMonthEmpDetail(){
  const live = fnbAsDetailDoc();
  if (live) return live;
  const key = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,"0")}`;
  return empSalesDetail[key] || null;
}
function empDetailFor(name){
  const doc = curMonthEmpDetail(); if (!doc) return null;
  const norm = s=>String(s).replace(/\s+/g," ").trim().toLowerCase();
  return (doc.users||[]).find(u=>norm(u.name)===norm(name))
      || (doc.users||[]).find(u=>norm(u.name).includes(norm(name)) || norm(name).includes(norm(u.name)))
      || null;
}
$("empDetailFile")?.addEventListener("change", async e=>{
  const f = e.target.files[0]; if(!f) return; e.target.value="";
  showLoadingCloud();
  try{
    $("empDetailStatus").textContent = t("empd_reading");
    const parsed = parseEmpDetailLines(await pdfToLines(f));
    if (!parsed.users.length){ $("empDetailStatus").textContent = "❌ " + t("empd_err"); return; }
    const key = empDetailMonthKey(parsed.from) || `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,"0")}`;
    await DB.set("emp_sales_detail", key, {...parsed, month:key, ts:Date.now(), savedOn:todayKey()});
    $("empDetailStatus").textContent = "✅ " + t("empd_ok",{n:parsed.users.length}) + ` · 📅 ${parsed.from} → ${parsed.to}`;
    toast(t("t_saved_empd"));
    await loadEmpSalesDetail();
  }catch(err){ $("empDetailStatus").textContent = "❌ " + t("err") + err.message; }
  finally{ hideLoading(); }
});
function empQtyTableHTML(u, limit){
  const rows = (u.items||[]).slice(0, limit||999);
  const max = Math.max(1, ...rows.map(r=>r.qty));
  return `<div class="tableWrap" style="max-height:340px"><table>
    <thead><tr><th>#</th><th>${t("th_product")}</th><th>${t("th_sold_qty")}</th></tr></thead>
    <tbody>${rows.map((r,i)=>`<tr><td class="num">${perfRank(i)}</td><td>${esc(r.name)}</td>${perfBarCell(r.qty, max, "var(--gold)")}</tr>`).join("")}</tbody>
  </table></div>`;
}
function renderMyQtySales(){
  const el = $("myQtyBody"); if (!el || session?.role!=="emp") return;
  const doc = curMonthEmpDetail();
  const meta = $("myQtyMeta");
  if (!doc){ el.innerHTML = emptyState("empd_none","chart"); if(meta) meta.textContent=""; return; }
  if (meta) meta.textContent = `${doc.from||""} → ${doc.to||""}`;
  const u = empDetailFor(session.name);
  if (!u){ el.innerHTML = emptyState("empd_none_me","chart"); return; }
  el.innerHTML = `<div class="statRow">
      <div class="stat"><div class="v" style="color:var(--gold)">${fmt(u.totalQty)}</div><div class="l">${t("empd_total_qty")}</div></div>
      <div class="stat"><div class="v">${u.items.length}</div><div class="l">${t("stat_products")}</div></div>
      <div class="stat"><div class="v" style="font-size:14px">${esc(u.items[0]?.name||"—")}</div><div class="l">${t("stat_top")} (${fmt(u.items[0]?.qty||0)})</div></div>
    </div>` + empQtyTableHTML(u);
}
/* ============================================================
   مبيعات التذاكر + مبيعات الأكل — رفع وتجميع وعرض
   ============================================================ */
let ticketReports = [], fnbReports = [];
const COMBO_PTS_PER_500 = 100;

async function loadTicketReports(){ ticketReports = await DB.list("ticket_reports").catch(()=>[]); afterReportsChanged(); }
async function loadFnbReports(){    fnbReports    = await DB.list("fnb_reports").catch(()=>[]);    afterReportsChanged(); }
/* كل تحديث ملفات: اللوحات + السيرة + رسالة التحفيز + الإنجازات الإلكترونية */
function afterReportsChanged(){
  renderTicketBoard(); renderFnbBoard();
  renderEmpBoards(); renderEmpBattle();
  renderMySales(); renderGreeting(); renderFileTimestamps();
  renderProfitPage();
  if (!$("pCharts")?.classList.contains("hidden")) renderCharts();
  syncAutoAchievements().catch(()=>{});
}

function periodKey(from, to){ return docId(`${from||"na"}__${to||"na"}`); }
function periodLabel(from, to){ return from||to ? `${from||"—"} → ${to||"—"}` : "—"; }

$("ticketFile")?.addEventListener("change", async e=>{
  const f = e.target.files[0]; if(!f) return; e.target.value="";
  showLoadingCloud();
  try{
    $("ticketStatus").textContent = t("tkt_reading");
    const parsed = parseTicketLines(await pdfToLines(f));
    if (!parsed.users.length){ $("ticketStatus").textContent = "❌ " + t("tkt_err"); return; }
    const key = periodKey(parsed.from, parsed.to);
    await DB.set("ticket_reports", key, {...parsed, ts:Date.now(), savedOn:todayKey(), branch:curBranch()});
    const tot = parsed.users.reduce((s,u)=>s+u.tickets,0);
    $("ticketStatus").textContent = "✅ " + t("tkt_ok",{n:parsed.users.length, k:fmt(tot)}) + ` · 📅 ${periodLabel(parsed.from,parsed.to)}`;
    toast(t("t_saved_tkt"));
    await loadTicketReports();
  }catch(err){ console.error(err); $("ticketStatus").textContent = "❌ " + t("err") + err.message; }
  finally{ hideLoading(); }
});

$("fnbFile")?.addEventListener("change", async e=>{
  const f = e.target.files[0]; if(!f) return; e.target.value="";
  showLoadingCloud();
  try{
    $("fnbStatus").textContent = t("fnb_reading");
    const parsed = parseFnbLines(await pdfToLines(f));
    if (!parsed.users.length){ $("fnbStatus").textContent = "❌ " + t("fnb_err"); return; }
    const key = periodKey(parsed.from, parsed.to);
    await DB.set("fnb_reports", key, {...parsed, ts:Date.now(), savedOn:todayKey(), branch:curBranch()});
    const tot = parsed.users.reduce((s,u)=>s+u.qty,0);
    $("fnbStatus").textContent = "✅ " + t("fnb_ok",{n:parsed.users.length, k:fmt(tot)}) + ` · 📅 ${periodLabel(parsed.from,parsed.to)}`;
    toast(t("t_saved_fnb"));
    await loadFnbReports();
  }catch(err){ console.error(err); $("fnbStatus").textContent = "❌ " + t("err") + err.message; }
  finally{ hideLoading(); }
});

/* تجميع كل الفترات المرفوعة */
function ticketsByName(){
  const agg = {};
  (ticketReports||[]).forEach(r=>(r.users||[]).forEach(u=>{
    const a = agg[u.name] = agg[u.name] || {name:u.name, code:u.code, tickets:0, revenue:0};
    a.tickets += u.tickets||0; a.revenue += u.revenue||0;
  }));
  return agg;
}
function fnbByName(){
  const agg = {};
  (fnbReports||[]).forEach(r=>(r.users||[]).forEach(u=>{
    const a = agg[u.name] = agg[u.name] || {name:u.name, code:u.code, qty:0, gross:0, comboQty:0, comboGross:0, items:{}};
    a.qty += u.qty||0; a.gross += u.gross||0; a.comboQty += u.comboQty||0; a.comboGross += u.comboGross||0;
    (u.items||[]).forEach(it=>{
      const x = a.items[it.name] = a.items[it.name] || {name:it.name, qty:0, gross:0, combo:it.combo};
      x.qty += it.qty||0; x.gross += it.gross||0;
    });
  }));
  return agg;
}
function comboPointsFor(name){
  const u = fnbByName()[name];
  return u ? Math.floor((u.comboGross||0)/500)*COMBO_PTS_PER_500 : 0;
}
function empByName(name){
  const norm = s=>String(s).replace(/\s+/g," ").trim().toLowerCase();
  return employees.find(e=>norm(e.name)===norm(name))
      || employees.find(e=>norm(e.name).includes(norm(name)) || norm(name).includes(norm(e.name)))
      || null;
}
function boardAvatar(name){
  const emp = empByName(name);
  const av = emp?.photo ? `<img src="${emp.photo}" alt="">` : esc(String(name).trim()[0]||"?");
  return framedAvatarHTML(emp, `<div class="lbAvatar">${av}</div>`, 40);
}
function periodsMeta(reports){
  if (!reports?.length) return "";
  const froms = reports.map(r=>r.from).filter(Boolean).sort();
  const tos   = reports.map(r=>r.to).filter(Boolean).sort();
  return t("per_meta",{n:reports.length, from:froms[0]||"—", to:tos[tos.length-1]||"—"});
}

/* ============================================================
   تصنيف الأصناف + أبطال كل صنف (واجهة الموظف)
   الترتيب مهم: الكومبو أولاً حتى لا يُحسب "Hero Solo Combo" فشاراً.
   ============================================================ */
const FNB_CATS = [
  {id:"combo",   emo:"🎁", re:/(combo|duo|squad|bundle|meal|pack\b|mission)/i},
  {id:"popcorn", emo:"🍿", re:/(popcorn|pop\b|tub)/i},
  {id:"slush",   emo:"🧊", re:/slush/i},
  {id:"nachos",  emo:"🌮", re:/nacho/i},
  {id:"hotdog",  emo:"🌭", re:/(hot\s*dog|sandwich|burger)/i},
  {id:"snacks",  emo:"🍫", re:/(m&m|chocolate|candy|peanut|chips|gum|kitkat|galaxy|snickers|bounty|snack|cookie)/i},
  {id:"drinks",  emo:"🥤", re:/(coke|pepsi|sprite|fanta|water|arwa|juice|rani|vimto|schweppes|monster|energy|tea|coffee|float|cocktail|oz\b|ml\b)/i}
];
function catOf(name){
  const s = String(name||"");
  for (const c of FNB_CATS) if (c.re.test(s)) return c.id;
  return "other";
}
function catMeta(id){
  const c = FNB_CATS.find(x=>x.id===id);
  return {emo: c?c.emo:"🛍️", label: t("cat_"+id)};
}
/* لكل تصنيف: مجموعه العام + ترتيب الموظفين فيه */
function categoryChampions(){
  const agg = fnbByName();
  const cats = {};
  Object.values(agg).forEach(u=>{
    Object.values(u.items).forEach(it=>{
      const c = catOf(it.name);
      const m = cats[c] = cats[c] || {id:c, total:0, gross:0, byName:{}};
      m.total += it.qty||0; m.gross += it.gross||0;
      m.byName[u.name] = (m.byName[u.name]||0) + (it.qty||0);
    });
  });
  return Object.values(cats).map(m=>({
    id:m.id, total:+m.total.toFixed(2), gross:+m.gross.toFixed(2),
    list: Object.entries(m.byName).map(([name,qty])=>({name,qty:+qty.toFixed(2)}))
                                  .sort((a,b)=>b.qty-a.qty)
  })).filter(m=>m.total>0).sort((a,b)=>b.total-a.total);
}
function rankOf(list, name){
  const norm = s=>String(s).replace(/\s+/g," ").trim().toLowerCase();
  const i = list.findIndex(x=>norm(x.name)===norm(name));
  return i<0 ? null : {pos:i+1, qty:list[i].qty, of:list.length};
}
function myDisplayName(){ return session?.name || ""; }
function isMe(name){
  const norm = s=>String(s).replace(/\s+/g," ").trim().toLowerCase();
  const me = norm(myDisplayName()); const n = norm(name);
  return !!me && (me===n || me.includes(n) || n.includes(me));
}
function rkClass(pos){ return pos===1?"rk1":pos<=3?"rk2":"rk3"; }

function renderCatChampions(){
  const el = $("catChamps"); if (!el) return;
  const cats = categoryChampions();
  if (!cats.length){ el.innerHTML = emptyState("no_fnb","chart"); return; }
  el.innerHTML = cats.map((c,i)=>{
    const meta = catMeta(c.id);
    const king = c.list[0];
    const mine = rankOf(c.list, myDisplayName());
    const iAmKing = king && isMe(king.name);
    const meTag = mine
      ? `<div class="ccMe ${mine.pos===1?"top":""}">${mine.pos===1?t("cat_you_top"):t("cat_you_pos",{n:mine.pos,of:mine.of,q:fmt(mine.qty)})}</div>`
      : `<div class="ccMe">${t("cat_you_none")}</div>`;
    const rows = c.list.slice(0,8).map((x,j)=>`<div class="clRow ${isMe(x.name)?"meRow":""}">
        <span>${j<3?["🥇","🥈","🥉"][j]:j+1}</span><b>${esc(shownName(x.name))}</b><span>${fmt(x.qty)}</span></div>`).join("");
    return `<div class="champCard ${iAmKing?"mine":""}" style="animation-delay:${i*50}ms" onclick="this.classList.toggle('open')">
      <div class="ccEmo">${meta.emo}</div>
      <div class="ccCat">${esc(meta.label)}</div>
      <div class="ccWho">${king?boardAvatarSmall(king.name):""}<b>${king?esc(shownName(king.name)):"—"}</b></div>
      <div class="ccQty">${fmt(king?king.qty:0)} <span style="font-size:10.5px;color:var(--muted)">${t("fnb_unit")}</span></div>
      ${meTag}
      <div class="champList">${rows}</div>
    </div>`;
  }).join("");
}
function boardAvatarSmall(name){
  const emp = empByName(name);
  const av = emp?.photo ? `<img src="${emp.photo}" alt="">` : esc(String(name).trim()[0]||"?");
  return `<span class="lbAvatar" style="width:26px;height:26px;flex-shrink:0">${av}</span>`;
}

/* بطاقة "وين أنا" — مركزي في التذاكر والأكل والكومبو */
function renderMyBattle(){
  const el = $("myBattleBody"); if (!el) return;
  const name = myDisplayName();
  const tkts = Object.values(ticketsByName()).sort((a,b)=>b.tickets-a.tickets);
  const fnbs = Object.values(fnbByName()).sort((a,b)=>b.qty-a.qty);
  const combos = [...fnbs].sort((a,b)=>b.comboGross-a.comboGross);
  const rt = rankOf(tkts.map(x=>({name:x.name, qty:x.tickets})), name);
  const rf = rankOf(fnbs.map(x=>({name:x.name, qty:x.qty})), name);
  const rc = rankOf(combos.map(x=>({name:x.name, qty:x.comboGross})), name);
  if (!rt && !rf && !rc){ el.innerHTML = emptyState("battle_none","chart"); return; }
  const card = (val, unit, label, r) => `<div class="meCard">
      <div class="mv" style="color:var(--gold)">${fmt(val)}</div>
      <div class="ml">${label}</div>
      ${r?`<div class="mr ${rkClass(r.pos)}">${r.pos===1?"👑 "+t("cat_you_top"):t("me_rank",{n:r.pos,of:r.of})}</div>`:""}
    </div>`;
  const myF = fnbs.find(x=>isMe(x.name));
  const pts = myF ? Math.floor((myF.comboGross||0)/500)*COMBO_PTS_PER_500 : 0;
  el.innerHTML = `<div class="meStrip">
    ${card(rt?rt.qty:0, "", t("tkt_unit"), rt)}
    ${card(rf?rf.qty:0, "", t("fnb_unit"), rf)}
    ${card(myF?myF.comboQty:0, "", t("fnb_combo"), rc)}
    ${card(pts, "", t("pts_combo"), null)}
  </div>`;
}

function renderEmpBattle(){
  renderMyBattle();
  renderCatChampions();
}
function renderEmpBoards(){
  renderTicketBoardInto("eTktBoard","eTktMeta","eTktStats");
  renderFnbBoardInto("eFnbBoard","eFnbMeta","eFnbStats");
}

function renderTicketBoard(){ renderTicketBoardInto("tktBoard","tktMeta","tktStats"); }
function renderTicketBoardInto(boxId, metaId, statsId){
  const box = $(boxId); if(!box) return;
  const list = Object.values(ticketsByName()).sort((a,b)=>b.tickets-a.tickets || b.revenue-a.revenue);
  const max = list[0]?.tickets || 1;
  const totT = list.reduce((s,x)=>s+x.tickets,0);
  const totR = list.reduce((s,x)=>s+x.revenue,0);
  if ($(metaId)) $(metaId).textContent = periodsMeta(ticketReports);
  if ($(statsId)) $(statsId).innerHTML = list.length ? `
    <div class="stat"><div class="v" style="color:var(--gold)">${fmt(totT)}</div><div class="l">${t("tkt_total")}</div></div>
    <div class="stat"><div class="v">${fmt(list.length)}</div><div class="l">${t("tkt_sellers")}</div></div>
    <div class="stat"><div class="v" style="font-size:15px">${list[0]?esc(list[0].name):"—"}</div><div class="l">${t("tkt_top")} (${fmt(list[0]?.tickets||0)})</div></div>
    <div class="stat"><div class="v">${fmt(totR)}</div><div class="l">${t("sar")}</div></div>` : "";
  box.innerHTML = list.length ? list.map((s,i)=>{
    const medal = i<3 ? ["🥇","🥈","🥉"][i] : (i+1);
    return `<div class="lbRow r${i+1} ${isMe(s.name)?"meNow":""}" style="animation-delay:${i*60}ms">
      <div class="bar" style="width:${(s.tickets/max*100).toFixed(1)}%"></div>
      <div class="lbRank">${medal}</div>
      ${boardAvatar(s.name)}
      <div class="lbBody">
        <div class="lbName">${esc(shownName(s.name))}${verifyBadge(empByName(s.name))}</div>
        <div class="saleMini"><span>${t("th_code")}: ${esc(s.code||"—")}</span><span>${fmt(s.revenue)} ${t("sar")}</span></div>
      </div>
      <div class="saleBig" style="color:var(--gold)">${fmt(s.tickets)}<small>${t("tkt_unit")}</small></div>
    </div>`;
  }).join("") : emptyState("no_tkt","trophy");
}

function renderFnbBoard(){ renderFnbBoardInto("fnbBoard","fnbMeta","fnbStats"); }
function renderFnbBoardInto(boxId, metaId, statsId){
  const box = $(boxId); if(!box) return;
  const list = Object.values(fnbByName()).sort((a,b)=>b.qty-a.qty);
  const max = list[0]?.qty || 1;
  const king = [...list].sort((a,b)=>b.comboGross-a.comboGross)[0];
  const totQ = list.reduce((s,x)=>s+x.qty,0);
  const totC = list.reduce((s,x)=>s+x.comboGross,0);
  if ($(metaId)) $(metaId).textContent = periodsMeta(fnbReports);
  if ($(statsId)) $(statsId).innerHTML = list.length ? `
    <div class="stat"><div class="v" style="color:var(--gold)">${fmt(totQ)}</div><div class="l">${t("fnb_total_qty")}</div></div>
    <div class="stat"><div class="v">${fmt(list.reduce((s,x)=>s+x.gross,0))}</div><div class="l">${t("fnb_total_val")}</div></div>
    <div class="stat"><div class="v" style="font-size:15px">${king&&king.comboGross?esc(king.name):"—"}</div><div class="l">${t("fnb_king")}</div></div>
    <div class="stat"><div class="v">${fmt(totC)}</div><div class="l">${t("fnb_combo_val")}</div></div>` : "";
  box.innerHTML = list.length ? list.map((s,i)=>{
    const medal = i<3 ? ["🥇","🥈","🥉"][i] : (i+1);
    const pts = Math.floor((s.comboGross||0)/500)*COMBO_PTS_PER_500;
    const isKing = king && s.name===king.name && s.comboGross>0;
    const top = Object.values(s.items).sort((a,b)=>b.qty-a.qty)[0];
    return `<div class="lbRow r${i+1} ${isKing?"comboKing":""} ${isMe(s.name)?"meNow":""}" style="animation-delay:${i*60}ms">
      <div class="bar" style="width:${(s.qty/max*100).toFixed(1)}%"></div>
      <div class="lbRank">${medal}</div>
      ${boardAvatar(s.name)}
      <div class="lbBody">
        <div class="lbName">${esc(shownName(s.name))}${verifyBadge(empByName(s.name))} ${isKing?`<span class="pill a" style="font-size:10px">👑 ${t("fnb_king")}</span>`:""}</div>
        <div class="saleMini">
          <span>${fmt(s.gross)} ${t("sar")}</span>
          <span>🍿 ${t("fnb_combo")}: ${fmt(s.comboQty)} · ${fmt(s.comboGross)} ${t("sar")}</span>
          <span>✦ ${fmt(pts)} ${t("pts")}</span>
          ${top?`<span>${t("stat_top")}: ${esc(top.name)} (${fmt(top.qty)})</span>`:""}
        </div>
      </div>
      <div class="saleBig" style="color:var(--gold)">${fmt(s.qty)}<small>${t("fnb_unit")}</small></div>
    </div>`;
  }).join("") : emptyState("no_fnb","chart");
}

async function resetTicketBoard(){
  if (!confirm(t("c_reset_tkt"))) return;
  for (const r of ticketReports) await DB.del("ticket_reports", r.id);
  toast(t("t_lb_reset")); loadTicketReports();
}
async function resetFnbBoard(){
  if (!confirm(t("c_reset_fnb"))) return;
  for (const r of fnbReports) await DB.del("fnb_reports", r.id);
  toast(t("t_lb_reset")); loadFnbReports();
}

function salesByName(){
  const agg = {};
  sellerReports.forEach(r=>(r.sellers||[]).forEach(s=>{ agg[s.name]=(agg[s.name]||0)+s.amount; }));
  return agg;
}
function accPtsByCode(){
  const pts = {};
  allTasks.filter(x=>x.status==="done").forEach(x=>{ pts[x.empCode]=(pts[x.empCode]||0)+(x.points||0); });
  return pts;
}
function pointsFor(name, code){
  const sales = salesByName()[name]||0;
  const salesPts = Math.floor(sales/500)*10;
  const emp = code ? employees.find(e=>e.id===code) : employees.find(e=>e.name===name);
  const accPts = emp ? (accPtsByCode()[emp.id]||0) : 0;
  const bonusPts = emp?.bonusPts || 0;
  const spent = emp?.spentPts || 0;
  /* نقاط الكومبو: كل 500 ريال من مبيعات الكومبو = 100 نقطة */
  const comboPts = comboPointsFor(name);
  /* نقاط التقدير من الزملاء (Merit Money) تدخل ضمن الرصيد */
  const meritPts = emp ? meritReceivedBy(emp.id) : 0;
  const total = salesPts + accPts + bonusPts + comboPts + meritPts;
  return {sales, salesPts, accPts, bonusPts, comboPts, meritPts, total, spent, available: total - spent, color: emp?.nameColor || null};
}
/* ملصقات المتجر — تصاميم أصلية بألوان الأندية ورموز مستوحاة (وليست شعارات أو صور حقيقية محمية) */
/* ---------- إنجازات الماستر (Achievements) ---------- */
