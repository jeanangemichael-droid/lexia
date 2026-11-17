// LEXIA — Noyau partagé : état, utilitaires d'interface, import de documents, appel des agents
import { Vault, uid, b64 } from './vault.js';
import { AGENTS, BASE_RULES, VERIFIER_PROMPT, OFFICIAL_DOMAINS, DEFAULT_TESTS, routeAgent } from './knowledge.js';
import { complete } from './llm.js';
import { Pseudonymizer } from './privacy.js';
import { Index } from './search.js';
import { esc, readDocx, readOdt } from './office.js';
import { ARTIFACT, cap } from './platform.js';
export { ARTIFACT, cap };

export const V = new Vault();
export const S = { route:'chat', param:null, idx:null, idxDirty:true, hash:'' };
export { esc, uid };

// ——————————————————————————————————— Icônes (SVG en ligne)
const P = {
  chat:'<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  scale:'<path d="M12 3v18M5 21h14M6 7h12M6 7l-3 7a3.5 3.5 0 0 0 6 0zM18 7l-3 7a3.5 3.5 0 0 0 6 0z"/>',
  docs:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  folder:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  tpl:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3M14.5 12v6M11.5 15h6"/>',
  history:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  brain:'<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V5a3 3 0 0 0-3-1zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1"/>',
  gauge:'<path d="M12 14l4-4M3.3 17a9 9 0 1 1 17.4 0"/><circle cx="12" cy="14" r="1.5"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  lock:'<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  plus:'<path d="M12 5v14M5 12h14"/>', send:'<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/>', stop:'<rect x="6" y="6" width="12" height="12" rx="2"/>',
  clip:'<path d="M21 11l-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l8.6-8.6a3.7 3.7 0 0 1 5.2 5.2l-8.6 8.6a1.8 1.8 0 0 1-2.6-2.6l8-8"/>',
  mic:'<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5"/>',
  doc:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  contract:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4M14 3v5h5v3"/><path d="M14 20l6-6 2 2-6 6h-2z"/>',
  note:'<path d="M4 4h12l4 4v12H4z"/><path d="M8 4v4M12 4v4M8 13h8M8 17h5"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  pen:'<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  check:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 15l2 2 4-4"/>',
  compare:'<path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3M12 2v20"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  gavel:'<path d="m14 13-7.5 7.5a2.1 2.1 0 0 1-3-3L11 10M16 16l6-6M8 8l6-6M9 7l8 8M21 21H12"/>',
  list:'<path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  trash:'<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>', download:'<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  copy:'<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  word:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M8 12l1.5 6 2.5-5 2.5 5 1.5-6"/>',
  camera:'<path d="M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="4"/>',
  upload:'<path d="M12 21V9M7 14l5-5 5 5M5 3h14"/>', x:'<path d="M18 6 6 18M6 6l12 12"/>', menu:'<path d="M3 6h18M3 12h18M3 18h18"/>',
  star:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>', edit:'<path d="M11 4H4v16h16v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>',
  refresh:'<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8M21 3v5h-5"/>', eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  users:'<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-5-6.7"/>', globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  bolt:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>', calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>', save:'<path d="M5 3h11l5 5v13H3V3zM7 3v6h8M7 21v-7h10v7"/>',
};
export const icon = (n, cls = 'icon') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || P.doc}</svg>`;

// ——————————————————————————————————— Utilitaires d'interface
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
export function h(html){ const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
export function toast(msg, type = ''){ const t = h(`<div class="toast ${type}">${esc(msg)}</div>`); $('#toasts').appendChild(t); setTimeout(() => t.remove(), type === 'err' ? 7000 : 3500); }
export function modal({ title, body, actions = [], wide = false, onOpen }){
  const bg = h(`<div class="modalBg"><div class="modal" ${wide ? 'style="max-width:900px"' : ''}><header><h2>${esc(title)}</h2><button class="ibtn" data-x>${icon('x')}</button></header><div class="mb"></div><footer></footer></div></div>`);
  const mb = $('.mb', bg); if (typeof body === 'string') mb.innerHTML = body; else if (body) mb.appendChild(body);
  const close = () => bg.remove();
  $('[data-x]', bg).onclick = close; bg.addEventListener('click', e => { if (e.target === bg) close(); });
  const ft = $('footer', bg);
  if (!actions.length) ft.remove();
  for (const a of actions) { const b = h(`<button class="btn ${a.cls || ''}">${esc(a.label)}</button>`); b.onclick = async () => { const r = await a.onClick?.(bg); if (r !== false) close(); }; ft.appendChild(b); }
  document.body.appendChild(bg); onOpen?.(bg);
  return { el: bg, close };
}
export function confirmBox(title, text, okLabel = 'Confirmer', danger = false){
  return new Promise(res => modal({ title, body:`<p>${esc(text)}</p>`, actions:[{ label:'Annuler', cls:'ghost', onClick:() => res(false) }, { label:okLabel, cls: danger ? 'danger' : 'pri', onClick:() => res(true) }] }));
}
export function promptBox(title, label, value = '', multiline = false){
  return new Promise(res => {
    const m = modal({ title, body:`<label class="f">${esc(label)}</label>${multiline ? `<textarea id="pb">${esc(value)}</textarea>` : `<input type="text" id="pb" value="${esc(value)}">`}`,
      actions:[{ label:'Annuler', cls:'ghost', onClick:() => res(null) }, { label:'Valider', cls:'pri', onClick:el => res($('#pb', el).value) }], onOpen: el => setTimeout(() => $('#pb', el).focus(), 50) });
  });
}
export const fmtDate = (t, withTime = false) => t ? new Date(t).toLocaleDateString('fr-FR', withTime ? { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' } : { day:'2-digit', month:'short', year:'numeric' }) : '';
export const fmtSize = n => n > 1e6 ? (n/1e6).toFixed(1) + ' Mo' : Math.max(1, Math.round(n/1e3)) + ' Ko';
export const today = () => new Date().toISOString().slice(0,10);
export const agentById = id => AGENTS.find(a => a.id === id) || AGENTS[0];
export const avatar = (a, size = 28) => `<span class="av" style="background:${a.color};width:${size}px;height:${size}px">${esc(a.name.slice(0,2).toUpperCase())}</span>`;

// ——————————————————————————————————— Paramètres
export const DEFAULTS = { id:'main', endpoint: ARTIFACT ? 'claude' : 'direct', apiKey:'', proxyUrl:'', proxyToken:'', model:'claude-sonnet-5-5', modelDeep:'claude-opus-5-5', modelFast:'claude-haiku-5-5',
  maxTokens:8000, autolock:5, pseudo:true, pdfAsText:true, autoIndex:true, confTerms:'', theme:'dark', priceIn:3, priceOut:15,
  cabinet:{ name:'', address:'', style:'', font:'Times New Roman' }, opts:{ corpus:true, verify:false, web:false, webOfficial:true, thinking:false, deep:false }, docNum:0, lastBench:0 };
export function settings(){ const s = V.get('settings','main'); return s ? { ...DEFAULTS, ...s, cabinet:{ ...DEFAULTS.cabinet, ...(s.cabinet||{}) }, opts:{ ...DEFAULTS.opts, ...(s.opts||{}) } } : { ...DEFAULTS }; }
export async function saveSettings(patch){ const s = { ...settings(), ...patch }; await V.put('settings', s); return s; }

export const engineReady = (st = settings()) => st.endpoint === 'claude' ? ARTIFACT : st.endpoint === 'proxy' ? true : !!st.apiKey;
export const engineHint = () => ARTIFACT ? 'Le moteur IA n\'est pas configuré : ouvrez Paramètres et sécurité → Moteur d\'IA.' : 'Configurez votre clé API dans Paramètres et sécurité → Moteur d\'IA.';

export async function seedIfEmpty(){
  if (!V.get('settings','main')) await V.put('settings', { ...DEFAULTS });
  if (!V.all('tests').length) for (const t of DEFAULT_TESTS) await V.put('tests', { ...t, builtin:true });
}

// ——————————————————————————————————— Journal d'audit et consommation
export async function audit(action, detail = ''){
  await V.put('audit', { ts:Date.now(), action, detail:String(detail).slice(0,300) });
  const all = V.all('audit'); if (all.length > 600) for (const a of all.sort((x,y) => x.ts - y.ts).slice(0, all.length - 500)) await V.del('audit', a.id);
}
export async function logUsage(u, model){
  const id = today(); const cur = V.get('usage', id) || { id, in:0, out:0, cache:0, calls:0, models:{} };
  cur.in += u.in || 0; cur.out += u.out || 0; cur.cache += u.cacheRead || 0; cur.calls++; cur.models[model] = (cur.models[model]||0) + 1;
  await V.put('usage', cur);
}

// ——————————————————————————————————— Base documentaire
export function docIndex(){
  if (!S.idx || S.idxDirty) { S.idx = new Index().build(V.all('docs')); S.idxDirty = false; }
  return S.idx;
}
export const docByNum = n => V.all('docs').find(d => d.num === +n);

async function fileB64(file){ return b64.enc(await file.arrayBuffer()); }
export async function importFiles(files, { dossierId = null, onDone } = {}){
  const out = []; const st = settings(); let num = st.docNum || 0;
  for (const f of files) {
    try {
      const name = f.name || 'photo.jpg'; const ext = (name.split('.').pop() || '').toLowerCase(); const mime = f.type || '';
      const doc = { title:name.replace(/\.[^.]+$/, ''), file:name, mime, size:f.size, dossierId, tags:[], created:Date.now(), text:'', kind:'text' };
      if (ext === 'docx') doc.text = await readDocx(await f.arrayBuffer());
      else if (ext === 'odt') doc.text = await readOdt(await f.arrayBuffer());
      else if (ext === 'pdf' || mime === 'application/pdf') {
        doc.kind = 'pdf'; doc.mime = 'application/pdf';
        try { const r = await pdfText(await f.arrayBuffer()); if (r.text.replace(/\s/g, '').length > 60 * r.pages) { doc.text = r.text; doc.indexed = true; doc.textSource = 'local'; } doc.pages = r.pages; }
        catch (e) { console.warn('Lecture PDF locale impossible', e); }
      }
      else if (mime.startsWith('image/')) { doc.kind = 'image'; }
      else if (['txt','md','csv','json','xml','rtf'].includes(ext) || mime.startsWith('text/')) doc.text = await f.text();
      else if (['html','htm'].includes(ext)) doc.text = new DOMParser().parseFromString(await f.text(), 'text/html').body.textContent;
      else { toast(`Format non pris en charge : ${name}`, 'err'); continue; }
      if (doc.kind !== 'text' && f.size > 30e6) { toast(`${name} dépasse 30 Mo (limite de l'IA)`, 'err'); continue; }
      doc.num = ++num;
      if (doc.kind !== 'text') { doc.id = uid(); doc.hasBlob = true; await V.putBlob(doc.id, await fileB64(f), doc.mime); }
      await V.put('docs', doc); out.push(doc);
      await audit('Import document', `DOC ${doc.num} · ${doc.kind} · ${fmtSize(f.size)}`);
    } catch (e) { toast(`Échec d'import de ${f.name} : ${e.message}`, 'err'); }
  }
  await saveSettings({ docNum:num }); S.idxDirty = true;
  if (st.autoIndex && engineReady(st)) for (const d of out.filter(d => d.kind !== 'text' && !d.text)) transcribe(d).then(() => onDone?.()).catch(e => toast(`Indexation de « ${d.title} » : ${e.message}`, 'err'));
  onDone?.();
  return out;
}

