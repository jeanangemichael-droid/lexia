// LEXIA — Base documentaire chiffrée : import, recherche en langage naturel, édition assistée par IA
import { V, S, $, $$, h, icon, toast, modal, esc, settings, importFiles, transcribe, docIndex, fmtDate, fmtSize, go, setActions,
  confirmBox, pseudonymizer, buildSystem, runAgent, agentById, audit } from './core.js';
import { snippet } from './search.js';
import { mdToHtml, mdToDocx, download, fileSafe } from './office.js';

export function viewDocs(view, id){
  if (id) return detail(view, id);
  const dossiers = V.all('dossiers');
  setActions(`<label class="btn sm pri">${icon('upload')}<span>Importer</span><input type="file" multiple hidden id="imp" accept=".pdf,.docx,.odt,.txt,.md,.csv,.html,image/*"></label><label class="btn sm">${icon('camera')}<input type="file" hidden id="cam" accept="image/*" capture="environment"></label>`);
  view.innerHTML = `<div class="row"><input type="text" id="sq" class="grow" placeholder="Recherche en langage naturel : « clause de résiliation pour retard de paiement »…" style="flex:1;min-width:200px">
    <select id="sf" style="width:auto"><option value="">Tous les dossiers</option>${dossiers.map(d => `<option value="${d.id}">${esc(d.title)}</option>`).join('')}</select>
    <button class="btn" id="ask" title="Réponse rédigée par l'IA à partir des extraits trouvés">${icon('chat')}Interroger le corpus</button></div>
    <p class="tiny dim">Stockage chiffré AES-256 sur l'appareil. Les PDF et photos sont transcrits par l'IA pour la recherche plein texte et la pseudonymisation.</p>
    <div id="sr"></div><div class="list card" style="padding:0" id="dl"></div>`;
  const reload = () => go('#/docs');
  $('#imp').onchange = async e => { await importFiles(Array.from(e.target.files), { onDone:reload }); reload(); };
  $('#cam').onchange = async e => { await importFiles(Array.from(e.target.files), { onDone:reload }); reload(); };
  const draw = () => {
    const f = $('#sf').value; const docs = V.all('docs').filter(d => !f || d.dossierId === f).sort((a,b) => b.created - a.created);
    $('#dl').innerHTML = docs.length ? docs.map(d => { const dos = d.dossierId ? V.get('dossiers', d.dossierId) : null;
      return `<div class="item" data-id="${d.id}"><div class="ic" style="margin:0;width:38px;height:38px">${icon(d.kind === 'image' ? 'camera' : 'doc')}</div><div class="grow"><b>DOC ${d.num} · ${esc(d.title)}</b><div class="tiny dim">${d.kind.toUpperCase()} · ${fmtSize(d.size || 0)} · ${fmtDate(d.created)}${dos ? ' · ' + esc(dos.title) : ''} ${d.kind !== 'text' ? (d.indexed ? '<span class="tag green">indexé</span>' : '<span class="tag">non indexé</span>') : ''}</div></div></div>`; }).join('')
      : `<div class="empty">${icon('docs')}<p>Aucun document. Importez des PDF, Word, textes ou photographiez un acte.</p></div>`;
    $$('#dl [data-id]').forEach(e => e.onclick = () => go('#/docs/' + e.dataset.id));
  };
  const search = () => {
    const q = $('#sq').value.trim(); const box = $('#sr'); if (!q) { box.innerHTML = ''; return; }
    const hits = docIndex().search(q, { k:10, dossierId:$('#sf').value || null });
    box.innerHTML = `<div class="card" style="margin-bottom:12px"><b class="small">${hits.length} passage(s) pertinent(s)</b>${hits.map(c => `<div class="item" data-id="${c.docId}" style="padding:8px 0;border-bottom:1px solid var(--line);cursor:pointer"><b class="small">DOC ${c.num} · ${esc(c.title)} — partie ${c.part}</b><div class="small mut">${esc(snippet(c.text, q))}</div></div>`).join('') || '<p class="mut small">Aucun passage. Essayez d\'autres termes ou indexez vos PDF.</p>'}</div>`;
    $$('[data-id]', box).forEach(e => e.onclick = () => go('#/docs/' + e.dataset.id));
  };
  let t; $('#sq').oninput = () => { clearTimeout(t); t = setTimeout(search, 250); };
  $('#sf').onchange = () => { draw(); search(); };
  $('#ask').onclick = () => askCorpus($('#sq').value.trim(), $('#sf').value || null);
  draw();
}

