// app.jsx — METAL.SYS Reproductor web personal
// Toda la lógica y UI en un solo archivo JSX transpilado por Babel en el navegador.
// No hay bundler ni npm. Todas las dependencias se cargan por CDN en index.html.

const { useState, useEffect, useRef, useCallback, useMemo } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "phosphor": "metal",
  "scanlines": 0.35,
  "vignette": 0.65,
  "chroma": 1.4,
  "curvature": 32,
  "bloom": 8,
  "flicker": true,
  "rollbar": true,
  "jitter": true
}/*EDITMODE-END*/;

const STORAGE_KEY  = 'metalsys_vault_v2';
const CATS_KEY     = 'metalsys_cats_v2';
const LOG_KEY      = 'metalsys_log_v2';
const LIKES_KEY    = 'metalsys_likes_v1';
const COUNTS_KEY   = 'metalsys_playcounts_v1';
const PLOG_KEY     = 'metalsys_plog_v1';
const BMRK_KEY     = 'metalsys_bookmarks_v1';
const CLIPS_KEY    = 'metalsys_clips_v1';
const ARTIST_META_KEY = 'metalsys_artist_meta_v1';
const SIZE_CAP  = 8 * 1024 * 1024;
const VAULT_CAP = 25 * 1024 * 1024;

// Categorías derivadas dinámicamente de los metadatos de los archivos (no hay categorías fijas)
const DEFAULT_CATS = [];

const ASCII_LOGO = String.raw`
 \m/ ▲▼▲▼▲▼▲▼▲▼▲▼▲▼▲▼▲▼ \m/
  __  __ _____ _____  _    _
 |  \/  | ____|_   _|/ \  | |
 | |\/| |  _|   | | / _ \ | |
 | |  | | |___  | |/ ___ \| |___
 |_|  |_|_____| |_/_/   \_\_____|
 \m/ ▲▼▲▼▲▼▲▼▲▼▲▼▲▼▲▼▲▼ \m/
`;

const MARQUEE_LINES = [
  "*** METAL.SYS UNDERGROUND VAULT :: ARCHIVA TUS ARTEFACTOS :: COMPÁRTELOS CON LOS TUYOS ***",
  "CATEGORÍAS DISPONIBLES :: JUEGOS · DOCUMENTOS · IMÁGENES · VIDEOS · OTROS · O CREA LA TUYA",
  "PROTOCOLO DE TRANSFERENCIA :: NAVEGADOR NATIVO :: SIN LOGIN :: SIN SERVIDOR :: SIN BS",
  "EACH FILE GETS A NAME, A DESCRIPCIÓN Y UNA MINIATURA :: HAZ QUE TUS UPLOADS TENGAN ESTILO",
  "DRAG · DROP · TAG · SHARE \\m/ ALL FILES STORED ON YOUR LOCAL DECK ◆ DO NOT CLEAR CACHE",
];

// ─── ALMACENAMIENTO ────────────────────────────────────────────
// Funciones simples de lectura/escritura de localStorage.
// Todos los datos del vault, categorías, likes, etc. viven aquí.
function loadVault() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } }
function saveVault(f) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(f)); return true; } catch { return false; } }
function loadCats() {
  try {
    const c = JSON.parse(localStorage.getItem(CATS_KEY) || '[]');
    return c.map(x => typeof x === 'string' ? { name: x, icon: 'default' } : x);
  } catch { return []; }
}
function saveCats(c) { try { localStorage.setItem(CATS_KEY, JSON.stringify(c)); } catch {} }
function loadLog() { try { return JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); } catch { return []; } }
function saveLog(l) { try { localStorage.setItem(LOG_KEY, JSON.stringify(l.slice(0, 200))); } catch {} }
function loadLikes() { try { return new Set(JSON.parse(localStorage.getItem(LIKES_KEY) || '[]')); } catch { return new Set(); } }
function saveLikes(s) { try { localStorage.setItem(LIKES_KEY, JSON.stringify([...s])); } catch {} }
function loadCounts() { try { return JSON.parse(localStorage.getItem(COUNTS_KEY) || '{}'); } catch { return {}; } }
function saveCounts(c) { try { localStorage.setItem(COUNTS_KEY, JSON.stringify(c)); } catch {} }
function loadPLog() { try { return JSON.parse(localStorage.getItem(PLOG_KEY) || '[]'); } catch { return []; } }
function savePLog(l) { try { localStorage.setItem(PLOG_KEY, JSON.stringify(l.slice(0, 2000))); } catch {} }
function loadBookmarks() { try { return JSON.parse(localStorage.getItem(BMRK_KEY) || '{}'); } catch { return {}; } }
function saveBookmarks(b) { try { localStorage.setItem(BMRK_KEY, JSON.stringify(b)); } catch {} }
function loadClipStore() { try { return JSON.parse(localStorage.getItem(CLIPS_KEY) || '{}'); } catch { return {}; } }
function saveClipStore(c) { try { localStorage.setItem(CLIPS_KEY, JSON.stringify(c)); } catch {} }
function loadArtistMeta() { try { return JSON.parse(localStorage.getItem(ARTIST_META_KEY) || '{}'); } catch { return {}; } }
function saveArtistMeta(m) { try { localStorage.setItem(ARTIST_META_KEY, JSON.stringify(m)); } catch {} }

