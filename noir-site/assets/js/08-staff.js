/* ==========================================================
   Noir Cinema · 08-staff.js
   التوثيق · التقدير · المتجر · المستويات · شبكة النشاط
   تنبيه: ترتيب التحميل في index.html مهم - لا تغيره.
   ========================================================== */

/* ============================================================
   الهوية: التوثيق + الاسم المعروض
   المشرف يشوف الاسم الحقيقي + الرمز الوظيفي، والزملاء يشوفون الاسم المختار
   ============================================================ */
function isAdminView(){ return session?.role !== "emp"; }
function publicEmpName(emp){
  if (!emp) return "";
  return isAdminView() ? emp.name : (emp.displayName || emp.name);
}
/* الأسماء القادمة من تقارير المبيعات: نحوّلها للاسم المعروض عند الموظف */
function shownName(rawName){
  if (isAdminView()) return rawName;
  const e = empByName(rawName);
  return e?.displayName || rawName;
}
function verifyBadge(emp){
  return emp?.verified ? `<span class="vBadge" title="${t("vf_badge_t")}">✓</span>` : "";
}
async function toggleVerify(code){
  try{
    const emp = await DB.get("employees", code); if (!emp) return;
    const now = !emp.verified;
    if (now && !confirm(t("vf_confirm",{n:emp.name, c:code}))) return;
    await DB.set("employees", code, {...emp, verified: now,
      verifiedAt: now ? Date.now() : null, verifiedBy: now ? (session?.name||"") : null});
    await loadEmployees();
    renderVerifyList(); renderEmpList?.();
    toast(now ? "✓ " + t("vf_done") : t("vf_undone"));
  }catch(e){ toast("❌ " + t("err") + e.message); }
}
function renderVerifyList(){
  const el = $("verifyList"); if (!el) return;
  const list = employees.filter(e=>!e.ghost).sort((a,b)=>(a.verified?1:0)-(b.verified?1:0));
  if (!list.length){ el.innerHTML = emptyState("no_emps","users"); return; }
  el.innerHTML = `<div class="tableWrap"><table>
    <thead><tr><th>${t("vf_th_code")}</th><th>${t("vf_th_real")}</th><th>${t("vf_th_shown")}</th><th>${t("vf_th_state")}</th><th>${t("th_actions")}</th></tr></thead>
    <tbody>${list.map(e=>`<tr>
      <td class="num"><b style="font-family:var(--ff-num)">${esc(e.id)}</b></td>
      <td>${esc(e.name)}</td>
      <td>${e.displayName ? `<span style="color:var(--gold)">${esc(e.displayName)}</span> <span class="pill a" style="font-size:10px">${t("vf_alias")}</span>` : `<span style="color:var(--muted)">—</span>`}</td>
      <td>${e.verified
            ? `<span class="pill g">✓ ${t("vf_yes")}</span><div style="font-size:10.5px;color:var(--muted);margin-top:3px">${e.verifiedBy?esc(e.verifiedBy):""}</div>`
            : `<span class="pill r">${t("vf_no")}</span>`}</td>
      <td><button class="btn ${e.verified?"ghost":""} small" data-micron="tada" onclick="toggleVerify('${e.id}')">${e.verified?t("vf_revoke"):t("vf_do")}</button></td>
    </tr>`).join("")}</tbody></table></div>`;
}

/* ============================================================
   Open Kudos + Merit Money
   كل موظف عنده ميزانية شهرية يوزّعها على زملائه مع كلمة شكر،
   والنقاط الموزَّعة تُضاف لرصيد المستلم.
   ============================================================ */
