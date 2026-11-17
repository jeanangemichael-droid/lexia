// LEXIA — Coffre-fort chiffré : AES-GCM 256 + PBKDF2-SHA256
// Deux supports de stockage, toujours chiffrés côté appareil avant écriture :
//  - IndexedDB de l'appareil (application installée) ;
//  - espace privé de l'utilisateur dans Claude (« data/users/<id> », invisible même du propriétaire de la page).
// Seuls l'identifiant, la collection et la date de mise à jour sont en clair.

import { ARTIFACT, cap } from './platform.js';

const te = new TextEncoder(), td = new TextDecoder();
const DB_NAME = 'lexia', DB_VER = 1;
export const PBKDF2_ITER = 310000;

export const b64 = {
  enc(buf){ const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf); let s=''; for (let i=0;i<u.length;i+=0x8000) s += String.fromCharCode.apply(null, u.subarray(i,i+0x8000)); return btoa(s); },
  dec(str){ const s = atob(str); const u = new Uint8Array(s.length); for (let i=0;i<s.length;i++) u[i]=s.charCodeAt(i); return u; }
};
const META_BIN = ['salt','wIv','wKey','cIv','cCt'];

// ——————————————————————————————— Support 1 : IndexedDB
class IdbStore {
  constructor(){ this.kind = 'appareil'; }
  async init(){
    this.db = await new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, DB_VER);
      r.onupgradeneeded = () => { const db = r.result;
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath:'k' });
        if (!db.objectStoreNames.contains('vault')) { const s = db.createObjectStore('vault', { keyPath:'key' }); s.createIndex('col','col'); } };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    return this;
  }
  tx(store, mode, fn){
    return new Promise((res, rej) => {
      const t = this.db.transaction(store, mode); const s = t.objectStore(store);
      let out; const r = fn(s); if (r) r.onsuccess = () => { out = r.result; };
      t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  }
  getMeta(){ return this.tx('meta', 'readonly', s => s.get('vault')); }
  putMeta(m){ return this.tx('meta', 'readwrite', s => s.put(m)); }
  all(){ return this.tx('vault', 'readonly', s => s.getAll()); }
  get(key){ return this.tx('vault', 'readonly', s => s.get(key)); }
  put(row){ return this.tx('vault', 'readwrite', s => s.put(row)); }
  del(key){ return this.tx('vault', 'readwrite', s => s.delete(key)); }
  async replaceAll(rows, meta){ await this.tx('vault', 'readwrite', s => s.clear()); for (const r of rows) await this.put(r); await this.putMeta(meta); }
  async wipe(){ this.db?.close(); await new Promise(res => { const r = indexedDB.deleteDatabase(DB_NAME); r.onsuccess = r.onerror = r.onblocked = () => res(); }); }
}

// ——————————————————————————————— Support 2 : espace privé dans Claude
const PART = 180000; // caractères base64 par document (limite de 256 Kio par document)
const safeId = k => k.replace(/[^A-Za-z0-9_\-.~:@+]/g, '_');
class ClaudeStore {
  constructor(db, uid){ this.db = db; this.kind = 'Claude (espace privé)'; this.col = db.collection('data/users/' + uid); }
  async init(){ return this; }
  async getMeta(){ const s = await this.col.doc('vault-meta').get(); if (!s.exists) return null; const m = { ...s.data() }; for (const k of META_BIN) if (m[k]) m[k] = b64.dec(m[k]); return m; }
  async putMeta(m){ const o = { ...m }; for (const k of META_BIN) if (o[k]) o[k] = b64.enc(o[k]); await this.col.doc('vault-meta').set(o); }
  async all(){
    const snap = await this.col.get(); const parts = {}; const mains = [];
    for (const d of snap.docs) { const x = d.data(); if (!x || d.id === 'vault-meta') continue; if (x.part) (parts[x.of] ||= []).push(x); else mains.push(x); }
    return mains.map(x => this.decode(x, parts[x.key]));
  }
  decode(x, extra = []){
    let ct = x.ct || ''; if (x.n > 1) ct += extra.sort((a,b) => a.part - b.part).map(p => p.ct).join('');
    return { key:x.key, col:x.col, id:x.id, u:x.u, iv:b64.dec(x.iv), ct:b64.dec(ct) };
  }
  async get(key){
    const s = await this.col.doc(safeId(key)).get(); if (!s.exists) return null; const x = s.data(); const extra = [];
    for (let i = 1; i < (x.n || 1); i++) { const p = await this.col.doc(safeId(key) + '~' + i).get(); if (p.exists) extra.push(p.data()); }
    return this.decode(x, extra);
  }
  async put(row){
    const ct = b64.enc(row.ct); const n = Math.max(1, Math.ceil(ct.length / PART)); const id = safeId(row.key);
    const prev = await this.col.doc(id).get(); const prevN = prev.exists ? (prev.data().n || 1) : 1;
    for (let i = 1; i < n; i++) await this.col.doc(id + '~' + i).set({ part:i, of:row.key, ct:ct.slice(i * PART, (i + 1) * PART) });
    await this.col.doc(id).set({ key:row.key, col:row.col, id:row.id, u:row.u, iv:b64.enc(row.iv), n, ct:ct.slice(0, PART) });
    for (let i = n; i < prevN; i++) await this.col.doc(id + '~' + i).delete();
  }
  async del(key){
    const id = safeId(key); const s = await this.col.doc(id).get(); const n = s.exists ? (s.data().n || 1) : 1;
    for (let i = 1; i < n; i++) await this.col.doc(id + '~' + i).delete();
    await this.col.doc(id).delete();
  }
  async replaceAll(rows, meta){ await this.wipe(); for (const r of rows) await this.put(r); await this.putMeta(meta); }
  async wipe(){ const snap = await this.col.get(); for (const d of snap.docs) await this.col.doc(d.id).delete(); }
}

async function pickStore(){
  if (ARTIFACT) {
    const [db, user] = await Promise.all([cap('db'), cap('user')]);
    const uid = user ? await user.id().catch(() => null) : null;
    if (db && uid) return new ClaudeStore(db, uid).init();
  }
  return new IdbStore().init();
}

async function deriveKEK(pass, salt, iter){
  const base = await crypto.subtle.importKey('raw', te.encode(pass.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name:'PBKDF2', salt, iterations:iter, hash:'SHA-256' }, base, { name:'AES-GCM', length:256 }, false, ['encrypt','decrypt']);
}
async function aesEnc(key, data){
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name:'AES-GCM', iv }, key, data);
  return { iv, ct: new Uint8Array(ct) };
}
async function aesDec(key, iv, ct){ return new Uint8Array(await crypto.subtle.decrypt({ name:'AES-GCM', iv }, key, ct)); }

