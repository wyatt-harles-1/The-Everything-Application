// Kosmos service worker — offline app shell only.
//
// Design goals:
//  - Navigations are NETWORK-FIRST so authed pages (and live data) stay fresh;
//    only when the network fails do we show the cached /offline page.
//  - Static build assets use stale-while-revalidate for snappy loads.
//  - We NEVER intercept API / auth / cross-origin (Supabase) requests, so the
//    Supabase cookie session is completely untouched.
//  - A versioned cache name + skipWaiting/clients.claim avoids serving a stale
//    shell after a deploy (bump VERSION on releases that change the shell).

const VERSION = "kosmos-v1";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(`${VERSION}-shell`)
      .then((cache) => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.startsWith(VERSION))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Same-origin only (Supabase + other hosts always go straight to network).
  if (url.origin !== self.location.origin) return;

  // Never touch API or auth — must always be live for sessions/data.
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/auth")) return;

  // Page navigations: network-first, offline page as the fallback.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match(OFFLINE_URL).then((r) => r || Response.error()),
      ),
    );
    return;
  }

  // Build assets / icons: stale-while-revalidate.
  if (url.pathname.startsWith("/_next/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(`${VERSION}-assets`).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
  }
});
