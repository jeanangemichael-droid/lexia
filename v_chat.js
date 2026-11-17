// LEXIA — Assistant IA : agents spécialisés, conseil d'experts, corpus, relecture contradictoire
import { V, S, $, $$, h, icon, toast, modal, esc, settings, saveSettings, agentById, avatar, AGENTS, routeAgent, pseudonymizer, buildSystem,
  docBlocks, corpusBlock, runAgent, verifyAnswer, pickDocs, docByNum, fmtDate, go, setActions, importFiles, setHash, engineReady, engineHint, ARTIFACT } from './core.js';
import { mdToHtml, mdToDocx, download, fileSafe } from './office.js';

const C = { convo:null, agents:['auto'], council:false, dossierId:null, attach:[], abort:null };
const SUGG = [
  ['olivia','Mon client, locataire d\'un local commercial à Cocody depuis 4 ans, reçoit un congé sans motif. Quels sont ses droits au renouvellement et à indemnité d\'éviction ?'],
  ['jessica','Calcule l\'indemnité de licenciement d\'un cadre ayant 7 ans d\'ancienneté et un salaire moyen mensuel de 1 200 000 FCFA, licencié pour motif économique.'],
  ['erika','Quelles sont les étapes, formalités et coûts pour transformer une SARL en SAS ?'],
  ['louis','Mon débiteur n\'a pas formé opposition à l\'injonction de payer signifiée il y a 20 jours. Comment obtenir la formule exécutoire et saisir ses comptes ?'],
  ['harvey','Quel est le traitement fiscal d\'une cession de parts sociales d\'une SARL ivoirienne (droits d\'enregistrement et plus-value) ?'],
  ['olivia','Comment sécuriser l\'acquisition d\'un terrain urbain qui ne dispose que d\'une lettre d\'attribution ?'],
];

