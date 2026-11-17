// LEXIA — Recherche en langage naturel sur le corpus (BM25 + synonymes juridiques), 100 % locale

const STOP = new Set('a au aux avec ce ces cet cette dans de des du elle en et eux il ils je la le les leur lui ma mais me meme mes moi mon ne nos notre nous on ou par pas pour qu que qui sa se ses son sur ta te tes toi ton tu un une vos votre vous c d j l m n s t y ete etre est sont ont a avait sera fait faire peut doit quel quelle quels quelles comment quand combien est-ce cela ceci si tout tous toute toutes plus moins tres sans sous entre vers chez donc or ni car'.split(' '));

const SYN = {
  licenciement:['rupture','renvoi','congediement'], salarie:['travailleur','employe'], employeur:['entreprise'],
  bail:['loyer','bailleur','preneur','locataire','location'], loyer:['bail','loyers'], expulsion:['deguerpissement','resiliation'],
  dette:['creance','impaye','paiement'], creance:['dette','creancier','debiteur'], impot:['taxe','fiscal','imposition','droits'],
  terrain:['parcelle','lot','foncier','acd','titre'], societe:['sarl','sas','sa','entreprise','associes'],
  delai:['jours','mois','forclusion','prescription','echeance'], prix:['montant','somme','fcfa','francs'],
  resiliation:['rupture','fin','terminaison','denonciation'], garantie:['caution','surete','cautionnement','nantissement','hypotheque'],
  penalite:['penalites','amende','astreinte','retard'], confidentialite:['secret','confidentiel'],
};

const SYNS = new Map(Object.entries(SYN).map(([k, v]) => [stem(k), v.map(stem)]));

export function norm(s){ return (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,''); }
export function tokens(s){
  return norm(s).split(/[^a-z0-9]+/).filter(w => w.length > 1 && !STOP.has(w)).map(stem);
}
function stem(w){ if (w.length > 4 && /[sx]$/.test(w)) w = w.slice(0,-1); if (w.length > 6 && w.endsWith('ement')) w = w.slice(0,-5); return w; }

export function chunkText(text, size = 1400, overlap = 200){
  const out = []; if (!text) return out;
  const paras = text.split(/\n\s*\n|\n(?=\s*(?:article|art\.|chapitre|titre|section)\b)/i);
  let cur = '';
  for (const p of paras) {
    if ((cur + '\n\n' + p).length > size && cur) { out.push(cur.trim()); cur = cur.slice(-overlap) + '\n\n' + p; }
    else cur = cur ? cur + '\n\n' + p : p;
    while (cur.length > size * 1.6) { out.push(cur.slice(0, size)); cur = cur.slice(size - overlap); }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export class Index {
  constructor(){ this.chunks = []; this.df = new Map(); this.avg = 0; }
  build(docs){
    this.chunks = []; this.df = new Map(); let total = 0;
    for (const d of docs) {
      if (!d.text) continue;
      chunkText(d.text).forEach((c, i) => {
        const tk = tokens(d.title + ' ' + c); const tf = new Map();
        for (const t of tk) tf.set(t, (tf.get(t)||0) + 1);
        for (const t of tf.keys()) this.df.set(t, (this.df.get(t)||0) + 1);
        total += tk.length;
        this.chunks.push({ docId:d.id, num:d.num, title:d.title, dossierId:d.dossierId, part:i+1, text:c, tf, len:tk.length });
      });
    }
    this.avg = this.chunks.length ? total / this.chunks.length : 0;
    return this;
  }
  search(query, { k = 6, docIds = null, dossierId = null } = {}){
    const q = tokens(query); const exp = new Map();
    for (const t of q) exp.set(t, 1);
    for (const t of q) for (const s of (SYNS.get(t) || [])) if (!exp.has(s)) exp.set(s, 0.4);
    const N = this.chunks.length || 1, k1 = 1.4, b = 0.75;
    const res = [];
    for (const c of this.chunks) {
      if (docIds && !docIds.includes(c.docId)) continue;
      if (dossierId && c.dossierId !== dossierId) continue;
      let s = 0;
      for (const [t, w] of exp) {
        const f = c.tf.get(t); if (!f) continue;
        const df = this.df.get(t) || 0; const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        s += w * idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * c.len / (this.avg || 1)));
      }
      const phrase = norm(query).trim(); if (phrase.length > 8 && norm(c.text).includes(phrase)) s *= 1.5;
      if (s > 0) res.push({ ...c, score:s });
    }
    return res.sort((a,b) => b.score - a.score).slice(0, k);
  }
}

export function snippet(text, query, len = 220){
  const t = text.replace(/\s+/g,' '); const q = tokens(query); const n = norm(t);
  let pos = -1; for (const w of q) { pos = n.indexOf(w); if (pos >= 0) break; }
  const start = Math.max(0, pos - 60); return (start ? '… ' : '') + t.slice(start, start + len) + (t.length > start + len ? ' …' : '');
}
