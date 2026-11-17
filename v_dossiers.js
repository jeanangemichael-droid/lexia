// LEXIA — Dossiers (parties confidentielles, échéances, pièces, conversations) et modèles de dossiers
import { V, S, $, $$, h, icon, toast, modal, esc, settings, agentById, avatar, AGENTS, fmtDate, go, setActions, confirmBox, pickDocs,
  pseudonymizer, buildSystem, docBlocks, runAgent, today, audit, uid } from './core.js';
import { DOSSIER_TEMPLATES } from './knowledge.js';
import { mdToHtml, mdToDocx, toIcs, download, fileSafe } from './office.js';

const STATUS = ['Ouvert','En attente','Audience','Clos'];
const PTYPES = ['PERSONNE','SOCIETE','LIEU','REFERENCE','MONTANT'];

export function viewDossiers(view, id){
  if (id) return detail(view, id);
  setActions(`<button class="btn sm pri" id="nd">${icon('plus')}<span>Nouveau dossier</span></button>`);
  $('#nd').onclick = () => edit(null);
  const all = V.all('dossiers').sort((a,b) => b.updated - a.updated);
  const soon = []; const now = today(); const lim = new Date(Date.now() + 15 * 864e5).toISOString().slice(0,10);
  for (const d of all) for (const e of d.deadlines || []) if (!e.done && e.date && e.date <= lim) soon.push({ ...e, dossier:d });
  soon.sort((a,b) => a.date.localeCompare(b.date));
  view.innerHTML = `${soon.length ? `<div class="banner ${soon.some(e => e.date < now) ? 'red' : ''}"><b>${icon('clock')} Échéances des 15 prochains jours</b>${soon.map(e => `<div class="small" style="margin-top:4px">${e.date < now ? '<span class="tag red">dépassée</span>' : ''} <b>${fmtDate(e.date)}</b> — ${esc(e.title)} · <a href="#/dossiers/${e.dossier.id}">${esc(e.dossier.title)}</a></div>`).join('')}</div>` : ''}
    <div class="row" style="margin-bottom:10px"><input type="text" id="fq" placeholder="Filtrer les dossiers…" style="flex:1"><select id="fs" style="width:auto"><option value="">Tous statuts</option>${STATUS.map(s => `<option>${s}</option>`).join('')}</select></div>
    <div class="grid" id="dg"></div>`;
  const draw = () => {
    const q = $('#fq').value.toLowerCase(), s = $('#fs').value;
    const list = all.filter(d => (!s || d.status === s) && (!q || (d.title + ' ' + (d.client || '') + ' ' + (d.ref || '')).toLowerCase().includes(q)));
    $('#dg').innerHTML = list.length ? list.map(d => { const next = (d.deadlines || []).filter(e => !e.done && e.date >= now).sort((a,b) => a.date.localeCompare(b.date))[0]; const nd = V.all('docs').filter(x => x.dossierId === d.id).length;
      const ck = d.checklist?.length ? Math.round(100 * d.checklist.filter(c => c.done).length / d.checklist.length) : null;
      return `<div class="card click" data-id="${d.id}"><div class="row"><span class="tag ${d.status === 'Clos' ? '' : 'gold'}">${esc(d.status || 'Ouvert')}</span><span class="tiny dim">${esc(d.ref || '')}</span></div>
        <h3 style="margin-top:8px">${esc(d.title)}</h3><p>${esc(d.client || 'Client non renseigné')}${d.adverse ? ' c/ ' + esc(d.adverse) : ''}</p>
        <p class="tiny dim" style="margin-top:6px">${esc(d.matiere || '')} · ${nd} pièce(s)${ck !== null ? ` · avancement ${ck} %` : ''}${next ? ` · prochaine échéance ${fmtDate(next.date)}` : ''}</p></div>`; }).join('')
      : `<div class="empty">${icon('folder')}<p>Aucun dossier. Créez-en un ou partez d'un modèle de dossier.</p></div>`;
    $$('#dg [data-id]').forEach(c => c.onclick = () => go('#/dossiers/' + c.dataset.id));
  };
  $('#fq').oninput = draw; $('#fs').onchange = draw; draw();
}