// Transcription intégrale (OCR) des PDF et photos pour la recherche plein texte et la pseudonymisation
export async function transcribe(doc){
  const blob = await V.getBlob(doc.id); if (!blob) throw new Error('fichier introuvable');
  const st = settings(); toast(`Indexation de « ${doc.title} » en cours…`);
  const OCR = 'Tu es un outil d\'OCR juridique. Transcris intégralement et fidèlement le texte du document fourni, page après page, en conservant titres, numérotation des articles, montants et dates. Aucune reformulation, aucun commentaire. Indique [illisible] pour un passage illisible et « --- page n --- » entre les pages.';
  const model = st.endpoint === 'claude' ? st.model : st.modelFast;
  let text = '', usage = { in:0, out:0 };
  if (doc.kind === 'pdf') {
    const bytes = b64.dec(blob.b);
    const loc = await pdfText(bytes.slice().buffer).catch(() => null);
    if (loc && loc.text.replace(/\s/g, '').length > 60 * loc.pages) text = loc.text;
    else if (st.endpoint === 'claude') {
      // Mode abonnement : les pages sont converties en images puis transcrites par lots
      const pages = await pdfImages(bytes.slice().buffer, 40);
      const lim = await (await cap('sample'))?.limits().catch(() => null); const per = Math.max(1, lim?.images?.maxCount || 5);
      for (let i = 0; i < pages.length; i += per) {
        const batch = pages.slice(i, i + per);
        const r = await complete({ settings:st, model, maxTokens:16000, system:OCR, messages:[{ role:'user', content:[...batch.map(b => ({ type:'image', source:{ type:'base64', media_type:'image/jpeg', data:b } })), { type:'text', text:`Pages ${i + 1} à ${i + batch.length} : transcription intégrale.` }] }] });
        text += (text ? '\n\n' : '') + r.text; usage.in += r.usage.in; usage.out += r.usage.out;
      }
    } else {
      const r = await complete({ settings:st, model, maxTokens:16000, system:OCR, messages:[{ role:'user', content:[{ type:'document', source:{ type:'base64', media_type:'application/pdf', data:blob.b } }, { type:'text', text:'Transcription intégrale :' }] }] });
      text = r.text; usage = r.usage;
    }
  } else {
    const r = await complete({ settings:st, model, maxTokens:16000, system:OCR, messages:[{ role:'user', content:[{ type:'image', source:{ type:'base64', media_type:blob.m || 'image/jpeg', data:blob.b } }, { type:'text', text:'Transcription intégrale :' }] }] });
    text = r.text; usage = r.usage;
  }
  if (usage.in || usage.out) await logUsage(usage, model);
  const d = V.get('docs', doc.id); if (!d) return;
  d.text = text; d.indexed = true; await V.put('docs', d); S.idxDirty = true;
  await audit('Indexation', `DOC ${d.num} · ${usage.in}+${usage.out} jetons`);
  toast(`« ${d.title} » indexé : recherche plein texte disponible`, 'ok');
}

