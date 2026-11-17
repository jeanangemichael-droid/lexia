// LEXIA — Démarrage, verrouillage, coque de l'application, navigation
import { V, S, $, $$, h, icon, toast, esc, settings, saveSettings, seedIfEmpty, audit, importFiles, ARTIFACT, engineReady, engineHint, currentHash, go, promptBox } from './core.js';
import { passStrength } from './vault.js';
import { APP_VERSION } from './knowledge.js';
import { viewChat } from './v_chat.js';
import { viewAuto } from './v_auto.js';
import { viewDocs } from './v_docs.js';
import { viewDossiers, viewTemplates } from './v_dossiers.js';
import { viewHistory, viewMemory, viewBench, viewSettings } from './v_more.js';

const NAV = [
  ['chat','Assistant IA','chat',viewChat], ['auto','Automatisation juridique','scale',viewAuto], ['docs','Mes documents','docs',viewDocs],
  ['dossiers','Dossiers','folder',viewDossiers], ['templates','Modèles de dossiers','tpl',viewTemplates], ['history','Historique des conversations','history',viewHistory],
  ['memory','Mémoire et veille','brain',viewMemory], ['bench','Banc d\'essai','gauge',viewBench], ['settings','Paramètres et sécurité','gear',viewSettings],
];
const BOTTOM = [['chat','Assistant'],['auto','Automatiser'],['docs','Documents'],['dossiers','Dossiers']];
let lastActive = Date.now(), hiddenAt = 0, bound = false;

// ——————————————————————————————————— Démarrage
async function boot(){
  if (!window.isSecureContext || !crypto?.subtle) { $('#app').innerHTML = `<div id="lock"><div class="box card"><h2>Connexion non sécurisée</h2><p class="mut">LEXIA doit être ouvert en HTTPS (ou sur localhost) pour activer le chiffrement.</p></div></div>`; return; }
  try { localStorage.getItem('lexia-theme') === 'light' && (document.documentElement.dataset.theme = 'light'); } catch {}
  const exists = await V.open();
  exists ? showUnlock() : showSetup();
  if (!ARTIFACT && 'serviceWorker' in navigator) registerSW();
}

function strengthMeter(input, meter){
  input.addEventListener('input', () => { const s = passStrength(input.value); const c = ['#e2554f','#e2554f','#e9a23b','#c9c34a','#6fbf73'][s]; meter.innerHTML = `<i style="width:${(s+1)*20}%;background:${c}"></i>`; });
}

function showSetup(){
  $('#app').innerHTML = `<div id="lock"><div class="box">
    <div class="logo">${icon('scale','icon')}<b>LEXIA</b><span class="mut">Cabinet d'agents juridiques IA — OHADA · UEMOA · CIMA · Côte d'Ivoire</span></div>
    <div class="card"><h2>Créer votre coffre-fort</h2>
      <p class="mut small">Toutes vos données (documents, dossiers, conversations, clé API) seront chiffrées sur cet appareil en AES-256. La phrase secrète n'est stockée nulle part : <b>si vous l'oubliez, les données sont irrécupérables</b>.</p>
      <label class="f">Phrase secrète (12 caractères minimum, idéalement une phrase)</label><input type="password" id="p1" autocomplete="new-password">
      <div class="meter" id="m1"></div>
      <label class="f">Confirmer la phrase secrète</label><input type="password" id="p2" autocomplete="new-password">
      ${ARTIFACT ? `<div class="banner" style="margin-top:12px">LEXIA est ouvert dans Claude : les agents utilisent <b>votre abonnement Claude</b>, sans clé API ni frais supplémentaires. Les données chiffrées sont conservées dans votre espace privé Claude, accessible depuis tous vos appareils.</div>` : `<label class="f">Clé API Anthropic (facultatif maintenant, modifiable plus tard)</label><input type="password" id="k" placeholder="sk-ant-…" autocomplete="off">`}
      <button class="btn pri" id="go" style="width:100%;justify-content:center;margin-top:16px">${icon('lock')} Créer le coffre chiffré</button>
      <p class="tiny dim" style="margin-top:12px">Restauration : <label style="color:var(--gold2);cursor:pointer;text-decoration:underline">importer une sauvegarde .lexia<input type="file" id="rb" hidden accept=".lexia,application/json,application/octet-stream"></label></p>
    </div><p class="tiny dim" style="text-align:center">Version ${APP_VERSION}</p></div></div>`;
  strengthMeter($('#p1'), $('#m1'));
  $('#go').onclick = async () => {
    const p1 = $('#p1').value, p2 = $('#p2').value;
    if (p1.length < 12) return toast('La phrase secrète doit contenir au moins 12 caractères.', 'err');
    if (passStrength(p1) < 2) return toast('Phrase secrète trop faible : allongez-la ou mélangez lettres, chiffres et symboles.', 'err');
    if (p1 !== p2) return toast('Les deux saisies ne correspondent pas.', 'err');
    $('#go').disabled = true; $('#go').innerHTML = '<span class="spin"></span> Dérivation de la clé…';
    await V.setup(p1); await seedIfEmpty();
    const k = $('#k')?.value.trim(); if (k) await saveSettings({ apiKey:k });
    await audit('Création du coffre'); enterApp();
  };
  $('#rb').onchange = e => restoreBackup(e.target.files[0]);
}

