// Sube este número cuando cambies la lista SHELL o la estrategia de caché: al cambiar sw.js el
// navegador instala el nuevo service worker y, al activarse, borra las cachés de versiones anteriores.
const CACHE = 'metalsys-v2';
const SHELL = [
  '/',
  '/index.html',
  '/app.jsx',
  '/crt.css',
  '/tweaks-panel.jsx',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  'https://unpkg.com/react@18.3.1/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone@7.29.0/babel.min.js',
  'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js',
  'https://unpkg.com/marked@12.0.0/marked.min.js',
];
const SHELL_EXTERNAL = new Set(SHELL.filter(u => u.startsWith('http')));

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Guarda una copia en caché sin que un fallo de almacenamiento rompa la respuesta.
function remember(req, res) {
  if (res && res.ok && res.status === 200) {
    const clone = res.clone();
    caches.open(CACHE).then(c => c.put(req, clone)).catch(() => {});
  }
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  // Solo GET por http(s). Todo lo demás (POST, esquemas como chrome-extension:) lo gestiona el navegador.
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // API: siempre a la red, sin pasar por el service worker.
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return;

  // Recursos externos que no son del shell (analíticas, fuentes, etc.): no se interceptan.
  if (url.origin !== self.location.origin) {
    if (!SHELL_EXTERNAL.has(req.url)) return;
    // Librerías con versión fija en la URL: primero caché (nunca cambian).
    e.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => remember(req, res)))
    );
    return;
  }

  // Archivos de la propia web (index.html, app.jsx, crt.css...): primero la RED, para que una
  // versión nueva se cargue siempre; la caché solo se usa sin conexión. (Antes era "primero caché"
  // con un nombre de caché fijo, y el navegador seguía ejecutando el app.jsx viejo.)
  e.respondWith(
    fetch(req)
      .then(res => remember(req, res))
      .catch(() => caches.match(req).then(cached => cached || caches.match('/index.html')).then(r => r || Response.error()))
  );
});
