/* ==========================================================
   Noir Cinema · 03-core-db.js
   الادوات · التخزين المحلي · PWA · Dexie · قاعدة البيانات
   تنبيه: ترتيب التحميل في index.html مهم - لا تغيره.
   ========================================================== */
/* ---------- tools ---------- */
const $ = id => document.getElementById(id);
function toast(msg){ const el=$("toast"); if(!el) return; el.textContent=msg; el.style.display="block"; clearTimeout(el._h); el._h=setTimeout(()=>el.style.display="none",3400); }
function todayKey(d=new Date()){ return d.toISOString().slice(0,10); }
function fmt(n){ return Number(n).toLocaleString("en-US",{maximumFractionDigits:2}); }
function fmtLastUpload(ts){
  if (!ts) return t("never_uploaded");
  const diffMin = Math.floor((Date.now()-ts)/60000);
  if (diffMin < 1) return t("just_now");
  if (diffMin < 60) return t("mins_ago",{n:diffMin});
  const diffH = Math.floor(diffMin/60);
  if (diffH < 24) return t("hours_ago",{n:diffH});
  const diffD = Math.floor(diffH/24);
  if (diffD === 1) return t("yesterday");
  return t("days_ago",{n:diffD});
}
async function renderCacheInfo(){
  const el = $("cacheInfo"); if (!el) return;
  const st = await IDB.stats();
  el.textContent = st
    ? `${fmt(st.docs)} ${t("cache_docs")} · ${Object.keys(st.cols).length} ${t("stat_products").toLowerCase()==="products"?"collections":"مجموعة"}`
    : "IndexedDB —";
}
async function clearLocalCache(){
  if (!confirm(t("cache_c"))) return;
  await IDB.clear();
  try{ if (window.caches){ const ks = await caches.keys(); await Promise.all(ks.map(k=>caches.delete(k))); } }catch(e){}
  await renderCacheInfo();
  toast("🗑 " + t("cache_cleared"));
}
function renderFileTimestamps(){
  const set = (id, ts) => { const el = $(id); if (el) el.textContent = fmtLastUpload(ts); };
  set("lastUp_inv", latestSnap?.ts);
  set("lastUp_sales", salesData?.ts);
  set("lastUp_top", sellerReports?.length ? Math.max(...sellerReports.map(r=>r.ts||0)) : null);
  const empdKeys = empSalesDetail ? Object.keys(empSalesDetail).sort() : [];
  const lastEmpd = empdKeys[empdKeys.length-1];
  set("lastUp_empd", lastEmpd ? empSalesDetail[lastEmpd]?.ts : null);
  renderCacheInfo();
  set("lastUp_cons",   consReports?.length   ? Math.max(...consReports.map(r=>r.ts||0))   : null);
  set("lastUp_ordStock", latestSnap?.ts || null);
  set("lastUp_ticket", ticketReports?.length ? Math.max(...ticketReports.map(r=>r.ts||0)) : null);
  set("lastUp_fnb",    fnbReports?.length    ? Math.max(...fnbReports.map(r=>r.ts||0))    : null);
  set("lastUp_grn", grnReports?.length ? Math.max(...grnReports.map(r=>r.ts||0)) : null);
  const perfKeys = perfReports ? Object.keys(perfReports).sort() : [];
  const lastPerfKey = perfKeys[perfKeys.length-1];
  set("lastUp_perf", lastPerfKey ? perfReports[lastPerfKey]?.uploadedAt : null);
  set("lastUp_branch", branchBudget?.uploadedAt);
  const finKeys = financeReports ? Object.keys(financeReports).sort() : [];
  const lastFinKey = finKeys[finKeys.length-1];
  set("lastUp_fin", lastFinKey ? financeReports[lastFinKey]?.uploadedAt : null);
  const bEl = $("branchDueBadge");
  if (bEl){
    if (!branchBudget?.uploadedAt){ bEl.textContent = t("no_upload_yet"); bEl.className = "pill a"; }
    else{
      const daysSince = Math.floor((Date.now()-branchBudget.uploadedAt)/86400000);
      const remain = 7 - daysSince;
      if (remain > 1){ bEl.textContent = t("days_until_due",{n:remain}); bEl.className = "pill g"; }
      else if (remain === 1){ bEl.textContent = t("due_tomorrow"); bEl.className = "pill a"; }
      else if (remain === 0){ bEl.textContent = t("due_today"); bEl.className = "pill a"; }
      else { bEl.textContent = t("upload_overdue",{n:-remain}); bEl.className = "pill r"; }
    }
  }
}
function esc(s){ return String(s).replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
function docId(s){ return String(s).replace(/[\/#?%\[\]\.]/g,"_"); }
function ico(n){ return `<svg class="ic"><use href="#i-${n}"/></svg>`; }
function emptyState(key, icon){ return `<div class="empty"><svg class="ic"><use href="#i-${icon||"box"}"/></svg><div>${t(key)}</div></div>`; }

/* ---------- storage: local-first + cloud sync ---------- */
let fs = null, cloudLive = false;
try{
  if (typeof firebase !== "undefined" && firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("PASTE")){
    firebase.initializeApp(firebaseConfig);
    fs = firebase.firestore();
    try{ fs.enablePersistence({synchronizeTabs:true}).catch(()=>{}); }catch(e){}
  }
}catch(e){ fs = null; }
/* المجموعات الثقيلة: تُقرأ من السحابة ولا تُنسخ كاملة في ذاكرة المتصفح،
   لأن حد localStorage ~5 ميجا وكان يمتلئ بصمت ويضيّع بيانات. */
const HEAVY_COLS = new Set([
  "inv_snapshots","performance_reports","finance_reports","grn_reports",
  "emp_sales_detail","seller_reports","ticket_reports","fnb_reports","consumption_reports","purchase_requests","recipes","price_list","perf_daily","perf_book","kudos","petty_cash","expiry_batches","results","tasks"
]);
/* أقصى عدد سجلات نحتفظ بها محلياً لكل مجموعة ثقيلة (الأحدث أولاً) */
const HEAVY_KEEP = 12;

function lsBytes(){
  let n = 0;
  try{ for (const k in localStorage) if (k.indexOf("noir_")===0) n += (localStorage[k]||"").length; }catch(e){}
  return n;
}
function lsEvict(exceptCol){
  /* عند امتلاء المساحة: نتخلّص من أثقل المجموعات أولاً */
  const cols = [];
  try{
    for (const k in localStorage){
      if (k.indexOf("noir_")!==0) continue;
      const col = k.slice(5);
      if (col === exceptCol || col.indexOf("tomb_")===0) continue;
      cols.push([col, (localStorage[k]||"").length]);
    }
  }catch(e){ return false; }
  cols.sort((a,b)=>b[1]-a[1]);
  if (!cols.length) return false;
  try{ localStorage.removeItem("noir_" + cols[0][0]); return true; }catch(e){ return false; }
}
function trimHeavy(col, obj){
  if (!HEAVY_COLS.has(col)) return obj;
  const keys = Object.keys(obj);
  if (keys.length <= HEAVY_KEEP) return obj;
  /* نرتب تنازلياً بالطابع الزمني إن وُجد، وإلا بالمفتاح (التواريخ نصياً تترتب صحيحاً) */
  keys.sort((a,b)=>{
    const ta = (obj[a]&&(obj[a].ts||obj[a].date))||a;
    const tb = (obj[b]&&(obj[b].ts||obj[b].date))||b;
    return ta<tb?1:ta>tb?-1:0;
  });
  const out = {};
  for (const k of keys.slice(0, HEAVY_KEEP)) out[k] = obj[k];
  return out;
}
const LS = {
  read(col){ try{ return JSON.parse(localStorage.getItem("noir_"+col)||"{}"); }catch(e){ return {}; } },
  write(col,k){
    const payload = JSON.stringify(trimHeavy(col, k));
    for (let attempt=0; attempt<4; attempt++){
      try{ localStorage.setItem("noir_"+col, payload); return true; }
      catch(e){ if (!lsEvict(col)) break; }
    }
    /* آخر محاولة: نحفظ نسخة مقلّمة جداً بدل فقدان كل شيء */
    try{
      const keys = Object.keys(k).slice(0,3), tiny = {};
      for (const kk of keys) tiny[kk] = k[kk];
      localStorage.setItem("noir_"+col, JSON.stringify(tiny));
    }catch(e){}
    return false;
  }
};
/* ذاكرة الجلسة: تمنع إعادة قراءة نفس المجموعة من Firestore عشرات المرات
   في نفس الجلسة (كانت أكبر مستهلك لحصة القراءات المجانية). */
const MEM = { data:{}, at:{}, TTL: 60000,
  fresh(col){ return this.at[col] && (Date.now()-this.at[col]) < this.TTL; },
  get(col){ return this.data[col]; },
  put(col,v){ this.data[col]=v; this.at[col]=Date.now(); },
  drop(col){ delete this.data[col]; delete this.at[col]; },
  clear(){ this.data={}; this.at={}; }
};
function setCloud(ok, e){
  cloudLive = ok;
  ["cloudDot","cloudDot2"].forEach(id=>{
    const n = $(id); if(!n) return;
    n.className = "cloudDot " + (ok?"on":"off");
    n.title = ok ? t("cloud_on") : t("cloud_off");
  });
  if (!ok && e && /permission|insufficient|denied/i.test(e.message||"")) $("rulesBanner")?.classList.remove("hidden");
  else if (ok){ $("rulesBanner")?.classList.add("hidden"); $("fbBanner")?.classList.add("hidden"); }
}
function isViewOnly(){ return !!(typeof session !== "undefined" && session && session.viewOnly); }
/* ---------- شواهد الحذف (Tombstones) ----------
   بدون هذا، أي جهاز ما زال يحتفظ بنسخة محلية من سجل محذوف كان يعيد رفعه
   للسحابة تلقائياً فيرجع اليوزر المحذوف من جديد. الشاهد يمنع ذلك نهائياً. */
const TOMB = {
  key(col){ return "noir_tomb_" + col; },
  read(col){ try{ return JSON.parse(localStorage.getItem(TOMB.key(col)) || "{}"); }catch(e){ return {}; } },
  write(col,k){ try{ localStorage.setItem(TOMB.key(col), JSON.stringify(k)); }catch(e){} },
  has(col,id){ return !!TOMB.read(col)[id]; },
  add(col,id){ const k = TOMB.read(col); k[id] = Date.now(); TOMB.write(col,k); },
  remove(col,id){ const k = TOMB.read(col); delete k[id]; TOMB.write(col,k); },
  async sync(col){
    if (!fs) return TOMB.read(col);
    try{
      const s = await fs.collection("_tombstones").doc(col).get();
      const cloud = (s.exists ? (s.data().ids || {}) : {});
      const local = TOMB.read(col);
      const merged = {...cloud, ...local};
      TOMB.write(col, merged);
      if (Object.keys(merged).length !== Object.keys(cloud).length){
        fs.collection("_tombstones").doc(col).set({ids: merged}).catch(()=>{});
      }
      return merged;
    }catch(e){ return TOMB.read(col); }
  },
  async push(col,id){
    TOMB.add(col,id);
    if (!fs) return;
    try{ await fs.collection("_tombstones").doc(col).set({ids: TOMB.read(col)}, {merge:true}); }catch(e){}
  }
};
/* ============================================================
   WORKBOX — تسجيل الـService Worker + حالة الاتصال + تحديث النسخة
   يحتاج sw.js و manifest.webmanifest بجانب index.html على نفس الدومين
   ============================================================ */
let swReg = null;
function initPWA(){
  if (!("serviceWorker" in navigator)) return;
  if (location.protocol === "file:"){                 /* لا يعمل من ملف محلي */
    console.info("[PWA] افتح الملف عبر https حتى يعمل العمل بدون إنترنت");
    return;
  }
  window.addEventListener("load", async ()=>{
    try{
      swReg = await navigator.serviceWorker.register("sw.js", {scope:"./"});
      swReg.addEventListener("updatefound", ()=>{
        const nw = swReg.installing; if (!nw) return;
        nw.addEventListener("statechange", ()=>{
          if (nw.state === "installed" && navigator.serviceWorker.controller) showUpdateBar();
        });
      });
    }catch(e){ console.info("[PWA] SW غير مسجَّل:", e.message); }
  });
  navigator.serviceWorker.addEventListener?.("controllerchange", ()=>{
    if (window.__noirReloading) return;
    window.__noirReloading = true; location.reload();
  });
}
function showUpdateBar(){
  if ($("swUpdate")) return;
  const d = document.createElement("div");
  d.id = "swUpdate"; d.className = "swBar";
  d.innerHTML = `<span>${esc(t("pwa_update"))}</span>
    <button class="btn small" onclick="applyUpdate()">${esc(t("pwa_update_btn"))}</button>
    <button class="btn ghost small" onclick="this.parentNode.remove()">✕</button>`;
  document.body.appendChild(d);
}
function applyUpdate(){
  try{ swReg?.waiting?.postMessage("SKIP_WAITING"); }catch(e){}
  setTimeout(()=>location.reload(), 400);
}
/* شريط "أنت غير متصل" — البيانات تُقرأ من Dexie */
function setNetBadge(){
  let b = $("netBadge");
  if (navigator.onLine){ b?.remove(); return; }
  if (b) return;
  b = document.createElement("div");
  b.id = "netBadge"; b.className = "netBar";
  b.innerHTML = `📴 ${esc(t("pwa_offline"))}`;
  document.body.appendChild(b);
}
window.addEventListener("online",  ()=>{ setNetBadge(); toast("🌐 " + t("pwa_back")); });
window.addEventListener("offline", ()=>{ setNetBadge(); });
initPWA();

/* ============================================================
   DEXIE — مخزن محلي دائم (IndexedDB) يكمّل مرآة localStorage
   الفائدة: المجموعات الثقيلة (تقارير، وصفات، إكسل الأداء) ما تدخل
   localStorage أصلاً لحد الـ5MB، فبدون هذا تضيع بالكامل عند انقطاع النت.
   ============================================================ */
const IDB = (()=>{
  let db = null, ready = false;
  try{
    if (typeof Dexie !== "undefined"){
      db = new Dexie("noir_cache");
      db.version(1).stores({ docs: "key, col, at", meta: "key" });
      ready = true;
    }
  }catch(e){ console.warn("Dexie init", e); ready = false; }
  const K = (col,id) => col + "\u0000" + id;
  return {
    get ok(){ return ready; },
    async put(col, id, data){
      if (!ready) return;
      try{ await db.docs.put({key:K(col,id), col, id, data, at:Date.now()}); }catch(e){}
    },
    async putMany(col, obj){
      if (!ready) return;
      try{
        const rows = Object.entries(obj).map(([id,data])=>({key:K(col,id), col, id, data, at:Date.now()}));
        if (rows.length) await db.docs.bulkPut(rows);
      }catch(e){}
    },
    async one(col, id){
      if (!ready) return null;
      try{ const r = await db.docs.get(K(col,id)); return r ? r.data : null; }catch(e){ return null; }
    },
    async all(col){
      if (!ready) return null;
      try{
        const rows = await db.docs.where("col").equals(col).toArray();
        if (!rows.length) return null;
        const out = {}; rows.forEach(r=>out[r.id] = r.data); return out;
      }catch(e){ return null; }
    },
    async drop(col, id){
      if (!ready) return;
      try{ await db.docs.delete(K(col,id)); }catch(e){}
    },
    async stats(){
      if (!ready) return null;
      try{
        const n = await db.docs.count();
        const cols = {};
        await db.docs.each(r=>{ cols[r.col] = (cols[r.col]||0)+1; });
        return {docs:n, cols};
      }catch(e){ return null; }
    },
    async clear(){ if (!ready) return; try{ await db.docs.clear(); }catch(e){} }
  };
})();

const DB = {
  async set(col, id, data){
    if (isViewOnly()){ try{ toast("👁 " + t("view_only_block")); }catch(e){} return; }
    TOMB.remove(col, id);
    const k = LS.read(col); k[id] = data; LS.write(col, k);
    IDB.put(col, id, data);                      /* نسخة دائمة تنجو من انقطاع النت */
    MEM.drop(col);
    if (fs){ try{ await fs.collection(col).doc(id).set(data); setCloud(true); }catch(e){ setCloud(false, e); } }
  },
  async get(col, id){
    if (TOMB.has(col, id)) return null;
    if (fs){
      try{
        const d = await fs.collection(col).doc(id).get(); setCloud(true);
        if (d.exists){ const v = d.data(); const k = LS.read(col); k[id]=v; LS.write(col,k); IDB.put(col,id,v); return v; }
      }catch(e){ setCloud(false, e); }
    }
    const k = LS.read(col);
    if (id in k) return k[id];
    return await IDB.one(col, id);               /* آخر نسخة محفوظة محلياً */
  },
  async list(col, opts){
    /* من ذاكرة الجلسة إن كانت طازجة — يوفّر قراءات Firestore */
    if (!(opts && opts.fresh) && MEM.fresh(col)) return MEM.get(col);
    const dead = await TOMB.sync(col);
    const local = LS.read(col);
    if (fs){
      try{
        const s = await fs.collection(col).get(); setCloud(true);
        const merged = {};
        s.docs.forEach(d=>{ if (!dead[d.id]) merged[d.id]=d.data(); else fs.collection(col).doc(d.id).delete().catch(()=>{}); });
        /* البيانات المحلية غير الموجودة سحابياً تُرفع — إلا المحذوفة نهائياً */
        for (const [id,v] of Object.entries(local)){
          if (dead[id]) continue;
          if (!(id in merged)){ merged[id]=v; fs.collection(col).doc(id).set(v).catch(()=>{}); }
        }
        LS.write(col, merged);
        IDB.putMany(col, merged);                 /* نسخة دائمة لكل المجموعة */
        const out = Object.entries(merged).map(([id,v])=>({id,...v}));
        MEM.put(col, out);
        return out;
      }catch(e){ setCloud(false, e); }
    }
    let out = {};
    for (const [id,v] of Object.entries(local)) if (!dead[id]) out[id]=v;
    if (!Object.keys(out).length){                /* المجموعات الثقيلة ما لها مرآة localStorage */
      const cached = await IDB.all(col);
      if (cached){ for (const [id,v] of Object.entries(cached)) if (!dead[id]) out[id]=v; }
    }
    LS.write(col, out);
    const arr = Object.entries(out).map(([id,v])=>({id,...v}));
    MEM.put(col, arr);
    return arr;
  },
  async del(col, id){
    if (isViewOnly()){ try{ toast("👁 " + t("view_only_block")); }catch(e){} return; }
    IDB.drop(col, id);
    await TOMB.push(col, id);
    const k = LS.read(col); delete k[id]; LS.write(col, k);
    MEM.drop(col);
    if (fs){ try{ await fs.collection(col).doc(id).delete(); }catch(e){ setCloud(false, e); } }
  },
  /* تنظيف الجردات القديمة: نبقي آخر KEEP_SNAPSHOTS يوماً فقط.
     بدونه كان حجم المجموعة ينمو بلا حد وكل تسجيل دخول يقرأها كاملة. */
  async pruneSnapshots(keep){
    keep = keep || KEEP_SNAPSHOTS;
    try{
      const all = await DB.list("inv_snapshots");
      if (all.length <= keep) return 0;
      const sorted = all.slice().sort((a,b)=>(a.date<b.date?1:a.date>b.date?-1:0));
      const drop = sorted.slice(keep);
      for (const snap of drop) await DB.del("inv_snapshots", snap.id);
      return drop.length;
    }catch(e){ return 0; }
  }
};

/* ---------- clock ---------- */
function isoWeek(d){
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(x.getUTCFullYear(),0,1));
  return Math.ceil((((x - y0) / 86400000) + 1) / 7);
}
function monthYearOf(d){
  const m = String(d).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return "";
  const mi = +m[2]-1;
  const name = LANG==="ar" ? AR_MONTHS[mi] : new Date(2000,mi,1).toLocaleDateString("en-GB",{month:"long"});
  return `${name} ${m[3]}`;
}
function fileMonthTag(from, to){
  const a = monthYearOf(from), b = monthYearOf(to);
  return a && b && a!==b ? `${a} → ${b}` : (a || b || "");
}
const AR_DAYS = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const AR_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
function tickClock(){
  const n = new Date();
  const time = n.toLocaleTimeString("en-GB");
  const date = LANG==="ar"
    ? `${AR_DAYS[n.getDay()]} ${n.getDate()} ${AR_MONTHS[n.getMonth()]} ${n.getFullYear()}م`
    : n.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  const wk = `${t("week")} ${isoWeek(n)} ${t("of_year")} ${n.getFullYear()}`;
  if($("bigTime")){ $("bigTime").textContent=time; $("bigDate").textContent=date; $("bigWeek").textContent=wk; }
  for(const [a,b] of [["miniTime","miniDate"],["miniTime2","miniDate2"]]){
    if($(a)){ $(a).textContent=time.slice(0,5); const bd=$(b); if(bd) bd.textContent=`${date} · ${t("wk")} ${isoWeek(n)}`; }
  }
}
setInterval(tickClock, 1000);

/* ---------- warehouses: order & labels ---------- */
function locRank(l){
  const s = String(l).toLowerCase();
  if (/^stores?$/.test(s) || s.includes("store") && !s.includes("mini")) return 0;
  if (s.includes("mini")) return 1;
  if (s.includes("refuel") || s.includes("refill")) return 2;
  return 3;
}
function sortLocs(arr){ return [...arr].sort((a,b)=>locRank(a)-locRank(b)); }
function locLabel(l){
  if (l === "Cinema Halls") return t("halls_label");
  const s = String(l).toLowerCase();
  if (s.includes("mini")) return t("loc_mini");
  if (s.includes("refuel") || s.includes("refill")) return t("loc_refuel");
  if (s.includes("store")) return t("loc_stores");
  return l;
}
function isRefuel(l){ const s=String(l).toLowerCase(); return s.includes("refuel")||s.includes("refill"); }

/* ---------- i18n apply ---------- */
function applyLang(){
  document.documentElement.lang = LANG;
  document.documentElement.dir = LANG === "ar" ? "rtl" : "ltr";
  if ($("langLbl")) $("langLbl").textContent = LANG === "ar" ? "EN" : "عربي";
  document.querySelectorAll("[data-i18n]").forEach(el=>{
    const k = el.dataset.i18n;
    if (k === "brand") el.innerHTML = t(k); else el.textContent = t(k);
  });
  document.querySelectorAll("[data-i18n-ph]").forEach(el=>el.placeholder = t(el.dataset.i18nPh));
  tickClock();
  rebuildSelects();
  rerenderAll();
}
function toggleSettings(id, ev){
  if (ev) ev.stopPropagation();
  const m = $(id); if (!m) return;
  const open = m.classList.contains("hidden");
  document.querySelectorAll(".setMenu").forEach(x=>x.classList.add("hidden"));
  if (open) m.classList.remove("hidden");
}
document.addEventListener("click", e=>{
  if (!e.target.closest(".setWrap")) document.querySelectorAll(".setMenu").forEach(x=>x.classList.add("hidden"));
});
function toggleLang(){ LANG = LANG === "ar" ? "en" : "ar"; try{localStorage.setItem("noir_lang", LANG);}catch(e){} applyLang(); }
function rerenderAll(){
  try{
    if (session?.role === "admin"){ renderInv(); renderAlerts(); renderPars(); renderSales(); renderLeaderboard(); renderEmpList(); renderPhotoApprovals(); renderSupList(); applySupUI(); renderTaskList(); renderResultsList(); renderExpiry(); renderExpPending(); renderExpStatus(); renderGRN(); }
    if (session?.role === "emp"){ renderMyTasks(); renderLeaderboard(); renderExpiryEmp(); renderEmpPoints(); renderShop(); }
  }catch(e){ console.warn(e); }
}
function rebuildSelects(){
  if (!session) return;
  if (session.role === "admin"){ fillWarehouseFilter(); fillTaskSelectors(); fillExpirySelectors(); fillParSelectors(); fillBranchSelector(); }
}

/* ---------- session ---------- */
let session = null;
async function doLogin(){
  const pin = $("pinInput").value.trim();
  $("loginErr").textContent = "";
  try{
    if (pin === ADMIN_CODE){ session = {role:"admin"}; await enterAdmin(); return; }
    if (/^\d{4}$/.test(pin)){
      const sup = await DB.get("supervisors", pin);
      if (sup){ session = {role:"admin", sup:true, viewOnly: !!sup.viewOnly, code:pin, name:sup.name, branch:sup.branch}; await enterAdmin(); return; }
      const emp = await DB.get("employees", pin);
      if (emp){ session = {role:"emp", code:pin, name:emp.name}; await enterEmp(); return; }
    }
    $("loginErr").textContent = t("login_err");
  }catch(e){ $("loginErr").textContent = t("err") + e.message; }
}
$("pinInput").addEventListener("keydown", e=>{ if(e.key==="Enter") doLogin(); });
function toggleCeoLogin(){
  const box = $("ceoLoginBox");
  const showingCeo = box.classList.contains("hidden"); /* about to show CEO fields */
  box.classList.toggle("hidden", !showingCeo);
  $("pinInput").classList.toggle("hidden", showingCeo);
  $("pinLoginBtn").classList.toggle("hidden", showingCeo);
  $("loginErr").textContent = "";
  const lbl = $("ceoLoginToggleLbl");
  lbl.textContent = t(showingCeo ? "login_as_pin" : "login_as_ceo");
  lbl.setAttribute("data-i18n", showingCeo ? "login_as_pin" : "login_as_ceo");
}
async function doCeoLogin(){
  const u = $("ceoUserLogin").value.trim(), p = $("ceoPassLogin").value;
  $("loginErr").textContent = "";
  try{
    const acc = await DB.get("ceo_account", "main");
    if (acc && u && p && acc.username === u && acc.password === p){
      session = {role:"ceo", name: "CEO"};
      await enterCeo();
      return;
    }
    $("loginErr").textContent = t("login_err_ceo");
  }catch(e){ $("loginErr").textContent = t("err") + e.message; }
}
function logout(){ location.reload(); }
function showLoading(msg){
  const el = $("loadingOverlay"); if (!el) return;
  el.classList.remove("hidden", "opening");
  if ($("loadingMsg")) $("loadingMsg").textContent = msg || t("loading_msg");
}
function showLoadingCloud(){
  const el = $("loadingOverlay"); if (!el) return;
  el.classList.remove("hidden", "opening");
  if ($("loadingMsg")) $("loadingMsg").textContent = "Please wait while loading...";
}
function hideLoading(){
  const el = $("loadingOverlay"); if (!el) return;
  el.classList.add("opening");
  setTimeout(()=>el.classList.add("hidden"), 1250);
}
async function enterAdmin(){
  $("loginView").style.display = "none";
  $("adminView").style.display = "block";
  document.body.classList.add("deskMode");
  setTimeout(buildSidebar, 50);
  $("adminView").classList.add("curtain");
  $("langFloat").classList.add("hidden");
  showLoading();
  try{
    if (!fs) $("fbBanner").classList.remove("hidden");
    await seedStaff();
    await loadSupervisors();
    applySupUI();
    await loadAdminProfile();
    await Promise.all([loadInventory(), loadSales(), loadLeaderboard(), loadEmployees(), loadTasks(), loadResults(), loadExpiry(), loadExpPending(), loadPars(), loadGRN(), loadPerfReports(), loadBranchBudget(), loadFinanceReports(), loadShopStickers(), loadEmpSalesDetail(), loadTicketReports(), loadFnbReports(), loadConsReports(), loadUOM(), loadPRs(), loadRecipes(), loadPriceList(), loadPerfDaily(), loadPerfBook(), loadKudos(), loadPetty(), loadSeasonTasks(), loadEom()]);
    if (!session.sup){
      purgeLegacyOnce().catch(()=>{});
      DB.pruneSnapshots().catch(()=>{});
    }
  } finally { hideLoading(); }
}
async function enterEmp(){
  $("loginView").style.display = "none";
  $("empView").style.display = "block";
  document.body.classList.add("phoneMode");
  $("langFloat").classList.add("hidden");
  showLoading();
  try{
    $("empWhoName").textContent = session.name;
    refreshEmpAvatar();
    await loadEmpDirectory(); /* صور وألوان كل الفريق تظهر للجميع */
    await Promise.all([loadMyTasks(), loadLeaderboard(), loadExpiry(), loadPerfReports(), loadShopStickers(), loadTeamStaff(), loadEmpSalesDetail(), loadTicketReports(), loadFnbReports(), loadSeasonTasks(), loadEom(), loadBranchBudget()]);
    renderLeaderboard();
    renderGreeting();
    renderMyActivity();
    renderMySales();
    renderEmpBoards();
    renderEmpBattle();
    renderRankBoards();
    updateMyBestRank();
    maybeAutoBranchStatus();
    applyNameColor();
    renderEmpPoints();
    await loadAdminProfile();
  } finally { hideLoading(); }
}
async function enterCeo(){
  $("loginView").style.display = "none";
  $("ceoView").style.display = "block";
  $("langFloat").classList.add("hidden");
  showLoading();
  try{
    await Promise.all([loadPerfReports(), loadBranchBudget(), loadInventory(), loadSales(), loadFinanceReports(), loadTicketReports(), loadFnbReports()]);
    renderCeoInventory();
    renderCeoSales();
  } finally { hideLoading(); }
}
function renderCeoInventory(){
  const body = $("ceoInvBody"); if (!body) return;
  if (!latestSnap){ body.innerHTML = `<tr><td colspan="3">${emptyState("no_inv","box")}</td></tr>`; return; }
  const q = ($("ceoInvSearch")?.value||"").toLowerCase();
  const rows = latestSnap.items
    .filter(i=>!q || i.name.toLowerCase().includes(q))
    .sort((a,b)=> locRank(a.loc)-locRank(b.loc) || a.name.localeCompare(b.name));
  body.innerHTML = rows.map(i=>`<tr><td>${esc(i.name)}</td><td><span class="pill">${esc(locLabel(i.loc))}</span></td><td class="num">${fmt(i.qty)}</td></tr>`).join("")
    || `<tr><td colspan="3">${emptyState("no_results_match","search")}</td></tr>`;
}
function renderCeoSales(){
  const body = $("ceoSalesBody"), stats = $("ceoSalesStats"); if (!body) return;
  if (!salesData){ body.innerHTML = `<tr><td colspan="4">${emptyState("no_sales","chart")}</td></tr>`; if(stats) stats.innerHTML=""; $("ceoSalesMeta").textContent=""; return; }
  $("ceoSalesMeta").textContent = `${t("period")}: ${salesData.from||t("from_start")} → ${salesData.to||t("to_now")} · ${t("updated")}: ${salesData.savedOn}`;
  const q = ($("ceoSalesSearch")?.value||"").toLowerCase();
  const total = salesData.rows.reduce((s,r)=>s+r.qty,0);
  const rows = salesData.rows.filter(r=>!q||r.name.toLowerCase().includes(q)).sort((a,b)=>b.qty-a.qty);
  body.innerHTML = rows.map((r,i)=>`<tr><td class="num">${i+1}</td><td>${esc(r.name)}</td>
    <td class="num">${fmt(r.qty)}</td><td class="num">${total?((r.qty/total*100).toFixed(1)+"%"):"—"}</td></tr>`).join("")
    || `<tr><td colspan="4">${emptyState("no_results_match","search")}</td></tr>`;
  const top = [...salesData.rows].sort((a,b)=>b.qty-a.qty)[0];
  if (stats) stats.innerHTML = `
    <div class="stat"><div class="v">${fmt(total)}</div><div class="l">${t("stat_total_units")}</div></div>
    <div class="stat"><div class="v">${salesData.rows.length}</div><div class="l">${t("stat_products")}</div></div>
    <div class="stat"><div class="v" style="font-size:14px">${top?esc(top.name):"—"}</div><div class="l">${t("stat_top")} (${top?fmt(top.qty):0})</div></div>`;
}
/* الانتقال لتبويب بالاسم (يُستخدم من الأزرار داخل الصفحات) */
function goTab(id){
  const b = document.querySelector(`#adminTabs .tab[data-p="${id}"]`);
  if (b) b.click();
}
function showTab(btn){
  document.querySelectorAll("#adminTabs .tab").forEach(x=>x.classList.remove("active"));
  btn.classList.add("active");
  ["pFiles","pInv","pRefill","pSales","pTop","pEmp","pTasks","pResults","pExpiry","pOrder","pCharts","pProfit","pGRN","pPerf","pBranches","pPetty","pFinance"].forEach(p=>$(p)?.classList.add("hidden"));
  const pane = $(btn.dataset.p);
  pane.classList.remove("hidden");
  syncSidebarActive();
  if (btn.dataset.p === "pOrder") renderOrderPage();
  if (btn.dataset.p === "pProfit") renderProfitPage();
  if (btn.dataset.p === "pCharts") setTimeout(renderCharts, 60);
  if (btn.dataset.p === "pPetty") renderPetty();
  pane.querySelectorAll(".card").forEach((c,i)=>{ c.classList.remove("rise"); void c.offsetWidth; c.style.animationDelay=(i*60)+"ms"; c.classList.add("rise"); });
}
