/* ==========================================================
   Noir Cinema · 17-boot.js
   رفع الصور · المشرفون · سكايلر · الاقلاع
   تنبيه: ترتيب التحميل في index.html مهم - لا تغيره.
   ========================================================== */

/* ============================================================
   إصلاح رفع الصور: تحويل أي صورة إلى JPEG مضغوط عبر Canvas
   (الدالة كانت مستدعاة وغير معرّفة — هذا سبب فشل رفع صور الفريق)
   ============================================================ */
function fileToJpeg(file, opt = {}, quality = 0.8){
  return new Promise((resolve, reject)=>{
    if (!file) return reject(new Error("no file"));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = ()=>{
      try{
        let sw = img.naturalWidth, sh = img.naturalHeight;
        if (!sw || !sh) throw new Error("bad image");
        const px = opt.px || 320;
        let sx = 0, sy = 0, dw, dh;
        if (opt.square){
          const side = Math.min(sw, sh);
          sx = (sw - side) / 2; sy = (sh - side) / 2;
          sw = side; sh = side;
          dw = dh = Math.min(px, side);
        } else {
          const scale = Math.min(1, px / Math.max(sw, sh));
          dw = Math.max(1, Math.round(sw * scale));
          dh = Math.max(1, Math.round(sh * scale));
        }
        const canvas = document.createElement("canvas");
        canvas.width = dw; canvas.height = dh;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#111"; ctx.fillRect(0, 0, dw, dh);
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
        URL.revokeObjectURL(url);
        const data = canvas.toDataURL("image/jpeg", quality);
        if (!data || data.length < 60) return reject(new Error("encode failed"));
        resolve(data);
      }catch(e){ URL.revokeObjectURL(url); reject(e); }
    };
    img.onerror = ()=>{ URL.revokeObjectURL(url); reject(new Error("cannot read image")); };
    img.src = url;
  });
}

/* ============================================================
   المشرفون والفروع — الماستر ينشئ حساب مشرف لكل فرع بموقعه
   ============================================================ */
let supervisors = [];
/* فرع واحد فقط — تم إلغاء خيار الفروع الأخرى */
function curBranch(){ return "MAIN"; }
function branchLabel(b){ return (!b || b === "MAIN") ? t("branch_main") : b; }
function normalizeBranchInput(raw){
  const v = String(raw||"").replace(/\s+/g," ").trim();
  const low = v.toLowerCase();
  if (!v || low === "unaizah" || low === "عنيزة" || low === "main") return "MAIN";
  return v;
}
function snapKeyFor(branch, date){ return (!branch || branch === "MAIN") ? date : docId(branch) + "__" + date; }
function visibleEmps(){ return employees.filter(e=>!e.ghost); }
function filterBranchTasks(list){ return list; }

