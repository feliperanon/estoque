/* Alinhar versões com index.html. Bump CACHE_NAME quando mudar precache ou lógica. */
const CACHE_NAME = "estoque-v100";
const PRECACHE_URLS = [
  "/",
  "/app",
  "/static/style.css?v=72",
  "/static/app.js?v=104",
  "/static/manifest.json",
  "/static/favicon.svg",
];

function isNavigateRequest(request) {
  return request.mode === "navigate" || request.destination === "document";
}

function isAppShellAsset(url) {
  const p = url.pathname;
  return p === "/static/app.js" || p === "/static/style.css";
}

/** Nunca devolver undefined para respondWith (comportamento indefinido no navegador). */
function offlineDocumentFallback() {
  return new Response(
    "<!DOCTYPE html><html lang=\"pt-BR\"><meta charset=\"utf-8\"><title>Sem conexão</title><body style=\"font-family:sans-serif;padding:24px\"><p>Sem conexão com o servidor. Conecte-se à internet e abra o sistema de novo.</p></body></html>",
    { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

/** Evita devolver HTML em pedido de JS (quebraria o parser e deixaria a página em branco). */
function offlineScriptNoOp() {
  return new Response(
    "/* offline: recarregue com internet */\n",
    { status: 200, headers: { "Content-Type": "application/javascript; charset=utf-8" } },
  );
}

function offlineCssEmpty() {
  return new Response(
    "/* offline */\n",
    { status: 200, headers: { "Content-Type": "text/css; charset=utf-8" } },
  );
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
          caches.match(req).then((hit) => {
            if (hit) return hit;
            if (isNavigateRequest(req)) {
              return caches.match("/").then((doc) => doc || offlineDocumentFallback());
            }
            if (url.pathname.endsWith(".js")) return offlineScriptNoOp();
            if (url.pathname.endsWith(".css")) return offlineCssEmpty();
            return offlineDocumentFallback();
          }),
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
        .catch(() => caches.match("/").then((doc) => doc || offlineDocumentFallback()));
    }),
  );
});
