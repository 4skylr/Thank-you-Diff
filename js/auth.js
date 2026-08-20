/* ============================================================
   AUTH
   ------------------------------------------------------------
   خطوتان:
   1) تسجيل دخول مجهول في Firebase Auth (Anonymous) — عشان
      قواعد قاعدة البيانات ".read": "auth != null" تسمح بالقراءة.
   2) التحقق من رقم الموظف وكلمة المرور من node /employees.

   ⚠ ملاحظة: هذي بوابة على مستوى الواجهة. لحماية حقيقية
   استخدم Firebase Auth بالإيميل + قواعد لكل مستخدم.
   ============================================================ */

const Auth = (() => {
  const SESSION_KEY = "noir_session";
  let user = null;

  const currentUser = () => user;

  /** تسجيل دخول مجهول — مطلوب قبل أي قراءة من قاعدة البيانات */
  const signInAnon = async () => {
    if (firebase.auth().currentUser) return firebase.auth().currentUser;
    const cred = await firebase.auth().signInAnonymously();
    return cred.user;
  };

  /** التحقق من الموظف مقابل /employees */
  const login = async (id, password) => {
    const cleanId = String(id || "").trim();
    if (!cleanId || !password) return { ok: false, error: "أدخل رقم الموظف وكلمة المرور" };

    const employees = await Store.once(Store.PATHS.EMPLOYEES, {});
    if (!employees || !Object.keys(employees).length) {
      return { ok: false, error: "لا يوجد موظفون في قاعدة البيانات" };
    }

    // ندعم الشكلين: employees/00001 = {...}  و  employees = [{id:"00001", ...}]
    let record = employees[cleanId];
    if (!record) {
      record = Object.values(employees).find(
        (e) => e && String(e.id ?? e.employeeId ?? "").trim() === cleanId
      );
    }
    if (!record) return { ok: false, error: "رقم الموظف غير موجود" };

    const stored = String(record.password ?? record.pass ?? record.pin ?? "");
    if (stored !== String(password)) return { ok: false, error: "كلمة المرور غير صحيحة" };

    user = {
      id: cleanId,
      name: record.name || record.fullName || cleanId,
      role: record.role || "staff"
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    return { ok: true, user };
  };

  /** استرجاع الجلسة عند تحديث الصفحة (تنتهي بإغلاق التبويب) */
  const restore = () => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) user = JSON.parse(raw);
    } catch { user = null; }
    return user;
  };

  const logout = () => {
    user = null;
    sessionStorage.removeItem(SESSION_KEY);
  };

  const isAdmin = () => !!user && String(user.role).toLowerCase() === "admin";

  return { signInAnon, login, restore, logout, currentUser, isAdmin };
})();

window.Auth = Auth;