const MERIT_BUDGET = 500;                 /* ميزانية كل موظف شهرياً */
const KUDOS_STEPS = [50, 100, 150, 250];
const KUDOS_TAGS = [
  {id:"teamwork", emo:"🤝"}, {id:"initiative", emo:"🚀"}, {id:"clean", emo:"🧹"},
  {id:"service",  emo:"😊"}, {id:"accuracy",   emo:"🎯"}, {id:"cover", emo:"🛟"}
];
let kudosList = [];
async function loadKudos(){ kudosList = await DB.list("kudos").catch(()=>[]); renderKudos(); }
function curMonthKey(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; }
function meritGivenBy(code, month){
  return kudosList.filter(k=>k.fromCode===code && k.month===(month||curMonthKey()))
                  .reduce((a,k)=>a+(k.pts||0),0);
}
function meritReceivedBy(code){
  return kudosList.filter(k=>k.toCode===code).reduce((a,k)=>a+(k.pts||0),0);
}
function meritLeft(code){ return Math.max(0, MERIT_BUDGET - meritGivenBy(code)); }
async function sendKudos(){
  try{
    const to  = $("kdTo")?.value;
    const pts = +($("kdPts")?.value || 0);
    const tag = $("kdTag")?.value || "teamwork";
    const msg = ($("kdMsg")?.value || "").trim();
    if (!to) return toast(t("kd_pick_who"));
    if (to === session.code) return toast(t("kd_not_self"));
    if (!pts) return toast(t("kd_pick_pts"));
    if (!msg) return toast(t("kd_need_msg"));
    const left = meritLeft(session.code);
    if (pts > left) return toast(t("kd_no_budget",{n:fmt(left)}));
    const target = employees.find(e=>e.id===to);
    await DB.set("kudos", "K"+Date.now(), {
      fromCode: session.code, fromName: session.name,
      toCode: to, toName: target?.name || "",
      pts, tag, msg, ts: Date.now(), month: curMonthKey(), branch: curBranch()
    });
    if ($("kdMsg")) $("kdMsg").value = "";
    await loadKudos();
    renderEmpPoints?.(); renderLeaderboard?.();
    toast("💜 " + t("kd_sent")); celebrate();
  }catch(e){ toast("❌ " + t("err") + e.message); }
}
function kudosNameOf(code, fallback){
  const e = employees.find(x=>x.id===code);
  return e ? publicEmpName(e) : (fallback || "—");
}
function renderKudos(){
  const box = $("kudosBody"); if (!box) return;
  const me = session?.code;
  const left = me ? meritLeft(me) : 0;
  const sel = $("kdTo");
  if (sel){
    const cur = sel.value;
    const mates = employees.filter(e=>!e.ghost && e.id !== me);
    sel.innerHTML = `<option value="">${t("kd_choose")}</option>` +
      mates.map(e=>`<option value="${esc(e.id)}">${esc(publicEmpName(e))}</option>`).join("");
    if (cur) sel.value = cur;
  }
  const ptsSel = $("kdPts");
  if (ptsSel && !ptsSel.dataset.filled){
    ptsSel.innerHTML = KUDOS_STEPS.map(v=>`<option value="${v}">${v} ${t("pts")}</option>`).join("");
    ptsSel.dataset.filled = "1";
  }
  const tagSel = $("kdTag");
  if (tagSel && !tagSel.dataset.filled){
    tagSel.innerHTML = KUDOS_TAGS.map(x=>`<option value="${x.id}">${x.emo} ${t("kd_"+x.id)}</option>`).join("");
    tagSel.dataset.filled = "1";
  }
  const bud = $("kdBudget");
  if (bud) bud.innerHTML = `
    <div class="kdBudget">
      <div><b>${fmt(left)}</b> / ${fmt(MERIT_BUDGET)}</div>
      <div class="kdBar"><i style="width:${(left/MERIT_BUDGET*100).toFixed(0)}%"></i></div>
      <div class="sub" style="margin:6px 0 0">${t("kd_budget_note")}</div>
    </div>`;
  const feed = [...kudosList].sort((a,b)=>(b.ts||0)-(a.ts||0)).slice(0, 40);
  box.innerHTML = feed.length ? feed.map(k=>{
    const tag = KUDOS_TAGS.find(x=>x.id===k.tag) || KUDOS_TAGS[0];
    const mine = k.toCode === me;
    return `<div class="kdCard ${mine?"mine":""}">
      <div class="kdTop">
        <span class="kdFrom">${esc(kudosNameOf(k.fromCode, k.fromName))}</span>
        <span class="kdArrow">→</span>
        <span class="kdTo">${esc(kudosNameOf(k.toCode, k.toName))}</span>
        <span class="kdPts">✦ ${fmt(k.pts)}</span>
      </div>
      <div class="kdMsg">${tag.emo} ${esc(k.msg)}</div>
      <div class="kdTag">${t("kd_"+tag.id)} · ${new Date(k.ts).toLocaleDateString("en-GB")}</div>
    </div>`;
  }).join("") : emptyState("kd_none","users");
}

/* ============================================================
   المتجر: بطاقة الاسم · اختيار الشفت · الأولوية · بكجات الحظ
   ============================================================ */
