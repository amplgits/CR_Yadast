// RT Compensation Management System - Service Worker
// Caches the app shell only. Every Apps Script / cross-origin request is
// left completely alone and always goes live to the network.

const CACHE_NAME = "rtcms-shell-v5"; // bump this number every time you deploy a new index.html
const SHELL_FILES = ["./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Each file is cached on its own, so one missing file can never block installation.
      Promise.all(
        SHELL_FILES.map((file) =>
          fetch(new Request(file, { cache: "reload" }))
            .then((res) => { if (res.ok) return cache.put(file, res); })
            .catch(() => {})
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Browsers refuse a redirected response for page navigations,
// so rebuild it as a plain response first.
function cleanResponse(res) {
  if (!res.redirected) return Promise.resolve(res);
  return res.blob().then((body) =>
    new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers })
  );
}

// Network-first for the app shell, cache only as an offline fallback.
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle plain GETs to our own site. Apps Script, Google, CDNs,
  // and every POST are never touched.
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isPage = req.mode === "navigate";
  // For the page itself, skip the browser's 10-minute GitHub Pages cache
  // so a new deployment shows up immediately.
  const netReq = isPage ? new Request(req.url, { cache: "no-cache" }) : req;

  event.respondWith(
    fetch(netReq)
      .then(cleanResponse)
      .then((res) => {
        // Only cache good, complete responses (never 404s or partial content)
        if (res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => cache.put(req.url, copy)).catch(() => {})
          );
        }
        return res;
      })
      .catch(() =>
        // Offline: cached copy -> cached index.html (for pages) -> clean network error
        caches.match(req.url).then(
          (hit) => hit || (isPage ? caches.match("./index.html") : null) || Response.error()
        )
      )
  );
});

// Lets the page force this waiting service worker to activate immediately.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});