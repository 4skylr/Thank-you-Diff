/* ==========================================================
   Noir Cinema · 07-sidebar.js
   الشريط الجانبي للمشرف
   تنبيه: ترتيب التحميل في index.html مهم - لا تغيره.
   ========================================================== */

/* ============================================================
   PRO SIDEBAR — يُبنى من أزرار التبويبات الموجودة، فما يكسر showTab
   ============================================================ */
const SIDE_SECTIONS = [
  {id:"ops",   items:["pFiles","pInv","pRefill","pExpiry","pOrder"]},
  {id:"team",  items:["pEmp","pTasks","pResults","pTop"]},
  {id:"insight",items:["pCharts","pProfit","pSales","pPerf"]},
  {id:"admin", items:["pGRN","pBranches","pPetty","pFinance"]}
];
function buildSidebar(){
  if ($("proSide") || session?.role === "emp") return;
  const tabs = [...document.querySelectorAll("#adminTabs .tab")];
  if (!tabs.length) return;
  const byId = {}; tabs.forEach(b=>{ byId[b.dataset.p] = b; });
  const labelOf = b => (b.querySelector("span")?.textContent || b.textContent || "").trim();
  const iconOf  = b => b.querySelector("svg use")?.getAttribute("href") || "#i-clip";

  const used = new Set();
  let html = "";
  SIDE_SECTIONS.forEach(sec=>{
    const items = sec.items.filter(id=>byId[id]);
    if (!items.length) return;
    html += `<div class="proSection">${esc(t("side_"+sec.id))}</div>`;
    items.forEach(id=>{
      used.add(id);
      const b = byId[id];
      html += `<button class="proItem" data-p="${id}" data-label="${esc(labelOf(b))}" onclick="sideGo('${id}')">
          <svg class="ic"><use href="${iconOf(b)}"/></svg><span>${esc(labelOf(b))}</span></button>`;
    });
  });
  const rest = tabs.filter(b=>!used.has(b.dataset.p));
  if (rest.length){
    html += `<div class="proSection">${esc(t("side_more"))}</div>`;
    rest.forEach(b=>{
      html += `<button class="proItem" data-p="${b.dataset.p}" data-label="${esc(labelOf(b))}" onclick="sideGo('${b.dataset.p}')">
          <svg class="ic"><use href="${iconOf(b)}"/></svg><span>${esc(labelOf(b))}</span></button>`;
    });
  }
  const nav = document.createElement("nav");
  nav.id = "proSide"; nav.className = "proSide";
  nav.innerHTML = `
    <div class="proHead">
      <div class="proLogo">🎬</div>
      <div class="proBrand"><b>${esc(t("side_brand"))}</b><span>${esc(t("side_brand_sub"))}</span></div>
    </div>
    <div class="proScroll">${html}</div>
    <div class="proFoot">
      <button class="proToggle" onclick="toggleSidebar()" title="${esc(t("side_toggle"))}">
        <span id="proToggleIcon">⟨⟨</span><span id="proToggleTxt">${esc(t("side_collapse"))}</span>
      </button>
    </div>`;
  document.body.appendChild(nav);
  document.body.classList.add("hasSide");
  try{ if (localStorage.getItem("noir_side_mini") === "1") document.body.classList.add("sideMini"); }catch(e){}
  syncSidebarToggle();
  syncSidebarActive();
}
function sideGo(id){
  const b = document.querySelector(`#adminTabs .tab[data-p="${id}"]`);
  if (b){ b.click(); syncSidebarActive(); }
}
function syncSidebarActive(){
  const active = document.querySelector("#adminTabs .tab.active")?.dataset.p;
  document.querySelectorAll("#proSide .proItem").forEach(x=>x.classList.toggle("active", x.dataset.p === active));
}
function toggleSidebar(){
  const mini = document.body.classList.toggle("sideMini");
  try{ localStorage.setItem("noir_side_mini", mini ? "1" : "0"); }catch(e){}
  syncSidebarToggle();
}
function syncSidebarToggle(){
  const mini = document.body.classList.contains("sideMini");
  const ic = $("proToggleIcon"), tx = $("proToggleTxt");
  const rtl = (document.documentElement.dir || "rtl") === "rtl";
  if (ic) ic.textContent = mini ? (rtl ? "⟨⟨" : "⟩⟩") : (rtl ? "⟩⟩" : "⟨⟨");
  if (tx) tx.textContent = mini ? "" : t("side_collapse");
}