// IndexedDB: se usa exclusivamente para guardar el handle de carpeta local
// (localStorage no admite objetos FileSystemDirectoryHandle)
function getIDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('metalsys_fs', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('handles');
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
async function idbSet(key, val) {
  try {
    const db = await getIDB();
    return new Promise((res, rej) => {
      const tx = db.transaction('handles', 'readwrite');
      tx.objectStore('handles').put(val, key);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch {}
}
async function idbGet(key) {
  try {
    const db = await getIDB();
    return new Promise((res) => {
      const tx = db.transaction('handles', 'readonly');
      const req = tx.objectStore('handles').get(key);
      req.onsuccess = () => res(req.result || null);
      req.onerror = () => res(null);
    });
  } catch { return null; }
}

function fmtTimeSec(sec) {
  if (!sec && sec !== 0) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
function fmtTimeMs(sec) {
  if (!sec && sec !== 0) return '0:00.000';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec % 1) * 1000);
  return `${m}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}
function parseTimeSec(str) {
  if (!str) return 0;
  const [minSec, msStr] = (str || '').split('.');
  const parts = minSec.split(':').map(Number);
  const ms = msStr ? Number(msStr.slice(0, 3).padEnd(3, '0')) / 1000 : 0;
  if (parts.length === 2) return (parts[0] || 0) * 60 + (parts[1] || 0) + ms;
  return (Number(parts[0]) || 0) + ms;
}

function sortByDiscTrack(a, b) {
  const da = parseInt(a.disc) || 1, db = parseInt(b.disc) || 1;
  if (da !== db) return da - db;
  return (parseInt(a.track) || 999) - (parseInt(b.track) || 999);
}

function fmtBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024*1024) return (n/1024).toFixed(1) + ' KB';
  if (n < 1024*1024*1024) return (n/1024/1024).toFixed(2) + ' MB';
  return (n/1024/1024/1024).toFixed(2) + ' GB';
}
function fmtDate(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getMonth()+1)}.${p(d.getDate())}.${String(d.getFullYear()).slice(-2)} / ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function fmtLongDate(ts) {
  const d = new Date(ts);
  const months = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()} · ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
function autoCategory(name, type) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (/^(jpg|jpeg|png|gif|bmp|webp|svg)$/.test(ext) || type.startsWith('image/')) return 'IMÁGENES';
  if (/^(mp3|wav|ogg|flac|m4a|aac|wma|opus|aiff|mid|midi)$/.test(ext) || type.startsWith('audio/')) return 'MÚSICA';
  if (/^(mp4|mov|avi|mkv|webm|flv)$/.test(ext) || type.startsWith('video/')) return 'VIDEOS';
  if (/^(txt|md|log|csv|json|xml|pdf|doc|docx|odt|rtf)$/.test(ext) || type.startsWith('text/') || type === 'application/pdf') return 'DOCUMENTOS';
  if (/^(exe|bin|iso|rom|dmg|app|nes|smc|gba|nds|gb|gbc|sfc|n64|z64|wad|chd|pak)$/.test(ext)) return 'JUEGOS';
  return 'OTROS';
}
function readAsDataURL(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

// Pixelate + apply a red phosphor duotone palette so the thumbnail
// matches the CRT aesthetic. Returns a PNG data URL.
async function processThumb(file) {
  const src = await readAsDataURL(file);
  const img = await loadImage(src);
  const maxW = 128;
  const scale = Math.min(1, maxW / img.width);
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, w, h);
  const id = ctx.getImageData(0, 0, w, h);
  const d = id.data;
  // 4-stop blood-red phosphor ramp (shadow → midtone → highlight → hotspot)
  const stops = [
    [0.00, [10, 4, 6]],      // near-black background
    [0.35, [120, 14, 14]],   // deep red
    [0.70, [214, 31, 31]],   // primary red
    [1.00, [255, 220, 180]], // amber-white highlight
  ];
  const mapColor = (t) => {
    let i = 0;
    while (i < stops.length - 1 && t > stops[i + 1][0]) i++;
    const a = stops[i], b = stops[Math.min(i + 1, stops.length - 1)];
    const span = (b[0] - a[0]) || 1;
    const f = Math.max(0, Math.min(1, (t - a[0]) / span));
    return [
      a[1][0] + (b[1][0] - a[1][0]) * f,
      a[1][1] + (b[1][1] - a[1][1]) * f,
      a[1][2] + (b[1][2] - a[1][2]) * f,
    ];
  };
  for (let i = 0; i < d.length; i += 4) {
    // luminance
    let lum = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;
    // boost contrast
    lum = Math.max(0, Math.min(1, (lum - 0.5) * 1.25 + 0.5));
    // posterize to 6 steps for that vintage-monitor banding
    const quant = Math.round(lum * 5) / 5;
    const [r, g, b] = mapColor(quant);
    // scanline darkening on every other row
    const y = Math.floor((i / 4) / w);
    const dark = (y % 2 === 0) ? 0.78 : 1;
    d[i]     = r * dark;
    d[i + 1] = g * dark;
    d[i + 2] = b * dark;
    // alpha preserved
  }
  ctx.putImageData(id, 0, 0);
  return c.toDataURL('image/png');
}
function downloadFile(f) {
  const a = document.createElement('a');
  a.download = f.fileName || f.name;
  if (f.r2Path) {
    fetch(`/api/audio?path=${encodeURIComponent(f.r2Path)}`)
      .then(r => r.json())
      .then(({ url }) => { a.href = url; document.body.appendChild(a); a.click(); document.body.removeChild(a); })
      .catch(() => {});
    return;
  }
  a.href = f.fileData;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ─── DETECCIÓN DE TIPO DE ARCHIVO ──────────────────────────────
const TEXT_EXTS = ['txt','md','log','csv','json','xml','html','htm','css','js','jsx','ts','tsx','py','rb','go','java','c','cpp','h','hpp','rs','sh','bash','zsh','yaml','yml','toml','ini','cfg','conf','rst','tex','sql','lua','php','svg','m3u','srt','vtt','env','gitignore','license','readme'];
function isTextFile(f) {
  const ext = (f.fileName.split('.').pop() || '').toLowerCase();
  if (TEXT_EXTS.includes(ext)) return true;
  if ((f.fileType || '').startsWith('text/')) return true;
  if (f.fileType === 'application/json' || f.fileType === 'application/xml') return true;
  return false;
}
function isZipFile(f) {
  const ext = (f.fileName.split('.').pop() || '').toLowerCase();
  if (ext === 'zip') return true;
  if (f.fileType === 'application/zip' || f.fileType === 'application/x-zip-compressed') return true;
  return false;
}
function decodeTextFromDataURL(dataURL, maxBytes = 200 * 1024) {
  const b64 = dataURL.split(',')[1] || '';
  const bin = atob(b64);
  const slice = bin.slice(0, maxBytes);
  const bytes = new Uint8Array(slice.length);
  for (let i = 0; i < slice.length; i++) bytes[i] = slice.charCodeAt(i);
  let text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  return { text, truncated: bin.length > maxBytes, totalBytes: bin.length };
}

// More type detectors
function extOf(f) { return (f.fileName.split('.').pop() || '').toLowerCase(); }
function isMarkdownFile(f) { return extOf(f) === 'md' || extOf(f) === 'markdown' || (f.fileType || '') === 'text/markdown'; }
function isPdfFile(f)      { return extOf(f) === 'pdf' || (f.fileType || '') === 'application/pdf'; }
function isAudioFile(f)    { return /^(mp3|wav|ogg|flac|m4a|aac|opus|aiff|wma)$/.test(extOf(f)) || (f.fileType || '').startsWith('audio/'); }
function isVideoFile(f)    { return /^(mp4|mov|avi|mkv|webm|flv|m4v|ogv)$/.test(extOf(f)) || (f.fileType || '').startsWith('video/'); }
function isImageFile(f)    { return /^(jpg|jpeg|png|gif|bmp|webp|svg|ico)$/.test(extOf(f)) || (f.fileType || '').startsWith('image/'); }

// Normalize string for search (lowercase, strip accents)
function normStr(s) {
  return (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ─── PARSER ID3v2 ──────────────────────────────────────────────
// Parser nativo: lee título, artista, álbum, año, género, pista y portada (APIC)
// directamente desde un ArrayBuffer. Sin librerías externas.
// Core ID3 parser\u2014 accepts an ArrayBuffer directly
async function _parseID3Buffer(buf) {
  if (buf.byteLength < 10) return {};
  const view = new DataView(buf);
  const sig = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2));
  if (sig !== 'ID3') return {};
  const major = view.getUint8(3);
  const tagSize = ((view.getUint8(6) & 0x7f) << 21) | ((view.getUint8(7) & 0x7f) << 14)
                | ((view.getUint8(8) & 0x7f) << 7)  |  (view.getUint8(9) & 0x7f);
  let offset = 10;
  const end = Math.min(10 + tagSize, view.byteLength);
  const tags = {};
  const decUtf   = new TextDecoder('utf-8');
  const decUtf16 = new TextDecoder('utf-16');
  const decLatin = new TextDecoder('latin1');

  while (offset + 10 < end) {
    const frameId = String.fromCharCode(
      view.getUint8(offset), view.getUint8(offset+1),
      view.getUint8(offset+2), view.getUint8(offset+3)
    );
    if (!/^[A-Z0-9]{4}$/.test(frameId)) break;
    let frameSize;
    if (major === 4) {
      frameSize = ((view.getUint8(offset+4) & 0x7f) << 21) | ((view.getUint8(offset+5) & 0x7f) << 14)
                | ((view.getUint8(offset+6) & 0x7f) << 7)  | (view.getUint8(offset+7) & 0x7f);
    } else {
      frameSize = view.getUint32(offset+4);
    }
    if (frameSize <= 0 || offset + 10 + frameSize > end) break;
    const fdStart = offset + 10;

    if (frameId.startsWith('T')) {
      try {
        const enc = view.getUint8(fdStart);
        const bytes = new Uint8Array(buf, fdStart + 1, frameSize - 1);
        let text;
        if (enc === 0) text = decLatin.decode(bytes);
        else if (enc === 1) text = decUtf16.decode(bytes);
        else if (enc === 2) text = decUtf16.decode(bytes);
        else text = decUtf.decode(bytes);
        text = text.replace(/\0+$/g, '').replace(/^\uFEFF/, '').trim();
        if (frameId === 'TIT2') tags.title = text;
        if (frameId === 'TPE1') tags.artist = text;
        if (frameId === 'TPE2') tags.albumArtist = text;
        if (frameId === 'TALB') tags.album = text;
        if (frameId === 'TYER' || frameId === 'TDRC') tags.year = text.slice(0, 4);
        if (frameId === 'TCON') tags.genre = text.replace(/^\(?\d+\)?/, '').trim() || text;
        if (frameId === 'TRCK') tags.track = text;
        if (frameId === 'TPOS') tags.disc = text;
      } catch {}
    } else if (frameId === 'APIC') {
      try {
        // Scan for JPEG (FF D8 FF) or PNG (89 50 4E 47) magic bytes within the frame.
        // This is more robust than parsing the APIC header fields manually.
        const frameEnd = Math.min(fdStart + frameSize, buf.byteLength);
        const frameBytes = new Uint8Array(buf, fdStart, frameEnd - fdStart);
        for (let i = 0; i < frameBytes.length - 3; i++) {
          const isJpeg = frameBytes[i] === 0xFF && frameBytes[i+1] === 0xD8 && frameBytes[i+2] === 0xFF;
          const isPng  = frameBytes[i] === 0x89 && frameBytes[i+1] === 0x50 && frameBytes[i+2] === 0x4E;
          if (isJpeg || isPng) {
            const mime = isJpeg ? 'image/jpeg' : 'image/png';
            const imgSlice = buf.slice(fdStart + i, frameEnd);
            const blob = new Blob([imgSlice], { type: mime });
            tags.coverArt = await new Promise(res => {
              const fr = new FileReader();
              fr.onload  = () => res(fr.result);
              fr.onerror = () => res(null);
              fr.readAsDataURL(blob);
            });
            break;
          }
        }
      } catch {}
    }
    offset = fdStart + frameSize;
  }

  // Fallback: brute-force scan the entire ID3 section for JPEG/PNG magic bytes.
  // Covers cases where the APIC frame was skipped or the loop broke early.
  if (!tags.coverArt) {
    const tagEnd = Math.min(10 + tagSize, buf.byteLength);
    const tagView = new Uint8Array(buf, 0, tagEnd);
    for (let i = 10; i < tagView.length - 3; i++) {
      const isJpeg = tagView[i] === 0xFF && tagView[i+1] === 0xD8 && tagView[i+2] === 0xFF;
      const isPng  = tagView[i] === 0x89 && tagView[i+1] === 0x50 && tagView[i+2] === 0x4E;
      if (isJpeg || isPng) {
        const mime = isJpeg ? 'image/jpeg' : 'image/png';
        const blob = new Blob([buf.slice(i, tagEnd)], { type: mime });
        tags.coverArt = await new Promise(res => {
          const fr = new FileReader();
          fr.onload  = () => res(fr.result);
          fr.onerror = () => res(null);
          fr.readAsDataURL(blob);
        });
        break;
      }
    }
  }

  return tags;
}

// readID3: lee etiquetas ID3. Para URLs de API solo descarga el primer MB (las
// etiquetas siempre están al principio); para data URLs descarga todo en memoria.
async function readID3(src) {
  try {
    const opts = src.startsWith('data:') ? {} : { headers: { Range: 'bytes=0-1048575' } };
    const resp = await fetch(src, opts);
    const buf  = await resp.arrayBuffer();
    return _parseID3Buffer(buf);
  } catch { return {}; }
}

let _catIconRegistry = {};
function getCatIcon(cat) { return _catIconRegistry[cat] || null; }

// ─── ICONOS ────────────────────────────────────────────────────
// Componentes SVG inline para no depender de librerías de iconos externas.
function CameraGlyph({ size = 48 }) {
  const sw = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.5, strokeLinejoin: 'miter' };
  const f = { fill: 'currentColor' };
  return (
    <svg width={size} height={size} viewBox="0 0 40 40">
      <path d="M12 12 L15 7 L25 7 L28 12" {...sw} />
      <rect x="3" y="12" width="34" height="22" {...sw} />
      <circle cx="20" cy="23" r="7" {...sw} />
      <circle cx="20" cy="23" r="2.5" {...f} />
      <rect x="6" y="14" width="4" height="2" {...f} />
      <rect x="30" y="14" width="3" height="2" {...f} />
    </svg>
  );
}

const ICON_LIBRARY = [
  { id:'codigo',       label:'CÓDIGO',     group:'TECH' },
  { id:'terminal',     label:'TERMINAL',   group:'TECH' },
  { id:'database',     label:'DATABASE',   group:'TECH' },
  { id:'server',       label:'SERVIDOR',   group:'TECH' },
  { id:'wifi',         label:'WIFI',       group:'TECH' },
  { id:'cpu',          label:'CPU',        group:'TECH' },
  { id:'disco',        label:'DISCO',      group:'TECH' },
  { id:'monitor',      label:'MONITOR',    group:'TECH' },
  { id:'nube',         label:'NUBE',       group:'TECH' },
  { id:'buscar',       label:'BUSCAR',     group:'TECH' },
  { id:'configuracion',label:'CONFIG',     group:'TECH' },
  { id:'descarga',     label:'DESCARGA',   group:'TECH' },
  { id:'retro',        label:'RETRO',      group:'JUEGOS' },
  { id:'cartas',       label:'CARTAS',     group:'JUEGOS' },
  { id:'dados',        label:'DADOS',      group:'JUEGOS' },
  { id:'trofeo',       label:'TROFEO',     group:'JUEGOS' },
  { id:'espada',       label:'ESPADA',     group:'JUEGOS' },
  { id:'joystick',     label:'JOYSTICK',   group:'JUEGOS' },
  { id:'vinyl',        label:'VINYL',      group:'MÚSICA' },
  { id:'cassette',     label:'CASSETTE',   group:'MÚSICA' },
  { id:'guitarra',     label:'GUITARRA',   group:'MÚSICA' },
  { id:'piano',        label:'PIANO',      group:'MÚSICA' },
  { id:'auriculares',  label:'AURICULAR',  group:'MÚSICA' },
  { id:'microfono',    label:'MICRO',      group:'MÚSICA' },
  { id:'nota',         label:'NOTA',       group:'MÚSICA' },
  { id:'camara',       label:'CÁMARA',     group:'MEDIA' },
  { id:'pelicula',     label:'PELÍCULA',   group:'MEDIA' },
  { id:'claqueta',     label:'CLAQUETA',   group:'MEDIA' },
  { id:'libro',        label:'LIBRO',      group:'DOCS' },
  { id:'sobre',        label:'SOBRE',      group:'DOCS' },
  { id:'recibo',       label:'RECIBO',     group:'DOCS' },
  { id:'notepad',      label:'NOTAS',      group:'DOCS' },
  { id:'archivo',      label:'CARPETA',    group:'DOCS' },
  { id:'paleta',       label:'PALETA',     group:'ARTE' },
  { id:'pincel',       label:'PINCEL',     group:'ARTE' },
  { id:'atomo',        label:'ÁTOMO',      group:'CIENCIA' },
  { id:'cohete',       label:'COHETE',     group:'CIENCIA' },
  { id:'tubo',         label:'TUBO',       group:'CIENCIA' },
  { id:'microscopio',  label:'MICROSCOPIO',group:'CIENCIA' },
  { id:'planta',       label:'PLANTA',     group:'NATURE' },
  { id:'fuego',        label:'FUEGO',      group:'NATURE' },
  { id:'agua',         label:'AGUA',       group:'NATURE' },
  { id:'montaña',      label:'MONTAÑA',    group:'NATURE' },
  { id:'llave',        label:'LLAVE',      group:'OBJETOS' },
  { id:'candado',      label:'CANDADO',    group:'OBJETOS' },
  { id:'engranaje',    label:'ENGRANAJE',  group:'OBJETOS' },
  { id:'herramienta',  label:'WRENCH',     group:'OBJETOS' },
  { id:'mochila',      label:'MOCHILA',    group:'OBJETOS' },
  { id:'corona',       label:'CORONA',     group:'OBJETOS' },
  { id:'maletin',      label:'MALETÍN',    group:'OBJETOS' },
  { id:'dinero',       label:'DINERO',     group:'OBJETOS' },
  { id:'usuario',      label:'USUARIO',    group:'PERSONAS' },
  { id:'grupo',        label:'GRUPO',      group:'PERSONAS' },
  { id:'privado',      label:'PRIVADO',    group:'PERSONAS' },
  { id:'mail',         label:'MAIL',       group:'COM' },
  { id:'chat',         label:'CHAT',       group:'COM' },
  { id:'megafono',     label:'MEGÁFONO',   group:'COM' },
  { id:'campana',      label:'CAMPANA',    group:'COM' },
  { id:'compartir',    label:'COMPARTIR',  group:'COM' },
  { id:'avion',        label:'AVIÓN',      group:'VIAJE' },
  { id:'carro',        label:'CARRO',      group:'VIAJE' },
  { id:'mapa',         label:'MAPA',       group:'VIAJE' },
  { id:'grafico',      label:'GRÁFICO',    group:'DATOS' },
  { id:'calendario',   label:'CALENDAR',   group:'DATOS' },
  { id:'reloj',        label:'RELOJ',      group:'DATOS' },
  { id:'calavera',     label:'CALAVERA',   group:'ESPECIAL' },
  { id:'estrella',     label:'ESTRELLA',   group:'ESPECIAL' },
  { id:'corazon',      label:'CORAZÓN',    group:'ESPECIAL' },
  { id:'rayo',         label:'RAYO',       group:'ESPECIAL' },
  { id:'bomba',        label:'BOMBA',      group:'ESPECIAL' },
  { id:'alien',        label:'ALIEN',      group:'ESPECIAL' },
  { id:'flag',         label:'BANDERA',    group:'ESPECIAL' },
  { id:'tag',          label:'ETIQUETA',   group:'ESPECIAL' },
];

function IconGlyph({ iconId, size = 40 }) {
  const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.5, strokeLinejoin: 'miter' };
  const f = { fill: 'currentColor', stroke: 'none' };
  const p = { width: size, height: size, viewBox: '0 0 40 40' };
  switch (iconId) {
    case 'codigo':    return <svg {...p}><polyline points="14,10 6,20 14,30" {...s}/><polyline points="26,10 34,20 26,30" {...s}/></svg>;
    case 'terminal':  return <svg {...p}><rect x="4" y="8" width="32" height="24" rx="2" {...s}/><polyline points="10,18 16,22 10,26" {...s}/><line x1="18" y1="26" x2="28" y2="26" {...s}/></svg>;
    case 'database':  return <svg {...p}><ellipse cx="20" cy="10" rx="12" ry="4" {...s}/><path d="M8 10 V26 Q8 30 20 30 Q32 30 32 26 V10" {...s}/><path d="M8 18 Q8 22 20 22 Q32 22 32 18" {...s}/></svg>;
    case 'server':    return <svg {...p}><rect x="6" y="6" width="28" height="8" rx="1" {...s}/><rect x="6" y="16" width="28" height="8" rx="1" {...s}/><rect x="6" y="26" width="28" height="8" rx="1" {...s}/><circle cx="29" cy="10" r="1.5" {...f}/><circle cx="29" cy="20" r="1.5" {...f}/><circle cx="29" cy="30" r="1.5" {...f}/></svg>;
    case 'wifi':      return <svg {...p}><path d="M4 18 Q20 6 36 18" {...s}/><path d="M9 23 Q20 14 31 23" {...s}/><path d="M14 28 Q20 22 26 28" {...s}/><circle cx="20" cy="32" r="2" {...f}/></svg>;
    case 'cpu':       return <svg {...p}><rect x="12" y="12" width="16" height="16" {...s}/><rect x="15" y="15" width="10" height="10" {...s}/><line x1="15" y1="4" x2="15" y2="12" {...s}/><line x1="20" y1="4" x2="20" y2="12" {...s}/><line x1="25" y1="4" x2="25" y2="12" {...s}/><line x1="15" y1="28" x2="15" y2="36" {...s}/><line x1="20" y1="28" x2="20" y2="36" {...s}/><line x1="25" y1="28" x2="25" y2="36" {...s}/><line x1="4" y1="15" x2="12" y2="15" {...s}/><line x1="4" y1="20" x2="12" y2="20" {...s}/><line x1="4" y1="25" x2="12" y2="25" {...s}/><line x1="28" y1="15" x2="36" y2="15" {...s}/><line x1="28" y1="20" x2="36" y2="20" {...s}/><line x1="28" y1="25" x2="36" y2="25" {...s}/></svg>;
    case 'disco':     return <svg {...p}><rect x="6" y="4" width="28" height="32" rx="2" {...s}/><rect x="12" y="4" width="12" height="10" {...s}/><rect x="14" y="6" width="4" height="6" {...f}/><rect x="10" y="20" width="20" height="12" rx="1" {...s}/><line x1="14" y1="24" x2="26" y2="24" {...s}/></svg>;
    case 'monitor':   return <svg {...p}><rect x="4" y="6" width="32" height="22" rx="2" {...s}/><line x1="4" y1="22" x2="36" y2="22" {...s}/><path d="M16 28 L15 34 L25 34 L24 28" {...s}/><line x1="12" y1="34" x2="28" y2="34" {...s}/></svg>;
    case 'nube':      return <svg {...p}><path d="M8 28 Q4 28 4 22 Q4 16 10 16 Q10 8 18 8 Q26 8 28 16 Q34 14 36 20 Q38 28 30 28 Z" {...s}/></svg>;
    case 'buscar':    return <svg {...p}><circle cx="16" cy="16" r="10" {...s}/><line x1="24" y1="24" x2="34" y2="34" stroke="currentColor" strokeWidth="3.5" strokeLinecap="square"/></svg>;
    case 'configuracion': return <svg {...p}><line x1="4" y1="10" x2="36" y2="10" {...s}/><line x1="4" y1="20" x2="36" y2="20" {...s}/><line x1="4" y1="30" x2="36" y2="30" {...s}/><circle cx="14" cy="10" r="3" fill="none" stroke="currentColor" strokeWidth="2.5"/><circle cx="26" cy="20" r="3" fill="none" stroke="currentColor" strokeWidth="2.5"/><circle cx="18" cy="30" r="3" fill="none" stroke="currentColor" strokeWidth="2.5"/></svg>;
    case 'descarga':  return <svg {...p}><line x1="20" y1="4" x2="20" y2="26" {...s}/><polyline points="12,18 20,26 28,18" {...s}/><line x1="8" y1="34" x2="32" y2="34" {...s}/></svg>;
    case 'retro':     return <svg {...p}><rect x="8" y="6" width="24" height="30" rx="2" {...s}/><rect x="14" y="6" width="12" height="8" {...s}/><rect x="12" y="18" width="16" height="12" rx="1" {...s}/><line x1="16" y1="22" x2="24" y2="22" {...s}/><line x1="16" y1="26" x2="24" y2="26" {...s}/></svg>;
    case 'cartas':    return <svg {...p}><rect x="6" y="8" width="18" height="24" rx="2" {...s}/><rect x="14" y="10" width="18" height="24" rx="2" {...s}/><line x1="18" y1="18" x2="28" y2="18" {...s}/><line x1="18" y1="24" x2="26" y2="24" {...s}/></svg>;
    case 'dados':     return <svg {...p}><rect x="4" y="4" width="18" height="18" rx="3" {...s}/><circle cx="9" cy="9" r="1.5" {...f}/><circle cx="17" cy="17" r="1.5" {...f}/><rect x="16" y="18" width="18" height="18" rx="3" {...s}/><circle cx="20" cy="22" r="1.5" {...f}/><circle cx="30" cy="22" r="1.5" {...f}/><circle cx="20" cy="30" r="1.5" {...f}/><circle cx="30" cy="30" r="1.5" {...f}/></svg>;
    case 'trofeo':    return <svg {...p}><path d="M12 4 H28 V18 Q28 28 20 30 Q12 28 12 18 Z" {...s}/><path d="M12 10 Q6 10 6 16 Q6 22 12 22" {...s}/><path d="M28 10 Q34 10 34 16 Q34 22 28 22" {...s}/><line x1="20" y1="30" x2="20" y2="34" {...s}/><line x1="13" y1="34" x2="27" y2="34" {...s}/></svg>;
    case 'espada':    return <svg {...p}><line x1="20" y1="4" x2="20" y2="30" {...s}/><polyline points="14,22 20,28 26,22" {...s}/><line x1="12" y1="18" x2="28" y2="18" {...s}/><rect x="17" y="28" width="6" height="8" rx="1" {...s}/></svg>;
    case 'joystick':  return <svg {...p}><circle cx="20" cy="10" r="6" {...s}/><line x1="20" y1="16" x2="20" y2="28" {...s}/><ellipse cx="20" cy="32" rx="12" ry="4" {...s}/><circle cx="20" cy="10" r="2" {...f}/></svg>;
    case 'vinyl':     return <svg {...p}><circle cx="20" cy="20" r="15" {...s}/><circle cx="20" cy="20" r="6" {...s}/><circle cx="20" cy="20" r="2" {...f}/></svg>;
    case 'cassette':  return <svg {...p}><rect x="4" y="10" width="32" height="20" rx="3" {...s}/><circle cx="13" cy="20" r="4" {...s}/><circle cx="27" cy="20" r="4" {...s}/><circle cx="13" cy="20" r="1.5" {...f}/><circle cx="27" cy="20" r="1.5" {...f}/><path d="M17 20 Q20 17 23 20" {...s}/></svg>;
    case 'guitarra':  return <svg {...p}><ellipse cx="20" cy="28" rx="10" ry="8" {...s}/><circle cx="20" cy="28" r="2" {...f}/><line x1="20" y1="20" x2="20" y2="6" {...s}/><line x1="14" y1="10" x2="26" y2="10" {...s}/><line x1="14" y1="24" x2="26" y2="24" {...s}/><circle cx="20" cy="6" r="3" {...s}/></svg>;
    case 'piano':     return <svg {...p}><rect x="4" y="10" width="32" height="20" rx="2" {...s}/><line x1="4" y1="24" x2="36" y2="24" {...s}/><rect x="9" y="10" width="4" height="10" rx="1" {...f}/><rect x="17" y="10" width="4" height="10" rx="1" {...f}/><rect x="23" y="10" width="4" height="10" rx="1" {...f}/><rect x="31" y="10" width="4" height="10" rx="1" {...f}/></svg>;
    case 'auriculares': return <svg {...p}><path d="M8 20 Q8 6 20 6 Q32 6 32 20" {...s}/><rect x="6" y="18" width="6" height="10" rx="3" {...s}/><rect x="28" y="18" width="6" height="10" rx="3" {...s}/></svg>;
    case 'microfono': return <svg {...p}><rect x="14" y="4" width="12" height="18" rx="6" {...s}/><path d="M8 20 Q8 30 20 30 Q32 30 32 20" {...s}/><line x1="20" y1="30" x2="20" y2="36" {...s}/><line x1="14" y1="36" x2="26" y2="36" {...s}/></svg>;
    case 'nota':      return <svg {...p}><ellipse cx="13" cy="30" rx="6" ry="4" transform="rotate(-10 13 30)" {...s}/><ellipse cx="27" cy="26" rx="6" ry="4" transform="rotate(-10 27 26)" {...s}/><line x1="18" y1="29" x2="18" y2="10" {...s}/><line x1="32" y1="25" x2="32" y2="6" {...s}/><line x1="18" y1="10" x2="32" y2="6" {...s}/></svg>;
    case 'camara':    return <svg {...p}><path d="M12 12 L15 7 L25 7 L28 12" {...s}/><rect x="3" y="12" width="34" height="22" {...s}/><circle cx="20" cy="23" r="7" {...s}/><circle cx="20" cy="23" r="2.5" {...f}/></svg>;
    case 'pelicula':  return <svg {...p}><rect x="4" y="8" width="32" height="24" {...s}/><rect x="4" y="8" width="6" height="24" {...s}/><rect x="30" y="8" width="6" height="24" {...s}/><rect x="6" y="10" width="2" height="4" {...f}/><rect x="6" y="18" width="2" height="4" {...f}/><rect x="6" y="26" width="2" height="4" {...f}/><rect x="32" y="10" width="2" height="4" {...f}/><rect x="32" y="18" width="2" height="4" {...f}/><rect x="32" y="26" width="2" height="4" {...f}/></svg>;
    case 'claqueta':  return <svg {...p}><rect x="4" y="14" width="32" height="22" {...s}/><rect x="4" y="6" width="32" height="8" {...s}/><line x1="10" y1="6" x2="14" y2="14" {...s}/><line x1="18" y1="6" x2="22" y2="14" {...s}/><line x1="26" y1="6" x2="30" y2="14" {...s}/></svg>;
    case 'libro':     return <svg {...p}><path d="M6 4 H26 Q30 4 30 8 V34 Q30 38 26 38 H6 V4 Z" {...s}/><line x1="6" y1="4" x2="6" y2="38" {...s}/><line x1="10" y1="14" x2="26" y2="14" {...s}/><line x1="10" y1="20" x2="26" y2="20" {...s}/><line x1="10" y1="26" x2="20" y2="26" {...s}/></svg>;
    case 'sobre':     return <svg {...p}><rect x="4" y="10" width="32" height="22" rx="2" {...s}/><polyline points="4,12 20,22 36,12" {...s}/></svg>;
    case 'recibo':    return <svg {...p}><path d="M6 4 V36 L10 32 L14 36 L18 32 L22 36 L26 32 L30 36 L34 32 L34 4 Z" {...s}/><line x1="12" y1="14" x2="28" y2="14" {...s}/><line x1="12" y1="20" x2="28" y2="20" {...s}/><line x1="12" y1="26" x2="22" y2="26" {...s}/></svg>;
    case 'notepad':   return <svg {...p}><rect x="8" y="6" width="24" height="30" rx="2" {...s}/><line x1="14" y1="14" x2="26" y2="14" {...s}/><line x1="14" y1="20" x2="26" y2="20" {...s}/><line x1="14" y1="26" x2="22" y2="26" {...s}/><line x1="14" y1="6" x2="14" y2="2" stroke="currentColor" strokeWidth="3"/><line x1="20" y1="6" x2="20" y2="2" stroke="currentColor" strokeWidth="3"/><line x1="26" y1="6" x2="26" y2="2" stroke="currentColor" strokeWidth="3"/></svg>;
    case 'archivo':   return <svg {...p}><path d="M4 10 H14 L18 6 H36 V32 H4 Z" {...s}/><line x1="4" y1="18" x2="36" y2="18" {...s}/></svg>;
    case 'paleta':    return <svg {...p}><path d="M20 4 Q32 4 36 16 Q40 28 30 34 Q26 36 22 32 Q18 28 14 30 Q8 32 6 26 Q2 18 8 10 Q12 4 20 4 Z" {...s}/><circle cx="14" cy="12" r="2.5" {...f}/><circle cx="22" cy="8" r="2.5" {...f}/><circle cx="30" cy="12" r="2.5" {...f}/><circle cx="32" cy="22" r="2.5" {...f}/></svg>;
    case 'pincel':    return <svg {...p}><line x1="8" y1="6" x2="26" y2="24" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/><path d="M26 24 L32 30 Q36 36 28 36 Q22 36 22 30 Z" {...s}/></svg>;
    case 'atomo':     return <svg {...p}><circle cx="20" cy="20" r="3" {...f}/><ellipse cx="20" cy="20" rx="16" ry="6" {...s}/><ellipse cx="20" cy="20" rx="16" ry="6" transform="rotate(60 20 20)" {...s}/><ellipse cx="20" cy="20" rx="16" ry="6" transform="rotate(-60 20 20)" {...s}/></svg>;
    case 'cohete':    return <svg {...p}><path d="M20 4 Q28 8 30 20 L30 28 L20 34 L10 28 L10 20 Q12 8 20 4 Z" {...s}/><circle cx="20" cy="18" r="4" {...s}/><path d="M10 26 L6 34 L14 30" {...f}/><path d="M30 26 L34 34 L26 30" {...f}/></svg>;
    case 'tubo':      return <svg {...p}><path d="M14 4 L14 28 Q14 36 20 36 Q26 36 26 28 L26 4" {...s}/><line x1="12" y1="8" x2="28" y2="8" {...s}/><line x1="14" y1="22" x2="26" y2="22" {...s}/></svg>;
    case 'microscopio': return <svg {...p}><line x1="20" y1="34" x2="32" y2="34" {...s}/><line x1="26" y1="34" x2="26" y2="28" {...s}/><ellipse cx="18" cy="26" rx="8" ry="3" {...s}/><rect x="14" y="10" width="8" height="16" rx="2" {...s}/><rect x="16" y="4" width="4" height="6" rx="1" {...s}/><path d="M8 28 Q6 22 10 16" {...s}/></svg>;
    case 'planta':    return <svg {...p}><line x1="20" y1="36" x2="20" y2="18" {...s}/><path d="M20 26 Q14 20 8 22 Q12 14 20 18 Z" {...f}/><path d="M20 22 Q26 14 34 16 Q30 24 20 22 Z" {...f}/><ellipse cx="20" cy="36" rx="6" ry="2" {...s}/></svg>;
    case 'fuego':     return <svg {...p}><path d="M20 36 Q8 28 10 18 Q12 10 18 8 Q16 14 20 16 Q20 10 24 6 Q30 12 28 20 Q32 16 30 12 Q36 20 32 28 Q30 36 20 36 Z" {...s}/><path d="M20 36 Q14 28 16 22 Q18 18 20 20 Q22 18 24 22 Q26 28 20 36 Z" {...f}/></svg>;
    case 'agua':      return <svg {...p}><path d="M4 14 Q8 8 12 14 Q16 20 20 14 Q24 8 28 14 Q32 20 36 14" {...s}/><path d="M4 22 Q8 16 12 22 Q16 28 20 22 Q24 16 28 22 Q32 28 36 22" {...s}/><path d="M4 30 Q8 24 12 30 Q16 36 20 30 Q24 24 28 30 Q32 36 36 30" {...s}/></svg>;
    case 'montaña':   return <svg {...p}><polygon points="20,6 36,34 4,34" {...s}/><polygon points="14,22 20,10 26,22" fill="currentColor" stroke="none" opacity="0.5"/></svg>;
    case 'llave':     return <svg {...p}><circle cx="12" cy="18" r="8" {...s}/><circle cx="12" cy="18" r="3.5" {...s}/><line x1="20" y1="18" x2="36" y2="18" {...s}/><line x1="32" y1="18" x2="32" y2="24" {...s}/><line x1="28" y1="18" x2="28" y2="22" {...s}/></svg>;
    case 'candado':   return <svg {...p}><rect x="8" y="18" width="24" height="18" rx="3" {...s}/><path d="M13 18 V12 Q13 4 20 4 Q27 4 27 12 V18" {...s}/><circle cx="20" cy="27" r="3" {...s}/><line x1="20" y1="30" x2="20" y2="33" {...s}/></svg>;
    case 'engranaje': return <svg {...p}><circle cx="20" cy="20" r="8" {...s}/><circle cx="20" cy="20" r="3" {...f}/><rect x="18" y="4" width="4" height="7" {...f}/><rect x="18" y="29" width="4" height="7" {...f}/><rect x="4" y="18" width="7" height="4" {...f}/><rect x="29" y="18" width="7" height="4" {...f}/></svg>;
    case 'herramienta': return <svg {...p}><path d="M8 32 L24 16 Q26 8 34 8 Q30 12 32 16 Q36 20 28 24 Q24 26 20 22 L6 36 Z" {...s}/></svg>;
    case 'mochila':   return <svg {...p}><rect x="8" y="12" width="24" height="24" rx="4" {...s}/><path d="M14 12 Q14 6 20 6 Q26 6 26 12" {...s}/><line x1="8" y1="20" x2="32" y2="20" {...s}/><rect x="16" y="20" width="8" height="6" rx="1" {...s}/></svg>;
    case 'corona':    return <svg {...p}><polygon points="4,28 4,16 12,22 20,8 28,22 36,16 36,28" {...s}/><line x1="4" y1="28" x2="36" y2="28" {...s}/><circle cx="12" cy="24" r="2" {...f}/><circle cx="20" cy="20" r="2" {...f}/><circle cx="28" cy="24" r="2" {...f}/></svg>;
    case 'maletin':   return <svg {...p}><rect x="4" y="14" width="32" height="22" rx="3" {...s}/><path d="M14 14 V10 Q14 6 20 6 Q26 6 26 10 V14" {...s}/><line x1="4" y1="24" x2="36" y2="24" {...s}/></svg>;
    case 'dinero':    return <svg {...p}><circle cx="20" cy="20" r="14" {...s}/><line x1="20" y1="10" x2="20" y2="30" {...s}/><path d="M14 14 Q20 12 24 16 Q26 20 24 24 Q20 28 14 26" {...s}/></svg>;
    case 'usuario':   return <svg {...p}><circle cx="20" cy="12" r="7" {...s}/><path d="M6 36 Q6 24 20 24 Q34 24 34 36" {...s}/></svg>;
    case 'grupo':     return <svg {...p}><circle cx="13" cy="12" r="5" {...s}/><path d="M3 30 Q3 22 13 22 Q19 22 21 26" {...s}/><circle cx="27" cy="12" r="5" {...s}/><path d="M37 30 Q37 22 27 22 Q21 22 19 26" {...s}/></svg>;
    case 'privado':   return <svg {...p}><path d="M20 4 L34 10 V22 Q34 32 20 36 Q6 32 6 22 V10 Z" {...s}/><polyline points="14,20 18,25 27,14" stroke="currentColor" strokeWidth="2.5" fill="none"/></svg>;
    case 'mail':      return <svg {...p}><circle cx="20" cy="20" r="7" {...s}/><path d="M27 20 Q27 28 20 28 Q10 28 10 20 Q10 10 20 10 Q30 10 30 20 L30 24" {...s}/></svg>;
    case 'chat':      return <svg {...p}><path d="M6 6 H34 Q36 6 36 8 V24 Q36 26 34 26 H18 L10 34 L12 26 H6 Q4 26 4 24 V8 Q4 6 6 6 Z" {...s}/><line x1="12" y1="14" x2="28" y2="14" {...s}/><line x1="12" y1="20" x2="22" y2="20" {...s}/></svg>;
    case 'megafono':  return <svg {...p}><path d="M8 14 L8 26 L18 26 L34 34 L34 6 L18 14 Z" {...s}/><path d="M8 26 L6 34" {...s}/></svg>;
    case 'campana':   return <svg {...p}><path d="M20 4 Q12 4 10 14 L8 28 H32 L30 14 Q28 4 20 4 Z" {...s}/><path d="M16 28 Q16 34 20 34 Q24 34 24 28" {...s}/></svg>;
    case 'compartir': return <svg {...p}><circle cx="32" cy="8" r="4" {...s}/><circle cx="32" cy="32" r="4" {...s}/><circle cx="8" cy="20" r="4" {...s}/><line x1="12" y1="20" x2="28" y2="10" {...s}/><line x1="12" y1="20" x2="28" y2="30" {...s}/></svg>;
    case 'avion':     return <svg {...p}><path d="M20 4 L34 24 L24 22 L22 34 L20 28 L18 34 L16 22 L6 24 Z" {...s}/></svg>;
    case 'carro':     return <svg {...p}><path d="M4 22 L10 14 H30 L36 22 V30 H4 Z" {...s}/><circle cx="11" cy="30" r="4" {...s}/><circle cx="29" cy="30" r="4" {...s}/><circle cx="11" cy="30" r="1.5" {...f}/><circle cx="29" cy="30" r="1.5" {...f}/><path d="M13 14 L11 20 H29 L27 14" {...s}/></svg>;
    case 'mapa':      return <svg {...p}><polygon points="4,8 14,4 26,10 36,6 36,32 26,36 14,30 4,34" {...s}/><line x1="14" y1="4" x2="14" y2="30" {...s}/><line x1="26" y1="10" x2="26" y2="36" {...s}/></svg>;
    case 'grafico':   return <svg {...p}><rect x="6" y="20" width="6" height="14" {...s}/><rect x="15" y="12" width="6" height="22" {...s}/><rect x="24" y="6" width="6" height="28" {...s}/><line x1="4" y1="34" x2="36" y2="34" {...s}/><line x1="4" y1="34" x2="4" y2="4" {...s}/></svg>;
    case 'calendario': return <svg {...p}><rect x="4" y="8" width="32" height="28" rx="2" {...s}/><line x1="4" y1="16" x2="36" y2="16" {...s}/><line x1="13" y1="4" x2="13" y2="12" stroke="currentColor" strokeWidth="3"/><line x1="27" y1="4" x2="27" y2="12" stroke="currentColor" strokeWidth="3"/><rect x="10" y="20" width="4" height="4" {...f}/><rect x="18" y="20" width="4" height="4" {...f}/><rect x="26" y="20" width="4" height="4" {...f}/><rect x="10" y="28" width="4" height="4" {...f}/><rect x="18" y="28" width="4" height="4" {...f}/></svg>;
    case 'reloj':     return <svg {...p}><circle cx="20" cy="20" r="15" {...s}/><line x1="20" y1="20" x2="20" y2="10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square"/><line x1="20" y1="20" x2="28" y2="24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square"/><circle cx="20" cy="20" r="2" {...f}/></svg>;
    case 'calavera':  return <svg {...p}><path d="M10 22 Q6 16 8 10 Q10 4 20 4 Q30 4 32 10 Q34 16 30 22 L30 28 H10 Z" {...s}/><rect x="12" y="28" width="16" height="8" rx="2" {...s}/><line x1="16" y1="28" x2="16" y2="36" {...s}/><line x1="20" y1="28" x2="20" y2="36" {...s}/><line x1="24" y1="28" x2="24" y2="36" {...s}/><circle cx="14" cy="16" r="4" {...s}/><circle cx="26" cy="16" r="4" {...s}/></svg>;
    case 'estrella':  return <svg {...p}><polygon points="20,4 24,14 36,14 26,22 30,34 20,26 10,34 14,22 4,14 16,14" {...s}/></svg>;
    case 'corazon':   return <svg {...p}><path d="M20 34 Q4 22 4 14 Q4 6 12 6 Q16 6 20 10 Q24 6 28 6 Q36 6 36 14 Q36 22 20 34 Z" {...s}/></svg>;
    case 'rayo':      return <svg {...p}><polygon points="22,4 12,22 20,22 18,36 28,18 20,18" {...s}/></svg>;
    case 'bomba':     return <svg {...p}><circle cx="18" cy="24" r="12" {...s}/><line x1="28" y1="14" x2="34" y2="8" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/><circle cx="32" cy="6" r="2" {...f}/></svg>;
    case 'alien':     return <svg {...p}><ellipse cx="20" cy="18" rx="12" ry="14" {...s}/><ellipse cx="14" cy="14" rx="4" ry="5" {...f}/><ellipse cx="26" cy="14" rx="4" ry="5" {...f}/><line x1="14" y1="6" x2="12" y2="2" {...s}/><line x1="26" y1="6" x2="28" y2="2" {...s}/><path d="M14 24 Q20 28 26 24" {...s}/></svg>;
    case 'flag':      return <svg {...p}><line x1="8" y1="4" x2="8" y2="36" {...s}/><polygon points="8,6 34,14 8,22" {...s}/></svg>;
    case 'tag':       return <svg {...p}><path d="M6 6 H22 L36 20 L22 34 H6 Z" {...s}/><circle cx="14" cy="14" r="3" {...f}/></svg>;
    default:          return <svg {...p}><polygon points="20,4 36,14 36,28 20,38 4,28 4,14" {...s}/><circle cx="20" cy="21" r="5" {...f}/></svg>;
  }
}

function CategoryGlyph({ cat, size = 40 }) {
  const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.5, strokeLinejoin: 'miter' };
  const f = { fill: 'currentColor', stroke: 'none' };
  const props = { width: size, height: size, viewBox: "0 0 40 40" };
  switch (cat) {
    case 'JUEGOS':
      return <svg {...props}><rect x="4" y="14" width="32" height="18" rx="6" {...s}/><rect x="12" y="20" width="2" height="6" {...f}/><rect x="9" y="22" width="8" height="2" {...f}/><circle cx="27" cy="20" r="1.4" {...f}/><circle cx="30" cy="23" r="1.4" {...f}/><circle cx="27" cy="26" r="1.4" {...f}/><circle cx="24" cy="23" r="1.4" {...f}/></svg>;
    case 'MÚSICA':
      return <svg {...props}><circle cx="20" cy="20" r="15" {...s}/><circle cx="20" cy="20" r="10" {...s}/><circle cx="20" cy="20" r="5" {...f}/><circle cx="20" cy="20" r="1.5" fill="#08070a"/></svg>;
    case 'DOCUMENTOS':
      return <svg {...props}><path d="M8 4 L26 4 L34 12 L34 36 L8 36 Z" {...s}/><path d="M26 4 L26 12 L34 12" {...s}/><line x1="14" y1="20" x2="28" y2="20" {...s}/><line x1="14" y1="26" x2="28" y2="26" {...s}/><line x1="14" y1="32" x2="22" y2="32" {...s}/></svg>;
    case 'IMÁGENES':
      return <svg {...props}><rect x="4" y="6" width="32" height="28" {...s}/><circle cx="14" cy="16" r="3" {...f}/><path d="M4 28 L14 20 L22 26 L30 18 L36 24 L36 34 L4 34 Z" {...f}/></svg>;
    case 'VIDEOS':
      return <svg {...props}><rect x="4" y="10" width="22" height="20" {...s}/><polygon points="26,16 36,10 36,30 26,24" {...f}/></svg>;
    case 'OTROS':
      return <svg {...props}><circle cx="20" cy="20" r="14" {...s}/><text x="20" y="26" textAnchor="middle" fill="currentColor" fontSize="14" fontFamily="monospace">?</text></svg>;
    default: {
      const iconId = getCatIcon(cat);
      if (iconId && iconId !== 'default') return <IconGlyph iconId={iconId} size={size} />;
      return <svg {...props}><polygon points="20,4 36,14 36,28 20,38 4,28 4,14" {...s}/><circle cx="20" cy="21" r="5" {...f}/></svg>;
    }
  }
}
function NavGlyph({ kind }) {
  const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinejoin: 'miter' };
  const f = { fill: 'currentColor' };
  const p = { width: 14, height: 14, viewBox: "0 0 24 24", style: { verticalAlign: '-2px', marginRight: 6 } };
  switch (kind) {
    case 'INICIO': return <svg {...p}><path d="M4 12 L12 4 L20 12 V20 H4 Z" {...s}/></svg>;
    case 'SUBIR': return <svg {...p}><path d="M12 4 V18 M6 10 L12 4 L18 10" {...s}/><path d="M4 20 H20" {...s}/></svg>;
    case 'JUEGOS': return <svg {...p}><rect x="3" y="8" width="18" height="10" rx="3" {...s}/><circle cx="8" cy="13" r="1.2" {...f}/><circle cx="16" cy="13" r="1.2" {...f}/></svg>;
    case 'MÚSICA': return <svg {...p}><circle cx="12" cy="12" r="9" {...s}/><circle cx="12" cy="12" r="2.2" {...f}/></svg>;
    case 'DOCUMENTOS': return <svg {...p}><path d="M5 3 H15 L19 7 V21 H5 Z" {...s}/><path d="M15 3 V7 H19" {...s}/></svg>;
    case 'IMÁGENES': return <svg {...p}><rect x="3" y="4" width="18" height="16" {...s}/><circle cx="9" cy="10" r="1.5" {...f}/><path d="M3 17 L9 12 L13 15 L17 11 L21 15 L21 20 L3 20 Z" {...f}/></svg>;
    case 'VIDEOS': return <svg {...p}><rect x="3" y="6" width="13" height="12" {...s}/><polygon points="16,9 21,6 21,18 16,15" {...f}/></svg>;
    case 'OTROS': return <svg {...p}><circle cx="12" cy="12" r="9" {...s}/><circle cx="12" cy="16" r="1" {...f}/><path d="M9 9 Q12 6 15 9 Q15 12 12 13" {...s}/></svg>;
    case 'CREAR': return <svg {...p}><line x1="12" y1="4" x2="12" y2="20" {...s}/><line x1="4" y1="12" x2="20" y2="12" {...s}/></svg>;
    case 'CORAZON': return <svg {...p}><path d="M12 20 Q4 13 4 8 Q4 4 8 4 Q10 4 12 6 Q14 4 16 4 Q20 4 20 8 Q20 13 12 20 Z" {...f}/></svg>;
    case 'GRAFICO': return <svg {...p}><rect x="3" y="12" width="4" height="9" {...f}/><rect x="9" y="8" width="4" height="13" {...f}/><rect x="15" y="4" width="4" height="17" {...f}/><line x1="2" y1="21" x2="22" y2="21" {...s}/></svg>;
    case 'CARPETA': return <svg {...p}><path d="M2 6 H9 L11 4 H20 V18 H2 Z" {...s}/><line x1="2" y1="10" x2="20" y2="10" {...s}/></svg>;
    case 'NOTA': return <svg {...p}><ellipse cx="8" cy="18" rx="4" ry="2.5" transform="rotate(-8 8 18)" {...f}/><ellipse cx="17" cy="15" rx="4" ry="2.5" transform="rotate(-8 17 15)" {...f}/><line x1="11" y1="17" x2="11" y2="6" stroke="currentColor" strokeWidth="1.5"/><line x1="20" y1="14" x2="20" y2="3" stroke="currentColor" strokeWidth="1.5"/><line x1="11" y1="6" x2="20" y2="3" stroke="currentColor" strokeWidth="1.5"/></svg>;
    default: return <svg {...p}><circle cx="12" cy="12" r="4" {...f}/></svg>;
  }
}

// ─── CHROME ────────────────────────────────────────────────────
function StatusBar({ count, totalBytes, localCount = 0, localBytes = 0 }) {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(id); }, []);
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = `${pad(time.getMonth()+1)}.${pad(time.getDate())}.${String(time.getFullYear()).slice(-2)}`;
  const timeStr = `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`;
  const total = count + localCount;
  return (
    <div className="statusbar">
      <div className="left">
        <span><span className="blob"></span> SYSTEM ONLINE</span>
        <span>NODE 01</span>
        <span>
          {total} CANCIÓN{total===1?'':'ES'} :: {fmtBytes(totalBytes)}
          {localCount > 0 && <span style={{color:'var(--fg-dim)', marginLeft:8}}>(Local {localCount} canción{localCount===1?'':'es'}, {fmtBytes(localBytes)})</span>}
        </span>
      </div>
      <div className="right">
        <span>{dateStr}</span>
        <span className="chroma">{timeStr}</span>
      </div>
    </div>
  );
}

function Banner({ onNav }) {
  return (
    <div className="banner" onClick={() => onNav({ page: 'INICIO' })} style={{cursor:'pointer'}}>
      <pre className="ascii-logo chroma">{ASCII_LOGO}</pre>
      <div>
        <div className="banner-title glow">METAL.SYS</div>
        <div className="banner-sub">// Reproductor web by <span style={{color:'var(--fg-primary)'}}>Yeremias</span> \m/</div>
        <div className="banner-sub" style={{fontSize:16, color:'var(--fg-dim)'}}>EST. 27/06/2026 ◆ METAL · HEAVY METAL · TRASH METAL · NU METAL · INDUSTRIAL METAL · ROCK TRANSGRESIVO · ROCK URBANO · ROCK</div>
      </div>
    </div>
  );
}

function Nav({ current, onNav, allCats }) {
  const [dropOpen, setDropOpen] = useState(false);
  const [hiddenCats, setHiddenCats] = useState([]);
  const navLeftRef = useRef(null);
  const dropRef    = useRef(null);
  const visibleRef = useRef(new Set());

  useEffect(() => {
    const navLeft = navLeftRef.current;
    if (!navLeft) return;
    visibleRef.current = new Set();
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const cat = entry.target.dataset.navCat;
        if (!cat) return;
        if (entry.isIntersecting) visibleRef.current.add(cat);
        else visibleRef.current.delete(cat);
      });
      const vis = visibleRef.current;
      setHiddenCats(allCats.filter(c => !vis.has(c)));
    }, { root: navLeft, threshold: 1.0 });
    navLeft.querySelectorAll('[data-nav-cat]').forEach(el => observer.observe(el));
    return () => { observer.disconnect(); visibleRef.current = new Set(); };
  }, [allCats]);

  useEffect(() => {
    if (!dropOpen) return;
    const handler = (e) => { if (!dropRef.current?.contains(e.target)) setDropOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropOpen]);

  const dropActive = hiddenCats.some(c => current.page === 'CAT' && current.cat === c);

  return (
    <nav className="nav">
      {/* Botones de sistema: siempre visibles, nunca ocultados por overflow */}
      <div className="nav-system">
        <span className="prompt glow">C:\&gt;</span>
        <button className={current.page === 'INICIO'   ? 'active' : ''} onClick={() => onNav({ page: 'INICIO' })}><NavGlyph kind="INICIO" />INICIO</button>
        <button className={current.page === 'STATS'    ? 'active' : ''} onClick={() => onNav({ page: 'STATS' })}><NavGlyph kind="GRAFICO" />STATS</button>
        <button className={current.page === 'SUBIR'    ? 'active' : ''} onClick={() => onNav({ page: 'SUBIR' })}><NavGlyph kind="SUBIR" />SUBIR</button>
        <button className={current.page === 'TODO'     ? 'active' : ''} onClick={() => onNav({ page: 'TODO' })}><NavGlyph kind="NOTA" />TODO</button>
        <button className={current.page === 'LOCAL'    ? 'active' : ''} onClick={() => onNav({ page: 'LOCAL' })}><NavGlyph kind="CARPETA" />LOCAL</button>
        <button className={current.page === 'MESGUSTA' ? 'active' : ''} onClick={() => onNav({ page: 'MESGUSTA' })}><NavGlyph kind="CORAZON" />ME GUSTA</button>
        <button className={current.page === 'BANDAS'   ? 'active' : ''} onClick={() => onNav({ page: 'BANDAS' })}><NavGlyph kind="GRAFICO" />BANDAS</button>
      </div>
      {/* Botones de artistas: solo los que caben, el resto en dropdown */}
      <div className="nav-left" ref={navLeftRef}>
        {allCats.map(artist => (
          <button key={artist}
                  data-nav-cat={artist}
                  className={current.page === 'CAT' && current.cat === artist ? 'active' : ''}
                  onClick={() => onNav({ page: 'CAT', cat: artist })}>
            <NavGlyph kind="MÚSICA" />{artist}
          </button>
        ))}
      </div>
      {hiddenCats.length > 0 && (
        <div ref={dropRef} className="nav-more">
          <button className={`nav-more-btn${dropActive ? ' active' : ''}`}
                  onClick={() => setDropOpen(p => !p)}>
            ▼ +{hiddenCats.length}
          </button>
          {dropOpen && (
            <div className="nav-dropdown">
              {hiddenCats.map(artist => (
                <button key={artist}
                        className={current.page === 'CAT' && current.cat === artist ? 'active' : ''}
                        onClick={() => { onNav({ page: 'CAT', cat: artist }); setDropOpen(false); }}>
                  <NavGlyph kind="MÚSICA" />{artist}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </nav>
  );
}

function Marquee() {
  const text = MARQUEE_LINES.join("   ◆◆◆   ");
  return (
    <div className="marquee">
      <span className="marquee-track">{text} &nbsp;&nbsp;&nbsp; {text}</span>
    </div>
  );
}

// ─── PAGE: INICIO ──────────────────────────────────────────────
function HomePage({ files, allCats, onOpenFile, onNav, onPlayArtist, localFiles = [], localDirName = '', onPickFolder, onDisconnectFolder, artistMeta = {} }) {
  const total      = files.reduce((a, f) => a + f.fileSize, 0);
  const localTotal = localFiles.reduce((a, f) => a + (f.fileSize || 0), 0);
  const localSongCount = localFiles.filter(isAudioFile).length;
  const songCount  = [...files, ...localFiles].filter(isAudioFile).length;
  const artistCount = allCats.length;
  const localConnected = localFiles.length > 0 || localDirName;
  const [showAllArtists, setShowAllArtists] = useState(false);
  const ARTIST_LIMIT = 12;

  const [gQuery, setGQuery] = useState('');
  const allFiles = useMemo(() => [...files, ...localFiles], [files, localFiles]);
  const gq = normStr(gQuery.trim());

  const gSuggestions = useMemo(() => {
    if (!gq) return [];
    const artistHits = allCats.filter(a => normStr(a).includes(gq))
      .slice(0, 2).map(a => {
        const cover = allFiles.find(f => (f.artist || f.category) === a && f.thumbnail);
        return { type: 'artist', label: a, thumb: cover?.thumbnail || null };
      });
    const albumMap = new Map();
    allFiles.forEach(f => {
      if (!f.album) return;
      const key = `${f.artist||f.category}::${f.album}`;
      if (!albumMap.has(key) && normStr(f.album).includes(gq)) albumMap.set(key, f);
    });
    const albumHits = [...albumMap.values()].slice(0, 2).map(f => ({ type: 'album', label: f.album, file: f }));
    const songHits = allFiles.filter(f => normStr(f.name).includes(gq))
      .slice(0, 3).map(f => ({ type: 'song', label: f.name, file: f }));
    return [...artistHits, ...albumHits, ...songHits].slice(0, 5);
  }, [gq, allCats, allFiles]);

  return (
    <div>
      <div className="panel">
        <div className="panel-hd">INICIO <span className="dots">━━━━━━━</span></div>
        <div className="panel-body">
          <div className="hero">
            <h2 className="chroma">// METAL.SYS · REPRODUCTOR PERSONAL \m/</h2>
            <p>Biblioteca privada de música. Sube tus MP3 y los metadatos se leerán automáticamente — artista, álbum, pista y portada.</p>
            <p>Biblioteca actual: <span style={{color:'var(--fg-primary)'}}>{songCount} canción{songCount===1?'':'es'}</span> de <span style={{color:'var(--fg-accent)'}}>{artistCount} artista{artistCount===1?'':'s'}</span> ocupando <span style={{color:'var(--fg-success)'}}>{fmtBytes(total + localTotal)}</span>{localSongCount > 0 && <span style={{color:'var(--fg-dim)'}}> · En local {localSongCount} canción{localSongCount===1?'':'es'}, {fmtBytes(localTotal)}</span>}.</p>
            <p style={{marginTop: 16}}>
              <span style={{color:'var(--fg-success)'}}>READY.</span>
              <span className="cursor"></span>
            </p>
          </div>
        </div>
      </div>

      {/* SUBIR + LOCAL */}
      <div className="two-col section">
        <div className="panel">
          <div className="panel-hd">AÑADIR CANCIÓN <span className="dots">/// VAULT</span></div>
          <div className="panel-body">
            <p>Sube un MP3 y los metadatos se detectan solos: artista, álbum, pista, año y portada.</p>
            <p style={{color:'var(--fg-dim)', fontSize:18, marginTop:6}}>Máximo 8 MB por archivo · 25 MB en total.</p>
            <button className="big-btn" style={{marginTop:14}} onClick={() => onNav({ page: 'SUBIR' })}>
              <span style={{verticalAlign:'middle', lineHeight:1}}>♪</span> AÑADIR CANCIÓN
            </button>
          </div>
        </div>

        <div className="panel">
          <div className="panel-hd">MÚSICA LOCAL <span className="dots">/// DISCO</span></div>
          <div className="panel-body">
            {localConnected ? (
              <>
                <p>Carpeta conectada: <span style={{color:'var(--fg-accent)'}}>{localDirName}</span>{localFiles.length > 0 && <> · <span style={{color:'var(--fg-success)'}}>{localFiles.length} canción{localFiles.length===1?'':'es'}</span></>}</p>
                <p style={{color:'var(--fg-dim)', fontSize:18, marginTop:6}}>Archivos leídos directamente del disco — sin límite de tamaño · Sin copias · Sin servidor.</p>
              </>
            ) : (
              <>
                <p>Conecta una carpeta local para reproducir tu biblioteca sin necesidad de subir archivos.</p>
                <p style={{color:'var(--fg-dim)', fontSize:18, marginTop:6}}>Sin límite de tamaño · Sin copias · Sin servidor.</p>
              </>
            )}
            <div style={{display:'flex', gap:8, marginTop:14, flexWrap:'wrap'}}>
              <button className="big-btn"
                      onClick={() => localConnected ? onNav({ page: 'LOCAL' }) : onPickFolder && onPickFolder()}>
                {localConnected ? <><span style={{verticalAlign:'middle', lineHeight:1}}>♪</span> GESTIONAR LOCAL</> : <>📁 CONECTAR CARPETA</>}
              </button>
              {localConnected && (
                <button className="big-btn" style={{background:'transparent', borderColor:'var(--fg-dim)', color:'var(--fg-dim)'}}
                        onClick={() => onDisconnectFolder && onDisconnectFolder()}>
                  ✕ DESCONECTAR
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* BUSCADOR GLOBAL */}
      <div className="section">
        <div className="panel searchbar">
          <div className="panel-hd">BUSCADOR <span className="dots">/// GLOBAL</span></div>
          <div className="panel-body searchbar-body">
            <div className="search-row">
              <input
                className="field-input"
                placeholder="◆ BUSCAR ARTISTAS, DISCOS O CANCIONES..."
                value={gQuery}
                onChange={(e) => setGQuery(e.target.value)}
              />
              {gQuery && <button className="mini-btn alt" onClick={() => setGQuery('')}>✕</button>}
            </div>
            {gq && (
              <div className="search-suggestions">
                {gSuggestions.length === 0 ? (
                  <div className="search-suggestion empty">Sin coincidencias.</div>
                ) : gSuggestions.map((item, idx) => (
                  <button key={idx} className="search-suggestion search-suggestion-anim"
                          style={{ animationDelay: `${idx * 30}ms` }} onClick={() => {
                    setGQuery('');
                    if (item.type === 'artist') onNav({ page: 'CAT', cat: item.label });
                    else if (item.type === 'album') onNav({ page: 'CAT', cat: item.file.artist || item.file.category, album: item.file.album });
                    else onOpenFile(item.file.id);
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="search-suggestion-thumb">
                        {item.type === 'artist'
                          ? (item.thumb ? <img src={item.thumb} alt={item.label} /> : <IconGlyph iconId="nota" size={24} />)
                          : (item.file.thumbnail ? <img src={item.file.thumbnail} alt="" /> : <IconGlyph iconId={item.type === 'album' ? 'disco' : 'nota'} size={24} />)}
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--fg-text)' }}>{item.label}</div>
                        <div style={{ fontFamily: 'var(--pixel)', fontSize: 10, color: 'var(--fg-secondary)', letterSpacing: '0.08em' }}>
                          {item.type === 'artist' ? 'ARTISTA'
                            : item.type === 'album' ? `DISCO · ${item.file.artist || item.file.category || ''}`
                            : `CANCIÓN · ${item.file.artist || item.file.category || ''}`}
                        </div>
                      </div>
                    </div>
                    <span className="search-item-type">
                      {item.type === 'artist' ? 'ARTISTA' : item.type === 'album' ? 'DISCO' : 'CANCIÓN'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ARTISTAS (ancho completo) */}
      <div className="section">
        <div className="panel">
          <div className="panel-hd">ARTISTAS <span className="dots">/// {artistCount}</span></div>
          <div className="panel-body">
            {artistCount === 0 ? (
              <div style={{padding:'24px 0', textAlign:'center', color:'var(--fg-dim)', fontSize:20}}>
                ◇ BIBLIOTECA VACÍA — SUBE TU PRIMER MP3
              </div>
            ) : (
              <>
                <div className="cat-grid">
                  {(showAllArtists ? allCats : allCats.slice(0, ARTIST_LIMIT)).map((artist) => {
                    const allSongs = [...files, ...localFiles].filter(f => (f.artist || f.category) === artist);
                    const albums   = [...new Set(allSongs.map(f => f.album).filter(Boolean))];
                    const cover    = allSongs.find(f => f.thumbnail);
                    return (
                      <div key={artist} className="cat-card" onClick={() => onNav({ page: 'CAT', cat: artist })}>
                        <div className="cat-card-img">
                          {(artistMeta[artist]?.image || cover)
                            ? <img src={artistMeta[artist]?.image || cover?.thumbnail} alt={artist} />
                            : <div className="cat-card-no-cover"><IconGlyph iconId="nota" size={52} /></div>}
                          <button className="cat-card-play" onClick={(e) => { e.stopPropagation(); onPlayArtist(artist); }}>▶</button>
                        </div>
                        <div className="cat-card-info">
                          <div className="cat-name">{artist}</div>
                          <div className="cat-count">{allSongs.length} tema{allSongs.length===1?'':'s'} · {albums.length} disco{albums.length===1?'':'s'}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {artistCount > ARTIST_LIMIT && (
                  <div style={{textAlign:'center', marginTop:14}}>
                    <button className="big-btn" style={{fontSize:14}}
                            onClick={() => setShowAllArtists(p => !p)}>
                      {showAllArtists ? `▲ MOSTRAR MENOS` : `▼ VER ${artistCount - ARTIST_LIMIT} MÁS`}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}

function AllSongsPage({ files, localFiles = [], onOpenFile, onPlayAll }) {
  const allFiles = [...files, ...localFiles].filter(isAudioFile);
  const sorted = [...allFiles].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base' }));
  return (
    <div>
      <div className="panel">
        <div className="panel-hd">TODO <span className="dots">/// {sorted.length} CANCIÓN{sorted.length===1?'':'ES'}</span></div>
        <div className="panel-body">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
            <div>
              <p>Todas las canciones de la biblioteca ordenadas alfabéticamente.</p>
              <p style={{ color:'var(--fg-dim)', fontSize:14 }}>{sorted.length} canción{sorted.length===1?'':'es'} disponibles.</p>
            </div>
            <button className="big-btn" onClick={onPlayAll}>▶ REPRODUCIR TODO</button>
          </div>
        </div>
      </div>
      <div className="section"><div className="panel"><div className="panel-body" style={{padding:0}}>
        {sorted.length === 0
          ? <div style={{padding:'40px 0', textAlign:'center', color:'var(--fg-dim)', fontSize:22}}>◇ Sin canciones todavía</div>
          : sorted.map((f, i) => (
            <div key={f.id}
                 style={{display:'flex', alignItems:'center', gap:10, padding:'8px 14px', borderBottom:'1px dotted rgba(214,31,31,0.15)', cursor:'pointer', background: i%2===0?'transparent':'rgba(214,31,31,0.03)'}}
                 onClick={() => onOpenFile(f.id)}>
              {f.thumbnail
                ? <img src={f.thumbnail} alt="" style={{width:36, height:36, objectFit:'cover', flexShrink:0, borderRadius:2}} />
                : <div style={{width:36, height:36, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(214,31,31,0.08)', borderRadius:2}}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{color:'var(--fg-dim)'}}><ellipse cx="8" cy="18" rx="4" ry="2.5" transform="rotate(-8 8 18)"/><ellipse cx="17" cy="15" rx="4" ry="2.5" transform="rotate(-8 17 15)"/><line x1="11" y1="17" x2="11" y2="6" stroke="currentColor" strokeWidth="1.5"/><line x1="20" y1="14" x2="20" y2="3" stroke="currentColor" strokeWidth="1.5"/><line x1="11" y1="6" x2="20" y2="3" stroke="currentColor" strokeWidth="1.5"/></svg>
                  </div>}
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontFamily:'var(--mono)', fontSize:18, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{f.name}</div>
                <div style={{fontFamily:'var(--pixel)', fontSize:10, color:'var(--fg-secondary)', letterSpacing:'0.08em'}}>{f.artist||f.category}{f.album ? ` · ${f.album}` : ''}</div>
              </div>
            </div>
          ))
        }
      </div></div></div>
    </div>
  );
}

function BandasPage({ artists, files, localFiles = [], onNav, onPlayAll, onPlayArtist, artistMeta = {} }) {
  const allFiles = [...files, ...localFiles];
  const totalSongs = allFiles.filter(isAudioFile).length;
  return (
    <div>
      <div className="panel">
        <div className="panel-hd">TODAS LAS BANDAS <span className="dots">/// {artists.length} ARTISTA{artists.length===1?'':'S'}</span></div>
        <div className="panel-body">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
            <div>
              <p>Reproduce toda la biblioteca o abre la categoría de un artista para ver su colección.</p>
              <p style={{ color:'var(--fg-dim)', fontSize:14 }}>{totalSongs} canción{totalSongs===1?'':'es'} disponibles.</p>
            </div>
            <button className="big-btn" onClick={onPlayAll}>▶ REPRODUCIR TODO</button>
          </div>
        </div>
      </div>

      <div className="cat-grid" style={{marginTop:14}}>
        {artists.map((artist) => {
          const songs = allFiles.filter((f) => (f.artist || f.category) === artist);
          const cover = songs.find((f) => f.thumbnail || f.coverArt);
          const artistImg = artistMeta[artist]?.image || cover?.thumbnail || cover?.coverArt || null;
          return (
            <div key={artist} className="cat-card" onClick={() => onNav({ page: 'CAT', cat: artist })}>
              <div className="cat-card-img">
                {artistImg
                  ? <img src={artistImg} alt={artist} />
                  : <div className="cat-card-no-cover">
                      <svg width="52" height="52" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7z"/></svg>
                    </div>}
                <button className="cat-card-play" onClick={(e) => { e.stopPropagation(); onPlayArtist(artist); }}>▶</button>
              </div>
              <div className="cat-card-info">
                <div className="cat-name">{artist}</div>
                <div className="cat-count">{songs.length} tema{songs.length===1?'':'s'}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── PAGE: SUBIR ───────────────────────────────────────────────
function UploadPage({ allCats, vault, onUpload, onNav, prefillCat, onImportFolder }) {
  const [file, setFile]         = useState(null);
  const [name, setName]         = useState('');
  const [artist, setArtist]     = useState('');
  const [album, setAlbum]       = useState('');
  const [track, setTrack]       = useState('');
  const [disc, setDisc]         = useState('');
  const [year, setYear]         = useState('');
  const [genre, setGenre]       = useState('');
  const [thumb, setThumb]       = useState(null);
  const [coverArt, setCoverArt] = useState(null); // raw data URL from ID3, stored in file entry
  const [drag, setDrag]         = useState(false);
  const [err, setErr]           = useState('');
  const [scanning, setScanning] = useState(false);
  const fileInput  = useRef(null);
  const thumbInput = useRef(null);

  const totalBytes = vault.reduce((a, f) => a + f.fileSize, 0);

  const handleFile = async (f) => {
    if (!f) return;
    setErr('');
    if (f.size > SIZE_CAP) { setErr(`Archivo demasiado grande: ${fmtBytes(f.size)} (máximo 8 MB)`); return; }
    if (totalBytes + f.size > VAULT_CAP) { setErr(`No cabe: agregar ${fmtBytes(f.size)} excedería los 25 MB`); return; }
    setFile(f);

    // Auto-read ID3 for audio files
    if (isAudioFile({ fileName: f.name, fileType: f.type || '' })) {
      setScanning(true);
      try {
        const buf  = await f.arrayBuffer();       // read file bytes directly — no data URL conversion
        const tags = await _parseID3Buffer(buf);
        if (tags.title)  setName(tags.title);
        else             setName(f.name.replace(/\.[^.]+$/, ''));
        if (tags.artist || tags.albumArtist) setArtist(tags.artist || tags.albumArtist || '');
        if (tags.album)  setAlbum(tags.album);
        if (tags.year)   setYear(tags.year);
        if (tags.genre)  setGenre(tags.genre);
        if (tags.track)  setTrack(tags.track);
        if (tags.disc)   setDisc(tags.disc);
        if (tags.coverArt) {
          setCoverArt(tags.coverArt);  // always store raw cover data URL
          if (!thumb) setThumb(tags.coverArt);  // also use as thumb preview
        }
      } catch (e) { console.error('ID3 parse error:', e); }
      setScanning(false);
    } else {
      setName(f.name.replace(/\.[^.]+$/, ''));
    }
  };

  const handleThumb = async (f) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) { setErr('La miniatura debe ser una imagen'); return; }
    try { setThumb(await processThumb(f)); setErr(''); }
    catch { setErr('No se pudo procesar la miniatura'); }
  };

  const submit = () => {
    if (!file)         { setErr('Arrastra o elige un archivo'); return; }
    if (!name.trim())  { setErr('Ponle un nombre a la canción'); return; }
    if (!artist.trim()){ setErr('Indica el artista'); return; }
    onUpload({
      _rawFile: file,
      name:     name.trim(),
      description: [album, year, genre].filter(Boolean).join(' · '),
      category: artist.trim(),   // artista = categoría de nivel 1
      artist:   artist.trim(),
      album:    album.trim(),
      track:    track.trim(),
      disc:     disc.trim(),
      year:     year.trim(),
      genre:    genre.trim(),
      thumbnail: thumb || coverArt,   // thumb = user-chosen or processed; coverArt = raw ID3
      coverArt:  coverArt,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type || 'application/octet-stream',
    });
  };

  const clear = () => {
    setFile(null); setName(''); setArtist(''); setAlbum('');
    setTrack(''); setDisc(''); setYear(''); setGenre(''); setThumb(null); setCoverArt(null); setErr('');
  };

  const isAudio = file && isAudioFile({ fileName: file.name, fileType: file.type || '' });

  return (
    <div>
      <div className="panel">
        <div className="panel-hd">AÑADIR CANCIÓN <span className="dots">━━━━━━━</span></div>
        <div className="panel-body">
          <div>
            {/* FILA SUPERIOR: portada + metadatos */}
            <div style={{display:'grid', gridTemplateColumns:'200px 1fr', gap:16, alignItems:'start', marginBottom:16}}>
              {/* Portada */}
              <div>
                <div className="field-label" style={{marginBottom:6}}>PORTADA <span style={{color:'var(--fg-dim)'}}>· {thumb ? 'DETECTADA' : 'OPCIONAL'}</span></div>
                <div className="thumb-zone" style={{width:'100%', aspectRatio:'1/1'}} onClick={() => thumbInput.current && thumbInput.current.click()}>
                  {thumb
                    ? <img src={thumb} alt="portada" />
                    : <div className="thumb-empty">
                        <IconGlyph iconId="nota" size={44} />
                        <div style={{fontFamily:'var(--pixel)', fontSize:9, color:'var(--fg-dim)', marginTop:6, letterSpacing:'0.08em', textAlign:'center'}}>
                          DEL MP3 O CLICK
                        </div>
                      </div>}
                  <input ref={thumbInput} type="file" accept="image/*" style={{display:'none'}}
                         onChange={(e) => handleThumb(e.target.files[0])} />
                </div>
                {thumb && <button className="mini-btn alt" style={{marginTop:8}} onClick={() => setThumb(null)}>✕ QUITAR PORTADA</button>}
              </div>

              {/* Metadatos */}
              <div>
                <div className="field">
                  <div className="field-label">TÍTULO</div>
                  <input className="field-input" value={name} onChange={(e) => setName(e.target.value)}
                         placeholder="Nombre de la canción..." maxLength={120} />
                </div>
                <div className="field">
                  <div className="field-label">ARTISTA <span style={{color:'var(--fg-primary)'}}>*</span></div>
                  <input className="field-input" value={artist} onChange={(e) => setArtist(e.target.value)}
                         placeholder="Nombre del artista o banda..." maxLength={100} />
                </div>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
                  <div className="field">
                    <div className="field-label">ÁLBUM</div>
                    <input className="field-input" value={album} onChange={(e) => setAlbum(e.target.value)}
                           placeholder="Nombre del álbum..." maxLength={100} />
                  </div>
                  <div className="field">
                    <div className="field-label">AÑO</div>
                    <input className="field-input" value={year} onChange={(e) => setYear(e.target.value)}
                           placeholder="Ej. 1996" maxLength={4} />
                  </div>
                </div>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
                  <div className="field">
                    <div className="field-label">PISTA #</div>
                    <input className="field-input" value={track} onChange={(e) => setTrack(e.target.value)}
                           placeholder="Ej. 4/14" maxLength={10} />
                  </div>
                  <div className="field">
                    <div className="field-label">GÉNERO</div>
                    <input className="field-input" value={genre} onChange={(e) => setGenre(e.target.value)}
                           placeholder="Ej. Heavy Metal" maxLength={60} />
                  </div>
                </div>
              </div>
            </div>

            {/* FILA INFERIOR: dropzone MP3 ancho completo */}
            <div
              className={"dropzone" + (drag ? " drag" : "") + (file ? " has-file" : "")}
              style={{padding:'18px 24px', display:'flex', alignItems:'center', gap:20, justifyContent:'center'}}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
              onClick={() => fileInput.current && fileInput.current.click()}
            >
              <div className="dz-glyph" style={{marginBottom:0}}>
                <IconGlyph iconId="nota" size={40} />
              </div>
              <div>
                <div className="dz-title" style={{marginBottom:2}}>
                  {scanning ? "◆ LEYENDO METADATOS..." : file ? "✓ ARCHIVO LISTO" : drag ? "SUELTA EL MP3 AQUÍ" : "ARRASTRA UN MP3 AQUÍ"}
                </div>
                <div className="dz-sub">
                  {file ? `${file.name} · ${fmtBytes(file.size)}` : "O HAZ CLICK PARA EXPLORAR · MAX 8MB"}
                </div>
              </div>
              <input ref={fileInput} type="file" accept="audio/*" style={{display:'none'}}
                     onChange={(e) => handleFile(e.target.files[0])} />
            </div>

            {err && <div className="dz-err" style={{marginTop:10}}>! {err}</div>}
            <div className="form-actions">
              <button className="big-btn" disabled={scanning} onClick={submit}>
                {scanning ? "◆ LEYENDO..." : "↑ AÑADIR"}
              </button>
              <button className="big-btn ghost" onClick={clear}>✕ LIMPIAR</button>
              <button className="big-btn ghost" onClick={() => onNav({ page: 'INICIO' })}>◀ CANCELAR</button>
            </div>
          </div>
        </div>
      </div>

      {'showDirectoryPicker' in window && (
        <FolderImportSection vault={vault} onUpload={onUpload} />
      )}
    </div>
  );
}

function FolderImportSection({ vault, onUpload }) {
  const [state, setState] = useState('idle'); // idle | scanning | preview | importing | done
  const [dirName, setDirName] = useState('');
  const [found, setFound]     = useState([]);  // [{handle, name, size}]
  const [results, setResults] = useState([]);  // [{name, status, reason?}]
  const totalBytes = vault.reduce((a, f) => a + f.fileSize, 0);

  const pickFolder = async () => {
    try {
      const dh = await window.showDirectoryPicker({ mode: 'read' });
      setDirName(dh.name); setState('scanning'); setFound([]); setResults([]);
      const audioFiles = [];
      const scan = async (handle, path) => {
        for await (const [name, entry] of handle.entries()) {
          if (entry.kind === 'file') {
            const ext = name.split('.').pop().toLowerCase();
            if (/^(mp3|wav|ogg|flac|m4a|aac|opus|aiff|wma)$/.test(ext)) {
              const f = await entry.getFile();
              audioFiles.push({ handle: entry, name, size: f.size });
            }
          } else if (entry.kind === 'directory') {
            await scan(entry, path ? path + '/' + name : name);
          }
        }
      };
      await scan(dh, '');
      setFound(audioFiles); setState('preview');
    } catch (e) {
      if (e.name !== 'AbortError') console.error(e);
      setState('idle');
    }
  };

  const importAll = async () => {
    setState('importing');
    let used = totalBytes;
    const res = [];
    for (const item of found) {
      if (item.size > SIZE_CAP)        { res.push({ name: item.name, status: 'skip', reason: 'max 8 MB' }); continue; }
      if (used + item.size > VAULT_CAP){ res.push({ name: item.name, status: 'skip', reason: 'vault lleno' }); continue; }
      try {
        const file = await item.handle.getFile();
        // Read ID3 tags
        let tags = {};
        try { const ab = await file.slice(0, 1024*1024).arrayBuffer(); tags = await _parseID3Buffer(ab); } catch {}
        await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            onUpload({
              _rawFile: file,
              name:     tags.title  || file.name.replace(/\.[^.]+$/, ''),
              description: [tags.album, tags.year, tags.genre].filter(Boolean).join(' · '),
              category: tags.artist || 'LOCAL',
              artist:   tags.artist || 'LOCAL',
              album:    tags.album  || '',
              track:    tags.track  || '',
              disc:     tags.disc   || '',
              year:     tags.year   || '',
              genre:    tags.genre  || '',
              thumbnail: tags.coverArt || null,
              coverArt:  tags.coverArt || null,
              fileName:  file.name,
              fileSize:  file.size,
              fileType:  file.type || 'audio/mpeg',
            });
            resolve();
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        used += item.size;
        res.push({ name: item.name, status: 'ok' });
      } catch { res.push({ name: item.name, status: 'err' }); }
    }
    setResults(res); setState('done');
  };

  return (
    <div className="panel section">
      <div className="panel-hd">IMPORTAR DESDE CARPETA <span className="dots">━━━</span></div>
      <div className="panel-body">
        <p style={{marginBottom:12, color:'var(--fg-dim)', fontSize:18}}>
          Importa varios archivos de audio a la vez desde una carpeta local. Los archivos se copian al vault (se aplica el límite de 8 MB/archivo y 25 MB total).
        </p>

        {state === 'idle' && (
          <button className="big-btn" onClick={pickFolder}>📁 ELEGIR CARPETA</button>
        )}
        {state === 'scanning' && (
          <div style={{color:'var(--fg-accent)', fontSize:20}}>◆ Escaneando <strong>{dirName}</strong>...</div>
        )}
        {state === 'preview' && (
          <div>
            <p style={{color:'var(--fg-success)', marginBottom:10}}>
              ✓ <strong>{dirName}</strong> — {found.length} archivo{found.length===1?'':'s'} de audio encontrado{found.length===1?'':'s'}
            </p>
            <div style={{display:'flex', gap:10, marginBottom:12, flexWrap:'wrap'}}>
              {found.length > 0 && <button className="big-btn" onClick={importAll}>↑ IMPORTAR TODO</button>}
              <button className="big-btn ghost" onClick={() => { setState('idle'); setFound([]); setDirName(''); }}>✕ CANCELAR</button>
            </div>
            <div className="local-file-list-preview">
              {found.map((f, i) => (
                <div key={i} className="local-file-item-preview">
                  <span style={{flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{f.name}</span>
                  <span style={{color:'var(--fg-dim)', fontFamily:'var(--pixel)', fontSize:9, flexShrink:0}}>{fmtBytes(f.size)}</span>
                  {f.size > SIZE_CAP && <span style={{color:'var(--fg-accent)', fontFamily:'var(--pixel)', fontSize:9}}>omitido</span>}
                </div>
              ))}
            </div>
          </div>
        )}
        {state === 'importing' && (
          <div style={{color:'var(--fg-accent)', fontSize:20}}>◆ Importando archivos...</div>
        )}
        {state === 'done' && (
          <div>
            <p style={{color:'var(--fg-success)', marginBottom:10}}>
              ✓ Completado — {results.filter(r=>r.status==='ok').length} importado{results.filter(r=>r.status==='ok').length===1?'':'s'},
              {' '}{results.filter(r=>r.status==='skip').length} omitido{results.filter(r=>r.status==='skip').length===1?'':'s'}
            </p>
            <div className="local-file-list-preview">
              {results.map((r, i) => (
                <div key={i} className="local-file-item-preview">
                  <span style={{flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{r.name}</span>
                  <span style={{fontFamily:'var(--pixel)', fontSize:9, flexShrink:0,
                    color: r.status==='ok' ? 'var(--fg-success)' : r.status==='skip' ? 'var(--fg-dim)' : 'var(--fg-accent)'}}>
                    {r.status==='ok' ? '✓' : r.status==='skip' ? `omitido (${r.reason})` : '✕ error'}
                  </span>
                </div>
              ))}
            </div>
            <button className="big-btn" style={{marginTop:12}} onClick={() => { setState('idle'); setFound([]); setResults([]); setDirName(''); }}>
              ↺ IMPORTAR OTRA CARPETA
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ALBUM CARD con parallax 3D ───────────────────────────────
function AlbumCard({ album, cat, onOpen, onPlay, rowMode = false, searchMode = false, index = 0 }) {
  const cardRef = useRef(null);
  // Vinilo: reposo = centrado detrás de la portada (tapado por la imagen)
  // Hover  = desliza hacia la derecha y asoma fuera del frame
  const SLIDE_OUT = 'translateY(-50%)';
  const SLIDE_IN  = 'translateY(-50%) translateX(54%)';

  const onEnter = useCallback(() => {
    const vinyl = cardRef.current?.querySelector('.album-card-vinyl');
    if (vinyl) { vinyl.style.transition = 'transform 0.42s cubic-bezier(0.23,1,0.32,1)'; vinyl.style.transform = SLIDE_IN; }
  }, []);

  const onMove = useCallback((e) => {
    const el = cardRef.current; if (!el) return;
    const r  = el.getBoundingClientRect();
    const dx = (e.clientX - r.left - r.width  * 0.5) / (r.width  * 0.5);
    const dy = (e.clientY - r.top  - r.height * 0.5) / (r.height * 0.5);
    el.style.transition = 'box-shadow 0.06s';
    el.style.transform  = `perspective(600px) rotateX(${-dy * 8}deg) rotateY(${dx * 8}deg) translateY(-10px) scale(1.05)`;
    el.style.boxShadow  = `${-dx * 12}px ${-dy * 10}px 40px rgba(214,31,31,0.65), 0 0 24px rgba(214,31,31,0.35)`;
    const vinyl = el.querySelector('.album-card-vinyl');
    if (vinyl) vinyl.style.transform = SLIDE_IN;
  }, []);

  const onLeave = useCallback(() => {
    const el = cardRef.current; if (!el) return;
    el.style.transform = '';
    el.style.boxShadow = '';
    const vinyl = el.querySelector('.album-card-vinyl');
    if (vinyl) { vinyl.style.transition = 'transform 0.42s cubic-bezier(0.23,1,0.32,1)'; vinyl.style.transform = SLIDE_OUT; }
  }, []);

  const coverEl = album.cover
    ? <img className="ac-img" src={album.cover.thumbnail || album.cover.coverArt} alt={album.name} />
    : <div className="ac-img ac-img-empty"><IconGlyph iconId="disco" size={36} /></div>;

  const thumbClass = rowMode ? 'album-card-thumb album-card-row-thumb' : 'album-card-thumb';
  const subtitle   = searchMode
    ? `DISCO · ${album.year || 'SIN AÑO'}`
    : `${album.songs.length} canción${album.songs.length === 1 ? '' : 'es'} · ${album.year || 'SIN AÑO'}`;
  const vinylEl = (
    <div className="album-card-vinyl">
      <div className="ac-vinyl-disc" />
    </div>
  );

  const animStyle = { animationDelay: `${index * 40}ms` };

  if (searchMode) {
    return (
      <button ref={cardRef} className="album-card album-card-anim"
              style={animStyle}
              onClick={() => onOpen(album.name)}
              onMouseEnter={onEnter} onMouseMove={onMove} onMouseLeave={onLeave}>
        <div className={thumbClass}>{vinylEl}{coverEl}</div>
        <div className="album-card-body">
          <div className="album-card-title">{album.name}</div>
          <div className="album-card-sub">{subtitle}</div>
        </div>
      </button>
    );
  }

  return (
    <div ref={cardRef}
         className={`${rowMode ? 'album-card album-card-row' : 'album-card'} album-card-anim`}
         style={animStyle}
         onClick={() => onOpen(album.name)}
         onMouseEnter={onEnter} onMouseMove={onMove} onMouseLeave={onLeave}>
      <div className={thumbClass}>
        {vinylEl}
        {coverEl}
        <button className="ac-play-btn" onClick={(e) => { e.stopPropagation(); onPlay(cat, album.name); }}>▶</button>
      </div>
      <div className="album-card-body">
        <div style={{ minWidth: 0 }}>
          <div className="album-card-title">{album.name}</div>
          <div className="album-card-sub">{subtitle}</div>
        </div>
      </div>
    </div>
  );
}

// ─── PAGE: ARTIST (category = artist) ─────────────────────────
function CategoryPage({ cat, files, onOpenFile, onNav, selectedIds, toggleSel, clearSel, onBulkDownload, onBulkDelete, busy, onPlayArtist, onPlayAlbum, onPlayFile, prefillAlbum, artistMeta = {}, onUpdateArtistMeta }) {
  const list = files.filter((f) => (f.artist || f.category) === cat);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('track-asc');
  const [albumSort, setAlbumSort] = useState('year');
  const [albumDir, setAlbumDir] = useState('desc');
  const [selectedAlbum, setSelectedAlbum] = useState(prefillAlbum || null);
  const [showResults, setShowResults] = useState(false);
  const [showEditArtist, setShowEditArtist] = useState(false);
  const [editImage, setEditImage] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const editImgInput = useRef(null);
  const meta = artistMeta[cat] || {};
  useEffect(() => { if (prefillAlbum) setSelectedAlbum(prefillAlbum); }, [prefillAlbum]);

  const albumObjects = [...new Set(list.map((f) => (f.album || 'SINGLE')).filter(Boolean))]
    .map((name) => {
      const songs = list.filter((f) => (f.album || 'SINGLE') === name);
      const year = songs.find((f) => f.year)?.year || '';
      const cover = songs.find((f) => f.thumbnail || f.coverArt);
      return { name, songs, year, cover };
    })
    .sort((a, b) => {
      let cmp = 0;
      if (albumSort === 'year')  cmp = (parseInt(a.year) || 0) - (parseInt(b.year) || 0);
      else if (albumSort === 'alpha') cmp = a.name.localeCompare(b.name);
      else cmp = a.songs.length - b.songs.length; // songs
      return albumDir === 'asc' ? cmp : -cmp;
    });

  const q = normStr(query.trim());
  const albumMatches = q ? albumObjects.filter((a) => normStr(a.name).includes(q)) : [];
  const songMatches = q ? list.filter((f) => {
    const matchesSongName = normStr(f.name).includes(q);
    const albumName = normStr(f.album || 'SINGLE');
    const albumMatch = albumMatches.some((a) => normStr(a.name) === albumName);
    if (albumMatch) return matchesSongName;
    return matchesSongName || albumName.includes(q);
  }) : [];
  const suggestions = [...albumMatches.map((a) => ({ type: 'album', album: a })), ...songMatches.map((f) => ({ type: 'song', file: f }))].slice(0, 5);

  const searchSongs  = showResults && q ? songMatches  : [];
  const searchAlbums = showResults && q ? albumMatches : [];

  const currentAlbum = selectedAlbum ? albumObjects.find((a) => a.name === selectedAlbum) : null;
  const currentSongs = currentAlbum ? currentAlbum.songs.filter((f) => !q || normStr(f.name).includes(q) || normStr((f.album || 'SINGLE')).includes(q)) : [];
  const sortedSongs = useMemo(() => {
    const arr = [...currentSongs];
    if (sort === 'track-asc') arr.sort(sortByDiscTrack);
    else if (sort === 'name-asc') arr.sort((a, b) => normStr(a.name).localeCompare(normStr(b.name)));
    return arr;
  }, [currentSongs, sort]);

  const openAlbum = (album) => {
    setSelectedAlbum(album);
    setSelAlbums(new Set());
    setShowResults(false);
    setQuery('');
  };

  const clearSearch = () => {
    setQuery('');
    setShowResults(false);
  };

  const submitSearch = () => {
    setShowResults(true);
    setSelectedAlbum(null);
  };

  // Función para guardar la edición del artista
  const saveArtistEdit = () => {
    onUpdateArtistMeta && onUpdateArtistMeta(cat, { image: editImage || meta.image, description: editDesc });
    setShowEditArtist(false);
  };

  // Imagen del artista: meta personalizada > portada de un disco
  const defaultCover = list.find(f => f.thumbnail || f.coverArt);
  const artistImage = meta.image || defaultCover?.thumbnail || defaultCover?.coverArt || null;

  return (
    <div>
      {/* Modal de edición del artista */}
      {showEditArtist && (
        <div className="modal-overlay" onClick={() => setShowEditArtist(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{maxWidth:440}}>
            <div className="modal-hd">EDITAR ARTISTA <span style={{color:'var(--fg-primary)'}}>{cat}</span></div>
            <div className="modal-body">
              <div style={{display:'flex', gap:16, marginBottom:16, alignItems:'start'}}>
                <div>
                  <div className="field-label" style={{marginBottom:6}}>IMAGEN DEL ARTISTA</div>
                  <div className="thumb-zone" style={{width:120, height:120}} onClick={() => editImgInput.current?.click()}>
                    {(editImage || meta.image)
                      ? <img src={editImage || meta.image} alt={cat} style={{width:'100%',height:'100%',objectFit:'cover'}} />
                      : <div className="thumb-empty"><IconGlyph iconId="usuario" size={40} /></div>}
                    <input ref={editImgInput} type="file" accept="image/*" style={{display:'none'}} onChange={async e => {
                      const f = e.target.files[0]; if (!f) return;
                      const url = await readAsDataURL(f); setEditImage(url);
                    }} />
                  </div>
                  {(editImage || meta.image) && (
                    <button className="mini-btn alt" style={{marginTop:6}} onClick={() => setEditImage('')}>✕ QUITAR</button>
                  )}
                </div>
                <div style={{flex:1}}>
                  <div className="field-label">DESCRIPCIÓN / BIO</div>
                  <textarea className="field-input" style={{width:'100%', height:100, resize:'vertical', marginTop:6}}
                            value={editDesc} onChange={e => setEditDesc(e.target.value)}
                            placeholder="Descripción del artista, género, origen..." />
                </div>
              </div>
              <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
                <button className="mini-btn alt" onClick={() => setShowEditArtist(false)}>CANCELAR</button>
                <button className="big-btn" onClick={saveArtistEdit}>✓ GUARDAR</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-hd">
          <span style={{display:'flex', alignItems:'center', gap:10}}>
            {artistImage && (
              <img src={artistImage} alt={cat} style={{width:32, height:32, objectFit:'cover', borderRadius:2, border:'1px solid var(--fg-primary)'}} />
            )}
            <span>{cat}</span>
          </span>
          <span style={{display:'flex', alignItems:'center', gap:8}}>
            <span className="dots">/// {list.length} CANCIÓN{list.length === 1 ? '' : 'ES'}</span>
            <button className="cat-upload-btn" style={{width:'auto', padding:'0 8px', fontSize:10, fontFamily:'var(--pixel)'}}
                    onClick={() => { setEditImage(meta.image||''); setEditDesc(meta.description||''); setShowEditArtist(true); }}>
              ✎ EDITAR
            </button>
          </span>
        </div>
        {meta.description && (
          <div style={{padding:'6px 14px 10px', color:'var(--fg-secondary)', fontSize:17, borderBottom:'1px dotted rgba(214,31,31,0.2)'}}>
            {meta.description}
          </div>
        )}
      </div>

      {list.length > 0 && (
        <div className="section">
          <div className="panel searchbar">
            <div className="panel-hd">BUSCADOR <span className="dots">/// FILTROS</span></div>
            <div className="panel-body searchbar-body">
              <div className="search-row">
                <input
                  className="field-input"
                  placeholder="◆ BUSCAR POR TÍTULO O ÁLBUM..."
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); if (showResults) setShowResults(false); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitSearch(); }}
                />
                <button className="big-btn" onClick={submitSearch}>BUSCAR</button>
                {query && <button className="mini-btn alt" onClick={clearSearch}>✕</button>}
              </div>

              {q && !showResults && (
                <div className="search-suggestions">
                  {suggestions.length === 0 ? (
                    <div className="search-suggestion empty">No hay coincidencias todavía.</div>
                  ) : (
                    suggestions.map((item, idx) => (
                      <button
                        key={idx}
                        className="search-suggestion search-suggestion-anim"
                        style={{ animationDelay: `${idx * 30}ms` }}
                        onClick={() => {
                          if (item.type === 'album') openAlbum(item.album.name);
                          else onOpenFile(item.file.id);
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="search-suggestion-thumb">
                            {item.type === 'album' ? (
                              item.album.cover ? <img src={item.album.cover.thumbnail || item.album.cover.coverArt} alt={item.album.name} /> : <IconGlyph iconId="disco" size={24} />
                            ) : (
                              item.file.thumbnail ? <img src={item.file.thumbnail} alt={item.file.name} /> : <IconGlyph iconId="nota" size={24} />
                            )}
                          </div>
                          <div style={{ textAlign: 'left' }}>
                            <div style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--fg-text)' }}>
                              {item.type === 'album' ? item.album.name : item.file.name}
                            </div>
                            <div style={{ fontFamily: 'var(--pixel)', fontSize: 10, color: 'var(--fg-secondary)', letterSpacing: '0.08em' }}>
                              {item.type === 'album' ? item.album.year || 'DISCO' : 'CANCIÓN'}
                              {item.type === 'song' && item.file.album ? ` · ${item.file.album}` : ''}
                            </div>
                          </div>
                        </div>
                        <span className="search-item-type">{item.type === 'album' ? 'DISCO' : 'CANCIÓN'}</span>
                      </button>
                    ))
                  )}
                </div>
              )}

              <div className="search-filters">
                {!currentAlbum && (
                  <div className="filter-group">
                    <span className="filter-label">ORDENAR</span>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <select className="sort-select" value={albumSort} onChange={e => setAlbumSort(e.target.value)}>
                        <option value="year">AÑO</option>
                        <option value="alpha">ALFABÉTICO</option>
                        <option value="songs">Nº CANCIONES</option>
                      </select>
                      <button className="dir-btn" title={albumDir === 'asc' ? 'Ascendente' : 'Descendente'}
                              onClick={() => setAlbumDir(d => d === 'asc' ? 'desc' : 'asc')}>
                        {albumDir === 'asc' ? '▲' : '▼'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="section">
        {currentAlbum ? (
          <div className="panel">
            <div className="panel-hd">
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button className="cat-upload-btn" style={{ width:'auto', padding:'0 8px', fontSize:11, fontFamily:'var(--pixel)', letterSpacing:'0.08em' }} onClick={() => { setSelectedAlbum(null); setShowResults(false); setQuery(''); }}>◀ VOLVER</button>
                <button className="cat-upload-btn" title="Reproducir disco" onClick={() => onPlayAlbum(cat, currentAlbum.name)}>▶</button>
                <span>{currentAlbum.name}</span>
              </span>
              <span className="dots">/// {currentSongs.length} CANCIÓN{currentSongs.length===1?'':'ES'}</span>
            </div>
            <div className="panel-body">
              {currentSongs.length === 0 ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--fg-dim)', fontSize: 22 }}>
                  ◇ NO HAY CANCIONES PARA ESTE ÁLBUM ◇
                </div>
              ) : (
                <TrackListTable files={sortedSongs} sort={sort} setSort={setSort}
                                onOpen={onOpenFile} onPlay={onPlayFile}
                                selectedIds={selectedIds} toggleSel={toggleSel} />
              )}
            </div>
          </div>
        ) : showResults ? (
          <div className="panel">
            <div className="panel-hd">
              RESULTADOS <span className="dots">/// {searchAlbums.length + searchSongs.length} COINCIDENCIA{searchAlbums.length + searchSongs.length===1?'':'S'}</span>
            </div>
            <div className="panel-body">
              {searchAlbums.length > 0 && (
                <>
                  <div className="field-label" style={{ marginBottom: 10 }}>DISCOS</div>
                  <div className="album-grid">
                    {searchAlbums.map((album, i) => (
                      <AlbumCard key={album.name} album={album} cat={cat}
                                 onOpen={openAlbum} onPlay={onPlayAlbum}
                                 searchMode index={i} />
                    ))}
                  </div>
                </>
              )}
              {searchSongs.length > 0 && (
                <>
                  <div className="field-label" style={{ margin: '24px 0 10px' }}>CANCIONES</div>
                  <TrackListTable files={searchSongs} sort={sort} setSort={setSort}
                                  onOpen={onOpenFile} selectedIds={selectedIds} toggleSel={toggleSel} />
                </>
              )}
              {searchAlbums.length === 0 && searchSongs.length === 0 && (
                <div style={{ padding:'40px 0', textAlign:'center', color:'var(--fg-dim)', fontSize:22 }}>
                  ◇ NO HAY COINCIDENCIAS PARA ESTA BÚSQUEDA ◇
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="album-grid">
            {albumObjects.map((album, i) => (
              <AlbumCard key={album.name} album={album} cat={cat}
                         onOpen={openAlbum} onPlay={onPlayAlbum} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TRACK LIST TABLE (música) ─────────────────────────────────
function TrackListTable({ files, sort, setSort, onOpen, onPlay, selectedIds, toggleSel }) {
  return (
    <div className="file-list-wrap">
      <table className="file-list">
        <thead>
          <tr>
            <th className="col-sel"></th>
            <th className="col-thumb"></th>
            <th onClick={() => setSort(sort === 'track-asc' ? 'name-asc' : 'track-asc')}>#</th>
            <th>TÍTULO</th>
            <th>ÁLBUM</th>
            <th>AÑO</th>
            <th>TAMAÑO</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {files.map((f) => {
            const sel = selectedIds.has(f.id);
            const discNum = f.disc ? parseInt(f.disc) || 1 : null;
            const trackNum = f.track ? f.track.split('/')[0] : '—';
            const trackLabel = (discNum && discNum > 1) ? `${discNum}·${trackNum}` : trackNum;
            return (
              <tr key={f.id} className={sel ? 'sel' : ''} onClick={() => onOpen(f.id)}>
                <td className="col-sel" onClick={(e) => { e.stopPropagation(); toggleSel(f.id); }}>
                  <div className={"checkbox " + (sel ? 'on' : '')}>{sel ? '◉' : '◌'}</div>
                </td>
                <td className="col-thumb">
                  {f.thumbnail
                    ? <img src={f.thumbnail} alt="" style={{width:48,height:48,objectFit:'contain',border:'1px solid var(--fg-primary)',imageRendering:'pixelated'}} />
                    : <div className="list-glyph"><IconGlyph iconId="nota" size={28} /></div>}
                </td>
                <td style={{color:'var(--fg-dim)', fontFamily:'var(--pixel)', fontSize:11, width:36, textAlign:'center'}}>{trackLabel}</td>
                <td>
                  <div className="list-name">{f.name}</div>
                </td>
                <td style={{color:'var(--fg-secondary)', fontSize:18}}>{f.album || '—'}</td>
                <td style={{color:'var(--fg-dim)', fontFamily:'var(--pixel)', fontSize:10}}>{f.year || '—'}</td>
                <td>{fmtBytes(f.fileSize)}</td>
                <td><button className="mini-btn alt" onClick={(e) => { e.stopPropagation(); onPlay ? onPlay(f) : onOpen(f.id); }}>▶</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── FILE CARD (grid item) ─────────────────────────────────────
function FileCard({ file, onClick }) {
  return (
    <div className="file-card" onClick={onClick}>
      <div className="file-card-thumb">
        {(file.coverArt || file.thumbnail)
          ? <img src={file.coverArt || file.thumbnail} alt={file.name} />
          : <div className="file-card-glyph"><IconGlyph iconId="nota" size={56} /></div>}
        <div className="file-card-cat">{file.album || file.artist || file.category}</div>
      </div>
      <div className="file-card-body">
        <div className="file-card-name">{file.name}</div>
        <div className="file-card-meta">
          <span>{fmtBytes(file.fileSize)}</span>
          <span>↓ {file.downloads || 0}</span>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL: CREATE CATEGORY ────────────────────────────────────
const ICON_GROUPS = ['TODOS','TECH','JUEGOS','MÚSICA','MEDIA','DOCS','ARTE','CIENCIA','NATURE','OBJETOS','PERSONAS','COM','VIAJE','DATOS','ESPECIAL'];

function CreateCategoryModal({ onClose, onSubmit, existing }) {
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [selectedIcon, setSelectedIcon] = useState('default');
  const [iconGroup, setIconGroup] = useState('TODOS');

  const visibleIcons = iconGroup === 'TODOS' ? ICON_LIBRARY : ICON_LIBRARY.filter(i => i.group === iconGroup);

  const submit = () => {
    const v = name.trim().toUpperCase();
    if (!v) { setErr("Escribe un nombre"); return; }
    if (v.length > 20) { setErr("Máximo 20 caracteres"); return; }
    if (existing.includes(v)) { setErr("Esa categoría ya existe"); return; }
    onSubmit({ name: v, icon: selectedIcon });
  };
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const selectedLabel = selectedIcon === 'default'
    ? 'SIN ICONO'
    : (ICON_LIBRARY.find(i => i.id === selectedIcon) || {label: selectedIcon}).label;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-hd">
          <span>◆ CREAR CATEGORÍA</span>
          <button className="modal-x" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="field-label">NOMBRE DE LA CATEGORÍA</div>
          <input className="field-input" value={name}
                 onChange={(e) => { setName(e.target.value.slice(0, 20)); setErr(''); }}
                 onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
                 placeholder="EJ. CHEATS, ROMS, FANZINES..."
                 maxLength={20} autoFocus />

          <div style={{marginTop: 14}}>
            <div className="field-label" style={{marginBottom: 6}}>ICONO DE CATEGORÍA</div>

            <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:8}}>
              <div style={{
                width:52, height:52, display:'flex', alignItems:'center', justifyContent:'center',
                border:'1.5px solid var(--fg-primary)', flexShrink:0,
              }}>
                <IconGlyph iconId={selectedIcon} size={36}/>
              </div>
              <div style={{fontSize:13, color:'var(--fg-dim)', fontFamily:'var(--mono)', letterSpacing:1}}>
                {selectedLabel}
              </div>
            </div>

            <div style={{display:'flex', flexWrap:'wrap', gap:3, marginBottom:6}}>
              {ICON_GROUPS.map(g => (
                <button key={g} onClick={() => setIconGroup(g)}
                  style={{
                    fontSize: 9, fontFamily: 'var(--pixel)',
                    padding: '2px 5px', lineHeight: 1.3,
                    background: iconGroup === g ? 'var(--fg-primary)' : 'transparent',
                    color: iconGroup === g ? 'var(--bg)' : 'var(--fg-dim)',
                    border: '1px solid ' + (iconGroup === g ? 'var(--fg-primary)' : 'var(--fg-dim)'),
                    cursor: 'pointer',
                  }}>
                  {g}
                </button>
              ))}
            </div>

            <div style={{
              display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(54px, 1fr))',
              gap:4, maxHeight:220, overflowY:'auto',
              border:'1px solid var(--fg-dim)', padding:4,
            }}>
              {visibleIcons.map(icon => (
                <button key={icon.id} onClick={() => setSelectedIcon(icon.id)}
                  title={icon.label}
                  style={{
                    display:'flex', flexDirection:'column', alignItems:'center', gap:2,
                    padding:'5px 2px',
                    background: selectedIcon === icon.id ? 'var(--fg-primary)' : 'transparent',
                    color: selectedIcon === icon.id ? 'var(--bg)' : 'var(--fg-primary)',
                    border: selectedIcon === icon.id ? '1px solid var(--fg-primary)' : '1px solid transparent',
                    cursor:'pointer',
                  }}>
                  <IconGlyph iconId={icon.id} size={22}/>
                  <span style={{fontSize:7, fontFamily:'var(--pixel)', lineHeight:1, textAlign:'center', maxWidth:50, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{icon.label}</span>
                </button>
              ))}
            </div>
          </div>

          {err && <div className="dz-err" style={{marginTop: 14}}>! {err}</div>}
          <div className="form-actions">
            <button className="big-btn" onClick={submit}>✓ CREAR CATEGORÍA</button>
            <button className="big-btn ghost" onClick={onClose}>✕ CANCELAR</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ZIP TREE ──────────────────────────────────────────────────
function ZipTree({ file }) {
  const [entries, setEntries] = useState(null);
  const [err, setErr] = useState(null);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    if (!window.JSZip) { setErr('Lector ZIP no disponible'); return; }
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(file.fileData);
        const blob = await resp.blob();
        const zip = await window.JSZip.loadAsync(blob);
        const list = [];
        zip.forEach((path, entry) => {
          list.push({
            path,
            dir: entry.dir,
            size: (entry._data && entry._data.uncompressedSize) || 0,
          });
        });
        if (!cancelled) setEntries(list);
      } catch (e) {
        if (!cancelled) setErr('No se pudo leer el ZIP: ' + (e.message || e));
      }
    })();
    return () => { cancelled = true; };
  }, [file.id]);

  if (err) return <div className="dz-err">! {err}</div>;
  if (!entries) return <div style={{color:'var(--fg-dim)', fontSize: 20, padding: 14}}>◇ Leyendo archivo ZIP...</div>;
  if (entries.length === 0) return <div style={{color:'var(--fg-dim)', fontSize: 20, padding: 14}}>◇ ZIP vacío ◇</div>;

  // Build tree
  const root = { children: {}, dir: true };
  for (const e of entries) {
    const parts = e.path.split('/').filter(Boolean);
    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      if (!node.children[part]) {
        node.children[part] = { children: {}, dir: !isLast || e.dir, size: 0 };
      }
      if (isLast && !e.dir) node.children[part].size = e.size;
      node = node.children[part];
    }
  }

  const sortKids = (children) => Object.entries(children).sort(([a, an], [b, bn]) => {
    const ad = an.dir || Object.keys(an.children).length > 0;
    const bd = bn.dir || Object.keys(bn.children).length > 0;
    if (ad !== bd) return ad ? -1 : 1;
    return a.localeCompare(b, undefined, { numeric: true });
  });

  const renderNode = (name, node, path, depth) => {
    const fullPath = path + '/' + name;
    const isDir = node.dir || Object.keys(node.children).length > 0;
    // Top level dirs default open, deeper dirs default closed
    const defaultOpen = depth < 1;
    const isOpen = expanded[fullPath] === undefined ? defaultOpen : expanded[fullPath];
    const kids = isDir ? sortKids(node.children) : [];
    return (
      <div key={fullPath}>
        <div className={"zip-entry " + (isDir ? "is-dir" : "is-file")}
             style={{paddingLeft: 6 + depth * 18}}
             onClick={() => isDir && setExpanded({...expanded, [fullPath]: !isOpen})}>
          <span className="zip-toggle">{isDir ? (isOpen ? '▼' : '▶') : ' '}</span>
          <span className="zip-icon">{isDir ? '▣' : '◇'}</span>
          <span className="zip-name">{name}{isDir ? '/' : ''}</span>
          {!isDir && <span className="zip-size">{fmtBytes(node.size)}</span>}
        </div>
        {isDir && isOpen && kids.map(([k, n]) => renderNode(k, n, fullPath, depth + 1))}
      </div>
    );
  };

  const topKids = sortKids(root.children);
  const fileCount = entries.filter(e => !e.dir).length;
  const dirCount = entries.filter(e => e.dir).length;
  const totalSize = entries.reduce((a, e) => a + (e.size || 0), 0);

  return (
    <div className="zip-tree">
      <div className="zip-stats">
        ◆ {fileCount} ARCHIVO{fileCount===1?'':'S'} · {dirCount} CARPETA{dirCount===1?'':'S'} · {fmtBytes(totalSize)} SIN COMPRIMIR
      </div>
      <div className="zip-list">
        {topKids.map(([k, n]) => renderNode(k, n, '', 0))}
      </div>
    </div>
  );
}

// ─── TEXT PREVIEW ──────────────────────────────────────────────
function TextPreview({ file }) {
  const [state, setState] = useState({ text: null, truncated: false, totalBytes: 0, err: null });
  useEffect(() => {
    try {
      const r = decodeTextFromDataURL(file.fileData);
      setState({ ...r, err: null });
    } catch (e) {
      setState({ text: null, truncated: false, totalBytes: 0, err: 'No se pudo decodificar como texto' });
    }
  }, [file.id]);
  if (state.err) return <div className="dz-err">! {state.err}</div>;
  if (state.text === null) return <div style={{color:'var(--fg-dim)', fontSize: 20, padding: 14}}>◇ Decodificando...</div>;
  return (
    <div>
      <div className="text-stats">
        ◆ {file.fileSize.toLocaleString()} BYTES TOTAL
        {state.truncated && ` · MOSTRANDO PRIMEROS 200 KB`}
      </div>
      <pre className="text-preview">{state.text}{state.truncated ? '\n\n... [archivo truncado] ...' : ''}</pre>
    </div>
  );
}

// ─── MEDIA VIEWERS ─────────────────────────────────────────────
function ImageView({ file }) {
  return (
    <div className="media-view">
      <img className="img-full" src={file.fileData} alt={file.name} />
      <div className="media-meta">
        ◆ {file.fileType || 'image'} · {fmtBytes(file.fileSize)}
      </div>
    </div>
  );
}

function VideoView({ file }) {
  return (
    <div className="media-view">
      <video className="video-el" src={file.fileData} controls
             poster={file.thumbnail || undefined} preload="metadata">
        Tu navegador no soporta video HTML5.
      </video>
      <div className="media-meta">
        ◆ {file.fileType || 'video'} · {fmtBytes(file.fileSize)}
      </div>
    </div>
  );
}

function PdfView({ file }) {
  return (
    <div className="media-view">
      <iframe className="pdf-frame" src={file.fileData} title={file.name}></iframe>
      <div className="media-meta">
        ◆ PDF · {fmtBytes(file.fileSize)} · Si no se ve, descarga el archivo.
      </div>
    </div>
  );
}

function MarkdownPreview({ file }) {
  const [html, setHtml] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    try {
      const r = decodeTextFromDataURL(file.fileData);
      if (window.marked) {
        const out = window.marked.parse(r.text, { breaks: true, gfm: true });
        setHtml(out);
      } else {
        setHtml('<pre>' + r.text.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</pre>');
      }
    } catch (e) { setErr('No se pudo renderizar Markdown'); }
  }, [file.id]);
  if (err) return <div className="dz-err">! {err}</div>;
  if (html === null) return <div style={{color:'var(--fg-dim)', padding:14}}>◇ Renderizando...</div>;
  return <div className="md-preview" dangerouslySetInnerHTML={{ __html: html }} />;
}

// Logarithmic frequency mapping: more bars on bass, compressed highs — matches human hearing
function readVuBars(node, data, barCount) {
  node.getByteFrequencyData(data);
  const bins = node.frequencyBinCount;
  const bars = [];
  for (let i = 0; i < barCount; i++) {
    const lo = Math.floor(Math.pow(bins, i / barCount));
    const hi = Math.max(lo + 1, Math.floor(Math.pow(bins, (i + 1) / barCount)));
    let sum = 0;
    for (let j = lo; j < hi; j++) sum += data[j];
    bars.push(Math.max(4, ((sum / (hi - lo)) / 255) * 95));
  }
  return bars;
}

function useVuBars(analyser, isPlaying, barCount) {
  const [vuData, setVuData] = useState(() => new Array(barCount).fill(4));
  const frameRef = useRef(null);
  useEffect(() => {
    const node = analyser && analyser.current;
    if (!node || !isPlaying) {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      setVuData(new Array(barCount).fill(4));
      return;
    }
    if (node.context.state === 'suspended') node.context.resume().catch(() => {});
    const data = new Uint8Array(node.frequencyBinCount);
    const tick = () => {
      setVuData(readVuBars(node, data, barCount));
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [analyser, isPlaying, barCount]);
  return vuData;
}

function AudioInfo({ file, tags, onPlay, isPlaying, analyser }) {
  const BAR_COUNT = 12;
  const vuData = useVuBars(analyser, isPlaying, BAR_COUNT);
  const cover = file.coverArt || file.thumbnail || (tags && tags.coverArt) || null;

  const artist = (tags && tags.artist) || file.artist || null;
  const title  = (tags && tags.title)  || file.name;
  const album  = (tags && tags.album)  || file.album  || null;
  const year   = (tags && tags.year)   || file.year   || null;
  const genre  = (tags && tags.genre)  || file.genre  || null;

  return (
    <div className="radio-body">
      {/* Frequency display */}
      <div className="radio-top">
        <div className="radio-band-label">AM·FM·SW</div>
        <div className="radio-freq-display">
          <span className="radio-freq-artist">{artist || '— SIN METADATOS —'}</span>
          <div className="radio-freq-title">{title}</div>
        </div>
        <div className="radio-vu">
          {[...vuData].reverse().concat(vuData).map((h, i) => (
            <div key={i} className="radio-vu-bar"
                 style={{height: h + '%', opacity: isPlaying ? 1 : 0.3}}></div>
          ))}
        </div>
      </div>

      {/* Main body: speakers + cover */}
      <div className="radio-mid">
        <div className="radio-grille"></div>
        <div className="radio-window">
          <div className="radio-cover-frame">
            {cover
              ? <img src={cover} alt={file.name} />
              : <div className="radio-cover-empty"><CategoryGlyph cat="MÚSICA" size={72} /></div>}
            <div className="radio-cover-scanlines"></div>
          </div>
        </div>
        <div className="radio-grille"></div>
      </div>

      {/* Info strip — own row above knobs */}
      <div className="radio-info-strip">
        {album && (
          <span className="radio-strip-album">◆ {album}{year ? ' · ' + year : ''}</span>
        )}
        {genre && <span className="radio-strip-genre">{genre}</span>}
        <span className="radio-strip-meta" style={{marginLeft:'auto'}}>{file.fileType || 'audio'} · {fmtBytes(file.fileSize)}</span>
      </div>

      {/* Knobs bar — only play button + decorative knobs */}
      <div className="radio-knobs-bar">
        <div className="radio-knobs-side">
          <div className="radio-knob"></div>
          <div className="radio-knob small"></div>
        </div>
        <button className="radio-play-btn" onClick={onPlay} title={isPlaying ? 'Pausar' : 'Reproducir'}>
          <span>{isPlaying ? "❚❚" : "▶"}</span>
        </button>
        <div className="radio-knobs-side right">
          <div className="radio-knob small"></div>
          <div className="radio-knob"></div>
        </div>
      </div>
    </div>
  );
}
// ─── SEARCH BAR ────────────────────────────────────────────────
function SearchBar({ query, setQuery, ext, setExt, dateRange, setDateRange, sort, setSort, view, setView, allExts }) {
  return (
    <div className="searchbar panel">
      <div className="panel-hd">BUSCADOR <span className="dots">/// FILTROS</span></div>
      <div className="panel-body searchbar-body">
        <div className="search-row">
          <input className="field-input" placeholder="◆ BUSCAR POR NOMBRE, DESCRIPCIÓN O EXTENSIÓN..."
                 value={query} onChange={(e) => setQuery(e.target.value)} />
          {query && <button className="mini-btn alt" onClick={() => setQuery('')}>✕</button>}
        </div>
        <div className="search-filters">
          <div className="filter-group">
            <span className="filter-label">EXT</span>
            <select className="field-input filter-select" value={ext} onChange={(e) => setExt(e.target.value)}>
              <option value="">TODAS</option>
              {allExts.map((e) => <option key={e} value={e}>.{e.toUpperCase()}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <span className="filter-label">FECHA</span>
            <select className="field-input filter-select" value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
              <option value="all">TODO</option>
              <option value="24h">ÚLT. 24H</option>
              <option value="7d">ÚLT. 7 DÍAS</option>
              <option value="30d">ÚLT. 30 DÍAS</option>
              <option value="90d">ÚLT. 90 DÍAS</option>
            </select>
          </div>
          <div className="filter-group">
            <span className="filter-label">ORDEN</span>
            <select className="field-input filter-select" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="date-desc">FECHA ↓</option>
              <option value="date-asc">FECHA ↑</option>
              <option value="name-asc">NOMBRE A-Z</option>
              <option value="name-desc">NOMBRE Z-A</option>
              <option value="size-desc">TAMAÑO ↓</option>
              <option value="size-asc">TAMAÑO ↑</option>
              <option value="dl-desc">DESCARGAS ↓</option>
            </select>
          </div>
          <div className="filter-group">
            <span className="filter-label">VISTA</span>
            <div className="view-toggle">
              <button className={view === 'grid' ? 'on' : ''} onClick={() => setView('grid')}>▦ GRID</button>
              <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>≡ LISTA</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function filterAndSort(files, { query, ext, dateRange, sort }) {
  let out = files;
  if (query.trim()) {
    const q = normStr(query);
    out = out.filter((f) =>
      normStr(f.name).includes(q) ||
      normStr(f.description).includes(q) ||
      normStr(f.fileName).includes(q) ||
      normStr(f.category).includes(q)
    );
  }
  if (ext) out = out.filter((f) => extOf(f) === ext);
  if (dateRange !== 'all') {
    const now = Date.now();
    const cutoff = now - ({
      '24h': 24*60*60*1000,
      '7d': 7*24*60*60*1000,
      '30d': 30*24*60*60*1000,
      '90d': 90*24*60*60*1000,
    }[dateRange] || 0);
    out = out.filter((f) => f.uploadedAt >= cutoff);
  }
  const cmp = {
    'date-desc': (a, b) => b.uploadedAt - a.uploadedAt,
    'date-asc':  (a, b) => a.uploadedAt - b.uploadedAt,
    'name-asc':  (a, b) => a.name.localeCompare(b.name, 'es'),
    'name-desc': (a, b) => b.name.localeCompare(a.name, 'es'),
    'size-desc': (a, b) => b.fileSize - a.fileSize,
    'size-asc':  (a, b) => a.fileSize - b.fileSize,
    'dl-desc':   (a, b) => (b.downloads || 0) - (a.downloads || 0),
  }[sort] || ((a, b) => b.uploadedAt - a.uploadedAt);
  out = [...out].sort(cmp);
  return out;
}

// ─── FILE LIST (table view alternative to grid) ────────────────
function FileListTable({ files, sort, setSort, onOpen, selectedIds, toggleSel }) {
  const SortHdr = ({ k, label }) => {
    const isActive = sort.startsWith(k);
    const dir = isActive ? (sort.endsWith('asc') ? '↑' : '↓') : '';
    const next = (k === 'name')
      ? (sort === 'name-asc' ? 'name-desc' : 'name-asc')
      : (sort === k + '-desc' ? k + '-asc' : k + '-desc');
    return (
      <th className={isActive ? 'active' : ''} onClick={() => setSort(next)}>
        {label} <span className="sort-dir">{dir}</span>
      </th>
    );
  };
  return (
    <div className="file-list-wrap">
      <table className="file-list">
        <thead>
          <tr>
            <th className="col-sel"></th>
            <th className="col-thumb"></th>
            <SortHdr k="name" label="NOMBRE" />
            <SortHdr k="size" label="TAMAÑO" />
            <th>CATEGORÍA</th>
            <SortHdr k="date" label="SUBIDO" />
            <SortHdr k="dl"   label="↓" />
            <th></th>
          </tr>
        </thead>
        <tbody>
          {files.map((f) => {
            const sel = selectedIds.has(f.id);
            return (
              <tr key={f.id} className={sel ? 'sel' : ''}>
                <td className="col-sel" onClick={(e) => { e.stopPropagation(); toggleSel(f.id); }}>
                  <div className={"checkbox " + (sel ? 'on' : '')}>{sel ? '◉' : '◌'}</div>
                </td>
                <td className="col-thumb" onClick={() => onOpen(f.id)}>
                  {f.thumbnail
                    ? <img src={f.thumbnail} alt="" />
                    : <div className="list-glyph"><CategoryGlyph cat={f.category} size={28} /></div>}
                </td>
                <td onClick={() => onOpen(f.id)} className="col-name">
                  <div className="list-name">{f.name}</div>
                  <div className="list-fname">{f.fileName}</div>
                </td>
                <td onClick={() => onOpen(f.id)}>{fmtBytes(f.fileSize)}</td>
                <td onClick={() => onOpen(f.id)} style={{color:'var(--fg-primary)'}}>{f.category}</td>
                <td onClick={() => onOpen(f.id)}>{fmtDate(f.uploadedAt)}</td>
                <td onClick={() => onOpen(f.id)} style={{color:'var(--fg-success)'}}>↓ {f.downloads || 0}</td>
                <td>
                  <button className="mini-btn" onClick={(e) => { e.stopPropagation(); onOpen(f.id); }}>VER</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── MULTI-SELECT FLOATING BAR ─────────────────────────────────
function MultiSelectBar({ selected, files, onClear, onDownloadAll, onDeleteAll, busy }) {
  if (selected.size === 0) return null;
  const totalBytes = files.filter((f) => selected.has(f.id)).reduce((a, f) => a + f.fileSize, 0);
  return (
    <div className="multisel-bar">
      <div className="ms-info">
        <span className="ms-count">◉ {selected.size}</span>
        <span className="ms-meta">SELECCIONADO{selected.size===1?'':'S'} · {fmtBytes(totalBytes)}</span>
      </div>
      <div className="ms-actions">
        <button className="big-btn" onClick={onDownloadAll} disabled={busy}>
          {busy ? "EMPAQUETANDO..." : "↓ DESCARGAR .ZIP"}
        </button>
        <button className="big-btn ghost" onClick={onDeleteAll}>✕ ELIMINAR</button>
        <button className="mini-btn alt" onClick={onClear}>LIMPIAR</button>
      </div>
    </div>
  );
}

// ─── STATS PANEL ───────────────────────────────────────────────
function StatsPanel({ files, allCats }) {
  const total = files.reduce((a, f) => a + f.fileSize, 0);
  const pct = Math.min(100, (total / VAULT_CAP) * 100);
  const dl = files.reduce((a, f) => a + (f.downloads || 0), 0);
  const byCat = allCats.map((c) => {
    const fs = files.filter((f) => f.category === c);
    return { cat: c, count: fs.length, size: fs.reduce((a, f) => a + f.fileSize, 0) };
  });
  const folderColors = ['#ff3b3b', '#ffb347', '#c4ff00', '#5fe0ff', '#e8d8ff', '#a64bff'];
  return (
    <div className="panel">
      <div className="panel-hd">PANEL DE ESTADÍSTICAS <span className="dots">/// VAULT</span></div>
      <div className="panel-body">
        <div className="stats-grid">
          <div className="stat-tile">
            <div className="stat-num">{files.length}</div>
            <div className="stat-lbl">ARCHIVOS</div>
          </div>
          <div className="stat-tile">
            <div className="stat-num">{fmtBytes(total)}</div>
            <div className="stat-lbl">USADO</div>
          </div>
          <div className="stat-tile">
            <div className="stat-num">{fmtBytes(Math.max(0, VAULT_CAP - total))}</div>
            <div className="stat-lbl">LIBRE</div>
          </div>
          <div className="stat-tile">
            <div className="stat-num">↓ {dl}</div>
            <div className="stat-lbl">DESCARGAS</div>
          </div>
        </div>

        <div className="stats-section">
          <div className="player-section-label">TOTAL · {fmtBytes(VAULT_CAP)} · {pct.toFixed(1)}% OCUPADO</div>
          <div className="meter big total-meter">
            {byCat.map((c, i) => {
              const w = (c.size / VAULT_CAP) * 100;
              if (w <= 0) return null;
              const color = folderColors[i % folderColors.length];
              return (
                <div key={c.cat} className="total-meter-seg" title={`${c.cat}: ${fmtBytes(c.size)}`}
                     style={{width: w + '%', background: color, boxShadow: '0 0 6px ' + color}}></div>
              );
            })}
          </div>
          <div className="total-meter-legend">
            {byCat.filter(c => c.size > 0).map((c, i) => {
              const color = folderColors[allCats.indexOf(c.cat) % folderColors.length];
              return (
                <span key={c.cat} className="legend-item" style={{color}}>
                  ■ {c.cat}
                </span>
              );
            })}
            <span className="legend-item" style={{color:'var(--fg-dim)'}}>□ LIBRE</span>
          </div>
        </div>

        <div className="stats-section">
          <div className="player-section-label">POR CATEGORÍA · % DE {fmtBytes(VAULT_CAP)}</div>
          <div className="bar-chart">
            {byCat.map((c, i) => {
              const w = (c.size / VAULT_CAP) * 100;
              const color = folderColors[i % folderColors.length];
              return (
                <div key={c.cat} className="bar-row">
                  <div className="bar-lbl" style={{color}}>{c.cat}</div>
                  <div className="bar-bg">
                    <div className="bar-fill" style={{width: w + '%', background: color, boxShadow: w > 0 ? '0 0 8px ' + color : 'none'}}></div>
                  </div>
                  <div className="bar-val">{fmtBytes(c.size)} <span style={{color:'var(--fg-dim)'}}>· {c.count}</span></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── VU BACKDROP (outside player, behind it) ────────────────────
// Rendered as a sibling of MusicPlayer so its z-index can be LOWER
// than the player (2147483625). The player paints on top, hiding the
// bar overlap at the bottom. Only the portion above the player is visible.
function VUBackdrop({ analyser, isPlaying }) {
  const BAR_COUNT = 90;
  const vuData = useVuBars(analyser, isPlaying, BAR_COUNT);
  return (
    <div className="vu-backdrop" aria-hidden="true">
      {[...vuData.slice(0,-1)].reverse().concat(vuData.slice(0,-1)).map((h, i) => (
        <div key={i} className="vu-backdrop-bar"
             style={{ height: h + '%', opacity: isPlaying ? 1 : 0.18 }} />
      ))}
    </div>
  );
}

// ─── PLAYER ICON SVGs ───────────────────────────────────────────
function IconShuffle({ active }) {
  const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" style={{ opacity: active ? 1 : 0.6 }}>
      {/* arrow 1: left→right (top path) */}
      <polyline points="16,3 21,3 21,8" {...s} />
      <path d="M3 12 Q3 3 12 3 L21 3" {...s} />
      {/* arrow 2: right→left (bottom path) */}
      <polyline points="8,21 3,21 3,16" {...s} />
      <path d="M21 12 Q21 21 12 21 L3 21" {...s} />
      {/* crossing tick marks */}
      <line x1="3" y1="3" x2="9" y2="9" {...s} />
      <line x1="15" y1="15" x2="21" y2="21" {...s} />
    </svg>
  );
}
function IconRepeatOff() {
  const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', opacity: 0.6 };
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <polyline points="17,1 21,5 17,9" {...s} />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" {...s} />
      <polyline points="7,23 3,19 7,15" {...s} />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" {...s} />
    </svg>
  );
}
function IconRepeatAll() {
  const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <polyline points="17,1 21,5 17,9" {...s} />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" {...s} />
      <polyline points="7,23 3,19 7,15" {...s} />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" {...s} />
    </svg>
  );
}
function IconRepeatOne() {
  const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <polyline points="17,1 21,5 17,9" {...s} />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" {...s} />
      <polyline points="7,23 3,19 7,15" {...s} />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" {...s} />
      <text x="12" y="14" textAnchor="middle" fill="currentColor" stroke="none" fontSize="7" fontFamily="var(--pixel)" fontWeight="bold">1</text>
    </svg>
  );
}
function IconVolume({ level }) {
  const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const f = { fill: 'currentColor', stroke: 'none' };
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      {/* speaker body */}
      <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" {...s} />
      {/* wave 1 — always shown */}
      {level > 0.05 && <path d="M15.54 8.46a5 5 0 0 1 0 7.07" {...s} />}
      {/* wave 2 — only when loud */}
      {level > 0.5  && <path d="M19.07 4.93a10 10 0 0 1 0 14.14" {...s} />}
      {/* muted X */}
      {level <= 0.05 && <line x1="23" y1="9" x2="17" y2="15" {...s} />}
      {level <= 0.05 && <line x1="17" y1="9" x2="23" y2="15" {...s} />}
    </svg>
  );
}

// ─── MUSIC PLAYER (persistent bottom bar) ──────────────────────
function MusicPlayer({ track, queue, isPlaying, position, duration, volume, onPlayPause, onSeek, onPrev, onNext, onShuffle, shuffleActive, onRepeat, repeatMode, onVolume, onClose, tags, analyser, onOpenMenu, showMenu, onCloseMenu, onCreateBookmark, onCreateClip, waveform, likedIds, onToggleLike }) {
  if (!track) return null;
  const BAR_COUNT = 90;
  const vuData = useVuBars(analyser, isPlaying, BAR_COUNT);
  const cover = track.coverArt || track.thumbnail || (tags && tags.coverArt) || null;
  const barRef = useRef(null);
  const draggingRef = useRef(false);

  const fmtTime = (s) => {
    if (!s || !isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const ss = Math.floor(s % 60);
    return `${m}:${String(ss).padStart(2, '0')}`;
  };
  const progressPct = duration > 0 ? (position / duration) * 100 : 0;

  const seekFromEvent = useCallback((e) => {
    if (!barRef.current || !duration) return;
    const r = barRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    onSeek(pct * duration);
  }, [duration, onSeek]);

  useEffect(() => {
    const onMove = (e) => { if (draggingRef.current) seekFromEvent(e); };
    const onUp   = () => { draggingRef.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, [seekFromEvent]);

  return (
    <div className="music-player">
      <div className="mp-cover">
        {cover
          ? <img src={cover} alt={track.name} />
          : <div className="mp-cover-empty"><CategoryGlyph cat="MÚSICA" size={36} /></div>}
      </div>
      <div key={track.id} className="mp-info mp-track-anim">
        <div className="mp-title">{(tags && tags.title) || track.name}</div>
        <div className="mp-artist">{(tags && tags.artist) || track.artist || '—'}{tags && tags.album ? ` · ${tags.album}` : ''}</div>
        <div className="mp-progress">
          <span className="mp-time">{fmtTime(position)}</span>
          <div className="mp-bar" ref={barRef}
            onMouseDown={(e) => { draggingRef.current = true; seekFromEvent(e); }}
            style={{cursor: 'pointer'}}>
            {waveform && (
              <svg key={track.id} className="mp-waveform" viewBox={`0 0 ${waveform.length} 2`} preserveAspectRatio="none">
                <polyline points={waveform.map((v,i)=>`${i},${1-v*0.92}`).join(' ')} fill="none" stroke="var(--fg-primary)" strokeWidth="0.06"/>
                <polyline points={waveform.map((v,i)=>`${i},${1+v*0.92}`).join(' ')} fill="none" stroke="var(--fg-primary)" strokeWidth="0.06"/>
              </svg>
            )}
            <div className="mp-bar-fill" style={{width: progressPct + '%'}}></div>
            <div className="mp-bar-knob" style={{left: progressPct + '%'}}></div>
          </div>
          <span className="mp-time">{fmtTime(duration)}</span>
        </div>
      </div>
      <div className="mp-controls">
        <button onClick={onPrev} title="Anterior">◀◀</button>
        <button onClick={onShuffle} title="Aleatorio" style={{lineHeight:0}}><IconShuffle active={shuffleActive} /></button>
        <button onClick={onRepeat} title="Repetir" style={{lineHeight:0}}>
          {repeatMode === 'off' ? <IconRepeatOff /> : repeatMode === 'all' ? <IconRepeatAll /> : <IconRepeatOne />}
        </button>
        <button className="mp-play" onClick={onPlayPause}>{isPlaying ? '❚❚' : '▶'}</button>
        <button onClick={onNext} title="Siguiente">▶▶</button>
      </div>
      <div className="mp-volume">
        <span style={{lineHeight:0, display:'inline-flex'}}><IconVolume level={volume} /></span>
        <input type="range" min="0" max="1" step="0.01" value={volume}
               onChange={(e) => onVolume(parseFloat(e.target.value))} />
      </div>
      <div className="mp-menu-wrap">
        <button className="mp-menu-btn" onClick={onOpenMenu} title="Opciones">···</button>
        {showMenu && (
          <PlayerMenuDropdown
            onCreateBookmark={onCreateBookmark}
            onCreateClip={onCreateClip}
            onClose={onCloseMenu}
          />
        )}
      </div>
      {likedIds && track && (
        <LikeButton fileId={track.id} likedIds={likedIds} onToggle={onToggleLike} />
      )}
      <button className="mp-close" onClick={onClose} title="Cerrar">✕</button>
    </div>
  );
}

// ─── UPLOAD PROGRESS PAGE ──────────────────────────────────────
function UploadProgressPage({ progress }) {
  if (!progress) {
    return (
      <div className="panel">
        <div className="panel-hd">SUBIENDO <span className="dots">━━━</span></div>
        <div className="panel-body">
          <div className="hero">
            <h2 className="chroma">// ESPERANDO ARCHIVO...</h2>
            <p>No hay subida en curso.</p>
          </div>
        </div>
      </div>
    );
  }
  const fmtTime = (ms) => {
    if (!isFinite(ms) || ms < 0) return '—';
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const ss = s % 60;
    return `${m}m ${String(ss).padStart(2,'0')}s`;
  };
  const pct = Math.min(100, Math.max(0, progress.percent));
  return (
    <div className="panel">
      <div className="panel-hd">TRANSFIRIENDO ARCHIVO <span className="dots">/// {pct.toFixed(1)}%</span></div>
      <div className="panel-body">
        <div className="upload-progress">
          <div className="up-headline">
            <div className="up-name">▸ {progress.name}</div>
            <div className="up-sub">{fmtBytes(progress.bytesLoaded)} / {fmtBytes(progress.bytesTotal)}</div>
          </div>

          <div className="up-meter">
            <div className="up-meter-fill" style={{ width: pct + '%' }}></div>
            <div className="up-meter-pct">{pct.toFixed(1)}%</div>
          </div>

          <div className="up-stats">
            <div className="up-stat">
              <div className="up-stat-lbl">VELOCIDAD</div>
              <div className="up-stat-val">{fmtBytes(progress.bytesPerSec)}/s</div>
            </div>
            <div className="up-stat">
              <div className="up-stat-lbl">TRANSCURRIDO</div>
              <div className="up-stat-val">{fmtTime(progress.elapsedMs)}</div>
            </div>
            <div className="up-stat">
              <div className="up-stat-lbl">RESTANTE</div>
              <div className="up-stat-val">{fmtTime(progress.etaMs)}</div>
            </div>
            <div className="up-stat">
              <div className="up-stat-lbl">ESTADO</div>
              <div className="up-stat-val" style={{color: progress.done ? 'var(--fg-success)' : 'var(--fg-accent)'}}>
                {progress.done ? '✓ COMPLETO' : '◆ EN CURSO'}
              </div>
            </div>
          </div>

          <div className="up-ascii">
            <div className="line"><span className="t-prompt">C:\&gt;</span> <span className="t-cmd">upload </span><span className="t-arg">"{progress.name}"</span></div>
            <div className="line"><span className="t-meta">[</span>
              <span className="t-num">{'█'.repeat(Math.floor(progress.percent / 2.5))}</span>
              <span className="t-meta">{'░'.repeat(40 - Math.floor(progress.percent / 2.5))}</span>
              <span className="t-meta">]</span> <span className="t-num">{progress.percent.toFixed(0)}%</span>
            </div>
            {progress.done && <div className="line"><span className="t-prompt">✓</span> <span className="t-cmd">TRANSFER COMPLETE.</span></div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PAGE: DETAIL (player) ─────────────────────────────────────
function DetailPage({ file, onBack, onDownload, onDelete, allCats, onUpdate, onPlayAudio, currentPlayingId, isPlaying, id3Tags, requestID3, analyser, likedIds, onToggleLike, bookmarks, onAddBookmark, onDeleteBookmark, onSeekBookmark, clipStore, onAddClip, onDeleteClip, onPlayClip, onStopClip, activeClip, position }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: file.name, description: file.description, category: file.category });
  const [tab, setTab] = useState('desc');
  useEffect(() => { setDraft({ name: file.name, description: file.description, category: file.category }); }, [file.id]);
  useEffect(() => {
    // Auto-pick a media tab when applicable so the user lands on the preview
    if (isImageFile(file)) setTab('image');
    else if (isVideoFile(file)) setTab('video');
    else if (isAudioFile(file)) setTab('audio');
    else if (isPdfFile(file)) setTab('pdf');
    else if (isMarkdownFile(file)) setTab('md');
    else setTab('desc');
  }, [file.id]);

  const hasText = isTextFile(file);
  const hasZip = isZipFile(file);
  const hasImage = isImageFile(file);
  const hasVideo = isVideoFile(file);
  const hasAudio = isAudioFile(file);
  const hasPdf = isPdfFile(file);
  const hasMd = isMarkdownFile(file);

  useEffect(() => {
    if (hasAudio) requestID3(file);
  }, [file.id]);

  const saveEdit = () => {
    onUpdate({ ...file, name: (draft.name || '').trim() || file.name, description: (draft.description || '').trim(), category: draft.category });
    setEditing(false);
  };

  return (
    <div className="detail-page">
      <div className="panel">
        <div className="panel-hd">
          REPRODUCIENDO AHORA <span className="dots">/// {file.category}</span>
        </div>
        <div className="panel-body">
          <div style={{display:'flex', gap:14, marginBottom: 18, flexWrap:'wrap'}}>
            <button className="mini-btn alt" onClick={onBack}>◀ VOLVER</button>
          </div>

          <div className="player">
            {/* Track info bar */}
            <div className="player-track">
              <div className="vu-bars">
                {Array.from({length: 16}).map((_, i) => <div key={i} className="vu-bar" style={{animationDelay: (i*0.07) + 's'}}></div>)}
              </div>
              <div className="track-title">
                {editing ? (
                  <input className="field-input" value={draft.name} onChange={(e) => setDraft({...draft, name: e.target.value})} />
                ) : file.name}
              </div>
              <div className="track-sub">▶ ARCHIVO ORIGINAL: <span style={{color:'var(--fg-accent)'}}>{file.fileName}</span></div>
            </div>

            {/* Tabs */}
            <div className="tabs">
              {hasImage && <button className={tab === 'image' ? 'active' : ''} onClick={() => setTab('image')}>IMAGEN</button>}
              {hasVideo && <button className={tab === 'video' ? 'active' : ''} onClick={() => setTab('video')}>VÍDEO</button>}
              {hasAudio && <button className={tab === 'audio' ? 'active' : ''} onClick={() => setTab('audio')}>AUDIO</button>}
              {hasPdf   && <button className={tab === 'pdf'   ? 'active' : ''} onClick={() => setTab('pdf')}>PDF</button>}
              {hasMd    && <button className={tab === 'md'    ? 'active' : ''} onClick={() => setTab('md')}>MD</button>}
              <button className={tab === 'desc'  ? 'active' : ''} onClick={() => setTab('desc')}>DESCRIPCIÓN</button>
              <button className={tab === 'specs' ? 'active' : ''} onClick={() => setTab('specs')}>DETALLES</button>
              {hasText && !hasMd && <button className={tab === 'text' ? 'active' : ''} onClick={() => setTab('text')}>TEXTO</button>}
              {hasZip  && <button className={tab === 'tree' ? 'active' : ''} onClick={() => setTab('tree')}>ÁRBOL</button>}
              <button className={tab === 'bookmarks' ? 'active' : ''} onClick={() => setTab('bookmarks')}>MARCADORES</button>
              <button className={tab === 'clips' ? 'active' : ''} onClick={() => setTab('clips')}>CLIPS</button>
            </div>

            {/* Tab content */}
            {tab === 'image' && hasImage && (
              <div className="player-section">
                <div className="player-section-label">VISTA DE IMAGEN</div>
                <ImageView file={file} />
              </div>
            )}

            {tab === 'video' && hasVideo && (
              <div className="player-section">
                <div className="player-section-label">REPRODUCTOR DE VÍDEO</div>
                <VideoView file={file} />
              </div>
            )}

            {tab === 'audio' && hasAudio && (
              <div className="player-section">
                <div className="player-section-label">REPRODUCTOR DE AUDIO</div>
                <AudioInfo file={file} tags={id3Tags}
                           onPlay={() => onPlayAudio(file)}
                           isPlaying={currentPlayingId === file.id && isPlaying}
                           analyser={analyser} />
              </div>
            )}

            {tab === 'pdf' && hasPdf && (
              <div className="player-section">
                <div className="player-section-label">VISOR DE PDF</div>
                <PdfView file={file} />
              </div>
            )}

            {tab === 'md' && hasMd && (
              <div className="player-section">
                <div className="player-section-label">MARKDOWN RENDERIZADO</div>
                <MarkdownPreview file={file} />
              </div>
            )}

            {tab === 'desc' && (
              <div className="player-section">
                <div className="player-section-label">DESCRIPCIÓN</div>
                {editing ? (
                  <textarea className="field-input" value={draft.description}
                            onChange={(e) => setDraft({...draft, description: e.target.value})}
                            rows={5} maxLength={500}></textarea>
                ) : (
                  <div className="player-desc">
                    {file.description || <span style={{color:'var(--fg-dim)'}}>(Sin descripción)</span>}
                  </div>
                )}
                {editing && (
                  <div style={{marginTop: 18}}>
                    <div className="player-section-label">CATEGORÍA</div>
                    <div className="cat-picker">
                      {allCats.map((c) => (
                        <button key={c} className={"cat-pill " + (draft.category === c ? "on" : "")}
                                onClick={() => setDraft({...draft, category: c})}>
                          <CategoryGlyph cat={c} size={18} /><span>{c}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === 'specs' && (
              <div className="player-section">
                <div className="player-section-label">DETALLES TÉCNICOS</div>
                <div className="specs">
                  <div className="spec"><span>NOMBRE ORIG.</span><b style={{wordBreak:'break-all'}}>{file.fileName}</b></div>
                  <div className="spec"><span>TAMAÑO</span><b>{fmtBytes(file.fileSize)}</b></div>
                  <div className="spec"><span>TIPO MIME</span><b>{file.fileType}</b></div>
                  <div className="spec"><span>CATEGORÍA</span><b style={{color:'var(--fg-primary)'}}>{file.category}</b></div>
                  <div className="spec"><span>SUBIDO</span><b>{fmtLongDate(file.uploadedAt)}</b></div>
                  <div className="spec"><span>DESCARGAS</span><b style={{color:'var(--fg-success)'}}>↓ {file.downloads || 0}</b></div>
                  <div className="spec"><span>BYTES</span><b>{file.fileSize.toLocaleString()}</b></div>
                  <div className="spec"><span>ID</span><b style={{fontSize:14}}>{file.id}</b></div>
                </div>
              </div>
            )}

            {tab === 'text' && hasText && !hasMd && (
              <div className="player-section">
                <div className="player-section-label">PREVISUALIZACIÓN DE TEXTO</div>
                <TextPreview file={file} />
              </div>
            )}

            {tab === 'tree' && hasZip && (
              <div className="player-section">
                <div className="player-section-label">CONTENIDO DEL ZIP</div>
                <ZipTree file={file} />
              </div>
            )}

            {tab === 'bookmarks' && (
              <div className="player-section">
                <div className="player-section-label">MARCADORES</div>
                {(bookmarks[file.id]||[]).length === 0
                  ? <div className="bm-empty">◇ Sin marcadores — crea uno desde ··· en el reproductor</div>
                  : <div className="bm-list">
                      {(bookmarks[file.id]||[]).map(bm => (
                        <div key={bm.id} className="bm-item">
                          <span className="bm-name">{bm.name}</span>
                          <span className="bm-time">{fmtTimeSec(bm.time)}</span>
                          <button onClick={() => onSeekBookmark(bm.time)} title="Ir al marcador">▶</button>
                          <button onClick={() => onDeleteBookmark(file.id, bm.id)} title="Eliminar">✕</button>
                        </div>
                      ))}
                    </div>
                }
              </div>
            )}

            {tab === 'clips' && (
              <div className="player-section">
                <div className="player-section-label">CLIPS</div>
                {(clipStore[file.id]||[]).length === 0
                  ? <div className="clip-empty">◇ Sin clips — crea uno desde ··· en el reproductor</div>
                  : <div className="clip-list">
                      {(clipStore[file.id]||[]).map(clip => {
                        const isActive = activeClip && activeClip.id === clip.id;
                        return (
                          <div key={clip.id} className={`clip-item${isActive?' active-clip':''}`}>
                            <span className="clip-name">{clip.name}</span>
                            <span className="clip-range">{fmtTimeSec(clip.start)} → {fmtTimeSec(clip.end)}</span>
                            {isActive
                              ? <button onClick={onStopClip} title="Detener clip">■</button>
                              : <button onClick={() => { onPlayAudio(file); onPlayClip(clip); }} title="Reproducir clip">▶</button>
                            }
                            <button onClick={() => onDeleteClip(file.id, clip.id)} title="Eliminar">✕</button>
                          </div>
                        );
                      })}
                    </div>
                }
              </div>
            )}

            {/* Big action buttons */}
            <div className="player-actions" style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
              {likedIds && <LikeButton fileId={file.id} likedIds={likedIds} onToggle={onToggleLike} />}
              <button className="big-btn" onClick={() => onDownload(file)}>↓ DESCARGAR AHORA</button>
              <button className="big-btn ghost" onClick={() => { if (confirm(`¿Eliminar "${file.name}" de la bóveda?`)) onDelete(file); }}>✕ ELIMINAR</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SIDEBAR WIDGETS ───────────────────────────────────────────

// Cola de reproducción unificada con cassette arriba
function PlayQueueWithNowPlaying({ queue, currentId, currentTrack, isPlaying, onJump, onReorder, onOpen }) {
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  const hasCover = currentTrack && (currentTrack.coverArt || currentTrack.thumbnail);
  const handleDragStart = (i) => setDragIdx(i);
  const handleDragOver  = (e, i) => { e.preventDefault(); setOverIdx(i); };
  const handleDrop = (e, i) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === i) { setDragIdx(null); setOverIdx(null); return; }
    const arr = [...queue]; const [moved] = arr.splice(dragIdx, 1); arr.splice(i, 0, moved);
    onReorder(arr); setDragIdx(null); setOverIdx(null);
  };
  return (
    <div className="play-queue">
      <div className="widget-hd">◆ COLA DE REPRODUCCIÓN <span style={{color:'var(--fg-dim)',fontSize:'8px'}}>· {queue.length}</span></div>
      {/* Cassette con canción actual */}
      <div className={`cassette${!isPlaying ? ' paused' : ''}`}
           onClick={() => currentTrack && onOpen(currentTrack.id)}
           style={{cursor: currentTrack ? 'pointer' : 'default'}}>
        <div className="label">TDK SA-90 ◆ VAULT MASTER ◆ NODE 01</div>
        <div className="reels">
          <div className="reel"></div>
          {hasCover
            ? <img src={currentTrack.coverArt || currentTrack.thumbnail}
                   alt={currentTrack.name}
                   style={{width:56, height:56, objectFit:'cover', border:'1px solid var(--fg-secondary)', flexShrink:0}} />
            : <div style={{width:56, height:56, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--fg-dim)', fontSize:22}}>♪</div>
          }
          <div className="reel"></div>
        </div>
        <div className="track">
          <strong style={{wordBreak:'break-all'}}>
            {currentTrack ? currentTrack.name : '— SIN REPRODUCCIÓN —'}
          </strong>
          <span style={{color:'var(--fg-secondary)'}}>
            {currentTrack
              ? (currentTrack.artist || currentTrack.category || '') + (currentTrack.album ? ' · ' + currentTrack.album : '')
              : 'Reproduce una canción'}
          </span>
        </div>
      </div>
      {/* Lista de cola */}
      <div className="pq-list">
        {queue.length === 0 && <div className="pq-empty">◇ Inicia la reproducción</div>}
        {queue.map((f, i) => (
          <div key={f.id}
            className={`pq-item${f.id===currentId?' pq-current':''}${overIdx===i&&dragIdx!==i?' pq-over':''}${dragIdx===i?' pq-dragging':''}`}
            draggable
            onDragStart={() => handleDragStart(i)}
            onDragOver={e => handleDragOver(e, i)}
            onDrop={e => handleDrop(e, i)}
            onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
            onClick={() => onJump(f)}>
            {f.id===currentId ? <span className="pq-playing-icon">▶</span> : <span className="pq-num">{i+1}</span>}
            <div className="pq-info">
              <div className="pq-name">{f.name}</div>
              <div className="pq-artist">{f.artist||f.category}</div>
            </div>
            <span className="pq-drag-handle">⠿</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Contador de canciones reproducidas (suma de playCounts)
function PlaysCounter({ playCounts }) {
  const total = Object.values(playCounts).reduce((a, v) => a + v, 0);
  const digits = String(total).padStart(7, '0').split('');
  return (
    <div className="widget">
      <div className="panel">
        <div className="panel-hd">CANCIONES REPRODUCIDAS</div>
        <div className="panel-body">
          <div className="counter">
            {digits.map((d, i) => <span key={i} className="digit">{d}</span>)}
          </div>
          <div style={{textAlign:'center', marginTop: 8, fontSize: 17, color: 'var(--fg-dim)'}}>
            {total} ESCUCHA{total===1?'':'S'} EN TOTAL
          </div>
        </div>
      </div>
    </div>
  );
}
// Mapa de tipos de evento a etiquetas y colores legibles
const LOG_LABELS = {
  UP:    { label: 'SUBIDA',     color: 'var(--fg-success)' },
  DL:    { label: 'DESCARGA',   color: 'var(--fg-accent)'  },
  DEL:   { label: 'BORRADO',    color: 'var(--fg-primary)'  },
  PLAY:  { label: 'PLAY',       color: 'var(--fg-primary)'  },
  PAUSE: { label: 'PAUSA',      color: 'var(--fg-dim)'      },
  NEXT:  { label: 'SIGUIENTE',  color: 'var(--fg-secondary)'},
  PREV:  { label: 'ANTERIOR',   color: 'var(--fg-secondary)'},
  LIKE:  { label: '♥ ME GUSTA', color: '#ff2bd6'            },
  UNLIKE:{ label: '♡ QUITADO',  color: 'var(--fg-dim)'     },
};

function RecentActivity({ log }) {
  const logRef = useRef(null);
  const fmtTs = (ts) => {
    if (!ts) return '??:??:??';
    const d = new Date(ts);
    const p = n => String(n).padStart(2, '0');
    return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  };
  // Scroll al fondo cuando llegan nuevas entradas
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log.length]);

  return (
    <div className="widget">
      <div className="panel">
        <div className="panel-hd">ACTIVIDAD <span className="dots">// LOG</span></div>
        <div className="panel-body" style={{padding:0}}>
          <div ref={logRef} className="activity-log">
            {log.length === 0 ? (
              <div className="activity-log-empty">◇ SIN ACTIVIDAD ◇</div>
            ) : [...log].reverse().slice(-50).map((e, i) => {
              const info = LOG_LABELS[e.kind] || { label: e.kind, color: 'var(--fg-dim)' };
              const label = (e.name || e.artist || '').slice(0, 38);
              return (
                <div key={i} className="activity-log-line">
                  <span className="activity-ts">[{fmtTs(e.ts)}]</span>
                  <span className="activity-kind" style={{color: info.color}}>{info.label}</span>
                  <span className="activity-name">— {label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── TERMINAL ──────────────────────────────────────────────────
function Terminal({ files, localFiles = [], allCats }) {
  const allFiles = [...files, ...localFiles];
  const total = allFiles.reduce((a, f) => a + f.fileSize, 0);
  const trunc = (s, n) => s.length > n ? s.slice(0, n - 1) + '…' : s;
  const folderClasses = ['fold-a', 'fold-b', 'fold-c', 'fold-d', 'fold-e', 'fold-f'];

  // Build artist → albums → songs tree
  const byArtist = allCats.map(artist => {
    const songs = allFiles.filter(f => (f.artist || f.category) === artist);
    const albums = [...new Set(songs.map(f => f.album).filter(Boolean))].sort();
    const noAlbum = songs.filter(f => !f.album);
    return { artist, songs, albums, noAlbum };
  });

  const lines = [];
  lines.push(
    <div key="cmd" className="line">
      <span className="t-prompt">C:\&gt;</span>{' '}
      <span className="t-cmd">ls </span>
      <span className="t-arg">/metal.sys/library</span>
      <span className="t-cmd"> --tree</span>
    </div>
  );
  lines.push(<div key="path" className="line"><span className="t-path">\LIBRARY\</span></div>);

  byArtist.forEach((entry, ai) => {
    const isLastArtist = ai === byArtist.length - 1;
    const aElbow = isLastArtist ? '└── ' : '├── ';
    const aBar   = isLastArtist ? '    ' : '│   ';
    const size   = entry.songs.reduce((a, f) => a + f.fileSize, 0);
    const color  = folderClasses[ai % folderClasses.length];

    lines.push(
      <div key={`artist-${ai}`} className="line">
        <span className="t-box">{aElbow}</span>
        <span className={"t-folder " + color}>{entry.artist}/</span>
        <span className="t-meta"> [{entry.songs.length} tema{entry.songs.length===1?'':'s'} · {fmtBytes(size)}]</span>
      </div>
    );

    entry.albums.forEach((album, li) => {
      const albumSongs = entry.songs.filter(f => f.album === album).sort(sortByDiscTrack);
      const isLastAlbum = li === entry.albums.length - 1 && entry.noAlbum.length === 0;
      const albElbow = isLastAlbum ? '└── ' : '├── ';
      const albBar   = isLastAlbum ? '    ' : '│   ';
      const yr = (albumSongs[0] || {}).year;

      lines.push(
        <div key={`album-${ai}-${li}`} className="line">
          <span className="t-box">{aBar}{albElbow}</span>
          <span className="t-folder" style={{color:'var(--fg-secondary)'}}>{album}{yr ? ` (${yr})` : ''}/</span>
        </div>
      );
      albumSongs.forEach((f, fi) => {
        const isLastSong = fi === albumSongs.length - 1;
        const sElbow = isLastSong ? '└── ' : '├── ';
        const trk = f.track ? f.track.split('/')[0].padStart(2,'0') + '. ' : '';
        lines.push(
          <div key={`song-${ai}-${li}-${fi}`} className="line">
            <span className="t-box">{aBar}{albBar}{sElbow}</span>
            <span className="t-file">{trk}{trunc(f.name, 36)}</span>
            <span className="t-meta">  ({fmtBytes(f.fileSize)})</span>
          </div>
        );
      });
    });

    entry.noAlbum.forEach((f, fi) => {
      const isLastSong = fi === entry.noAlbum.length - 1;
      const sElbow = isLastSong ? '└── ' : '├── ';
      lines.push(
        <div key={`noalb-${ai}-${fi}`} className="line">
          <span className="t-box">{aBar}{sElbow}</span>
          <span className="t-file">{trunc(f.name, 40)}</span>
          <span className="t-meta">  ({fmtBytes(f.fileSize)})</span>
        </div>
      );
    });
  });

  lines.push(<div key="blank" className="line">&nbsp;</div>);
  lines.push(
    <div key="summary" className="line">
      <span className="t-num">{allCats.length}</span>{' '}<span className="t-label">artista{allCats.length===1?'':'s'}</span>
      <span className="t-sep"> · </span>
      <span className="t-num">{allFiles.length}</span>{' '}<span className="t-label">canción{allFiles.length===1?'':'es'}</span>
      <span className="t-sep"> · </span>
      <span className="t-num">{fmtBytes(total)}</span>{' '}<span className="t-label">usados</span>
      <span className="t-sep"> · </span>
      <span className="t-num">{fmtBytes(Math.max(0, VAULT_CAP - total))}</span>{' '}<span className="t-label">libres</span>
    </div>
  );
  lines.push(
    <div key="prompt" className="line">
      <span className="t-prompt">C:\&gt;</span>{' '}<span className="caret">▌</span>
    </div>
  );

  return <div className="terminal">{lines}</div>;
}

function Footer() {
  return (
    <div className="footer">
      <div style={{display:'flex', gap: 14, alignItems:'center', flexWrap:'wrap'}}>
        <a href="https://github.com/Yeremias666" target="_blank" rel="noopener noreferrer" className="footer-link" title="GitHub">
          {/* GitHub */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.741 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/></svg>
        </a>
        <a href="https://steamcommunity.com/profiles/76561199511973999/" target="_blank" rel="noopener noreferrer" className="footer-link" title="Steam">
          {/* Steam */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.029 4.524 4.524s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0z"/></svg>
        </a>
        <a href="https://open.spotify.com/user/31dwydgjav2r3s4tglfrx7g63toy" target="_blank" rel="noopener noreferrer" className="footer-link" title="Spotify">
          {/* Spotify */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
        </a>
      </div>
      <div style={{color:'var(--fg-dim)', fontSize:16}}>
        © METAL.SYS 2026 ◆ Reproductor web by Yeremias \m/
      </div>
    </div>
  );
}

// ─── LIBRARY TREE (left sidebar) ───────────────────────────
function LibraryTree({ files, localFiles = [], allCats, onNav, onPlayArtist, onPlayAlbum, onOpenFile, onPlayFile }) {
  const [collapsed, setCollapsed] = useState({});
  const toggle = (key) => setCollapsed(p => ({ ...p, [key]: !p[key] }));
  const allFiles = [...files, ...localFiles];
  const byArtist = allCats.map(artist => {
    const songs = allFiles.filter(f => (f.artist || f.category) === artist);
    const albums = [...new Set(songs.map(f => f.album).filter(Boolean))].sort();
    const noAlbum = songs.filter(f => !f.album).sort(sortByDiscTrack);
    return { artist, songs, albums, noAlbum };
  });
  return (
    <div className="lib-tree-wrap">
      <div className="lib-tree">
        <div className="lib-tree-hd">BIBLIOTECA</div>
        {byArtist.map(({ artist, songs, albums, noAlbum }) => {
          const open = !!collapsed[artist];
          return (
            <div key={artist} className="lib-artist">
              <div className="lib-artist-row" onClick={() => toggle(artist)}>
                <span className="lib-toggle">{open ? '▼' : '▶'}</span>
                <span className="lib-name" onClick={e => { e.stopPropagation(); onNav({ page: 'CAT', cat: artist }); }}>{artist}</span>
                <button className="lib-play" onClick={e => { e.stopPropagation(); onPlayArtist(artist); }}>▶</button>
              </div>
              {open && (
                <div>
                  {albums.map(album => {
                    const aKey = artist + '////' + album;
                    const albumOpen = !!collapsed[aKey];
                    const albumSongs = songs.filter(f => f.album === album).sort(sortByDiscTrack);
                    return (
                      <div key={album}>
                        <div className="lib-album-row" onClick={() => toggle(aKey)}>
                          <span className="lib-toggle">{albumOpen ? '▼' : '▶'}</span>
                          <span className="lib-name lib-album-name" onClick={e => { e.stopPropagation(); onNav({ page: 'CAT', cat: artist, album }); }}>{album}</span>
                          <button className="lib-play" onClick={e => { e.stopPropagation(); onPlayAlbum(artist, album); }}>▶</button>
                        </div>
                        {albumOpen && (
                          <div className="lib-songs">
                            {albumSongs.map(f => (
                              <div key={f.id} className="lib-song-row" onClick={() => onOpenFile(f.id)}>
                                <span className="lib-song-num">{f.track ? f.track.split('/')[0] : '—'}</span>
                                <span className="lib-song-name">{f.name}</span>
                                <button className="lib-play" onClick={e => { e.stopPropagation(); onPlayFile && onPlayFile(f); }}>▶</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {noAlbum.map(f => (
                    <div key={f.id} className="lib-song-row lib-song-direct" onClick={() => onOpenFile(f.id)}>
                      <span className="lib-song-num">◇</span>
                      <span className="lib-song-name">{f.name}</span>
                      <button className="lib-play" onClick={e => { e.stopPropagation(); onPlayFile && onPlayFile(f); }}>▶</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {allCats.length === 0 && <div className="lib-empty">◇ VACÍO</div>}
      </div>
    </div>
  );
}

// ─── PLAY QUEUE (right sidebar) ────────────────────────────
function PlayQueue({ queue, currentId, onJump, onReorder }) {
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  const handleDragStart = (i) => setDragIdx(i);
  const handleDragOver  = (e, i) => { e.preventDefault(); setOverIdx(i); };
  const handleDrop = (e, i) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === i) { setDragIdx(null); setOverIdx(null); return; }
    const arr = [...queue]; const [moved] = arr.splice(dragIdx, 1); arr.splice(i, 0, moved);
    onReorder(arr); setDragIdx(null); setOverIdx(null);
  };
  return (
    <div className="play-queue">
      <div className="widget-hd">◆ COLA DE REPRODUCCIÓN <span style={{color:'var(--fg-dim)',fontSize:'8px'}}>· {queue.length}</span></div>
      <div className="pq-list">
        {queue.length === 0 && <div className="pq-empty">◇ Inicia la reproducción</div>}
        {queue.map((f, i) => (
          <div key={f.id}
            className={`pq-item${f.id===currentId?' pq-current':''}${overIdx===i&&dragIdx!==i?' pq-over':''}${dragIdx===i?' pq-dragging':''}`}
            draggable
            onDragStart={() => handleDragStart(i)}
            onDragOver={e => handleDragOver(e, i)}
            onDrop={e => handleDrop(e, i)}
            onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
            onClick={() => onJump(f)}>
            {f.id===currentId ? <span className="pq-playing-icon">▶</span> : <span className="pq-num">{i+1}</span>}
            <div className="pq-info">
              <div className="pq-name">{f.name}</div>
              <div className="pq-artist">{f.artist||f.category}</div>
            </div>
            <span className="pq-drag-handle">⠿</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── TOP SONGS (right sidebar) ──────────────────────────────
function TopSongs({ files, localFiles = [], playCounts, onOpen }) {
  const top = [...files, ...localFiles].filter(isAudioFile).filter(f => (playCounts[f.id]||0)>0)
    .sort((a,b) => (playCounts[b.id]||0)-(playCounts[a.id]||0)).slice(0,10);
  return (
    <div className="widget">
      <div className="panel">
        <div className="panel-hd">TOP CANCIONES <span className="dots">/// ESCUCHAS</span></div>
        <div className="panel-body" style={{padding:'0'}}>
          {top.length===0
            ? <div style={{padding:'14px 12px',color:'var(--fg-dim)',fontSize:18}}>◇ Sin datos todavía</div>
            : top.map((f,i) => (
              <div key={f.id} className="top-song-row" onClick={()=>onOpen(f.id)}>
                <span className="top-rank">{i+1}</span>
                <div className="top-info"><div className="top-name">{f.name}</div><div className="top-artist">{f.artist||f.category}</div></div>
                <span className="top-count">▶{playCounts[f.id]||0}</span>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}

// ─── LIKE BUTTON ────────────────────────────────────────────
function LikeButton({ fileId, likedIds, onToggle }) {
  const liked = likedIds.has(fileId);
  const [pop, setPop] = useState(false);
  const wasLiked = useRef(liked);
  useEffect(() => {
    if (liked && !wasLiked.current) {
      setPop(true);
      const t = setTimeout(() => setPop(false), 250);
      wasLiked.current = liked;
      return () => clearTimeout(t);
    }
    wasLiked.current = liked;
  }, [liked]);
  return (
    <button className={`like-btn${liked ? ' liked' : ''}${pop ? ' like-pop-anim' : ''}`}
            onClick={e => { e.stopPropagation(); onToggle(fileId); }}
            title={liked ? 'Quitar de Me Gusta' : 'Me Gusta'}>
      {liked ? '♥' : '♡'}
    </button>
  );
}

// ─── ME GUSTA PAGE ──────────────────────────────────────────
function MeGustaPage({ files, localFiles = [], likedIds, onOpenFile, onNav, onPlayAll, onToggleLike }) {
  const liked = [...files, ...localFiles].filter(f => likedIds.has(f.id) && isAudioFile(f));
  const total = liked.reduce((a, f) => a + f.fileSize, 0);
  return (
    <div>
      <div className="panel">
        <div className="panel-hd">♥ ME GUSTA <span className="dots">/// {liked.length} CANCIÓN{liked.length===1?'':'ES'}</span></div>
        <div className="panel-body">
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12}}>
            <div>
              <p>Tus canciones favoritas marcadas con ♥.</p>
              <p style={{color:'var(--fg-dim)', fontSize:14}}>{liked.length} canción{liked.length===1?'':'es'} · {fmtBytes(total)}</p>
            </div>
            {liked.length > 0 && <button className="big-btn" onClick={onPlayAll}>▶ REPRODUCIR ME GUSTA</button>}
          </div>
        </div>
      </div>
      {liked.length === 0
        ? <div className="panel section"><div className="panel-body" style={{textAlign:'center',padding:'40px 0',color:'var(--fg-dim)',fontSize:22}}>◇ No has marcado ninguna canción todavía ◇<br/><span style={{fontSize:18}}>Usa el botón ♡ en el reproductor o en el detalle de canción</span></div></div>
        : <div className="section"><div className="panel"><div className="panel-body" style={{padding:0}}>
            {liked.map((f, i) => (
              <div key={f.id} style={{display:'flex', alignItems:'center', gap:10, padding:'8px 14px', borderBottom:'1px dotted rgba(214,31,31,0.15)', cursor:'pointer', background: i%2===0?'transparent':'rgba(214,31,31,0.03)'}}
                   onClick={() => onOpenFile(f.id)}>
                {f.thumbnail && <img src={f.thumbnail} alt="" style={{width:36, height:36, objectFit:'cover', flexShrink:0, borderRadius:2}} />}
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontFamily:'var(--mono)', fontSize:18, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{f.name}</div>
                  <div style={{fontFamily:'var(--pixel)', fontSize:10, color:'var(--fg-secondary)', letterSpacing:'0.08em'}}>{f.artist||f.category}{f.album ? ` · ${f.album}` : ''}</div>
                </div>
                <button className="like-btn liked" style={{flexShrink:0}} onClick={e => { e.stopPropagation(); onToggleLike(f.id); }} title="Quitar de Me Gusta">♥</button>
              </div>
            ))}
          </div></div></div>
      }
    </div>
  );
}

// ─── STATS PAGE ─────────────────────────────────────────────
const STAT_COLORS = ['#d61f1f','#ff8800','#c4ff00','#00f0ff','#ff2bd6','#a855f7','#3b82f6','#39ff14','#ffb347','#f97316'];

function StatsPage({ files, localFiles = [], playCounts, log, likedIds, playLog = [], artistMeta = {} }) {
  const allFiles = [...files, ...localFiles];
  const audioFiles = allFiles.filter(isAudioFile);
  const totalPlays = Object.values(playCounts).reduce((a,v)=>a+v,0);
  const withTs = allFiles.filter(f=>f.uploadedAt);
  const firstUpload = withTs.length > 0 ? Math.min(...withTs.map(f=>f.uploadedAt)) : null;
  const totalSize = audioFiles.reduce((a,f)=>a+f.fileSize,0);
  const avgSize = audioFiles.length ? totalSize/audioFiles.length : 0;
  const upCount = log.filter(e=>e.kind==='UP').length;
  const dlCount = log.filter(e=>e.kind==='DL').length;
  const delCount = log.filter(e=>e.kind==='DEL').length;

  // All artists
  const allArtistsList = [...new Set(audioFiles.map(f=>f.artist||f.category).filter(Boolean))];
  const artistColorMap = {};
  allArtistsList.forEach((a,i) => { artistColorMap[a] = STAT_COLORS[i % STAT_COLORS.length]; });

  // Artist plays
  const artistPlays = {};
  audioFiles.forEach(f => { const a=f.artist||f.category||'?'; artistPlays[a]=(artistPlays[a]||0)+(playCounts[f.id]||0); });
  const allArtistPlays = Object.entries(artistPlays).sort((a,b)=>b[1]-a[1]);
  const topArtists = allArtistPlays.slice(0,10);
  const maxAP = Math.max(1,...topArtists.map(([,v])=>v));

  // Fav song
  const mostPlayed = [...audioFiles].sort((a,b)=>(playCounts[b.id]||0)-(playCounts[a.id]||0))[0];
  const mostPlayedCount = mostPlayed ? (playCounts[mostPlayed.id]||0) : 0;

  // Fav album
  const albumPlays = {};
  audioFiles.forEach(f => {
    const key = `${f.artist||f.category}||${f.album||'SINGLE'}`;
    albumPlays[key] = (albumPlays[key]||0) + (playCounts[f.id]||0);
  });
  const [topAlbumKey='||', topAlbumPlays=0] = Object.entries(albumPlays).sort((a,b)=>b[1]-a[1])[0] || [];
  const [favAlbumArtist='', favAlbumName=''] = topAlbumKey.split('||');
  const favAlbumCover = audioFiles.find(f=>(f.artist||f.category)===favAlbumArtist&&(f.album||'SINGLE')===favAlbumName&&(f.thumbnail||f.coverArt));

  // Genres
  const genrePlays = {};
  audioFiles.forEach(f => {
    if (!f.genre) return;
    const g = f.genre.toUpperCase().slice(0,18);
    genrePlays[g]=(genrePlays[g]||0)+(playCounts[f.id]||0);
  });
  const topGenres = Object.entries(genrePlays).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const maxGP = Math.max(1,...topGenres.map(([,v])=>v));

  // Upload timeline
  const uploadsByDate = {};
  withTs.forEach(f => {
    const d = new Date(f.uploadedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    uploadsByDate[key]=(uploadsByDate[key]||0)+1;
  });
  const sortedUpDates = Object.keys(uploadsByDate).sort();
  const maxUploads = Math.max(1,...Object.values(uploadsByDate));

  // Play log timeline (last 30 days) — usar UTC puro para evitar desfases de zona horaria
  const todayUTC = new Date().toISOString().slice(0,10);
  const days30 = Array.from({length:30},(_,i)=>{
    const d = new Date(todayUTC + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() - (29-i));
    return d.toISOString().slice(0,10);
  });
  const playsByDayArtist = {};
  playLog.forEach(entry => {
    const d = new Date(entry.ts).toISOString().slice(0,10);
    if (!days30.includes(d)) return;
    if (!playsByDayArtist[d]) playsByDayArtist[d]={};
    const a = entry.artist||'OTRO';
    playsByDayArtist[d][a]=(playsByDayArtist[d][a]||0)+1;
  });
  const playDayTotals = days30.map(d=>Object.values(playsByDayArtist[d]||{}).reduce((a,v)=>a+v,0));
  const maxPlaysDay = Math.max(1,...playDayTotals);
  const playArtists = [...new Set(playLog.map(e=>e.artist).filter(Boolean))].slice(0,8);

  // Liked ratio
  const likedPlays = audioFiles.filter(f=>likedIds.has(f.id)).reduce((a,f)=>a+(playCounts[f.id]||0),0);
  const likedRatio = totalPlays>0 ? Math.round(likedPlays/totalPlays*100) : 0;

  // Streak — también UTC
  let streak = 0;
  for (let i = 0; i < 366; i++) {
    const sd = new Date(todayUTC + 'T12:00:00Z');
    sd.setUTCDate(sd.getUTCDate() - i);
    const k = sd.toISOString().slice(0, 10);
    if (playsByDayArtist[k]) streak++;
    else break;
  }

  const CHART_W=500, CHART_H=80;
  const px=(i)=> Math.round((i/(days30.length-1))*CHART_W);
  const py=(v)=> Math.round(CHART_H - (v/maxPlaysDay)*CHART_H);

  return (
    <div className="stats-page">

      {/* ── Métricas clave ── */}
      <div className="panel">
        <div className="panel-hd">ESTADÍSTICAS <span className="dots">/// VAULT ANALYTICS</span></div>
        <div className="panel-body">
          <div className="stats-facts-grid">
            {[['CANCIONES',audioFiles.length],['ARTISTAS',allArtistsList.length],['REPRODUCCIONES',totalPlays],['ME GUSTA',audioFiles.filter(f=>likedIds.has(f.id)).length],['SUBIDAS',upCount],['DESCARGAS',dlCount],['BORRADAS',delCount],['TAMAÑO MEDIO',fmtBytes(Math.round(avgSize))]].map(([lbl,val])=>(
              <div key={lbl} className="stat-fact"><div className="sf-label">{lbl}</div><div className="sf-val">{val}</div></div>
            ))}
          </div>
          <div style={{display:'flex',gap:12,marginTop:14,flexWrap:'wrap'}}>
            {firstUpload && <div className="stat-fact" style={{flex:1,minWidth:200}}><div className="sf-label">PRIMERA SUBIDA</div><div className="sf-val" style={{fontSize:16}}>{fmtLongDate(firstUpload)}</div></div>}
            <div className="stat-fact" style={{flex:1,minWidth:120}}><div className="sf-label">% PLAYS LIKED</div><div className="sf-val" style={{color:'var(--fg-primary)'}}>{likedRatio}%</div></div>
            <div className="stat-fact" style={{flex:1,minWidth:120}}><div className="sf-label">RACHA ACTUAL</div><div className="sf-val" style={{color:'var(--fg-accent)'}}>{streak} DÍA{streak===1?'':'S'}</div></div>
          </div>
        </div>
      </div>

      {/* ── Podio Top 3 canciones ── */}
      {(() => {
        const top3 = [...audioFiles].filter(f=>(playCounts[f.id]||0)>0).sort((a,b)=>(playCounts[b.id]||0)-(playCounts[a.id]||0)).slice(0,3);
        if (top3.length === 0) return null;
        const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);
        const heights = [56, 80, 40];
        const medals = ['🥈','🥇','🥉'];
        const colors = ['#b0b8c8','#ffd700','#cd7f32'];
        const ranks  = [2, 1, 3];
        return (
          <div className="panel section">
            <div className="panel-hd">TOP 3 CANCIONES <span className="dots">/// PODIO</span></div>
            <div className="panel-body">
              <div style={{display:'flex', alignItems:'flex-end', justifyContent:'center', gap:8, padding:'12px 0 0'}}>
                {podiumOrder.map((song, i) => {
                  const rank = ranks[i];
                  const h = heights[i];
                  const color = colors[i];
                  const plays = playCounts[song.id]||0;
                  return (
                    <div key={song.id} style={{display:'flex', flexDirection:'column', alignItems:'center', gap:6, flex:'0 0 auto', width:180}}>
                      {/* Cover + info */}
                      <div style={{textAlign:'center', maxWidth:160}}>
                        {(song.thumbnail||song.coverArt)
                          ? <img src={song.thumbnail||song.coverArt} alt="" style={{width:56,height:56,objectFit:'cover',border:`2px solid ${color}`,imageRendering:'pixelated',boxShadow:`0 0 10px ${color}55`}}/>
                          : <div style={{width:56,height:56,border:`2px solid ${color}`,display:'flex',alignItems:'center',justifyContent:'center',color}}><IconGlyph iconId="nota" size={32}/></div>}
                        <div style={{fontFamily:'var(--mono)',fontSize:14,color:'var(--fg-text)',marginTop:4,lineHeight:1.2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:160}}>{song.name}</div>
                        <div style={{fontFamily:'var(--pixel)',fontSize:8,color:'var(--fg-dim)',letterSpacing:'0.08em',marginTop:2}}>{song.artist||song.category||''}</div>
                        <div style={{fontFamily:'var(--pixel)',fontSize:10,color,marginTop:3,textShadow:`0 0 8px ${color}`}}>▶ {plays}×</div>
                      </div>
                      {/* Pedestal */}
                      <div style={{width:'100%',height:h,background:`linear-gradient(180deg,${color}33,${color}11)`,border:`1px solid ${color}`,borderBottom:'none',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:`0 0 12px ${color}44`}}>
                        <span style={{fontFamily:'var(--pixel)',fontSize:rank===1?22:16,color,textShadow:`0 0 10px ${color}`}}>{medals[i]}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Favoritos destacados ── */}
      {allArtistsList.length > 0 && (
        <div className="panel section">
          <div className="panel-hd">FAVORITOS <span className="dots">/// TOP PICKS</span></div>
          <div className="panel-body">
            <div className="stats-highlights">
              {/* Artista favorito */}
              {(() => {
                const favArtist = allArtistPlays[0] && allArtistPlays[0][1]>0 ? allArtistPlays[0][0] : null;
                const favArtistImg = favArtist
                  ? (artistMeta[favArtist]?.image || audioFiles.find(f=>(f.artist||f.category)===favArtist&&(f.thumbnail||f.coverArt))?.thumbnail || audioFiles.find(f=>(f.artist||f.category)===favArtist&&f.coverArt)?.coverArt || null)
                  : null;
                return (
                  <div className="stat-highlight">
                    {favArtistImg
                      ? <img src={favArtistImg} alt={favArtist||''} style={{width:48,height:48,objectFit:'cover',border:'1px solid var(--fg-primary)',borderRadius:'50%'}}/>
                      : <div className="sh-icon" style={{color: favArtist ? (artistColorMap[favArtist]||'var(--fg-primary)') : 'var(--fg-dim)'}}>
                          <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7z"/></svg>
                        </div>}
                    <div className="sh-label">ARTISTA FAVORITO</div>
                    <div className="sh-name">{favArtist || '— SIN DATOS —'}</div>
                    {favArtist && <div className="sh-sub">▶ {allArtistPlays[0][1]} reproducciones</div>}
                  </div>
                );
              })()}
              {/* Canción favorita */}
              <div className="stat-highlight">
                {mostPlayed && mostPlayedCount>0 && (mostPlayed.thumbnail||mostPlayed.coverArt)
                  ? <img src={mostPlayed.thumbnail||mostPlayed.coverArt} alt="" style={{width:48,height:48,objectFit:'cover',border:'1px solid var(--fg-primary)',imageRendering:'pixelated'}}/>
                  : <div className="sh-icon"><IconGlyph iconId="nota" size={36}/></div>}
                <div className="sh-label">CANCIÓN FAVORITA</div>
                <div className="sh-name">{mostPlayed && mostPlayedCount>0 ? mostPlayed.name : '— SIN DATOS —'}</div>
                {mostPlayed && mostPlayedCount>0 && <div className="sh-sub">▶ {mostPlayedCount}× · {mostPlayed.artist||mostPlayed.category||''}</div>}
              </div>
              {/* Disco favorito */}
              <div className="stat-highlight">
                {favAlbumName && topAlbumPlays>0 && favAlbumCover && (favAlbumCover.thumbnail||favAlbumCover.coverArt)
                  ? <img src={favAlbumCover.thumbnail||favAlbumCover.coverArt} alt="" style={{width:48,height:48,objectFit:'cover',border:'1px solid var(--fg-primary)',imageRendering:'pixelated'}}/>
                  : <div className="sh-icon"><IconGlyph iconId="disco" size={36}/></div>}
                <div className="sh-label">DISCO FAVORITO</div>
                <div className="sh-name">{favAlbumName && topAlbumPlays>0 ? favAlbumName : '— SIN DATOS —'}</div>
                {favAlbumName && topAlbumPlays>0 && <div className="sh-sub">▶ {topAlbumPlays} · {favAlbumArtist}</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Timeline reproducciones (30 días) ── */}
      <div className="panel section">
        <div className="panel-hd">REPRODUCCIONES DIARIAS <span className="dots">/// ÚLTIMOS 30 DÍAS</span></div>
        <div className="panel-body">
          {playLog.length === 0 ? (
            <div style={{color:'var(--fg-dim)',fontSize:18,padding:'18px 0'}}>◇ Sin datos aún — los datos se acumulan a partir de ahora al escuchar canciones.</div>
          ) : (
            <>
              <div style={{overflowX:'auto'}}>
                <svg viewBox={`0 0 ${CHART_W} ${CHART_H+24}`} style={{width:'100%',minWidth:320,display:'block',fontFamily:'var(--mono)'}}>
                  {/* grid lines */}
                  {[0,0.25,0.5,0.75,1].map(t=>(
                    <line key={t} x1={0} x2={CHART_W} y1={py(maxPlaysDay*t)} y2={py(maxPlaysDay*t)}
                          stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>
                  ))}
                  {/* line per artist */}
                  {playArtists.map((artist,ai) => {
                    const pts = days30.map((d,i)=>`${px(i)},${py((playsByDayArtist[d]||{})[artist]||0)}`).join(' ');
                    return <polyline key={artist} points={pts} fill="none"
                                     stroke={artistColorMap[artist]||STAT_COLORS[ai%STAT_COLORS.length]}
                                     strokeWidth="1.5" strokeLinejoin="round" opacity="0.85"/>;
                  })}
                  {/* total line */}
                  {(() => {
                    const pts = days30.map((d,i)=>`${px(i)},${py(playDayTotals[i])}`).join(' ');
                    return <polyline points={pts} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1" strokeDasharray="3,3"/>;
                  })()}
                  {/* x-axis labels (every 5 days) */}
                  {days30.map((d,i)=>i%5===0&&(
                    <text key={d} x={px(i)} y={CHART_H+18} textAnchor="middle" fontSize="9"
                          fill="rgba(255,255,255,0.35)">{d.slice(5)}</text>
                  ))}
                </svg>
              </div>
              {/* Leyenda */}
              {playArtists.length > 0 && (
                <div style={{display:'flex',flexWrap:'wrap',gap:'6px 16px',marginTop:10}}>
                  {playArtists.map((a,i)=>(
                    <span key={a} style={{fontSize:14,fontFamily:'var(--pixel)',letterSpacing:'0.06em',display:'flex',alignItems:'center',gap:5}}>
                      <span style={{display:'inline-block',width:20,height:3,background:artistColorMap[a]||STAT_COLORS[i%STAT_COLORS.length],borderRadius:2}}/>
                      {a}
                    </span>
                  ))}
                  <span style={{fontSize:14,fontFamily:'var(--pixel)',letterSpacing:'0.06em',display:'flex',alignItems:'center',gap:5}}>
                    <span style={{display:'inline-block',width:20,height:2,background:'rgba(255,255,255,0.35)',borderRadius:2,borderTop:'1px dashed rgba(255,255,255,0.35)'}}/>
                    TOTAL
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Barras verticales por artista ── */}
      {(() => {
        const playedArtists = topArtists.filter(([,v])=>v>0);
        if (playedArtists.length === 0) return null;
        const maxPA = Math.max(1,...playedArtists.map(([,v])=>v));
        const n = playedArtists.length;
        const barW = n <= 3 ? 40 : n <= 6 ? 28 : n <= 10 ? 20 : 14;
        const labelLen = n <= 4 ? 14 : n <= 7 ? 10 : 7;
        const fontSize = n <= 4 ? 9 : n <= 7 ? 8 : 7;
        const BAR_H = 90;
        const gap = n <= 4 ? 12 : n <= 7 ? 8 : 5;
        return (
          <div className="panel section">
            <div className="panel-hd">REPRODUCCIONES POR ARTISTA <span className="dots">/// {playedArtists.length}</span></div>
            <div className="panel-body">
              <div style={{overflowX:'auto'}}>
                {/* Barras: área de altura fija para que todas se alineen desde abajo */}
                <div style={{display:'flex', alignItems:'flex-end', gap, paddingBottom:0}}>
                  {playedArtists.map(([artist,plays],i)=>{
                    const h = Math.max(4, Math.round((plays/maxPA)*BAR_H));
                    const color = artistColorMap[artist]||STAT_COLORS[i%STAT_COLORS.length];
                    return (
                      <div key={artist} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3,width:barW,flexShrink:0}}>
                        <span style={{fontFamily:'var(--pixel)',fontSize,color}}>{plays}</span>
                        <div style={{width:barW,height:h,background:color,boxShadow:`0 0 6px ${color}44`}}/>
                      </div>
                    );
                  })}
                </div>
                {/* Línea base */}
                <div style={{height:2, background:'rgba(255,255,255,0.12)', marginBottom:4}}/>
                {/* Etiquetas: fila separada, siempre debajo de la línea base */}
                <div style={{display:'flex', gap, alignItems:'flex-start'}}>
                  {playedArtists.map(([artist],i)=>{
                    const color = artistColorMap[artist]||STAT_COLORS[i%STAT_COLORS.length];
                    return (
                      <div key={artist} style={{width:barW,flexShrink:0,display:'flex',justifyContent:'center'}}>
                        <span style={{
                          fontFamily:'var(--pixel)', fontSize, color:'rgba(255,255,255,0.65)',
                          writingMode:'vertical-rl', transform:'rotate(180deg)',
                          maxHeight:80, overflow:'hidden', whiteSpace:'nowrap',
                          letterSpacing:'0.05em', textOverflow:'ellipsis',
                        }}>
                          {artist}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Top géneros ── */}
      {topGenres.length > 0 && (
        <div className="panel section">
          <div className="panel-hd">TOP GÉNEROS <span className="dots">/// REPRODUCCIONES</span></div>
          <div className="panel-body">
            {topGenres.map(([genre,plays],i)=>(
              <div key={genre} className="artist-plays-row">
                <span className="ap-rank" style={{color:STAT_COLORS[i%STAT_COLORS.length]}}>{i+1}</span>
                <span className="ap-name">{genre}</span>
                <div className="ap-bar-bg"><div className="ap-bar-fill" style={{width:(plays/maxGP*100)+'%',background:STAT_COLORS[i%STAT_COLORS.length],animationDelay:`${i*70}ms`}}></div></div>
                <span className="ap-count">▶{plays}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Timeline subidas ── */}
      {sortedUpDates.length > 0 && (
        <div className="panel section">
          <div className="panel-hd">TIMELINE DE SUBIDAS <span className="dots">/// POR DÍA</span></div>
          <div className="panel-body">
            <div className="timeline-wrap">
              <div className="timeline-chart">
                {sortedUpDates.map((d,di)=>{
                  const count=uploadsByDate[d]; const h=Math.max(4,(count/maxUploads)*76);
                  return (<div key={d} className="tl-bar-col" title={`${d}: ${count}`}><span className="tl-count">{count}</span><div className="tl-bar" style={{height:h,animationDelay:`${di*15}ms`}}></div><span className="tl-label">{d.slice(5)}</span></div>);
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="section"><StatsPanel files={files} allCats={allArtistsList.sort()} /></div>
    </div>
  );
}

// ─── PLAYER MENU DROPDOWN ───────────────────────────────────
function PlayerMenuDropdown({ onCreateBookmark, onCreateClip, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  return (
    <div ref={ref} className="mp-menu-dropdown">
      <button onClick={() => { onCreateBookmark(); onClose(); }}>◆ CREAR MARCADOR</button>
      <button onClick={() => { onCreateClip(); onClose(); }}>✂ CREAR CLIP</button>
    </div>
  );
}

// ─── BOOKMARK MODAL ─────────────────────────────────────────
function BookmarkModal({ position, onSave, onClose }) {
  const [name, setName] = useState('');
  const [time, setTime] = useState(() => fmtTimeMs(position));
  useEffect(() => { const k=e=>{if(e.key==='Escape')onClose();}; window.addEventListener('keydown',k); return ()=>window.removeEventListener('keydown',k); },[onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-hd"><span>◆ CREAR MARCADOR</span><button className="modal-x" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          <div className="field"><div className="field-label">NOMBRE</div><input className="field-input" value={name} onChange={e=>setName(e.target.value)} placeholder="Ej. Intro, Coro, Solo..." autoFocus /></div>
          <div className="field"><div className="field-label">TIEMPO (M:SS.mmm)</div><input className="field-input" value={time} onChange={e=>setTime(e.target.value)} placeholder="0:00.000" /></div>
          <div className="form-actions">
            <button className="big-btn" onClick={()=>onSave({id:'BM'+Date.now(),name:name.trim()||'Marcador',time:parseTimeSec(time)})}>✓ GUARDAR</button>
            <button className="big-btn ghost" onClick={onClose}>✕ CANCELAR</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CLIP MODAL ─────────────────────────────────────────────
function ClipModal({ position, onSave, onClose }) {
  const [name, setName] = useState('');
  const [start, setStart] = useState(() => fmtTimeMs(Math.max(0, position - 5)));
  const [end, setEnd]   = useState(() => fmtTimeMs(position));
  useEffect(() => { const k=e=>{if(e.key==='Escape')onClose();}; window.addEventListener('keydown',k); return ()=>window.removeEventListener('keydown',k); },[onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-hd"><span>✂ CREAR CLIP</span><button className="modal-x" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          <div className="field"><div className="field-label">NOMBRE DEL CLIP</div><input className="field-input" value={name} onChange={e=>setName(e.target.value)} placeholder="Ej. Intro, Solo, Coro..." autoFocus /></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div className="field"><div className="field-label">INICIO (M:SS.mmm)</div><input className="field-input" value={start} onChange={e=>setStart(e.target.value)} placeholder="0:00.000"/></div>
            <div className="field"><div className="field-label">FIN (M:SS.mmm)</div><input className="field-input" value={end} onChange={e=>setEnd(e.target.value)} placeholder="0:30.000"/></div>
          </div>
          <div className="form-actions">
            <button className="big-btn" onClick={()=>{const s=parseTimeSec(start),e2=parseTimeSec(end);if(e2>s)onSave({id:'CL'+Date.now(),name:name.trim()||'Clip',start:s,end:e2});}}>✓ GUARDAR CLIP</button>
            <button className="big-btn ghost" onClick={onClose}>✕ CANCELAR</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── LOCAL IMPORT PAGE ──────────────────────────────────────
function LocalPage({ localFiles, dirName, scanning, onPickFolder, onDisconnect, onPlayAll, onPlayFile, currentId, isPlaying }) {
  const supported = 'showDirectoryPicker' in window;
  const connected = localFiles.length > 0 || dirName;

  // Group by artist/album for display
  const byArtist = {};
  localFiles.forEach(f => {
    const a = f.artist || 'SIN ARTISTA';
    if (!byArtist[a]) byArtist[a] = {};
    const al = f.album || 'SIN ÁLBUM';
    if (!byArtist[a][al]) byArtist[a][al] = [];
    byArtist[a][al].push(f);
  });

  return (
    <div>
      <div className="panel">
        <div className="panel-hd">MÚSICA LOCAL <span className="dots">━━━━━━━</span></div>
        <div className="panel-body">
          {!supported && (
            <div className="dz-err">File System Access API no disponible — usa Chrome o Edge.</div>
          )}
          {supported && (
            <div style={{display:'flex', alignItems:'center', gap:12, flexWrap:'wrap'}}>
              <button className="big-btn" onClick={onPickFolder} disabled={scanning}>
                {scanning ? '◆ ESCANEANDO...' : connected ? '↺ CAMBIAR CARPETA' : '📁 ELEGIR CARPETA'}
              </button>
              {connected && localFiles.length > 0 && (
                <button className="big-btn" onClick={onPlayAll}>▶ REPRODUCIR TODO</button>
              )}
              {connected && (
                <button className="big-btn" style={{background:'transparent', borderColor:'var(--fg-dim)', color:'var(--fg-dim)'}}
                        onClick={onDisconnect} title="Dejar de leer esta carpeta">
                  ✕ DESCONECTAR
                </button>
              )}
              {dirName && (
                <span style={{color:'var(--fg-dim)', fontSize:18}}>
                  {dirName} · <span style={{color:'var(--fg-success)'}}>{localFiles.length} canción{localFiles.length===1?'':'es'}</span>
                </span>
              )}
            </div>
          )}
          {!connected && !scanning && supported && (
            <p style={{marginTop:14, color:'var(--fg-dim)', fontSize:18}}>
              Los archivos se leen directamente del disco — nada se copia ni almacena en el navegador. Sin límite de tamaño.
            </p>
          )}
        </div>
      </div>

      {Object.entries(byArtist).map(([artist, albums]) => (
        <div key={artist} className="panel section">
          <div className="panel-hd">{artist}</div>
          <div className="panel-body" style={{padding:'0'}}>
            {Object.entries(albums).map(([album, songs]) => (
              <div key={album}>
                <div style={{padding:'6px 14px 4px', fontFamily:'var(--pixel)', fontSize:10, color:'var(--fg-secondary)', letterSpacing:'0.08em', borderBottom:'1px dotted rgba(214,31,31,0.2)'}}>
                  {album}
                </div>
                {songs
                  .sort((a,b)=>(parseInt(a.track)||999)-(parseInt(b.track)||999))
                  .map(f => {
                    const active = f.id === currentId;
                    return (
                      <div key={f.id} className={`local-track-row${active?' local-track-active':''}`} onClick={() => onPlayFile(f)}>
                        {f.thumbnail
                          ? <img src={f.thumbnail} alt="" className="local-track-thumb" />
                          : <div className="local-track-thumb local-track-thumb-empty">♪</div>
                        }
                        <span className="local-track-num">{f.track ? f.track.split('/')[0] : '—'}</span>
                        <div style={{flex:1, minWidth:0}}>
                          <div className="local-track-name">{f.name}</div>
                          {f.album && <div className="local-track-album">{f.album}</div>}
                        </div>
                        {f.year && <span style={{color:'var(--fg-dim)', fontFamily:'var(--pixel)', fontSize:9, flexShrink:0}}>{f.year}</span>}
                        <span className="local-track-size">{fmtBytes(f.fileSize)}</span>
                        <span className="local-track-play">{active && isPlaying ? '❚❚' : '▶'}</span>
                      </div>
                    );
                  })
                }
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── MAIN APP ──────────────────────────────────────────────────
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [route, setRoute] = useState({ page: 'INICIO' });
  const [files, setFiles] = useState(loadVault);
  const [customCats, setCustomCats] = useState(() => {
    const cats = loadCats();
    _catIconRegistry = Object.fromEntries(cats.map(c => [c.name, c.icon]));
    return cats;
  });
  const [log, setLog] = useState(loadLog);
  const [showCreateModal, setShowCreateModal] = useState(false);
  // Multi-select
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  // Upload progress state
  const [uploadProgress, setUploadProgress] = useState(null);

  // Music player state
  const audioRef = useRef(null);
  if (!audioRef.current) {
    audioRef.current = new Audio();
    audioRef.current.crossOrigin = 'anonymous'; // necesario para Web Audio API con URLs de R2
  }
  const analyserRef  = useRef(null);
  const audioCtxRef  = useRef(null);

  const ensureAnalyser = () => {
    if (analyserRef.current) return analyserRef.current;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const source = ctx.createMediaElementSource(audioRef.current);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.55;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
    } catch {}
    return analyserRef.current;
  };
  const [currentTrackId, setCurrentTrackId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [playContext, setPlayContext] = useState({ type: 'all', shuffle: false });
  const [repeatMode, setRepeatMode] = useState('off');
  const [id3Cache, setId3Cache] = useState({}); // {fileId: tags}

  // ── New feature state ──────────────────────────────────────
  const [likedIds, setLikedIds]     = useState(loadLikes);
  const [playCounts, setPlayCounts] = useState(loadCounts);
  const [playLog,    setPlayLog]    = useState(loadPLog);
  const [bookmarks, setBookmarks]   = useState(loadBookmarks);   // {fileId: [{id,name,time}]}
  const [clipStore, setClipStore]   = useState(loadClipStore);   // {fileId: [{id,name,start,end}]}
  const [artistMeta, setArtistMeta] = useState(loadArtistMeta); // {artistName: {image, description}}
  const [manualQueue, setManualQueue] = useState(null);           // null = use musicQueue
  const [showPlayerMenu, setShowPlayerMenu] = useState(false);
  const [showBookmarkModal, setShowBookmarkModal] = useState(false);
  const [showClipModal, setShowClipModal]         = useState(false);
  const [activeClip, setActiveClip] = useState(null);            // {start,end} — loops this range
  const [waveforms, setWaveforms]   = useState({});              // {fileId: Float32Array}
  const activeClipRef    = useRef(null);
  const audioSyncRef     = useRef(null);
  const localBlobRef     = useRef(null);
  const playStartRef     = useRef(null);
  // Waveform en tiempo real para archivos R2 (sin descarga extra)
  const waveformBufRef   = useRef(null);  // Float32Array(300) en construcción
  const waveformIdRef    = useRef(null);  // id de la pista que se está muestreando
  const waveformFrRef    = useRef(0);     // contador de frames para throttle

  // Local music (File System Access — never stored in localStorage)
  const [localFiles,   setLocalFiles]   = useState([]);
  const [localDirName, setLocalDirName] = useState('');
  const [localScanning, setLocalScanning] = useState(false);

  useEffect(() => { saveVault(files); }, [files]);
  useEffect(() => { saveCats(customCats); }, [customCats]);

  // Keep --vu-bottom in sync with the player's top border position
  useEffect(() => {
    const update = () => {
      const player = document.querySelector('.music-player');
      if (player) {
        const fromBottom = window.innerHeight - player.getBoundingClientRect().top;
        document.documentElement.style.setProperty('--vu-bottom', fromBottom + 'px');
      }
    };
    update();
    const id = setInterval(update, 500); // re-check until player appears
    window.addEventListener('resize', update);
    return () => { clearInterval(id); window.removeEventListener('resize', update); };
  }, [currentTrackId]);

  useEffect(() => { saveLikes(likedIds); }, [likedIds]);
  useEffect(() => { saveCounts(playCounts); }, [playCounts]);
  useEffect(() => { saveBookmarks(bookmarks); }, [bookmarks]);
  useEffect(() => { saveClipStore(clipStore); }, [clipStore]);
  useEffect(() => { saveArtistMeta(artistMeta); }, [artistMeta]);
  useEffect(() => {
    _catIconRegistry = Object.fromEntries(customCats.map(c => [c.name, c.icon]));
  }, [customCats]);
  useEffect(() => { saveLog(log); }, [log]);

  // Cargar biblioteca de Cloudflare R2 al arrancar
  useEffect(() => {
    fetch('/api/files')
      .then(r => r.ok ? r.json() : [])
      .then(r2 => {
        if (!Array.isArray(r2) || !r2.length) return;

        // Fusionar con vault: los archivos r2 reemplazan versiones cacheadas antiguas
        setFiles(prev => {
          const nonR2 = prev.filter(f => !f.id.startsWith('r2:'));
          return [...nonR2, ...r2];
        });

        // Pre-poblar id3Cache con los metadatos ya leídos server-side
        // Así el reproductor tiene portada y tags sin petición adicional
        setId3Cache(prev => {
          const updates = {};
          for (const f of r2) {
            updates[f.id] = {
              title:      f.name,
              artist:     f.artist,
              albumArtist:f.artist,
              album:      f.album,
              track:      f.track,
              year:       f.year,
              genre:      f.genre,
              coverArt:   f.coverArt || null,
            };
          }
          return { ...prev, ...updates };
        });
      })
      .catch(() => {}); // silencioso si la API no está disponible
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--scanline-opacity', t.scanlines);
    root.style.setProperty('--vignette', t.vignette);
    root.style.setProperty('--chroma-x', `${t.chroma}px`);
    root.style.setProperty('--curve-radius', `${t.curvature}px`);
    root.style.setProperty('--bloom', `${t.bloom}px`);
    root.style.setProperty('--flicker-strength', t.flicker ? 1 : 0.0001);
  }, [t]);

  // Keep activeClipRef in sync
  useEffect(() => { activeClipRef.current = activeClip; }, [activeClip]);

  // CRT flicker sync with audio
  useEffect(() => {
    const pulse = document.querySelector('.crt-audio-pulse');
    if (!isPlaying || !analyserRef.current) {
      if (audioSyncRef.current) cancelAnimationFrame(audioSyncRef.current);
      if (pulse) pulse.style.opacity = '0';
      return;
    }
    const node  = analyserRef.current;
    const audio = audioRef.current;
    const data  = new Uint8Array(node.fftSize);
    const tick  = () => {
      node.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) { const v = (data[i]/128)-1; sum += v*v; }
      const rms = Math.sqrt(sum/data.length);
      if (pulse) pulse.style.opacity = Math.min(0.7, rms * 3.2).toFixed(3);

      // Waveform en tiempo real para archivos R2 (sin descarga extra)
      if (waveformBufRef.current && audio && audio.duration > 0) {
        const idx = Math.min(299, Math.floor((audio.currentTime / audio.duration) * 300));
        if (rms > (waveformBufRef.current[idx] || 0)) waveformBufRef.current[idx] = rms;
        waveformFrRef.current = (waveformFrRef.current + 1) % 20;
        if (waveformFrRef.current === 0) {
          const id  = waveformIdRef.current;
          const snap = waveformBufRef.current.slice();
          setWaveforms(prev => ({ ...prev, [id]: snap }));
        }
      }

      audioSyncRef.current = requestAnimationFrame(tick);
    };
    audioSyncRef.current = requestAnimationFrame(tick);
    return () => { if (audioSyncRef.current) cancelAnimationFrame(audioSyncRef.current); };
  }, [isPlaying]);

  // Audio element wiring
  useEffect(() => {
    const audio = audioRef.current;
    const onTime = () => {
      setPosition(audio.currentTime);
      // Clip loop
      const clip = activeClipRef.current;
      if (clip && audio.currentTime >= clip.end) { audio.currentTime = clip.start; }
    };
    const onDur = () => setDuration(audio.duration || 0);
    const onEnded = () => {
      // Natural end always counts as a listen, regardless of duration
      countPlay(currentTrackId);
      playStartRef.current = null; // prevent double-count in startTrack
      if (repeatMode === 'one') {
        audio.currentTime = 0;
        audio.play().catch(() => {});
        playStartRef.current = Date.now();
        return;
      }
      playNext(repeatMode === 'all', { autoAdvance: true });
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('durationchange', onDur);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('durationchange', onDur);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
    };
  }, [currentTrackId, repeatMode]);
  useEffect(() => { audioRef.current.volume = volume; }, [volume]);

  // Artistas derivados del vault y de la carpeta local
  const allArtists = [...new Set([...files, ...localFiles].map(f => f.artist || f.category).filter(Boolean))].sort();
  const allCats = allArtists;

  const addToLog = (entry) => setLog((p) => [{ ...entry, ts: Date.now() }, ...p].slice(0, 200));

  // ───── UPLOAD WITH PROGRESS ─────
  const startUpload = (meta) => {
    const file = meta._rawFile;
    if (!file) return;
    const startTs = Date.now();
    setUploadProgress({
      name: meta.name,
      bytesLoaded: 0,
      bytesTotal: file.size,
      percent: 0,
      bytesPerSec: 0,
      elapsedMs: 0,
      etaMs: Infinity,
      done: false,
    });
    setRoute({ page: 'UPLOAD_PROGRESS' });

    const reader = new FileReader();
    reader.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const elapsed = Date.now() - startTs;
      const bps = elapsed > 0 ? (e.loaded / (elapsed / 1000)) : 0;
      const remaining = e.total - e.loaded;
      const eta = bps > 0 ? (remaining / bps) * 1000 : Infinity;
      setUploadProgress({
        name: meta.name,
        bytesLoaded: e.loaded,
        bytesTotal: e.total,
        percent: (e.loaded / e.total) * 100,
        bytesPerSec: bps,
        elapsedMs: elapsed,
        etaMs: eta,
        done: false,
      });
    };
    reader.onload = () => {
      const elapsed = Date.now() - startTs;
      const bps = elapsed > 0 ? (file.size / (elapsed / 1000)) : 0;
      setUploadProgress({
        name: meta.name,
        bytesLoaded: file.size,
        bytesTotal: file.size,
        percent: 100,
        bytesPerSec: bps,
        elapsedMs: elapsed,
        etaMs: 0,
        done: true,
      });
      const entry = {
        id: 'F' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        name:        meta.name,
        description: meta.description,
        category:    meta.artist || meta.category,
        artist:      meta.artist  || '',
        album:       meta.album   || '',
        track:       meta.track   || '',
        disc:        meta.disc    || '',
        year:        meta.year    || '',
        genre:       meta.genre   || '',
        thumbnail:   meta.thumbnail || meta.coverArt,
        coverArt:    meta.coverArt,
        fileName:    meta.fileName,
        fileSize:    meta.fileSize,
        fileType:    meta.fileType,
        fileData:    reader.result,
        uploadedAt:  Date.now(),
        downloads:   0,
      };
      setFiles((prev) => [entry, ...prev]);
      addToLog({ kind: 'UP', name: entry.name, size: entry.fileSize });
      setTimeout(() => {
        setUploadProgress(null);
        setRoute({ page: 'CAT', cat: entry.category });
      }, 900);
    };
    reader.onerror = () => {
      setUploadProgress((p) => p ? { ...p, done: true, error: true } : null);
      setTimeout(() => { setUploadProgress(null); setRoute({ page: 'SUBIR' }); }, 1500);
    };
    reader.readAsDataURL(file);
  };

  const handleDownload = (f) => {
    downloadFile(f);
    setFiles((prev) => prev.map((x) => x.id === f.id ? { ...x, downloads: (x.downloads || 0) + 1 } : x));
    addToLog({ kind: 'DL', name: f.name, size: f.fileSize });
  };
  const handleDelete = (f) => {
    setFiles((prev) => prev.filter((x) => x.id !== f.id));
    addToLog({ kind: 'DEL', name: f.name, size: f.fileSize });
    if (currentTrackId === f.id) stopMusic();
    if (route.page === 'DETAIL') setRoute({ page: 'CAT', cat: f.category || f.artist });
  };
  const handleUpdate = (f) => {
    setFiles((prev) => prev.map((x) => x.id === f.id ? f : x));
  };
  const updateArtistMeta = (artistName, meta) => {
    setArtistMeta(prev => ({ ...prev, [artistName]: { ...(prev[artistName] || {}), ...meta } }));
  };
  const handleCreateCat = () => setShowCreateModal(true);
  const submitCreateCat = ({ name, icon }) => {
    setCustomCats((p) => [...p, { name, icon }]);
    setShowCreateModal(false);
    setRoute({ page: 'CAT', cat: name });
  };

  const openFile = (id) => setRoute({ page: 'DETAIL', fileId: id });

  // ───── MULTI-SELECT ─────
  const toggleSel = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clearSel = () => setSelectedIds(new Set());
  const bulkDownload = async () => {
    if (!window.JSZip || selectedIds.size === 0) return;
    setBulkBusy(true);
    try {
      const zip = new window.JSZip();
      const selFiles = files.filter((f) => selectedIds.has(f.id));
      for (const f of selFiles) {
        const resp = await fetch(f.fileData);
        const blob = await resp.blob();
        // Avoid filename collisions
        const folder = zip.folder(f.category) || zip;
        let name = f.fileName;
        let n = 1;
        while (folder.file(name)) {
          const dot = f.fileName.lastIndexOf('.');
          if (dot > 0) name = f.fileName.slice(0, dot) + `_${n}` + f.fileName.slice(dot);
          else name = f.fileName + `_${n}`;
          n++;
        }
        folder.file(name, blob);
        setFiles((prev) => prev.map((x) => x.id === f.id ? { ...x, downloads: (x.downloads || 0) + 1 } : x));
        addToLog({ kind: 'DL', name: f.name, size: f.fileSize });
      }
      const out = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(out);
      const a = document.createElement('a');
      a.href = url;
      a.download = `metal_sys_export_${new Date().toISOString().slice(0,10)}.zip`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
      clearSel();
    } catch (e) {
      alert('Error al generar el ZIP: ' + (e.message || e));
    }
    setBulkBusy(false);
  };
  const bulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`¿Eliminar ${selectedIds.size} archivo${selectedIds.size===1?'':'s'} de la bóveda?`)) return;
    const ids = new Set(selectedIds);
    files.filter((f) => ids.has(f.id)).forEach((f) => addToLog({ kind: 'DEL', name: f.name, size: f.fileSize }));
    setFiles((prev) => prev.filter((f) => !ids.has(f.id)));
    if (currentTrackId && ids.has(currentTrackId)) stopMusic();
    clearSel();
  };

  // ───── MUSIC PLAYER ─────
  const shuffleArray = (items) => {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const getQueueForContext = useCallback((context) => {
    if (context.type === 'local') return localFiles;
    const all = files.filter(isAudioFile);
    const combined = [...all, ...localFiles.filter(isAudioFile)];
    if (context.type === 'artist' && context.artist) {
      return combined.filter((f) => (f.artist || f.category) === context.artist).sort(sortByDiscTrack);
    }
    if (context.type === 'album' && context.artist && context.album) {
      return combined.filter((f) => (f.artist || f.category) === context.artist && (f.album || 'SINGLE') === context.album).sort(sortByDiscTrack);
    }
    return combined;
  }, [files, localFiles]);

  const musicQueueBase = useMemo(() => getQueueForContext(playContext), [getQueueForContext, playContext]);
  const musicQueue = useMemo(() => playContext.shuffle ? shuffleArray(musicQueueBase) : musicQueueBase, [musicQueueBase, playContext.shuffle]);
  const currentTrack = currentTrackId ? ([...files, ...localFiles].find((f) => f.id === currentTrackId) ?? null) : null;

  const requestID3 = async (file) => {
    if (id3Cache[file.id] !== undefined) return id3Cache[file.id];
    let src = file.fileData;
    if (file.r2Path) {
      try {
        const r = await fetch(`/api/audio?path=${encodeURIComponent(file.r2Path)}`);
        const d = await r.json();
        src = d.url;
      } catch { return null; }
    }
    if (!src) return null;
    const tags = await readID3(src);
    setId3Cache((p) => ({ ...p, [file.id]: tags }));
    return tags;
  };

  const countPlay = (id) => {
    if (!id) return;
    setPlayCounts(prev => { const n = { ...prev, [id]: (prev[id] || 0) + 1 }; saveCounts(n); return n; });
    const file = [...files, ...localFiles].find(f => f.id === id);
    setPlayLog(prev => {
      const n = [{ id, artist: file?.artist || file?.category || '', ts: Date.now() }, ...prev].slice(0, 2000);
      savePLog(n);
      return n;
    });
  };

  // skipLog: true cuando el llamador (playNext/playPrev) ya ha añadido su propia entrada al log
  const startTrack = (file, nextContext, { skipLog = false } = {}) => {
    if (!file) return;
    if (nextContext) setPlayContext(nextContext);
    const audio = audioRef.current;
    ensureAnalyser();
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
    if (currentTrackId === file.id) {
      audio.play().catch(() => {});
      return;
    }
    if (!skipLog) addToLog({ kind: 'PLAY', name: file.name, artist: file.artist || file.category || '' });
    // Count previous track if it was played for at least 30 seconds
    if (currentTrackId && playStartRef.current) {
      const elapsed = Date.now() - playStartRef.current;
      if (elapsed >= 30000) countPlay(currentTrackId);
    }
    playStartRef.current = Date.now();

    // Local file: get blob URL from FileSystemFileHandle
    if (file.isLocal && file.fileHandle) {
      (async () => {
        try {
          const f = await file.fileHandle.getFile();
          if (localBlobRef.current) URL.revokeObjectURL(localBlobRef.current);
          const url = URL.createObjectURL(f);
          localBlobRef.current = url;
          audio.src = url;
          audio.play().catch(() => {});
        } catch (e) { console.error('Local file read error:', e); }
      })();
      setCurrentTrackId(file.id);
      setPosition(0); setDuration(0); setActiveClip(null);
      requestID3(file);
      return;
    }
    setCurrentTrackId(file.id);
    setPosition(0);
    setDuration(0);
    setActiveClip(null);
    requestID3(file);

    if (file.r2Path) {
      // Archivo R2: obtener URL firmada → el navegador hace streaming directo desde R2
      waveformBufRef.current = new Float32Array(300);
      waveformIdRef.current  = file.id;
      waveformFrRef.current  = 0;
      (async () => {
        try {
          const r = await fetch(`/api/audio?path=${encodeURIComponent(file.r2Path)}`);
          const { url } = await r.json();
          audio.src = url;
          audio.play().catch(() => {});
        } catch (e) { console.error('[R2] signed URL error:', e); }
      })();
      return;
    }

    audio.src = file.fileData;
    audio.play().catch(() => {});

    if (!waveforms[file.id]) {
      // Archivo local: pre-calcular waveform completo con OfflineAudioContext
      (async () => {
        try {
          const resp = await fetch(file.fileData);
          const buf = await resp.arrayBuffer();
          const offCtx = new OfflineAudioContext(1, 1, 44100);
          const decoded = await offCtx.decodeAudioData(buf);
          const raw = decoded.getChannelData(0);
          const N = 300, blockSize = Math.floor(raw.length / N);
          const out = new Float32Array(N);
          for (let i = 0; i < N; i++) {
            let s = 0;
            for (let j = 0; j < blockSize; j++) s += Math.abs(raw[i * blockSize + j]);
            out[i] = Math.min(1, (s / blockSize) * 2.5);
          }
          setWaveforms(prev => ({ ...prev, [file.id]: out }));
        } catch {}
      })();
    }
  };

  const playScope = (context, shuffle = false) => {
    const queue = getQueueForContext({ ...context, shuffle: false });
    if (queue.length === 0) return;
    setManualQueue(null); // reset any manual reorder
    setPlayContext({ ...context, shuffle });
    const nextTrack = shuffle ? shuffleArray(queue)[0] : queue[0];
    startTrack(nextTrack, { ...context, shuffle });
  };

  const toggleShuffle = () => {
    const newShuffle = !playContext.shuffle;
    if (newShuffle && currentTrackId) {
      // Build queue that starts at current track, rest shuffled
      const base = getQueueForContext(playContext);
      const current = base.find(f => f.id === currentTrackId);
      const rest = base.filter(f => f.id !== currentTrackId);
      const shuffled = current ? [current, ...shuffleArray(rest)] : shuffleArray(base);
      setManualQueue(shuffled);
    } else {
      setManualQueue(null);
    }
    setPlayContext((prev) => ({ ...prev, shuffle: newShuffle }));
  };

  // Effective queue: manual reorder overrides the derived queue
  const effectiveQueue = manualQueue || musicQueue;

  // Like toggle
  const toggleLike = (fileId) => {
    const wasLiked = likedIds.has(fileId);
    const f = [...files, ...localFiles].find(x => x.id === fileId);
    setLikedIds(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId); else next.add(fileId);
      return next;
    });
    addToLog({ kind: wasLiked ? 'UNLIKE' : 'LIKE', name: f?.name || fileId, artist: f?.artist || f?.category || '' });
  };

  // Bookmark handlers
  const addBookmark = (fileId, bm) => {
    setBookmarks(prev => ({ ...prev, [fileId]: [...(prev[fileId]||[]), bm] }));
  };
  const deleteBookmark = (fileId, bmId) => {
    setBookmarks(prev => ({ ...prev, [fileId]: (prev[fileId]||[]).filter(b => b.id !== bmId) }));
  };
  const seekToBookmark = (time) => { seek(time); };

  // Clip handlers
  const addClip = (fileId, clip) => {
    setClipStore(prev => ({ ...prev, [fileId]: [...(prev[fileId]||[]), clip] }));
  };
  const deleteClip = (fileId, clipId) => {
    setClipStore(prev => ({ ...prev, [fileId]: (prev[fileId]||[]).filter(c => c.id !== clipId) }));
    setActiveClip(prev => (prev && prev.id === clipId) ? null : prev);
  };
  const playClip = (clip) => {
    setActiveClip(clip);
    seek(clip.start);
    audioRef.current.play().catch(() => {});
  };
  const stopClip = () => setActiveClip(null);

  // Import file from local folder (used by LocalPage)
  // ── LOCAL MUSIC (read from disk, no copy) ─────────────────────
  const scanLocalDir = async (dirHandle) => {
    setLocalScanning(true);
    const entries = [];
    const scan = async (handle, pathPrefix) => {
      for await (const [name, entry] of handle.entries()) {
        if (entry.kind === 'file') {
          const ext = name.split('.').pop().toLowerCase();
          if (/^(mp3|wav|ogg|flac|m4a|aac|opus|aiff|wma)$/.test(ext)) {
            entries.push({ fileHandle: entry, name, pathPrefix });
          }
        } else if (entry.kind === 'directory') {
          await scan(entry, pathPrefix ? pathPrefix + '/' + name : name);
        }
      }
    };
    try {
      await scan(dirHandle, '');
      // Read ID3 tags for each file (only first 1MB — enough for metadata)
      const parsed = await Promise.all(entries.map(async ({ fileHandle, name }) => {
        try {
          const file = await fileHandle.getFile();
          const slice = file.slice(0, 1024 * 1024);
          const buf = await slice.arrayBuffer();
          const tags = await _parseID3Buffer(buf);
          return {
            id: 'local_' + Math.random().toString(36).slice(2),
            name: tags.title || name.replace(/\.[^.]+$/, ''),
            artist: tags.albumArtist || tags.artist || '',
            album: tags.album || '',
            track: tags.track || '',
            disc: tags.disc || '',
            year: tags.year || '',
            genre: tags.genre || '',
            thumbnail: tags.coverArt || null,
            coverArt: tags.coverArt || null,
            fileName: name,
            fileSize: file.size,
            fileType: file.type || 'audio/mpeg',
            fileData: null,      // never stored
            isLocal: true,
            fileHandle,
            uploadedAt: file.lastModified || Date.now(),
            downloads: 0,
          };
        } catch { return null; }
      }));
      setLocalFiles(parsed.filter(Boolean));
    } catch {}
    setLocalScanning(false);
  };

  const pickLocalFolder = async () => {
    if (!('showDirectoryPicker' in window)) return;
    try {
      const dh = await window.showDirectoryPicker({ mode: 'read' });
      setLocalDirName(dh.name);
      await idbSet('localDirHandle', dh);
      await scanLocalDir(dh);
    } catch (e) {
      if (e.name !== 'AbortError') console.error(e);
    }
  };

  // Desconectar carpeta local — limpia estado y elimina handle de IndexedDB
  const disconnectLocalFolder = async () => {
    setLocalFiles([]);
    setLocalDirName('');
    try { await idbSet('localDirHandle', null); } catch {}
    if (currentTrackId) {
      const current = localFiles.find(f => f.id === currentTrackId);
      if (current) stopMusic();
    }
  };

  // Try to restore local folder on first load
  // If permission is not already granted, clear the stored handle — the user must reconnect manually
  useEffect(() => {
    (async () => {
      try {
        const dh = await idbGet('localDirHandle');
        if (!dh) return;
        const perm = await dh.queryPermission({ mode: 'read' });
        if (perm === 'granted') {
          setLocalDirName(dh.name);
          await scanLocalDir(dh);
        } else {
          // Permission lost after page reload — clear stored handle
          await idbSet('localDirHandle', null);
        }
      } catch {}
    })();
  }, []);

  const toggleRepeat = () => {
    setRepeatMode((prev) => prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off');
  };

  const playTrack = (file) => {
    if (currentTrackId === file.id) {
      const audio = audioRef.current;
      if (audio.paused) audio.play().catch(() => {}); else audio.pause();
      return;
    }
    setManualQueue([file]);
    startTrack(file);
  };
  const playPause = () => {
    const audio = audioRef.current;
    if (audio.paused) {
      audio.play().catch(() => {});
      const f = currentTrack;
      if (f) addToLog({ kind: 'PLAY', name: f.name, artist: f.artist || f.category || '' });
    } else {
      audio.pause();
      const f = currentTrack;
      if (f) addToLog({ kind: 'PAUSE', name: f.name, artist: f.artist || f.category || '' });
    }
  };
  const playNext = (wrap = true, { autoAdvance = false } = {}) => {
    if (effectiveQueue.length === 0) return;
    const idx = effectiveQueue.findIndex((f) => f.id === currentTrackId);
    const next = wrap ? effectiveQueue[(idx + 1) % effectiveQueue.length] : effectiveQueue[idx + 1];
    if (next) {
      if (!autoAdvance) addToLog({ kind: 'NEXT', name: next.name, artist: next.artist || next.category || '' });
      startTrack(next, undefined, { skipLog: true });
    }
  };
  const playPrev = () => {
    if (effectiveQueue.length === 0) return;
    // Si la canción lleva más de 3s reproducida, volver al inicio sin loguear
    if (position > 3) {
      seek(0);
      return;
    }
    const idx = effectiveQueue.findIndex((f) => f.id === currentTrackId);
    const prev = effectiveQueue[(idx - 1 + effectiveQueue.length) % effectiveQueue.length];
    if (prev) {
      addToLog({ kind: 'PREV', name: prev.name, artist: prev.artist || prev.category || '' });
      startTrack(prev, undefined, { skipLog: true });
    }
  };
  const seek = (sec) => { audioRef.current.currentTime = sec; setPosition(sec); };
  const stopMusic = () => {
    audioRef.current.pause();
    audioRef.current.src = '';
    setCurrentTrackId(null);
    setIsPlaying(false);
    setPosition(0);
    setDuration(0);
    setActiveClip(null);
  };

  // Clear multi-select when leaving CAT
  useEffect(() => { if (route.page !== 'CAT') clearSel(); }, [route.page, route.cat]);

  const totalBytes = [...files, ...localFiles].reduce((a, f) => a + (f.fileSize || 0), 0);
  const phosphorClass = `phosphor-${t.phosphor}`;
  const currentFile = route.page === 'DETAIL' ? ([...files, ...localFiles].find((f) => f.id === route.fileId) ?? null) : null;

  return (
    <div className={`crt-stage ${phosphorClass}`}>
      <div className="crt-screen" style={{ animationPlayState: t.flicker ? 'running' : 'paused' }}>
        <div className="crt-content" style={{ animationPlayState: t.jitter ? 'running' : 'paused' }}>
          <StatusBar count={files.filter(isAudioFile).length} totalBytes={totalBytes} localCount={localFiles.filter(isAudioFile).length} localBytes={localFiles.reduce((a,f)=>a+(f.fileSize||0),0)} />
          <div className="page">
            {/* Left sidebar */}
            <div className="col-left">
              <LibraryTree
                files={files} localFiles={localFiles} allCats={allCats}
                onNav={setRoute} onOpenFile={openFile}
                onPlayArtist={artist => playScope({ type:'artist', artist }, false)}
                onPlayAlbum={(artist, album) => playScope({ type:'album', artist, album }, false)}
                onPlayFile={f => { setManualQueue(null); startTrack(f); }} />
            </div>

            {/* Center column */}
            <div className="col-main">
              <Banner onNav={setRoute} />
              <Nav current={route} onNav={setRoute} allCats={allCats} />
              <Marquee />
              <div key={`${route.page}:${route.cat||''}:${route.fileId||''}`} className="page-enter">
              {route.page === 'INICIO' && (
                <HomePage files={files} allCats={allCats} onOpenFile={openFile} onNav={setRoute}
                          onPlayArtist={(artist) => playScope({ type: 'artist', artist }, false)}
                          localFiles={localFiles} localDirName={localDirName}
                          onPickFolder={pickLocalFolder} onDisconnectFolder={disconnectLocalFolder}
                          artistMeta={artistMeta} />
              )}
              {route.page === 'TODO' && (
                <AllSongsPage files={files} localFiles={localFiles}
                              onOpenFile={openFile}
                              onPlayAll={() => playScope({ type: 'all' }, false)} />
              )}
              {route.page === 'BANDAS' && (
                <BandasPage artists={allArtists} files={files} localFiles={localFiles}
                            onNav={setRoute}
                            onPlayAll={() => playScope({ type: 'all' }, false)}
                            onPlayArtist={(artist) => playScope({ type: 'artist', artist }, false)}
                            artistMeta={artistMeta} />
              )}
              {route.page === 'MESGUSTA' && (
                <MeGustaPage
                  files={files} localFiles={localFiles} likedIds={likedIds}
                  onOpenFile={openFile} onNav={setRoute}
                  onPlayAll={() => {
                    const likedAudio = [...files, ...localFiles].filter(f => likedIds.has(f.id) && isAudioFile(f));
                    if (likedAudio.length === 0) return;
                    setManualQueue(likedAudio);
                    startTrack(likedAudio[0], { type: 'all', shuffle: false });
                  }}
                  onToggleLike={toggleLike} />
              )}
              {route.page === 'STATS' && (
                <StatsPage files={files} localFiles={localFiles} playCounts={playCounts} log={log} likedIds={likedIds} playLog={playLog} artistMeta={artistMeta} />
              )}
              {route.page === 'LOCAL' && (
                <LocalPage
                  localFiles={localFiles} dirName={localDirName} scanning={localScanning}
                  onPickFolder={pickLocalFolder} onDisconnect={disconnectLocalFolder}
                  onPlayAll={() => { if(localFiles.length===0)return; setManualQueue(null); playScope({type:'local',shuffle:false},false); }}
                  onPlayFile={f => { setManualQueue(null); setPlayContext({type:'local',shuffle:false}); startTrack(f,{type:'local',shuffle:false}); }}
                  currentId={currentTrackId} isPlaying={isPlaying} />
              )}
              {route.page === 'SUBIR' && (
                <UploadPage allCats={allCats} vault={files}
                            onUpload={startUpload} onNav={setRoute} onCreateCat={handleCreateCat}
                            prefillCat={route.prefillCat} />
              )}
              {route.page === 'UPLOAD_PROGRESS' && <UploadProgressPage progress={uploadProgress} />}
              {route.page === 'CAT' && (
                <CategoryPage cat={route.cat} prefillAlbum={route.album} files={[...files, ...localFiles]}
                              onOpenFile={openFile} onNav={setRoute}
                              selectedIds={selectedIds} toggleSel={toggleSel} clearSel={clearSel}
                              onBulkDownload={bulkDownload} onBulkDelete={bulkDelete} busy={bulkBusy}
                              artistMeta={artistMeta} onUpdateArtistMeta={updateArtistMeta}
                              onPlayArtist={(artist) => playScope({ type: 'artist', artist }, false)}
                              onPlayAlbum={(artist, album) => playScope({ type: 'album', artist, album }, false)}
                              onPlayFile={(f) => { setManualQueue([f]); startTrack(f); }} />
              )}
              {route.page === 'DETAIL' && (
                currentFile
                  ? <DetailPage file={currentFile}
                                onBack={() => setRoute({ page: 'CAT', cat: currentFile.category || currentFile.artist, album: currentFile.album || undefined })}
                                onDownload={handleDownload} onDelete={handleDelete}
                                allCats={allCats} onUpdate={handleUpdate}
                                onPlayAudio={playTrack}
                                currentPlayingId={currentTrackId} isPlaying={isPlaying}
                                id3Tags={id3Cache[currentFile.id]} requestID3={requestID3}
                                analyser={analyserRef}
                                likedIds={likedIds} onToggleLike={toggleLike}
                                bookmarks={bookmarks} onAddBookmark={addBookmark}
                                onDeleteBookmark={deleteBookmark} onSeekBookmark={seekToBookmark}
                                clipStore={clipStore} onAddClip={addClip}
                                onDeleteClip={deleteClip} onPlayClip={playClip}
                                onStopClip={stopClip} activeClip={activeClip}
                                position={position} />
                  : <div className="panel"><div className="panel-body" style={{textAlign:'center',padding:40}}>
                      Archivo no encontrado. <button className="mini-btn" onClick={()=>setRoute({page:'INICIO'})}>VOLVER</button>
                    </div></div>
              )}
              </div>
              <Terminal files={files} localFiles={localFiles} allCats={allCats} />
              <Footer />
            </div>

            {/* Right sidebar */}
            <div className="col-right">
              <PlayQueueWithNowPlaying
                queue={effectiveQueue} currentId={currentTrackId}
                currentTrack={currentTrack} isPlaying={isPlaying}
                onJump={file => startTrack(file)}
                onReorder={arr => setManualQueue(arr)}
                onOpen={openFile} />
              <TopSongs files={files} localFiles={localFiles} playCounts={playCounts} onOpen={openFile} />
              <PlaysCounter playCounts={playCounts} />
              <RecentActivity log={log} />
            </div>
          </div>
        </div>

        <div className="crt-scanlines"></div>
        {t.rollbar && <div className="crt-rollbar"></div>}
        <div className="crt-vignette"></div>
        <div className="crt-glass"></div>
        <div className="crt-audio-pulse"></div>
      </div>

      <MultiSelectBar selected={selectedIds} files={files} onClear={clearSel}
                      onDownloadAll={bulkDownload} onDeleteAll={bulkDelete} busy={bulkBusy} />

      {/* VU backdrop — sibling of player, z-index LOWER than player so player renders on top */}
      {currentTrack && (
        <VUBackdrop analyser={analyserRef} isPlaying={isPlaying} />
      )}

      <MusicPlayer track={currentTrack} queue={effectiveQueue} isPlaying={isPlaying}
                   position={position} duration={duration} volume={volume}
                   onPlayPause={playPause} onSeek={seek}
                   onPrev={playPrev} onNext={playNext}
                   onShuffle={toggleShuffle} shuffleActive={playContext.shuffle}
                   onRepeat={toggleRepeat} repeatMode={repeatMode}
                   onVolume={setVolume}
                   onClose={stopMusic}
                   tags={currentTrackId ? id3Cache[currentTrackId] : null}
                   analyser={analyserRef}
                   onOpenMenu={() => setShowPlayerMenu(true)}
                   showMenu={showPlayerMenu}
                   onCloseMenu={() => setShowPlayerMenu(false)}
                   onCreateBookmark={() => { setShowPlayerMenu(false); setShowBookmarkModal(true); }}
                   onCreateClip={() => { setShowPlayerMenu(false); setShowClipModal(true); }}
                   waveform={currentTrackId ? waveforms[currentTrackId] : null}
                   likedIds={likedIds} onToggleLike={toggleLike} />

      {showCreateModal && (
        <CreateCategoryModal
          existing={allCats}
          onClose={() => setShowCreateModal(false)}
          onSubmit={submitCreateCat}
        />
      )}

      {showBookmarkModal && currentTrack && (
        <BookmarkModal
          position={position}
          onSave={bm => { addBookmark(currentTrack.id, bm); setShowBookmarkModal(false); }}
          onClose={() => setShowBookmarkModal(false)}
        />
      )}

      {showClipModal && currentTrack && (
        <ClipModal
          position={position}
          onSave={clip => { addClip(currentTrack.id, clip); setShowClipModal(false); }}
          onClose={() => setShowClipModal(false)}
        />
      )}

      <TweaksPanel>
        <TweakSection label="Phosphor" />
        <TweakSelect label="Tube" value={t.phosphor}
                     options={['metal', 'synthwave', 'green', 'amber', 'mono']}
                     onChange={(v) => setTweak('phosphor', v)} />
        <TweakSection label="CRT Effects" />
        <TweakSlider label="Scanlines"  value={t.scanlines} min={0} max={0.7} step={0.05} onChange={(v) => setTweak('scanlines', v)} />
        <TweakSlider label="Vignette"   value={t.vignette}  min={0} max={1}   step={0.05} onChange={(v) => setTweak('vignette', v)} />
        <TweakSlider label="Chromatic"  value={t.chroma}    min={0} max={4}   step={0.1}  unit="px" onChange={(v) => setTweak('chroma', v)} />
        <TweakSlider label="Bloom glow" value={t.bloom}     min={0} max={20}  step={1}    unit="px" onChange={(v) => setTweak('bloom', v)} />
        <TweakSlider label="Curvature"  value={t.curvature} min={0} max={80}  step={4}    unit="px" onChange={(v) => setTweak('curvature', v)} />
        <TweakSection label="Motion" />
        <TweakToggle label="Flicker"  value={t.flicker} onChange={(v) => setTweak('flicker', v)} />
        <TweakToggle label="Roll bar" value={t.rollbar} onChange={(v) => setTweak('rollbar', v)} />
        <TweakToggle label="Jitter"   value={t.jitter}  onChange={(v) => setTweak('jitter', v)} />
      </TweaksPanel>

    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
