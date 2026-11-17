// LEXIA — Historique, mémoire d'apprentissage et veille, banc d'essai, paramètres et sécurité
import { V, S, $, $$, h, icon, toast, modal, esc, settings, saveSettings, agentById, avatar, AGENTS, fmtDate, go, setActions, confirmBox,
  pseudonymizer, buildSystem, runAgent, pickDocs, audit, today, sanitizeForCompare } from './core.js';
import { APP_VERSION, REFUSAL_MARKERS, OFFICIAL_DOMAINS } from './knowledge.js';
import { MODELS } from './llm.js';
import { passStrength } from './vault.js';
import { mdToHtml, mdToDocx, download, fileSafe } from './office.js';

// ——————————————————————————————————— Historique
export function viewHistory(view){
  view.innerHTML = `<input type="text" id="hq" placeholder="Rechercher dans les conversations (titre et contenu)…"><div class="card list" style="padding:0;margin-top:12px" id="hl"></div>`;
  const draw = () => {
    const q = sanitizeForCompare($('#hq').value);
    const list = V.all('convos').filter(c => !q || sanitizeForCompare(c.title + ' ' + c.messages.map(m => m.text).join(' ')).includes(q)).sort((a,b) => (b.updated || 0) - (a.updated || 0));
    $('#hl').innerHTML = list.map(c => { const a = agentById(c.messages.find(m => m.role === 'assistant')?.agentId || 'auto'); const d = c.dossierId ? V.get('dossiers', c.dossierId) : null;
      return `<div class="item" data-c="${c.id}">${avatar(a)}<div class="grow"><b>${esc(c.title)}</b><div class="tiny dim">${fmtDate(c.updated || c.created, true)} · ${c.messages.length} message(s)${c.council ? ' · conseil d\'experts' : ''}${d ? ' · ' + esc(d.title) : ''}</div></div><button class="ibtn" data-del="${c.id}">${icon('trash')}</button></div>`; }).join('') || '<div class="empty">Aucune conversation.</div>';
    $$('[data-c]').forEach(e => e.onclick = ev => { if (!ev.target.closest('[data-del]')) go('#/chat/' + e.dataset.c); });
    $$('[data-del]').forEach(b => b.onclick = async () => { if (await confirmBox('Supprimer', 'Supprimer définitivement cette conversation ?', 'Supprimer', true)) { await V.del('convos', b.dataset.del); draw(); } });
  };
  $('#hq').oninput = draw; draw();
}