// ——————————————————————————————————— Lecture locale des PDF (pdf.js, aucun envoi)
let pdfjs = null;
async function pdfLib(){
  if (!pdfjs) { pdfjs = await import('./pdf.min.js'); pdfjs.GlobalWorkerOptions.workerSrc = new URL('./pdf.worker.min.js', import.meta.url).href; }
  return pdfjs;
}
export async function pdfText(buf){
  const lib = await pdfLib(); const pdf = await lib.getDocument({ data:new Uint8Array(buf), isEvalSupported:false }).promise; let out = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const c = await (await pdf.getPage(i)).getTextContent();
    out += (i > 1 ? `\n\n--- page ${i} ---\n` : '') + c.items.map(it => (it.str || '') + (it.hasEOL ? '\n' : '')).join('');
  }
  return { text:out.trim(), pages:pdf.numPages };
}
async function pdfImages(buf, max = 40){
  const lib = await pdfLib(); const pdf = await lib.getDocument({ data:new Uint8Array(buf), isEvalSupported:false }).promise; const out = [];
  for (let i = 1; i <= Math.min(pdf.numPages, max); i++) {
    const page = await pdf.getPage(i); const v0 = page.getViewport({ scale:1 }); const scale = Math.min(3, Math.sqrt(1.5e6 / (v0.width * v0.height)));
    const vp = page.getViewport({ scale }); const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    await page.render({ canvasContext:c.getContext('2d'), viewport:vp }).promise;
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85)); out.push(b64.enc(await blob.arrayBuffer()));
  }
  return out;
}