function restoreBackup(file){
  if (!file) return;
  const m = h(`<div class="modalBg"><div class="modal"><header><h2>Restaurer une sauvegarde</h2></header><div class="mb"><p class="mut small">Saisissez la phrase secrète utilisée lors de la sauvegarde. Les données actuelles de cet appareil seront remplacées.</p><input type="password" id="rp"></div><footer><button class="btn ghost" id="rc">Annuler</button><button class="btn pri" id="ro">Restaurer</button></footer></div></div>`);
  document.body.appendChild(m); $('#rc', m).onclick = () => m.remove();
  $('#ro', m).onclick = async () => {
    try { $('#ro', m).disabled = true; await V.importBackup(await file.text(), $('#rp', m).value); m.remove(); toast('Sauvegarde restaurée. Déverrouillez avec la phrase secrète de la sauvegarde.', 'ok'); showUnlock(); }
    catch (e) { $('#ro', m).disabled = false; toast(e.message, 'err'); }
  };
}

function showUnlock(){
  const fails = V.meta?.fails || 0;
  $('#app').innerHTML = `<div id="lock"><div class="box">
    <div class="logo">${icon('scale')}<b>LEXIA</b><span class="mut">Coffre-fort verrouillé${V.storage ? ' · stockage : ' + esc(V.storage) : ''}</span></div>
    <div class="card"><label class="f">Phrase secrète</label><input type="password" id="pp" autocomplete="current-password">
    <button class="btn pri" id="ok" style="width:100%;justify-content:center;margin-top:14px">${icon('lock')} Déverrouiller</button>
    <p class="tiny dim" id="fl">${fails ? `${fails} tentative(s) échouée(s).` : ''}${V.meta?.wipeAfter ? ` Effacement automatique après ${V.meta.wipeAfter} échecs.` : ''}</p>
    <details class="tiny dim"><summary>Phrase oubliée ?</summary><p>Aucune récupération n'est possible (chiffrement de bout en bout). Vous pouvez effacer le coffre et repartir de zéro, ou restaurer une sauvegarde.</p>
    <button class="btn sm danger" id="wipe">Effacer toutes les données</button> <label class="btn sm">Restaurer<input type="file" id="rb" hidden></label></details></div></div></div>`;
  const pp = $('#pp'); setTimeout(() => pp.focus(), 50);
  const go = async () => {
    const m = V.meta; const f = m.fails || 0;
    if (f >= 3) { const wait = Math.min(300, 5 * 2 ** (f - 3)) * 1000 - (Date.now() - (m.lastFail || 0)); if (wait > 0) return toast(`Trop d'échecs : patientez ${Math.ceil(wait/1000)} s.`, 'err'); }
    $('#ok').disabled = true; $('#ok').innerHTML = '<span class="spin"></span> Vérification…';
    const ok = await V.unlock(pp.value);
    if (!ok) {
      if (m.wipeAfter && m.fails >= m.wipeAfter) { await V.wipe(); toast('Nombre maximal d\'échecs atteint : coffre effacé.', 'err'); await V.open(); return showSetup(); }
      $('#ok').disabled = false; $('#ok').innerHTML = `${icon('lock')} Déverrouiller`; $('#fl').textContent = `${m.fails} tentative(s) échouée(s).`; pp.value = ''; return toast('Phrase secrète incorrecte.', 'err');
    }
    await seedIfEmpty(); await audit('Déverrouillage'); enterApp();
  };
  $('#ok').onclick = go; pp.onkeydown = e => { if (e.key === 'Enter') go(); };
  $('#wipe').onclick = async () => { if ((await promptBox('Effacer toutes les données', 'Tapez EFFACER pour supprimer définitivement le coffre')) === 'EFFACER') { await V.wipe(); await V.open(); showSetup(); } };
  $('#rb').onchange = e => restoreBackup(e.target.files[0]);
}