export function viewChat(view, param){
  const st = settings();
  if (param && param.startsWith('d-')) { C.convo = null; C.dossierId = param.slice(2); C.attach = []; }
  else if (param === 'new') { C.convo = null; C.attach = []; }
  else if (param) { const c = V.get('convos', param); if (c) { C.convo = c; C.dossierId = c.dossierId || null; C.agents = c.agents || [c.agentId || 'auto']; C.council = !!c.council; } }
  view.className = 'flush';
  const dossiers = V.all('dossiers').filter(d => d.status !== 'Clos').sort((a,b) => b.updated - a.updated);
  const sw = (k, label, ic, title) => `<button class="switch ${st.opts[k] ? 'on' : ''}" data-opt="${k}" title="${esc(title)}">${icon(ic,'icon')}${label}</button>`;
  view.innerHTML = `<div class="chat">
    <div class="agentbar" id="ab"></div>
    <div class="ctxbar">
      <select id="dos"><option value="">Aucun dossier</option>${dossiers.map(d => `<option value="${d.id}" ${d.id === C.dossierId ? 'selected' : ''}>${esc(d.title)}</option>`).join('')}</select>
      <button class="switch ${C.council ? 'on' : ''}" id="council" title="Plusieurs experts répondent puis l'associé coordinateur synthétise">${icon('users')}Conseil d'experts</button>
      ${sw('corpus','Corpus','search','Recherche automatique dans vos documents')}
      ${sw('verify','Relecture','shield','Relecture contradictoire par un second agent (Argus)')}
      ${st.endpoint === 'claude' ? '' : sw('web','Web','globe','Recherche en ligne pendant la réponse') + sw('webOfficial','Sources officielles','check','Limiter la recherche web aux sites officiels')}
      ${sw('deep','Profondeur max','bolt','Utiliser le modèle le plus puissant')}
      ${sw('thinking','Réflexion','brain','Raisonnement étendu avant de répondre')}
      <button class="switch ${st.pseudo ? 'on' : ''}" id="pseudo" title="Pseudonymiser noms, téléphones, e-mails avant envoi">${icon('eye')}Pseudonymisation</button>
    </div>
    <div class="msgs" id="msgs"></div>
    <div class="composer"><div class="box"><div class="chips" id="att"></div>
      <textarea id="q" rows="2"></textarea>
      <div class="bar"><button class="ibtn" id="clip" title="Joindre des documents">${icon('clip')}</button>
      <label class="ibtn" title="Photographier un document">${icon('camera')}<input type="file" accept="image/*" capture="environment" hidden id="cam"></label>
      <button class="ibtn ${ARTIFACT ? 'hidden' : ''}" id="mic" title="Dicter">${icon('mic')}</button><span class="grow tiny dim" id="hint"></span>
      <button class="btn pri sm" id="send">${icon('send')}Envoyer</button></div></div></div>
  </div>`;
  setActions(`<button class="btn sm" id="newc">${icon('plus')}<span>Nouvelle</span></button><button class="ibtn" id="expc" title="Exporter la conversation en Word">${icon('word')}</button>`);
  $('#newc').onclick = () => { C.convo = null; C.attach = []; go('#/chat/new'); };
  $('#expc').onclick = exportConvo;
  drawAgents(); drawAtt(); drawMsgs(); updateHint();
  $('#dos').onchange = e => { C.dossierId = e.target.value || null; if (C.convo) { C.convo.dossierId = C.dossierId; V.put('convos', C.convo); } };
  $('#council').onclick = e => { C.council = !C.council; e.currentTarget.classList.toggle('on', C.council); C.agents = C.council ? AGENTS.filter(a => ['erika','harvey','samantha'].includes(a.id)).map(a => a.id) : ['auto']; drawAgents(); updateHint(); };
  $$('[data-opt]').forEach(b => b.onclick = async () => { const s = settings(); s.opts[b.dataset.opt] = !s.opts[b.dataset.opt]; await saveSettings({ opts:s.opts }); b.classList.toggle('on', s.opts[b.dataset.opt]); });
  $('#pseudo').onclick = async e => { const v = !settings().pseudo; await saveSettings({ pseudo:v }); e.currentTarget.classList.toggle('on', v); toast(v ? 'Pseudonymisation activée' : 'Pseudonymisation désactivée : les noms réels seront transmis'); };
  $('#clip').onclick = async () => { const ids = await pickDocs({ dossierId:C.dossierId }); if (ids) { C.attach = [...new Set([...C.attach, ...ids])]; drawAtt(); } };
  $('#cam').onchange = async e => { const d = await importFiles(Array.from(e.target.files), { dossierId:C.dossierId }); C.attach.push(...d.map(x => x.id)); drawAtt(); };
  const q = $('#q');
  q.addEventListener('input', () => { q.style.height = 'auto'; q.style.height = Math.min(200, q.scrollHeight) + 'px'; });
  q.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(); });
  $('#send').onclick = () => C.abort ? C.abort.abort() : send();
  $('#mic').onclick = dictate;
  $('#msgs').addEventListener('click', e => { const b = e.target.closest('.docref'); if (b) { const d = docByNum(b.dataset.doc); d ? go('#/docs/' + d.id) : toast('Document introuvable'); } });
}

function drawAgents(){
  const ab = $('#ab'); if (!ab) return;
  ab.innerHTML = AGENTS.filter(a => !(C.council && a.id === 'auto')).map(a => `<button class="agent ${C.agents.includes(a.id) ? 'on' : ''}" data-ag="${a.id}" title="${esc(a.title)}">${avatar(a)}<span><b>${esc(a.name)}</b> <span class="dim tiny">${esc(a.title)}</span></span></button>`).join('');
  $$('[data-ag]', ab).forEach(b => b.onclick = () => {
    const id = b.dataset.ag;
    if (C.council) { C.agents.includes(id) ? (C.agents = C.agents.filter(x => x !== id)) : C.agents.length < 5 ? C.agents.push(id) : toast('Cinq experts au maximum'); }
    else C.agents = [id];
    drawAgents(); updateHint();
  });
}
function updateHint(){
  const q = $('#q'); if (!q) return;
  const names = C.agents.map(id => agentById(id).name);
  q.placeholder = C.council ? `Question au conseil (${names.join(', ')})…` : C.agents[0] === 'auto' ? 'Posez votre question : l\'agent spécialisé est choisi automatiquement…' : `Votre question à ${names[0]}, ${agentById(C.agents[0]).title.toLowerCase()}…`;
  $('#hint').textContent = 'Ctrl+Entrée pour envoyer';
}
function drawAtt(){
  const el = $('#att'); if (!el) return;
  el.innerHTML = C.attach.map(id => { const d = V.get('docs', id); return d ? `<span class="chip">${icon('doc')}DOC ${d.num} · ${esc(d.title.slice(0,30))}<button data-rm="${id}">${icon('x')}</button></span>` : ''; }).join('');
  $$('[data-rm]', el).forEach(b => b.onclick = () => { C.attach = C.attach.filter(x => x !== b.dataset.rm); drawAtt(); });
}

