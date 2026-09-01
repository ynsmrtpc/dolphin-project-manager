/*
 * Dolphin service worker.
 *
 * Strateji:
 *  - /_next/static ve /icons : icerik-adresli, degismez -> once onbellek
 *  - gezinme (HTML)          : once ag, cevrimdisiysa /offline sayfasi
 *  - /api ve digerleri       : dokunma (kimlik dogrulama ve canli veri)
 */
const VERSION = "dolphin-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await cache.addAll([OFFLINE_URL, "/icons/icon-192.png"]);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

function isImmutableAsset(url) {
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Oturum ve canli veri her zaman agdan gelmeli.
  if (url.pathname.startsWith("/api/")) return;

  if (isImmutableAsset(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(ASSET_CACHE);
          cache.put(request, response.clone());
        }
        return response;
      })(),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cache = await caches.open(SHELL_CACHE);
          const fallback = await cache.match(OFFLINE_URL);
          return (
            fallback ??
            new Response("Çevrimdışısınız.", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            })
          );
        }
      })(),
    );
  }
});