const PERK_PRICES = {name_card: 3000, shift: 10000, priority: 10000};
const PACK_PRICE = 500;
/* جدول الحظ: الاحتمال ومدى النقاط */
/* متوسط العائد ~٨٧٪ من السعر: البكج تسلية ومخاطرة، مو مصدر نقاط —
   النقاط الحقيقية تظل من الشغل، وإلا انهار معنى الترتيب والمتجر */
const PACK_TABLE = [
  {w:45, min:100,  max:250,  cls:"bad",  emo:"🌫️"},
  {w:32, min:280,  max:450,  cls:"ok",   emo:"✨"},
  {w:15, min:550,  max:850,  cls:"good", emo:"💎"},
  {w:6,  min:1000, max:1500, cls:"rare", emo:"👑"},
  {w:2,  min:3000, max:3000, cls:"jack", emo:"🎰"}
];
const PACK_DAILY_MAX = 5;                 /* سقف يومي يمنع الإدمان والتفريغ */
function packsToday(emp){
  const d = todayKey();
  return (emp?.packs||[]).filter(x=>new Date(x.ts).toISOString().slice(0,10)===d).length;
}
function rollPack(){
  const total = PACK_TABLE.reduce((a,x)=>a+x.w,0);
  let r = Math.random()*total;
  for (const row of PACK_TABLE){ r -= row.w; if (r <= 0) return row; }
  return PACK_TABLE[0];
}
async function buyPack(){
  try{
    const p = pointsFor(session.name, session.code);
    if (p.available < PACK_PRICE) return toast(t("t_no_pts",{n:fmt(PACK_PRICE-p.available)}));
    const emp = await DB.get("employees", session.code);
    if (packsToday(emp) >= PACK_DAILY_MAX) return toast(t("pack_daily",{n:PACK_DAILY_MAX}));
    const row = rollPack();
    const won = Math.round(row.min + Math.random()*(row.max-row.min));
    await DB.set("employees", session.code, {...emp,
      spentPts: (emp.spentPts||0) + PACK_PRICE,
      bonusPts: (emp.bonusPts||0) + won,
      packs: [...(emp.packs||[]), {ts:Date.now(), paid:PACK_PRICE, won}].slice(-40)
    });
    await loadEmpDirectory();
    showPackResult(row, won);
    renderShop(); renderEmpPoints();
    if (won >= 1800) celebrate("big"); else if (won > PACK_PRICE) celebrate();
  }catch(e){ toast("❌ " + t("err") + e.message); }
}
function showPackResult(row, won){
  const net = won - PACK_PRICE;
  const el = $("packResult"); if (!el) return;
  el.innerHTML = `<div class="packBox ${row.cls}">
      <div class="packEmo">${row.emo}</div>
      <div class="packWon">✦ ${fmt(won)}</div>
      <div class="packNet ${net>=0?"up":"down"}">${net>=0?"+":""}${fmt(net)} ${t("pack_net")}</div>
    </div>`;
  if (typeof micron !== "undefined"){ try{ micron.getEle(".packBox").interaction("tada").duration(.7).trigger(); }catch(e){} }
}
async function buyPerk(kind){
  try{
    const price = PERK_PRICES[kind]; if (!price) return;
    const p = pointsFor(session.name, session.code);
    if (p.available < price) return toast(t("t_no_pts",{n:fmt(price-p.available)}));
    if (!confirm(t("perk_confirm",{n:fmt(price)}))) return;
    const emp = await DB.get("employees", session.code);
    const perks = new Set(emp.perks||[]); perks.add(kind);
    await DB.set("employees", session.code, {...emp, perks:[...perks], spentPts:(emp.spentPts||0)+price});
    await loadEmpDirectory();
    toast("🎉 " + t("perk_bought")); celebrate("big");
    renderShop(); renderEmpPoints();
    if (kind === "name_card") setMyDisplayName();
  }catch(e){ toast("❌ " + t("err") + e.message); }
}
function hasPerk(kind){
  const emp = employees.find(e=>e.id===session?.code);
  return !!(emp?.perks||[]).includes(kind);
}
async function setMyDisplayName(){
  if (!hasPerk("name_card")) return toast(t("perk_need_card"));
  const emp = employees.find(e=>e.id===session.code);
  const v = prompt(t("name_prompt"), emp?.displayName || emp?.name || "");
  if (v === null) return;
  const name = v.trim().slice(0, 24);
  try{
    const fresh = await DB.get("employees", session.code);
    await DB.set("employees", session.code, {...fresh, displayName: name || null});
    await loadEmpDirectory();
    toast(name ? "✅ " + t("name_saved") : t("name_cleared"));
    renderShop(); renderGreeting?.(); renderEmpBoards?.(); renderKudos();
  }catch(e){ toast("❌ " + t("err") + e.message); }
}
async function setMyShift(){
  if (!hasPerk("shift")) return toast(t("perk_need_shift"));
  const cur = employees.find(e=>e.id===session.code)?.prefShift || "";
  const v = prompt(t("shift_prompt"), cur);
  if (v === null) return;
  try{
    const fresh = await DB.get("employees", session.code);
    await DB.set("employees", session.code, {...fresh, prefShift: v.trim().slice(0,40) || null});
    await loadEmpDirectory();
    toast("✅ " + t("shift_saved")); renderShop();
  }catch(e){ toast("❌ " + t("err") + e.message); }
}

