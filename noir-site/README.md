# نوار سينما — لوحة تشغيل الفروع

## بنية المشروع

```
index.html                     الهيكل + الواجهات + أيقونات Lucide
sw.js                          Service Worker (Workbox) — العمل بدون إنترنت
manifest.webmanifest           تعريف التطبيق للتثبيت على الجوال
firebase.json                  إعدادات الاستضافة (لفايربيس لاحقاً)
.nojekyll                      يمنع GitHub Pages من تجاهل مجلدات الأصول

assets/
  css/
    tokens.css                 متغيرات التصميم: مسافات، زوايا، ظلال، ألوان
    base.css                   التخطيط العام، الأزرار، الكروت، الجداول
    components.css             المكوّنات: اللوحات، الرسوم، التقدير، بيتي كاش
  vendor/                      مكتبات طرف ثالث (لا تعدّلها)
    score.min.js               score.js — المستويات (MIT)
    curtain-effect.css/.js     ستارة السينما (MIT)
  data/                        بيانات ثقيلة — لا يوجد فيها منطق
    img-achievements.js        صور الإنجازات base64
    img-skylr.js               شعارات وأعمال base64
    expiry-template.b64        قالب إكسل التواريخ (يُحمَّل عند الطلب)
  js/                          ⚠️ الترتيب مهم — لا تغيّره في index.html
    01-config.js               إعدادات Firebase والثوابت
    02-i18n.js                 كل النصوص عربي/إنجليزي
    03-core-db.js              الأدوات · التخزين · Dexie · قاعدة البيانات
    04-parsers.js              قرّاء ملفات PDF
    05-inventory.js            السيلز سبيس · التعبئة والنقل
    06-petty-cash.js           بيتي كاش + OCR
    07-sidebar.js              الشريط الجانبي
    08-staff.js                التوثيق · التقدير · المتجر · المستويات
    09-charts.js               الرسوم البيانية
    10-branch-status.js        وضع الفرع + تعبئة إكسل الأداء
    11-profit.js               الوصفات والأرباح
    12-orders.js               طلبات المنتجات + مبيعات التذاكر والأكل
    13-achievements.js         الإنجازات الإلكترونية والستريك
    14-employee.js             شاشات الموظف والمهام
    15-expiry-sync.js          مطابقة التواريخ مع الجرد
    16-branches-finance.js     مقارنة الفروع والمالية
    17-boot.js                 الإقلاع وتشغيل التطبيق
```

## أين أعدّل؟

| أريد أن... | الملف |
|---|---|
| أغيّر نصاً ظاهراً | `assets/js/02-i18n.js` |
| أغيّر لوناً أو مسافة | `assets/css/tokens.css` |
| أعدّل شكل مكوّن | `assets/css/components.css` |
| أصلح قراءة ملف PDF | `assets/js/04-parsers.js` |
| أعدّل بيتي كاش | `assets/js/06-petty-cash.js` |
| أضيف رسماً بيانياً | `assets/js/09-charts.js` |
| أعدّل المتجر أو النقاط | `assets/js/08-staff.js` |
| أغيّر إعدادات Firebase | `assets/js/01-config.js` |

## قواعد لا تُكسر

1. **لا تغيّر ترتيب وسوم `<script>` في index.html.** الملفات تعتمد على بعضها بالترتيب.
2. **لا تعدّل مجلد `vendor/`** — مكتبات خارجية، أي تعديل يضيع عند التحديث.
3. **ملفات `data/` بيانات فقط** — لا تضع فيها منطقاً.
4. **بعد كل تعديل:** حدّث `VERSION` في `sw.js` (مثلاً `noir-v2`) وإلا بقي المتصفح على النسخة القديمة.

## النشر

### GitHub Pages
ارفع كل الملفات في جذر المستودع → Settings → Pages → Branch `main` / `(root)`.

### Firebase Hosting (لاحقاً)
```bash
npm install -g firebase-tools
firebase login
firebase init hosting     # اختر المشروع، واجعل public = "."، ولا تكتب فوق index.html
firebase deploy
```
`firebase.json` جاهز مسبقاً بإعدادات الكاش الصحيحة.
