// RT Compensation Management System - Service Worker
// Caches the app shell only (this is a single-file app, so that's just
// index.html + icons + manifest). Every data request goes live to the
// Apps Script backend - we never cache those, so the app never shows
// stale records.

const CACHE_NAME = "rtcms-shell-v2";
const SHELL_FILES = ["./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Network-first for the app shell: always try to fetch the latest
// index.html/manifest/icons from the server first, and only fall back
// to the cached copy if the network is unavailable (offline). This is
// what was causing edits to not show up - the old code served the
// cached file first and never checked the network at all.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never intercept calls to the Apps Script backend - those must
  // always hit the network live.
  if (url.origin !== self.location.origin || url.hostname.includes("script.google.com")) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Lets the page force this waiting service worker to activate
// immediately (see the "controllerchange" handling in index.html).
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});