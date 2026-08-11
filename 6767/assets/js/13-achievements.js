/* ==========================================================
   Noir Cinema · 13-achievements.js
   الانجازات الالكترونية · الستريك · السيرة التلقائية
   تنبيه: ترتيب التحميل في index.html مهم - لا تغيره.
   ========================================================== */
const ACHIEVEMENTS = [
  {id:0, ar:"أعلى مبيعات كومبو كيدز", en:"Kids Combo Top Seller", dar:"محبوب الأطفال — الكومبو رقم واحد للعب والمرح", den:"Children's favorite \u2014 the #1 combo for play and fun"},
  {id:1, ar:"صرف عالي", en:"High Spend Achiever", dar:"أعلى متوسط صرف للعميل — 99%", den:"Highest average customer spend \u2014 99%"},
  {id:2, ar:"ضفاف ميامي", en:"The Miami Shores", dar:"إنجاز سلاش أكثر من 20 في الأسبوع", den:"Over 20 slushes in a week"},
  {id:3, ar:"دقة الصقر", en:"Falcon Precision", dar:"دقة متناهية في فحص تواريخ الانتهاء", den:"Razor-sharp expiry-date inspection"},
  {id:4, ar:"مستكشف المشاكل", en:"Problem Explorer", dar:"يكتشف المشاكل قبل أن تقع ويحلها", den:"Spots problems before they happen and solves them"},
  {id:5, ar:"عم المجال كولو", en:"Master of the Field", dar:"خمسة جردات ماستر متتالية", den:"Five consecutive master inventories"},
  {id:6, ar:"لديك عائلة جميلة", en:"A Beautiful Family", dar:"إنجاز بيع أكثر من 20 كومبو في الأسبوع", den:"Over 20 combos sold in a week"},
  {id:7, ar:"متربع على العرش", en:"King of the Throne", dar:"موظف الشهر ثلاث مرات", den:"Employee of the month \u2014 3 times"},
  {id:8, ar:"طاقة انفجارية", en:"Explosive Energy", dar:"نشاط وطاقة لا تتوقف", den:"Non-stop activity and energy"},
  {id:9, ar:"إنجاز عالمي", en:"Global Achievement", dar:"50 مراجعة جوجل", den:"50 Google reviews"},
  {id:10, ar:"حصان طروادة", en:"Trojan Horse", dar:"إنجاز خمسة مهام خلال يوم واحد", den:"Five tasks completed in a single day"},
  {id:11, ar:"أنا لا أرى منافسين", en:"Rival-Free Zone", dar:"فارق أكثر من 100 نقطة عن أقرب منافس", den:"100+ point margin over the nearest rival"},
  {id:12, ar:"كاسح الحشود", en:"Crowd Sweeper", dar:"إنجاز تنظيم الزوار — 10 مرات", den:"Visitor organization achievement \u2014 10 times"},
  {id:13, ar:"ليوناردو ديكابريو", en:"Leonardo DiCaprio", dar:"الفائز بأعلى مبيعات مقاعد VIP خلال شهر", den:"Highest VIP seat sales in a month"},
  {id:14, ar:"المهيمن الملك ميداس", en:"The Dominant King Midas", dar:"الفائز بأعلى مبيعات شهرية بين الموظفين", den:"Highest monthly sales among employees"},
  {id:15, ar:"كاش ولا شبكة", en:"Cash or Card", dar:"صفر أخطاء نقدية خلال فترة شهر", den:"Zero cash errors in a month"}
];
/* ============================================================
   الإنجازات الإلكترونية — تُمنح تلقائياً من مبيعات الموظف ومهامه
   ما تلمس الإنجازات اليدوية: الآلية موسومة auto:true فقط.
   ============================================================ */
