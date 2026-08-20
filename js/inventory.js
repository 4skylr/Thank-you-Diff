/* ============================================================
   INVENTORY — جرد المخزون
   يقرأ المستودعات والمنتجات من node /products الموجود أصلاً.
   ============================================================ */

const Inventory = (() => {
  let rows = [];          // كل سجلات الجرد
  let catalog = {};       // { "Main Store": ["Popcorn", ...], ... }
  let activeStore = "";

  /* ---------- تطبيع شكل /products ---------- */
  const normalize = (raw) => {
    const out = {};
    if (!raw || typeof raw !== "object") return out;

    for (const [key, val] of Object.entries(raw)) {
      if (Array.isArray(val)) {
        out[key] = val.filter(Boolean).map(String);
      } else if (val && typeof val === "object") {
        const values = Object.values(val);
        const allStrings = values.every(v => typeof v === "string");
        if (allStrings) {
          out[key] = values.map(String);           // {0:"a",1:"b"} أو {a:"a"}
        } else {
          Object.assign(out, normalize(val));      // مستوى إضافي مثل products/stores/...
        }
      }
    }
    return out;
  };

  /* ---------- عرض ---------- */
  const storeOptions = () => {
    const sel = $("#inv-store");
    const names = Object.keys(catalog);
    if (!names.length) {
      sel.innerHTML = `<option value="">لا توجد مستودعات</option>`;
      return;
    }
    if (!activeStore || !names.includes(activeStore)) activeStore = names[0];
    sel.innerHTML = names
      .map(n => `<option value="${esc(n)}"${n === activeStore ? " selected" : ""}>${esc(n)}</option>`)
      .join("");
  };

  const visible = () => rows
    .filter(r => !activeStore || r.store === activeStore)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  const stats = () => {
    const list = visible();
    const totalQty = list.reduce((s, r) => s + (Number(r.qty) || 0), 0);
    const items = new Set(list.map(r => r.product)).size;
    const last = list[0]?.createdAt;
    $("#inv-stats").innerHTML = `
      <div class="stat"><b>${fmtNum(list.length)}</b><span>عدد السجلات</span></div>
      <div class="stat"><b>${fmtNum(items)}</b><span>أصناف مختلفة</span></div>
      <div class="stat"><b>${fmtNum(totalQty)}</b><span>إجمالي الكميات</span></div>
      <div class="stat"><b style="font-size:.95rem">${esc(fmtDateTime(last))}</b><span>آخر تحديث</span></div>`;
  };

  const render = () => {
    storeOptions();
    stats();
    const list = visible();
    const body = list.map(r => `
      <tr>
        <td>${esc(r.product)}</td>
        <td class="num">${fmtNum(r.qty)}</td>
        <td>${esc(r.unit || "—")}</td>
        <td>${esc(r.note || "—")}</td>
        <td>${esc(r.createdBy || "—")}</td>
        <td class="num">${esc(fmtDateTime(r.createdAt))}</td>
        <td><button class="btn btn-sm btn-danger" data-del="${esc(r.id)}">حذف</button></td>
      </tr>`);
    renderTable(
      $("#inv-table"),
      ["الصنف", "الكمية", "الوحدة", "ملاحظة", "الموظف", "التاريخ", ""],
      body,
      "لا توجد سجلات لهذا المستودع بعد."
    );
  };

  /* ---------- إضافة ---------- */
  const openAdd = () => {
    const products = catalog[activeStore] || [];
    const options = products.length
      ? products.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join("")
      : `<option value="">لا توجد منتجات لهذا المستودع</option>`;

    Modal.open("تسجيل صنف — " + activeStore, `
      <label class="field"><span>الصنف</span>
        <select class="input" id="f-product">${options}</select></label>
      <label class="field"><span>الكمية</span>
        <input class="input" id="f-qty" type="number" step="any" min="0" value="0" /></label>
      <label class="field"><span>الوحدة</span>
        <select class="input" id="f-unit">
          <option>حبة</option><option>كرتون</option><option>كيلو</option>
          <option>لتر</option><option>علبة</option><option>كيس</option>
        </select></label>
      <label class="field"><span>ملاحظة (اختياري)</span>
        <input class="input" id="f-note" placeholder="مثال: قرب الانتهاء" /></label>
      <div class="modal-actions">
        <button class="btn btn-primary" id="f-save">حفظ</button>
        <button class="btn btn-ghost" id="f-cancel">إلغاء</button>
      </div>
    `, (body) => {
      $("#f-cancel", body).addEventListener("click", Modal.close);
      $("#f-save", body).addEventListener("click", async () => {
        const product = $("#f-product", body).value;
        const qty = Number($("#f-qty", body).value);
        if (!product) return toast("اختر صنفاً أولاً");
        if (!Number.isFinite(qty) || qty < 0) return toast("أدخل كمية صحيحة");
        try {
          await Store.add(Store.PATHS.INVENTORY, {
            store: activeStore,
            product,
            qty,
            unit: $("#f-unit", body).value,
            note: $("#f-note", body).value.trim()
          });
          Modal.close();
          toast("تم حفظ الصنف");
        } catch (e) { toast("تعذّر الحفظ: " + e.message); }
      });
    });
  };

  /* ---------- تشغيل ---------- */
  const mount = () => {
    Store.onValue(Store.PATHS.PRODUCTS, (raw) => {
      catalog = normalize(raw);
      render();
    });

    Store.onList(Store.PATHS.INVENTORY, (list) => {
      rows = list;
      render();
    });

    $("#inv-store").addEventListener("change", (e) => {
      activeStore = e.target.value;
      render();
    });

    $("#inv-add").addEventListener("click", openAdd);

    $("#inv-export").addEventListener("click", () => {
      const list = visible();
      if (!list.length) return toast("لا توجد بيانات للتصدير");
      exportCSV(`inventory-${activeStore || "all"}-${todayISO()}.csv`,
        ["المستودع", "الصنف", "الكمية", "الوحدة", "ملاحظة", "الموظف", "التاريخ"],
        list.map(r => [r.store, r.product, r.qty, r.unit, r.note, r.createdBy, r.createdAt]));
    });

    $("#inv-table").addEventListener("click", (e) => {
      const id = e.target.getAttribute?.("data-del");
      if (!id) return;
      confirmAction("حذف هذا السجل نهائياً؟", async () => {
        try {
          await Store.remove(`${Store.PATHS.INVENTORY}/${id}`);
          toast("تم الحذف");
        } catch (err) { toast("تعذّر الحذف: " + err.message); }
      });
    });
  };

  return { mount };
})();

window.Inventory = Inventory;