async function loadSupervisors(){ supervisors = await DB.list("supervisors"); renderSupList(); fillBranchSelector(); }
function renderSupList(){
  const el = $("supList"); if (!el) return;
  el.innerHTML = supervisors.length ? supervisors.map(s => `
    <div class="taskItem">
      <div style="display:flex;align-items:center;gap:10px;min-width:0">
        <div class="lbAvatar" style="width:36px;height:36px">${esc((s.name || "م").trim()[0])}</div>
        <div style="min-width:0"><b>${esc(s.name)}</b>
          <div style="font-size:12px;color:var(--muted)">${t("code")}: <span class="num">${s.id}</span> · ${s.viewOnly?` <span class="pill a">👁 ${t("view_only_badge")}</span>`:""}</div>
        </div>
      </div>
      <button class="btn danger small" onclick="delSupervisor('${s.id}')">${ico("x")}${t("del")}</button>
    </div>`).join("") : emptyState("no_sups", "users");
}
async function addSupervisor(){
  try{
    const name = $("supName").value.replace(/\s+/g, " ").trim();
    const code = $("supCode").value.trim();
    const branch = "MAIN";
    if (!name) return toast(t("t_name_req"));
    if (!/^\d{4}$/.test(code)) return toast(t("t_code4"));
    if (!branch) return toast(t("t_branch_req"));
    if (ADMIN_CODE.startsWith(code)) return toast(t("t_code_reserved"));
    if ((await DB.get("supervisors", code)) || (await DB.get("employees", code))) return toast(t("t_code_used"));
    const viewOnly = $("supViewOnly")?.value === "1";
    await DB.set("supervisors", code, {name, branch, viewOnly, createdAt: Date.now()});
    $("supName").value = ""; $("supCode").value = "";
    toast("✅ " + t("t_sup_added"));
    await loadSupervisors();
  }catch(e){ toast("❌ " + t("err") + e.message); }
}
async function delSupervisor(code){
  if (!confirm(t("c_del_sup"))) return;
  await DB.del("supervisors", code);
  loadSupervisors();
}
function fillBranchSelector(){ /* لا يوجد فروع متعددة */ }
async function switchBranch(){ /* لا يوجد فروع متعددة */ }
/* ---------- صلاحية "مُشاهد فقط": يرى كل شيء ولا يرفع أو يعدّل ---------- */
function applyViewOnlyUI(){
  /* 1) تعطيل كل حقول الرفع */
  document.querySelectorAll('#adminView input[type="file"]').forEach(i=>{ i.disabled = true; });
  /* 2) إخفاء مناطق الرفع والأزرار المعدِّلة */
  const hideSel = [
    "#adminView .drop",
    "#pFiles .card .toolRow .btn",
    "#empCard", "#taskCard", "#parCard", "#stickerAdminCard", "#ghostCard",
    "#achvPickerCard", "#stickerCropCard"
  ];
  hideSel.forEach(s=>document.querySelectorAll(s).forEach(el=>el.classList.add("hidden")));
  /* 3) تعطيل أي زر إجراء (حذف/إضافة/رفع/إرسال) مع إبقاء أزرار العرض والتحميل */
  const keep = /down|view|search|close|logout|lang|chat|tab|profile|perf_download|report/i;
  document.querySelectorAll("#adminView button").forEach(b=>{
    const oc = b.getAttribute("onclick") || "";
    if (!oc) return;
    if (keep.test(oc)) return;
    if (/^show(Tab|PerfDashboard|FinanceDashboard)|openEmpProfile|openSkylrProfile|toggleSettings|download|close/i.test(oc)) return;
    b.disabled = true; b.style.opacity = ".4"; b.style.pointerEvents = "none";
  });
  /* 4) شارة توضح الوضع */
  const badge = document.createElement("span");
  badge.className = "pill a";
  badge.style.marginInlineStart = "8px";
  badge.textContent = "👁 " + t("view_only_badge");
  $("adminView")?.querySelector(".who")?.appendChild(badge);
}
function applySupUI(){
  if (session?.sup){
    $("supCard")?.classList.add("hidden");
    $("branchBar")?.classList.add("hidden");
    $("ceoAccountCard")?.classList.add("hidden");
    $("perfHideBtn")?.classList.add("hidden");
    $("ghostCard")?.classList.add("hidden");
    if (session.viewOnly) applyViewOnlyUI();
    const nameEl = $("adminWhoName");
    if (nameEl){ nameEl.removeAttribute("data-i18n"); nameEl.textContent = session.name; }
    const roleSpan = document.querySelector('#adminView .who .role span[data-i18n="admin_role"]')
                  || document.querySelector('#adminView .who .role span:last-child');
    if (roleSpan){ roleSpan.removeAttribute("data-i18n"); roleSpan.textContent = t("sup_role", {b: branchLabel(session.branch)}); }
    const photoLbl = document.querySelector('#setMenuA .setItem span[data-i18n="set_admin_photo"]');
    if (photoLbl){ photoLbl.removeAttribute("data-i18n"); photoLbl.textContent = t("sup_own_photo"); }
  } else if (session?.role === "admin"){
    $("supCard")?.classList.remove("hidden");
    $("branchBar")?.classList.remove("hidden");
    $("ceoAccountCard")?.classList.remove("hidden");
    $("perfHideBtn")?.classList.remove("hidden");
    loadCeoAccountIntoForm();
  }
}