export function passStrength(p){
  let s = 0; if (p.length >= 12) s++; if (p.length >= 16) s++; if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++; if (/\d/.test(p)) s++; if (/[^\w\s]/.test(p)) s++;
  return Math.min(4, s);
}

export class Vault {
  constructor(){ this.store = null; this.dek = null; this.cache = {}; this.meta = null; }
  async open(){ this.store = await pickStore(); this.meta = await this.store.getMeta(); return !!this.meta; }
  get unlocked(){ return !!this.dek; }
  get storage(){ return this.store?.kind || ''; }
  saveMeta(){ return this.store.putMeta(this.meta); }

  async setup(pass){
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const kek = await deriveKEK(pass, salt, PBKDF2_ITER);
    const raw = crypto.getRandomValues(new Uint8Array(32));
    const w = await aesEnc(kek, raw);
    const chk = await aesEnc(kek, te.encode('LEXIA-OK'));
    this.meta = { k:'vault', v:1, salt, iter:PBKDF2_ITER, wIv:w.iv, wKey:w.ct, cIv:chk.iv, cCt:chk.ct, fails:0, created:Date.now() };
    await this.saveMeta();
    this.dek = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt','decrypt']);
    raw.fill(0); this.cache = {};
  }

  async unlock(pass){
    const m = this.meta;
    const kek = await deriveKEK(pass, m.salt, m.iter);
    try { await aesDec(kek, m.cIv, m.cCt); }
    catch { m.fails = (m.fails||0) + 1; m.lastFail = Date.now(); await this.saveMeta(); return false; }
    const raw = await aesDec(kek, m.wIv, m.wKey);
    this.dek = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt','decrypt']);
    raw.fill(0);
    if (m.fails) { m.fails = 0; await this.saveMeta(); }
    await this.loadAll();
    return true;
  }