function tasksDoneBy(code, type){
  return (allTasks||[]).filter(x=>x.status==="done" && x.empCode===code && (!type || x.type===type));
}
function catQtyOf(name, catId){
  const u = fnbByName()[name];
  if (!u) return 0;
  return Object.values(u.items).filter(i=>catOf(i.name)===catId).reduce((a,i)=>a+(i.qty||0),0);
}
function topNameOf(list){ return list.length ? list[0].name : null; }
/* قواعد المنح: كل قاعدة ترجع true/false للموظف */
const AUTO_RULES = {
  0:  emp => {   /* أعلى مبيعات كومبو كيدز */
        const scores = Object.values(fnbByName()).map(u=>({name:u.name,
          q: Object.values(u.items).filter(i=>/kid/i.test(i.name)).reduce((a,i)=>a+i.qty,0)}))
          .filter(x=>x.q>0).sort((a,b)=>b.q-a.q);
        return isSame(topNameOf(scores), emp.name); },
  2:  emp => catQtyOf(emp.name,"slush") >= 20,                      /* ضفاف ميامي */
  6:  emp => (fnbByName()[matchKey(emp.name)]?.comboQty||0) >= 20,   /* عائلة جميلة */
  3:  emp => tasksDoneBy(emp.id,"expiry").length >= 5,               /* دقة الصقر */
  5:  emp => tasksDoneBy(emp.id,"count").filter(x=>(x.mismatched||0)===0).length >= 5, /* عم المجال */
  10: emp => {                                                      /* حصان طروادة */
        const byDay = {};
        tasksDoneBy(emp.id).forEach(x=>{ const d=new Date(x.submittedAt).toISOString().slice(0,10); byDay[d]=(byDay[d]||0)+1; });
        return Object.values(byDay).some(n=>n>=5); },
  12: emp => tasksDoneBy(emp.id,"usher").length >= 10,               /* كاسح الحشود */
  13: emp => {                                                      /* ليوناردو — أعلى تذاكر */
        const l = Object.values(ticketsByName()).sort((a,b)=>b.tickets-a.tickets);
        return l.length>0 && isSame(l[0].name, emp.name); },
  14: emp => {                                                      /* ملك ميداس — أعلى مبيعات أكل */
        const l = Object.values(fnbByName()).sort((a,b)=>b.gross-a.gross);
        return l.length>0 && isSame(l[0].name, emp.name); },
  11: emp => {                                                      /* لا أرى منافسين */
        const l = employees.map(e=>({e, p:empSeasonPts(e)})).sort((a,b)=>b.p-a.p);
        return l.length>1 && l[0].e.id===emp.id && (l[0].p - l[1].p) >= 100; }
};
function isSame(a,b){
  if (!a || !b) return false;
  const n = x=>String(x).replace(/\s+/g," ").trim().toLowerCase();
  return n(a)===n(b) || n(a).includes(n(b)) || n(b).includes(n(a));
}
function matchKey(name){
  const agg = fnbByName();
  return Object.keys(agg).find(k=>isSame(k,name)) || name;
}
let autoAchvBusy = false;
async function syncAutoAchievements(){
  if (autoAchvBusy || !employees?.length) return;
  autoAchvBusy = true;
  try{
    for (const emp of employees){
      if (emp.ghost) continue;
      const list = achvList(emp);
      const manual = list.filter(x=>!x.auto);
      const earned = [];
      for (const [idStr, rule] of Object.entries(AUTO_RULES)){
        const id = +idStr;
        let ok = false;
        try{ ok = !!rule(emp); }catch(e){ ok = false; }
        if (!ok) continue;
        if (manual.some(x=>x.id===id)) continue;           /* ممنوح يدوياً — نتركه */
        const prev = list.find(x=>x.id===id && x.auto);
        earned.push({id, desc:"", auto:true, ts: prev?.ts || Date.now()});
      }
      const next = [...manual, ...earned];
      const same = next.length===list.length &&
                   next.every(n=>list.some(o=>o.id===n.id && !!o.auto===!!n.auto));
      if (same) continue;
      const fresh = await DB.get("employees", emp.id);
      if (!fresh) continue;
      await DB.set("employees", emp.id, {...fresh, achievements: next});
    }
    employees = await DB.list("employees").catch(()=>employees);
    renderLeaderboard?.(); renderEmpList?.(); renderVerifyList?.();
  }catch(e){ console.warn("auto achievements", e); }
  finally{ autoAchvBusy = false; }
}

/* ============================================================
   الستريك = عدد المهام المنجزة (يرتفع مع كل تاسك)
   ============================================================ */
