// app.jsx — METAL.SYS FILE VAULT (categorized, with detail player)

const { useState, useEffect, useRef } = React;

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

const STORAGE_KEY = 'metalsys_vault_v2';
const CATS_KEY = 'metalsys_cats_v2';
const LOG_KEY = 'metalsys_log_v2';
const SIZE_CAP = 8 * 1024 * 1024;
const VAULT_CAP = 25 * 1024 * 1024;

const DEFAULT_CATS = []; // categorías derivadas dinámicamente de los metadatos de los archivos

const ASCII_LOGO = String.raw`
 \m/  ▲▼▲▼▲▼▲▼▲▼  \m/
  __  __ _____ _____  _    _
 |  \/  | ____|_   _|/ \  | |
 | |\/| |  _|   | | / _ \ | |
 | |  | | |___  | |/ ___ \| |___
 |_|  |_|_____| |_/_/   \_\_____|
 \m/  ▲▼▲▼▲▼▲▼▲▼  \m/
`;

const MARQUEE_LINES = [
  "*** METAL.SYS UNDERGROUND VAULT :: ARCHIVA TUS ARTEFACTOS :: COMPÁRTELOS CON LOS TUYOS ***",
  "CATEGORÍAS DISPONIBLES :: JUEGOS · DOCUMENTOS · IMÁGENES · VIDEOS · OTROS · O CREA LA TUYA",
  "PROTOCOLO DE TRANSFERENCIA :: NAVEGADOR NATIVO :: SIN LOGIN :: SIN SERVIDOR :: SIN BS",
  "EACH FILE GETS A NAME, A DESCRIPCIÓN Y UNA MINIATURA :: HAZ QUE TUS UPLOADS TENGAN ESTILO",
  "DRAG · DROP · TAG · SHARE \\m/ ALL FILES STORED ON YOUR LOCAL DECK ◆ DO NOT CLEAR CACHE",
];

// ─── STORAGE ───────────────────────────────────────────────────
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
  a.href = f.fileData;
  a.download = f.fileName || f.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// File type helpers
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

// Minimal ID3v2 tag parser — extracts title/artist/album/year + cover art if present
// Core ID3 parser \u2014 accepts an ArrayBuffer directly
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

// readID3: called when playing (file is a stored data URL)
async function readID3(dataURL) {
  try {
    const resp = await fetch(dataURL);
    const buf  = await resp.arrayBuffer();
    return _parseID3Buffer(buf);
  } catch { return {}; }
}

let _catIconRegistry = {};
function getCatIcon(cat) { return _catIconRegistry[cat] || null; }

// ─── ICONS ─────────────────────────────────────────────────────
// ─── ICONS ────────────────────────────────────
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
    default: return <svg {...p}><circle cx="12" cy="12" r="4" {...f}/></svg>;
  }
}

// ─── CHROME ────────────────────────────────────────────────────
function StatusBar({ count, totalBytes }) {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(id); }, []);
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = `${pad(time.getMonth()+1)}.${pad(time.getDate())}.${String(time.getFullYear()).slice(-2)}`;
  const timeStr = `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`;
  return (
    <div className="statusbar">
      <div className="left">
        <span><span className="blob"></span> VAULT ONLINE</span>
        <span>NODE 03</span>
        <span>{count} ARCHIVO{count===1?'':'S'} :: {fmtBytes(totalBytes)}</span>
      </div>
      <div className="right">
        <span>LIBRE: {fmtBytes(Math.max(0, VAULT_CAP - totalBytes))}</span>
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
        <div className="banner-sub">// UNDERGROUND FILE VAULT BY SYSOP <span style={{color:'var(--fg-primary)'}}>D.CORPSE</span> \m/</div>
        <div className="banner-sub" style={{fontSize:18, color:'var(--fg-dim)'}}>EST. 1986 ◆ ZONA DE INTERCAMBIO ◆ HEAVY · LOUD · UNCENSORED</div>
      </div>
    </div>
  );
}

