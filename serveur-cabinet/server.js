// LEXIA — Serveur dédié du cabinet (optionnel). Node.js 18+, aucune dépendance.
// Sert l'application et relaie les requêtes vers l'API Anthropic : la clé API reste sur le serveur,
// chaque collaborateur dispose de son propre jeton, et le contenu des échanges n'est jamais journalisé.
//
// Variables d'environnement :
//   ANTHROPIC_API_KEY  clé API du cabinet (obligatoire)
//   LEXIA_TOKENS       jetons des utilisateurs, format "nom1:jeton1,nom2:jeton2" (obligatoire)
//   PORT               port d'écoute (défaut 8080)
//   TLS_CERT, TLS_KEY  chemins du certificat et de la clé pour servir en HTTPS directement (sinon placer derrière un proxy HTTPS)
//   RATE_PER_MIN       requêtes IA maximales par utilisateur et par minute (défaut 30)

const http = require('http'), https = require('https'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const KEY = process.env.ANTHROPIC_API_KEY;
const TOKENS = new Map((process.env.LEXIA_TOKENS || '').split(',').map(s => s.trim()).filter(Boolean).map(s => { const i = s.indexOf(':'); return [s.slice(i + 1), s.slice(0, i)]; }));
const RATE = +process.env.RATE_PER_MIN || 30;
if (!KEY || !TOKENS.size) { console.error('Définissez ANTHROPIC_API_KEY et LEXIA_TOKENS.'); process.exit(1); }

const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.png':'image/png', '.webmanifest':'application/manifest+json', '.json':'application/json' };
const SEC = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(self), microphone=(self), geolocation=()', 'Cross-Origin-Opener-Policy': 'same-origin',
};
const hits = new Map();
const log = (...a) => console.log(new Date().toISOString(), ...a);

function who(req){
  const t = String(req.headers['x-lexia-token'] || '');
  for (const [tok, name] of TOKENS) { const a = Buffer.from(tok), b = Buffer.from(t); if (a.length === b.length && crypto.timingSafeEqual(a, b)) return name; }
  return null;
}
function limited(user){
  const now = Date.now(); const arr = (hits.get(user) || []).filter(t => now - t < 60000); arr.push(now); hits.set(user, arr); return arr.length > RATE;
}

function relay(req, res, user){
  let size = 0; const chunks = [];
  req.on('data', c => { size += c.length; if (size > 45e6) { res.writeHead(413); res.end(); req.destroy(); } else chunks.push(c); });
  req.on('end', () => {
    if (res.writableEnded) return;
    const body = Buffer.concat(chunks);
    const up = https.request({ host:'api.anthropic.com', path:'/v1/messages', method:'POST', headers:{
      'content-type':'application/json', 'content-length':body.length, 'x-api-key':KEY, 'anthropic-version':req.headers['anthropic-version'] || '2023-06-01' } }, r => {
      res.writeHead(r.statusCode, { 'content-type':r.headers['content-type'] || 'application/json', 'cache-control':'no-store', ...SEC });
      r.pipe(res); r.on('end', () => log('IA', user, r.statusCode, `${(size / 1024).toFixed(0)} Ko envoyés`));
    });
    up.on('error', e => { log('ERREUR amont', e.message); if (!res.headersSent) res.writeHead(502, SEC); res.end(JSON.stringify({ error:{ message:'Service IA injoignable' } })); });
    up.end(body);
  });
}

function serveStatic(req, res){
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const file = path.resolve(ROOT, '.' + p);
  if (!file.startsWith(ROOT + path.sep) || file.includes(`${path.sep}serveur-cabinet${path.sep}`) || !TYPES[path.extname(file)]) { res.writeHead(404, SEC); return res.end('Introuvable'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, SEC); return res.end('Introuvable'); }
    res.writeHead(200, { 'content-type':TYPES[path.extname(file)], 'cache-control': p.endsWith('sw.js') ? 'no-cache' : 'public, max-age=300', ...SEC }); res.end(data);
  });
}

function handler(req, res){
  if (req.method === 'POST' && req.url === '/v1/messages') {
    const user = who(req); if (!user) { log('REFUS jeton invalide', req.socket.remoteAddress); res.writeHead(401, { 'content-type':'application/json', ...SEC }); return res.end(JSON.stringify({ error:{ message:'Jeton LEXIA invalide' } })); }
    if (limited(user)) { res.writeHead(429, { 'content-type':'application/json', ...SEC }); return res.end(JSON.stringify({ error:{ message:'Trop de requêtes, patientez une minute' } })); }
    return relay(req, res, user);
  }
  if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res);
  res.writeHead(405, SEC); res.end();
}

const PORT = +process.env.PORT || 8080;
if (process.env.TLS_CERT && process.env.TLS_KEY) {
  https.createServer({ cert:fs.readFileSync(process.env.TLS_CERT), key:fs.readFileSync(process.env.TLS_KEY) }, (q, r) => { r.setHeader('Strict-Transport-Security', 'max-age=31536000'); handler(q, r); }).listen(PORT, () => log(`LEXIA (HTTPS) sur le port ${PORT} — ${TOKENS.size} utilisateur(s)`));
} else http.createServer(handler).listen(PORT, () => log(`LEXIA sur le port ${PORT} — ${TOKENS.size} utilisateur(s). Placez ce serveur derrière un proxy HTTPS.`));