// ——————————————————————————————————— Coque
function enterApp(){
  const st = settings(); document.documentElement.dataset.theme = st.theme; try { localStorage.setItem('lexia-theme', st.theme); } catch {}
  $('#app').innerHTML = `<div id="shell">
    <div class="scrim" id="scrim"></div>
    <aside id="side"><div class="brand">${icon('scale')}<div><b>LEXIA</b><small>AGENTS JURIDIQUES · v${APP_VERSION}</small></div></div>
      ${NAV.map(([id, label, ic]) => `<a class="nav" href="#/${id}" data-nav="${id}">${icon(ic)}<span>${label}</span><span class="count" data-count="${id}"></span></a>`).join('')}
      <div class="sideFoot"><a class="nav" id="lockBtn">${icon('lock')}<span>Verrouiller</span></a></div></aside>
    <main id="main"><header id="top"><button class="ibtn" id="menuBtn">${icon('menu')}</button><h1 id="title"></h1><div id="topAct" class="row"></div></header><section id="view"></section></main>
    <nav id="bottom">${BOTTOM.map(([id, short]) => { const n = NAV.find(x => x[0] === id); return `<a href="#/${id}" data-nav="${id}">${icon(n[2])}<span>${short}</span></a>`; }).join('')}<a id="moreBtn">${icon('menu')}<span>Plus</span></a></nav>
  </div>`;
  const side = $('#side'), scrim = $('#scrim'); const toggle = o => { side.classList.toggle('open', o); scrim.classList.toggle('open', o); };
  $('#menuBtn').onclick = () => toggle(true); $('#moreBtn').onclick = () => toggle(true); scrim.onclick = () => toggle(false);
  $$('#side .nav').forEach(a => a.addEventListener('click', () => toggle(false)));
  $('#lockBtn').onclick = lockNow;
  if (!bound) {
    bound = true;
    window.addEventListener('hashchange', route); window.addEventListener('lexia:route', route);
    if (ARTIFACT) document.addEventListener('click', e => { const a = e.target.closest('a[href^="#/"]'); if (a) { e.preventDefault(); go(a.getAttribute('href')); } });
    ['pointerdown','keydown','touchstart'].forEach(e => document.addEventListener(e, () => { lastActive = Date.now(); }, { passive:true }));
    setInterval(checkLock, 15000);
  }
  lastActive = Date.now();
  route();
  if (!ARTIFACT) importShared();
  if (!engineReady(st)) toast(engineHint());
}

export function route(){
  if (!V.unlocked) return;
  const [, id = 'chat', param = null] = currentHash().split('/');
  const n = NAV.find(x => x[0] === id) || NAV[0];
  S.route = n[0]; S.param = param ? decodeURIComponent(param) : null;
  $$('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === n[0]));
  $('#title').textContent = n[1]; $('#topAct').innerHTML = '';
  const view = $('#view'); view.className = ''; view.innerHTML = ''; view.scrollTop = 0;
  try { n[3](view, S.param); } catch (e) { console.error(e); view.innerHTML = `<div class="banner red">Erreur d'affichage : ${esc(e.message)}</div>`; }
  updateCounts();
}
export function updateCounts(){
  const c = { docs:V.all('docs').length, dossiers:V.all('dossiers').filter(d => d.status !== 'Clos').length, history:V.all('convos').length, memory:V.all('lessons').length };
  $$('[data-count]').forEach(e => e.textContent = c[e.dataset.count] || '');
}

// ——————————————————————————————————— Verrouillage automatique et écran de confidentialité
function checkLock(){ const m = settings().autolock; if (m > 0 && V.unlocked && Date.now() - lastActive > m * 60000 && !S.busy) lockNow(); }
export async function restart(){ V.lock(); S.hash = ''; S.idx = null; S.idxDirty = true; if (!ARTIFACT) { location.hash = ''; return location.reload(); } (await V.open()) ? showUnlock() : showSetup(); }
export async function lockNow(){ if (V.unlocked) { try { await audit('Verrouillage'); } catch {} } V.lock(); S.idx = null; S.idxDirty = true; if (ARTIFACT) { S.hash = ''; return showUnlock(); } location.hash = ''; location.reload(); }
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); document.body.classList.add('veil'); }
  else { document.body.classList.remove('veil'); if (V.unlocked && hiddenAt) { const m = settings().autolock; if (m > 0 && Date.now() - hiddenAt > m * 60000 && !S.busy) lockNow(); } }
});

// ——————————————————————————————————— Fichiers partagés depuis Android (Web Share Target)
async function importShared(){
  if (!('caches' in window)) return;
  try {
    const c = await caches.open('lexia-share'); const keys = await c.keys(); if (!keys.length) return;
    const files = [];
    for (const k of keys) { const r = await c.match(k); const b = await r.blob(); const name = decodeURIComponent(r.headers.get('x-name') || 'partage'); files.push(new File([b], name, { type:b.type })); await c.delete(k); }
    await caches.delete('lexia-share');
    const added = await importFiles(files); if (added.length) { toast(`${added.length} document(s) reçu(s) par partage et chiffré(s).`, 'ok'); location.hash = '#/docs'; }
  } catch (e) { console.warn(e); }
}

// ——————————————————————————————————— Service worker et mises à jour
function registerSW(){
  navigator.serviceWorker.register('sw.js').then(reg => {
    const prompt = w => { const t = h(`<div class="toast">Nouvelle version de LEXIA disponible. <button class="btn sm pri">Mettre à jour</button></div>`); $('button', t).onclick = () => w.postMessage('skip'); $('#toasts').appendChild(t); };
    if (reg.waiting) prompt(reg.waiting);
    reg.addEventListener('updatefound', () => { const w = reg.installing; w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) prompt(w); }); });
    setInterval(() => reg.update().catch(() => {}), 3600e3);
  }).catch(() => {});
  // Rechargement uniquement après une mise à jour acceptée (pas lors de la toute première installation)
  const hadController = !!navigator.serviceWorker.controller; let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
}

window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.installPrompt = e; });
boot();
