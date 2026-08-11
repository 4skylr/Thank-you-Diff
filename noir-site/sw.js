/* ============================================================
   Noir Cinema — Service Worker (Workbox 7)
   يُرفع بجانب index.html في نفس المجلد.
   ============================================================ */
importScripts("https://storage.googleapis.com/workbox-cdn/releases/7.1.0/workbox-sw.js");

const VERSION = "noir-v1";

if (!workbox) {
  console.warn("[SW] Workbox لم تُحمّل — الصفحة تعمل بدون كاش.");
} else {
  workbox.setConfig({ debug: false });

  const { registerRoute, NavigationRoute } = workbox.routing;
  const { CacheFirst, NetworkFirst, StaleWhileRevalidate, NetworkOnly } = workbox.strategies;
  const { ExpirationPlugin } = workbox.expiration;
  const { CacheableResponsePlugin } = workbox.cacheableResponse;

  self.skipWaiting();
  workbox.core.clientsClaim();

  /* 1) الصفحة نفسها: الشبكة أولاً، والكاش احتياط عند انقطاع النت */
  registerRoute(
    new NavigationRoute(
      new NetworkFirst({
        cacheName: `${VERSION}-app`,
        networkTimeoutSeconds: 4,
        plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })]
      })
    )
  );

  /* 2) Firestore وأي نداء بيانات حي: لا يُخزَّن إطلاقاً حتى لا تُعرض أرقام قديمة */
  registerRoute(
    ({ url }) =>
      /firestore\.googleapis\.com|googleapis\.com\/google\.firestore/.test(url.href),
    new NetworkOnly()
  );

  /* 3) مكتبات الـCDN: من الكاش فوراً مع تحديث صامت في الخلفية */
  registerRoute(
    ({ url }) =>
      /^(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|storage\.googleapis\.com)$/.test(url.hostname),
    new StaleWhileRevalidate({
      cacheName: `${VERSION}-cdn`,
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 60 })
      ]
    })
  );

  /* 4) بيانات لغات OCR: ملفات كبيرة وثابتة — كاش أولاً وسنة كاملة */
  registerRoute(
    ({ url }) => /tessdata|traineddata/.test(url.href),
    new CacheFirst({
      cacheName: `${VERSION}-ocr`,
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({ maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 365, purgeOnQuotaError: true })
      ]
    })
  );

  /* 5) الخطوط */
  registerRoute(
    ({ url }) => /fonts\.(googleapis|gstatic)\.com/.test(url.hostname),
    new CacheFirst({
      cacheName: `${VERSION}-fonts`,
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 })
      ]
    })
  );

  /* 6) الصور */
  registerRoute(
    ({ request }) => request.destination === "image",
    new CacheFirst({
      cacheName: `${VERSION}-img`,
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30, purgeOnQuotaError: true })
      ]
    })
  );

  /* تنظيف كاشات النسخ القديمة */
  self.addEventListener("activate", (e) => {
    e.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))
      )
    );
  });

  self.addEventListener("message", (e) => {
    if (e.data === "SKIP_WAITING") self.skipWaiting();
  });
}