async function askCorpus(q, dossierId){
  if (!q) return toast('Saisissez une question dans la barre de recherche.', 'err');
  const st = settings(); const pseudo = pseudonymizer(st.pseudo);
  const hits = docIndex().search(q, { k:8, dossierId }); if (!hits.length) return toast('Aucun extrait pertinent dans le corpus.', 'err');
  const box = $('#sr'); box.innerHTML = `<div class="card" style="margin-bottom:12px"><div class="status">Analyse du corpus…</div><div class="md typing" id="ca"></div></div>`;
  const ag = agentById('auto'); S.busy = true;
  try {
    const corpus = '<corpus>\n' + hits.map(c => `[DOC ${c.num} — ${pseudo.apply(c.title)} — partie ${c.part}]\n${pseudo.apply(c.text)}`).join('\n\n') + '\n</corpus>';
    const r = await runAgent({ agent:ag, pseudo, system:buildSystem(ag, { pseudo, extra:'Réponds UNIQUEMENT à partir des extraits du corpus. Cite chaque extrait utilisé [DOC n]. Si les extraits ne répondent pas, dis-le.' }),
      messages:[{ role:'user', content:corpus + '\n\nQuestion : ' + pseudo.apply(q) }], label:'Recherche corpus', onText:t => $('#ca').innerHTML = mdToHtml(t) });
    $('#ca').innerHTML = mdToHtml(r.text);
  } catch (e) { $('#ca').innerHTML = `<div class="banner red">${esc(e.message)}</div>`; }
  S.busy = false; $('#ca')?.classList.remove('typing'); const s = $('.status', box); if (s) s.textContent = '';
  $$('.docref', box).forEach(b => b.onclick = () => { const d = V.all('docs').find(x => x.num === +b.dataset.doc); if (d) go('#/docs/' + d.id); });
}

function detail(view, id){
  const d = V.get('docs', id); if (!d) return go('#/docs');
  $('#title').textContent = `DOC ${d.num} · ${d.title}`;
  setActions(`<button class="btn sm ghost" id="back">← Documents</button>`); $('#back').onclick = () => go('#/docs');
  const dossiers = V.all('dossiers');
  view.innerHTML = `<div class="docview">
    <div class="row" style="margin-bottom:10px"><input type="text" id="dt" value="${esc(d.title)}" style="flex:1;min-width:200px">
      <select id="dd" style="width:auto"><option value="">Sans dossier</option>${dossiers.map(x => `<option value="${x.id}" ${x.id === d.dossierId ? 'selected' : ''}>${esc(x.title)}</option>`).join('')}</select></div>
    <div class="row" style="margin-bottom:10px">
      <button class="btn sm pri" id="sv">${icon('save')}Enregistrer</button>
      <button class="btn sm" id="ai">${icon('pen')}Retravailler la sélection (IA)</button>
      <button class="btn sm" id="pv">${icon('eye')}Aperçu</button>
      <button class="btn sm" id="wd">${icon('word')}Word</button>
      ${d.hasBlob ? `<button class="btn sm" id="of">${icon('download')}Fichier original</button><button class="btn sm" id="ix">${icon('refresh')}${d.indexed ? 'Ré-indexer' : 'Indexer (IA)'}</button>` : ''}
      <span class="grow"></span><button class="btn sm danger" id="del">${icon('trash')}Supprimer</button></div>
    ${d.hasBlob && !d.text ? '<div class="banner">Ce fichier n\'est pas encore transcrit. Lancez « Indexer (IA) » pour activer la recherche, l\'édition et la pseudonymisation de son contenu.</div>' : ''}
    <textarea id="tx" spellcheck="true">${esc(d.text || '')}</textarea><div id="prev" class="card md hidden"></div>
    <p class="tiny dim">${d.kind.toUpperCase()} · ${fmtSize(d.size || 0)} · importé le ${fmtDate(d.created, true)} · modifié le ${fmtDate(d.updated, true)}</p></div>`;
  $('#sv').onclick = async () => { d.title = $('#dt').value.trim() || d.title; d.dossierId = $('#dd').value || null; d.text = $('#tx').value; await V.put('docs', d); S.idxDirty = true; await audit('Modification document', 'DOC ' + d.num); toast('Enregistré (chiffré)', 'ok'); };
  $('#pv').onclick = () => { const p = $('#prev'), t = $('#tx'); const on = p.classList.toggle('hidden'); t.classList.toggle('hidden', !on); if (!on) p.innerHTML = mdToHtml(t.value); };
  $('#wd').onclick = () => { const c = settings().cabinet; download(mdToDocx($('#tx').value, { title:d.title, cabinet:c.name, font:c.font }), fileSafe(d.title) + '.docx'); };
  $('#of') && ($('#of').onclick = async () => { const b = await V.getBlob(d.id); const bin = Uint8Array.from(atob(b.b), c => c.charCodeAt(0)); download(new Blob([bin], { type:b.m }), d.file || d.title); });
  $('#ix') && ($('#ix').onclick = async () => { $('#ix').disabled = true; S.busy = true; try { await transcribe(d); go('#/docs/' + d.id); } catch (e) { toast(e.message, 'err'); $('#ix').disabled = false; } S.busy = false; });
  $('#del').onclick = async () => { if (!await confirmBox('Supprimer le document', `Supprimer définitivement DOC ${d.num} « ${d.title} » ?`, 'Supprimer', true)) return; await V.del('docs', d.id); if (d.hasBlob) await V.delBlob(d.id); S.idxDirty = true; await audit('Suppression document', 'DOC ' + d.num); go('#/docs'); };
  $('#ai').onclick = () => aiEdit(d);
}

