// ICU 工作站 Service Worker v2.1
// 离线缓存 + 分享接收 + 静默更新

const CACHE_NAME = 'icu-workstation-202605272224';
const APP_FILES = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// 安装
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_FILES).catch(() => {});
    })
  );
  self.skipWaiting();
});


// 通知页面有新版本可用
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
    }).then(() => {
      // 告诉所有打开的页面: 新版本已就绪
      return self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'update-available', version: '202605272224' });
        });
      });
    })
  );
  self.clients.claim();
});

// Share Target: 接收从云盘分享的 JSON 文件
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // 处理分享的 POST 请求
  if (event.request.method === 'POST' && url.pathname.endsWith('/index.html')) {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const file = formData.get('data');
          if (file && file.name && file.name.endsWith('.json')) {
            const text = await file.text();
            JSON.parse(text); // 验证 JSON
            const clients = await self.clients.matchAll({ type: 'window' });
            clients.forEach((client) => {
              client.postMessage({ type: 'shared-file', content: text });
            });
          }
        } catch (e) { /* ignore parse errors */ }
        return Response.redirect('./index.html', 303);
      })()
    );
    return;
  }

  // 普通 GET 请求: 缓存优先
  if (event.request.method !== 'GET') return;
  if (!url.hostname || url.hostname !== self.location.hostname) return;

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
