// LEXIA — Coffre-fort chiffré : AES-GCM 256 + PBKDF2-SHA256, stockage IndexedDB
// Aucune donnée n'est écrite en clair : seuls l'identifiant, la collection et la date de mise à jour le sont.

const te = new TextEncoder(), td = new TextDecoder();
const DB_NAME = 'lexia', DB_VER = 1;
export const PBKDF2_ITER = 310000;

export const b64 = {
  enc(buf){ const u = new Uint8Array(buf); let s=''; for (let i=0;i<u.length;i+=0x8000) s += String.fromCharCode.apply(null, u.subarray(i,i+0x8000)); return btoa(s); },
  dec(str){ const s = atob(str); const u = new Uint8Array(s.length); for (let i=0;i<s.length;i++) u[i]=s.charCodeAt(i); return u; }
};

function idb(){
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VER);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath:'k' });
      if (!db.objectStoreNames.contains('vault')) { const s = db.createObjectStore('vault', { keyPath:'key' }); s.createIndex('col','col'); }
    };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
function tx(db, store, mode, fn){
  return new Promise((res, rej) => {
    const t = db.transaction(store, mode); const s = t.objectStore(store);
    let out; const r = fn(s); if (r) r.onsuccess = () => { out = r.result; };
    t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
  });
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
  constructor(){ this.db = null; this.dek = null; this.cache = {}; this.meta = null; }
  async open(){ this.db = await idb(); this.meta = await tx(this.db, 'meta', 'readonly', s => s.get('vault')); return !!this.meta; }
  get unlocked(){ return !!this.dek; }

  async setup(pass){
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const kek = await deriveKEK(pass, salt, PBKDF2_ITER);
    const raw = crypto.getRandomValues(new Uint8Array(32));
    const w = await aesEnc(kek, raw);
    const chk = await aesEnc(kek, te.encode('LEXIA-OK'));
    this.meta = { k:'vault', v:1, salt, iter:PBKDF2_ITER, wIv:w.iv, wKey:w.ct, cIv:chk.iv, cCt:chk.ct, fails:0, created:Date.now() };
    await tx(this.db, 'meta', 'readwrite', s => s.put(this.meta));
    this.dek = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt','decrypt']);
    raw.fill(0);
    this.cache = {};
  }

  async unlock(pass){
    const m = this.meta;
    const kek = await deriveKEK(pass, m.salt, m.iter);
    try { await aesDec(kek, m.cIv, m.cCt); }
    catch { m.fails = (m.fails||0) + 1; m.lastFail = Date.now(); await tx(this.db, 'meta', 'readwrite', s => s.put(m)); return false; }
    const raw = await aesDec(kek, m.wIv, m.wKey);
    this.dek = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt','decrypt']);
    raw.fill(0);
    m.fails = 0; await tx(this.db, 'meta', 'readwrite', s => s.put(m));
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
    await tx(this.db, 'meta', 'readwrite', s => s.put(m));
    return true;
  }

  lock(){ this.dek = null; this.cache = {}; }

  async loadAll(){
    const rows = await tx(this.db, 'vault', 'readonly', s => s.getAll());
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
    await tx(this.db, 'vault', 'readwrite', s => s.put({ key: col+':'+obj.id, col, id: obj.id, iv, ct, u: obj.updated }));
    (this.cache[col] ||= {})[obj.id] = obj;
    return obj;
  }
  async del(col, id){
    await tx(this.db, 'vault', 'readwrite', s => s.delete(col+':'+id));
    if (this.cache[col]) delete this.cache[col][id];
  }
  async putBlob(id, base64, mime){
    const { iv, ct } = await aesEnc(this.dek, te.encode(JSON.stringify({ b:base64, m:mime })));
    await tx(this.db, 'vault', 'readwrite', s => s.put({ key:'blob:'+id, col:'blob', id, iv, ct, u:Date.now() }));
  }
  async getBlob(id){
    const r = await tx(this.db, 'vault', 'readonly', s => s.get('blob:'+id));
    if (!r) return null;
    return JSON.parse(td.decode(await aesDec(this.dek, r.iv, r.ct)));
  }
  async delBlob(id){ await tx(this.db, 'vault', 'readwrite', s => s.delete('blob:'+id)); }

  // Sauvegarde : les enregistrements restent chiffrés ; seule la phrase secrète permet de les relire.
  async exportBackup(){
    const rows = await tx(this.db, 'vault', 'readonly', s => s.getAll());
    const m = this.meta;
    const pack = { format:'LEXIA-BACKUP', v:1, date:new Date().toISOString(),
      meta:{ salt:b64.enc(m.salt), iter:m.iter, wIv:b64.enc(m.wIv), wKey:b64.enc(m.wKey), cIv:b64.enc(m.cIv), cCt:b64.enc(m.cCt), created:m.created },
      rows: rows.map(r => ({ key:r.key, col:r.col, id:r.id, u:r.u, iv:b64.enc(r.iv), ct:b64.enc(r.ct) })) };
    return new Blob([JSON.stringify(pack)], { type:'application/octet-stream' });
  }
  async importBackup(text, pass){
    const p = JSON.parse(text);
    if (p.format !== 'LEXIA-BACKUP') throw new Error('Fichier de sauvegarde non reconnu');
    const meta = { k:'vault', v:1, salt:b64.dec(p.meta.salt), iter:p.meta.iter, wIv:b64.dec(p.meta.wIv), wKey:b64.dec(p.meta.wKey), cIv:b64.dec(p.meta.cIv), cCt:b64.dec(p.meta.cCt), fails:0, created:p.meta.created };
    const kek = await deriveKEK(pass, meta.salt, meta.iter);
    try { await aesDec(kek, meta.cIv, meta.cCt); } catch { throw new Error('Phrase secrète incorrecte pour cette sauvegarde'); }
    await tx(this.db, 'vault', 'readwrite', s => s.clear());
    await tx(this.db, 'vault', 'readwrite', s => { let last; for (const r of p.rows) last = s.put({ key:r.key, col:r.col, id:r.id, u:r.u, iv:b64.dec(r.iv), ct:b64.dec(r.ct) }); return last; });
    await tx(this.db, 'meta', 'readwrite', s => s.put(meta));
    this.meta = meta; this.lock();
    return true;
  }

  async wipe(){
    this.lock();
    if (this.db) this.db.close();
    await new Promise(res => { const r = indexedDB.deleteDatabase(DB_NAME); r.onsuccess = r.onerror = r.onblocked = () => res(); });
    try { localStorage.clear(); sessionStorage.clear(); } catch {}
    if ('caches' in self) for (const k of await caches.keys()) await caches.delete(k);
  }
}

export function uid(){ const a = crypto.getRandomValues(new Uint8Array(9)); return Array.from(a, b => b.toString(36).padStart(2,'0')).join('').slice(0,14); }
