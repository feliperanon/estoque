/* Alinhar versões com index.html (link script / css). Bump CACHE_NAME a cada mudança relevante. */
const CACHE_NAME = "estoque-v99";
const PRECACHE_URLS = [
  "/",
  "/app",
  "/static/style.css?v=71",
  "/static/app.js?v=99",
  "/static/manifest.json",
  "/static/favicon.svg",
];

function isNavigateRequest(request) {
  return request.mode === "navigate" || request.destination === "document";
}

function isAppShellAsset(url) {
  const p = url.pathname;
  if (p === "/static/app.js" || p === "/static/style.css") return true;
  return false;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
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

  /* HTML e bundles: rede primeiro — evita SPA presa em JS/CSS antigo após deploy. */
  if (isNavigateRequest(req) || isAppShellAsset(url)) {
    event.respondWith(
      fetch(req)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, cloned));
          }
          return response;
        })
        .catch(() =>
          caches.match(req).then((hit) => hit || (isNavigateRequest(req) ? caches.match("/") : undefined)),
        ),
    );
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