// ——————————————————————————————————— Construction du contexte des agents
export function pseudonymizer(enabled){
  const st = settings(); const terms = [];
  for (const line of (st.confTerms || '').split('\n')) { const [v, t] = line.split('|').map(x => x && x.trim()); if (v) terms.push({ value:v, type:t || 'PERSONNE' }); }
  for (const d of V.all('dossiers')) for (const p of (d.parties || [])) if (p.value) terms.push(p);
  return new Pseudonymizer(enabled ? terms : [], { patterns: enabled });
}

export function lessonsFor(domain){
  const all = V.all('lessons').sort((a,b) => b.created - a.created);
  const pick = (type, n) => all.filter(l => l.type === type && (domain === 'general' || !l.domain || l.domain === 'general' || l.domain === domain)).slice(0, n);
  const L = pick('lecon', 40), J = pick('juris', 15), W = pick('veille', 15);
  if (!L.length && !J.length && !W.length) return '';
  let s = '<lecons>\n';
  for (const l of L) s += `- [${l.ref || 'Leçon'} · ${l.domain || 'général'}] ${l.text}${l.source ? ' (source : ' + l.source + ')' : ''}\n`;
  for (const j of J) s += `- [Jurisprudence · ${j.domain || 'général'}] ${j.text}${j.source ? ' — ' + j.source : ''}\n`;
  for (const w of W) s += `- [Veille ${fmtDate(w.created)}] ${w.text}${w.source ? ' — ' + w.source : ''}\n`;
  return s + '</lecons>';
}