/* ============================================================
   score.js — مستويات وألقاب للموظف حسب نقاطه
   ============================================================ */
const NOIR_LEVELS = [
  {checkmark:0,    status:"level_1", quote:"q1"},
  {checkmark:150,  status:"level_2", quote:"q2"},
  {checkmark:400,  status:"level_3", quote:"q3"},
  {checkmark:800,  status:"level_4", quote:"q4"},
  {checkmark:1400, status:"level_5", quote:"q5"},
  {checkmark:2200, status:"level_6", quote:"q6"},
  {checkmark:3200, status:"level_7", quote:"q7"},
  {checkmark:4500, status:"level_8", quote:"q8"},
  {checkmark:6000, status:"level_9", quote:"q9"},
  {checkmark:8000, status:"level_10",quote:"q10"}
];
const LEVEL_ICONS = ["🌱","🎬","🍿","⭐","🔥","💎","👑","🚀","🏆","🌟"];
let _scoreEngine = null;
function scoreEngine(){
  if (_scoreEngine) return _scoreEngine;
  if (typeof Score === "undefined") return null;
  /* persistant:false لأن النقاط عندنا محسوبة من بياناتنا مو من localStorage */
  _scoreEngine = new Score({persistant:false, levels: NOIR_LEVELS});
  return _scoreEngine;
}
/* بطاقة المستوى لأي عدد نقاط */
function scorecardFor(points){
  const eng = scoreEngine();
  if (!eng){                                  /* احتياط لو ما حُمّلت المكتبة */
    let lvl = 1;
    NOIR_LEVELS.forEach((l,i)=>{ if (points >= l.checkmark) lvl = i+1; });
    return {score:points, level:lvl, totallevels:NOIR_LEVELS.length,
            status:NOIR_LEVELS[lvl-1].status, quote:NOIR_LEVELS[lvl-1].quote,
            levelprogress:0, totalprogress:0, levelscore:0, leveltotal:0};
  }
  eng.set(points);
  return eng.scorecard();
}
function levelCardHTML(points){
  const c = scorecardFor(points);
  const icon = LEVEL_ICONS[Math.min(LEVEL_ICONS.length-1, (c.level||1)-1)];
  const next = NOIR_LEVELS[c.level] ? NOIR_LEVELS[c.level].checkmark - points : 0;
  return `<div class="lvlCard">
    <div class="lvlIco">${icon}</div>
    <div style="flex:1;min-width:0">
      <div class="lvlTop">
        <span class="lvlTitle">${esc(t(c.status))}</span>
        <span class="lvlNum">${t("lvl_of",{n:c.level, of:c.totallevels||10})}</span>
      </div>
      <div class="lvlQuote">${esc(t(c.quote))}</div>
      <div class="lvlBar"><i style="width:${Math.max(2,Math.min(100, c.levelprogress||0)).toFixed(1)}%"></i></div>
      <div class="lvlFoot">
        <span>${fmt(points)} ${t("pts")}</span>
        <span>${next > 0 ? t("lvl_next",{n:fmt(next)}) : t("lvl_max")}</span>
      </div>
    </div>
  </div>`;
}
/* احتفال عند صعود المستوى — يُخزَّن آخر مستوى شوفه الموظف */
function checkLevelUp(points){
  if (session?.role !== "emp") return;
  const c = scorecardFor(points);
  let seen = 0;
  try{ seen = +(localStorage.getItem("noir_lvl_seen") || 0); }catch(e){}
  if (c.level > seen){
    try{ localStorage.setItem("noir_lvl_seen", c.level); }catch(e){}
    if (seen > 0){ celebrate(); toast("🎉 " + t("lvl_up",{n:esc(t(c.status))})); }
  }
}
/* canvas-confetti */
function celebrate(power){
  if (typeof confetti !== "function") return;
  const n = power === "big" ? 160 : 90;
  const colors = ["#8B5CF6","#FBBF24","#34D399","#F472B6","#60A5FA"];
  confetti({particleCount:n, spread:78, origin:{y:.65}, colors, disableForReducedMotion:true});
  if (power === "big"){
    setTimeout(()=>confetti({particleCount:70, angle:60, spread:60, origin:{x:0, y:.7}, colors, disableForReducedMotion:true}), 220);
    setTimeout(()=>confetti({particleCount:70, angle:120, spread:60, origin:{x:1, y:.7}, colors, disableForReducedMotion:true}), 340);
  }
}