function welcome(){
  const st = settings(); const lastRun = Math.max(0, ...V.all('runs').map(r => r.created));
  const warn = !engineReady(st) ? `<div class="banner red">${esc(engineHint())} <a href="#/settings">Ouvrir les paramètres</a></div>` : st.endpoint === 'claude' ? '<div class="banner">Mode abonnement Claude : les agents utilisent votre forfait Claude, sans clé API. À la première question, Claude vous demande d\'autoriser LEXIA.</div>' : '';
  const bench = Date.now() - Math.max(lastRun, V.meta?.created || 0) > 7 * 864e5 ? `<div class="banner">Le test de performance hebdomadaire n'a pas été lancé depuis plus de 7 jours. <a href="#/bench">Lancer le banc d'essai</a></div>` : '';
  return `<div class="welcome">${warn}${bench}<h1>Votre équipe d'agents juridiques</h1>
    <p class="mut">Quinze agents spécialisés en droit OHADA, communautaire et ivoirien travaillent sous vos ordres. Chaque réponse cite les articles utilisés et un niveau de certitude ; c'est vous qui gardez la décision.</p>
    <div class="sugg">${SUGG.map(([a, t]) => `<button data-sg="${esc(t)}" data-sa="${a}">${avatar(agentById(a), 22)} ${esc(t)}</button>`).join('')}</div></div>`;
}

function drawMsgs(){
  const box = $('#msgs'); if (!box) return;
  if (!C.convo || !C.convo.messages.length) {
    box.innerHTML = welcome();
    $$('[data-sg]', box).forEach(b => b.onclick = () => { $('#q').value = b.dataset.sg; if (!C.council) { C.agents = [b.dataset.sa]; drawAgents(); updateHint(); } $('#q').focus(); });
    return;
  }
  box.innerHTML = ''; for (const m of C.convo.messages) box.appendChild(msgEl(m));
  box.scrollTop = box.scrollHeight;
}