export function buildSystem(agent, { dossier = null, pseudo = null, extra = '' } = {}){
  const st = settings(); const c = st.cabinet;
  let s = BASE_RULES + `\n\nDate du jour : ${new Date().toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' })}.`;
  s += `\n\nTON RÔLE : ${agent.name}, ${agent.title}. ${agent.focus}`;
  if (agent.texts?.length) s += `\nTextes de référence de ta spécialité (carte, pas code ; vérifie avant de citer un article) :\n- ` + agent.texts.join('\n- ');
  if (c.name || c.style) s += `\n\nCABINET : ${c.name || ''}${c.address ? ', ' + c.address : ''}.${c.style ? '\nStyle rédactionnel du cabinet à respecter :\n' + c.style : ''}`;
  if (dossier) {
    const P = x => pseudo ? pseudo.apply(x || '') : (x || '');
    s += `\n\nDOSSIER EN COURS : ${P(dossier.title)} — matière : ${dossier.matiere || 'n.c.'} ; juridiction : ${P(dossier.juridiction) || 'n.c.'} ; client : ${P(dossier.client) || 'n.c.'} ; partie adverse : ${P(dossier.adverse) || 'n.c.'} ; enjeu : ${dossier.enjeu || 'n.c.'}.${dossier.notes ? '\nNotes du dossier : ' + P(dossier.notes).slice(0, 3000) : ''}`;
  }
  const les = lessonsFor(agent.domain); if (les) s += '\n\nLEÇONS VALIDÉES DU CABINET (priment sur ta connaissance générale) :\n' + les;
  if (extra) s += '\n\n' + extra;
  return s;
}

// Contenu d'un document pour l'API (texte pseudonymisé si possible, sinon fichier natif)
export async function docBlocks(doc, pseudo){
  const st = settings();
  if (doc.text && (doc.kind === 'text' || st.pdfAsText)) return [{ type:'text', text:`<document ref="DOC ${doc.num}" titre="${pseudo.apply(doc.title)}">\n${pseudo.apply(doc.text)}\n</document>` }];
  const blob = await V.getBlob(doc.id); if (!blob) return [];
  const b = doc.kind === 'pdf' ? { type:'document', source:{ type:'base64', media_type:'application/pdf', data:blob.b }, title:`DOC ${doc.num}` } : { type:'image', source:{ type:'base64', media_type:blob.m || 'image/jpeg', data:blob.b } };
  return [{ type:'text', text:`Document DOC ${doc.num} (fichier natif, non pseudonymisé) :` }, b];
}

export function corpusBlock(query, { dossierId = null, exclude = [], k = 6 } = {}, pseudo){
  const hits = docIndex().search(query, { k:k + exclude.length * 2, dossierId }).filter(c => !exclude.includes(c.docId)).slice(0, k);
  if (!hits.length) return { text:'', hits:[] };
  const text = '<corpus>\n' + hits.map(c => `[DOC ${c.num} — ${pseudo.apply(c.title)} — partie ${c.part}]\n${pseudo.apply(c.text)}`).join('\n\n') + '\n</corpus>';
  return { text, hits };
}