  async changePass(oldPass, newPass){
    const m = this.meta;
    const kek = await deriveKEK(oldPass, m.salt, m.iter);
    let raw; try { raw = await aesDec(kek, m.wIv, m.wKey); } catch { return false; }
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const nk = await deriveKEK(newPass, salt, PBKDF2_ITER);
    const w = await aesEnc(nk, raw); const chk = await aesEnc(nk, te.encode('LEXIA-OK'));
    raw.fill(0);
    Object.assign(m, { salt, iter:PBKDF2_ITER, wIv:w.iv, wKey:w.ct, cIv:chk.iv, cCt:chk.ct, fails:0 });
    await this.saveMeta();
    return true;
  }

  lock(){ this.dek = null; this.cache = {}; }

  async loadAll(){
    const rows = await this.store.all();
    this.cache = {};
    for (const r of rows) {
      if (r.col === 'blob') continue; // chargés à la demande
      try { const obj = JSON.parse(td.decode(await aesDec(this.dek, r.iv, r.ct))); (this.cache[r.col] ||= {})[r.id] = obj; }
      catch (e) { console.warn('Enregistrement illisible', r.key); }
    }
  }

  all(col){ return Object.values(this.cache[col] || {}); }
  get(col, id){ return (this.cache[col] || {})[id]; }

  async put(col, obj){
    if (!this.dek) throw new Error('Coffre verrouillé');
    if (!obj.id) obj.id = uid();
    obj.updated = Date.now();
    const { iv, ct } = await aesEnc(this.dek, te.encode(JSON.stringify(obj)));
    await this.store.put({ key: col+':'+obj.id, col, id: obj.id, iv, ct, u: obj.updated });
    (this.cache[col] ||= {})[obj.id] = obj;
    return obj;
  }
  async del(col, id){ await this.store.del(col+':'+id); if (this.cache[col]) delete this.cache[col][id]; }
  async putBlob(id, base64, mime){
    const { iv, ct } = await aesEnc(this.dek, te.encode(JSON.stringify({ b:base64, m:mime })));
    await this.store.put({ key:'blob:'+id, col:'blob', id, iv, ct, u:Date.now() });
  }
  async getBlob(id){
    const r = await this.store.get('blob:'+id); if (!r) return null;
    return JSON.parse(td.decode(await aesDec(this.dek, r.iv, r.ct)));
  }
  async delBlob(id){ await this.store.del('blob:'+id); }

  // Sauvegarde : les enregistrements restent chiffrés ; seule la phrase secrète permet de les relire.
  async exportBackup(){
    const rows = await this.store.all(); const m = this.meta;
    const pack = { format:'LEXIA-BACKUP', v:1, date:new Date().toISOString(),
      meta:{ salt:b64.enc(m.salt), iter:m.iter, wIv:b64.enc(m.wIv), wKey:b64.enc(m.wKey), cIv:b64.enc(m.cIv), cCt:b64.enc(m.cCt), created:m.created },
      rows: rows.map(r => ({ key:r.key, col:r.col, id:r.id, u:r.u, iv:b64.enc(r.iv), ct:b64.enc(r.ct) })) };
    return new Blob([JSON.stringify(pack)], { type:'application/json' });
  }
  async importBackup(text, pass){
    const p = JSON.parse(text);
    if (p.format !== 'LEXIA-BACKUP') throw new Error('Fichier de sauvegarde non reconnu');
    const meta = { k:'vault', v:1, salt:b64.dec(p.meta.salt), iter:p.meta.iter, wIv:b64.dec(p.meta.wIv), wKey:b64.dec(p.meta.wKey), cIv:b64.dec(p.meta.cIv), cCt:b64.dec(p.meta.cCt), fails:0, created:p.meta.created };
    const kek = await deriveKEK(pass, meta.salt, meta.iter);
    try { await aesDec(kek, meta.cIv, meta.cCt); } catch { throw new Error('Phrase secrète incorrecte pour cette sauvegarde'); }
    await this.store.replaceAll(p.rows.map(r => ({ key:r.key, col:r.col, id:r.id, u:r.u, iv:b64.dec(r.iv), ct:b64.dec(r.ct) })), meta);
    this.meta = meta; this.lock();
    return true;
  }

  async wipe(){
    this.lock();
    await this.store.wipe();
    try { localStorage.clear(); sessionStorage.clear(); } catch {}
    try { if ('caches' in self) for (const k of await caches.keys()) await caches.delete(k); } catch {}
  }
}

export function uid(){ const a = crypto.getRandomValues(new Uint8Array(9)); return Array.from(a, b => b.toString(36).padStart(2,'0')).join('').slice(0,14); }
