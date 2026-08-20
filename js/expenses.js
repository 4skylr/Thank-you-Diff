/* ============================================================
   EXPENSES — المصاريف والعهدة
   ============================================================ */

const Expenses = (() => {
  let rows = [];
  let float = 0;

  const CATEGORIES = ["مشتريات", "صيانة", "نظافة", "مواصلات", "رواتب مؤقتة", "أخرى"];

  const sorted = () => [...rows].sort((a, b) =>
    String(b.date || b.createdAt).localeCompare(String(a.date || a.createdAt)));

  const stats = () => {
    const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const month = todayISO().slice(0, 7);
    const monthTotal = rows
      .filter(r => String(r.date || "").startsWith(month))
      .reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const remaining = float - total;

    $("#exp-stats").innerHTML = `
      <div class="stat"><b>${fmtNum(float)}</b><span>العهدة</span></div>
      <div class="stat"><b>${fmtNum(total)}</b><span>إجمالي المصروف</span></div>
      <div class="stat"><b>${fmtNum(monthTotal)}</b><span>مصروف هذا الشهر</span></div>
      <div class="stat"><b style="color:${remaining < 0 ? "var(--bad)" : "var(--ok)"}">${fmtNum(remaining)}</b><span>المتبقي</span></div>`;
  };

  const render = () => {
    stats();
    const body = sorted().map(r => `
      <tr>
        <td class="num">${esc(r.date || "—")}</td>
        <td>${esc(r.category || "—")}</td>
        <td class="num">${fmtMoney(r.amount)}</td>
        <td>${esc(r.note || "—")}</td>
        <td>${esc(r.createdBy || "—")}</td>
        <td><button class="btn btn-sm btn-danger" data-del="${esc(r.id)}">حذف</button></td>
      </tr>`);
    renderTable($("#exp-table"),
      ["التاريخ", "التصنيف", "المبلغ", "البيان", "الموظف", ""],
      body, "لا توجد مصاريف مسجّلة بعد.");
  };

  const openAdd = () => {
    Modal.open("إضافة مصروف", `
      <label class="field"><span>التاريخ</span>
        <input class="input" id="f-date" type="date" value="${todayISO()}" /></label>
      <label class="field"><span>التصنيف</span>
        <select class="input" id="f-cat">${CATEGORIES.map(c => `<option>${esc(c)}</option>`).join("")}</select></label>
      <label class="field"><span>المبلغ (ر.س)</span>
        <input class="input" id="f-amt" type="number" step="0.01" min="0" value="0" /></label>
      <label class="field"><span>البيان</span>
        <input class="input" id="f-note" placeholder="مثال: شراء أكياس بوبكورن" /></label>
      <div class="modal-actions">
        <button class="btn btn-primary" id="f-save">حفظ</button>
        <button class="btn btn-ghost" id="f-cancel">إلغاء</button>
      </div>
    `, (body) => {
      $("#f-cancel", body).addEventListener("click", Modal.close);
      $("#f-save", body).addEventListener("click", async () => {
        const amount = Number($("#f-amt", body).value);
        if (!Number.isFinite(amount) || amount <= 0) return toast("أدخل مبلغاً صحيحاً");
        try {
          await Store.add(Store.PATHS.EXPENSES, {
            date: $("#f-date", body).value || todayISO(),
            category: $("#f-cat", body).value,
            amount,
            note: $("#f-note", body).value.trim()
          });
          Modal.close();
          toast("تم حفظ المصروف");
        } catch (e) { toast("تعذّر الحفظ: " + e.message); }
      });
    });
  };

  const openFloat = () => {
    Modal.open("تعديل العهدة", `
      <label class="field"><span>مبلغ العهدة الحالي (ر.س)</span>
        <input class="input" id="f-float" type="number" step="0.01" min="0" value="${float}" /></label>
      <div class="modal-actions">
        <button class="btn btn-primary" id="f-save">حفظ</button>
        <button class="btn btn-ghost" id="f-cancel">إلغاء</button>
      </div>
    `, (body) => {
      $("#f-cancel", body).addEventListener("click", Modal.close);
      $("#f-save", body).addEventListener("click", async () => {
        const val = Number($("#f-float", body).value);
        if (!Number.isFinite(val) || val < 0) return toast("أدخل مبلغاً صحيحاً");
        try {
          await Store.set(Store.PATHS.FLOAT, val);
          Modal.close();
          toast("تم تحديث العهدة");
        } catch (e) { toast("تعذّر الحفظ: " + e.message); }
      });
    });
  };

  const mount = () => {
    Store.onList(Store.PATHS.EXPENSES, (list) => { rows = list; render(); });
    Store.onValue(Store.PATHS.FLOAT, (val) => { float = Number(val) || 0; render(); });

    $("#exp-add").addEventListener("click", openAdd);
    $("#exp-float").addEventListener("click", openFloat);

    $("#exp-export").addEventListener("click", () => {
      if (!rows.length) return toast("لا توجد بيانات للتصدير");
      exportCSV(`expenses-${todayISO()}.csv`,
        ["التاريخ", "التصنيف", "المبلغ", "البيان", "الموظف"],
        sorted().map(r => [r.date, r.category, r.amount, r.note, r.createdBy]));
    });

    $("#exp-table").addEventListener("click", (e) => {
      const id = e.target.getAttribute?.("data-del");
      if (!id) return;
      confirmAction("حذف هذا المصروف نهائياً؟", async () => {
        try {
          await Store.remove(`${Store.PATHS.EXPENSES}/${id}`);
          toast("تم الحذف");
        } catch (err) { toast("تعذّر الحذف: " + err.message); }
      });
    });
  };

  return { mount };
})();

window.Expenses = Expenses;
