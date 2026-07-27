// sw.js — caches the app shell so the UI loads offline. Firebase data itself
// relies on the Realtime Database SDK's own offline persistence, not this cache.
const CACHE_NAME = "wkcares-console-shell-v1";
const SHELL_ASSETS = [
  "index.html",
  "login.html",
  "activate.html",
  "new-net.html",
  "manifest.json",
  "css/base.css",
  "css/components.css",
  "css/pages/dashboard.css",
  "css/pages/login.css",
  "css/pages/net-form.css",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Network-first for everything (so live Firebase-backed pages stay fresh),
  // falling back to cache when offline.
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