function Nav({ current, onNav, allCats }) {
  return (
    <nav className="nav">
      <span className="prompt glow">C:\&gt;</span>
      {/* Fixed: Inicio + Subir */}
      {[{ key: 'INICIO', glyph: 'INICIO' }, { key: 'SUBIR', glyph: 'SUBIR' }].map(it => (
        <button key={it.key}
                className={current.page === it.key ? 'active' : ''}
                onClick={() => onNav({ page: it.key })}>
          <NavGlyph kind={it.glyph} />{it.key}
        </button>
      ))}
      {/* Dynamic: one button per artist */}
      {allCats.map(artist => (
        <button key={artist}
                className={current.page === 'CAT' && current.cat === artist ? 'active' : ''}
                onClick={() => onNav({ page: 'CAT', cat: artist })}>
          <NavGlyph kind="MÚSICA" />{artist}
        </button>
      ))}
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
function HomePage({ files, allCats, onOpenFile, onNav }) {
  const total  = files.reduce((a, f) => a + f.fileSize, 0);
  const recent = files.slice(0, 8);
  const songCount   = files.filter(isAudioFile).length;
  const artistCount = allCats.length;

  return (
    <div>
      <div className="panel">
        <div className="panel-hd">INICIO <span className="dots">━━━━━━━</span></div>
        <div className="panel-body">
          <div className="hero">
            <h2 className="chroma">// METAL.SYS · REPRODUCTOR PERSONAL \m/</h2>
            <p>Biblioteca privada de música. Sube tus MP3 y los metadatos se leerán automáticamente — artista, álbum, pista y portada.</p>
            <p>Biblioteca actual: <span style={{color:'var(--fg-primary)'}}>{songCount} canción{songCount===1?'':'es'}</span> de <span style={{color:'var(--fg-accent)'}}>{artistCount} artista{artistCount===1?'':'s'}</span> ocupando <span style={{color:'var(--fg-success)'}}>{fmtBytes(total)}</span>.</p>
            <p style={{marginTop: 16}}>
              <span style={{color:'var(--fg-success)'}}>READY.</span>
              <span className="cursor"></span>
            </p>
          </div>
        </div>
      </div>

      <div className="two-col section">
        {/* Artist grid */}
        <div className="panel">
          <div className="panel-hd">ARTISTAS <span className="dots">/// {artistCount}</span></div>
          <div className="panel-body">
            {artistCount === 0 ? (
              <div style={{padding:'24px 0', textAlign:'center', color:'var(--fg-dim)', fontSize:20}}>
                ◇ BIBLIOTECA VACÍA — SUBE TU PRIMER MP3
              </div>
            ) : (
              <div className="cat-grid">
                {allCats.map((artist) => {
                  const songs  = files.filter(f => (f.artist || f.category) === artist);
                  const albums = [...new Set(songs.map(f => f.album).filter(Boolean))];
                  const cover  = songs.find(f => f.thumbnail);
                  return (
                    <div key={artist} className="cat-card" onClick={() => onNav({ page: 'CAT', cat: artist })}>
                      {cover
                        ? <img src={cover.thumbnail} style={{width:48,height:48,objectFit:'cover',imageRendering:'pixelated',border:'1px solid var(--fg-primary)'}} alt={artist} />
                        : <IconGlyph iconId="nota" size={36} />}
                      <div className="cat-name">{artist}</div>
                      <div className="cat-count">{songs.length} tema{songs.length===1?'':'s'} · {albums.length} disco{albums.length===1?'':'s'}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Add song CTA */}
        <div className="panel">
          <div className="panel-hd">AÑADIR CANCIÓN <span className="dots">/// CTA</span></div>
          <div className="panel-body">
            <div className="hero" style={{minHeight: 'unset'}}>
              <p>Sube un MP3 y los metadatos se detectan solos: artista, álbum, pista, año y portada.</p>
              <p style={{color:'var(--fg-dim)', fontSize: 18}}>Máximo 8 MB por archivo · 25 MB en total.</p>
              <button className="big-btn" style={{marginTop: 14}} onClick={() => onNav({ page: 'SUBIR' })}>
                ♪ AÑADIR CANCIÓN
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <StatsPanel files={files} allCats={allCats} />
      </div>

      <div className="section">
        <div className="panel">
          <div className="panel-hd">AÑADIDAS RECIENTEMENTE <span className="dots">// {Math.min(files.length, 8)} DE {files.length}</span></div>
          <div className="panel-body">
            {recent.length === 0 ? (
              <div style={{padding:'24px 0', textAlign:'center', color:'var(--fg-dim)', fontSize:20}}>
                ◇ BIBLIOTECA VACÍA ◇<br/>SUBE TU PRIMER MP3 ARRIBA
              </div>
            ) : (
              <div className="file-grid">
                {recent.map((f) => <FileCard key={f.id} file={f} onClick={() => onOpenFile(f.id)} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PAGE: SUBIR ───────────────────────────────────────────────
function UploadPage({ allCats, vault, onUpload, onNav, prefillCat }) {
  const [file, setFile]         = useState(null);
  const [name, setName]         = useState('');
  const [artist, setArtist]     = useState('');
  const [album, setAlbum]       = useState('');
  const [track, setTrack]       = useState('');
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
    setTrack(''); setYear(''); setGenre(''); setThumb(null); setCoverArt(null); setErr('');
  };

  const isAudio = file && isAudioFile({ fileName: file.name, fileType: file.type || '' });

  return (
    <div>
      <div className="panel">
        <div className="panel-hd">AÑADIR CANCIÓN <span className="dots">━━━━━━━</span></div>
        <div className="panel-body">
          <div className="upload-grid">
            {/* LEFT: drop zone + portada */}
            <div>
              <div
                className={"dropzone" + (drag ? " drag" : "") + (file ? " has-file" : "")}
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
                onClick={() => fileInput.current && fileInput.current.click()}
              >
                <div className="dz-glyph">
                  <svg viewBox="0 0 60 60" width="60" height="60" fill="none" stroke="currentColor" strokeWidth="3">
                    <ellipse cx="30" cy="46" rx="18" ry="6"/>
                    <circle cx="30" cy="46" r="3" fill="currentColor" stroke="none"/>
                    <line x1="30" y1="4" x2="30" y2="40"/>
                    <line x1="42" y1="4" x2="42" y2="24"/>
                    <line x1="30" y1="4" x2="42" y2="4"/>
                  </svg>
                </div>
                <div className="dz-title">
                  {scanning ? "◆ LEYENDO METADATOS..." : file ? "✓ ARCHIVO LISTO" : drag ? "SUELTA EL MP3" : "ARRASTRA UN MP3 AQUÍ"}
                </div>
                <div className="dz-sub">
                  {file ? `${file.name} · ${fmtBytes(file.size)}` : "O HAZ CLICK PARA EXPLORAR · MAX 8MB"}
                </div>
                <input ref={fileInput} type="file" accept="audio/*" style={{display:'none'}}
                       onChange={(e) => handleFile(e.target.files[0])} />
              </div>

              <div style={{marginTop: 14}}>
                <div className="field-label">PORTADA <span style={{color:'var(--fg-dim)'}}>· {thumb ? 'DETECTADA' : 'OPCIONAL'}</span></div>
                <div className="thumb-zone" onClick={() => thumbInput.current && thumbInput.current.click()}>
                  {thumb
                    ? <img src={thumb} alt="portada" />
                    : <div className="thumb-empty">
                        <CameraGlyph size={48} />
                        <div style={{fontFamily:'var(--pixel)', fontSize:10, color:'var(--fg-dim)', marginTop:6, letterSpacing:'0.1em'}}>
                          SE EXTRAE DEL MP3 O CLICK PARA ELEGIR
                        </div>
                      </div>}
                  <input ref={thumbInput} type="file" accept="image/*" style={{display:'none'}}
                         onChange={(e) => handleThumb(e.target.files[0])} />
                </div>
                {thumb && <button className="mini-btn alt" style={{marginTop:8}} onClick={() => setThumb(null)}>✕ QUITAR PORTADA</button>}
              </div>
            </div>

            {/* RIGHT: metadata form */}
            <div className="upload-form">
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

              {err && <div className="dz-err">! {err}</div>}

              <div className="form-actions">
                <button className="big-btn" disabled={scanning} onClick={submit}>
                  {scanning ? "◆ LEYENDO..." : "↑ AÑADIR"}
                </button>
                <button className="big-btn ghost" onClick={clear}>✕ LIMPIAR</button>
              </div>

              {allCats.length > 0 && (
                <div style={{marginTop:16}}>
                  <div className="field-label" style={{marginBottom:6}}>ARTISTAS EN LA BIBLIOTECA</div>
                  <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                    {allCats.map(a => (
                      <button key={a} className="cat-pill" style={{fontSize:11}}
                              onClick={() => setArtist(a)}>
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PAGE: ARTIST (category = artist) ─────────────────────────
function CategoryPage({ cat, files, onOpenFile, onNav, selectedIds, toggleSel, clearSel, onBulkDownload, onBulkDelete, busy }) {
  const list = files.filter((f) => (f.artist || f.category) === cat);
  const [query, setQuery]       = useState('');
  const [sort, setSort]         = useState('track-asc');
  const [view, setView]         = useState('list');
  const [selAlbum, setSelAlbum] = useState(null);

  // Albums by this artist, sorted by year then name
  const albums = [...new Set(list.map(f => f.album).filter(Boolean))].sort((a, b) => {
    const ya = (list.find(f => f.album === a) || {}).year || '';
    const yb = (list.find(f => f.album === b) || {}).year || '';
    return ya.localeCompare(yb) || a.localeCompare(b);
  });

  const visibleList = selAlbum ? list.filter(f => f.album === selAlbum) : list;
  const allExts = [...new Set(visibleList.map(extOf).filter(Boolean))].sort();

  // Custom sort for music: track number aware
  const sortMusic = (arr, s) => {
    if (s === 'track-asc') {
      return [...arr].sort((a, b) => {
        const ta = parseInt((a.track || '0').split('/')[0]) || 0;
        const tb = parseInt((b.track || '0').split('/')[0]) || 0;
        return ta - tb || a.name.localeCompare(b.name);
      });
    }
    return filterAndSort(arr, { query, ext: '', dateRange: 'all', sort: s });
  };

  const filtered = sortMusic(
    query.trim()
      ? visibleList.filter(f => normStr(f.name).includes(normStr(query)) || normStr(f.album).includes(normStr(query)))
      : visibleList,
    sort
  );

  return (
    <div>
      <div className="panel">
        <div className="panel-hd">
          <span style={{display:'flex', alignItems:'center', gap:8}}>
            <button className="cat-upload-btn" title={`Añadir canción de ${cat}`}
              onClick={() => onNav({ page: 'SUBIR' })}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="miter">
                <line x1="1" y1="2" x2="11" y2="2" strokeLinecap="square"/>
                <line x1="6" y1="4" x2="6" y2="11"/>
                <polyline points="3,7 6,4 9,7"/>
              </svg>
            </button>
            {cat}
          </span>
          <span className="dots">/// {list.length} CANCIÓN{list.length===1?'':'ES'}</span>
        </div>
        <div className="panel-body">
          {/* Album sub-navigation */}
          {albums.length > 0 && (
            <div className="album-subnav">
              <button className={"album-pill" + (!selAlbum ? " on" : "")} onClick={() => setSelAlbum(null)}>
                ◆ TODOS
              </button>
              {albums.map(a => {
                const yr = (list.find(f => f.album === a) || {}).year;
                return (
                  <button key={a} className={"album-pill" + (selAlbum === a ? " on" : "")}
                          onClick={() => setSelAlbum(a === selAlbum ? null : a)}>
                    {a}{yr ? ` · ${yr}` : ''}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Search + sort toolbar */}
      {list.length > 0 && (
        <div className="section">
          <div className="panel searchbar">
            <div className="panel-hd">BUSCADOR <span className="dots">/// FILTROS</span></div>
            <div className="panel-body searchbar-body">
              <div className="search-row">
                <input className="field-input" placeholder="◆ BUSCAR POR TÍTULO O ÁLBUM..."
                       value={query} onChange={(e) => setQuery(e.target.value)} />
                {query && <button className="mini-btn alt" onClick={() => setQuery('')}>✕</button>}
              </div>
              <div className="search-filters">
                <div className="filter-group">
                  <span className="filter-label">ORDEN</span>
                  <select className="field-input filter-select" value={sort} onChange={(e) => setSort(e.target.value)}>
                    <option value="track-asc">Nº PISTA ↑</option>
                    <option value="name-asc">TÍTULO A-Z</option>
                    <option value="name-desc">TÍTULO Z-A</option>
                    <option value="date-desc">AÑADIDO ↓</option>
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
        </div>
      )}

      <div className="section">
        <div className="panel">
          <div className="panel-hd">
            {selAlbum ? selAlbum : cat}
            <span className="dots">/// {filtered.length} CANCIÓN{filtered.length===1?'':'ES'}</span>
          </div>
          <div className="panel-body">
            {list.length === 0 ? (
              <div style={{padding:'40px 0', textAlign:'center', color:'var(--fg-dim)', fontSize: 22}}>
                ◇ ARTISTA VACÍO — AÑADE CANCIONES ◇
              </div>
            ) : filtered.length === 0 ? (
              <div style={{padding:'40px 0', textAlign:'center', color:'var(--fg-dim)', fontSize: 22}}>
                ◇ NINGUNA CANCIÓN COINCIDE ◇
              </div>
            ) : view === 'grid' ? (
              <div className="file-grid">
                {filtered.map((f) => (
                  <div key={f.id} className={"file-card-wrap " + (selectedIds.has(f.id) ? "sel" : "")}>
                    <button className={"file-sel-btn " + (selectedIds.has(f.id) ? "on" : "")}
                            onClick={(e) => { e.stopPropagation(); toggleSel(f.id); }}>
                      {selectedIds.has(f.id) ? '◉' : '◌'}
                    </button>
                    <FileCard file={f} onClick={() => onOpenFile(f.id)} />
                  </div>
                ))}
              </div>
            ) : (
              <TrackListTable files={filtered} sort={sort} setSort={setSort}
                              onOpen={onOpenFile} selectedIds={selectedIds} toggleSel={toggleSel} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── TRACK LIST TABLE (música) ─────────────────────────────────
function TrackListTable({ files, sort, setSort, onOpen, selectedIds, toggleSel }) {
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
            const trackNum = f.track ? f.track.split('/')[0] : '—';
            return (
              <tr key={f.id} className={sel ? 'sel' : ''} onClick={() => onOpen(f.id)}>
                <td className="col-sel" onClick={(e) => { e.stopPropagation(); toggleSel(f.id); }}>
                  <div className={"checkbox " + (sel ? 'on' : '')}>{sel ? '◉' : '◌'}</div>
                </td>
                <td className="col-thumb">
                  {f.thumbnail
                    ? <img src={f.thumbnail} alt="" style={{width:48,height:36,objectFit:'cover',border:'1px solid var(--fg-primary)',imageRendering:'pixelated'}} />
                    : <div className="list-glyph"><IconGlyph iconId="nota" size={28} /></div>}
                </td>
                <td style={{color:'var(--fg-dim)', fontFamily:'var(--pixel)', fontSize:11, width:36, textAlign:'center'}}>{trackNum}</td>
                <td>
                  <div className="list-name">{f.name}</div>
                </td>
                <td style={{color:'var(--fg-secondary)', fontSize:18}}>{f.album || '—'}</td>
                <td style={{color:'var(--fg-dim)', fontFamily:'var(--pixel)', fontSize:10}}>{f.year || '—'}</td>
                <td>{fmtBytes(f.fileSize)}</td>
                <td><button className="mini-btn" onClick={(e) => { e.stopPropagation(); onOpen(f.id); }}>▶</button></td>
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

  return (
    <div className="radio-body">
      {/* Frequency display */}
      <div className="radio-top">
        <div className="radio-band-label">AM·FM·SW</div>
        <div className="radio-freq-display">
          <span className="radio-freq-artist">{(tags && tags.artist) || '— SIN METADATOS —'}</span>
          <div className="radio-freq-title">{(tags && tags.title) || file.name}</div>
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
        {tags && tags.album && (
          <span className="radio-strip-album">◆ {tags.album}{tags.year ? ' · ' + tags.year : ''}</span>
        )}
        {tags && tags.genre && <span className="radio-strip-genre">{tags.genre}</span>}
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

// ─── MUSIC PLAYER (persistent bottom bar) ──────────────────────
function MusicPlayer({ track, queue, isPlaying, position, duration, volume, onPlayPause, onSeek, onPrev, onNext, onVolume, onClose, tags, analyser }) {
  if (!track) return null;
  const BAR_COUNT = 60;
  const vuData = useVuBars(analyser, isPlaying, BAR_COUNT);
  const cover = track.coverArt || track.thumbnail || (tags && tags.coverArt) || null;

  const fmtTime = (s) => {
    if (!s || !isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const ss = Math.floor(s % 60);
    return `${m}:${String(ss).padStart(2, '0')}`;
  };
  const progressPct = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <div className="music-player">
      {/* VU bars — absolutely positioned, growing UP from the top border */}
      <div className="mp-vu" aria-hidden="true">
        {[...vuData].reverse().concat(vuData).map((h, i) => (
          <div key={i} className="mp-vu-bar"
               style={{height: h + '%', opacity: isPlaying ? 1 : 0.15}} />
        ))}
      </div>

      <div className="mp-cover">
        {cover
          ? <img src={cover} alt={track.name} />
          : <div className="mp-cover-empty"><CategoryGlyph cat="MÚSICA" size={36} /></div>}
      </div>
      <div className="mp-info">
        <div className="mp-title">{(tags && tags.title) || track.name}</div>
        <div className="mp-artist">{(tags && tags.artist) || track.artist || '—'}{tags && tags.album ? ` · ${tags.album}` : ''}</div>
        <div className="mp-progress">
          <span className="mp-time">{fmtTime(position)}</span>
          <div className="mp-bar" onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            onSeek((e.clientX - r.left) / r.width * duration);
          }}>
            <div className="mp-bar-fill" style={{width: progressPct + '%'}}></div>
            <div className="mp-bar-knob" style={{left: progressPct + '%'}}></div>
          </div>
          <span className="mp-time">{fmtTime(duration)}</span>
        </div>
      </div>
      <div className="mp-controls">
        <button onClick={onPrev} title="Anterior">◀◀</button>
        <button className="mp-play" onClick={onPlayPause}>{isPlaying ? '❚❚' : '▶'}</button>
        <button onClick={onNext} title="Siguiente">▶▶</button>
      </div>
      <div className="mp-volume">
        <span style={{fontSize:14}}>🔊</span>
        <input type="range" min="0" max="1" step="0.01" value={volume}
               onChange={(e) => onVolume(parseFloat(e.target.value))} />
      </div>
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
  return (
    <div className="panel">
      <div className="panel-hd">TRANSFIRIENDO ARCHIVO <span className="dots">/// {progress.percent.toFixed(1)}%</span></div>
      <div className="panel-body">
        <div className="upload-progress">
          <div className="up-headline">
            <div className="up-name">▸ {progress.name}</div>
            <div className="up-sub">{fmtBytes(progress.bytesLoaded)} / {fmtBytes(progress.bytesTotal)}</div>
          </div>

          <div className="up-meter">
            <div className="up-meter-fill" style={{width: progress.percent + '%'}}></div>
            <div className="up-meter-pct">{progress.percent.toFixed(1)}%</div>
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
function DetailPage({ file, onBack, onDownload, onDelete, allCats, onUpdate, onPlayAudio, currentPlayingId, isPlaying, id3Tags, requestID3, analyser }) {
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
    onUpdate({ ...file, name: draft.name.trim() || file.name, description: draft.description.trim(), category: draft.category });
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
            <button className="mini-btn" onClick={onBack}>◀ VOLVER</button>
            <button className="mini-btn" onClick={() => setEditing(!editing)}>{editing ? '✕ CANCELAR' : '✎ EDITAR'}</button>
            {editing && <button className="mini-btn" style={{borderColor:'var(--fg-accent)', color:'var(--fg-accent)'}} onClick={saveEdit}>✓ GUARDAR</button>}
          </div>

          <div className="player">
            {/* Top: cassette */}
            <div className="player-cassette">
              <div className="player-cassette-brand">TDK SA-90 ◆ VAULT MASTER ◆ NODE 03</div>
              <div className="player-cassette-reels">
                <div className="reel"></div>
                <div className="player-cassette-window">
                  {(file.coverArt || file.thumbnail)
                    ? <img src={file.coverArt || file.thumbnail} alt={file.name} />
                    : <div className="player-cassette-glyph"><CategoryGlyph cat={file.category} size={52} /></div>}
                  <div className="player-cassette-cat">▸ {file.category}</div>
                </div>
                <div className="reel"></div>
              </div>
            </div>

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

            {/* Big action buttons */}
            <div className="player-actions">
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
function NowStreaming({ files, onOpen }) {
  const recent = files[0];
  return (
    <div className="widget">
      <div className="panel">
        <div className="panel-hd">ÚLTIMA SUBIDA <span className="dots">::</span></div>
        <div className="panel-body">
          <div className="cassette" onClick={() => recent && onOpen(recent.id)} style={{cursor: recent ? 'pointer' : 'default'}}>
            <div className="label">TDK SA-90 ◆ VAULT MASTER ◆ NODE 03</div>
            <div className="reels">
              <div className="reel"></div>
              <div className="reel"></div>
            </div>
            <div className="track">
              <strong style={{wordBreak:'break-all'}}>{recent ? recent.name : "— BÓVEDA VACÍA —"}</strong>
              <span style={{color:'var(--fg-secondary)'}}>{recent ? recent.category + ' · ' + fmtBytes(recent.fileSize) : "SUBE TU PRIMER ARCHIVO"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
function DownloadCounter({ files }) {
  const total = files.reduce((a, f) => a + (f.downloads || 0), 0);
  const digits = String(total).padStart(7, '0').split('');
  return (
    <div className="widget">
      <div className="panel">
        <div className="panel-hd">DESCARGAS TOTAL</div>
        <div className="panel-body">
          <div className="counter">
            {digits.map((d, i) => <span key={i} className="digit">{d}</span>)}
          </div>
          <div style={{textAlign:'center', marginTop: 8, fontSize: 17, color: 'var(--fg-dim)'}}>
            {total} PULLS LIFETIME
          </div>
        </div>
      </div>
    </div>
  );
}
function RecentActivity({ log, files, onOpen }) {
  const recent = log.slice(0, 5);
  const byName = (n) => files.find((f) => f.name === n);
  return (
    <div className="widget">
      <div className="panel">
        <div className="panel-hd">ACTIVIDAD <span className="dots">{recent.length} / {log.length}</span></div>
        <div className="panel-body" style={{fontSize:19}}>
          {recent.length === 0 ? (
            <div style={{color:'var(--fg-dim)', textAlign:'center', padding:'8px 0'}}>◇ SIN ACTIVIDAD ◇</div>
          ) : recent.map((e, i) => {
            const f = byName(e.name);
            return (
              <div key={i} style={{
                display:'grid', gridTemplateColumns:'auto 1fr auto', gap: 8,
                padding:'4px 0',
                borderBottom: i < recent.length - 1 ? '1px dotted var(--fg-dim)' : 'none',
                cursor: f ? 'pointer' : 'default'
              }} onClick={() => f && onOpen(f.id)}>
                <span style={{color: e.kind === 'UP' ? 'var(--fg-success)' : e.kind === 'DL' ? 'var(--fg-accent)' : 'var(--fg-primary)'}}>
                  {e.kind === 'UP' ? '↑' : e.kind === 'DL' ? '↓' : '✕'}
                </span>
                <span style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{e.name}</span>
                <span style={{color:'var(--fg-dim)', fontSize:15}}>{fmtBytes(e.size)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── TERMINAL ──────────────────────────────────────────────────
function Terminal({ files, allCats }) {
  const total = files.reduce((a, f) => a + f.fileSize, 0);
  const trunc = (s, n) => s.length > n ? s.slice(0, n - 1) + '…' : s;
  const folderClasses = ['fold-a', 'fold-b', 'fold-c', 'fold-d', 'fold-e', 'fold-f'];

  // Build artist → albums → songs tree
  const byArtist = allCats.map(artist => {
    const songs = files.filter(f => (f.artist || f.category) === artist);
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
      const albumSongs = entry.songs.filter(f => f.album === album)
        .sort((a, b) => (parseInt(a.track)||0) - (parseInt(b.track)||0));
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
      <span className="t-num">{files.length}</span>{' '}<span className="t-label">canción{files.length===1?'':'es'}</span>
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
      <div style={{display:'flex', gap: 10, flexWrap: 'wrap'}}>
        <span className="badge">★ BROWSER NATIVE</span>
        <span className="badge">✓ NO CLOUD</span>
        <span className="badge">◆ NO TRACKING</span>
        <span className="badge">⚡ LOCAL VAULT</span>
      </div>
      <div>
        © MCMXCIX METAL.SYS ◆ &nbsp;\m/ STAY HEAVY \m/
      </div>
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
  if (!audioRef.current) audioRef.current = new Audio();
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
  const [id3Cache, setId3Cache] = useState({}); // {fileId: tags}

  useEffect(() => { saveVault(files); }, [files]);
  useEffect(() => { saveCats(customCats); }, [customCats]);
  useEffect(() => {
    _catIconRegistry = Object.fromEntries(customCats.map(c => [c.name, c.icon]));
  }, [customCats]);
  useEffect(() => { saveLog(log); }, [log]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--scanline-opacity', t.scanlines);
    root.style.setProperty('--vignette', t.vignette);
    root.style.setProperty('--chroma-x', `${t.chroma}px`);
    root.style.setProperty('--curve-radius', `${t.curvature}px`);
    root.style.setProperty('--bloom', `${t.bloom}px`);
    root.style.setProperty('--flicker-strength', t.flicker ? 1 : 0.0001);
  }, [t]);

  // Audio element wiring
  useEffect(() => {
    const audio = audioRef.current;
    const onTime = () => setPosition(audio.currentTime);
    const onDur = () => setDuration(audio.duration || 0);
    const onEnded = () => playNext();
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
  }, [currentTrackId]);
  useEffect(() => { audioRef.current.volume = volume; }, [volume]);

  // Artistas derivados de los archivos; si un archivo antiguo tiene sólo category, se usa eso
  const allArtists = [...new Set(files.map(f => f.artist || f.category).filter(Boolean))].sort();
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
    if (route.page === 'DETAIL') setRoute({ page: 'CAT', cat: f.category });
  };
  const handleUpdate = (f) => {
    setFiles((prev) => prev.map((x) => x.id === f.id ? f : x));
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
  const musicQueue = files.filter(isAudioFile);
  const currentTrack = currentTrackId ? files.find((f) => f.id === currentTrackId) : null;

  const requestID3 = async (file) => {
    if (id3Cache[file.id] !== undefined) return id3Cache[file.id];
    const tags = await readID3(file.fileData);
    setId3Cache((p) => ({ ...p, [file.id]: tags }));
    return tags;
  };

  const playTrack = (file) => {
    const audio = audioRef.current;
    ensureAnalyser();
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
    if (currentTrackId === file.id) {
      if (audio.paused) audio.play(); else audio.pause();
      return;
    }
    audio.src = file.fileData;
    setCurrentTrackId(file.id);
    setPosition(0);
    setDuration(0);
    audio.play().catch(() => {});
    requestID3(file);
  };
  const playPause = () => {
    const audio = audioRef.current;
    if (audio.paused) audio.play().catch(() => {}); else audio.pause();
  };
  const playNext = () => {
    if (musicQueue.length === 0) return;
    const idx = musicQueue.findIndex((f) => f.id === currentTrackId);
    const next = musicQueue[(idx + 1) % musicQueue.length];
    if (next) playTrack(next);
  };
  const playPrev = () => {
    if (musicQueue.length === 0) return;
    const idx = musicQueue.findIndex((f) => f.id === currentTrackId);
    const prev = musicQueue[(idx - 1 + musicQueue.length) % musicQueue.length];
    if (prev) playTrack(prev);
  };
  const seek = (sec) => { audioRef.current.currentTime = sec; setPosition(sec); };
  const stopMusic = () => {
    audioRef.current.pause();
    audioRef.current.src = '';
    setCurrentTrackId(null);
    setIsPlaying(false);
    setPosition(0);
    setDuration(0);
  };

  // Clear multi-select when leaving CAT
  useEffect(() => { if (route.page !== 'CAT') clearSel(); }, [route.page, route.cat]);

  const totalBytes = files.reduce((a, f) => a + f.fileSize, 0);
  const phosphorClass = `phosphor-${t.phosphor}`;
  const currentFile = route.page === 'DETAIL' ? files.find((f) => f.id === route.fileId) : null;

  return (
    <div className={`crt-stage ${phosphorClass}`}>
      <div className="crt-screen" style={{ animationPlayState: t.flicker ? 'running' : 'paused' }}>
        <div className="crt-content" style={{ animationPlayState: t.jitter ? 'running' : 'paused' }}>
          <div className="page">
            <StatusBar count={files.length} totalBytes={totalBytes} />
            <Banner onNav={setRoute} />
            <Nav current={route} onNav={setRoute} allCats={allCats} />
            <Marquee />

            <div className="grid">
              <div>
                {route.page === 'INICIO' && (
                  <HomePage files={files} allCats={allCats} onOpenFile={openFile} onNav={setRoute} />
                )}
                {route.page === 'SUBIR' && (
                  <UploadPage allCats={allCats} vault={files}
                              onUpload={startUpload} onNav={setRoute} onCreateCat={handleCreateCat}
                              prefillCat={route.prefillCat} />
                )}
                {route.page === 'UPLOAD_PROGRESS' && (
                  <UploadProgressPage progress={uploadProgress} />
                )}
                {route.page === 'CAT' && (
                  <CategoryPage cat={route.cat} files={files}
                                onOpenFile={openFile} onNav={setRoute}
                                selectedIds={selectedIds} toggleSel={toggleSel} clearSel={clearSel}
                                onBulkDownload={bulkDownload} onBulkDelete={bulkDelete} busy={bulkBusy} />
                )}
                {route.page === 'DETAIL' && (
                  currentFile
                    ? <DetailPage file={currentFile} onBack={() => setRoute({ page: 'CAT', cat: currentFile.category })}
                                  onDownload={handleDownload} onDelete={handleDelete}
                                  allCats={allCats} onUpdate={handleUpdate}
                                  onPlayAudio={playTrack}
                                  currentPlayingId={currentTrackId}
                                  isPlaying={isPlaying}
                                  id3Tags={id3Cache[currentFile.id]}
                                  requestID3={requestID3}
                                  analyser={analyserRef} />
                    : <div className="panel"><div className="panel-body" style={{textAlign:'center', padding: 40}}>
                        Archivo no encontrado. <button className="mini-btn" onClick={() => setRoute({ page: 'INICIO' })}>VOLVER</button>
                      </div></div>
                )}
              </div>
              <div>
                <NowStreaming files={files} onOpen={openFile} />
                <DownloadCounter files={files} />
                <RecentActivity log={log} files={files} onOpen={openFile} />
              </div>
            </div>

            <Terminal files={files} allCats={allCats} />
            <Footer />
          </div>
        </div>

        <div className="crt-scanlines"></div>
        {t.rollbar && <div className="crt-rollbar"></div>}
        <div className="crt-vignette"></div>
        <div className="crt-glass"></div>
      </div>

      <MultiSelectBar selected={selectedIds} files={files} onClear={clearSel}
                      onDownloadAll={bulkDownload} onDeleteAll={bulkDelete} busy={bulkBusy} />

      <MusicPlayer track={currentTrack} queue={musicQueue} isPlaying={isPlaying}
                   position={position} duration={duration} volume={volume}
                   onPlayPause={playPause} onSeek={seek}
                   onPrev={playPrev} onNext={playNext} onVolume={setVolume}
                   onClose={stopMusic}
                   tags={currentTrackId ? id3Cache[currentTrackId] : null}
                   analyser={analyserRef} />

      {showCreateModal && (
        <CreateCategoryModal
          existing={allCats}
          onClose={() => setShowCreateModal(false)}
          onSubmit={submitCreateCat}
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
