// LEXIA — Service worker : application hors ligne, mises à jour, réception de fichiers partagés (Android)
const VERSION = 'lexia-1.0.0';
const SHELL = ['./', 'index.html', 'app.css', 'app.js', 'core.js', 'vault.js', 'knowledge.js', 'llm.js', 'privacy.js', 'search.js', 'office.js',
  'v_chat.js', 'v_auto.js', 'v_docs.js', 'v_dossiers.js', 'v_more.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable.png'];

self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL))); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('lexia-') && k !== VERSION && k !== 'lexia-share').map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // API et ressources externes : jamais mises en cache
  if (e.request.method === 'POST' && url.pathname.endsWith('/share')) { e.respondWith(receiveShare(e.request)); return; }
  if (e.request.method !== 'GET' || url.pathname.includes('/v1/')) return;
  e.respondWith(caches.match(e.request, { ignoreSearch:true }).then(hit => hit || fetch(e.request).catch(() => caches.match('index.html'))));
});

// Les fichiers partagés sont conservés quelques instants dans un cache local, puis chiffrés et supprimés dès le déverrouillage.
async function receiveShare(req){
  try {
    const form = await req.formData(); const c = await caches.open('lexia-share'); let i = 0;
    for (const f of form.getAll('files')) {
      if (!(f instanceof File)) continue;
      await c.put(new Request(`share-${Date.now()}-${i++}`), new Response(f, { headers:{ 'content-type':f.type || 'application/octet-stream', 'x-name':encodeURIComponent(f.name) } }));
    }
  } catch (err) {}
  return Response.redirect('./#/docs', 303);
}
