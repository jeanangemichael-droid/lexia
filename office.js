// LEXIA — Rendu Markdown sécurisé, export Word (.docx natif), lecture .docx, CSV, agenda .ics
import { ARTIFACT, cap } from './platform.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

// ————————————————————————— Analyse Markdown → blocs
export function parseMd(md){
  const lines = String(md || '').replace(/\r/g,'').split('\n'); const out = []; let i = 0;
  const isTable = l => /^\s*\|.*\|\s*$/.test(l);
  while (i < lines.length) {
    const l = lines[i];
    if (/^\s*```/.test(l)) { const buf = []; i++; while (i < lines.length && !/^\s*```/.test(lines[i])) buf.push(lines[i++]); i++; out.push({ t:'code', text:buf.join('\n') }); continue; }
    let m;
    if ((m = l.match(/^(#{1,4})\s+(.*)$/))) { out.push({ t:'h', level:m[1].length, text:m[2].trim() }); i++; continue; }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(l)) { out.push({ t:'hr' }); i++; continue; }
    if (isTable(l)) {
      const rows = [];
      while (i < lines.length && isTable(lines[i])) {
        const cells = lines[i].trim().replace(/^\||\|$/g,'').split('|').map(c => c.trim());
        if (!cells.every(c => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      out.push({ t:'table', rows }); continue;
    }
    if (/^\s*[-*•]\s+/.test(l)) { const items = []; while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*•]\s+/, '')); out.push({ t:'ul', items }); continue; }
    if (/^\s*\d+[.)]\s+/.test(l)) { const items = []; while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, '')); out.push({ t:'ol', items }); continue; }
    if (/^\s*>/.test(l)) { const buf = []; while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, '')); out.push({ t:'quote', text:buf.join(' ') }); continue; }
    if (!l.trim()) { i++; continue; }
    const buf = [l]; i++;
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|\s*[-*•]\s|\s*\d+[.)]\s|\s*>|\s*```|\s*\|)/.test(lines[i])) buf.push(lines[i++]);
    out.push({ t:'p', text:buf.join('\n') });
  }
  return out;
}

// ————————————————————————— Rendu HTML (tout est échappé avant mise en forme)
function inlineHtml(s){
  let h = esc(s);
  h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
  h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  h = h.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, t, u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`);
  h = h.replace(/\[(Vérifié|Verifie|Vérifiée)\]/gi, '<span class="badge ok">Vérifié</span>')
       .replace(/\[(Connaissance établie[^\]]*)\]/gi, '<span class="badge mid">$1</span>')
       .replace(/\[(À vérifier[^\]]*|A vérifier[^\]]*)\]/gi, '<span class="badge warn">$1</span>');
  h = h.replace(/\[DOC\s*(\d+)([^\]]*)\]/g, '<button class="docref" data-doc="$1">DOC $1$2</button>');
  h = h.split(/(<[^>]+>)/).map(seg => seg.startsWith('<') ? seg : seg.replace(/\b((?:art(?:icle)?s?\.?)\s*\d+[\w\-]*(?:\s*(?:et|à|,)\s*\d+[\w\-]*)*)/gi, '<span class="cite">$1</span>')).join('');
  return h.replace(/\n/g, '<br>');
}
export function mdToHtml(md){
  return parseMd(md).map(b => {
    switch (b.t) {
      case 'h': return `<h${b.level+1}>${inlineHtml(b.text)}</h${b.level+1}>`;
      case 'p': return `<p>${inlineHtml(b.text)}</p>`;
      case 'ul': return `<ul>${b.items.map(x => `<li>${inlineHtml(x)}</li>`).join('')}</ul>`;
      case 'ol': return `<ol>${b.items.map(x => `<li>${inlineHtml(x)}</li>`).join('')}</ol>`;
      case 'quote': return `<blockquote>${inlineHtml(b.text)}</blockquote>`;
      case 'hr': return '<hr>';
      case 'code': return `<pre>${esc(b.text)}</pre>`;
      case 'table': return `<div class="tablewrap"><table>${b.rows.map((r, i) => `<tr>${r.map(c => i ? `<td>${inlineHtml(c)}</td>` : `<th>${inlineHtml(c)}</th>`).join('')}</tr>`).join('')}</table></div>`;
    }
  }).join('');
}

