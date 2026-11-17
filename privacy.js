// LEXIA — Pseudonymisation : les noms, coordonnées et identifiants sont remplacés par des jetons
// avant tout envoi au modèle, puis restaurés à l'affichage. Le modèle ne voit jamais les vraies valeurs.

const PATTERNS = [
  ['EMAIL', /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g],
  ['IBAN', /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){3,7}(?:[ ]?[A-Z0-9]{1,4})?\b/g],
  ['TEL', /(?:\+|00)\d{3}[\s.-]?\d{2}(?:[\s.-]?\d{2}){3,4}\b|\b0[1-9](?:[\s.-]?\d{2}){4}\b/g],
  ['CNI', /\b(?:C|CI)\s?\d{8,11}\b/g],
];

export class Pseudonymizer {
  constructor(terms = [], { patterns = true } = {}){
    this.toTok = new Map(); this.toVal = new Map(); this.count = {}; this.patterns = patterns;
    this.terms = terms.filter(t => t && t.value && t.value.trim().length >= 3)
      .map(t => ({ value:t.value.trim(), type:(t.type||'PERSONNE').toUpperCase().replace(/[^A-Z]/g,'') || 'PERSONNE' }))
      .sort((a,b) => b.value.length - a.value.length);
  }
  token(type, val){
    const key = val.toLowerCase();
    if (this.toTok.has(key)) return this.toTok.get(key);
    this.count[type] = (this.count[type]||0) + 1;
    const tok = `[${type}_${this.count[type]}]`;
    this.toTok.set(key, tok); this.toVal.set(tok, val);
    return tok;
  }
  apply(text){
    if (!text) return text;
    let out = text;
    for (const t of this.terms) {
      const re = new RegExp(escapeRe(t.value).replace(/\s+/g,'\\s+'), 'gi');
      out = out.replace(re, m => this.token(t.type, m));
    }
    if (this.patterns) {
      for (const [type, re] of PATTERNS) out = out.replace(re, m => this.token(type, m));
      // Détection automatique : sociétés (forme juridique + nom en capitales) et personnes précédées d'une civilité
      out = out.replace(/\b(SCI|SARL|SARLU|SAS|SASU|SA|SNC|GIE|Société|Ste)\s+((?:[A-Z][A-Z0-9&'’\-]{1,}\s?){1,5})/g, (m, form, name) => `${form} ${this.token('SOCIETE', name.trim())}${/\s$/.test(name) ? ' ' : ''}`);
      out = out.replace(/\b((?:[A-Z][A-Z0-9&'’\-]{2,}\s){1,4})(SARL|SARLU|SAS|SASU|SA|SCI|GIE)\b/g, (m, name, form) => /^(OHADA|UEMOA|CIMA|BCEAO|CCJA|AUDCG|AUSCGIE|LA|LE|DES|DE|ET)\s/.test(name) ? m : `${this.token('SOCIETE', name.trim())} ${form}`);
      out = out.replace(/\b(M\.|Mme|Mlle|Monsieur|Madame|Mademoiselle|Maître|Me|Dr|Docteur)\s+([A-ZÉÈÀÂÎÔÛÇ][A-ZÉÈÀÂÎÔÛÇ'’\-]{1,}(?:\s+[A-ZÉÈÀÂÎÔÛÇ][a-zéèêëàâîïôûç'’\-]+){0,3}(?:\s+[A-ZÉÈÀÂÎÔÛÇ]{2,})?)/g, (m, title, name) => `${title} ${this.token('PERSONNE', name)}`);
    }
    return out;
  }
  restore(text){
    if (!text || !this.toVal.size) return text;
    return text.replace(/\[([A-Z]+)_(\d+)\]/g, m => this.toVal.get(m) || m);
  }
  get size(){ return this.toVal.size; }
  report(){ return Array.from(this.toVal.keys()); }
}

function escapeRe(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
