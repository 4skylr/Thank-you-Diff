/* ==========================================================
   Noir Cinema · 01-config.js
   اعدادات Firebase والثوابت العامة
   تنبيه: ترتيب التحميل في index.html مهم - لا تغيره.
   ========================================================== */

/* ==========================================================
   ⚙️ Firebase — team67-7f599
   ========================================================== */
const firebaseConfig = {
  apiKey: "AIzaSyA4oDb7O3vMAH2mYSUn9vSl6gdMRohXZvM",
  authDomain: "team67-7f599.firebaseapp.com",
  projectId: "team67-7f599",
  storageBucket: "team67-7f599.firebasestorage.app",
  messagingSenderId: "375384586065",
  appId: "1:375384586065:web:749d2ec0235b1c80490570"
};
const ADMIN_CODE = "899899";
/* كم يوم جرد نحتفظ به في السحابة (الأقدم يُحذف تلقائياً) */
const KEEP_SNAPSHOTS = 45;
const REFUEL_DEFAULT_MIN = 7;
const SEED_STAFF = [
  "Waleed Hammed Alotaibi","Nawaf Hamdi Alharbi","Ohoud Saeed Almutairi",
  "Abdullah Aldubyb","Rakan Almutiri","Ibrahim Aldamegh"
];

