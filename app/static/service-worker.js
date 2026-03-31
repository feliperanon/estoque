const CACHE_NAME = "estoque-v10";
const URLS = [
  "/",
  "/app",
  "/static/style.css?v=7",
  "/static/app.js?v=10",
  "/static/manifest.json",
  "/static/favicon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (url.pathname.startsWith("/api/") || req.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(req)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== "basic") {
            return response;
          }

          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, cloned));
          return response;
        })
        .catch(() => caches.match("/"));
    }),
  );
});