// ————————————————————————— ZIP (méthode « stored ») + CRC32
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u){ let c = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
export function zip(files){
  const te = new TextEncoder(); const parts = []; const central = []; let offset = 0;
  for (const [name, content] of files) {
    const data = typeof content === 'string' ? te.encode(content) : content; const nm = te.encode(name); const crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, 0, true); lh.setUint16(12, 0x21, true); lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true);
    lh.setUint16(26, nm.length, true); lh.setUint16(28, 0, true);
    parts.push(new Uint8Array(lh.buffer), nm, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
    ch.setUint16(12, 0, true); ch.setUint16(14, 0x21, true); ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true);
    ch.setUint16(28, nm.length, true); ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), nm);
    offset += 30 + nm.length + data.length;
  }
  const csize = central.reduce((s, p) => s + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, csize, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)]);
}

// ————————————————————————— Lecture ZIP (deflate via DecompressionStream)
async function inflateRaw(u8){ const ds = new DecompressionStream('deflate-raw'); const s = new Blob([u8]).stream().pipeThrough(ds); return new Uint8Array(await new Response(s).arrayBuffer()); }
export async function unzipEntry(buf, wanted){
  const u = new Uint8Array(buf); const dv = new DataView(buf);
  let e = u.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('Archive invalide');
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const td = new TextDecoder(); const found = {};
  for (let k = 0; k < n; k++) {
    const method = dv.getUint16(p + 10, true), csz = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
    const name = td.decode(u.subarray(p + 46, p + 46 + nl));
    if (wanted.test(name)) {
      const lnl = dv.getUint16(lo + 26, true), lxl = dv.getUint16(lo + 28, true); const start = lo + 30 + lnl + lxl;
      const raw = u.subarray(start, start + csz);
      found[name] = td.decode(method === 8 ? await inflateRaw(raw) : raw);
    }
    p += 46 + nl + xl + cl;
  }
  return found;
}
const ENT = s => s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#(\d+);/g,(m,d)=>String.fromCharCode(+d)).replace(/&amp;/g,'&');
export async function readDocx(buf){
  const f = await unzipEntry(buf, /^word\/document\.xml$/);
  const x = f['word/document.xml']; if (!x) throw new Error('Document Word illisible');
  return ENT(x.replace(/<w:tab\/>/g,'\t').replace(/<w:br[^>]*\/>/g,'\n').replace(/<\/w:p>/g,'\n').replace(/<[^>]+>/g,'')).replace(/\n{3,}/g,'\n\n').trim();
}
export async function readOdt(buf){
  const f = await unzipEntry(buf, /^content\.xml$/); const x = f['content.xml'] || '';
  return ENT(x.replace(/<text:tab\/>/g,'\t').replace(/<text:line-break\/>/g,'\n').replace(/<\/text:(p|h)>/g,'\n').replace(/<[^>]+>/g,'')).trim();
}

