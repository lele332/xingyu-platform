// 缓存版本：修改 CORE 或缓存策略时必须递增，否则客户端不会更新
const CACHE = "xingyu-static-20260830-2";

// 预缓存清单 = index.html 实际加载的资源（2026-08-28 实测校准）
// 注意：旧清单里的 js/idb.js、js/backup.js、js/app-core.js、js/views-*.js 均不存在
const CORE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./xingyu.ico",
  "./xingyu-qrcode.png",
  "./assets/xingyu-app-icon-192.png",
  "./assets/xingyu-app-icon-256.png",
  "./assets/xingyu-app-icon-512.png",
  "./css/style.css",
  "./css/apple.css",
  "./css/synapse.css",
  "./css/voxcpm.css",
  "./assets/fonts/local.css",
  "./assets/js/anime.min.js",
  "./assets/js/gsap.min.js",
  "./assets/js/ScrollTrigger.min.js",
  "./js/ai.js",
  "./js/anim.js",
  "./js/animefx.js",
  "./js/app.js",
  "./js/charts.js",
  "./js/icons.js",
  "./js/lunar.js",
  "./js/perf.js",
  "./js/quotes.js",
  "./js/splashsound.js",
  "./js/store.js",
  "./js/sync.js"
];

// 永不缓存：密钥配置 + 体积大的媒体/模型（避免撑爆 Cache Storage）
const NEVER_CACHE = /\/js\/local-config\.js$/;
const LARGE_MEDIA = /\.(mp4|webm|ogg|ogv|mov|m4a|wav|mp3|flac|bin|pth|onnx|wasm)$/i;

function shouldCache(url) {
  if (NEVER_CACHE.test(url.pathname)) return false;
  if (LARGE_MEDIA.test(url.pathname)) return false;
  return true;
}

function ensureCharset(response) {
  var ct = response.headers.get("Content-Type") || "";
  if (ct && ct.indexOf("charset=") >= 0) return response;
  var url = new URL(response.url);
  var path = url.pathname.toLowerCase();
  var needsCharset = /\.(html|htm|js|css|json|svg|xml|txt|md|webmanifest)$/.test(path) ||
                     path.endsWith("/") || ct.indexOf("text/") === 0 ||
                     ct.indexOf("javascript") >= 0 || ct.indexOf("json") >= 0;
  if (!needsCharset) return response;
  var newCt = ct;
  if (/\.(html?|\/)$/.test(path) || ct.indexOf("text/html") >= 0) {
    newCt = "text/html; charset=utf-8";
  } else if (/\.js$/.test(path) || ct.indexOf("javascript") >= 0) {
    newCt = ct ? ct.replace(/javascript$/, "javascript; charset=utf-8").replace(/javascript;/, "javascript; charset=utf-8;") : "application/javascript; charset=utf-8";
    if (newCt.indexOf("charset=") < 0) newCt = ct + "; charset=utf-8";
  } else if (/\.css$/.test(path) || ct.indexOf("text/css") >= 0) {
    newCt = ct ? (ct.indexOf("charset=") < 0 ? ct + "; charset=utf-8" : ct) : "text/css; charset=utf-8";
  } else if (/\.json$/.test(path) || ct.indexOf("json") >= 0) {
    newCt = ct ? (ct.indexOf("charset=") < 0 ? ct + "; charset=utf-8" : ct) : "application/json; charset=utf-8";
  } else {
    newCt = ct ? (ct.indexOf("charset=") < 0 ? ct + "; charset=utf-8" : ct) : "text/plain; charset=utf-8";
  }
  if (newCt === ct) return response;
  var newHeaders = new Headers(response.headers);
  newHeaders.set("Content-Type", newCt);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}


self.addEventListener("install", event => {
  // 逐个 add 而非 addAll：addAll 是原子操作，任一 404 会让整个 install 失败，
  // 导致 SW 永远不激活、离线能力全盘失效（这正是旧版的问题）。
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.all(
        CORE.map(url => cache.add(url).catch(err => {
          console.warn("[sw] 预缓存跳过:", url, err && err.message);
          return null;
        }))
      ))
      .then(() => self.skipWaiting())
  );
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
          caches.open(CACHE).then(cache => cache.put("./index.html", ensureCharset(copy)));
          return response;
        })
        .catch(() => caches.match("./index.html").then(r => r ? ensureCharset(r) : r))
    );
    return;
  }

  // JS/CSS：网络优先（后台更新缓存）。避免缓存优先导致旧版脚本持续生效、
  // 以及 ignoreSearch 使 ?v= 版本参数失效的问题。
  if (/\.(js|css)$/.test(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok && shouldCache(url)) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put(request, ensureCharset(copy)));
          }
          return response;
        })
        .catch(() => caches.match(request).then(r => r ? ensureCharset(r) : r))
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(cached => {
      const network = fetch(request).then(response => {
        if (response.ok && shouldCache(url)) {
          caches.open(CACHE).then(cache => cache.put(request, ensureCharset(response.clone())));
        }
        return response;
      }).catch(() => cached);
      return cached ? ensureCharset(cached) : network;
    })
  );
});