/* ============================================================
   شبكة النشاط (activity grid) — مربعات على طريقة GitHub
   مبنية داخلياً بدون مكتبة خارجية: CSS Grid فقط، تدعم RTL والثيم الداكن
   ============================================================ */
const AG_WEEKS = 26;
function activityCounts(empCode){
  const map = {};
  (allTasks||[]).forEach(x=>{
    if (x.status !== "done" || !x.submittedAt) return;
    if (empCode && x.empCode !== empCode) return;
    const d = new Date(x.submittedAt);
    const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    map[k] = (map[k]||0) + 1;
  });
  return map;
}
function agLevel(n){ return n<=0?0 : n===1?1 : n===2?2 : n<=4?3 : 4; }
function activityGridHTML(empCode){
  const counts = activityCounts(empCode);
  const today = new Date(); today.setHours(12,0,0,0);
  const end = new Date(today); end.setDate(end.getDate() + (6 - end.getDay()));   /* نهاية أسبوع اليوم */
  const start = new Date(end); start.setDate(start.getDate() - (AG_WEEKS*7 - 1));
  const cells = [], monthMarks = [];
  let total = 0, best = 0, streak = 0, run = 0;
  for (let w=0; w<AG_WEEKS; w++){
    const col = [];
    for (let dw=0; dw<7; dw++){
      const d = new Date(start); d.setDate(start.getDate() + w*7 + dw);
      const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      const n = d > today ? -1 : (counts[k]||0);
      if (n > 0){ total += n; run++; if (run > best) best = run; }
      else if (n === 0) run = 0;
      col.push({k, n, future: d > today, day: d.getDate(), mon: d.getMonth()});
      if (dw === 0) monthMarks.push(d.getDate() <= 7 ? MON_EN[d.getMonth()] : "");
    }
    cells.push(col);
  }
  streak = run;
  const grid = cells.map(col=>`<div class="agCol">${col.map(c=>
      c.future ? `<i class="agCell future"></i>`
               : `<i class="agCell l${agLevel(c.n)}" title="${c.k} · ${c.n} ${t("ag_tasks")}"></i>`
    ).join("")}</div>`).join("");
  return `<div class="agWrap" dir="ltr">
      <div class="agMonths">${monthMarks.map(m=>`<span>${m}</span>`).join("")}</div>
      <div class="agGrid">${grid}</div>
      <div class="agFoot">
        <span>${t("ag_less")}</span>
        <i class="agCell l0"></i><i class="agCell l1"></i><i class="agCell l2"></i><i class="agCell l3"></i><i class="agCell l4"></i>
        <span>${t("ag_more")}</span>
      </div>
    </div>
    <div class="agStats">
      <span>✅ <b>${fmt(total)}</b> ${t("ag_total")}</span>
      <span>🔥 <b>${fmt(streak)}</b> ${t("ag_streak")}</span>
      <span>🏅 <b>${fmt(best)}</b> ${t("ag_best")}</span>
    </div>`;
}
function renderMyActivity(){
  const el = $("myActivity"); if (!el || session?.role !== "emp") return;
  el.innerHTML = activityGridHTML(session.code);
  const lv = $("myLevel");
  if (lv){
    const pts = pointsFor(session.name, session.code);
    lv.innerHTML = levelCardHTML(pts.total || 0);
    checkLevelUp(pts.total || 0);
  }
}