function msgEl(m){
  if (m.role === 'user') {
    const att = (m.attach || []).map(id => V.get('docs', id)).filter(Boolean).map(d => `<span class="chip">${icon('doc')}DOC ${d.num}</span>`).join('');
    return h(`<div class="msg user"><div class="bubble">${esc(m.text)}</div>${att ? `<div class="chips" style="margin-top:6px">${att}</div>` : ''}<div class="meta">${fmtDate(m.ts, true)}</div></div>`);
  }
  const a = m.agentId === 'verif' ? { name:'Argus', title:'Relecteur', color:'#adb5bd' } : agentById(m.agentId);
  const el = h(`<div class="msg"><div class="who">${avatar(a)}<b>${esc(a.name)}</b><span>${esc(a.title)}${m.synthesis ? ' — synthèse du conseil' : m.expert ? ' — avis d\'expert' : ''}</span></div>
    <div class="body"><div class="status"></div><div class="md"></div><div class="extra"></div></div>
    <div class="tools"></div><div class="meta"></div></div>`);
  fillMsg(el, m);
  return el;
}
function fillMsg(el, m){
  $('.md', el).innerHTML = m.error ? `<div class="banner red">${esc(m.error)}</div>` : mdToHtml(m.text || '');
  let extra = '';
  if (m.corpus?.length) extra += `<div class="sources"><b class="small">Extraits du corpus consultés :</b> ${m.corpus.map(c => `<button class="docref" data-doc="${c.num}">DOC ${c.num}</button>`).join(' ')}</div>`;
  if (m.sources?.length) extra += `<div class="sources"><b class="small">Sources en ligne :</b>${m.sources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a>`).join('')}</div>`;
  if (m.verification) extra += `<details class="verif" open><summary>Rapport de relecture contradictoire (Argus)</summary><div class="md">${mdToHtml(m.verification)}</div></details>`;
  $('.extra', el).innerHTML = extra;
  if (m.usage) $('.meta', el).textContent = `${fmtDate(m.ts, true)} · ${m.model || ''} · ${m.usage.in + (m.usage.cacheRead||0)} → ${m.usage.out} jetons${m.pseudoCount ? ` · ${m.pseudoCount} pseudonyme(s)` : ''}`;
  const tools = $('.tools', el); tools.innerHTML = '';
  if (m.error || !m.text) return;
  const add = (ic, label, fn) => { const b = h(`<button class="btn sm ghost">${icon(ic)}${label}</button>`); b.onclick = fn; tools.appendChild(b); };
  add('copy', 'Copier', async () => { await navigator.clipboard.writeText(m.text); toast('Copié', 'ok'); });
  add('word', 'Word', () => { const c = settings().cabinet; download(mdToDocx(m.text + (m.verification ? '\n\n## Rapport de relecture contradictoire\n\n' + m.verification : ''), { title:C.convo?.title || 'Note', cabinet:c.name, font:c.font, ref:`${agentById(m.agentId).name} — ${fmtDate(m.ts, true)}` }), fileSafe(C.convo?.title) + '.docx'); });
  add('save', 'Mes documents', async () => { const st = settings(); const num = (st.docNum || 0) + 1; await saveSettings({ docNum:num }); await V.put('docs', { num, title:(C.convo?.title || 'Réponse') + ' — ' + agentById(m.agentId).name, kind:'text', mime:'text/markdown', text:m.text, size:m.text.length, dossierId:C.convo?.dossierId || null, created:Date.now(), tags:['réponse IA'] }); S.idxDirty = true; toast(`Enregistré comme DOC ${num}`, 'ok'); });
  if (!m.verification) add('shield', 'Relire', () => verifyLater(el, m));
  add('brain', 'Corriger', () => correct(m));
}

async function verifyLater(el, m){
  const idx = C.convo.messages.indexOf(m); const q = C.convo.messages.slice(0, idx).reverse().find(x => x.role === 'user');
  const pseudo = pseudonymizer(settings().pseudo); $('.status', el).textContent = 'Relecture contradictoire en cours…'; S.busy = true;
  try { const r = await verifyAnswer(q?.text || '', m.text, pseudo, t => { m.verification = t; fillMsg(el, m); }); m.verification = r.text; await V.put('convos', C.convo); }
  catch (e) { toast(e.message, 'err'); } finally { S.busy = false; $('.status', el).textContent = ''; fillMsg(el, m); }
}

function correct(m){
  const a = agentById(m.agentId);
  modal({ title:'Corriger et faire apprendre l\'agent', body:`<p class="small mut">La règle sera mémorisée (chiffrée) et appliquée en priorité dans toutes les réponses futures du domaine. N'y mettez aucun nom de client.</p>
    <label class="f">Domaine</label><select id="ld">${[...new Set(AGENTS.map(x => x.domain))].map(d => `<option ${d === a.domain ? 'selected' : ''}>${d}</option>`).join('')}</select>
    <label class="f">Règle exacte (formulée de manière générale)</label><textarea id="lr" placeholder="Ex. : Le délai de … court à compter de …"></textarea>
    <label class="f">Source (texte, article, décision, pratique du greffe…)</label><input type="text" id="ls">`,
    actions:[{ label:'Annuler', cls:'ghost' }, { label:'Mémoriser la leçon', cls:'pri', onClick: async el => { const text = $('#lr', el).value.trim(); if (!text) { toast('Saisissez la règle', 'err'); return false; }
      const n = V.all('lessons').filter(l => l.type === 'lecon').length + 1;
      await V.put('lessons', { type:'lecon', ref:'L-' + String(n).padStart(4,'0'), domain:$('#ld', el).value, text, source:$('#ls', el).value.trim(), created:Date.now() }); toast('Leçon mémorisée : elle s\'appliquera aux prochaines réponses', 'ok'); } }] });
}

// ——————————————————————————————————— Envoi
async function send(){
  const q = $('#q'); const text = q.value.trim(); if (!text) return;
  const st = settings();
  if (!engineReady(st)) { toast(engineHint(), 'err'); return; }
  if (C.council && C.agents.length < 2) { toast('Choisissez au moins deux experts pour le conseil.', 'err'); return; }
  if (!C.convo) C.convo = { title:text.slice(0, 70), messages:[], created:Date.now(), dossierId:C.dossierId, agents:[...C.agents], council:C.council };
  const userMsg = { role:'user', text, attach:[...C.attach], ts:Date.now() };
  C.convo.messages.push(userMsg); C.attach = []; drawAtt(); q.value = ''; q.style.height = '';
  await V.put('convos', C.convo); setHash('#/chat/' + C.convo.id);
  drawMsgs();

  const pseudo = pseudonymizer(st.pseudo);
  const dossier = C.dossierId ? V.get('dossiers', C.dossierId) : null;
  let corpus = { text:'', hits:[] };
  if (st.opts.corpus && V.all('docs').length) corpus = corpusBlock(text, { dossierId:C.dossierId, exclude:userMsg.attach }, pseudo);
  const messages = await buildMessages(pseudo, corpus.text);
  const model = st.opts.deep ? st.modelDeep : st.model;
  C.abort = new AbortController(); S.busy = true; $('#send').innerHTML = `${icon('stop')}Arrêter`;
  try {
    if (C.council) {
      const opinions = [];
      for (const id of C.agents) {
        const ag = agentById(id); const m = await stream(ag, buildSystem(ag, { dossier, pseudo }), messages, pseudo, { model, expert:true, corpus:corpus.hits });
        if (m.text) opinions.push(`### Avis de ${ag.name} (${ag.title})\n${pseudo.apply(m.text)}`);
      }
      const coord = agentById('auto');
      const synthMsgs = [...messages.slice(0, -1), { role:'user', content:[...messages.at(-1).content, { type:'text', text:`\n\nVoici les avis des experts consultés :\n\n${opinions.join('\n\n')}\n\nEn qualité d'associé coordinateur, rends la position consolidée du cabinet : points de convergence, divergences tranchées (avec motif), réponse finale structurée, plan d'action priorisé. Conserve les références et niveaux de certitude ; signale toute référence contradictoire entre experts.` }] }];
      await stream(coord, buildSystem(coord, { dossier, pseudo }), synthMsgs, pseudo, { model:st.modelDeep || model, synthesis:true, final:true, corpus:corpus.hits });
    } else {
      let ag = agentById(C.agents[0]); if (ag.id === 'auto') { const r = routeAgent(text); if (r.id !== 'auto') { ag = r; toast(`Agent sélectionné : ${r.name}, ${r.title}`); } }
      await stream(ag, buildSystem(ag, { dossier, pseudo }), messages, pseudo, { model, final:true, corpus:corpus.hits });
    }
  } finally {
    C.abort = null; S.busy = false; const b = $('#send'); if (b) b.innerHTML = `${icon('send')}Envoyer`;
    C.convo.updated = Date.now(); await V.put('convos', C.convo);
  }
}