// Appel générique d'un agent avec pseudonymisation, consommation et journal
export async function runAgent({ agent, system, messages, pseudo, model, maxTokens, web, thinking, onText, onStatus, signal, label = 'Requête' }){
  const st = settings();
  const r = await complete({ settings:st, system, messages, model:model || st.model, maxTokens:maxTokens || st.maxTokens, web, webOfficial:st.opts.webOfficial, officialDomains:OFFICIAL_DOMAINS, thinking,
    onText: t => onText?.(pseudo ? pseudo.restore(t) : t), onStatus, signal });
  r.text = pseudo ? pseudo.restore(r.text) : r.text;
  await logUsage(r.usage, model || st.model);
  await audit(label, `${agent?.name || '-'} · ${model || st.model} · ${r.usage.in}+${r.usage.out} jetons · ${pseudo?.size || 0} pseudonyme(s)${web ? ' · web' : ''}`);
  return r;
}

export async function verifyAnswer(question, answer, pseudo, onText){
  const st = settings();
  return runAgent({ agent:{ name:'Argus' }, system:VERIFIER_PROMPT + '\n\nDate du jour : ' + today(), pseudo, model:st.modelDeep || st.model, maxTokens:4000, label:'Relecture contradictoire',
    messages:[{ role:'user', content:`<question>\n${pseudo.apply(question)}\n</question>\n<reponse_a_verifier>\n${pseudo.apply(answer)}\n</reponse_a_verifier>` }], onText });
}

export { routeAgent, AGENTS };

// ——————————————————————————————————— Sélecteur de documents
export function pickDocs({ title = 'Choisir des documents', multi = true, dossierId = null } = {}){
  return new Promise(res => {
    let chosen = new Set(); const docs = V.all('docs').sort((a,b) => b.created - a.created);
    const body = h(`<div><input type="text" placeholder="Filtrer…" id="pf"><div class="list" id="pl" style="max-height:50vh;overflow:auto;margin-top:8px"></div>
      <div class="row" style="margin-top:12px"><label class="btn sm">${icon('upload')} Importer<input type="file" multiple hidden id="pu" accept=".pdf,.docx,.odt,.txt,.md,.csv,.html,image/*"></label>
      <label class="btn sm">${icon('camera')} Photographier<input type="file" hidden id="pc" accept="image/*" capture="environment"></label></div></div>`);
    const draw = () => {
      const q = $('#pf', body).value.toLowerCase(); const list = docs.filter(d => !q || d.title.toLowerCase().includes(q));
      $('#pl', body).innerHTML = list.length ? list.map(d => `<label class="item chk"><input type="${multi ? 'checkbox' : 'radio'}" name="pd" value="${d.id}" ${chosen.has(d.id) ? 'checked' : ''}><span class="grow">DOC ${d.num} · ${esc(d.title)}<br><span class="tiny dim">${d.kind.toUpperCase()} · ${fmtDate(d.created)}${d.dossierId && d.dossierId === dossierId ? ' · ce dossier' : ''}</span></span></label>`).join('') : '<div class="empty">Aucun document. Importez-en un.</div>';
      $$('input[name=pd]', body).forEach(i => i.onchange = () => { if (!multi) chosen = new Set(); i.checked ? chosen.add(i.value) : chosen.delete(i.value); });
    };
    const up = async e => { const added = await importFiles(Array.from(e.target.files), { dossierId }); added.forEach(d => { docs.unshift(d); if (!multi) chosen = new Set(); chosen.add(d.id); }); draw(); };
    $('#pf', body).oninput = draw; $('#pu', body).onchange = up; $('#pc', body).onchange = up; draw();
    modal({ title, body, actions:[{ label:'Annuler', cls:'ghost', onClick:() => res(null) }, { label:'Valider', cls:'pri', onClick:() => res(Array.from(chosen)) }] });
  });
}

// Navigation : par l'adresse (#/vue) dans l'application installée, en mémoire lorsqu'elle est ouverte dans Claude
export const currentHash = () => ARTIFACT ? S.hash : location.hash;
export function go(hash){
  if (ARTIFACT) { S.hash = hash; window.dispatchEvent(new Event('lexia:route')); return; }
  if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange')); else location.hash = hash;
}
export function setHash(hash){ if (ARTIFACT) S.hash = hash; else history.replaceState(null, '', hash); }
export function setActions(html){ const t = $('#topAct'); if (t) t.innerHTML = html; return t; }

export function sanitizeForCompare(s){ return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