function taskCountOf(emp){
  if (!emp) return 0;
  const live = tasksDoneBy(emp.id).length;
  return Math.max(live, emp.taskStreak||0);
}
/* فتح ستريك لكل موظف حسب مهامه المنجزة حالياً (تشغيل أول مرة وبعد كل مهمة) */
let streakSyncBusy = false;
async function syncTaskStreaks(){
  if (streakSyncBusy || !employees?.length || !(allTasks||[]).length) return;
  streakSyncBusy = true;
  try{
    for (const emp of employees){
      if (emp.ghost) continue;
      const n = tasksDoneBy(emp.id).length;
      if (n > (emp.taskStreak||0)){
        const fresh = await DB.get("employees", emp.id); if (!fresh) continue;
        await DB.set("employees", emp.id, {...fresh, taskStreak: n});
      }
    }
    employees = await DB.list("employees").catch(()=>employees);
    renderLeaderboard?.(); renderEmpList?.();
  }catch(e){ console.warn("streak sync", e); }
  finally{ streakSyncBusy = false; }
}

/* ============================================================
   السيرة الذاتية التلقائية + رسالة التحفيز
   تُبنى من المبيعات وتتغير مع كل تحديث ملفات
   ============================================================ */
function autoBioFor(name){
  const tags = [];
  const tk = Object.values(ticketsByName()).sort((a,b)=>b.tickets-a.tickets);
  const fb = Object.values(fnbByName()).sort((a,b)=>b.qty-a.qty);
  const cb = Object.values(fnbByName()).sort((a,b)=>b.comboGross-a.comboGross);
  const pos = (list, key) => {
    const i = list.findIndex(x=>isSame(x.name,name));
    return i<0 ? null : {pos:i+1, of:list.length, val:list[i][key]};
  };
  const rt = pos(tk,"tickets"), rf = pos(fb,"qty"), rc = pos(cb,"comboGross");
  if (rt?.pos===1) tags.push(t("bio_tkt_king",{n:fmt(rt.val)}));
  else if (rt && rt.pos<=3) tags.push(t("bio_tkt_top",{n:rt.pos}));
  if (rc?.pos===1 && rc.val>0) tags.push(t("bio_combo_king"));
  if (rf?.pos===1) tags.push(t("bio_fnb_king",{n:fmt(rf.val)}));
  categoryChampions().forEach(c=>{
    if (c.list[0] && isSame(c.list[0].name,name) && c.id!=="combo")
      tags.push(t("bio_cat_king",{c:catMeta(c.id).label}));
  });
  const emp = employees.find(e=>isSame(e.name,name));
  const done = emp ? tasksDoneBy(emp.id).length : 0;
  if (done >= 5) tags.push(t("bio_tasks",{n:done}));
  return tags;
}
/* الرسالة تتغير مع كل تحديث ملفات: نستخدم أحدث ts للتقارير كبذرة */
function dataSeed(){
  const ts = [...(ticketReports||[]), ...(fnbReports||[])].map(r=>r.ts||0);
  return ts.length ? Math.max(...ts) : 0;
}
function motivationFor(name){
  const tags = autoBioFor(name);
  const tk = Object.values(ticketsByName()).sort((a,b)=>b.tickets-a.tickets);
  const fb = Object.values(fnbByName()).sort((a,b)=>b.qty-a.qty);
  const iT = tk.findIndex(x=>isSame(x.name,name));
  const iF = fb.findIndex(x=>isSame(x.name,name));
  const pool = [];
  if (iT===0 || iF===0) pool.push("mot_top1","mot_top2","mot_top3");
  else if (iT===1 || iF===1){
    const gapT = iT===1 ? (tk[0].tickets - tk[1].tickets) : null;
    pool.push(gapT!==null ? t("mot_close",{n:fmt(gapT)}) : "mot_second", "mot_second");
  } else if (iT>1 || iF>1) pool.push("mot_climb1","mot_climb2","mot_climb3");
  else pool.push("mot_new1","mot_new2");
  const seed = dataSeed() + String(name).length;
  const pick = pool[seed % pool.length];
  const msg = /^mot_/.test(pick) ? t(pick) : pick;
  return {msg, tags};
}
function renderGreeting(){
  const el = $("empGreet"); if (!el || session?.role!=="emp") return;
  const {msg, tags} = motivationFor(session.name);
  const emp = employees.find(e=>e.id===session.code);
  const avatar = emp?.photo ? `<img src="${emp.photo}" alt="">` : esc((session.name||"?").trim()[0]);
  el.innerHTML = `<div class="greetCard">
      <div class="lbAvatar" style="width:52px;height:52px;flex-shrink:0">${avatar}</div>
      <div style="min-width:0;flex:1">
        <div class="greetName">${t("greet_hi")} <b>${esc(session.name)}</b> 👋</div>
        <div class="greetMsg">${esc(msg)}</div>
        ${tags.length?`<div class="greetTags">${tags.map(x=>`<span>${esc(x)}</span>`).join("")}</div>`:""}
      </div>
    </div>`;
}
function achvTitle(a){ return LANG==="ar" ? a.ar : a.en; }
function achvDefaultDesc(a){ return LANG==="ar" ? a.dar : a.den; }
/* توحيد شكل البيانات: القديمة كانت أرقام فقط، الجديدة {id, desc, ts} */
function achvList(emp){
  return (emp?.achievements||[]).map(x=> typeof x === "object" ? x : {id:x, desc:"", ts:null});
}
let achvPickerFor = null;
function openAchvPicker(code, name){
  achvPickerFor = code;
  const emp = employees.find(e=>e.id===code);
  const owned = new Map(achvList(emp).map(x=>[x.id, x]));
  $("achvPickerTitle").textContent = "🏅 " + t("achv_picker_title", {name});
  $("achvPickerBody").innerHTML = ACHIEVEMENTS.map(a=>{
    const has = owned.has(a.id);
    return `<div class="card" style="padding:10px;text-align:center;margin:0;${has?"border:1px solid var(--gold)":""}">
      <img src="${ACHIEVEMENT_IMG[a.id]}" alt="" style="width:84px;height:84px;object-fit:contain;margin:0 auto 6px;display:block;filter:drop-shadow(0 4px 12px rgba(245,197,66,.25))">
      <div style="font-size:11px;font-weight:700;min-height:28px">${esc(achvTitle(a))}</div>
      ${has ? `<div style="font-size:10px;color:var(--muted);min-height:24px">${esc(owned.get(a.id).desc || achvDefaultDesc(a))}</div>` : ""}
      <button class="btn ${has?"green":"ghost"} small" style="margin-top:6px;width:100%;justify-content:center" onclick="toggleAchievement('${code}',${a.id})">${has?"✓ "+t("achv_owned"):t("achv_give")}</button>
    </div>`;
  }).join("");
  $("achvPickerCard").classList.remove("hidden");
}
function closeAchvPicker(){ $("achvPickerCard").classList.add("hidden"); achvPickerFor = null; }
async function toggleAchievement(code, id){
  try{
    const emp = await DB.get("employees", code); if (!emp) return;
    const list = achvList(emp);
    const idx = list.findIndex(x=>x.id===id);
    if (idx > -1){
      if (!confirm(t("achv_remove_confirm"))) return;
      list.splice(idx,1);
    } else {
      const a = ACHIEVEMENTS.find(x=>x.id===id);
      const desc = prompt(t("achv_desc_prompt"), achvDefaultDesc(a));
      if (desc === null) return; /* المشرف تراجع */
      list.push({id, desc: desc.trim(), ts: Date.now()});
    }
    await DB.set("employees", code, {...emp, achievements:list});
    toast(idx>-1 ? t("t_achv_removed") : t("t_achv_given"));
    await loadEmployees(); renderLeaderboard();
    if (achvPickerFor===code) openAchvPicker(code, emp.name);
  }catch(e){ toast("❌ " + t("err") + e.message); }
}
function achvRowHTML(emp, size){
  const list = achvList(emp);
  if (!list.length) return "";
  const px = size||20;
  return `<span style="display:inline-flex;gap:3px;vertical-align:middle;margin-inline-start:6px">` +
    list.slice(0,6).map(x=>{
      const a = ACHIEVEMENTS.find(v=>v.id===x.id); if (!a) return "";
      return `<img src="${ACHIEVEMENT_IMG[x.id]}" title="${esc(achvTitle(a))}${x.desc?` — ${esc(x.desc)}`:""}" style="width:${px}px;height:${px}px;object-fit:contain">`;
    }).join("") + `</span>`;
}
/* ---------- ملف الموظف: بايو + ملخص شهري + الإنجازات ---------- */
function salesThisMonthFor(name){
  const now = new Date();
  const curM = now.getMonth()+1, curY = now.getFullYear();
  let sum = 0;
  for (const rep of (sellerReports||[])){
    const m = String(rep.from||"").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!m) continue;
    if (+m[2] === curM && +m[3] === curY){
      const s = (rep.sellers||[]).find(x=>x.name===name);
      if (s) sum += s.amount||0;
    }
  }
  return sum;
}
function openEmpProfile(code, scope){
  scope = scope || "";
  const emp = employees.find(e=>e.id===code); if (!emp) return;
  const $s = id => $(id + scope);
  const p = pointsFor(emp.name, emp.id);
  const monthSales = salesThisMonthFor(emp.name);
  const list = achvList(emp);
  const ghostLine = emp.ghost ? ` <span class="pill" style="font-size:10px;padding:2px 8px">📍 ${esc(emp.branch||"—")}</span>` : "";
  if ($s("empProfileTitle")) $s("empProfileTitle").innerHTML = `${emp.photo?`<img src="${emp.photo}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-inline-end:8px">`:""}<span style="${emp.nameColor?`color:${emp.nameColor}`:""}">${esc(emp.name)}</span>${ghostLine} ${taskStreakBadge(emp)}${stickerBadgeHTML(emp)}`;
  /* السيرة الذاتية التلقائية من المبيعات — تُعرض فوق النبذة المكتوبة */
  const autoTags = autoBioFor(emp.name);
  const autoHTML = autoTags.length
    ? `<div class="bioTags">${autoTags.map(x=>`<span>${esc(x)}</span>`).join("")}</div>` : "";
  if ($s("empProfileLvl")){
    const p = pointsFor(emp.name, emp.id);
    $s("empProfileLvl").innerHTML = levelCardHTML(p.total || 0) + activityGridHTML(emp.id);
  }
  if ($s("empProfileBio")) $s("empProfileBio").innerHTML = autoHTML + (emp.bio
    ? `<div style="font-size:13px;line-height:1.8;background:rgba(139,92,246,.06);border:1px solid var(--line);border-radius:12px;padding:10px 14px">💬 ${esc(emp.bio)}</div>`
    : (autoTags.length ? "" : `<div class="sub" style="margin:0">${t("no_bio_yet")}</div>`));
  const seasonPts = empSeasonPts(emp);
  const curRank = rankFor(seasonPts);
  const bestPts = Math.max(seasonPts, emp.bestRankPts||0);
  const bestRank = rankFor(bestPts);
  if ($s("empProfileStats")) $s("empProfileStats").innerHTML = `
    <div class="stat"><div class="v" style="font-size:15px;text-align:center;direction:inherit">${rankBadgeHTML(curRank)}<div style="font-family:'JetBrains Mono';font-size:15px;margin-top:5px;color:#fff">${fmt(seasonPts)}</div></div><div class="l">${t("rank_current")}</div></div>
    <div class="stat"><div class="v" style="font-size:15px;text-align:center;direction:inherit">${rankBadgeHTML(bestRank)}<div style="font-family:'JetBrains Mono';font-size:15px;margin-top:5px;color:#fff">${fmt(bestPts)}</div></div><div class="l">${t("rank_best")}</div></div>
    <div class="stat"><div class="v">${fmt(monthSales)}</div><div class="l">${t("profile_month_sales")}</div></div>
    <div class="stat"><div class="v">${fmt(p.sales)}</div><div class="l">${t("profile_total_sales")}</div></div>
    <div class="stat"><div class="v" style="color:var(--gold)">✦ ${fmt(p.available)}</div><div class="l">${t("pts_available")}</div></div>
    <div class="stat"><div class="v">🔥 ${fmt(taskCountOf(emp))}</div><div class="l">${t("task_streak_lbl")}</div></div>
    <div class="stat"><div class="v">🏅 ${list.length}</div><div class="l">${t("profile_achv_count")}</div></div>`;
  if ($s("empProfileAchv")) $s("empProfileAchv").innerHTML = list.length ? list.map(x=>{
    const a = ACHIEVEMENTS.find(v=>v.id===x.id); if (!a) return "";
    return `<div class="card" style="padding:12px;text-align:center;margin:0">
      <img src="${ACHIEVEMENT_IMG[x.id]}" alt="" style="width:120px;height:120px;object-fit:contain;margin:0 auto 8px;display:block;filter:drop-shadow(0 8px 24px rgba(245,197,66,.35))">
      <div style="font-size:12.5px;font-weight:800">${esc(achvTitle(a))}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:4px;line-height:1.6">${esc(x.desc || achvDefaultDesc(a))}</div>
      ${x.ts?`<div style="font-size:10px;color:var(--faint);margin-top:4px;direction:ltr">${new Date(x.ts).toLocaleDateString("en-GB")}</div>`:""}
    </div>`;
  }).join("") : emptyState("no_achievements","trophy");
  const qtyWrap = $s("empProfileQty");
  if (qtyWrap){
    const u = empDetailFor(emp.name);
    const doc = curMonthEmpDetail();
    qtyWrap.innerHTML = u
      ? `<div class="sub" style="margin:0 0 8px">${doc?.from||""} → ${doc?.to||""} · <b style="color:var(--gold)">${fmt(u.totalQty)}</b> ${t("empd_total_qty")}</div>` + empQtyTableHTML(u)
      : emptyState("empd_none_me","chart");
  }
  /* التاسكات المنجزة — تجلب بالخلفية بعد فتح البطاقة */
  const tWrap = $s("empProfileTasks");
  if (tWrap){
    if (emp.ghost){ tWrap.innerHTML = emptyState("profile_tasks_none","clip"); }
    else {
      tWrap.innerHTML = `<div class="sub" style="margin:0">⏳</div>`;
      DB.list("tasks").then(all=>{
        const done = (all||[]).filter(x=>x.empName===emp.name && x.status==="done").sort((a,b)=>(b.submittedAt||0)-(a.submittedAt||0));
        tWrap.innerHTML = done.length
          ? `<div class="sub" style="margin:0 0 8px"><b style="color:var(--green)">${done.length}</b> ${t("profile_tasks_count")}</div>` +
            done.slice(0,5).map(x=>`<div class="taskItem" style="margin-bottom:8px">
              <div><b>${x.type==="count"?t("count_task"):x.type==="usher"?t("usher_task"):t("expiry_task")}</b> — ${esc(locLabel(x.warehouse))}
                <div style="font-size:11.5px;color:var(--muted)">${new Date(x.submittedAt||0).toLocaleDateString("en-GB")}${x.points?` · <span style="color:var(--gold)">✦ ${x.points}</span>`:""}</div>
              </div><span class="pill g">✓</span></div>`).join("")
          : emptyState("profile_tasks_none","clip");
      }).catch(()=>{ tWrap.innerHTML = emptyState("profile_tasks_none","clip"); });
    }
  }
  if ($s("empProfileCard")){ $s("empProfileCard").classList.remove("hidden"); $s("empProfileCard").scrollIntoView?.({behavior:"smooth"}); }
}
function closeEmpProfile(scope){ $("empProfileCard"+(scope||"")).classList.add("hidden"); }
/* ---------- الموظفون الوهميون (منافسة فقط) ---------- */
async function addGhost(){
  const name = ($("ghName")?.value||"").trim();
  const branch = ($("ghBranch")?.value||"").trim();
  const pts = parseInt($("ghPts")?.value, 10) || 0;
  if (!name) return toast(t("ghost_need_name"));
  try{
    const id = "GH" + Date.now().toString(36);
    await DB.set("employees", id, {id, name, branch, bonusPts: pts, ghost: true});
    $("ghName").value = ""; $("ghBranch").value = ""; $("ghPts").value = "";
    toast("👻 " + t("t_ghost_added"));
    await loadEmployees(); renderLeaderboard();
  }catch(e){ toast("❌ " + t("err") + e.message); }
}
function renderGhostList(){
  const el = $("ghostList"); if (!el) return;
  const ghosts = employees.filter(e=>e.ghost);
  el.innerHTML = ghosts.length ? ghosts.map(g=>`
    <div class="taskItem">
      <div><b>${esc(g.name)}</b>
        <div style="font-size:12px;color:var(--muted)">📍 ${esc(g.branch||"—")} · <span style="color:var(--gold)">✦ ${fmt(g.bonusPts||0)} ${t("pts")}</span></div>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn ghost small" onclick="addBonusPoints('${g.id}','${esc(g.name)}')">✦ ${t("add_pts_btn")}</button>
        <button class="btn danger small" onclick="delEmployee('${g.id}')">${ico("x")}${t("del")}</button>
      </div>
    </div>`).join("") : `<div class="sub" style="margin:0">${t("ghost_none")}</div>`;
}
async function editMyBio(){
  try{
    const emp = await DB.get("employees", session.code); if (!emp) return;
    const bio = prompt(t("bio_prompt"), emp.bio||"");
    if (bio === null) return;
    await DB.set("employees", session.code, {...emp, bio: bio.trim().slice(0,220)});
    toast("✅ " + t("t_bio_saved"));
    await loadEmpDirectory();
  }catch(e){ toast("❌ " + t("err") + e.message); }
}

/* ---------- شعار نوار سينما + أعمال سكايلر ---------- */
const NOIR_LOGO = "data:image/webp;base64,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";
