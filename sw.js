// ICU 工作站 Service Worker v2.4
// 202605272235 — 网络优先 + 自清理 + 强制更新

const CACHE_NAME = 'icu-workstation-202605272235';
const APP_STATIC = [
  './styles.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// 安装: 只缓存静态资源，不缓存 HTML
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_STATIC).catch(() => {});
    })
  );
  // 强制立即激活，不等待旧 SW 释放
  self.skipWaiting();
});

// 激活: 清除所有旧缓存 + 接管所有页面
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((k) => caches.delete(k)));
    }).then(() => {
      return caches.open(CACHE_NAME);
    }).then(() => {
      // 强制接管所有打开的页面
      return self.clients.claim();
    }).then(() => {
      // 通知所有页面刷新
      return self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'force-reload', version: '202605272235' });
        });
      });
    })
  );
});

// 请求拦截: HTML 走网络，静态资源缓存优先
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Share Target: 接收云盘分享的 JSON
  if (event.request.method === 'POST' && url.pathname.endsWith('/index.html')) {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const file = formData.get('data');
          if (file && file.name && file.name.endsWith('.json')) {
            const text = await file.text();
            JSON.parse(text);
            const clients = await self.clients.matchAll({ type: 'window' });
            clients.forEach((c) => c.postMessage({ type: 'shared-file', content: text }));
          }
        } catch (e) {}
        return Response.redirect('./index.html', 303);
      })()
    );
    return;
  }

  if (event.request.method !== 'GET') return;

  // HTML 文件: 永远从网络取，不缓存
  if (event.request.destination === 'document' || url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request).then((cached) => {
          return cached || new Response('Offline - please connect to internet', { status: 503 });
        });
      })
    );
    return;
  }

  // 静态资源: 缓存优先
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        // 后台更新
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