// ————————————————————————— Écriture .docx
const X = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function runs(text, base = {}){
  const out = []; const re = /\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*|`([^`]+)`/g; let last = 0, m;
  const clean = String(text).replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '$1 ($2)');
  while ((m = re.exec(clean))) { if (m.index > last) out.push({ t:clean.slice(last, m.index) }); out.push(m[1] ? { t:m[1], b:1 } : m[2] ? { t:m[2], i:1 } : { t:m[3], mono:1 }); last = re.lastIndex; }
  if (last < clean.length) out.push({ t:clean.slice(last) });
  return out.map(r => {
    const pr = (r.b || base.b ? '<w:b/>' : '') + (r.i || base.i ? '<w:i/>' : '') + (r.mono ? '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>' : '') + (base.color ? `<w:color w:val="${base.color}"/>` : '') + (base.sz ? `<w:sz w:val="${base.sz}"/>` : '');
    return r.t.split('\n').map((seg, k) => `${k ? '<w:r><w:br/></w:r>' : ''}<w:r>${pr ? `<w:rPr>${pr}</w:rPr>` : ''}<w:t xml:space="preserve">${X(seg)}</w:t></w:r>`).join('');
  }).join('');
}
const para = (inner, style, extra = '') => `<w:p>${style || extra ? `<w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}${extra}</w:pPr>` : ''}${inner}</w:p>`;

export function mdToDocx(md, { title = '', cabinet = '', font = 'Times New Roman', ref = '' } = {}){
  const blocks = parseMd(md); let body = '';
  if (cabinet) body += para(runs(cabinet, { b:1, color:'7A5C1E', sz:20 }), null, '<w:jc w:val="right"/>');
  if (title) body += para(runs(title), 'Title');
  if (ref) body += para(runs(ref, { i:1, sz:18, color:'666666' }));
  for (const b of blocks) {
    if (b.t === 'h') body += para(runs(b.text), 'Heading' + Math.min(3, b.level));
    else if (b.t === 'p') body += para(runs(b.text), null, '<w:jc w:val="both"/>');
    else if (b.t === 'ul') b.items.forEach(it => body += para(runs('•\t' + it), null, '<w:tabs><w:tab w:val="left" w:pos="567"/></w:tabs><w:ind w:left="567" w:hanging="283"/>'));
    else if (b.t === 'ol') b.items.forEach((it, k) => body += para(runs(`${k+1}.\t` + it), null, '<w:tabs><w:tab w:val="left" w:pos="567"/></w:tabs><w:ind w:left="567" w:hanging="425"/>'));
    else if (b.t === 'quote') body += para(runs(b.text, { i:1 }), null, '<w:ind w:left="567"/>');
    else if (b.t === 'code') body += para(runs(b.text, {}), null, '<w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/>');
    else if (b.t === 'hr') body += para('', null, '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="999999"/></w:pBdr>');
    else if (b.t === 'table' && b.rows.length) {
      const cols = Math.max(...b.rows.map(r => r.length)); const w = Math.floor(9638 / cols);
      body += `<w:tbl><w:tblPr><w:tblStyle w:val="Grille"/><w:tblW w:w="5000" w:type="pct"/><w:tblLayout w:type="autofit"/></w:tblPr><w:tblGrid>${('<w:gridCol w:w="' + w + '"/>').repeat(cols)}</w:tblGrid>`;
      b.rows.forEach((r, ri) => {
        body += `<w:tr>${ri === 0 ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}`;
        for (let c = 0; c < cols; c++) body += `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${ri === 0 ? '<w:shd w:val="clear" w:color="auto" w:fill="EFE6D2"/>' : ''}</w:tcPr>${para(runs(r[c] ?? '', ri === 0 ? { b:1, sz:18 } : { sz:18 }))}</w:tc>`;
        body += '</w:tr>';
      });
      body += '</w:tbl>' + para('');
    }
  }
  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${body}<w:sectPr><w:footerReference w:type="default" r:id="rIdF"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1418" w:right="1134" w:bottom="1418" w:left="1418" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const footer = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ${NS}><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:sz w:val="16"/><w:color w:val="808080"/></w:rPr><w:t xml:space="preserve">${X(cabinet || 'LEXIA')} — Confidentiel — page </w:t></w:r><w:r><w:rPr><w:sz w:val="16"/><w:color w:val="808080"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:rPr><w:sz w:val="16"/><w:color w:val="808080"/></w:rPr><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:rPr><w:sz w:val="16"/><w:color w:val="808080"/></w:rPr><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:rPr><w:sz w:val="16"/><w:color w:val="808080"/></w:rPr><w:t>1</w:t></w:r><w:r><w:rPr><w:sz w:val="16"/><w:color w:val="808080"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>`;
  const F = X(font);
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${F}" w:hAnsi="${F}" w:cs="${F}" w:eastAsia="${F}"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="fr-FR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="240" w:after="240"/><w:jc w:val="center"/></w:pPr><w:rPr><w:b/><w:caps/><w:sz w:val="30"/><w:color w:val="1F2A44"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="2" w:color="B08D3C"/></w:pBdr><w:spacing w:before="320" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/><w:color w:val="1F2A44"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="100"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="7A5C1E"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="80"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:i/><w:sz w:val="22"/></w:rPr></w:style>
<w:style w:type="table" w:styleId="Grille"><w:name w:val="Table Grid"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:color="A6A6A6"/><w:left w:val="single" w:sz="4" w:color="A6A6A6"/><w:bottom w:val="single" w:sz="4" w:color="A6A6A6"/><w:right w:val="single" w:sz="4" w:color="A6A6A6"/><w:insideH w:val="single" w:sz="4" w:color="A6A6A6"/><w:insideV w:val="single" w:sz="4" w:color="A6A6A6"/></w:tblBorders><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>`;
  return zip([
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>'],
    ['docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${X(title)}</dc:title><dc:creator>${X(cabinet || 'LEXIA')}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0,19)}Z</dcterms:created></cp:coreProperties>`],
    ['word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdF" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>'],
    ['word/document.xml', doc], ['word/styles.xml', styles], ['word/footer1.xml', footer],
  ]);
}

