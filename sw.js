const CACHE = "xingyu-static-20260811-3";
const CORE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./xingyu.ico",
  "./assets/xingyu-app-icon-192.png",
  "./assets/xingyu-app-icon-256.png",
  "./assets/xingyu-app-icon-512.png",
  "./xingyu-qrcode.png",
  "./css/style.css",
  "./css/apple.css",
  "./assets/js/gsap.min.js",
  "./assets/js/ScrollTrigger.min.js",
  "./js/anim.js",
  "./js/quotes.js",
  "./js/lunar.js",
  "./js/store.js",
  "./js/sync.js",
  "./js/charts.js",
  "./js/ai.js",
  "./js/weather.js",
  "./js/icons.js",
  "./js/app.js"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith("xingyu-static-") && key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate" || url.pathname.endsWith("/index.html")) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(cached => {
      const network = fetch(request).then(response => {
        if (response.ok && !url.pathname.endsWith("/js/local-config.js")) {
          caches.open(CACHE).then(cache => cache.put(request, response.clone()));
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
