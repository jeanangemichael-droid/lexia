// LEXIA — Automatisation juridique : parcours guidés de rédaction, d'analyse, de révision et de contentieux
import { V, S, $, $$, h, icon, toast, esc, settings, saveSettings, agentById, avatar, AGENTS, pseudonymizer, buildSystem, docBlocks,
  runAgent, verifyAnswer, pickDocs, fmtDate, go, setActions, today, engineReady, engineHint } from './core.js';
import { WORKFLOWS, CONTRACTS, REGULATIONS } from './knowledge.js';
import { mdToHtml, mdToDocx, toCsv, toIcs, download, fileSafe } from './office.js';
import { parseJsonLoose } from './llm.js';

const LONG = ['doc','contract','review','act','note'];

export function viewAuto(view, id){
  if (id) return form(view, WORKFLOWS.find(w => w.id === id));
  const groups = [...new Set(WORKFLOWS.map(w => w.group))];
  view.innerHTML = `<p class="mut">Des parcours guidés pour générer, analyser et réviser vos documents juridiques. Les agents orchestrent les étapes ; vous validez les livrables.</p>` +
    groups.map(g => `<div class="section">${g}</div><div class="grid">${WORKFLOWS.filter(w => w.group === g).map(w => `<div class="card click" data-wf="${w.id}"><div class="ic">${icon(w.icon)}</div><h3>${esc(w.title)}</h3><p>${esc(w.desc)}</p></div>`).join('')}</div>`).join('');
  $$('[data-wf]', view).forEach(c => c.onclick = () => go('#/auto/' + c.dataset.wf));
}

function form(view, wf){
  if (!wf) return go('#/auto');
  $('#title').textContent = wf.title;
  setActions(`<button class="btn sm ghost" id="back">← Parcours</button>`); $('#back').onclick = () => go('#/auto');
  const st = settings(); const dossiers = V.all('dossiers').sort((a,b) => b.updated - a.updated);
  const state = {}; // valeurs des sélecteurs de documents
  const field = ([name, type, label, def]) => {
    if (type === 'textarea') return `<label class="f">${esc(label)}</label><textarea data-f="${name}">${esc(def || '')}</textarea>`;
    if (type === 'text') return `<label class="f">${esc(label)}</label><input type="text" data-f="${name}" value="${esc(def || '')}">`;
    if (type.startsWith('select:')) return `<label class="f">${esc(label)}</label><select data-f="${name}">${type.slice(7).split('|').map(o => `<option>${esc(o)}</option>`).join('')}</select>`;
    if (type === 'contract') return `<label class="f">${esc(label)}</label><select data-f="${name}">${CONTRACTS.map(c => `<option value="${c[0]}">${esc(c[1])} — ${esc(c[2])}</option>`).join('')}</select>`;
    if (type === 'checks') return `<label class="f">${esc(label)}</label><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:2px">${REGULATIONS.map(r => `<label class="chk"><input type="checkbox" data-chk="${name}" value="${esc(r)}"><span class="small">${esc(r)}</span></label>`).join('')}</div>`;
    if (type === 'docpick' || type === 'docmulti') return `<label class="f">${esc(label)}</label><div class="row"><button class="btn sm" data-pick="${name}" data-multi="${type === 'docmulti' ? 1 : ''}">${icon('clip')}Choisir</button><span class="small mut" data-show="${name}">Aucun</span></div>`;
    return '';
  };
  view.innerHTML = `<div class="card" style="max-width:900px">
    <p class="mut small" style="margin-top:0">${esc(wf.desc)}</p>
    ${wf.fields.map(field).join('')}
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px">
      <div><label class="f">Agent responsable</label><select id="ag">${AGENTS.map(a => `<option value="${a.id}">${esc(a.name)} — ${esc(a.title)}</option>`).join('')}</select></div>
      <div><label class="f">Dossier (contexte et pseudonymisation)</label><select id="dos"><option value="">Aucun</option>${dossiers.map(d => `<option value="${d.id}">${esc(d.title)}</option>`).join('')}</select></div>
    </div>
    <div class="row" style="margin-top:12px"><label class="switch ${st.opts.deep ? 'on' : ''}" id="deep">${icon('bolt')}Profondeur max</label><label class="switch ${st.opts.verify ? 'on' : ''}" id="ver">${icon('shield')}Relecture contradictoire</label><label class="switch ${st.opts.web ? 'on' : ''} ${st.endpoint === 'claude' ? 'hidden' : ''}" id="web">${icon('globe')}Web</label>
    <span class="grow"></span><button class="btn pri" id="run">${icon('bolt')}Lancer</button></div></div>
    <div class="result" id="res"></div>`;
  const sw = id => { const e = $('#' + id); e.onclick = () => e.classList.toggle('on'); };
  sw('deep'); sw('ver'); sw('web');
  const ctypeSel = $('[data-f=ctype]'); const setAg = () => { if (ctypeSel) { const c = CONTRACTS.find(x => x[0] === ctypeSel.value); $('#ag').value = c[3]; } };
  if (wf.agent) $('#ag').value = wf.agent;
  if (ctypeSel) { ctypeSel.onchange = setAg; setAg(); }
  $$('[data-pick]', view).forEach(b => b.onclick = async () => {
    const name = b.dataset.pick; const ids = await pickDocs({ multi:!!b.dataset.multi, dossierId:$('#dos').value || null });
    if (!ids) return; state[name] = ids;
    $(`[data-show="${name}"]`).textContent = ids.map(i => { const d = V.get('docs', i); return d ? `DOC ${d.num} · ${d.title}` : ''; }).join(' ; ') || 'Aucun';
  });
  $('#run').onclick = () => run(wf, state);
}

