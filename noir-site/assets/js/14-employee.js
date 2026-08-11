/* ==========================================================
   Noir Cinema · 14-employee.js
   شاشات الموظف · الملف · الكروبر · المهام · النتائج
   تنبيه: ترتيب التحميل في index.html مهم - لا تغيره.
   ========================================================== */
function applyBrandLogo(){
  document.querySelectorAll(".brandLogoImg").forEach(i=>{ i.src = NOIR_LOGO; });
}
function openSkylrProfile(){
  const card = $("skylrProfileCard"); if (!card) return;
  const av = $("skylrProfileAvatar");
  if (av) av.innerHTML = adminProfile?.photo ? `<img src="${adminProfile.photo}" alt="">` : `<img src="${NOIR_LOGO}" alt="" style="object-fit:contain;padding:6px;background:#f6f3fc">`;
  $("skylrWorksBody").innerHTML = SKYLR_WORKS.map(src=>`
    <img src="${src}" alt="" loading="lazy" style="width:100%;border-radius:14px;border:1px solid var(--line);box-shadow:var(--sh);display:block">`).join("");
  card.classList.remove("hidden");
  card.scrollIntoView?.({behavior:"smooth"});
}
function closeSkylrProfile(){ $("skylrProfileCard")?.classList.add("hidden"); }