/* ============================================================
   ستريك نجم اليوم 🔥 — يتحدّث مع كل تقرير مبيعات يومي:
   أعلى موظف مبيعات أو مهام يحمل الشعلة، وتزيد بالتوالي كسناب
   ============================================================ */
let streakInfo = null;
async function updateStreak(parsed){
  try{
    const day = todayKey();
    const topSeller = [...(parsed?.sellers || [])].sort((a, b) => b.amount - a.amount)[0] || null;
    const doneToday = (await DB.list("tasks")).filter(x =>
      x.status === "done" && x.submittedAt &&
      new Date(x.submittedAt).toISOString().slice(0, 10) === day);
    const tp = {};
    doneToday.forEach(x => { tp[x.empName] = (tp[x.empName] || 0) + (x.points || (x.type === "usher" ? 50 : 0)); });
    const topTask = Object.entries(tp).sort((a, b) => b[1] - a[1])[0] || null;
    const sellerPts = topSeller ? Math.floor(topSeller.amount / 500) * 10 : -1;
    const taskPts = topTask ? topTask[1] : -1;
    if (sellerPts < 0 && taskPts < 0) return;
    const winner = (sellerPts >= taskPts)
      ? {name: topSeller.name, kind: "sales"}
      : {name: topTask[0], kind: "tasks"};
    const prev = await DB.get("streaks", "current");
    let count = 1;
    if (prev && prev.name === winner.name) count = (prev.day === day) ? (prev.count || 1) : (prev.count || 1) + 1;
    streakInfo = {name: winner.name, kind: winner.kind, count, day, ts: Date.now()};
    await DB.set("streaks", "current", streakInfo);
    toast(t("streak_toast", {name: winner.name, c: count}));
    renderLeaderboard();
    renderEmpList();
  }catch(e){ console.warn(e); }
}
function streakBadgeFor(name){
  return (streakInfo && streakInfo.name === name)
    ? `<span class="streakBadge" title="${t("streak_lbl")}">🔥 ${streakInfo.count}</span>` : "";
}
/* ---------- سلسلة إنجاز المهام اليومية لكل موظف — نار 🔥 تظهر فور إنهاء أي مهمة ---------- */
async function bumpEmployeeStreak(code){
  try{
    if (!code) return;
    const emp = await DB.get("employees", code); if (!emp) return;
    const day = todayKey();
    /* الستريك يرتفع مع كل تاسك — مو مرة واحدة باليوم */
    const taskStreak = (emp.taskStreak||0) + 1;
    await DB.set("employees", code, {...emp, taskStreak, lastTaskDay: day});
    employees = await DB.list("employees").catch(()=>employees);
    renderLeaderboard();
    if (typeof renderEmpList === "function") renderEmpList();
  }catch(e){ console.warn(e); }
}
function taskStreakBadge(emp){
  const n = (typeof taskCountOf === "function") ? taskCountOf(emp) : (emp?.taskStreak||0);
  if (!n) return "";
  return `<span class="streakBadge" title="${t("task_streak_lbl")}">🔥 ${n}</span>`;
}

/* ============================================================
   Skylr — صورة الأدمن + الحضور أونلاين ويظهر للجميع
   ============================================================ */