async function run(wf, state){
  const st = settings();
  if (!engineReady(st)) return toast(engineHint(), 'err');
  const v = {}; $$('[data-f]').forEach(e => v[e.dataset.f] = e.value.trim());
  v.regs = $$('[data-chk]:checked').map(c => c.value).join(', ') || 'l\'ensemble des réglementations applicables';
  if (v.ctype) { const c = CONTRACTS.find(x => x[0] === v.ctype); v.ctypeLabel = c[1]; v.ctypeBasis = c[2]; }
  const docIds = []; for (const k of Object.keys(state)) docIds.push(...state[k]);
  const need = wf.fields.filter(f => f[1] === 'docpick' && f[0] !== 'template').map(f => f[0]);
  for (const n of need) if (!state[n]?.length) return toast('Sélectionnez le document requis.', 'err');
  if (wf.id === 'doc' && !state.template?.length && !v.templateText) return toast('Fournissez un modèle (document ou texte collé).', 'err');

  const pseudo = pseudonymizer(st.pseudo);
  const dossier = $('#dos').value ? V.get('dossiers', $('#dos').value) : null;
  const agent = agentById($('#ag').value);
  const content = [];
  const label = { docA:'Document A (référence)', docB:'Document B (à comparer)', template:'Modèle', doc:'Document', sources:'Pièce' };
  for (const k of Object.keys(state)) for (const id of state[k]) { const d = V.get('docs', id); if (d) { content.push({ type:'text', text:`— ${label[k] || 'Document'} : DOC ${d.num}` }); content.push(...await docBlocks(d, pseudo)); } }
  v.templateAll = v.templateText || (state.template?.length ? 'voir le document « Modèle » fourni ci-dessus' : '');
  const prompt = wf.prompt(v);
  content.push({ type:'text', text:pseudo.apply(prompt) });
  const model = $('#deep').classList.contains('on') ? st.modelDeep : st.model;
  const res = $('#res');
  res.innerHTML = `<div class="card"><div class="row"><h2 class="grow" style="margin:0">${esc(wf.title)}</h2>${avatar(agent)}<span class="small mut">${esc(agent.name)}</span></div><div class="status"></div><div class="md typing" id="out"></div><div class="extra"></div><div class="tools row" style="margin-top:12px"></div></div>`;
  const out = $('#out', res), status = $('.status', res); let pending = false;
  $('#run').disabled = true; S.busy = true; status.textContent = 'Analyse en cours…';
  let r;
  try {
    r = await runAgent({ agent, system:buildSystem(agent, { dossier, pseudo }), pseudo, model, maxTokens:LONG.includes(wf.id) ? Math.max(st.maxTokens, 16000) : st.maxTokens,
      web:$('#web').classList.contains('on'), messages:[{ role:'user', content }], label:'Automatisation : ' + wf.title,
      onStatus: s => status.textContent = s,
      onText: t => { if (wf.json) { status.textContent = `Production de l'analyse structurée… ${t.length} caractères`; return; } if (!pending) { pending = true; requestAnimationFrame(() => { out.innerHTML = mdToHtml(t); pending = false; }); } } });
  } catch (e) { out.classList.remove('typing'); out.innerHTML = `<div class="banner red">${esc(e.message)}</div>`; $('#run').disabled = false; S.busy = false; status.textContent = ''; return; }
  out.classList.remove('typing'); status.textContent = ''; $('#run').disabled = false; S.busy = false;
  let md = r.text;
  const tools = $('.tools', res);
  const btn = (ic, l, fn) => { const b = h(`<button class="btn sm">${icon(ic)}${l}</button>`); b.onclick = fn; tools.appendChild(b); return b; };
  const c = settings().cabinet; const title = wf.id === 'contract' ? v.ctypeLabel : wf.title;

  if (wf.id === 'audit') {
    let rows; try { rows = parseJsonLoose(r.text); if (!Array.isArray(rows)) throw 0; } catch { out.innerHTML = mdToHtml(r.text) + '<div class="banner">Le format tabulaire n\'a pas pu être lu ; résultat affiché tel quel.</div>'; rows = null; }
    if (rows) {
      const cnt = k => rows.filter(x => (x.verdict || '').toLowerCase().startsWith(k)).length;
      md = `**Synthèse** : ${rows.length} points examinés — ${cnt('conforme')} conformes, ${cnt('non')} non conformes, ${cnt('à risque')} à risque, ${cnt('à vérifier')} à vérifier.\n\n| Clause | Verdict | Gravité | Référence | Analyse | Recommandation | Certitude |\n|---|---|---|---|---|---|---|\n` +
        rows.map(x => `| ${cl(x.clause)} | ${cl(x.verdict)} | ${cl(x.gravite)} | ${cl(x.reference)} | ${cl(x.analyse)} | ${cl(x.recommandation)} | ${cl(x.certitude)} |`).join('\n');
      out.innerHTML = mdToHtml(md);
      btn('download', 'Tableur (CSV Excel)', () => download(toCsv([['Clause','Extrait','Référence','Verdict','Gravité','Analyse','Recommandation','Certitude'], ...rows.map(x => [x.clause, x.extrait, x.reference, x.verdict, x.gravite, x.analyse, x.recommandation, x.certitude])]), 'audit_conformite_' + today() + '.csv'));
    }
  } else if (wf.id === 'deadlines') {
    let j; try { j = parseJsonLoose(r.text); } catch { out.innerHTML = mdToHtml(r.text); j = null; }
    if (j) {
      const ch = j.chronologie || [], dl = j.delais || [];
      md = `## Chronologie\n\n| Date | Événement | Source |\n|---|---|---|\n${ch.map(x => `| ${cl(x.date)} | ${cl(x.evenement)} | ${cl(x.source)} |`).join('\n')}\n\n## Délais à surveiller\n\n| Délai | Point de départ | Durée | Échéance | Fondement | Certitude | Action |\n|---|---|---|---|---|---|---|\n${dl.map(x => `| ${cl(x.intitule)} | ${cl(x.point_de_depart)} | ${cl(x.duree)} | **${cl(x.echeance || 'à calculer')}** | ${cl(x.fondement)} | ${cl(x.certitude)} | ${cl(x.action)} |`).join('\n')}\n\n## Observations\n\n${j.observations || ''}\n\n> Vérifiez chaque échéance sur le texte applicable avant de vous y fier ; les délais marqués « À vérifier » ne doivent pas être utilisés tels quels.`;
      out.innerHTML = mdToHtml(md);
      const evs = dl.filter(x => x.echeance).map(x => ({ date:x.echeance, title:x.intitule, desc:`${x.action || ''} — ${x.fondement || ''} [${x.certitude || ''}]` }));
      if (evs.length) btn('calendar', 'Ajouter à l\'agenda (.ics)', () => download(toIcs(evs, dossier?.title || 'LEXIA'), 'echeances_' + today() + '.ics'));
      if (dossier && evs.length) btn('folder', 'Reporter dans le dossier', async () => { const d = V.get('dossiers', dossier.id); d.deadlines = [...(d.deadlines || []), ...evs.map(e => ({ id:crypto.randomUUID(), date:e.date, title:e.title, basis:e.desc, done:false }))]; await V.put('dossiers', d); toast('Échéances ajoutées au dossier', 'ok'); });
    }
  }
  if (r.sources?.length) $('.extra', res).innerHTML = `<div class="sources"><b class="small">Sources en ligne :</b>${r.sources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a>`).join('')}</div>`;
  btn('word', 'Word', () => download(mdToDocx(md, { title, cabinet:c.name, font:c.font, ref:`${agent.name} — ${fmtDate(Date.now(), true)}` }), fileSafe(title) + '.docx'));
  if (wf.id === 'review') { const rev = (md.split(/##\s*Journal des modifications/i)[0] || '').replace(/^[\s\S]*?##\s*Version révisée\s*/i, ''); btn('word', 'Version révisée seule', () => download(mdToDocx(rev, { title:'Version révisée', cabinet:c.name, font:c.font }), 'version_revisee_' + today() + '.docx')); }
  btn('copy', 'Copier', async () => { await navigator.clipboard.writeText(md); toast('Copié', 'ok'); });
  btn('save', 'Mes documents', async () => { const s = settings(); const num = (s.docNum || 0) + 1; await saveSettings({ docNum:num }); await V.put('docs', { num, title:title + ' — ' + fmtDate(Date.now()), kind:'text', mime:'text/markdown', text:md, size:md.length, dossierId:dossier?.id || null, created:Date.now(), tags:['automatisation'] }); S.idxDirty = true; toast(`Enregistré comme DOC ${num}`, 'ok'); });
  const verBtn = btn('shield', 'Relecture contradictoire', () => doVerify());
  const doVerify = async () => {
    verBtn.disabled = true; const ex = $('.extra', res); const d = h(`<details class="verif" open><summary>Rapport de relecture contradictoire (Argus)</summary><div class="md typing"></div></details>`); ex.appendChild(d);
    try { const vr = await verifyAnswer(prompt, md, pseudo, t => $('.md', d).innerHTML = mdToHtml(t)); $('.md', d).innerHTML = mdToHtml(vr.text); md += '\n\n## Rapport de relecture contradictoire\n\n' + vr.text; }
    catch (e) { toast(e.message, 'err'); } $('.md', d).classList.remove('typing');
  };
  if ($('#ver').classList.contains('on')) doVerify();
}
const cl = s => String(s ?? '').replace(/\|/g, '/').replace(/\n/g, ' ');
