// LEXIA — Client du modèle (API Anthropic Messages, flux SSE), direct ou via le serveur du cabinet

export const MODELS = [
  ['claude-opus-5-5', 'Claude Opus 5.5 — profondeur maximale'],
  ['claude-sonnet-5-5', 'Claude Sonnet 5.5 — équilibre vitesse / qualité'],
  ['claude-haiku-5-5', 'Claude Haiku 5.5 — rapide et économique'],
];

const ERR = {
  400: 'Requête refusée par l\'API (document trop volumineux ou paramètre non pris en charge).',
  401: 'Clé API invalide ou révoquée. Vérifiez-la dans Paramètres.',
  403: 'Accès refusé : la clé n\'a pas les droits nécessaires.',
  404: 'Modèle introuvable : vérifiez l\'identifiant du modèle dans Paramètres.',
  413: 'Contenu trop volumineux : réduisez le nombre ou la taille des documents joints.',
  429: 'Limite de débit atteinte : patientez quelques secondes.',
  500: 'Erreur du service d\'IA.', 529: 'Service d\'IA surchargé.',
};

export async function complete({ settings, system, messages, model, maxTokens = 8000, web = false, webOfficial = false, thinking = false, onText, onStatus, signal, officialDomains = [] }){
  const proxy = settings.endpoint === 'proxy';
  const url = proxy ? (settings.proxyUrl || location.origin).replace(/\/$/, '') + '/v1/messages' : 'https://api.anthropic.com/v1/messages';
  const headers = { 'content-type':'application/json', 'anthropic-version':'2023-06-01' };
  if (proxy) { if (settings.proxyToken) headers['x-lexia-token'] = settings.proxyToken; }
  else { headers['x-api-key'] = settings.apiKey; headers['anthropic-dangerous-direct-browser-access'] = 'true'; }
  if (!proxy && !settings.apiKey) throw new Error('Aucune clé API configurée. Ouvrez Paramètres → Moteur d\'IA.');

  const body = { model: model || settings.model, max_tokens: maxTokens, stream: true,
    system: [{ type:'text', text: system, cache_control: { type:'ephemeral' } }], messages };
  if (web) body.tools = [{ type:'web_search_20250305', name:'web_search', max_uses: 5, ...(webOfficial && officialDomains.length ? { allowed_domains: officialDomains } : {}) }];
  if (thinking) { body.thinking = { type:'enabled', budget_tokens: Math.min(12000, Math.floor(maxTokens * 0.6)) }; body.max_tokens = Math.max(maxTokens, 16000); }

  let attempt = 0, res;
  while (true) {
    res = await fetch(url, { method:'POST', headers, body: JSON.stringify(body), signal });
    if (res.ok) break;
    if ((res.status === 429 || res.status >= 500) && attempt < 3) { attempt++; onStatus?.(`Nouvelle tentative (${attempt}/3)…`); await new Promise(r => setTimeout(r, 1500 * 2 ** attempt)); continue; }
    let msg = ERR[res.status] || `Erreur ${res.status}`;
    try { const j = await res.json(); if (j?.error?.message) msg += ' — ' + j.error.message; } catch {}
    throw new Error(msg);
  }

  const reader = res.body.getReader(); const dec = new TextDecoder();
  let buf = '', text = '', usage = { in:0, out:0, cacheRead:0, cacheWrite:0 }, stop = null; const sources = new Map();
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream:true });
    let idx;
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const evt = buf.slice(0, idx); buf = buf.slice(idx + 2);
      const line = evt.split('\n').find(l => l.startsWith('data:')); if (!line) continue;
      let d; try { d = JSON.parse(line.slice(5).trim()); } catch { continue; }
      switch (d.type) {
        case 'message_start': { const u = d.message?.usage || {}; usage.in = u.input_tokens || 0; usage.cacheRead = u.cache_read_input_tokens || 0; usage.cacheWrite = u.cache_creation_input_tokens || 0; break; }
        case 'content_block_start':
          if (d.content_block?.type === 'server_tool_use') onStatus?.('Recherche sur les sources en ligne…');
          if (d.content_block?.type === 'web_search_tool_result' && Array.isArray(d.content_block.content)) for (const r of d.content_block.content) if (r.url) sources.set(r.url, r.title || r.url);
          if (d.content_block?.type === 'thinking') onStatus?.('Réflexion approfondie…');
          if (d.content_block?.type === 'text' && text && !text.endsWith('\n')) { text += '\n\n'; }
          break;
        case 'content_block_delta':
          if (d.delta?.type === 'text_delta') { text += d.delta.text; onText?.(text); }
          else if (d.delta?.type === 'citations_delta' && d.delta.citation?.url) sources.set(d.delta.citation.url, d.delta.citation.title || d.delta.citation.url);
          break;
        case 'message_delta': if (d.usage?.output_tokens) usage.out = d.usage.output_tokens; if (d.delta?.stop_reason) stop = d.delta.stop_reason; break;
        case 'error': throw new Error('Erreur du service : ' + (d.error?.message || 'inconnue'));
      }
    }
  }
  return { text, usage, stop, sources: Array.from(sources, ([url, title]) => ({ url, title })) };
}

export function parseJsonLoose(text){
  const t = text.replace(/```(?:json)?/g, '').trim();
  const starts = [t.indexOf('['), t.indexOf('{')].filter(i => i >= 0);
  const s = starts.length ? Math.min(...starts) : -1; if (s < 0) throw new Error('Aucun JSON dans la réponse');
  const open = t[s], close = open === '[' ? ']' : '}'; const e = t.lastIndexOf(close);
  return JSON.parse(t.slice(s, e + 1));
}