let adminProfile = null, supProfile = null;
async function loadAdminProfile(){
  adminProfile = (await DB.get("admin_profile", "main")) || {name: "Skylr"};
  supProfile = session?.sup ? ((await DB.get("supervisor_profiles", session.code)) || null) : null;
  paintAdminAvatar();
}
function paintAdminAvatar(){
  const av = $("adminAvatar");
  const myPhoto = session?.sup ? supProfile?.photo : adminProfile?.photo;
  if (av) av.innerHTML = myPhoto ? `<img src="${myPhoto}" alt="">` : (session?.sup ? esc((session.name||"م").trim()[0]) : "S");
  /* Skylr's own global avatar (used for master identity in chat/leaderboard) always reflects the master's photo only */
  const sa = $("skylrAvatar");
  if (sa) sa.innerHTML = adminProfile?.photo ? `<img src="${adminProfile.photo}" alt="">` : "S";
}
$("adminPhotoFile")?.addEventListener("change", async e=>{
  const f = e.target.files[0]; if (!f) return; e.target.value = "";
  try{
    const data = await fileToJpeg(f, {square: true, px: 110}, .68);
    if (session?.sup){
      const cur = (await DB.get("supervisor_profiles", session.code)) || {};
      supProfile = {...cur, name: session.name, photo: data, updatedAt: Date.now()};
      await DB.set("supervisor_profiles", session.code, supProfile);
      paintAdminAvatar();
      toast("✅ " + t("t_sup_photo_ok"));
    } else {
      const cur = (await DB.get("admin_profile", "main")) || {};
      adminProfile = {...cur, name: "Skylr", photo: data, updatedAt: Date.now()};
      await DB.set("admin_profile", "main", adminProfile);
      paintAdminAvatar();
      renderLeaderboard();
      renderEmpList();
      toast("✅ " + t("t_admin_photo_ok"));
    }
  }catch(err){ toast("❌ " + t("t_photo_bad")); }
});
let teamSupProfiles = {};
async function loadTeamStaff(){
  /* للموظف: جلب المشرفين وصورهم حتى يظهرون مع الفريق بلوحة الترتيب */
  try{
    supervisors = await DB.list("supervisors");
    const profs = await DB.list("supervisor_profiles");
    teamSupProfiles = {}; profs.forEach(p=>teamSupProfiles[p.id]=p);
  }catch(e){}
}
function skylrRowHTML(){
  if (!session) return "";
  const skylrClick = session.role === "emp" ? `style="cursor:pointer" onclick="openSkylrProfile()"` : "";
  let html = `<div class="taskItem" style="margin-bottom:10px;border-color:var(--gold)">
    <div style="display:flex;align-items:center;gap:10px;min-width:0" ${skylrClick}>
      <div class="lbAvatar" style="width:40px;height:40px">${adminProfile?.photo ? `<img src="${adminProfile.photo}" alt="">` : "S"}</div>
      <div style="min-width:0"><b style="color:var(--lav2)">Skylr</b> <span class="pill" style="font-size:10px;padding:2px 8px">⭐ ${t("role_master")}</span>
      </div>
    </div>
  </div>`;
  for (const s of (supervisors||[])){
    const photo = teamSupProfiles[s.id]?.photo;
    html += `<div class="taskItem" style="margin-bottom:10px;border-color:var(--line2)">
      <div style="display:flex;align-items:center;gap:10px;min-width:0">
        <div class="lbAvatar" style="width:40px;height:40px">${photo ? `<img src="${photo}" alt="">` : esc((s.name||"م").trim()[0])}</div>
        <div style="min-width:0"><b>${esc(s.name)}</b> <span class="pill" style="font-size:10px;padding:2px 8px">${t("role_sup")}</span>
        </div>
      </div>
    </div>`;
  }
  return html;
}

/* ============================================================
   تنظيف مرة واحدة: المجموعات القديمة (الشات، الإشعارات، التواجد)
   ما عادت مستخدمة — نحذفها من Firestore عشان ما تاكل مساحة ولا قراءات.
   تشتغل مرة وحدة لكل متصفح وبس للمشرف العام.
   ============================================================ */
const LEGACY_COLS = ["chats", "notifications", "presence"];
async function purgeLegacyOnce(){
  if (!fs) return;
  try{ if (localStorage.getItem("noir_legacy_purged") === "2") return; }catch(e){ return; }
  let removed = 0;
  for (const col of LEGACY_COLS){
    try{
      const snap = await fs.collection(col).limit(400).get();
      for (const d of snap.docs){ await d.ref.delete().catch(()=>{}); removed++; }
    }catch(e){ /* القاعدة غير موجودة أصلاً — عادي */ }
    try{ localStorage.removeItem("noir_" + col); }catch(e){}
  }
  try{ localStorage.setItem("noir_legacy_purged", "2"); }catch(e){}
  if (removed) console.info("[Noir] purged " + removed + " legacy docs");
}

/* ---------- boot ---------- */
Object.assign(window, {DB, EXPIRY_CATALOG, CATALOG_LOCS});
applyLang();
applyBrandLogo();
tickClock();
