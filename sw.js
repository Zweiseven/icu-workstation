// ICU 工作站 Service Worker v2.6
// 202605290030

const BUILD_VERSION = "202605290030";
const CACHE_NAME = "icu-workstation-" + BUILD_VERSION;
const APP_STATIC = [
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_STATIC).catch(() => {});
    })
  );
  if (!self.registration.active) {
    self.skipWaiting();
  }
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "skip-waiting") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    }).then(() => self.clients.claim())
    .then(() => {
      return self.clients.matchAll({ type: "window" }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: "sw-updated", version: BUILD_VERSION });
        });
      });
    })
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (event.request.method === "POST" && url.pathname.endsWith("/index.html")) {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const file = formData.get("data");
          if (file && file.name && file.name.endsWith(".json")) {
            const text = await file.text();
            JSON.parse(text);
            // 存入 Cache API，冷启动也能读取（比 postMessage 可靠）
            const cache = await caches.open("icu-shared");
            await cache.put("/__shared__", new Response(text));
          }
        } catch (e) {}
        return Response.redirect("./index.html?shared=1", 303);
      })()
    );
    return;
  }

  if (event.request.method !== "GET") return;

  if (event.request.destination === "document" || url.pathname.endsWith(".html") || url.pathname === "/" || url.pathname.endsWith("/")) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request).then((cached) => {
          return cached || new Response("Offline", { status: 503 });
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        fetch(event.request).then((resp) => {
          if (resp.ok) caches.open(CACHE_NAME).then((c) => c.put(event.request, resp));
        }).catch(() => {});
        return cached;
      }
      return fetch(event.request).then((resp) => {
        if (resp.ok) {
          caches.open(CACHE_NAME).then((c) => c.put(event.request, resp.clone()));
        }
        return resp;
      });
    })
  );
});