function aiEdit(d){
  const ta = $('#tx'); const s = ta.selectionStart, e = ta.selectionEnd; const sel = ta.value.slice(s, e);
  if (!sel.trim()) return toast('Sélectionnez d\'abord le passage à retravailler.', 'err');
  modal({ title:'Retravailler la sélection', body:`<p class="small mut">${sel.length} caractères sélectionnés.</p><label class="f">Instruction</label>
    <select id="pre"><option value="">— Instructions types —</option><option>Reformule en langage juridique précis et sans ambiguïté</option><option>Rends cette clause plus protectrice pour notre client</option><option>Rédige une version équilibrée entre les parties</option><option>Mets en conformité avec le droit OHADA et ivoirien applicable, en citant les articles en commentaire</option><option>Simplifie pour un client non juriste</option><option>Corrige l'orthographe, la grammaire et la ponctuation</option><option>Traduis en anglais juridique</option></select>
    <textarea id="ins" style="margin-top:8px" placeholder="Ou décrivez la modification souhaitée…"></textarea><div class="md card hidden" id="ao" style="margin-top:10px;max-height:40vh;overflow:auto"></div>`,
    onOpen: el => { $('#pre', el).onchange = ev => $('#ins', el).value = ev.target.value; },
    actions:[{ label:'Annuler', cls:'ghost' }, { label:'Générer et remplacer', cls:'pri', onClick: async el => {
      const ins = $('#ins', el).value.trim(); if (!ins) { toast('Indiquez une instruction', 'err'); return false; }
      const st = settings(); const pseudo = pseudonymizer(st.pseudo); const ag = agentById('auto'); const out = $('#ao', el); out.classList.remove('hidden'); out.textContent = 'Rédaction…';
      try {
        const ctx = ta.value.slice(Math.max(0, s - 1500), s) + '[[SÉLECTION]]' + ta.value.slice(e, e + 1500);
        const r = await runAgent({ agent:ag, pseudo, model:st.model, maxTokens:6000, label:'Édition assistée',
          system:buildSystem(ag, { pseudo, extra:'Tu modifies un extrait de document juridique. Réponds UNIQUEMENT par le texte de remplacement, sans guillemets, sans commentaire ni titre, dans le même format (Markdown léger si présent).' }),
          messages:[{ role:'user', content:`Contexte autour de l'extrait :\n${pseudo.apply(ctx)}\n\nExtrait à modifier :\n${pseudo.apply(sel)}\n\nInstruction : ${pseudo.apply(ins)}` }], onText:t => out.innerHTML = mdToHtml(t) });
        ta.setRangeText(r.text.trim(), s, e, 'select'); toast('Passage remplacé — pensez à enregistrer', 'ok');
      } catch (err) { toast(err.message, 'err'); return false; }
    } }] });
}
