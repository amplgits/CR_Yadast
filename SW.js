// RT Compensation Management System - Service Worker
// Caches the app shell only (this is a single-file app, so that's just
// index.html + icons + manifest). Every data request goes live to the
// Apps Script backend - we never cache those, so the app never shows
// stale records.

const CACHE_NAME = "rtcms-shell-v1";
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

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never intercept calls to the Apps Script backend - those must
  // always hit the network live.
  if (url.origin !== self.location.origin || url.hostname.includes("script.google.com")) {
    return;
  }

  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});