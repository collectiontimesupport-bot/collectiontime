const VERSIONE = 'ct-offline-2';
const ATTESA = 6000;
const MAX_FOTO = 600;
const FOTO = /\.(webp|png|jpe?g|gif|svg|avif)$/i;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== VERSIONE) await caches.delete(k);
  await self.clients.claim();
})()));

const daSaltare = u => u.origin !== location.origin || /^\/(__|_admin)\//.test(u.pathname) || u.pathname.endsWith('/sw.js');

self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || daSaltare(u) || r.headers.has('range')) return;
  e.respondWith(rispondi(e, r, u));
});

async function rispondi(e, r, u) {
  const cache = await caches.open(VERSIONE);
  const foto = FOTO.test(u.pathname);
  const copia = await cache.match(r);
  if (copia && foto && u.searchParams.has('v')) return copia;

  const rete = fetch(u.searchParams.has('v') ? r : new Request(r, { cache: 'no-cache' })).then(res => {
    if (res.ok && res.type === 'basic') {
      const salva = cache.put(r, res.clone()).then(() => foto && limitaFoto(cache));
      e.waitUntil(salva.catch(() => {}));
    }
    return res;
  });
  rete.catch(() => {});

  try {
    if (!copia) return await rete;
    return await Promise.race([rete, new Promise((_, no) => setTimeout(no, ATTESA))]);
  } catch (err) {
    if (copia) return copia;
    if (r.mode === 'navigate') {
      const altra = await cache.match(r, { ignoreSearch: true });
      return altra || paginaOffline();
    }
    return Response.error();
  }
}

async function limitaFoto(cache) {
  const tutte = (await cache.keys()).filter(k => FOTO.test(new URL(k.url).pathname));
  for (const k of tutte.slice(0, Math.max(0, tutte.length - MAX_FOTO))) await cache.delete(k);
}

function paginaOffline() {
  return new Response('<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sei offline</title>' +
    '<style>body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;font:1.0625rem/1.5 system-ui,sans-serif;background:#fff;color:#1A2140;text-align:center}' +
    '@media(prefers-color-scheme:dark){body{background:#1A2140;color:#fff}}a{color:#F2A900;font-weight:700}</style>' +
    '<div><h1>Sei offline</h1><p>Questa pagina non è ancora stata aperta con la connessione, quindi non è salvata sul telefono.</p><p><a href="/">Torna alla Home</a></p></div>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