async function buildMessages(pseudo, corpusText){
  const msgs = []; const list = C.convo.messages.slice(-24);
  for (let i = 0; i < list.length; i++) {
    const m = list[i];
    if (m.role === 'user') {
      const content = [];
      for (const id of m.attach || []) { const d = V.get('docs', id); if (d) content.push(...await docBlocks(d, pseudo)); }
      if (i === list.length - 1 && corpusText) content.push({ type:'text', text:corpusText });
      content.push({ type:'text', text:pseudo.apply(m.text) });
      msgs.push({ role:'user', content });
    } else if (m.final && m.text && !m.error) msgs.push({ role:'assistant', content:pseudo.apply(m.text) });
  }
  return msgs;
}

async function stream(agent, system, messages, pseudo, { model, expert = false, synthesis = false, final = false, corpus = [] }){
  const st = settings();
  const m = { role:'assistant', agentId:agent.id, text:'', ts:Date.now(), model, expert, synthesis, final, corpus:corpus.map(c => ({ num:c.num, title:c.title, part:c.part })) };
  C.convo.messages.push(m);
  const box = $('#msgs'); const el = msgEl(m); box?.appendChild(el); const md = $('.md', el); md.classList.add('typing');
  let pending = false; const stick = () => { if (box && box.scrollHeight - box.scrollTop - box.clientHeight < 160) box.scrollTop = box.scrollHeight; };
  const status = $('.status', el); status.textContent = `${agent.name} analyse la question…`;
  try {
    const r = await runAgent({ agent, system, messages, pseudo, model, web:st.opts.web, thinking:st.opts.thinking, signal:C.abort?.signal, label:'Assistant IA',
      onStatus: s => status.textContent = s,
      onText: t => { m.text = t; status.textContent = ''; if (!pending) { pending = true; requestAnimationFrame(() => { md.innerHTML = mdToHtml(m.text); pending = false; stick(); }); } } });
    Object.assign(m, { text:r.text, usage:r.usage, sources:r.sources, pseudoCount:pseudo.size });
    if (r.stop === 'max_tokens') m.text += '\n\n> Réponse tronquée (limite de longueur atteinte). Demandez « continue » ou augmentez la limite dans Paramètres.';
  } catch (e) {
    if (e.name === 'AbortError') m.text += '\n\n> Génération interrompue.'; else m.error = e.message;
  }
  md.classList.remove('typing'); status.textContent = ''; fillMsg(el, m);
  if (final && !m.error && m.text && st.opts.verify) {
    status.textContent = 'Relecture contradictoire en cours (Argus)…';
    try { const lastQ = C.convo.messages.filter(x => x.role === 'user').at(-1)?.text || ''; const v = await verifyAnswer(lastQ, m.text, pseudo, t => { m.verification = t; fillMsg(el, m); stick(); }); m.verification = v.text; }
    catch (e) { toast('Relecture : ' + e.message, 'err'); }
    status.textContent = ''; fillMsg(el, m);
  }
  await V.put('convos', C.convo); stick();
  return m;
}

