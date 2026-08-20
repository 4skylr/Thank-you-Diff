/* ============================================================
   APP — نقطة التشغيل
   ============================================================ */

const App = (() => {
  let mounted = false;

  const setStatus = (msg, isError = false) => {
    const el = $("#gate-status");
    el.textContent = msg;
    el.style.color = isError ? "var(--bad)" : "var(--muted)";
  };

  /* ---------- التبويبات ---------- */
  const switchView = (name) => {
    $$(".tab").forEach(t => t.classList.toggle("is-active", t.dataset.view === name));
    $$(".view").forEach(v => v.classList.toggle("is-active", v.id === "view-" + name));
    location.hash = name;
  };

  /* ---------- بعد الدخول ---------- */
  const enterApp = () => {
    const user = Auth.currentUser();
    $("#gate").hidden = true;
    $("#shell").hidden = false;
    $("#who").textContent = `${user.name} · ${user.id}`;

    if (!mounted) {
      Inventory.mount();
      Expenses.mount();
      Hygiene.mount();
      Branches.mount();

      Store.onValue(Store.PATHS.META, (meta) => {
        $("#foot-updated").textContent = meta?.updatedAt
          ? "آخر تحديث " + fmtDateTime(meta.updatedAt) : "—";
      });

      Store.onConnection((online) => {
        const pill = $("#sync-pill");
        pill.textContent = online ? "متصل" : "غير متصل";
        pill.classList.toggle("off", !online);
      });

      mounted = true;
    }

    const initial = (location.hash || "#inventory").slice(1);
    switchView(["inventory", "expenses", "hygiene", "branches"].includes(initial) ? initial : "inventory");
  };

  /* ---------- الدخول ---------- */
  const doLogin = async () => {
    const btn = $("#login-btn");
    const msg = $("#gate-msg");
    msg.textContent = "";
    btn.disabled = true;
    btn.textContent = "جارٍ التحقق…";
    try {
      const res = await Auth.login($("#login-id").value, $("#login-pw").value);
      if (!res.ok) { msg.textContent = res.error; return; }
      $("#login-pw").value = "";
      enterApp();
    } catch (e) {
      msg.textContent = "خطأ في الاتصال: " + e.message;
    } finally {
      btn.disabled = false;
      btn.textContent = "دخول";
    }
  };

  /* ---------- الإقلاع ---------- */
  const boot = async () => {
    Modal.init();

    $("#login-btn").addEventListener("click", doLogin);
    ["login-id", "login-pw"].forEach(id => {
      $("#" + id).addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });
    });

    $("#logout-btn").addEventListener("click", () => {
      Auth.logout();
      $("#shell").hidden = true;
      $("#gate").hidden = false;
      $("#login-id").value = "";
      $("#login-pw").value = "";
    });

    $("#tabs").addEventListener("click", (e) => {
      const view = e.target.dataset?.view;
      if (view) switchView(view);
    });

    // 1) تهيئة Firebase
    try {
      Store.init();
    } catch (e) {
      setStatus(e.message, true);
      $("#login-btn").disabled = true;
      return;
    }

    // 2) دخول مجهول (مطلوب لقواعد auth != null)
    try {
      await Auth.signInAnon();
      setStatus("متصل بقاعدة البيانات ✓");
    } catch (e) {
      setStatus("فشل الاتصال: " + e.message + " — فعّل Anonymous من Authentication → Sign-in method", true);
      return;
    }

    // 3) استرجاع جلسة سابقة في نفس التبويب
    if (Auth.restore()) enterApp();
  };

  return { boot, switchView };
})();

window.App = App;
document.addEventListener("DOMContentLoaded", App.boot);
