/* ============================================================
   UTILS — DOM helpers, formatting, modal, toast, CSV
   ============================================================ */

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const esc = (v) => String(v ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

const fmtNum = (n) => {
  const x = Number(n);
  return Number.isFinite(x) ? x.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "0";
};

const fmtMoney = (n) => fmtNum(n) + " ر.س";

const todayISO = () => new Date().toISOString().slice(0, 10);

const fmtDateTime = (ts) => {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit"
  });
};

/* ---------------- Toast ---------------- */
let toastTimer = null;
const toast = (msg) => {
  const el = $("#toast");
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
};

/* ---------------- Modal ---------------- */
const Modal = (() => {
  const back = () => $("#modal");

  const open = (title, bodyHTML, onMount) => {
    $("#modal-title").textContent = title;
    $("#modal-body").innerHTML = bodyHTML;
    back().hidden = false;
    if (typeof onMount === "function") onMount($("#modal-body"));
    const firstInput = $("#modal-body input, #modal-body select, #modal-body textarea");
    if (firstInput) firstInput.focus();
  };

  const close = () => {
    back().hidden = true;
    $("#modal-body").innerHTML = "";
  };

  const init = () => {
    $("#modal-close").addEventListener("click", close);
    back().addEventListener("click", (e) => { if (e.target === back()) close(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !back().hidden) close();
    });
  };

  return { open, close, init };
})();

/* ---------------- Confirm ---------------- */
const confirmAction = (message, onYes) => {
  Modal.open("تأكيد", `
    <p style="margin:0 0 1rem">${esc(message)}</p>
    <div class="modal-actions">
      <button class="btn btn-danger" id="cf-yes">نعم، احذف</button>
      <button class="btn btn-ghost" id="cf-no">إلغاء</button>
    </div>
  `, (body) => {
    $("#cf-yes", body).addEventListener("click", () => { Modal.close(); onYes(); });
    $("#cf-no", body).addEventListener("click", Modal.close);
  });
};

/* ---------------- CSV export ---------------- */
const exportCSV = (filename, headers, rows) => {
  const cell = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.map(cell).join(","), ...rows.map(r => r.map(cell).join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  toast("تم تنزيل الملف");
};

/* ---------------- Empty-state table ---------------- */
const renderTable = (tableEl, headers, rows, emptyText) => {
  if (!rows.length) {
    tableEl.innerHTML = `<tbody><tr><td><p class="empty">${esc(emptyText)}</p></td></tr></tbody>`;
    return;
  }
  tableEl.innerHTML = `
    <thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead>
    <tbody>${rows.join("")}</tbody>`;
};

window.Modal = Modal;
