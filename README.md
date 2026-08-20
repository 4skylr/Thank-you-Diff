# Noir Cinema — Operations Dashboard

لوحة تشغيل الفروع: المخزون، المصاريف، النظافة، وأداء الفروع.
البيانات كلها في **Firebase Realtime Database** (مشروع `noir-cinema-system`)، والاستضافة على **Firebase Hosting**.

---

## 0) قبل أي شيء — خذ نسخة احتياطية

النشر يرفع ملفات الموقع فقط ولا يلمس قاعدة البيانات إطلاقاً. ومع ذلك:

**Firebase Console → Realtime Database → Data → ⋮ → Export JSON** واحفظ الملف عندك.

كل الكتابة في هذا المشروع تتم بـ `push` أو `update` على مسارات فرعية — ما في أي `set` على الجذر `/`، وعُقدتا `employees` و `products` **للقراءة فقط** في قواعد الأمان.

## 1) املأ إعدادات Firebase

افتح `js/firebase-config.js` واملأ `apiKey` و `databaseURL` و `appId`.

- **apiKey / appId**: Firebase Console → ⚙️ Project settings → General → Your apps → Web app → Config.
  إذا ما عندك Web App، اضغط زر `</>` وسجّل واحد باسم `noir-cinema-web`.
- **databaseURL**: Build → Realtime Database، الرابط ظاهر أعلى الصفحة.

## 2) فعّل الدخول المجهول

Authentication → Sign-in method → **Anonymous** → Enable.

الموقع يسجّل دخول مجهول تلقائياً عشان قواعد `auth != null` تسمح بالقراءة، وبعدها يتحقق من رقم الموظف وكلمة المرور من node `employees`.

## 3) تأكد من وجود الموظفين

إذا `employees` مو موجود في قاعدة البيانات، استورد `setup/employees.sample.json`:
Realtime Database → Data → ⋮ → **Import JSON**.

> ⚠️ الاستيراد من الجذر **يستبدل كل البيانات**. إذا عندك `products` موجودة، اضغط على node `employees` تحديداً واستورد داخله، أو أضف الموظفين يدوياً.

## 4) شغّل محلياً

```bash
npx serve .
# أو
python3 -m http.server 8080
```

افتح `http://localhost:8080`. لازم تفتحه عبر سيرفر مو بالضغط المزدوج على الملف.

## 5) انشر على Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
cd noir-cinema
firebase deploy --only hosting
```

`--only hosting` مهمة: تنشر ملفات الموقع فقط وما تلمس قاعدة البيانات ولا قواعدها.
الرابط: `https://noir-cinema-system.web.app`

للتحديثات لاحقاً: عدّل الملفات → `firebase deploy --only hosting`.

---

## حماية البيانات

- ما في أي عملية كتابة على الجذر `/`. كل الكتابة على مسارات فرعية (`push` / `update` / `remove`).
- `database.rules.json` يمنع الكتابة على `employees` و `products` من الموقع (تُعدَّل من Console فقط).
- لتطبيق القواعد: `firebase deploy --only database` — نفّذها فقط لو متأكد أنها تناسبك.
- خذ نسخة احتياطية قبل أي تغيير كبير: Realtime Database → Data → ⋮ → **Export JSON**.

---

## هيكل البيانات

```
/employees/{id}      { name, password, role }
/products/{store}    [ أسماء المنتجات ]
/inventory/{key}     { store, product, qty, unit, note, createdBy, createdAt }
/expenses/{key}      { date, category, amount, note, createdBy, createdAt }
/hygiene/{key}       { date, area, status, note, createdBy, createdAt }
/branches/latest     { fileName, uploadedAt, uploadedBy, sheets:[{name, rows}] }
/settings/float      رقم العهدة
/meta                { updatedAt, updatedBy }
```

## هيكل المشروع

```
noir-cinema/
├── index.html
├── css/style.css
├── js/
│   ├── firebase-config.js   ← إعداداتك
│   ├── utils.js             ← أدوات + Modal + Toast + CSV
│   ├── store.js             ← طبقة Realtime Database
│   ├── auth.js              ← الدخول
│   ├── inventory.js
│   ├── expenses.js
│   ├── hygiene.js
│   ├── branches.js          ← رفع Excel أسبوعي
│   └── app.js               ← التشغيل والتبويبات
├── setup/employees.sample.json
├── firebase.json
├── .firebaserc
└── database.rules.json
```

## ملاحظات

- الدخول بوابة على مستوى الواجهة. لحماية حقيقية استخدم Firebase Auth بالإيميل مع قواعد لكل مستخدم.
- ملف الأداء الأسبوعي محدود بـ ~900KB. لو أكبر، احذف الشيتات غير المستخدمة أو خزّنه في Firebase Storage.
- كل التغييرات تنعكس فوراً على جميع الأجهزة عبر مستمعي Realtime Database.