// ————————————————————————— CSV (Excel FR) et agenda .ics
export function toCsv(rows){
  const q = v => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s; };
  return new Blob(['﻿' + rows.map(r => r.map(q).join(';')).join('\r\n')], { type:'text/csv;charset=utf-8' });
}
export function toIcs(events, cal = 'LEXIA'){
  const e = s => String(s ?? '').replace(/\\/g,'\\\\').replace(/[,;]/g, m => '\\' + m).replace(/\n/g,'\\n');
  const stamp = new Date().toISOString().replace(/[-:]/g,'').slice(0,15) + 'Z';
  const body = events.filter(x => /^\d{4}-\d{2}-\d{2}/.test(x.date || '')).map((x, i) => {
    const d = x.date.slice(0,10).replace(/-/g,''); const nd = new Date(x.date.slice(0,10) + 'T00:00:00Z'); nd.setUTCDate(nd.getUTCDate() + 1);
    return ['BEGIN:VEVENT', `UID:lexia-${d}-${i}-${Math.random().toString(36).slice(2,8)}@lexia`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${nd.toISOString().slice(0,10).replace(/-/g,'')}`, `SUMMARY:${e(x.title)}`, `DESCRIPTION:${e(x.desc)}`,
      'BEGIN:VALARM','ACTION:DISPLAY','TRIGGER:-P3D',`DESCRIPTION:${e(x.title)}`,'END:VALARM','BEGIN:VALARM','ACTION:DISPLAY','TRIGGER:-P1D',`DESCRIPTION:${e(x.title)}`,'END:VALARM','END:VEVENT'].join('\r\n');
  }).join('\r\n');
  return new Blob([`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//LEXIA//Agents juridiques//FR\r\nX-WR-CALNAME:${e(cal)}\r\n${body}\r\nEND:VCALENDAR\r\n`], { type:'text/calendar;charset=utf-8' });
}

function notify(msg){ const t = document.createElement('div'); t.className = 'toast err'; t.textContent = msg; document.querySelector('#toasts')?.appendChild(t); setTimeout(() => t.remove(), 7000); }
export async function download(blob, name){
  if (ARTIFACT) {
    const d = await cap('downloads');
    if (!d) return notify('Le téléchargement n\'est pas disponible dans cette vue.');
    try { await d.save({ filename:name, data:blob }); }
    catch (e) { if (e?.code === 'declined') return; notify(e?.code === 'rejected_extension' ? `Le format de « ${name} » n'est pas autorisé dans Claude (utilisez la version installée depuis GitHub pour ce format).` : 'Téléchargement impossible : ' + (e?.message || e?.code || '')); }
    return;
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
export const fileSafe = s => String(s || 'document').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'_').slice(0,60) || 'document';
