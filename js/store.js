/* ============================================================
   STORE — Firebase Realtime Database layer
   ------------------------------------------------------------
   كل الكتابة تتم على مسارات فرعية فقط (push/update/remove).
   ما في أي عملية set على الجذر "/" — عشان البيانات الموجودة
   (products / employees) ما تنمسح أبداً.
   ============================================================ */

const Store = (() => {
  let db = null;
  let ready = false;

  const PATHS = {
    EMPLOYEES: "employees",
    PRODUCTS:  "products",
    INVENTORY: "inventory",
    EXPENSES:  "expenses",
    HYGIENE:   "hygiene",
    BRANCHES:  "branches/latest",
    FLOAT:     "settings/float",
    META:      "meta"
  };

  /* ---------- init ---------- */
  const init = () => {
    const cfg = window.firebaseConfig || {};
    if (!cfg.apiKey || !cfg.databaseURL) {
      throw new Error("ناقص apiKey أو databaseURL في js/firebase-config.js");
    }
    firebase.initializeApp(cfg);
    db = firebase.database();
    ready = true;
    return db;
  };

  const ref = (path) => db.ref(path);

  /* ---------- reads ---------- */
  const once = async (path, fallback = null) => {
    const snap = await ref(path).get();
    return snap.exists() ? snap.val() : fallback;
  };

  /**
   * يستمع لمسار ويرجع مصفوفة [{id, ...value}] عند كل تغيير.
   * يرجع دالة لإيقاف الاستماع.
   */
  const onList = (path, cb) => {
    const handler = ref(path).on("value", (snap) => {
      const val = snap.val() || {};
      const arr = Object.entries(val).map(([id, v]) =>
        (v && typeof v === "object") ? { id, ...v } : { id, value: v }
      );
      cb(arr);
    }, (err) => {
      console.error("Store.onList", path, err);
      toast("تعذّر قراءة البيانات: " + err.message);
    });
    return () => ref(path).off("value", handler);
  };

  const onValue = (path, cb) => {
    const handler = ref(path).on("value", (snap) => cb(snap.val()));
    return () => ref(path).off("value", handler);
  };

  /* ---------- writes ---------- */
  const touchMeta = () => {
    ref(PATHS.META).update({
      updatedAt: new Date().toISOString(),
      updatedBy: (window.Auth && Auth.currentUser()?.id) || "—"
    }).catch(() => {});
  };

  const add = async (path, obj) => {
    const record = {
      ...obj,
      createdAt: new Date().toISOString(),
      createdBy: (window.Auth && Auth.currentUser()?.id) || "—"
    };
    const r = await ref(path).push(record);
    touchMeta();
    return r.key;
  };

  const update = async (path, obj) => {
    await ref(path).update(obj);
    touchMeta();
  };

  const set = async (path, val) => {
    if (!path || path === "/" || path === "") throw new Error("مسار غير آمن");
    await ref(path).set(val);
    touchMeta();
  };

  const remove = async (path) => {
    if (!path || path === "/" || path === "") throw new Error("مسار غير آمن");
    await ref(path).remove();
    touchMeta();
  };

  /* ---------- connection state ---------- */
  const onConnection = (cb) => {
    db.ref(".info/connected").on("value", (s) => cb(!!s.val()));
  };

  return {
    PATHS,
    init,
    get isReady() { return ready; },
    once, onList, onValue,
    add, update, set, remove,
    onConnection
  };
})();

window.Store = Store;