function exportConvo(){
  if (!C.convo?.messages.length) return toast('Conversation vide');
  let md = '';
  for (const m of C.convo.messages) {
    if (m.role === 'user') md += `## Question — ${fmtDate(m.ts, true)}\n\n${m.text}\n\n`;
    else if (m.text) { const a = agentById(m.agentId); md += `## ${a.name}, ${a.title}${m.synthesis ? ' — synthèse' : ''}\n\n${m.text}\n\n${m.verification ? '### Relecture contradictoire\n\n' + m.verification + '\n\n' : ''}`; }
  }
  const c = settings().cabinet; download(mdToDocx(md, { title:C.convo.title, cabinet:c.name, font:c.font, ref:'Conversation LEXIA — ' + fmtDate(Date.now(), true) }), fileSafe(C.convo.title) + '.docx');
}

let rec = null;
function dictate(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return toast('Dictée vocale non disponible sur ce navigateur', 'err');
  if (rec) { rec.stop(); return; }
  rec = new SR(); rec.lang = 'fr-FR'; rec.continuous = true; rec.interimResults = true;
  const q = $('#q'); const base = q.value ? q.value + ' ' : ''; $('#mic').classList.add('on');
  rec.onresult = e => { let t = ''; for (const r of e.results) t += r[0].transcript; q.value = base + t; };
  rec.onend = () => { rec = null; $('#mic')?.classList.remove('on'); };
  rec.onerror = e => toast('Dictée : ' + e.error, 'err');
  rec.start(); toast('Dictée en cours… touchez à nouveau le micro pour arrêter');
}
