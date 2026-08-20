/* ============================================================
   FIREBASE CONFIG
   ------------------------------------------------------------
   املأ القيم الفاضية من:
   Firebase Console → ⚙️ Project settings → General
   → Your apps → Web app → SDK setup and configuration → Config

   إذا ما عندك Web App مسجّل، اضغط "</>" وسجّل واحد باسم
   noir-cinema-web ثم انسخ القيم.

   databaseURL: خذه من Build → Realtime Database (أعلى الصفحة).
   عادةً يكون بهذا الشكل:
   https://noir-cinema-system-default-rtdb.firebaseio.com
   أو للمناطق الأوروبية:
   https://noir-cinema-system-default-rtdb.europe-west1.firebasedatabase.app
   ============================================================ */

window.firebaseConfig = {
  apiKey:            "",
  authDomain:        "noir-cinema-system.firebaseapp.com",
  databaseURL:       "",
  projectId:         "noir-cinema-system",
  storageBucket:     "noir-cinema-system.appspot.com",
  messagingSenderId: "372761169267",
  appId:             ""
};