// ——————————————————————————————————— Mémoire d'apprentissage et veille
const DOMAINS = [...new Set(AGENTS.map(a => a.domain))];
const TYPES = [['lecon','Leçons validées'],['juris','Jurisprudence'],['veille','Veille']];
export function viewMemory(view){
  const tab = S.mtab || 'lecon';
  setActions(`<button class="btn sm pri" id="add">${icon('plus')}<span>Ajouter</span></button>`);
  view.innerHTML = `<p class="mut small">Ce que le cabinet enseigne aux agents. Ces éléments sont injectés dans chaque réponse du domaine concerné et priment sur la connaissance générale du modèle. N'y inscrivez aucune donnée de client.</p>
    <div class="tabs">${TYPES.map(([k, l]) => `<button data-t="${k}" class="${k === tab ? 'on' : ''}">${l} (${V.all('lessons').filter(x => x.type === k).length})</button>`).join('')}</div>
    ${tab === 'veille' ? `<div class="card" style="margin-bottom:12px"><div class="row"><select id="vd" style="width:auto">${DOMAINS.map(d => `<option>${d}</option>`).join('')}</select><button class="btn" id="vrun">${icon('globe')}Lancer une veille IA (sources officielles)</button></div><div id="vo" class="md" style="margin-top:10px"></div></div>` : ''}
    <div class="card list" style="padding:0" id="ml"></div>`;
  $$('[data-t]', view).forEach(b => b.onclick = () => { S.mtab = b.dataset.t; go('#/memory'); });
  const list = V.all('lessons').filter(x => x.type === tab).sort((a,b) => b.created - a.created);
  $('#ml').innerHTML = list.map(l => `<div class="item" data-id="${l.id}"><div class="grow"><div class="row"><span class="tag gold">${esc(l.ref || TYPES.find(t => t[0] === l.type)[1])}</span><span class="tag">${esc(l.domain || 'general')}</span><span class="tiny dim">${fmtDate(l.created)}</span></div><div style="margin-top:6px">${esc(l.text)}</div>${l.source ? `<div class="tiny dim">Source : ${esc(l.source)}</div>` : ''}</div></div>`).join('') || '<div class="empty">Rien pour le moment. Utilisez « Corriger » sous une réponse pour enseigner une règle à vos agents.</div>';
  $$('#ml [data-id]').forEach(e => e.onclick = () => editLesson(V.get('lessons', e.dataset.id)));
  $('#add').onclick = () => editLesson({ type:tab });
  if (tab === 'veille') $('#vrun').onclick = async () => {
    const st = settings(); const dom = $('#vd').value; const ag = AGENTS.find(a => a.domain === dom) || AGENTS[0]; const out = $('#vo');
    out.innerHTML = '<div class="status">Recherche des nouveautés sur les sources officielles…</div>'; S.busy = true;
    const last = V.all('lessons').filter(l => l.type === 'veille' && l.domain === dom).sort((a,b) => b.created - a.created)[0];
    try {
      const r = await runAgent({ agent:ag, system:buildSystem(ag, {}), web:true, model:st.model, maxTokens:6000, label:'Veille juridique',
        messages:[{ role:'user', content:`Veille juridique, domaine « ${dom} » (Côte d'Ivoire, OHADA, UEMOA, CIMA). Recherche les textes nouveaux ou modifiés, décisions marquantes et communiqués officiels publiés ${last ? 'depuis le ' + fmtDate(last.created) : 'au cours des douze derniers mois'}. Pour chaque nouveauté : intitulé exact, date, objet, ce qui change concrètement pour un cabinet, URL de la source. Si tu ne trouves rien de fiable, dis-le. Termine par une liste « À enregistrer » d'une ligne par nouveauté.` }],
        onText:t => out.innerHTML = mdToHtml(t) });
      out.innerHTML = mdToHtml(r.text) + (r.sources?.length ? `<div class="sources">${r.sources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a>`).join('')}</div>` : '');
      const lines = (r.text.split(/À enregistrer/i)[1] || '').split('\n').map(s => s.replace(/^[\s\-*•\d.]+/, '').trim()).filter(s => s.length > 15);
      if (lines.length) { const b = h(`<button class="btn sm pri" style="margin-top:10px">${icon('save')}Enregistrer ${lines.length} élément(s) de veille</button>`); b.onclick = async () => { for (const t of lines) await V.put('lessons', { type:'veille', domain:dom, text:t, source:'Veille IA — à vérifier', created:Date.now() }); toast('Veille enregistrée', 'ok'); go('#/memory'); }; out.appendChild(b); }
    } catch (e) { out.innerHTML = `<div class="banner red">${esc(e.message)}</div>`; }
    S.busy = false;
  };
}
function editLesson(l){
  modal({ title: l.id ? 'Modifier' : 'Ajouter à la mémoire', body:`<label class="f">Type</label><select id="ty">${TYPES.map(([k, n]) => `<option value="${k}" ${k === l.type ? 'selected' : ''}>${n}</option>`).join('')}</select>
    <label class="f">Domaine</label><select id="do"><option value="general">général</option>${DOMAINS.filter(d => d !== 'general').map(d => `<option ${d === l.domain ? 'selected' : ''}>${d}</option>`).join('')}</select>
    <label class="f">Règle, solution ou nouveauté (formulation générale)</label><textarea id="tx">${esc(l.text || '')}</textarea>
    <label class="f">Source (texte, article, décision, URL)</label><input type="text" id="so" value="${esc(l.source || '')}">`,
    actions:[...(l.id ? [{ label:'Supprimer', cls:'danger', onClick: async () => { await V.del('lessons', l.id); go('#/memory'); } }] : []), { label:'Annuler', cls:'ghost' }, { label:'Enregistrer', cls:'pri', onClick: async el => {
      const text = $('#tx', el).value.trim(); if (!text) { toast('Texte requis', 'err'); return false; }
      const type = $('#ty', el).value; if (!l.ref && type === 'lecon') l.ref = 'L-' + String(V.all('lessons').filter(x => x.type === 'lecon').length + 1).padStart(4, '0');
      Object.assign(l, { type, domain:$('#do', el).value, text, source:$('#so', el).value.trim(), created:l.created || Date.now() }); await V.put('lessons', l); go('#/memory'); } }] });
}

// ——————————————————————————————————— Banc d'essai hebdomadaire
export function viewBench(view){
  const tests = V.all('tests').sort((a,b) => (a.created || a.updated) - (b.created || b.updated));
  const runs = V.all('runs').sort((a,b) => a.created - b.created);
  const st = settings();
  setActions(`<button class="btn sm" id="at">${icon('plus')}<span>Test</span></button>`);
  view.innerHTML = `<p class="mut small">Mesurez chaque semaine la précision de vos agents sur des questions dont vous connaissez la réponse. Un test réussit si la réponse contient les éléments attendus ; un test de refus réussit si l'agent reconnaît que le texte ne traite pas la question.</p>
    <div class="kpis"><div class="kpi"><b>${runs.length ? Math.round(runs.at(-1).score) + ' %' : '—'}</b><span class="small mut">Dernier score</span></div><div class="kpi"><b>${tests.length}</b><span class="small mut">Tests</span></div><div class="kpi"><b>${runs.length ? fmtDate(runs.at(-1).created) : '—'}</b><span class="small mut">Dernière exécution</span></div></div>
    ${runs.length > 1 ? `<div class="card" style="margin-top:12px"><b class="small">Évolution du score</b><div class="bars">${runs.slice(-16).map(r => `<i style="height:${Math.max(2, r.score)}%" title="${fmtDate(r.created)} : ${Math.round(r.score)} % (${esc(r.model)})"></i>`).join('')}</div></div>` : ''}
    <div class="row" style="margin:14px 0"><select id="bm" style="width:auto">${MODELS.map(([m, l]) => `<option value="${m}" ${m === st.model ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select><button class="btn pri" id="go">${icon('gauge')}Lancer le banc d'essai</button><span class="small mut" id="bp"></span></div>
    <div id="br"></div><div class="section">Tests</div>
    <div class="card list" style="padding:0">${tests.map(t => `<div class="item" data-t="${t.id}">${avatar(agentById(t.agent || 'auto'), 24)}<div class="grow"><div class="small">${esc(t.q)}</div><div class="tiny dim">${t.refusal ? 'Refus attendu' : 'Attendu : ' + esc((t.expect || []).join(' · '))}</div></div></div>`).join('')}</div>`;
  $('#at').onclick = () => editTest({ expect:[] });
  $$('[data-t]', view).forEach(e => e.onclick = () => editTest(V.get('tests', e.dataset.t)));
  $('#go').onclick = async () => {
    if (!st.apiKey && st.endpoint !== 'proxy') return toast('Clé API requise', 'err');
    const model = $('#bm').value; const results = []; $('#go').disabled = true; S.busy = true;
    for (const [i, t] of tests.entries()) {
      $('#bp').textContent = `Test ${i + 1}/${tests.length}…`; const ag = agentById(t.agent || 'auto'); let ans = '', err = '';
      try { const r = await runAgent({ agent:ag, system:buildSystem(ag, {}), model, maxTokens:1500, label:'Banc d\'essai', messages:[{ role:'user', content:t.q + '\n\nRéponds brièvement (10 lignes maximum) en citant tes références.' }] }); ans = r.text; } catch (e) { err = e.message; }
      const n = sanitizeForCompare(ans);
      const found = (t.expect || []).filter(x => n.includes(sanitizeForCompare(x)));
      const score = err ? 0 : t.refusal ? (REFUSAL_MARKERS.some(m => n.includes(sanitizeForCompare(m))) ? 100 : 0) : (t.expect?.length ? 100 * found.length / t.expect.length : 100);
      const cites = /\b(art(icle)?\.?\s*\d+|loi n|acte uniforme|au[a-z]{2,5}\b)/i.test(ans);
      results.push({ q:t.q, score, cites, missing:(t.expect || []).filter(x => !found.includes(x)), excerpt:(err || ans).slice(0, 600) });
    }
    const avg = results.reduce((s, r) => s + r.score, 0) / (results.length || 1);
    await V.put('runs', { created:Date.now(), model, score:avg, results }); await saveSettings({ lastBench:Date.now() });
    $('#go').disabled = false; S.busy = false; $('#bp').textContent = '';
    toast(`Score : ${Math.round(avg)} %`, avg >= 80 ? 'ok' : 'err'); go('#/bench');
    setTimeout(() => showRun(V.all('runs').sort((a,b) => b.created - a.created)[0]), 50);
  };
  if (runs.length) { const b = h(`<button class="btn sm ghost">${icon('eye')}Voir le détail de la dernière exécution</button>`); b.onclick = () => showRun(runs.at(-1)); $('#br').appendChild(b); }
}
function showRun(run){
  if (!run) return; const br = $('#br'); if (!br) return;
  br.innerHTML = `<div class="card"><b>Exécution du ${fmtDate(run.created, true)} — ${esc(run.model)} — ${Math.round(run.score)} %</b>${run.results.map(r => `<details style="margin-top:8px"><summary class="small"><span class="tag ${r.score >= 100 ? 'green' : r.score > 0 ? 'gold' : 'red'}">${Math.round(r.score)} %</span> ${esc(r.q)} ${r.cites ? '' : '<span class="tag">sans référence</span>'}</summary>${r.missing?.length ? `<p class="tiny" style="color:var(--bad)">Manquant : ${esc(r.missing.join(', '))}</p>` : ''}<div class="md small">${mdToHtml(r.excerpt)}</div></details>`).join('')}</div>`;
}
function editTest(t){
  modal({ title: t.id ? 'Modifier le test' : 'Nouveau test', body:`<label class="f">Question</label><textarea id="q">${esc(t.q || '')}</textarea>
    <label class="f">Éléments attendus dans la réponse (séparés par ;)</label><input type="text" id="e" value="${esc((t.expect || []).join(' ; '))}">
    <label class="chk"><input type="checkbox" id="r" ${t.refusal ? 'checked' : ''}><span class="small">Refus attendu (le texte ne traite pas la question)</span></label>
    <label class="f">Agent</label><select id="a">${AGENTS.map(a => `<option value="${a.id}" ${a.id === t.agent ? 'selected' : ''}>${esc(a.name)} — ${esc(a.title)}</option>`).join('')}</select>`,
    actions:[...(t.id ? [{ label:'Supprimer', cls:'danger', onClick: async () => { await V.del('tests', t.id); go('#/bench'); } }] : []), { label:'Annuler', cls:'ghost' }, { label:'Enregistrer', cls:'pri', onClick: async el => {
      const q = $('#q', el).value.trim(); if (!q) { toast('Question requise', 'err'); return false; }
      Object.assign(t, { q, expect:$('#e', el).value.split(';').map(s => s.trim()).filter(Boolean), refusal:$('#r', el).checked, agent:$('#a', el).value, created:t.created || Date.now() });
      await V.put('tests', t); go('#/bench'); } }] });
}

// ——————————————————————————————————— Paramètres et sécurité
export function viewSettings(view){
  const st = settings(); const tab = S.stab || 'ia';
  const tabs = [['ia','Moteur d\'IA'],['sec','Sécurité'],['cab','Cabinet'],['use','Consommation'],['log','Journal d\'audit'],['app','Application']];
  view.innerHTML = `<div class="tabs">${tabs.map(([k, l]) => `<button data-t="${k}" class="${k === tab ? 'on' : ''}">${l}</button>`).join('')}</div><div id="sb" style="max-width:820px"></div>`;
  $$('[data-t]', view).forEach(b => b.onclick = () => { S.stab = b.dataset.t; go('#/settings'); });
  const sb = $('#sb');
  const modelSel = (id, val) => `<select id="${id}">${MODELS.map(([m, l]) => `<option value="${m}" ${m === val ? 'selected' : ''}>${esc(l)}</option>`).join('')}${MODELS.some(m => m[0] === val) ? '' : `<option selected>${esc(val)}</option>`}</select>`;

  if (tab === 'ia') {
    sb.innerHTML = `<div class="card">
      <label class="f">Mode de connexion</label><select id="ep"><option value="direct" ${st.endpoint === 'direct' ? 'selected' : ''}>Direct — clé API personnelle (chiffrée sur l'appareil)</option><option value="proxy" ${st.endpoint === 'proxy' ? 'selected' : ''}>Serveur dédié du cabinet (la clé reste sur le serveur)</option></select>
      <div id="dir"><label class="f">Clé API Anthropic</label><div class="row"><input type="password" id="key" value="${esc(st.apiKey)}" placeholder="sk-ant-…" style="flex:1"><button class="btn sm" id="sk">${icon('eye')}</button></div>
        <p class="tiny dim">Obtenez une clé sur console.anthropic.com → API Keys. Elle est chiffrée (AES-256) avec le reste du coffre et n'est envoyée qu'à api.anthropic.com.</p></div>
      <div id="prx"><label class="f">Adresse du serveur du cabinet</label><input type="url" id="purl" value="${esc(st.proxyUrl)}" placeholder="https://lexia.moncabinet.ci"><label class="f">Jeton d'accès personnel</label><input type="password" id="ptok" value="${esc(st.proxyToken)}"></div>
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px">
        <div><label class="f">Modèle standard</label>${modelSel('m1', st.model)}</div><div><label class="f">Modèle « profondeur max » et relecture</label>${modelSel('m2', st.modelDeep)}</div>
        <div><label class="f">Modèle rapide (indexation, OCR)</label>${modelSel('m3', st.modelFast)}</div><div><label class="f">Longueur maximale de réponse (jetons)</label><input type="number" id="mt" min="1000" max="64000" step="1000" value="${st.maxTokens}"></div></div>
      <label class="chk" style="margin-top:12px"><input type="checkbox" id="ai" ${st.autoIndex ? 'checked' : ''}><span class="small">Indexer automatiquement (OCR IA) les PDF et photos importés</span></label>
      <label class="chk"><input type="checkbox" id="pt" ${st.pdfAsText ? 'checked' : ''}><span class="small">Envoyer les PDF déjà transcrits sous forme de texte (permet la pseudonymisation, réduit le coût)</span></label>
      <div class="row" style="margin-top:14px"><button class="btn pri" id="sv">${icon('save')}Enregistrer</button><button class="btn" id="tst">${icon('bolt')}Tester la connexion</button><span class="small" id="tr"></span></div></div>`;
    const sync = () => { const p = $('#ep').value === 'proxy'; $('#dir').classList.toggle('hidden', p); $('#prx').classList.toggle('hidden', !p); };
    $('#ep').onchange = sync; sync();
    $('#sk').onclick = () => { const k = $('#key'); k.type = k.type === 'password' ? 'text' : 'password'; };
    const collect = () => ({ endpoint:$('#ep').value, apiKey:$('#key').value.trim(), proxyUrl:$('#purl').value.trim(), proxyToken:$('#ptok').value.trim(), model:$('#m1').value, modelDeep:$('#m2').value, modelFast:$('#m3').value, maxTokens:Math.max(1000, +$('#mt').value || 8000), autoIndex:$('#ai').checked, pdfAsText:$('#pt').checked });
    $('#sv').onclick = async () => { await saveSettings(collect()); await audit('Paramètres IA modifiés'); toast('Paramètres enregistrés (chiffrés)', 'ok'); };
    $('#tst').onclick = async () => { await saveSettings(collect()); $('#tr').textContent = 'Test…';
      try { const r = await runAgent({ agent:{ name:'Test' }, system:'Réponds uniquement : OK', model:settings().modelFast, maxTokens:20, messages:[{ role:'user', content:'Test de connexion' }], label:'Test connexion' }); $('#tr').innerHTML = `<span style="color:var(--ok)">Connexion réussie (${esc(r.text.trim().slice(0,20))})</span>`; }
      catch (e) { $('#tr').innerHTML = `<span style="color:var(--bad)">${esc(e.message)}</span>`; } };
  }

  if (tab === 'sec') {
    sb.innerHTML = `<div class="card"><h3>Chiffrement</h3><p class="small mut">AES-GCM 256 bits ; clé dérivée de votre phrase secrète par PBKDF2-SHA256 (${V.meta.iter.toLocaleString('fr-FR')} itérations). Aucune donnée n'est stockée en clair ni envoyée à un serveur LEXIA (il n'en existe pas).</p>
      <div class="grid" style="grid-template-columns:1fr 1fr;gap:10px"><div><label class="f">Verrouillage automatique après inactivité</label><select id="al">${[[1,'1 minute'],[3,'3 minutes'],[5,'5 minutes'],[15,'15 minutes'],[30,'30 minutes'],[0,'Jamais (déconseillé)']].map(([v, l]) => `<option value="${v}" ${v === st.autolock ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div><label class="f">Effacement après échecs de déverrouillage</label><select id="wa">${[[0,'Désactivé'],[5,'5 échecs'],[10,'10 échecs'],[20,'20 échecs']].map(([v, l]) => `<option value="${v}" ${v === (V.meta.wipeAfter || 0) ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
      <button class="btn sm pri" id="ss" style="margin-top:10px">${icon('save')}Enregistrer</button></div>
      <div class="card" style="margin-top:12px"><h3>Pseudonymisation</h3><label class="chk"><input type="checkbox" id="ps" ${st.pseudo ? 'checked' : ''}><span class="small">Activée par défaut (noms des parties des dossiers, e-mails, téléphones, IBAN, numéros de pièces d'identité)</span></label>
      <label class="f">Termes confidentiels permanents — un par ligne, format « valeur | TYPE » (TYPE : PERSONNE, SOCIETE, LIEU, REFERENCE)</label><textarea id="ct" placeholder="Cabinet CIA | SOCIETE">${esc(st.confTerms)}</textarea>
      <button class="btn sm pri" id="sp" style="margin-top:8px">${icon('save')}Enregistrer</button></div>
      <div class="card" style="margin-top:12px"><h3>Phrase secrète</h3><label class="f">Phrase actuelle</label><input type="password" id="o"><label class="f">Nouvelle phrase</label><input type="password" id="n1"><label class="f">Confirmation</label><input type="password" id="n2"><button class="btn sm" id="cp" style="margin-top:10px">${icon('lock')}Changer</button></div>
      <div class="card" style="margin-top:12px"><h3>Sauvegarde chiffrée</h3><p class="small mut">Le fichier .lexia reste chiffré : il ne peut être relu qu'avec votre phrase secrète. Conservez-le sur un support séparé.</p>
      <div class="row"><button class="btn" id="bk">${icon('download')}Exporter la sauvegarde</button><label class="btn">${icon('upload')}Restaurer<input type="file" id="rs" hidden></label></div></div>
      <div class="card" style="margin-top:12px;border-color:var(--bad)"><h3 style="color:var(--bad)">Effacement d'urgence</h3><p class="small mut">Supprime immédiatement et définitivement toutes les données de cet appareil.</p><button class="btn danger" id="wp">${icon('trash')}Tout effacer</button></div>`;
    $('#ss').onclick = async () => { await saveSettings({ autolock:+$('#al').value }); V.meta.wipeAfter = +$('#wa').value; const db = V.db; await new Promise(r => { const t = db.transaction('meta', 'readwrite'); t.objectStore('meta').put(V.meta); t.oncomplete = r; }); await audit('Paramètres de sécurité modifiés'); toast('Enregistré', 'ok'); };
    $('#sp').onclick = async () => { await saveSettings({ pseudo:$('#ps').checked, confTerms:$('#ct').value }); toast('Enregistré', 'ok'); };
    $('#cp').onclick = async () => { const n1 = $('#n1').value; if (n1.length < 12 || passStrength(n1) < 2) return toast('Nouvelle phrase trop faible (12 caractères minimum)', 'err'); if (n1 !== $('#n2').value) return toast('Confirmation différente', 'err');
      $('#cp').disabled = true; const ok = await V.changePass($('#o').value, n1); $('#cp').disabled = false; if (!ok) return toast('Phrase actuelle incorrecte', 'err'); await audit('Phrase secrète modifiée'); toast('Phrase secrète modifiée', 'ok'); ['o','n1','n2'].forEach(i => $('#' + i).value = ''); };
    $('#bk').onclick = async () => { download(await V.exportBackup(), `lexia_sauvegarde_${today()}.lexia`); await audit('Export sauvegarde'); };
    $('#rs').onchange = async e => { const f = e.target.files[0]; if (!f) return; const p = prompt('Phrase secrète de la sauvegarde'); if (!p) return; try { await V.importBackup(await f.text(), p); toast('Restauré. Déverrouillez à nouveau.', 'ok'); setTimeout(() => location.reload(), 1200); } catch (err) { toast(err.message, 'err'); } };
    $('#wp').onclick = async () => { if (prompt('Tapez EFFACER pour confirmer la suppression définitive') !== 'EFFACER') return; await V.wipe(); location.reload(); };
  }

  if (tab === 'cab') {
    const c = st.cabinet;
    sb.innerHTML = `<div class="card"><label class="f">Nom du cabinet (en-tête et pied de page Word)</label><input type="text" id="cn" value="${esc(c.name)}">
      <label class="f">Adresse</label><input type="text" id="ca" value="${esc(c.address)}">
      <label class="f">Police des documents Word</label><select id="cf">${['Times New Roman','Garamond','Cambria','Calibri','Arial','Book Antiqua','Century Gothic'].map(f => `<option ${f === c.font ? 'selected' : ''}>${f}</option>`).join('')}</select>
      <label class="f">Style rédactionnel du cabinet (injecté dans chaque rédaction)</label><textarea id="cs" style="min-height:160px" placeholder="Ex. : vouvoiement, phrases courtes, « Nous » pour le cabinet, numérotation 1., 1.1., montants en lettres puis en chiffres…">${esc(c.style)}</textarea>
      <div class="row" style="margin-top:10px"><button class="btn pri" id="cv">${icon('save')}Enregistrer</button><button class="btn" id="cl">${icon('brain')}Apprendre le style depuis des actes du cabinet</button></div></div>`;
    $('#cv').onclick = async () => { await saveSettings({ cabinet:{ name:$('#cn').value.trim(), address:$('#ca').value.trim(), font:$('#cf').value, style:$('#cs').value.trim() } }); toast('Enregistré', 'ok'); };
    $('#cl').onclick = async () => {
      const ids = await pickDocs({ title:'Actes représentatifs du style du cabinet' }); if (!ids?.length) return;
      const docs = ids.map(i => V.get('docs', i)).filter(d => d?.text); if (!docs.length) return toast('Choisissez des documents texte ou indexés', 'err');
      const pseudo = pseudonymizer(true); $('#cs').value = 'Analyse du style en cours…'; S.busy = true;
      try { const r = await runAgent({ agent:{ name:'Style' }, pseudo, system:'Tu es un expert en rédaction juridique. Tu extrais un guide de style opérationnel.', model:settings().model, maxTokens:2500, label:'Apprentissage du style',
          messages:[{ role:'user', content:docs.map(d => `<acte>${pseudo.apply(d.text.slice(0, 12000))}</acte>`).join('\n') + '\n\nRédige le guide de style rédactionnel de ce cabinet en 15 règles maximum, directement applicables par un rédacteur (structure, formules d\'ouverture et de clôture, numérotation, ton, terminologie, présentation des montants et dates, mentions récurrentes). Pas de noms propres.' }] });
        $('#cs').value = r.text; toast('Style extrait : vérifiez puis enregistrez', 'ok'); } catch (e) { toast(e.message, 'err'); $('#cs').value = c.style; }
      S.busy = false;
    };
  }

  if (tab === 'use') {
    const u = V.all('usage').sort((a,b) => a.id.localeCompare(b.id)); const last30 = u.slice(-30);
    const sum = k => last30.reduce((s, x) => s + (x[k] || 0), 0); const cost = (sum('in') * st.priceIn + sum('out') * st.priceOut) / 1e6; const max = Math.max(1, ...last30.map(x => x.in + x.out));
    sb.innerHTML = `<div class="kpis"><div class="kpi"><b>${sum('calls')}</b><span class="small mut">Requêtes (30 j)</span></div><div class="kpi"><b>${(sum('in') / 1e3).toFixed(0)} k</b><span class="small mut">Jetons envoyés</span></div><div class="kpi"><b>${(sum('out') / 1e3).toFixed(0)} k</b><span class="small mut">Jetons générés</span></div><div class="kpi"><b>${cost.toFixed(2)} $</b><span class="small mut">Coût estimé</span></div></div>
      <div class="card" style="margin-top:12px"><b class="small">Jetons par jour</b><div class="bars">${last30.map(x => `<i style="height:${100 * (x.in + x.out) / max}%" title="${x.id} : ${x.calls} requêtes"></i>`).join('')}</div></div>
      <div class="card" style="margin-top:12px"><p class="small mut">Tarifs utilisés pour l'estimation (dollars par million de jetons) — vérifiez les tarifs en vigueur de votre modèle sur la console Anthropic.</p>
      <div class="row"><label class="small">Entrée <input type="number" id="pi" value="${st.priceIn}" step="0.1" style="width:100px"></label><label class="small">Sortie <input type="number" id="po" value="${st.priceOut}" step="0.1" style="width:100px"></label><button class="btn sm" id="pv">${icon('save')}Enregistrer</button></div>
      <p class="tiny dim">Le cache des consignes système est activé : les instructions répétées sont facturées à tarif réduit (${(sum('cache') / 1e3).toFixed(0)} k jetons lus en cache).</p></div>`;
    $('#pv').onclick = async () => { await saveSettings({ priceIn:+$('#pi').value, priceOut:+$('#po').value }); go('#/settings'); };
  }

  if (tab === 'log') {
    const a = V.all('audit').sort((x, y) => y.ts - x.ts).slice(0, 300);
    sb.innerHTML = `<p class="small mut">Journal chiffré des opérations (sans contenu des échanges) : traçabilité de chaque envoi à l'IA, du nombre de pseudonymes appliqués et des opérations sensibles.</p>
      <div class="row" style="margin-bottom:8px"><button class="btn sm" id="xl">${icon('word')}Exporter le journal</button></div><div class="card list small" style="padding:0">${a.map(x => `<div class="item" style="cursor:default"><span class="tiny dim" style="min-width:130px">${fmtDate(x.ts, true)}</span><b>${esc(x.action)}</b><span class="mut grow">${esc(x.detail)}</span></div>`).join('') || '<div class="empty">Vide</div>'}</div>`;
    $('#xl').onclick = () => download(mdToDocx('| Date | Action | Détail |\n|---|---|---|\n' + a.map(x => `| ${fmtDate(x.ts, true)} | ${x.action} | ${(x.detail || '').replace(/\|/g, '/')} |`).join('\n'), { title:'Journal d\'audit LEXIA', cabinet:st.cabinet.name }), `journal_audit_${today()}.docx`);
  }

  if (tab === 'app') {
    const standalone = matchMedia('(display-mode: standalone)').matches;
    sb.innerHTML = `<div class="card"><h3>LEXIA ${APP_VERSION}</h3><p class="small mut">Application installable (PWA) : Android, Windows, macOS, Linux, ChromeOS. Fonctionne hors ligne pour la consultation de vos données ; les agents nécessitent une connexion.</p>
      <p class="small">${standalone ? '<span class="tag green">Installée</span>' : '<span class="tag">Non installée</span>'}</p>
      ${!standalone ? `<button class="btn pri" id="inst">${icon('download')}Installer l'application</button><p class="tiny dim">Sinon : menu du navigateur ⋮ → « Installer l'application » ou « Ajouter à l'écran d'accueil ».</p>` : ''}
      <label class="f">Thème</label><select id="th" style="width:auto"><option value="dark" ${st.theme === 'dark' ? 'selected' : ''}>Sombre</option><option value="light" ${st.theme === 'light' ? 'selected' : ''}>Clair</option></select>
      <div class="row" style="margin-top:12px"><button class="btn" id="upd">${icon('refresh')}Rechercher une mise à jour</button></div>
      <h3 style="margin-top:18px">Sources officielles prioritaires (recherche web)</h3><p class="tiny dim">${OFFICIAL_DOMAINS.map(esc).join(' · ')}</p>
      <h3 style="margin-top:18px">Avertissement</h3><p class="small mut">LEXIA est un outil d'aide à la recherche et à la rédaction. Les réponses peuvent contenir des erreurs : vérifiez chaque référence sur la source officielle. La décision et la responsabilité professionnelles restent celles du juriste ou de l'avocat.</p></div>`;
    $('#inst') && ($('#inst').onclick = async () => { if (S.installPrompt) { S.installPrompt.prompt(); } else toast('Utilisez le menu du navigateur : « Installer l\'application » ou « Ajouter à l\'écran d\'accueil ».'); });
    $('#th').onchange = async e => { await saveSettings({ theme:e.target.value }); document.documentElement.dataset.theme = e.target.value; try { localStorage.setItem('lexia-theme', e.target.value); } catch {} };
    $('#upd').onclick = async () => { const r = await navigator.serviceWorker?.getRegistration(); if (r) { await r.update(); toast(r.waiting || r.installing ? 'Mise à jour trouvée' : 'Vous disposez de la dernière version'); } };
  }
}