export function edit(d, preset = {}){
  const x = d || { status:'Ouvert', parties:[], deadlines:[], ...preset };
  modal({ title: d ? 'Modifier le dossier' : 'Nouveau dossier', body:`
    <label class="f">Intitulé du dossier *</label><input type="text" id="t" value="${esc(x.title || '')}">
    <div class="grid" style="grid-template-columns:1fr 1fr;gap:10px">
      <div><label class="f">Référence interne</label><input type="text" id="r" value="${esc(x.ref || '')}"></div>
      <div><label class="f">Statut</label><select id="s">${STATUS.map(s => `<option ${s === x.status ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      <div><label class="f">Client</label><input type="text" id="c" value="${esc(x.client || '')}"></div>
      <div><label class="f">Partie adverse</label><input type="text" id="a" value="${esc(x.adverse || '')}"></div>
      <div><label class="f">Matière</label><input type="text" id="m" value="${esc(x.matiere || '')}"></div>
      <div><label class="f">Juridiction / administration</label><input type="text" id="j" value="${esc(x.juridiction || '')}"></div>
      <div><label class="f">Enjeu (montant, objectif)</label><input type="text" id="e" value="${esc(x.enjeu || '')}"></div>
      <div><label class="f">Agent principal</label><select id="g">${AGENTS.map(a => `<option value="${a.id}" ${a.id === x.agent ? 'selected' : ''}>${esc(a.name)} — ${esc(a.title)}</option>`).join('')}</select></div>
    </div>
    <label class="chk" style="margin-top:10px"><input type="checkbox" id="pp" ${d ? '' : 'checked'}><span class="small">Ajouter automatiquement le client et la partie adverse aux termes pseudonymisés</span></label>`,
    actions:[{ label:'Annuler', cls:'ghost' }, { label:'Enregistrer', cls:'pri', onClick: async el => {
      const v = k => $('#' + k, el).value.trim(); if (!v('t')) { toast('Intitulé requis', 'err'); return false; }
      Object.assign(x, { title:v('t'), ref:v('r'), status:v('s'), client:v('c'), adverse:v('a'), matiere:v('m'), juridiction:v('j'), enjeu:v('e'), agent:v('g') });
      if ($('#pp', el).checked) for (const [val, type] of [[x.client, 'PERSONNE'], [x.adverse, 'PERSONNE']]) if (val && !x.parties.some(p => p.value.toLowerCase() === val.toLowerCase())) x.parties.push({ value:val, type:/\b(sarl|sa|sas|sci|ste|société|societe|gie|ltd|group|banque)\b/i.test(val) ? 'SOCIETE' : type });
      if (!x.created) x.created = Date.now();
      await V.put('dossiers', x); await audit(d ? 'Modification dossier' : 'Création dossier', x.ref || ''); go('#/dossiers/' + x.id);
    } }] });
}

function detail(view, id){
  const d = V.get('dossiers', id); if (!d) return go('#/dossiers');
  $('#title').textContent = d.title;
  setActions(`<button class="btn sm ghost" id="back">← Dossiers</button><button class="btn sm pri" id="as">${icon('chat')}<span>Assistant</span></button>`);
  $('#back').onclick = () => go('#/dossiers'); $('#as').onclick = () => go('#/chat/d-' + d.id);
  const tab = S.dtab || 'synth';
  const docs = V.all('docs').filter(x => x.dossierId === d.id).sort((a,b) => a.num - b.num);
  const convos = V.all('convos').filter(c => c.dossierId === d.id).sort((a,b) => b.updated - a.updated);
  const tabs = [['synth','Synthèse'],['dead','Échéances'],['parties','Parties confidentielles'],['docs',`Pièces (${docs.length})`],['convos',`Conversations (${convos.length})`],['notes','Notes']];
  view.innerHTML = `<div class="tabs">${tabs.map(([k, l]) => `<button data-t="${k}" class="${k === tab ? 'on' : ''}">${l}</button>`).join('')}</div><div id="tb"></div>`;
  $$('[data-t]', view).forEach(b => b.onclick = () => { S.dtab = b.dataset.t; detail(view, id); });
  const tb = $('#tb'); const save = async () => { await V.put('dossiers', d); };
  const ag = agentById(d.agent || 'auto');

  if (tab === 'synth') {
    const ck = d.checklist || [];
    tb.innerHTML = `<div class="grid"><div class="card"><div class="row">${avatar(ag)}<b>${esc(ag.name)}</b><span class="small mut">${esc(ag.title)}</span><span class="grow"></span><button class="btn sm" id="ed">${icon('edit')}Modifier</button></div>
      <table class="small" style="margin-top:10px;width:100%">${[['Référence', d.ref],['Statut', d.status],['Client', d.client],['Partie adverse', d.adverse],['Matière', d.matiere],['Juridiction', d.juridiction],['Enjeu', d.enjeu],['Ouvert le', fmtDate(d.created)]].map(([k, v]) => `<tr><td class="mut" style="padding:3px 8px 3px 0">${k}</td><td>${esc(v || '—')}</td></tr>`).join('')}</table></div>
      ${ck.length ? `<div class="card"><h3>Étapes (${ck.filter(c => c.done).length}/${ck.length})</h3>${ck.map((c, i) => `<label class="chk"><input type="checkbox" data-ck="${i}" ${c.done ? 'checked' : ''}><span class="small">${esc(c.label)}</span></label>`).join('')}
        ${d.pieces?.length ? `<h3 style="margin-top:12px">Pièces à réunir</h3><ul class="small">${d.pieces.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}</div>` : ''}</div>
      <div class="row" style="margin-top:14px"><button class="btn" id="sy">${icon('bolt')}Synthèse IA du dossier</button><button class="btn" id="rk">${icon('shield')}Analyse des risques</button><button class="btn danger" id="dl">${icon('trash')}Supprimer</button></div>
      <div id="sr" class="result">${d.synthesis ? `<div class="card"><div class="row"><b class="grow">Dernière synthèse — ${fmtDate(d.synthesisAt, true)}</b><button class="btn sm" id="sw">${icon('word')}Word</button></div><div class="md">${mdToHtml(d.synthesis)}</div></div>` : ''}</div>`;
    $('#ed').onclick = () => edit(d);
    $$('[data-ck]', tb).forEach(c => c.onchange = async () => { d.checklist[+c.dataset.ck].done = c.checked; await save(); });
    $('#dl').onclick = async () => { if (!await confirmBox('Supprimer le dossier', 'Le dossier sera supprimé ; ses pièces et conversations sont conservées sans rattachement.', 'Supprimer', true)) return; for (const x of docs) { x.dossierId = null; await V.put('docs', x); } await V.del('dossiers', d.id); go('#/dossiers'); };
    $('#sw') && ($('#sw').onclick = () => { const c = settings().cabinet; download(mdToDocx(d.synthesis, { title:'Synthèse — ' + d.title, cabinet:c.name, font:c.font }), fileSafe('synthese ' + d.title) + '.docx'); });
    const ai = async (kind) => {
      if (!docs.length && !d.notes) return toast('Ajoutez des pièces ou des notes au dossier.', 'err');
      const st = settings(); const pseudo = pseudonymizer(st.pseudo); const content = [];
      for (const x of docs.slice(0, 15)) content.push(...await docBlocks(x, pseudo));
      content.push({ type:'text', text: kind === 'synth' ? 'Établis la synthèse complète du dossier : faits (chronologie datée), parties et qualités, prétentions, fondements juridiques avec articles, état de la procédure, pièces manquantes, prochaines étapes datées. Cite chaque pièce [DOC n].'
        : 'Établis la matrice des risques du dossier : tableau | Risque | Probabilité | Impact | Fondement | Parade |, puis les trois actions prioritaires de la semaine et les arguments adverses prévisibles avec leur réfutation. Cite les pièces [DOC n].' });
      const sr = $('#sr'); sr.innerHTML = `<div class="card"><div class="status">Analyse de ${docs.length} pièce(s)…</div><div class="md typing" id="so"></div></div>`; S.busy = true;
      try {
        const r = await runAgent({ agent:ag, pseudo, system:buildSystem(ag, { dossier:d, pseudo }), model:st.modelDeep || st.model, maxTokens:Math.max(st.maxTokens, 10000), messages:[{ role:'user', content }], label:'Synthèse dossier',
          onText:t => { $('#so').innerHTML = mdToHtml(t); $('.status', sr).textContent = ''; } });
        if (kind === 'synth') { d.synthesis = r.text; d.synthesisAt = Date.now(); } else { d.notes = (d.notes || '') + `\n\n## Analyse des risques — ${fmtDate(Date.now())}\n\n` + r.text; }
        await save(); detail(view, id);
      } catch (e) { $('#so').innerHTML = `<div class="banner red">${esc(e.message)}</div>`; }
      S.busy = false;
    };
    $('#sy').onclick = () => ai('synth'); $('#rk').onclick = () => ai('risk');
  }

  if (tab === 'dead') {
    const list = (d.deadlines || []).sort((a,b) => (a.date || '').localeCompare(b.date || ''));
    tb.innerHTML = `<div class="row" style="margin-bottom:10px"><button class="btn sm pri" id="ad">${icon('plus')}Ajouter une échéance</button><button class="btn sm" id="ics">${icon('calendar')}Exporter vers l'agenda (.ics)</button><a class="btn sm" href="#/auto/deadlines">${icon('clock')}Calculer depuis les pièces (IA)</a></div>
      <div class="card list" style="padding:0">${list.length ? list.map(e => `<div class="item"><input type="checkbox" data-dn="${e.id}" ${e.done ? 'checked' : ''}><div class="grow"><b>${fmtDate(e.date)}</b> — ${esc(e.title)}<div class="tiny dim">${esc(e.basis || '')}</div></div>${!e.done && e.date < today() ? '<span class="tag red">dépassée</span>' : ''}<button class="ibtn" data-dx="${e.id}">${icon('trash')}</button></div>`).join('') : '<div class="empty">Aucune échéance.</div>'}</div>`;
    $('#ad').onclick = () => modal({ title:'Nouvelle échéance', body:`<label class="f">Date</label><input type="date" id="dd"><label class="f">Intitulé</label><input type="text" id="dt"><label class="f">Fondement / remarque</label><input type="text" id="db">`,
      actions:[{ label:'Annuler', cls:'ghost' }, { label:'Ajouter', cls:'pri', onClick: async el => { const date = $('#dd', el).value, title = $('#dt', el).value.trim(); if (!date || !title) { toast('Date et intitulé requis', 'err'); return false; } (d.deadlines ||= []).push({ id:uid(), date, title, basis:$('#db', el).value.trim(), done:false }); await save(); detail(view, id); } }] });
    $('#ics').onclick = () => { const ev = list.filter(e => !e.done).map(e => ({ date:e.date, title:`${e.title} — ${d.title}`, desc:e.basis || '' })); if (!ev.length) return toast('Aucune échéance à exporter'); download(toIcs(ev, d.title), fileSafe('echeances ' + d.title) + '.ics'); };
    $$('[data-dn]', tb).forEach(c => c.onchange = async () => { d.deadlines.find(e => e.id === c.dataset.dn).done = c.checked; await save(); });
    $$('[data-dx]', tb).forEach(b => b.onclick = async () => { d.deadlines = d.deadlines.filter(e => e.id !== b.dataset.dx); await save(); detail(view, id); });
  }

  if (tab === 'parties') {
    const ps = d.parties || [];
    tb.innerHTML = `<div class="banner">Ces termes sont remplacés par des jetons (ex. [PERSONNE_1]) avant tout envoi à l'IA, puis restaurés à l'affichage. Ajoutez noms, raisons sociales, adresses, numéros de titres fonciers, références de comptes…</div>
      <div class="card list" style="padding:0">${ps.map((p, i) => `<div class="item"><span class="tag gold">${esc(p.type)}</span><span class="grow">${esc(p.value)}</span><button class="ibtn" data-px="${i}">${icon('trash')}</button></div>`).join('') || '<div class="empty">Aucun terme.</div>'}</div>
      <div class="row" style="margin-top:10px"><input type="text" id="pv" placeholder="Nom, raison sociale, adresse…" style="flex:1"><select id="pt" style="width:auto">${PTYPES.map(t => `<option>${t}</option>`).join('')}</select><button class="btn pri" id="pa">${icon('plus')}Ajouter</button></div>
      <h3 style="margin-top:18px">Test de pseudonymisation</h3><textarea id="ptx" placeholder="Collez un texte pour voir ce que l'IA recevra…"></textarea><div class="card small" id="pto" style="margin-top:8px;white-space:pre-wrap"></div>`;
    $('#pa').onclick = async () => { const v = $('#pv').value.trim(); if (v.length < 3) return toast('Trois caractères minimum', 'err'); (d.parties ||= []).push({ value:v, type:$('#pt').value }); await save(); detail(view, id); };
    $$('[data-px]', tb).forEach(b => b.onclick = async () => { d.parties.splice(+b.dataset.px, 1); await save(); detail(view, id); });
    $('#ptx').oninput = e => { $('#pto').textContent = pseudonymizer(true).apply(e.target.value); };
  }

  if (tab === 'docs') {
    tb.innerHTML = `<div class="row" style="margin-bottom:10px"><button class="btn sm pri" id="ld">${icon('clip')}Rattacher / importer des pièces</button></div>
      <div class="card list" style="padding:0">${docs.map(x => `<div class="item" data-doc="${x.id}">${icon('doc')}<div class="grow"><b>DOC ${x.num} · ${esc(x.title)}</b><div class="tiny dim">${x.kind.toUpperCase()} · ${fmtDate(x.created)}</div></div></div>`).join('') || '<div class="empty">Aucune pièce.</div>'}</div>`;
    $('#ld').onclick = async () => { const ids = await pickDocs({ title:'Pièces du dossier', dossierId:d.id }); if (!ids) return; for (const i of ids) { const x = V.get('docs', i); x.dossierId = d.id; await V.put('docs', x); } S.idxDirty = true; detail(view, id); };
    $$('[data-doc]', tb).forEach(e => e.onclick = () => go('#/docs/' + e.dataset.doc));
  }

  if (tab === 'convos') {
    tb.innerHTML = `<div class="card list" style="padding:0">${convos.map(c => `<div class="item" data-c="${c.id}">${icon('chat')}<div class="grow"><b>${esc(c.title)}</b><div class="tiny dim">${fmtDate(c.updated, true)} · ${c.messages.length} message(s)</div></div></div>`).join('') || '<div class="empty">Aucune conversation. Ouvrez l\'assistant depuis ce dossier.</div>'}</div>`;
    $$('[data-c]', tb).forEach(e => e.onclick = () => go('#/chat/' + e.dataset.c));
  }

  if (tab === 'notes') {
    tb.innerHTML = `<textarea id="nt" style="min-height:50vh">${esc(d.notes || '')}</textarea><div class="row" style="margin-top:8px"><button class="btn pri" id="ns">${icon('save')}Enregistrer</button><button class="btn" id="nw">${icon('word')}Word</button></div>`;
    $('#ns').onclick = async () => { d.notes = $('#nt').value; await save(); toast('Notes enregistrées (chiffrées)', 'ok'); };
    $('#nw').onclick = () => { const c = settings().cabinet; download(mdToDocx($('#nt').value, { title:'Notes — ' + d.title, cabinet:c.name, font:c.font }), fileSafe('notes ' + d.title) + '.docx'); };
  }
}

// ——————————————————————————————————— Modèles de dossiers
export function viewTemplates(view){
  const custom = V.all('templates');
  setActions(`<button class="btn sm pri" id="nt">${icon('plus')}<span>Nouveau modèle</span></button>`);
  $('#nt').onclick = () => editTpl(null);
  const all = [...DOSSIER_TEMPLATES.map(t => ({ ...t, builtin:true })), ...custom];
  view.innerHTML = `<p class="mut">Modèles de dossiers types : étapes, pièces à réunir et agent spécialisé. Créez un dossier en un geste.</p><div class="grid">${all.map(t => { const a = agentById(t.agent);
    return `<div class="card"><div class="row">${avatar(a)}<span class="small mut">${esc(a.name)}</span><span class="grow"></span>${t.builtin ? '<span class="tag">intégré</span>' : `<button class="ibtn" data-et="${t.id}">${icon('edit')}</button>`}</div>
      <h3 style="margin-top:10px">${esc(t.title)}</h3><p>${esc(t.matiere)}</p><p class="tiny dim" style="margin-top:6px">${t.steps.length} étapes · ${t.pieces.length} pièces</p>
      <button class="btn sm pri" style="margin-top:10px" data-use="${t.id}">${icon('folder')}Créer un dossier</button></div>`; }).join('')}</div>`;
  $$('[data-use]', view).forEach(b => b.onclick = () => { const t = all.find(x => x.id === b.dataset.use);
    edit(null, { matiere:t.matiere, agent:t.agent, checklist:t.steps.map(s => ({ label:s, done:false })), pieces:[...t.pieces], title:t.title + ' — ' }); });
  $$('[data-et]', view).forEach(b => b.onclick = () => editTpl(V.get('templates', b.dataset.et)));
}
function editTpl(t){
  const x = t || { steps:[], pieces:[] };
  modal({ title: t ? 'Modifier le modèle' : 'Nouveau modèle de dossier', body:`<label class="f">Intitulé</label><input type="text" id="tt" value="${esc(x.title || '')}">
    <label class="f">Matière</label><input type="text" id="tm" value="${esc(x.matiere || '')}">
    <label class="f">Agent</label><select id="ta">${AGENTS.map(a => `<option value="${a.id}" ${a.id === x.agent ? 'selected' : ''}>${esc(a.name)} — ${esc(a.title)}</option>`).join('')}</select>
    <label class="f">Étapes (une par ligne)</label><textarea id="ts">${esc(x.steps.join('\n'))}</textarea>
    <label class="f">Pièces à réunir (une par ligne)</label><textarea id="tp">${esc(x.pieces.join('\n'))}</textarea>`,
    actions:[...(t ? [{ label:'Supprimer', cls:'danger', onClick: async () => { await V.del('templates', t.id); go('#/templates'); } }] : []), { label:'Annuler', cls:'ghost' }, { label:'Enregistrer', cls:'pri', onClick: async el => {
      const lines = k => $('#' + k, el).value.split('\n').map(s => s.trim()).filter(Boolean);
      Object.assign(x, { title:$('#tt', el).value.trim() || 'Modèle', matiere:$('#tm', el).value.trim(), agent:$('#ta', el).value, steps:lines('ts'), pieces:lines('tp') });
      await V.put('templates', x); go('#/templates'); } }] });
}
