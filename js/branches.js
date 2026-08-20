/* ============================================================
   BRANCHES — أداء الفروع (رفع ملف Excel أسبوعي)
   الملف يُقرأ في المتصفح ويُحفظ كبيانات في Realtime Database،
   فيشوفه كل الموظفين على كل الأجهزة فوراً.
   ============================================================ */

const Branches = (() => {
  let payload = null;     // { fileName, uploadedAt, uploadedBy, sheets:[{name, rows}] }
  let activeSheet = 0;
  const MAX_BYTES = 900 * 1024;   // حد آمن لسجل واحد في RTDB

  /* ---------- قراءة الملف ---------- */
  const parseFile = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("تعذّرت قراءة الملف"));
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
        const sheets = wb.SheetNames.map((name) => {
          const grid = XLSX.utils.sheet_to_json(wb.Sheets[name], {
            header: 1, blankrows: false, defval: ""
          });
          const rows = grid.map(r => (r || []).map(c => (c === null || c === undefined) ? "" : String(c)));
          return { name: String(name), rows };
        }).filter(s => s.rows.length);
        resolve(sheets);
      } catch (err) { reject(err); }
    };
    reader.readAsArrayBuffer(file);
  });

  /* ---------- عرض ---------- */
  const renderTabs = () => {
    const box = $("#br-tabs");
    if (!payload?.sheets?.length) { box.innerHTML = ""; return; }
    box.innerHTML = payload.sheets.map((s, i) =>
      `<button class="sheet-tab${i === activeSheet ? " is-active" : ""}" data-sheet="${i}">${esc(s.name)}</button>`
    ).join("");
  };

  const isNumeric = (v) => v !== "" && !Number.isNaN(Number(String(v).replace(/,/g, "")));

  const renderSheet = () => {
    const wrap = $("#br-wrap");
    const sheet = payload?.sheets?.[activeSheet];
    if (!sheet) {
      wrap.innerHTML = `<p class="empty">ارفع ملف الأداء الأسبوعي ليظهر هنا لكل الأجهزة.</p>`;
      return;
    }
    const [head, ...rest] = sheet.rows;
    const thead = `<thead><tr>${(head || []).map(c => `<th>${esc(c)}</th>`).join("")}</tr></thead>`;
    const tbody = `<tbody>${rest.map(r =>
      `<tr>${r.map(c => `<td class="${isNumeric(c) ? "num" : ""}">${esc(c)}</td>`).join("")}</tr>`
    ).join("")}</tbody>`;
    wrap.innerHTML = `<table class="tbl">${thead}${tbody}</table>`;
  };

  const renderMeta = () => {
    $("#br-meta").textContent = payload
      ? `${payload.fileName} · رُفع ${fmtDateTime(payload.uploadedAt)} بواسطة ${payload.uploadedBy || "—"}`
      : "لا يوجد ملف مرفوع بعد.";
  };

  const render = () => { renderMeta(); renderTabs(); renderSheet(); };

  /* ---------- تشغيل ---------- */
  const mount = () => {
    Store.onValue(Store.PATHS.BRANCHES, (val) => {
      payload = val || null;
      // RTDB يرجّع المصفوفات أحياناً كـ objects — نرجّعها مصفوفات
      if (payload?.sheets && !Array.isArray(payload.sheets)) {
        payload.sheets = Object.values(payload.sheets);
      }
      if (payload?.sheets) {
        payload.sheets = payload.sheets.map(s => ({
          name: s.name,
          rows: Array.isArray(s.rows) ? s.rows.map(r => Array.isArray(r) ? r : Object.values(r || {}))
                                      : Object.values(s.rows || {}).map(r => Array.isArray(r) ? r : Object.values(r || {}))
        }));
      }
      if (activeSheet >= (payload?.sheets?.length || 0)) activeSheet = 0;
      render();
    });

    $("#br-file").addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      toast("جارٍ قراءة الملف…");
      try {
        const sheets = await parseFile(file);
        if (!sheets.length) return toast("الملف فاضي أو غير مقروء");

        const record = {
          fileName: file.name,
          uploadedAt: new Date().toISOString(),
          uploadedBy: Auth.currentUser()?.id || "—",
          sheets
        };

        const size = new Blob([JSON.stringify(record)]).size;
        if (size > MAX_BYTES) {
          return toast(`الملف كبير (${Math.round(size / 1024)}KB). احذف الأعمدة أو الشيتات غير المستخدمة وأعد المحاولة.`);
        }

        await Store.set(Store.PATHS.BRANCHES, record);
        activeSheet = 0;
        toast("تم رفع ملف الأسبوع لكل الأجهزة");
      } catch (err) {
        toast("تعذّر رفع الملف: " + err.message);
      }
    });

    $("#br-tabs").addEventListener("click", (e) => {
      const i = e.target.getAttribute?.("data-sheet");
      if (i === null || i === undefined) return;
      activeSheet = Number(i);
      renderTabs();
      renderSheet();
    });

    $("#br-clear").addEventListener("click", () => {
      if (!payload) return toast("لا يوجد ملف لمسحه");
      confirmAction("مسح ملف الأداء الحالي؟ هذا يؤثر على كل الأجهزة.", async () => {
        try {
          await Store.remove(Store.PATHS.BRANCHES);
          toast("تم مسح الملف");
        } catch (err) { toast("تعذّر المسح: " + err.message); }
      });
    });
  };

  return { mount };
})();

window.Branches = Branches;