const STICKERS_SEED = [
  {id:"mufc", label:"Man Utd", color:"#DA291C", txt:"#fff", short:"M", price:1200},
  {id:"lfc", label:"Liverpool", color:"#C8102E", txt:"#fff", short:"L", price:1200},
  {id:"mcfc", label:"Man City", color:"#6CABDD", txt:"#0b2545", short:"C", price:1200},
  {id:"cfc", label:"Chelsea", color:"#034694", txt:"#fff", short:"C", price:1200},
  {id:"afc", label:"Arsenal", color:"#EF0107", txt:"#fff", short:"A", price:1200},
  {id:"thfc", label:"Spurs", color:"#132257", txt:"#fff", short:"T", price:1200},
  {id:"nufc", label:"Newcastle", color:"#241F20", txt:"#fff", short:"N", price:1200},
  {id:"avfc", label:"Aston Villa", color:"#670E36", txt:"#fff", short:"V", price:1200},
  {id:"goat7", label:"الدون 🐐", color:"#000000", txt:"#f5c542", short:"7", price:3000},
  {id:"goat10", label:"العظيم 🐐", color:"#75AADB", txt:"#fff", short:"10", price:3000},
];
let shopStickers = [];
async function loadShopStickers(){
  try{
    shopStickers = await DB.list("shop_stickers");
    /* أول تشغيل: زرع الملصقات الافتراضية بالسحابة حتى يقدر الأدمن يعدلها */
    if (!shopStickers.length && session?.role === "admin" && !session.sup){
      for (const s of STICKERS_SEED) await DB.set("shop_stickers", s.id, s);
      shopStickers = await DB.list("shop_stickers");
    }
  }catch(e){ shopStickers = []; }
  renderStickerAdmin();
  renderShop();
}
function stickerById(id){ return shopStickers.find(s=>s.id===id) || STICKERS_SEED.find(s=>s.id===id); }
function stickerFaceHTML(s, px){
  /* الملصق دائري دائماً */
  if (s.img) return `<img src="${s.img}" alt="" style="width:${px}px;height:${px}px;border-radius:50%;object-fit:cover;vertical-align:middle;background:rgba(255,255,255,.08);border:1.5px solid var(--gold)">`;
  return `<span style="display:inline-flex;align-items:center;justify-content:center;width:${px}px;height:${px}px;border-radius:50%;background:${s.color||"#333"};color:${s.txt||"#fff"};font-size:${Math.round(px*0.45)}px;font-weight:800;vertical-align:middle;border:1.5px solid rgba(255,255,255,.25)">${esc(s.short||s.label?.[0]||"?")}</span>`;
}
function stickerBadgeHTML(emp, size){
  const id = emp?.equippedSticker; const s = id && stickerById(id);
  if (!s) return "";
  const px = size||24;
  return `<span title="${esc(s.label)}" style="margin-inline-start:5px;vertical-align:middle;display:inline-flex">${stickerFaceHTML(s, px)}</span>`;
}
async function buySticker(id){
  try{
    const s = stickerById(id); if (!s) return;
    const price = +s.price || 1200;
    const p = pointsFor(session.name, session.code);
    if (p.available < price) return toast(t("t_no_pts",{n:fmt(price-p.available)}));
    const emp = await DB.get("employees", session.code);
    const owned = new Set(emp.stickers||[]);
    owned.add(id);
    await DB.set("employees", session.code, {...emp, stickers:[...owned], equippedSticker: emp.equippedSticker || id, spentPts: (emp.spentPts||0)+price});
    toast("🎉 " + t("t_sticker_bought")); celebrate();
    await loadEmpDirectory();
    renderShop(); renderEmpPoints(); renderLeaderboard();
  }catch(e){ toast("❌ " + t("err") + e.message); }
}
async function equipSticker(id){
  try{
    const emp = await DB.get("employees", session.code);
    await DB.set("employees", session.code, {...emp, equippedSticker: (emp.equippedSticker===id ? null : id)});
    await loadEmpDirectory();
    renderShop(); renderLeaderboard();
  }catch(e){ toast("❌ " + t("err") + e.message); }
}
/* ---------- إدارة الملصقات (الأدمن): رفع صورة شعار، تعديل اسم/سعر، حذف ---------- */
function fileToPngSquare(file, px=88){
  return new Promise((res, rej)=>{
    const img = new Image();
    img.onload = ()=>{
      const c = document.createElement("canvas"); c.width = px; c.height = px;
      const ctx = c.getContext("2d");
      const scale = Math.min(px/img.width, px/img.height);
      const w = img.width*scale, h = img.height*scale;
      ctx.drawImage(img, (px-w)/2, (px-h)/2, w, h);
      res(c.toDataURL("image/png"));
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}
function renderStickerAdmin(){
  const el = $("stickerAdminBody"); if (!el) return;
  el.innerHTML = (shopStickers.length ? shopStickers : []).map(s=>`
    <div class="card" style="padding:12px;text-align:center;margin:0">
      <div style="display:flex;justify-content:center;margin-bottom:6px">${stickerFaceHTML(s, 56)}</div>
      <div style="font-size:12px;font-weight:800">${esc(s.label)}</div>
      <div class="priceTag" style="margin:4px 0">✦ ${fmt(+s.price||0)}</div>
      <div style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap">
        <button class="btn ghost small" onclick="renameSticker('${s.id}')">✏️</button>
        <button class="btn ghost small" onclick="repriceSticker('${s.id}')">✦</button>
        <button class="btn danger small" onclick="deleteSticker('${s.id}')">${ico("x")}</button>
      </div>
    </div>`).join("") || emptyState("no_stickers","box");
}
async function renameSticker(id){
  const s = shopStickers.find(x=>x.id===id); if (!s) return;
  const name = prompt(t("sticker_rename_prompt"), s.label);
  if (name === null || !name.trim()) return;
  await DB.set("shop_stickers", id, {...s, label: name.trim()});
  toast("✅ " + t("t_sticker_updated"));
  await loadShopStickers(); renderLeaderboard();
}
async function repriceSticker(id){
  const s = shopStickers.find(x=>x.id===id); if (!s) return;
  const raw = prompt(t("sticker_reprice_prompt"), s.price||1200);
  if (raw === null) return;
  const price = parseInt(raw,10);
  if (!price || price<0) return toast(t("add_pts_invalid"));
  await DB.set("shop_stickers", id, {...s, price});
  toast("✅ " + t("t_sticker_updated"));
  await loadShopStickers();
}
async function deleteSticker(id){
  if (!confirm(t("sticker_del_confirm"))) return;
  await DB.del("shop_stickers", id);
  toast("✅ " + t("t_sticker_deleted"));
  await loadShopStickers(); renderLeaderboard();
}
/* ---------- كروبر الملصقات: زوم وسحب مع قص دائري ---------- */
let cropState = null;
$("stickerUploadFile")?.addEventListener("change", e=>{
  const f = e.target.files[0]; if (!f) return; e.target.value = "";
  const img = new Image();
  img.onload = ()=>{
    cropState = {img, zoom:1, ox:0, oy:0, dragging:false, lastX:0, lastY:0};
    $("cropZoom").value = 1;
    $("stickerCropCard").classList.remove("hidden");
    $("stickerCropCard").scrollIntoView?.({behavior:"smooth"});
    drawCropPreview();
  };
  img.onerror = ()=>toast("❌ " + t("err") + "image");
  img.src = URL.createObjectURL(f);
});
function cropBaseScale(){
  const c = $("cropCanvas");
  return Math.max(c.width/cropState.img.width, c.height/cropState.img.height);
}
function drawCropPreview(){
  if (!cropState) return;
  const c = $("cropCanvas"), ctx = c.getContext("2d");
  ctx.clearRect(0,0,c.width,c.height);
  const s = cropBaseScale() * cropState.zoom;
  const w = cropState.img.width*s, h = cropState.img.height*s;
  const x = (c.width-w)/2 + cropState.ox, y = (c.height-h)/2 + cropState.oy;
  ctx.drawImage(cropState.img, x, y, w, h);
  /* تعتيم خارج الدائرة ليعرف المستخدم حدود القص */
  ctx.save();
  ctx.beginPath();
  ctx.rect(0,0,c.width,c.height);
  ctx.arc(c.width/2, c.height/2, c.width/2-2, 0, Math.PI*2, true);
  ctx.fillStyle = "rgba(7,6,12,.62)";
  ctx.fill("evenodd");
  ctx.restore();
  ctx.beginPath();
  ctx.arc(c.width/2, c.height/2, c.width/2-2, 0, Math.PI*2);
  ctx.strokeStyle = "#f5c542"; ctx.lineWidth = 2; ctx.stroke();
}
function cropZoomChange(v){ if (!cropState) return; cropState.zoom = +v; drawCropPreview(); }
function cropPointerDown(ev){ if (!cropState) return; cropState.dragging = true; cropState.lastX = ev.clientX; cropState.lastY = ev.clientY; ev.preventDefault(); }
function cropPointerMove(ev){
  if (!cropState?.dragging) return;
  cropState.ox += ev.clientX - cropState.lastX;
  cropState.oy += ev.clientY - cropState.lastY;
  cropState.lastX = ev.clientX; cropState.lastY = ev.clientY;
  drawCropPreview(); ev.preventDefault();
}
function cropPointerUp(){ if (cropState) cropState.dragging = false; }
function cancelStickerCrop(){ cropState = null; $("stickerCropCard").classList.add("hidden"); }
async function saveStickerCrop(){
  if (!cropState) return;
  try{
    const prev = $("cropCanvas");
    const out = document.createElement("canvas");
    const px = 160; out.width = px; out.height = px;
    const ctx = out.getContext("2d");
    /* قص دائري نهائي بنفس الإطار المعروض */
    ctx.beginPath(); ctx.arc(px/2, px/2, px/2, 0, Math.PI*2); ctx.clip();
    const ratio = px/prev.width;
    const s = cropBaseScale() * cropState.zoom * ratio;
    const w = cropState.img.width*s, h = cropState.img.height*s;
    const x = (px-w)/2 + cropState.ox*ratio, y = (px-h)/2 + cropState.oy*ratio;
    ctx.drawImage(cropState.img, x, y, w, h);
    const img = out.toDataURL("image/png");
    const name = prompt(t("sticker_name_prompt"), "");
    if (name === null || !name.trim()) return;
    const raw = prompt(t("sticker_reprice_prompt"), 1200);
    if (raw === null) return;
    const price = parseInt(raw,10) || 1200;
    const id = "st" + Date.now().toString(36);
    await DB.set("shop_stickers", id, {id, label:name.trim(), price, img});
    toast("✅ " + t("t_sticker_added"));
    cancelStickerCrop();
    await loadShopStickers();
  }catch(err){ toast("❌ " + t("err") + err.message); }
}
const SHOP_COLORS = ["#f5c542","#34d399","#38bdf8","#f472b6","#f87171","#c4b5fd","#fb923c","#e2e8f0"];
/* ---------- إطارات الأفاتار (ستايل موبايل ليجند) ---------- */
const FRAMES = [
  {id:"king", cls:"f-king", ar:"تاج الملوك", en:"King's Crown", evAr:"جائزة المركز الأول", evEn:"No.1 Prize", price:2500},
  {id:"champ", cls:"f-champ", ar:"البطل الذهبي", en:"Golden Champion", evAr:"موسم الأبطال", evEn:"Champions Season", price:2000},
  {id:"dragon", cls:"f-dragon", ar:"التنين الأرجواني", en:"Purple Dragon", evAr:"حدث التنين", evEn:"Dragon Event", price:1800},
  {id:"neon", cls:"f-neon", ar:"نيون المستقبل", en:"Neon Future", evAr:"حدث السايبر", evEn:"Cyber Event", price:1500},
  {id:"venom", cls:"f-venom", ar:"السم الأخضر", en:"Green Venom", evAr:"حدث الفينوم", evEn:"Venom Event", price:1200},
  {id:"ice", cls:"f-ice", ar:"صقيع الشتاء", en:"Winter Frost", evAr:"حدث الشتاء", evEn:"Winter Event", price:1000},
  {id:"love", cls:"f-love", ar:"نبض القلوب", en:"Heartbeat", evAr:"حدث المحبة", evEn:"Love Event", price:1000},
  {id:"candy", cls:"f-candy", ar:"حلوى العيد", en:"Holiday Candy", evAr:"حدث الأعياد", evEn:"Holiday Event", price:800},
];
function frameById(id){ return FRAMES.find(f=>f.id===id); }
function frameName(f){ return LANG==="ar" ? f.ar : f.en; }
function frameEvent(f){ return LANG==="ar" ? f.evAr : f.evEn; }
function framedAvatarHTML(emp, coreHTML, corePx){
  const f = emp?.equippedFrame && frameById(emp.equippedFrame);
  if (!f) return coreHTML;
  const size = (corePx||40) + 10;
  return `<span class="mlAv ${f.cls}" style="width:${size}px;height:${size}px" title="${esc(frameName(f))}"><span class="avCoreZ" style="display:inline-flex">${coreHTML}</span></span>`;
}
async function buyFrame(id){
  try{
    const f = frameById(id); if (!f) return;
    const p = pointsFor(session.name, session.code);
    if (p.available < f.price) return toast(t("t_no_pts",{n:fmt(f.price-p.available)}));
    const emp = await DB.get("employees", session.code);
    const owned = new Set(emp.frames||[]);
    owned.add(id);
    await DB.set("employees", session.code, {...emp, frames:[...owned], equippedFrame: emp.equippedFrame || id, spentPts:(emp.spentPts||0)+f.price});
    toast("🎉 " + t("t_frame_bought"));
    await loadEmpDirectory();
    renderShop(); renderEmpPoints(); renderLeaderboard(); renderRankBoards();
  }catch(e){ toast("❌ " + t("err") + e.message); }
}
async function equipFrame(id){
  try{
    const emp = await DB.get("employees", session.code);
    await DB.set("employees", session.code, {...emp, equippedFrame:(emp.equippedFrame===id ? null : id)});
    await loadEmpDirectory();
    renderShop(); renderLeaderboard(); renderRankBoards();
  }catch(e){ toast("❌ " + t("err") + e.message); }
}
/* ---------- رانك الموسم (يتصفر كل شهر مثل السناب) ---------- */
const RANKS = [
  {id:"warrior", min:0, ar:"محارب", en:"Warrior", icon:"🥉", color:"#b87a4e"},
  {id:"elite", min:60, ar:"نخبة", en:"Elite", icon:"🥈", color:"#9fb3c8"},
  {id:"master", min:140, ar:"ماستر", en:"Master", icon:"🏅", color:"#e08c4a"},
  {id:"gm", min:240, ar:"جراند ماستر", en:"Grandmaster", icon:"💠", color:"#38bdf8"},
  {id:"epic", min:360, ar:"إيبك", en:"Epic", icon:"💜", color:"#a78bfa"},
  {id:"legend", min:520, ar:"أسطورة", en:"Legend", icon:"🔶", color:"#f5c542"},
  {id:"mythic", min:750, ar:"ميثيك", en:"Mythic", icon:"🌟", color:"#f472b6"},
];
function rankFor(pts){
  let r = RANKS[0];
  for (const x of RANKS) if (pts >= x.min) r = x;
  return r;
}
function rankName(r){ return r.en; } /* أسماء الرانك بالإنجليزي دائماً */
function rankBadgeHTML(r){
  return `<span class="rankBadge" style="color:${r.color};border-color:${r.color}55;background:${r.color}14">${r.icon} ${rankName(r)}</span>`;
}
let seasonTasks = [];
function sameSeasonMonth(ts){
  if (!ts) return false;
  const d = new Date(ts), n = new Date();
  return d.getMonth()===n.getMonth() && d.getFullYear()===n.getFullYear();
}
async function loadSeasonTasks(){
  try{
    const all = await DB.list("tasks");
    seasonTasks = (all||[]).filter(x=>x.status==="done" && sameSeasonMonth(x.submittedAt));
  }catch(e){ seasonTasks = []; }
  renderRankBoards();
}
function empSeasonPts(emp){
  if (emp.ghost) return emp.bonusPts||0;
  return seasonTasks.filter(x=>x.empName===emp.name).reduce((s,x)=>s+(x.points||0),0);
}
function seasonLabel(){
  return LANG==="ar" ? AR_MONTHS[new Date().getMonth()] : new Date().toLocaleDateString("en-GB",{month:"long"});
}
function renderRankBoards(){ renderRankBoardInto("rankBoard"); renderRankBoardInto("lbEmp"); renderRankGuide(); }
function renderRankGuide(){
  const el = $("rankGuideE"); if (!el) return;
  const me = session?.role==="emp" ? employees.find(e=>e.id===session.code) : null;
  const myPts = me ? empSeasonPts(me) : null;
  const myRank = myPts!=null ? rankFor(myPts) : null;
  const ladder = RANKS.map((r,i)=>{
    const next = RANKS[i+1];
    const range = next ? `${r.min} – ${next.min-1}` : `${r.min}+`;
    const isMe = myRank && myRank.id===r.id;
    return `<div style="display:flex;align-items:center;gap:10px;padding:9px 13px;border-radius:11px;border:1px solid ${isMe?r.color+"66":"var(--line)"};background:${isMe?r.color+"12":"var(--card2)"};margin-bottom:7px">
      <span style="font-size:19px">${r.icon}</span>
      <div style="flex:1;min-width:0">
        <b style="font-family:'JetBrains Mono';font-size:13px;color:${r.color}">${r.en}</b>
        ${isMe?` <span class="pill" style="font-size:10px;padding:2px 9px;color:${r.color};border-color:${r.color}66">◄ ${t("rank_you_here")}</span>`:""}
      </div>
      <span class="rankPts" style="font-size:12.5px;color:var(--muted)">${range} <small>${t("rank_pts_unit")}</small></span>
    </div>`;
  }).join("");
  let progress = "";
  if (me){
    const idx = RANKS.findIndex(r=>r.id===myRank.id);
    const next = RANKS[idx+1];
    if (next){
      const span = next.min - myRank.min;
      const pct = Math.min(100, Math.round(((myPts - myRank.min)/span)*100));
      progress = `<div style="margin-bottom:14px;padding:13px 15px;border:1px solid var(--line2);border-radius:12px;background:var(--card2)">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:7px;flex-wrap:wrap;gap:6px">
          <span>${myRank.icon} <b style="font-family:'JetBrains Mono';color:${myRank.color}">${myRank.en}</b> · <span class="rankPts" style="font-size:12px">${fmt(myPts)}</span> ${t("rank_pts_unit")}</span>
          <span style="color:var(--muted)">${t("rank_next_lbl")}: ${next.icon} <b style="font-family:'JetBrains Mono';color:${next.color}">${next.en}</b></span>
        </div>
        <div style="height:9px;border-radius:6px;background:rgba(139,92,246,.1);overflow:hidden">
          <div style="height:100%;width:${pct}%;border-radius:6px;background:linear-gradient(90deg,${myRank.color},${next.color})"></div>
        </div>
        <div style="font-size:11px;color:var(--muted);margin-top:6px">${t("rank_to_next",{n:fmt(next.min - myPts)})}</div>
      </div>`;
    } else {
      progress = `<div style="margin-bottom:14px;padding:13px 15px;border:1px solid rgba(245,197,66,.4);border-radius:12px;background:rgba(245,197,66,.06);font-size:13px">🌟 <b style="font-family:'JetBrains Mono'">MYTHIC</b> — ${t("rank_max_lbl")}</div>`;
    }
  }
  el.innerHTML = progress + ladder;
}
function renderRankBoardInto(elId){
  const el = $(elId); if (!el) return;
  const scope = (elId === "lbEmp" || elId.endsWith("E")) ? "E" : "";
  const list = employees.map(e=>({emp:e, pts:empSeasonPts(e)})).sort((a,b)=>b.pts-a.pts);
  const lbl = $((elId==="lbEmp"?"rankBoardE":elId)+"Season"); if (lbl) lbl.textContent = `🗓 ${seasonLabel()}`;
  const header = (elId === "lbEmp" && typeof skylrRowHTML === "function") ? skylrRowHTML() : "";
  el.innerHTML = header + (list.length ? list.map((x,i)=>{
    const r = rankFor(x.pts);
    const p = pointsFor(x.emp.name, x.emp.id);
    const core = `<span class="lbAvatar" style="width:40px;height:40px">${x.emp.photo?`<img src="${x.emp.photo}" alt="">`:esc((x.emp.name||"?").trim()[0])}</span>`;
    const click = x.emp.ghost ? "" : `onclick="openEmpProfile('${x.emp.id}','${scope}')" style="cursor:pointer"`;
    return `<div class="rankRow r${i+1}" style="animation-delay:${i*60}ms">
      <div class="rPos">${i<3?["🥇","🥈","🥉"][i]:i+1}</div>
      ${framedAvatarHTML(x.emp, core, 40)}
      <div style="flex:1;min-width:0" ${click}>
        <div style="font-family:'Almarai';font-weight:600;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${x.emp.nameColor?`color:${x.emp.nameColor}`:""}">${esc(x.emp.name)}${stickerBadgeHTML(x.emp,20)}</div>
        <div style="margin-top:3px">${rankBadgeHTML(r)}${x.emp.ghost?` <span class="pill" style="font-size:10px;padding:2px 8px">📍 ${esc(x.emp.branch||"—")}</span>`:""}</div>
      </div>
      <div style="text-align:end;flex-shrink:0">
        <div class="rankPts" style="margin:0">${fmt(x.pts)} <small>${t("rank_pts_unit")}</small></div>
        <div style="font-size:10.5px;color:var(--gold);font-family:'JetBrains Mono';margin-top:3px">✦ ${fmt(p.available)}</div>
      </div>
    </div>`;
  }).join("") : emptyState("no_lb","trophy"));
}
/* ================= أقسام واجهة X للموظف ================= */
/* ---------- 1) مبيعاتي: يومي / أسبوعي / شهري ---------- */
let mySalesRange = "month";
function setMySalesRange(r, btn){
  mySalesRange = r;
  document.querySelectorAll("#mySalesSeg .xSegBtn").forEach(b=>b.classList.remove("on"));
  btn?.classList.add("on");
  renderMySales();
}
function empdParseDate(s){
  const x = String(s||"");
  let m = x.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2]-1, +m[3]);
  m = x.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? new Date(+m[3], +m[2]-1, +m[1]) : null;
}
function renderMySales(){
  const el = $("mySalesBody"); if (!el || session?.role!=="emp") return;
  const meta = $("mySalesMeta");
  const doc = curMonthEmpDetail();
  if (!doc){ el.innerHTML = emptyState("empd_none","chart"); if (meta) meta.textContent=""; return; }
  const u = empDetailFor(session.name);
  if (!u){ el.innerHTML = emptyState("empd_none_me","chart"); if (meta) meta.textContent=""; return; }
  /* التقرير تراكمي من بداية الشهر حتى تاريخ آخر رفع، فنقسّم القيم على المدى المطلوب */
  const from = empdParseDate(doc.from), to = empdParseDate(doc.to);
  const days = (from && to) ? Math.max(1, Math.round((to-from)/86400000)) : 1;
  const div = mySalesRange==="day" ? days : mySalesRange==="week" ? Math.max(1, days/7) : 1;
  const label = t(mySalesRange==="day" ? "range_day" : mySalesRange==="week" ? "range_week" : "range_month");
  if (meta) meta.textContent = `${doc.from||""} → ${doc.to||""} · ${days} ${t("days_word")} · ${label}`;
  const items = (u.items||[]).map(x=>({name:x.name, qty: div===1 ? x.qty : +(x.qty/div).toFixed(1), combo:x.combo}));
  const total = div===1 ? u.totalQty : +(u.totalQty/div).toFixed(1);
  const max = Math.max(1, ...items.map(x=>x.qty));

  /* شريط "وين أنا" — تذاكري وأصنافي والكومبو مع مركزي بين الفريق */
  const tkts = Object.values(ticketsByName()).sort((a,b)=>b.tickets-a.tickets).map(x=>({name:x.name, qty:x.tickets}));
  const fnbs = Object.values(fnbByName()).sort((a,b)=>b.qty-a.qty).map(x=>({name:x.name, qty:x.qty}));
  const cmbs = Object.values(fnbByName()).sort((a,b)=>b.comboGross-a.comboGross).map(x=>({name:x.name, qty:x.comboGross}));
  const rt = rankOf(tkts, session.name), rf = rankOf(fnbs, session.name), rc = rankOf(cmbs, session.name);
  const myCombo = (u.comboQty!==undefined) ? u.comboQty : items.filter(x=>x.combo).reduce((a,x)=>a+x.qty,0);
  const badge = r => r ? `<div class="mr ${rkClass(r.pos)}">${r.pos===1?"👑 "+t("cat_you_top"):t("me_rank",{n:r.pos,of:r.of})}</div>` : "";
  const hero = `<div class="meStrip">
      <div class="meCard"><div class="mv" style="color:var(--gold)">${fmt(rt?rt.qty:0)}</div><div class="ml">${t("tkt_unit")}</div>${badge(rt)}</div>
      <div class="meCard"><div class="mv" style="color:var(--p1)">${fmt(total)}</div><div class="ml">${t("fnb_unit")} — ${label}</div>${badge(rf)}</div>
      <div class="meCard"><div class="mv" style="color:var(--lav2)">${fmt(myCombo)}</div><div class="ml">${t("fnb_combo")}</div>${badge(rc)}</div>
      <div class="meCard"><div class="mv">${items.length}</div><div class="l ml">${t("stat_products")}</div></div>
    </div>`;

  /* بطولاتي: التصنيفات اللي أنا متصدرها */
  const mine = categoryChampions().filter(c=>c.list[0] && isMe(c.list[0].name));
  const crowns = mine.length ? `<div class="saleMini" style="margin-top:12px">${
      mine.map(c=>`<span style="background:rgba(251,191,36,.14);color:var(--gold);font-weight:700">👑 ${catMeta(c.id).emo} ${esc(catMeta(c.id).label)}</span>`).join("")
    }</div>` : "";

  el.innerHTML = hero + crowns +
    `<div class="tableWrap" style="max-height:420px;margin-top:14px"><table>
      <thead><tr><th>#</th><th>${t("th_product")}</th><th>${t("th_sold_qty")}</th></tr></thead>
      <tbody>${items.map((r,i)=>`<tr><td class="num">${perfRank(i)}</td><td>${r.combo?"🎁 ":""}${esc(r.name)}</td>${perfBarCell(r.qty, max, r.combo?"var(--gold)":"var(--p1)")}</tr>`).join("")}</tbody>
    </table></div>`;
}
/* ---------- 2) هدف الفرع هذا الشهر (من ملف الميزانية الأسبوعي) ---------- */
function myBranchKey(){
  const b = (session?.branch || (employees.find(e=>e.id===session?.code)?.branch) || "Unaizah");
  const keys = Object.keys(branchBudget?.branches || {});
  const norm = s=>String(s).toLowerCase().replace(/[^a-z\u0600-\u06FF]/g,"");
  return keys.find(k=>norm(k)===norm(b)) || keys.find(k=>norm(k).includes(norm(b))||norm(b).includes(norm(k))) || keys[0] || null;
}
function renderBranchTarget(){
  const el = $("targetBody"); if (!el) return;
  const badge = $("targetDaysLeft");
  const key = myBranchKey();
  const b = key ? branchBudget?.branches?.[key] : null;
  if (!b){ el.innerHTML = emptyState("target_none","chart"); if (badge) badge.textContent = ""; return; }
  const now = new Date();
  const mo = now.getMonth()+1;
  const m = b.monthly?.[mo] || {targetRev:0, achRev:0, targetAdmits:0, achAdmits:0};
  const daysInMonth = new Date(now.getFullYear(), mo, 0).getDate();
  const left = Math.max(0, daysInMonth - now.getDate());
  if (badge) badge.textContent = `⏳ ${t("days_left_month",{n:left})}`;
  const remainRev = Math.max(0, (m.targetRev||0) - (m.achRev||0));
  const pctRev = m.targetRev ? Math.min(100, (m.achRev/m.targetRev*100)) : 0;
  const pctAdm = m.targetAdmits ? Math.min(100, (m.achAdmits/m.targetAdmits*100)) : 0;
  const perDay = left>0 ? remainRev/left : remainRev;
  const color = pctRev>=100 ? "var(--green)" : pctRev>=70 ? "var(--amber)" : "var(--red)";
  const bar = (pct,c)=>`<div style="height:10px;border-radius:6px;background:rgba(139,92,246,.12);overflow:hidden;margin-top:6px">
      <div style="height:100%;width:${pct.toFixed(1)}%;border-radius:6px;background:${c}"></div></div>`;
  el.innerHTML = `
    <div class="statRow">
      <div class="stat"><div class="v">${fmt(m.targetRev||0)}</div><div class="l">${t("target_month_rev")}</div></div>
      <div class="stat"><div class="v" style="color:${color}">${fmt(m.achRev||0)}</div><div class="l">${t("target_achieved")}</div></div>
      <div class="stat"><div class="v" style="color:var(--amber)">${fmt(+remainRev.toFixed(0))}</div><div class="l">${t("target_remaining")}</div></div>
      <div class="stat"><div class="v">${fmt(+perDay.toFixed(0))}</div><div class="l">${t("target_per_day")}</div></div>
      <div class="stat"><div class="v">${left}</div><div class="l">${t("target_days_left")}</div></div>
    </div>
    <div style="margin-top:6px">
      <div style="display:flex;justify-content:space-between;font-size:12px"><b>${t("target_rev_progress")}</b><span class="num">${pctRev.toFixed(1)}%</span></div>
      ${bar(pctRev,color)}
    </div>
    <div style="margin-top:14px">
      <div style="display:flex;justify-content:space-between;font-size:12px"><b>${t("target_admits_progress")}</b><span class="num">${fmt(m.achAdmits||0)} / ${fmt(m.targetAdmits||0)}</span></div>
      ${bar(pctAdm,"var(--p1)")}
    </div>
    <div class="sub" style="margin:14px 0 0">📍 ${esc(branchLabel(key))}</div>`;
}
/* ---------- 3) كل الإنجازات ---------- */
function renderAllAchievements(){
  const el = $("achvAllBody"); if (!el) return;
  const me = employees.find(e=>e.id===session?.code);
  const mine = new Map(achvList(me).map(x=>[x.id,x]));
  const stats = $("achvStats");
  if (stats) stats.innerHTML = `
    <div class="stat"><div class="v" style="color:var(--p1)">${mine.size}</div><div class="l">${t("achv_earned")}</div></div>
    <div class="stat"><div class="v">${ACHIEVEMENTS.length}</div><div class="l">${t("achv_total")}</div></div>
    <div class="stat"><div class="v">${Math.round(mine.size/Math.max(1,ACHIEVEMENTS.length)*100)}%</div><div class="l">${t("achv_progress")}</div></div>`;
  el.innerHTML = ACHIEVEMENTS.map(a=>{
    const got = mine.get(a.id);
    return `<div class="card" style="padding:14px;text-align:center;margin:0;${got?"border:1px solid var(--p1)":"opacity:.45"}">
      <img src="${ACHIEVEMENT_IMG[a.id]}" alt="" loading="lazy" style="width:104px;height:104px;object-fit:contain;margin:0 auto 8px;display:block;${got?"filter:drop-shadow(0 8px 22px rgba(139,92,246,.4))":"filter:grayscale(1)"}">
      <div style="font-size:12.5px;font-weight:800">${esc(achvTitle(a))}</div>
      <div style="font-size:10.5px;color:var(--muted);margin-top:4px;line-height:1.6">${esc(got?.desc || achvDefaultDesc(a))}</div>
      ${got ? `<div class="pill g" style="margin-top:7px">✓ ${t("achv_owned")}</div>` : `<div class="pill" style="margin-top:7px">🔒 ${t("achv_locked")}</div>`}
    </div>`;
  }).join("");
}
/* ---------- 4) موظف الشهر ---------- */
let eomData = null;
async function loadEom(){
  eomData = await DB.get("app_settings","eom").catch(()=>null);
  renderEom(); renderEomAdmin();
}
function eomMonthKey(){ const n=new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`; }
function renderEom(){
  const el = $("eomBody"); if (!el) return;
  const d = eomData || {};
  const winner = d.winnerCode ? employees.find(e=>e.id===d.winnerCode) : null;
  const rules = (d.rules||"").trim();
  let html = "";
  if (winner){
    const core = `<span class="lbAvatar" style="width:96px;height:96px">${winner.photo?`<img src="${winner.photo}" alt="">`:esc((winner.name||"?").trim()[0])}</span>`;
    html += `<div style="text-align:center;padding:18px 0 8px">
        <div style="display:flex;justify-content:center;margin-bottom:12px">${framedAvatarHTML(winner, core, 96)}</div>
        <div style="font-family:'Almarai';font-weight:800;font-size:19px">${esc(winner.name)}</div>
        <div class="pill a" style="margin-top:8px">👑 ${t("eom_winner")} — ${esc(d.month||eomMonthKey())}</div>
        ${d.note?`<div class="sub" style="margin:12px auto 0;max-width:52ch">${esc(d.note)}</div>`:""}
      </div>`;
  } else {
    html += `<div class="empty">${ico("trophy")}<div>${t("eom_no_winner")}</div></div>`;
  }
  if (d.img){
    html += `<img src="${d.img}" alt="" style="width:100%;max-width:420px;display:block;margin:14px auto;border-radius:14px;border:1px solid var(--line)">`;
  }
  html += `<h3 style="margin:18px 0 8px;font-size:14px">📜 ${t("eom_rules_title")}</h3>`;
  html += rules
    ? `<div style="background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:14px 16px;font-size:13px;line-height:1.9;white-space:pre-wrap">${esc(rules)}</div>`
    : `<div class="sub" style="margin:0">${t("eom_no_rules")}</div>`;
  el.innerHTML = html;
}
/* إدارة موظف الشهر (الماستر/المشرف) */
function renderEomAdmin(){
  const el = $("eomAdminBody"); if (!el) return;
  const d = eomData || {};
  const opts = visibleEmps().map(e=>`<option value="${e.id}" ${d.winnerCode===e.id?"selected":""}>${esc(e.name)}</option>`).join("");
  el.innerHTML = `
    <div class="grid2">
      <div class="field"><label>${t("eom_pick_winner")}</label>
        <select id="eomWinner"><option value="">— ${t("eom_none")} —</option>${opts}</select></div>
      <div class="field"><label>${t("eom_note_lbl")}</label><input id="eomNote" value="${esc(d.note||"")}" placeholder="${t("eom_note_ph")}"></div>
    </div>
    <div class="field"><label>${t("eom_rules_lbl")}</label>
      <textarea id="eomRules" rows="5" style="width:100%;padding:12px 14px;background:var(--bg2);border:1px solid var(--line2);border-radius:9px;color:#fff;font-family:inherit;font-size:13.5px;line-height:1.8">${esc(d.rules||"")}</textarea></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <button class="btn" onclick="saveEom()">${ico("check")}${t("save")}</button>
      <button class="btn ghost" onclick="document.getElementById('eomImgFile').click()">${ico("cam")}${t("eom_upload_img")}</button>
      ${d.img?`<button class="btn danger small" onclick="clearEomImg()">${ico("x")}${t("eom_clear_img")}</button>`:""}
    </div>
    ${d.img?`<img src="${d.img}" alt="" style="width:160px;margin-top:12px;border-radius:12px;border:1px solid var(--line)">`:""}`;
}
async function saveEom(){
  try{
    const d = eomData || {};
    const payload = {
      ...d,
      winnerCode: $("eomWinner")?.value || "",
      note: ($("eomNote")?.value||"").trim(),
      rules: ($("eomRules")?.value||"").trim(),
      month: eomMonthKey(), updatedAt: Date.now()
    };
    await DB.set("app_settings","eom", payload);
    toast("✅ " + t("t_eom_saved"));
    await loadEom();
  }catch(e){ toast("❌ " + t("err") + e.message); }
}
async function clearEomImg(){
  const d = eomData || {};
  await DB.set("app_settings","eom", {...d, img:""});
  await loadEom();
}
$("eomImgFile")?.addEventListener("change", async e=>{
  const f = e.target.files[0]; if (!f) return; e.target.value="";
  try{
    const img = await fileToPngSquare(f, 420);
    const d = eomData || {};
    await DB.set("app_settings","eom", {...d, img});
    toast("✅ " + t("t_eom_saved"));
    await loadEom();
  }catch(err){ toast("❌ " + t("err") + err.message); }
});
/* ---------- تبويبات شاشة الموظف ---------- */
function showEmpTab(btn){
  ["eHome","eTeam","eBattle","eKudos","eTarget","eShop","eAchv","eEom","ePerf","eExp"].forEach(p=>$(p)?.classList.add("hidden"));
  document.querySelectorAll("#empTabs .xNavItem").forEach(b=>b.classList.remove("active"));
  btn.classList.add("active");
  const p = btn.dataset.p;
  $(p)?.classList.remove("hidden");
  if (p==="eHome"){ renderGreeting(); renderMySales(); renderMyActivity(); }
  if (p==="eTeam") renderEmpBoards();
  if (p==="eBattle") renderEmpBattle();
  if (p==="eKudos") renderKudos();
  if (p==="eTarget") renderBranchTarget();
  if (p==="eAchv") renderAllAchievements();
  if (p==="eEom") renderEom();
  window.scrollTo({top:0, behavior:"smooth"});
}
async function updateMyBestRank(){
  try{
    if (session?.role!=="emp") return;
    const me = employees.find(e=>e.id===session.code); if (!me) return;
    const pts = empSeasonPts(me);
    if (pts > (me.bestRankPts||0)){
      const emp = await DB.get("employees", session.code);
      await DB.set("employees", session.code, {...emp, bestRankPts: pts, bestRankTs: Date.now()});
      me.bestRankPts = pts;
    }
  }catch(e){}
}
let shopPick = null;
function pickShopColor(c){ shopPick = c; renderShop(); }
function setMyDisplayNameLabel(emp){ return emp?.displayName ? esc(emp.displayName) : ""; }
function renderShop(){
  const el = $("shopBody"); if(!el || session?.role!=="emp") return;
  const p = pointsFor(session.name, session.code);
  const emp = employees.find(e=>e.id===session.code);
  const owned = new Set(emp?.stickers||[]);
  const equipped = emp?.equippedSticker;
  el.innerHTML = `
    <div class="shopItem">
      <div style="min-width:0">
        <b>🎨 ${t("shop_color")}</b>
        <div style="font-size:12px;color:var(--muted);margin:4px 0 8px">${t("shop_color_sub")}${p.color?` · <span style="color:${p.color}">●</span> ${t("shop_owned")}`:""}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${SHOP_COLORS.map(c=>`<div class="colorDot ${shopPick===c?"sel":""}" style="background:${c};color:${c}" onclick="pickShopColor('${c}')"></div>`).join("")}
        </div>
      </div>
      <div style="text-align:center">
        <div class="priceTag">✦ ${t("shop_price")}</div>
        <button class="btn small" style="margin-top:8px" onclick="buyNameColor()">${t("shop_buy")}</button>
      </div>
    </div>
    <div style="margin:18px 0 8px;font-weight:800;font-size:14px">🖼️ ${t("shop_frames_title")}</div>
    <div class="sub" style="margin:0 0 10px">${t("shop_frames_sub")}</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px">
      ${FRAMES.map(f=>{
        const isOwned = new Set(emp?.frames||[]).has(f.id);
        const isEquipped = emp?.equippedFrame === f.id;
        const preview = `<span class="mlAv ${f.cls}" style="width:58px;height:58px"><span class="avCoreZ lbAvatar" style="width:46px;height:46px">${emp?.photo?`<img src="${emp.photo}" alt="">`:esc((session.name||"?").trim()[0])}</span></span>`;
        return `<div class="card" style="padding:14px 10px;text-align:center;margin:0;${isEquipped?"border:1px solid var(--green)":""}">
          <div style="display:flex;justify-content:center;margin:6px 0 10px">${preview}</div>
          <div style="font-size:12.5px;font-weight:700">${esc(frameName(f))}</div>
          <div style="font-size:10px;color:var(--muted);margin-top:2px">🎪 ${esc(frameEvent(f))}</div>
          ${isOwned
            ? `<button class="btn ${isEquipped?"green":"ghost"} small" style="margin-top:8px;width:100%;justify-content:center" onclick="equipFrame('${f.id}')">${isEquipped?"✓ "+t("shop_equipped"):t("shop_equip")}</button>`
            : `<div class="priceTag" style="margin-top:6px">✦ ${fmt(f.price)}</div><button class="btn small" style="margin-top:6px;width:100%;justify-content:center" onclick="buyFrame('${f.id}')">${t("shop_buy")}</button>`}
        </div>`;
      }).join("")}
    </div>
    <div style="margin:18px 0 8px;font-weight:800;font-size:14px">🎁 ${t("pack_title")}</div>
    <div class="sub" style="margin:0 0 10px">${t("pack_sub")}</div>
    <div class="shopItem">
      <div style="min-width:0">
        <b>🎲 ${t("pack_name")}</b>
        <div style="font-size:12px;color:var(--muted);margin:4px 0 8px">${t("pack_odds")}</div>
        <div style="font-size:11px;color:var(--muted)">${t("pack_left",{n:PACK_DAILY_MAX - packsToday(emp)})}</div>
        <div id="packResult"></div>
      </div>
      <div style="text-align:center">
        <div class="priceTag">✦ ${fmt(PACK_PRICE)}</div>
        <button class="btn small" style="margin-top:8px" data-micron="jelly" onclick="buyPack()">${t("pack_open")}</button>
      </div>
    </div>

    <div style="margin:18px 0 8px;font-weight:800;font-size:14px">🪪 ${t("perks_title")}</div>
    <div class="sub" style="margin:0 0 10px">${t("perks_sub")}</div>
    ${[["name_card","🪪",t("perk_name"),t("perk_name_sub"),setMyDisplayNameLabel(emp)],
       ["shift","🕐",t("perk_shift"),t("perk_shift_sub"),emp?.prefShift?esc(emp.prefShift):""],
       ["priority","⚡",t("perk_priority"),t("perk_priority_sub"),""]].map(([id,emo,title,sub,extra])=>{
      const owned = (emp?.perks||[]).includes(id);
      const act = id==="name_card" ? "setMyDisplayName()" : id==="shift" ? "setMyShift()" : "";
      return `<div class="shopItem">
        <div style="min-width:0">
          <b>${emo} ${title}</b>
          <div style="font-size:12px;color:var(--muted);margin:4px 0 4px">${sub}</div>
          ${extra?`<div style="font-size:12px;color:var(--gold)">${extra}</div>`:""}
        </div>
        <div style="text-align:center">
          ${owned
            ? (act ? `<button class="btn green small" data-micron="bounce" onclick="${act}">${t("perk_use")}</button>`
                   : `<span class="pill g">✓ ${t("shop_owned")}</span>`)
            : `<div class="priceTag">✦ ${fmt(PERK_PRICES[id])}</div>
               <button class="btn small" style="margin-top:8px" data-micron="tada" onclick="buyPerk('${id}')">${t("shop_buy")}</button>`}
        </div>
      </div>`;
    }).join("")}

    <div style="margin:16px 0 8px;font-weight:800;font-size:14px">🏷️ ${t("shop_stickers_title")}</div>
    <div class="sub" style="margin:0 0 10px">${t("shop_stickers_sub")}</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px">
      ${(shopStickers.length ? shopStickers : STICKERS_SEED).map(s=>{
        const price = s.price||1200;
        const isOwned = owned.has(s.id);
        const isEquipped = equipped === s.id;
        return `<div class="card" style="padding:12px;text-align:center;margin:0;${isEquipped?"border:1px solid var(--green)":""}">
          <div style="display:flex;justify-content:center;margin-bottom:6px">${stickerFaceHTML(s, 48)}</div>
          <div style="font-size:12px;font-weight:700">${esc(s.label)}</div>
          ${isOwned
            ? `<button class="btn ${isEquipped?"green":"ghost"} small" style="margin-top:8px;width:100%;justify-content:center" onclick="equipSticker('${s.id}')">${isEquipped?"✓ "+t("shop_equipped"):t("shop_equip")}</button>`
            : `<div class="priceTag" style="margin-top:6px">✦ ${fmt(price)}</div><button class="btn small" style="margin-top:6px;width:100%;justify-content:center" onclick="buySticker('${s.id}')">${t("shop_buy")}</button>`}
        </div>`;
      }).join("")}
    </div>
`;
}
async function buyNameColor(){
  try{
    if (!shopPick) return toast(t("pick_color"));
    const p = pointsFor(session.name, session.code);
    if (p.available < 1000) return toast(t("t_no_pts",{n:fmt(1000-p.available)}));
    const emp = await DB.get("employees", session.code);
    await DB.set("employees", session.code, {...emp, nameColor: shopPick, spentPts: (emp.spentPts||0)+1000});
    toast(t("t_bought")); celebrate();
    await loadEmpDirectory();
    applyNameColor();
    renderShop(); renderEmpPoints(); renderLeaderboard();
  }catch(e){ toast("❌ " + t("err") + e.message); }
}
function applyNameColor(){
  if (session?.role!=="emp") return;
  const emp = employees.find(e=>e.id===session.code);
  if ($("empWhoName")) $("empWhoName").style.color = emp?.nameColor || "";
}
async function loadEmpDirectory(){ employees = await DB.list("employees"); }
function renderLeaderboard(){
  /* ---- Admin/master board: sales-based, shows SAR amounts (unchanged, admin/master only) ---- */
  const agg = salesByName();
  const list = Object.entries(agg).map(([name,amount])=>({name,amount})).sort((a,b)=>b.amount-a.amount);
  const total = list.reduce((s,x)=>s+x.amount,0);
  const max = list[0]?.amount || 1;
  const photos = {}; employees.forEach(e=>{ if(e.photo) photos[e.name]=e.photo; });
  const htmlAdmin = list.length ? list.map((s,i)=>{
    const medal = i<3 ? ["🥇","🥈","🥉"][i] : (i+1);
    const av = photos[s.name] ? `<img src="${photos[s.name]}" alt="">` : esc(s.name.trim()[0]||"?");
    const p = pointsFor(s.name);
    const emp = employees.find(e=>e.name===s.name);
    return `<div class="lbRow r${i+1}" style="animation-delay:${i*70}ms">
      <div class="bar" style="width:${(s.amount/max*100).toFixed(1)}%"></div>
      <div class="lbRank">${medal}</div>
      ${framedAvatarHTML(emp, `<div class="lbAvatar">${av}</div>`, 40)}
      <div class="lbBody"><div class="lbName" style="${p.color?`color:${p.color}`:""}">${esc(s.name)} ${streakBadgeFor(s.name)}${taskStreakBadge(emp)}${stickerBadgeHTML(emp)}${achvRowHTML(emp,22)}</div><div class="lbPts">✦ ${fmt(p.available)} ${t("pts")}</div></div>
      <div class="lbAmt">${fmt(s.amount)} <small>${t("sar")}</small></div>
    </div>`;
  }).join("") : emptyState("no_lb","trophy");
  if ($("lbAdmin")) $("lbAdmin").innerHTML = skylrRowHTML() + htmlAdmin;
  const meta = list.length ? t("lb_meta",{n:sellerReports.length, amt:fmt(total)}) : "";
  if ($("topMeta")) $("topMeta").textContent = meta;

  /* ---- Employee-facing board: points ranking only — sales figures hidden from staff for now ---- */
  const ptsList = employees.map(e => ({emp:e, p: pointsFor(e.name, e.id)}))
    .sort((a,b) => b.p.available - a.p.available);
  const maxPts = ptsList[0]?.p.available || 1;
  const htmlEmp = ptsList.length ? ptsList.map((x,i)=>{
    const medal = i<3 ? ["🥇","🥈","🥉"][i] : (i+1);
    const av = x.emp.photo ? `<img src="${x.emp.photo}" alt="">` : esc((x.emp.name||"?").trim()[0]);
    const isGhost = !!x.emp.ghost;
    const clickAttr = isGhost ? "" : `onclick="openEmpProfile('${x.emp.id}','E')" style="cursor:pointer"`;
    const sub = isGhost ? `<div style="font-size:11px;color:var(--muted)">📍 ${esc(x.emp.branch||"—")}</div>` : "";
    return `<div class="lbRow r${i+1}" style="animation-delay:${i*70}ms">
      <div class="bar" style="width:${(x.p.available/maxPts*100).toFixed(1)}%"></div>
      <div class="lbRank">${medal}</div>
      ${framedAvatarHTML(x.emp, `<div class="lbAvatar">${av}</div>`, 40)}
      <div class="lbBody" ${clickAttr}><div class="lbName" style="${x.p.color?`color:${x.p.color}`:""}">${esc(x.emp.name)} ${isGhost?"":streakBadgeFor(x.emp.name)+taskStreakBadge(x.emp)}${stickerBadgeHTML(x.emp)}${achvRowHTML(x.emp,22)}</div>${sub}</div>
      <div class="lbAmt">✦ ${fmt(x.p.available)} <small>${t("pts")}</small></div>
    </div>`;
  }).join("") : emptyState("no_lb","trophy");
  /* قائمة الفريق عند الموظف موحّدة الآن في renderRankBoardInto("lbEmp") */
  if ($("topMetaEmp")) $("topMetaEmp").textContent = "";
  renderRankBoardInto("lbEmp");
}
async function resetLeaderboard(){
  if (!confirm(t("c_reset_lb"))) return;
  for (const r of sellerReports) await DB.del("seller_reports", r.id);
  toast(t("t_lb_reset"));
  loadLeaderboard();
}
function renderEmpPoints(){
  if (session?.role !== "emp") return;
  const p = pointsFor(session.name, session.code);
  if ($("empPtsChip")) $("empPtsChip").textContent = fmt(p.available);
  const el = $("empPtsStats"); if(!el) return;
  el.innerHTML = `
    <div class="stat"><div class="v" style="color:var(--gold)">${fmt(p.available)}</div><div class="l">${t("pts_available")}</div></div>
    <div class="stat"><div class="v">${fmt(p.salesPts)}</div><div class="l">${t("pts_sales")} (${fmt(p.sales)} ${t("sar")})</div></div>
    <div class="stat"><div class="v">${fmt(p.accPts)}</div><div class="l">${t("pts_acc")}</div></div>
    <div class="stat"><div class="v" style="color:var(--muted)">${fmt(p.spent)}</div><div class="l">${t("pts_spent")}</div></div>`;
  renderShop();
}

/* ---------- employees + staff directory ---------- */
let staffNames = [];
async function ensureStaff(name){
  name = String(name).replace(/\s+/g," ").trim();
  if (!name) return;
  const id = docId(name);
  if (!(await DB.get("staff_directory", id))) await DB.set("staff_directory", id, {name});
}
async function seedStaff(){ for (const n of SEED_STAFF) await ensureStaff(n); await loadStaffList(); }
async function loadStaffList(){
  staffNames = (await DB.list("staff_directory")).map(s=>s.name).sort();
  const dl = $("staffList");
  if (dl) dl.innerHTML = staffNames.map(n=>`<option value="${esc(n)}">`).join("");
}
async function loadEmployees(){
  employees = await DB.list("employees");
  renderEmpList(); renderGhostList(); renderPhotoApprovals(); fillTaskSelectors(); fillParSelectors(); renderRankBoards();
  renderVerifyList();
}
function renderEmpList(){
  const el = $("empList"); if(!el) return;
  const list = visibleEmps();
  const skylr = session?.role==="admin" ? `
    <div class="taskItem" style="border-color:var(--line2)">
      <div style="display:flex;align-items:center;gap:10px;min-width:0">
        <div class="lbAvatar" style="width:36px;height:36px">${adminProfile?.photo?`<img src="${adminProfile.photo}" alt="">`:"S"}</div>
        <div style="min-width:0"><b style="color:var(--lav2)">Skylr</b>
          <div style="font-size:12px;color:var(--muted)">${t("role_master")}</div>
        </div>
      </div>
    </div>` : "";
  el.innerHTML = skylr + (list.length ? list.map(e=>{
    const p = pointsFor(e.name, e.id);
    return `<div class="taskItem">
      <div style="display:flex;align-items:center;gap:10px;min-width:0">
        <div class="lbAvatar" style="width:36px;height:36px">${e.photo?`<img src="${e.photo}" alt="">`:esc(e.name.trim()[0])}</div>
        <div style="min-width:0"><b style="cursor:pointer;${e.nameColor?`color:${e.nameColor}`:""}" onclick="openEmpProfile('${e.id}')" title="${t("profile_open_hint")}">${esc(e.name)}</b>${verifyBadge(e)}${e.displayName?` <span class="pill a" style="font-size:10px">${esc(e.displayName)}</span>`:""} ${streakBadgeFor(e.name)}${taskStreakBadge(e)}${stickerBadgeHTML(e)}${achvRowHTML(e)}
          <div style="font-size:12px;color:var(--muted)">${t("code")}: <span class="num">${e.id}</span> · <span style="color:var(--gold)">✦ ${fmt(p.total)} ${t("pts")}</span>${(e.branch&&e.branch!=="MAIN")?` · <span class="branchPill">${esc(e.branch)}</span>`:""}</div>
        </div>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn ghost small" onclick="openAchvPicker('${e.id}','${esc(e.name)}')">🏅 ${t("achv_btn")}</button>
        <button class="btn ghost small" onclick="addBonusPoints('${e.id}','${esc(e.name)}')">✦ ${t("add_pts_btn")}</button>
        <button class="btn danger small" onclick="delEmployee('${e.id}')">${ico("x")}${t("del")}</button>
      </div>
    </div>`;
  }).join("") : emptyState("no_emps","users"));
}
async function addBonusPoints(code, name){
  const raw = prompt(t("add_pts_prompt", {name}));
  if (raw===null) return;
  const n = parseInt(raw, 10);
  if (!n || isNaN(n)) return toast(t("add_pts_invalid"));
  try{
    const emp = await DB.get("employees", code); if (!emp) return;
    const bonusPts = (emp.bonusPts||0) + n;
    await DB.set("employees", code, {...emp, bonusPts});
    toast("✅ " + t("t_pts_added", {n, name}));
    await loadEmployees(); renderLeaderboard();
  }catch(e){ toast("❌ " + t("err") + e.message); }
}
async function addEmployee(){
  try{
    const name = $("empName").value.replace(/\s+/g," ").trim(), code = $("empCode").value.trim();
    if (!name) return toast(t("t_name_req"));
    if (!/^\d{4}$/.test(code)) return toast(t("t_code4"));
    if (ADMIN_CODE.startsWith(code)) return toast(t("t_code_reserved"));
    if ((await DB.get("employees", code)) || (await DB.get("supervisors", code))) return toast(t("t_code_used"));
    await DB.set("employees", code, {name, createdAt: Date.now(), branch: session?.sup ? session.branch : "MAIN"});
    await ensureStaff(name);
    $("empName").value=""; $("empCode").value="";
    toast("✅ " + t("t_emp_added"));
    await loadEmployees(); await loadStaffList(); renderLeaderboard();
  }catch(e){ toast("❌ " + t("err") + e.message); }
}
async function delEmployee(code){
  const emp = employees.find(e=>e.id===code);
  if (!confirm(t("c_del_emp_full",{name: emp?.name || code}))) return;
  showLoadingCloud();
  try{
    const name = emp?.name;
    /* 1) مهامه */
    const tasks = await DB.list("tasks").catch(()=>[]);
    for (const x of tasks){
      if (x.empCode===code || (name && x.empName===name)) await DB.del("tasks", x.id).catch(()=>{});
    }
    /* 2) مبيعاته من تقارير البائعين (المبالغ) */
    if (name){
      for (const rep of (await DB.list("seller_reports").catch(()=>[]))){
        const before = (rep.sellers||[]).length;
        const sellers = (rep.sellers||[]).filter(s=>s.name!==name);
        if (sellers.length !== before) await DB.set("seller_reports", rep.id, {...rep, sellers}).catch(()=>{});
      }
      /* 3) كمياته من التقرير التفصيلي */
      for (const doc of (await DB.list("emp_sales_detail").catch(()=>[]))){
        const before = (doc.users||[]).length;
        const users = (doc.users||[]).filter(u=>u.name!==name && u.code!==code);
        if (users.length !== before) await DB.set("emp_sales_detail", doc.id, {...doc, users}).catch(()=>{});
      }
    }
    /* 4) حسابه نفسه */
    await DB.del("employees", code);
    toast("🗑️ " + t("t_emp_deleted_full"));
    await Promise.all([loadEmployees(), loadLeaderboard(), loadTasks().catch(()=>{}), loadResults().catch(()=>{}), loadEmpSalesDetail(), loadTicketReports(), loadFnbReports(), loadPerfDaily(), loadKudos(), loadBranchBudget().catch(()=>{})]);
  }catch(e){ toast("❌ " + t("err") + e.message); }
  finally{ hideLoading(); }
}

/* ---------- profile photos ---------- */
$("photoFile").addEventListener("change", async e=>{
  const f = e.target.files[0]; if(!f) return; e.target.value="";
  try{
    const data = await fileToJpeg(f, {square:true, px:110}, .68);
    const emp = await DB.get("employees", session.code);
    await DB.set("employees", session.code, {...emp, photo: data, updatedAt: Date.now()});
    toast("✅ " + t("t_photo_ok"));
    await refreshEmpAvatar();
    await loadEmployees();
    renderLeaderboard();
  }catch(err){ toast("❌ " + t("t_photo_bad")); }
});
async function refreshEmpAvatar(){
  const emp = await DB.get("employees", session.code);
  const av = $("empAvatar");
  const btn = `<button class="photoBtn" onclick="document.getElementById('photoFile').click()">${ico("cam")}</button>`;
  av.innerHTML = (emp?.photo ? `<img src="${emp.photo}" alt="">` : esc(session.name.trim()[0]||"م")) + btn;
  $("empPhotoState").textContent = t("emp_role");
}
function renderPhotoApprovals(){
  const el = $("photoApprovals"); if(!el) return;
  const pend = employees.filter(e=>e.pendingPhoto);
  el.innerHTML = pend.length ? pend.map(e=>`
    <div class="taskItem">
      <div style="display:flex;align-items:center;gap:12px">
        <div class="lbAvatar" style="width:52px;height:52px;border-radius:14px"><img src="${e.pendingPhoto}" alt=""></div>
        <b>${esc(e.name)}</b>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn green small" onclick="approvePhoto('${e.id}',true)">${ico("check")}${t("approve")}</button>
        <button class="btn danger small" onclick="approvePhoto('${e.id}',false)">${ico("x")}${t("reject")}</button>
      </div>
    </div>`).join("") : emptyState("no_photos","cam");
}
async function approvePhoto(code, ok){
  const e = await DB.get("employees", code); if(!e) return;
  const upd = {...e};
  if (ok) upd.photo = e.pendingPhoto;
  delete upd.pendingPhoto; delete upd.pendingAt;
  await DB.set("employees", code, upd);
  toast(ok ? t("t_photo_ok") : t("t_photo_no"));
  await loadEmployees(); renderLeaderboard();
}

/* ---------- tasks ---------- */
function taskTypeLabel(type){
  return type==="count" ? t("count_task")
       : type==="usher" ? t("usher_task")
       : type==="joker" ? t("joker_task")
       : type==="space" ? t("space_task")
       : t("expiry_task");
}
/* رفع الصور مسموح لمهام الأشر والجوكر فقط — موظف الجرد ما يرفع صور */
function taskAllowsPhoto(type){ return type==="usher" || type==="joker"; }
function fillTaskSelectors(){
  const es = $("taskEmp"), ls = $("taskLoc");
  if (!es) return;
  const vEmps = visibleEmps();
  es.innerHTML = vEmps.length ? vEmps.map(e=>`<option value="${e.id}">${esc(e.name)} (${e.id})</option>`).join("") : `<option value="">—</option>`;
  const type = $("taskType")?.value || "count";
  if (type === "usher")
    ls.innerHTML = `<option value="Cinema Halls">${esc(t("halls_label"))}</option>`;
  else if (type === "joker")
    ls.innerHTML = `<option value="Joker">${esc(t("joker_task"))}</option>`;
  else if (type === "expiry")
    ls.innerHTML = CATALOG_LOCS.map(l=>`<option value="${esc(l)}">${esc(locLabel(l))}</option>`).join("");
  else
    ls.innerHTML = latestSnap ? sortLocs(latestSnap.locations).map(l=>`<option value="${esc(l)}">${esc(locLabel(l))}</option>`).join("") : `<option value="">—</option>`;
  if (type === "space" && latestSnap){
    const rf = sortLocs(latestSnap.locations).find(isRefuel);
    if (rf) ls.value = rf;
  }
  fillSplitSelectors();
}
/* ---------- random inventory split across multiple employees ---------- */
function fillSplitSelectors(){
  const ls = $("splitLoc"); if (!ls) return;
  ls.innerHTML = latestSnap ? sortLocs(latestSnap.locations).map(l=>`<option value="${esc(l)}">${esc(locLabel(l))}</option>`).join("") : `<option value="">—</option>`;
  const el = $("splitEmpList"); if (!el) return;
  const vEmps = visibleEmps();
  el.innerHTML = vEmps.length ? vEmps.map(e=>`
    <label style="display:flex;align-items:center;gap:8px;font-size:13.5px;cursor:pointer">
      <input type="checkbox" value="${e.id}" style="width:16px;height:16px">
      ${esc(e.name)} <span class="num" style="color:var(--muted)">(${e.id})</span>
    </label>`).join("") : emptyState("no_emps","users");
}
function shuffleItemsArr(arr){
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
async function createSplitTasks(){
  try{
    const loc = $("splitLoc")?.value;
    if (!loc || !latestSnap) return toast(t("t_upload_first"));
    const checked = [...document.querySelectorAll('#splitEmpList input[type="checkbox"]:checked')].map(x=>x.value);
    if (checked.length < 2) return toast(t("t_split_min2"));
    const items = shuffleItemsArr(latestSnap.items.filter(i=>i.loc===loc).map(i=>i.name));
    if (!items.length) return toast(t("t_upload_first"));
    const n = checked.length;
    const buckets = Array.from({length:n}, () => []);
    items.forEach((name, i) => buckets[i % n].push(name));
    let sentTo = 0;
    for (let k = 0; k < n; k++){
      if (!buckets[k].length) continue;
      const empCode = checked[k];
      const emp = employees.find(e => e.id === empCode);
      if (!emp) continue;
      const id = "T" + Date.now() + "_" + k + "_" + Math.random().toString(36).slice(2,6);
      await DB.set("tasks", id, {
        type: "count", warehouse: loc, empCode, empName: emp.name,
        branch: curBranch(), snapId: snapKeyFor(curBranch(), todayKey()),
        items: buckets[k], status: "pending", createdAt: Date.now() + k, createdOn: todayKey()
      });
      sentTo++;
    }
    document.querySelectorAll('#splitEmpList input[type="checkbox"]').forEach(x => x.checked = false);
    toast("✅ " + t("t_split_done", {n: sentTo}));
    loadTasks();
  }catch(e){ toast("❌ " + t("err") + e.message); }
}
async function createTask(){
  try{
    const empCode = $("taskEmp").value, loc = $("taskLoc").value, type = $("taskType").value;
    if (!empCode) return toast(t("t_add_emp_first"));
    if ((type === "count" || type === "space") && (!loc || !latestSnap)) return toast(t("t_upload_first"));
    const emp = employees.find(e=>e.id===empCode);
    if (type === "space"){ $("taskLoc").value = loc; $("parLoc").value = loc; $("parEmp").value = empCode; return sendSpaceTask(); }
    const items = type === "joker"
      ? []
      : type === "usher"
      ? [1,2,3,4].map(n=>`${t("hall")} ${n}`)
      : type === "expiry"
      ? EXPIRY_CATALOG.filter(c=>c.loc===loc).map(c=>c.name)
      : latestSnap.items.filter(i=>i.loc===loc).map(i=>i.name);
    const id = "T"+Date.now();
    await DB.set("tasks", id, {
      type, warehouse: loc, empCode, empName: emp.name,
      branch: curBranch(), snapId: snapKeyFor(curBranch(), todayKey()),
      items, status:"pending", createdAt: Date.now(), createdOn: todayKey()
    });
    toast("✅ " + t("t_task_sent",{n:emp.name}));
    loadTasks();
  }catch(e){ toast("❌ " + t("err") + e.message); }
}
async function loadTasks(){
  allTasks = filterBranchTasks(await DB.list("tasks")).sort((a,b)=>b.createdAt-a.createdAt);
  renderTaskList();
}
/* ترتيب المهام يدوياً بالسحب والإفلات — يُحفظ في السحابة داخل حقل order */
let taskSortable = null;
function sortedTasks(){
  return [...allTasks].sort((a,b)=>{
    const ao = a.order, bo = b.order;
    if (ao != null && bo != null) return ao - bo;
    if (ao != null) return -1;            /* المرتّبة يدوياً فوق */
    if (bo != null) return 1;
    return (b.createdAt||0) - (a.createdAt||0);
  });
}
function renderTaskList(){
  const el = $("taskList"); if(!el) return;
  const list = sortedTasks();
  el.innerHTML = list.length ? list.map(x=>`
    <div class="taskItem" data-id="${esc(x.id)}">
      <div style="display:flex;align-items:center;gap:10px;min-width:0">
        <span class="dragHandle" title="${t("drag_hint")}">⠿</span>
        <div style="min-width:0">
          <b>${taskTypeLabel(x.type)}</b>${x.type==="joker"?"":" — "+esc(locLabel(x.warehouse))}
          <div style="font-size:12px;color:var(--muted)">${esc(x.empName)} · ${x.createdOn} · ${(x.items||[]).length} ${t("items")}${(!session?.sup && x.branch && x.branch!=="MAIN")?` · <span class="branchPill">${esc(x.branch)}</span>`:""}</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <span class="pill ${x.status==="done"?"g":"a"}">${x.status==="done"?t("done_pill"):t("waiting_pill")}</span>
        <button class="btn danger small" onclick="delTask('${x.id}')">${ico("x")}${t("del")}</button>
      </div>
    </div>`).join("") : emptyState("no_tasks","send");
  initTaskSortable();
}
function initTaskSortable(){
  const el = $("taskList");
  if (!el || typeof Sortable === "undefined") return;
  if (taskSortable){ try{ taskSortable.destroy(); }catch(e){} taskSortable = null; }
  if (!allTasks.length) return;
  taskSortable = Sortable.create(el, {
    handle: ".dragHandle",
    animation: 170,
    ghostClass: "dragGhost",
    chosenClass: "dragChosen",
    onEnd: saveTaskOrder
  });
}
async function saveTaskOrder(){
  const el = $("taskList"); if (!el) return;
  const ids = [...el.querySelectorAll(".taskItem")].map(n=>n.dataset.id);
  try{
    for (let i=0;i<ids.length;i++){
      const task = allTasks.find(x=>x.id===ids[i]);
      if (!task || task.order === i) continue;
      task.order = i;
      await DB.set("tasks", task.id, {...task});
    }
    toast("✅ " + t("t_order_saved"));
  }catch(e){ console.warn(e); toast("❌ " + t("err") + e.message); }
}
async function delTask(id){ if(!confirm(t("c_del_task")))return; await DB.del("tasks",id); await loadTasks(); loadResults(); loadExpPending(); }

/* ---------- count results ---------- */
let doneCounts = [], openResult = null;
async function loadResults(){
  allTasks = filterBranchTasks(await DB.list("tasks")).sort((a,b)=>b.createdAt-a.createdAt);
  doneCounts = allTasks.filter(x=>x.status==="done" && (x.type==="count" || x.type==="usher" || x.type==="space" || x.type==="joker")).sort((a,b)=>b.submittedAt-a.submittedAt);
  renderResultsList(); renderLeaderboard();
  /* افتح ستريك لكل موظف حسب مهامه المنجزة، وامنح الإنجازات المستحقة */
  syncTaskStreaks().catch(()=>{});
  syncAutoAchievements().catch(()=>{});
}
function renderResultsList(){
  const el = $("resultsList"); if(!el) return;
  const dayOf = x => new Date(x.submittedAt).toISOString().slice(0,10);
  const days = [...new Set(doneCounts.map(dayOf))].sort().reverse();
  const sel = $("resDayFilter");
  if (sel){
    const cur = sel.value;
    sel.innerHTML = `<option value="">${t("all_days")}</option>` + days.map(d=>`<option value="${d}">${d}</option>`).join("");
    if (days.includes(cur)) sel.value = cur;
  }
  const pick = sel?.value || "";
  const list = doneCounts.filter(x=>!pick || dayOf(x)===pick);
  if (!list.length){ el.innerHTML = emptyState("no_res","clip"); return; }
  let html = "", lastDay = "";
  for (const x of list){
    const d = dayOf(x);
    if (d !== lastDay){
      lastDay = d;
      html += `<div style="margin:14px 0 8px;font-family:'JetBrains Mono','Almarai';font-weight:700;color:var(--lav);font-size:13px;display:flex;align-items:center;gap:8px">${ico("cal")} ${t("day_reports")} ${d}</div>`;
    }
    const isUsher = x.type==="usher" || x.type==="joker";
    const reviewed = !!x.reviewed;
    html += `<div class="taskItem" style="${reviewed?"":"border-color:rgba(251,191,36,.4)"}">
      <div><b>${esc(x.empName)}</b> — ${taskTypeLabel(x.type)}${isUsher?"":" · "+esc(locLabel(x.warehouse))}
        <div style="font-size:12px;color:var(--muted)">
          ${t("submitted")}: ${new Date(x.submittedAt).toLocaleString("en-GB")} · ${x.type==="joker"?(x.photo||x.hadPhoto?"📷":"📝"):isUsher?`${(x.rounds||[]).length} ${t("round")}`:`${(x.items||[]).length} ${t("items")}`}
          · <span style="color:var(--gold)">✦ ${x.points||0} ${t("res_pts")}</span>${isUsher?"":x.type==="space"?` (<span style="color:var(--green)">✓ ${x.matched||0}</span> · <span style="color:var(--red)">✗ ${x.mismatched||0}</span>)`:` (${x.matched||0} ${t("res_acc")})`}
          ${reviewed?` · <span style="color:var(--green)">✓ ${t("task_reviewed")}</span>`:` · <span style="color:var(--amber)">⏳ ${t("task_not_reviewed")}</span>`}
        </div>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn ${reviewed?"ghost":"green"} small" onclick="toggleTaskReviewed('${x.id}')">${reviewed?t("task_unreview_btn"):t("task_review_btn")}</button>
        <button class="btn small" onclick="openResultDetail('${x.id}')">${ico("clip")}${x.type==="joker"?t("view_joker"):isUsher?t("view_rounds"):t("view_cmp")}</button>
      </div>
    </div>`;
  }
  el.innerHTML = html;
}
async function toggleTaskReviewed(id){
  const x = allTasks.find(t=>t.id===id); if (!x) return;
  const reviewed = !x.reviewed;
  try{
    await DB.set("tasks", id, {...x, reviewed});
    toast(reviewed ? "✅ " + t("t_marked_reviewed") : t("t_unmarked_reviewed"));
    await loadResults();
  }catch(e){ toast("❌ " + t("err") + e.message); }
}
async function snapFor(x){
  return (await DB.get("inv_snapshots", x.snapshotDate)) || (await DB.get("inv_snapshots", x.createdOn)) || latestSnap;
}
async function resultRows(x){
  const sysMap = {};
  const snap = await snapFor(x);
  if (snap) snap.items.filter(i=>i.loc===x.warehouse).forEach(i=>sysMap[i.name]=i.qty);
  return x.items.map(name=>{
    const sys = sysMap[name], raw = x.results?.[name];
    const p = raw===undefined||raw===""?null:parseFloat(raw);
    const diff = (sys!==undefined && p!==null) ? +(p-sys).toFixed(2) : null;
    return {name, sys, p, diff};
  });
}
/* بعد ما يشوف المشرف الصور تُحذف من السحابة نهائياً — نحتفظ بعلامة فقط، توفيراً للمساحة */
async function purgeTaskPhotos(x){
  try{
    if (!taskAllowsPhoto(x.type)) return;
    const hasPhoto = !!x.photo || (x.rounds||[]).some(r=>r.photo);
    if (!hasPhoto) return;
    const clean = {...x, photo: null, photoSeenAt: Date.now(),
                   rounds: (x.rounds||[]).map(r=>({...r, photo: r.photo ? null : null, hadPhoto: !!r.photo}))};
    if (x.photo) clean.hadPhoto = true;
    await DB.set("tasks", x.id, clean);
    const i = allTasks.findIndex(r=>r.id===x.id); if (i>-1) allTasks[i] = clean;
    const j = doneCounts.findIndex(r=>r.id===x.id); if (j>-1) doneCounts[j] = clean;
    toast("🗑 " + t("t_photo_purged"));
  }catch(e){ console.warn(e); }
}
async function openResultDetail(id){
  const x = doneCounts.find(r=>r.id===id); if(!x) return;
  openResult = x;
  $("resultDetailCard").classList.remove("hidden");
  $("resultDetailTitle").textContent = `${x.empName} — ${taskTypeLabel(x.type)} · ${locLabel(x.warehouse)}`;
  if (x.type === "joker"){
    $("resultDetailMeta").innerHTML = `<span style="color:var(--gold)">✦ ${x.points||0} ${t("res_pts")}</span> · ${new Date(x.submittedAt).toLocaleString("en-GB")}`;
    $("resultDetailBody").innerHTML = `<tr><td colspan="4" style="padding:16px">
      ${x.note?`<div style="font-size:13.5px;line-height:1.7;margin-bottom:10px">${esc(x.note)}</div>`:""}
      ${x.photo?`<img src="${x.photo}" style="max-width:260px;border-radius:12px;border:1px solid var(--line)">
                 <div class="sub" style="margin-top:8px">${t("photo_will_delete")}</div>`
               :`<div class="sub">${x.hadPhoto?t("photo_deleted"):t("photo_none")}</div>`}
    </td></tr>`;
    $("resultDetailCard").scrollIntoView?.({behavior:"smooth"});
    purgeTaskPhotos(x);
    return;
  }
  if (x.type === "usher"){
    $("resultDetailMeta").innerHTML = `<span style="color:var(--gold)">✦ ${x.points||0} ${t("res_pts")}</span> · ${(x.rounds||[]).length} ${t("round")}`;
    $("resultDetailBody").innerHTML = `<tr><td colspan="4" style="padding:14px">` + (x.rounds||[]).map((r,i)=>`
      <div style="border:1px solid var(--line);border-radius:12px;padding:12px;margin-bottom:10px;background:var(--card2)">
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
          <span class="pill">${t("round")} ${i+1} · <span class="num">${esc(r.time)}</span></span>
          ${r.temps.map((tv,hi)=>`<span class="batchChip">${t("hall")} ${hi+1}: <span class="num">${esc(tv)}°</span></span>`).join("")}
          <span class="pill ${r.wc==="clean"?"g":r.wc==="mid"?"a":"r"}">${t("wc_lbl")}: ${r.wc==="clean"?t("wc_clean"):r.wc==="mid"?t("wc_mid"):t("wc_bad")}</span>
        </div>
        ${r.photo?`<img src="${r.photo}" style="margin-top:10px;max-width:180px;border-radius:10px;border:1px solid var(--line)">
                   <div class="sub" style="margin-top:6px">${t("photo_will_delete")}</div>`
                 :(r.hadPhoto?`<div class="sub" style="margin-top:6px">${t("photo_deleted")}</div>`:"")}
      </div>`).join("") + `</td></tr>`;
    $("resultDetailCard").scrollIntoView?.({behavior:"smooth"});
    purgeTaskPhotos(x);
    return;
  }
  if (x.type === "space"){
    const tg = x.targets || {};
    $("resultDetailMeta").innerHTML = `<span style="color:var(--gold)">✦ ${x.points||0} ${t("res_pts")}</span> · <span style="color:var(--green)">✓ ${x.matched||0}</span> · <span style="color:var(--red)">✗ ${x.mismatched||0}</span>`;
    $("resultDetailBody").innerHTML = x.items.map(name=>{
      const raw = x.results?.[name];
      const p = raw===undefined||raw===""?null:parseFloat(raw);
      const target = tg[name];
      let tag;
      if (p===null) tag = `<span class="pill" style="opacity:.6">${t("space_skipped")}</span>`;
      else if (Math.abs(p-target)<0.01) tag = `<span class="pill g">${ico("check")}${t("space_match")}</span>`;
      else tag = `<span class="pill r">✗ ${(p-target)>0?"+":""}${fmt(+(p-target).toFixed(2))}</span>`;
      return `<tr><td>${esc(name)}</td><td class="num">${fmt(target)}</td><td class="num">${p===null?"—":fmt(p)}</td><td>${tag}</td></tr>`;
    }).join("");
    $("resultDetailCard").scrollIntoView?.({behavior:"smooth"});
    return;
  }
  $("resultDetailMeta").innerHTML = `<span style="color:var(--gold)">✦ ${x.points||0} ${t("res_pts")}</span> · ${x.matched||0} ${t("res_acc")}`;
  const rows = await resultRows(x);
  $("resultDetailBody").innerHTML = rows.map(r=>{
    const dTxt = r.diff===null?"—":r.diff===0?`<span class="pill g">${ico("check")} 0</span>`:`<span class="num ${r.diff>0?"pos":"neg"}">${r.diff>0?"+":""}${fmt(r.diff)}</span>`;
    return `<tr><td>${esc(r.name)}</td><td class="num">${r.sys===undefined?"—":fmt(r.sys)}</td><td class="num">${r.p===null?"—":fmt(r.p)}</td><td>${dTxt}</td></tr>`;
  }).join("");
  $("resultDetailCard").scrollIntoView?.({behavior:"smooth"});
}
async function downloadResultPDF(){
  if (!openResult) return;
  const x = openResult;
  const rows = (await resultRows(x)).map(r=>`
    <tr><td>${esc(r.name)}</td><td>${r.sys===undefined?"—":fmt(r.sys)}</td><td>${r.p===null?"—":fmt(r.p)}</td>
    <td style="color:${r.diff>0?"#059669":r.diff<0?"#dc2626":"#555"}">${r.diff===null?"—":(r.diff>0?"+":"")+fmt(r.diff)}</td></tr>`).join("");
  const w = window.open("", "_blank");
  w.document.write(`<!DOCTYPE html><html lang="${LANG}" dir="${LANG==="ar"?"rtl":"ltr"}"><head><meta charset="UTF-8">
  <title>${t("rep_title")} - ${esc(x.empName)}</title>
  <style>
    body{font-family:'Segoe UI',Tahoma,sans-serif;padding:30px;color:#111}
    h1{font-size:20px;color:#4c1d95} .meta{color:#555;font-size:13px;margin-bottom:18px;line-height:1.9}
    table{width:100%;border-collapse:collapse;font-size:12.5px}
    th{background:#4c1d95;color:#fff;padding:8px;text-align:${LANG==="ar"?"right":"left"}}
    td{padding:7px 8px;border-bottom:1px solid #ddd}
    tr:nth-child(even) td{background:#f7f5fb}
    .foot{margin-top:24px;color:#999;font-size:11px;text-align:center}
  </style></head><body>
  <h1>${t("rep_title")}</h1>
  <div class="meta">
    ${t("rep_emp")}: <b>${esc(x.empName)}</b> (${x.empCode})<br>
    ${t("rep_wh")}: <b>${esc(locLabel(x.warehouse))}</b><br>
    ${t("rep_date")}: ${new Date(x.submittedAt).toLocaleString("en-GB")} · ${t("rep_items")}: ${x.items.length} · ${t("rep_pts")}: ${x.points||0}
  </div>
  <table><thead><tr><th>${t("th_product")}</th><th>${t("th_sys_qty")}</th><th>${t("th_phys_qty")}</th><th>${t("th_diff")}</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <div class="foot">© 2026 Skylr — All Rights Reserved</div>
  <script>window.onload=()=>window.print()<\/script></body></html>`);
  w.document.close();
}
async function downloadDailyStockReport(){
  try{
    const pick = $("resDayFilter")?.value || new Date().toISOString().slice(0,10);
    const dayOf = x => new Date(x.submittedAt).toISOString().slice(0,10);
    const dayTasks = doneCounts.filter(x=>x.type==="count" && dayOf(x)===pick);
    if (!dayTasks.length) return toast(t("t_no_day_report"));
    const byWh = {};
    dayTasks.forEach(x => (byWh[x.warehouse] = byWh[x.warehouse] || []).push(x));
    let totalItems = 0, totalOk = 0, totalDiff = 0, sections = "";
    for (const loc of Object.keys(byWh).sort()){
      const tasks = byWh[loc];
      const rowMap = {};
      for (const x of tasks){
        const rows = await resultRows(x);
        rows.forEach(r => rowMap[r.name] = r); /* دمج نتائج كل الموظفين اللي جردوا نفس المستودع بنفس اليوم */
      }
      const rows = Object.values(rowMap);
      totalItems += rows.length;
      rows.forEach(r => { if (r.diff === 0) totalOk++; else if (r.diff !== null) totalDiff++; });
      const empNames = [...new Set(tasks.map(x => x.empName))].join("، ");
      sections += `
        <h2>${esc(locLabel(loc))}</h2>
        <div class="meta2">${t("rep_emp")}: <b>${esc(empNames)}</b> · ${t("rep_items")}: ${rows.length}</div>
        <table><thead><tr><th>${t("th_product")}</th><th>${t("th_sys_qty")}</th><th>${t("th_phys_qty")}</th><th>${t("th_diff")}</th></tr></thead>
        <tbody>${rows.map(r=>`
          <tr><td>${esc(r.name)}</td><td>${r.sys===undefined?"—":fmt(r.sys)}</td><td>${r.p===null?"—":fmt(r.p)}</td>
          <td style="color:${r.diff>0?"#059669":r.diff<0?"#dc2626":"#555"}">${r.diff===null?"—":(r.diff>0?"+":"")+fmt(r.diff)}</td></tr>`).join("")}</tbody></table>`;
    }
    const w = window.open("", "_blank");
    w.document.write(`<!DOCTYPE html><html lang="${LANG}" dir="${LANG==="ar"?"rtl":"ltr"}"><head><meta charset="UTF-8">
    <title>${t("daily_rep_title")} - ${pick}</title>
    <style>
      body{font-family:'Segoe UI',Tahoma,sans-serif;padding:30px;color:#111}
      h1{font-size:20px;color:#4c1d95} h2{font-size:15px;color:#4c1d95;margin-top:26px;border-bottom:2px solid #eee;padding-bottom:4px}
      .meta{color:#555;font-size:13px;margin-bottom:18px;line-height:1.9}
      .meta2{color:#777;font-size:12px;margin:4px 0 8px}
      table{width:100%;border-collapse:collapse;font-size:12.5px}
      th{background:#4c1d95;color:#fff;padding:8px;text-align:${LANG==="ar"?"right":"left"}}
      td{padding:7px 8px;border-bottom:1px solid #ddd}
      tr:nth-child(even) td{background:#f7f5fb}
      .foot{margin-top:24px;color:#999;font-size:11px;text-align:center}
    </style></head><body>
    <h1>${t("daily_rep_title")}</h1>
    <div class="meta">
      ${t("rep_date")}: <b>${pick}</b><br>
      ${t("daily_rep_wh_count")}: ${Object.keys(byWh).length} · ${t("rep_items")}: ${totalItems} · ${t("daily_rep_ok")}: ${totalOk} · ${t("mismatches")}: ${totalDiff}
    </div>
    ${sections}
    <div class="foot">© 2026 Skylr — All Rights Reserved</div>
    <script>window.onload=()=>window.print()<\/script></body></html>`);
    w.document.close();
  }catch(e){ toast("❌ " + t("err") + e.message); }
}
const CAT_SECTIONS = [
  ["DRINKS", ["Barbican","Monster","Rani","Shweppes","Vimto Can","Vimto Pet"], ["Refuel","Mini Store","Store"]],
  ["CHOCOLATES", ["M&M Peanuts 180 gm.","M&M Peanuts 45 gm.","M&M Choco 180 gm.","M&M Choco 45 gm.","Maltessers 37 gm.","Maltessers 175 gm."], ["Refuel","Mini Store","Store"]],
  ["BIBS", ["BIB- Coke","BIB - Coke zero","BIB - Fanta","BIB- Sprite"], ["Mini Store","Store"]],
  ["SNACKS", ["Beef Frankfurt","Chicken Frankfurt","Corn Butterfly","Corn Mushroom","Chesse sauce","Chesse masala","Caramel","Nachos Jalapenos","Nachos Salsa","Nachos chips","Popcorn Oil","Salt","Slush Blue Rasberry syrup","Slush Stawberry syrup"], ["Mini Store","Store"]]
];
const EXPIRY_CATALOG = (()=>{ const out=[]; let sr=0;
  for (const [sec, names, locs] of CAT_SECTIONS)
    for (const loc of locs) for (const name of names) out.push({sr:++sr, sec, name, loc});
  return out; })();
const CATALOG_LOCS = ["Refuel","Mini Store","Store"];
function catKey(loc,name){ return docId(loc+"__"+name); }
function remDH(dateStr){
  const ms = new Date(dateStr+"T00:00:00") - Date.now();
  if (ms <= 0) return {exp:true, txt:t("rem_exp"), warn:true};
  const d = Math.floor(ms/86400000), h = Math.floor((ms%86400000)/3600000);
  return {exp:false, d, h, txt:t("rem_dh",{d,h}), warn:d<=30};
}
let expiryBatches = [];
async function loadExpiry(){ expiryBatches = await DB.list("expiry_batches"); renderExpiry(); renderExpiryEmp(); renderExpStatus(); renderExpWatchList(); renderExpSyncPreview(); }
function batchChips(rec, adminMode){
  return (rec.batches||[]).map((b,i)=>{
    const r = remDH(b.date);
    return `<span class="batchChip"><span class="num">${fmt(b.qty)}</span> × <span class="num">${b.date}</span>
      <span class="rem ${r.exp?"exp":r.warn?"warn":""}">${r.txt}</span>
      ${adminMode?`<button class="bx" onclick="delBatch('${rec.id}',${i})" title="${t("del")}">×</button>`:""}</span>`;
  }).join("") || `<span style="color:var(--faint);font-size:12px">—</span>`;
}
function lastUpdatedTxt(ts){
  if (!ts) return "";
  const d = new Date(ts);
  const day = LANG==="ar" ? AR_DAYS[d.getDay()] : d.toLocaleDateString("en-GB",{weekday:"short"});
  return `${day} ${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()} ${d.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}`;
}
function nearestDate(rec){ const ds=(rec.batches||[]).map(b=>b.date).sort(); return ds[0]||"9999"; }
function renderExpiry(){
  const body = $("expBody"); if(!body) return;
  const q = ($("expSearch")?.value||"").toLowerCase();
  const rows = expiryBatches
    .filter(r=>(r.batches||[]).length && (!q || r.name.toLowerCase().includes(q) || r.loc.toLowerCase().includes(q)))
    .sort((a,b)=>nearestDate(a)<nearestDate(b)?-1:1);
  body.innerHTML = rows.length ? rows.map(r=>`
    <tr style="${r.hidden?"opacity:.45":""}"><td>${esc(r.name)}<div style="font-size:10.5px;color:var(--faint)">${esc(r.sec||"")}</div></td>
    <td><span class="pill">${esc(locLabel(r.loc))}</span></td>
    <td>${batchChips(r,true)}</td>
    <td style="font-size:12px">${esc(r.by||"—")}<div style="font-size:10.5px;color:var(--faint);direction:ltr;text-align:end">${lastUpdatedTxt(r.updatedAt)}</div></td>
    <td><button class="btn ghost small" onclick="verifyExpRow('${r.id}')">${ico("check")}${t("exp_verify_btn")}</button><div id="verifyR_${r.id}" style="margin-top:4px"></div></td>
    <td><button class="eyeBtn ${r.hidden?"off":""}" onclick="toggleHide('${r.id}')" title="${t("th_visibility")}">${r.hidden?"🙈":"👁"}</button></td></tr>`
  ).join("") : `<tr><td colspan="6">${emptyState("no_batches","cal")}</td></tr>`;
}
function expWatchList(limit){
  const list = [];
  for (const rec of expiryBatches){
    if (rec.hidden) continue;
    for (const b of (rec.batches||[])){
      if (!b.date) continue;
      const r = remDH(b.date);
      list.push({name:rec.name, loc:rec.loc, qty:+b.qty||0, date:b.date, days: r.exp?-1:r.d, txt:r.txt, exp:r.exp, warn:r.warn});
    }
  }
  list.sort((a,b)=> a.days - b.days);
  const top = list.slice(0, limit||25);
  return top.map(x=>{
    const inWarehouse = locRank(x.loc) === 0; /* Store = المستودع الخلفي */
    let transferAlert = false;
    if (inWarehouse){
      const hasConcession = expiryBatches.some(r=> r.name===x.name && locRank(r.loc)>0 && (r.batches||[]).some(b=>(+b.qty||0)>0));
      transferAlert = !hasConcession;
    }
    return {...x, transferAlert};
  });
}
function renderExpWatchList(){
  const body = $("expWatchBody"); if (!body) return;
  const rows = expWatchList(30);
  body.innerHTML = rows.length ? rows.map(x=>`
    <tr><td>${esc(x.name)}</td><td><span class="pill">${esc(locLabel(x.loc))}</span></td>
    <td class="num">${fmt(x.qty)}</td><td class="num" style="direction:ltr">${x.date}</td>
    <td><span class="rem ${x.exp?"exp":x.warn?"warn":""}">${x.txt}</span></td>
    <td>${x.transferAlert ? `<span class="pill r">🚚 ${t("exp_transfer_alert")}</span>` : "—"}</td></tr>`).join("")
    : `<tr><td colspan="6">${emptyState("no_batches","cal")}</td></tr>`;
}
function verifyExpRow(id){
  const r = expiryBatches.find(x=>x.id===id); if (!r) return;
  const el = $("verifyR_"+id); if (!el) return;
  const sLoc = stockLocFor(r.loc);
  const stockItems = (latestSnap && sLoc) ? latestSnap.items.filter(i=>i.loc===sLoc) : [];
  const m = matchStockItem(r.name, stockItems);
  const sum = (r.batches||[]).reduce((s,b)=>s+(+b.qty||0),0);
  if (!m){ el.innerHTML = `<span class="pill a">${t("cmp_none")}</span>`; return; }
  const ok = Math.abs(sum-m.qty) < 0.01;
  el.innerHTML = ok
    ? `<span class="pill g">${ico("check")}${t("cmp_ok")} (${fmt(sum)})</span>`
    : `<span class="pill r">${ico("x")}${t("cmp_bad")} ${fmt(sum)} ${t("vs_sys")} ${fmt(m.qty)} (${sum>m.qty?"+":""}${fmt(+(sum-m.qty).toFixed(2))})</span>`;
}
function renderExpiryEmp(){
  const body = $("expBodyEmp"); if(!body) return;
  const q = ($("expSearchEmp")?.value||"").toLowerCase();
  const rows = expiryBatches
    .filter(r=>!r.hidden && (r.batches||[]).length && (!q || r.name.toLowerCase().includes(q) || r.loc.toLowerCase().includes(q)))
    .sort((a,b)=>nearestDate(a)<nearestDate(b)?-1:1);
  body.innerHTML = rows.length ? rows.map(r=>`
    <tr><td>${esc(r.name)}</td><td><span class="pill">${esc(locLabel(r.loc))}</span></td>
    <td>${batchChips(r,false)}</td></tr>`
  ).join("") : `<tr><td colspan="3">${emptyState("no_batches","cal")}</td></tr>`;
}
async function toggleHide(id){
  const r = expiryBatches.find(x=>x.id===id); if(!r) return;
  await DB.set("expiry_batches", id, {...r, hidden: !r.hidden});
  loadExpiry();
}
async function delBatch(id, idx){
  if (!confirm(t("del_batch"))) return;
  const r = expiryBatches.find(x=>x.id===id); if(!r) return;
  const batches = [...(r.batches||[])]; batches.splice(idx,1);
  await DB.set("expiry_batches", id, {...r, batches});
  loadExpiry();
}
/* قوائم السنة/الشهر/اليوم: 2025-2029، 12 شهراً، أيام حسب الشهر */
function fillYMD(py, pm, pd){
  const y=$(py), m=$(pm), d=$(pd); if(!y) return;
  if (!y.options.length){
    y.innerHTML = [2025,2026,2027,2028,2029].map(v=>`<option>${v}</option>`).join("");
    m.innerHTML = Array.from({length:12},(_,i)=>`<option value="${i+1}">${String(i+1).padStart(2,"0")}</option>`).join("");
    const upd = ()=>{
      const days = new Date(+y.value, +m.value, 0).getDate();
      const cur = +d.value||1;
      d.innerHTML = Array.from({length:days},(_,i)=>`<option>${i+1}</option>`).join("");
      d.value = Math.min(cur, days);
    };
    y.addEventListener("change",upd); m.addEventListener("change",upd);
    y.value = new Date().getFullYear() >= 2025 && new Date().getFullYear() <= 2029 ? new Date().getFullYear() : 2026;
    m.value = new Date().getMonth()+1;
    upd();
  }
}
function ymdVal(py,pm,pd){ return `${$(py).value}-${String($(pm).value).padStart(2,"0")}-${String($(pd).value).padStart(2,"0")}`; }
function fillExpirySelectors(){
  const ls = $("expLoc"); if(!ls) return;
  const cur = ls.value;
  ls.innerHTML = CATALOG_LOCS.map(l=>`<option value="${esc(l)}">${esc(locLabel(l))}</option>`).join("");
  if (cur) ls.value = cur;
  fillExpProducts();
  fillYMD("expY","expM","expD");
}
function fillExpProducts(){
  const ps = $("expProduct"); if(!ps) return;
  const loc = $("expLoc").value;
  ps.innerHTML = EXPIRY_CATALOG.filter(c=>c.loc===loc).map(c=>`<option>${esc(c.name)}</option>`).join("") || `<option value="">—</option>`;
}
async function addBatchTo(loc, name, qty, date, by){
  const id = catKey(loc,name);
  const cat = EXPIRY_CATALOG.find(c=>c.loc===loc && c.name===name);
  const cur = (await DB.get("expiry_batches", id)) || {loc, name, sec:cat?.sec||"", sr:cat?.sr||0, batches:[], hidden:false};
  if ((cur.batches||[]).length >= 4) return {full:true};
  cur.batches = [...(cur.batches||[]), {qty:+qty, date}];
  cur.by = by; cur.updatedAt = Date.now();
  await DB.set("expiry_batches", id, cur);
  return {full:false};
}
async function adminSetExpiry(){
  try{
    const loc = $("expLoc").value, name = $("expProduct").value, qty = $("expQty").value;
    if (!loc || !name || !qty) return toast(t("pick_batch"));
    const r = await addBatchTo(loc, name, qty, ymdVal("expY","expM","expD"), t("admin_name"));
    if (r.full) return toast(t("batch_full"));
    $("expQty").value="";
    toast("✅ " + t("t_batch_added"));
    loadExpiry();
  }catch(e){ toast("❌ " + t("err") + e.message); }
}
/* ---------- تحميل الإكسل: تعبئة القالب الأصلي نفسه (نفس الألوان والستايل) ---------- */
function b64ToBuf(b64){
  const bin = atob(b64); const buf = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}
async function fillExpiryWorkbook(){
  const tpl = await loadExpiryTemplate();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(b64ToBuf(tpl));
  const ws = wb.worksheets[0];
  const map = {}; expiryBatches.forEach(r=>map[r.loc+"|"+r.name]=r);
  const hdr = JSON.parse(JSON.stringify(ws.getCell(6,12).style||{}));
  ws.getCell(6,13).value = "Last Updated (Day / Date / Time)";
  ws.getCell(6,13).style = hdr;
  ws.getColumn(13).width = 26;
  for (let r=7; r<=ws.rowCount; r++){
    const name = ws.getCell(r,3).value, loc = ws.getCell(r,4).value;
    if (!name || !loc) continue;
    const rec = map[String(loc)+"|"+String(name)];
    for (let i=0;i<4;i++){
      ws.getCell(r,5+i*2).value = rec?.batches?.[i]?.qty ?? null;
      ws.getCell(r,6+i*2).value = rec?.batches?.[i]?.date ?? null;
    }
    ws.getCell(r,13).value = rec?.updatedAt ? lastUpdatedTxt(rec.updatedAt) : null;
  }
  return wb;
}
async function downloadExpiryXLSX(){
  try{
    if (typeof ExcelJS === "undefined") return toast("❌ " + t("xlsx_lib_missing"));
    if (!document.getElementById("tplB64")) return toast("❌ " + t("xlsx_tpl_missing"));
    toast("⏳ " + t("xlsx_building"));
    await loadExpiry(); /* أحدث البيانات من السحابة لحظة التحميل */
    const wb = await fillExpiryWorkbook();
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "MONTHLY_EXPIRY_MONITORING_SHEET.xlsx";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 8000);
    toast("✅ " + t("xlsx_done"));
  }catch(e){ console.error(e); toast("❌ " + t("err") + e.message); }
}
/* قالب اكسل التواريخ: ملف خارجي يحمل مرة واحدة */
let _xlsxTpl = null;
async function loadExpiryTemplate(){
  if (_xlsxTpl) return _xlsxTpl;
  const r = await fetch("assets/data/expiry-template.b64");
  if (!r.ok) throw new Error("expiry-template.b64 " + r.status);
  _xlsxTpl = (await r.text()).replace(/\s+/g, "");
  return _xlsxTpl;
}
