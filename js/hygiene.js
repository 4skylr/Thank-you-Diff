/* ============================================================
   HYGIENE — سجل النظافة اليومي
   ============================================================ */

const Hygiene = (() => {
  let rows = [];

  const AREAS = [
    "الصالة", "الكاونتر", "ماكينة البوبكورن", "ماكينة السلاش",
    "الثلاجات", "المستودع", "دورات المياه", "المطبخ"
  ];
  const STATES = [
    { key: "clean", label: "نظيف", cls: "ok" },
    { key: "needs", label: "يحتاج متابعة", cls: "warn" },
    { key: "fail",  label: "غير مطابق", cls: "bad" }
  ];

  const stateOf = (k) => STATES.find(s => s.key === k) || STATES[1];

  const sorted = () => [...rows].sort((a, b) =>
    String(b.date || b.createdAt).localeCompare(String(a.date || a.createdAt)));

  const stats = () => {
    const today = todayISO();
    const todayRows = rows.filter(r => r.date === today);
    const count = (k) => todayRows.filter(r => r.status === k).length;
    $("#hyg-stats").innerHTML = `
      <div class="stat"><b>${fmtNum(todayRows.length)}</b><span>فحوصات اليوم</span></div>
      <div class="stat"><b style="color:var(--ok)">${fmtNum(count("clean"))}</b><span>نظيف</span></div>
      <div class="stat"><b style="color:var(--warn)">${fmtNum(count("needs"))}</b><span>يحتاج متابعة</span></div>
      <div class="stat"><b style="color:var(--bad)">${fmtNum(count("fail"))}</b><span>غير مطابق</span></div>`;
  };

  const render = () => {
    stats();
    const body = sorted().map(r => {
      const s = stateOf(r.status);
      return `
        <tr>
          <td class="num">${esc(r.date || "—")}</td>
          <td>${esc(r.area || "—")}</td>
          <td><span class="pill ${s.cls}">${esc(s.label)}</span></td>
          <td>${esc(r.note || "—")}</td>
          <td>${esc(r.createdBy || "—")}</td>
          <td><button class="btn btn-sm btn-danger" data-del="${esc(r.id)}">حذف</button></td>
        </tr>`;
    });
    renderTable($("#hyg-table"),
      ["التاريخ", "المنطقة", "الحالة", "ملاحظة", "الموظف", ""],
      body, "لا توجد فحوصات مسجّلة بعد.");
  };

  const openAdd = () => {
    Modal.open("تسجيل فحص نظافة", `
      <label class="field"><span>التاريخ</span>
        <input class="input" id="f-date" type="date" value="${todayISO()}" /></label>
      <label class="field"><span>المنطقة</span>
        <select class="input" id="f-area">${AREAS.map(a => `<option>${esc(a)}</option>`).join("")}</select></label>
      <label class="field"><span>الحالة</span>
        <select class="input" id="f-status">${STATES.map(s => `<option value="${s.key}">${esc(s.label)}</option>`).join("")}</select></label>
      <label class="field"><span>ملاحظة (اختياري)</span>
        <input class="input" id="f-note" placeholder="مثال: يحتاج تنظيف عميق" /></label>
      <div class="modal-actions">
        <button class="btn btn-primary" id="f-save">حفظ</button>
        <button class="btn btn-ghost" id="f-cancel">إلغاء</button>
      </div>
    `, (body) => {
      $("#f-cancel", body).addEventListener("click", Modal.close);
      $("#f-save", body).addEventListener("click", async () => {
        try {
          await Store.add(Store.PATHS.HYGIENE, {
            date: $("#f-date", body).value || todayISO(),
            area: $("#f-area", body).value,
            status: $("#f-status", body).value,
            note: $("#f-note", body).value.trim()
          });
          Modal.close();
          toast("تم حفظ الفحص");
        } catch (e) { toast("تعذّر الحفظ: " + e.message); }
      });
    });
  };

  const mount = () => {
    Store.onList(Store.PATHS.HYGIENE, (list) => { rows = list; render(); });
    $("#hyg-add").addEventListener("click", openAdd);

    $("#hyg-export").addEventListener("click", () => {
      if (!rows.length) return toast("لا توجد بيانات للتصدير");
      exportCSV(`hygiene-${todayISO()}.csv`,
        ["التاريخ", "المنطقة", "الحالة", "ملاحظة", "الموظف"],
        sorted().map(r => [r.date, r.area, stateOf(r.status).label, r.note, r.createdBy]));
    });

    $("#hyg-table").addEventListener("click", (e) => {
      const id = e.target.getAttribute?.("data-del");
      if (!id) return;
      confirmAction("حذف هذا الفحص نهائياً؟", async () => {
        try {
          await Store.remove(`${Store.PATHS.HYGIENE}/${id}`);
          toast("تم الحذف");
        } catch (err) { toast("تعذّر الحذف: " + err.message); }
      });
    });
  };

  return { mount };
})();

window.Hygiene = Hygiene;
