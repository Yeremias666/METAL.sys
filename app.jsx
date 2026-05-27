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

const DEFAULT_CATS = ["JUEGOS", "MÚSICA", "DOCUMENTOS", "IMÁGENES", "VIDEOS", "OTROS"];

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
  try { const c = JSON.parse(localStorage.getItem(CATS_KEY) || '[]'); return c; } catch { return []; }
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
async function readID3(dataURL) {
  try {
    const resp = await fetch(dataURL);
    const buf = await resp.arrayBuffer();
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
    const decUtf = new TextDecoder('utf-8');
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
        const enc = view.getUint8(fdStart);
        const bytes = new Uint8Array(buf, fdStart + 1, frameSize - 1);
        let text;
        if (enc === 0) text = decLatin.decode(bytes);
        else if (enc === 1) text = decUtf16.decode(bytes);
        else if (enc === 2) text = decUtf16.decode(bytes); // utf-16BE no BOM, approx
        else text = decUtf.decode(bytes);
        text = text.replace(/\0+$/g, '').replace(/^\uFEFF/, '').trim();
        if (frameId === 'TIT2') tags.title = text;
        if (frameId === 'TPE1') tags.artist = text;
        if (frameId === 'TPE2') tags.albumArtist = text;
        if (frameId === 'TALB') tags.album = text;
        if (frameId === 'TYER' || frameId === 'TDRC') tags.year = text;
        if (frameId === 'TCON') tags.genre = text;
      } else if (frameId === 'APIC') {
        // Cover art: enc(1) + mime(text\0) + picType(1) + desc(text\0) + image data
        try {
          let p = fdStart;
          const enc = view.getUint8(p); p++;
          let mime = '';
          while (p < fdStart + frameSize && view.getUint8(p) !== 0) {
            mime += String.fromCharCode(view.getUint8(p)); p++;
          }
          p++; // null
          p++; // picType
          // desc null-term in correct encoding (approximation)
          if (enc === 1 || enc === 2) {
            while (p < fdStart + frameSize - 1 && !(view.getUint8(p) === 0 && view.getUint8(p+1) === 0)) p++;
            p += 2;
          } else {
            while (p < fdStart + frameSize && view.getUint8(p) !== 0) p++;
            p++;
          }
          const imgBytes = new Uint8Array(buf, p, fdStart + frameSize - p);
          const blob = new Blob([imgBytes], { type: mime || 'image/jpeg' });
          tags.coverArt = URL.createObjectURL(blob);
        } catch {}
      }
      offset = fdStart + frameSize;
    }
    return tags;
  } catch { return {}; }
}

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
    default:
      return <svg {...props}><polygon points="20,4 36,14 36,28 20,38 4,28 4,14" {...s}/><circle cx="20" cy="21" r="5" {...f}/></svg>;
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

function Nav({ current, onNav, customCats, onCreateCat }) {
  const items = [
    { key: 'INICIO',     glyph: 'INICIO' },
    { key: 'SUBIR',      glyph: 'SUBIR' },
    { key: 'JUEGOS',     glyph: 'JUEGOS' },
    { key: 'MÚSICA',     glyph: 'MÚSICA' },
    { key: 'DOCUMENTOS', glyph: 'DOCUMENTOS' },
    { key: 'IMÁGENES',   glyph: 'IMÁGENES' },
    { key: 'VIDEOS',     glyph: 'VIDEOS' },
    { key: 'OTROS',      glyph: 'OTROS' },
    ...customCats.map((c) => ({ key: c, glyph: null, custom: true })),
  ];
  return (
    <nav className="nav">
      <span className="prompt glow">C:\&gt;</span>
      {items.map((it) => (
        <button key={it.key}
                className={current.page === 'CAT' && current.cat === it.key ? 'active'
                          : current.page === it.key ? 'active' : ''}
                onClick={() => {
                  if (it.key === 'INICIO' || it.key === 'SUBIR') onNav({ page: it.key });
                  else onNav({ page: 'CAT', cat: it.key });
                }}>
          {it.glyph && <NavGlyph kind={it.glyph} />}
          {it.key}
        </button>
      ))}
      <button onClick={onCreateCat} title="Crear nueva categoría">
        <NavGlyph kind="CREAR" />CREAR
      </button>
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
  const total = files.reduce((a, f) => a + f.fileSize, 0);
  const recent = files.slice(0, 8);
  return (
    <div>
      <div className="panel">
        <div className="panel-hd">INICIO <span className="dots">━━━━━━━</span></div>
        <div className="panel-body">
          <div className="hero">
            <h2 className="chroma">// BIENVENIDO A LA BÓVEDA \m/</h2>
            <p>Has conectado con METAL.SYS — el intercambio underground de archivos. Sube cualquier cosa, ponle un nombre, descripción y miniatura, y guárdala en la categoría que quieras.</p>
            <p>Cada archivo vive en tu navegador. Sin servidor, sin cloud, sin tracking. Si limpias el cache, se va al vacío. Trátalos con respeto.</p>
            <p>Vault actual: <span style={{color:'var(--fg-primary)'}}>{files.length} archivo{files.length===1?'':'s'}</span> ocupando <span style={{color:'var(--fg-accent)'}}>{fmtBytes(total)}</span> de {fmtBytes(VAULT_CAP)}.</p>
            <p style={{marginTop: 16}}>
              <span style={{color:'var(--fg-success)'}}>READY.</span>
              <span className="cursor"></span>
            </p>
          </div>
        </div>
      </div>

      <div className="two-col section">
        {/* Quick category nav */}
        <div className="panel">
          <div className="panel-hd">CATEGORÍAS <span className="dots">/// {allCats.length}</span></div>
          <div className="panel-body">
            <div className="cat-grid">
              {allCats.map((c) => {
                const count = files.filter((f) => f.category === c).length;
                return (
                  <div key={c} className="cat-card" onClick={() => onNav({ page: 'CAT', cat: c })}>
                    <CategoryGlyph cat={c} size={36} />
                    <div className="cat-name">{c}</div>
                    <div className="cat-count">{count} archivo{count===1?'':'s'}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Quick upload CTA */}
        <div className="panel">
          <div className="panel-hd">SUBIR RÁPIDO <span className="dots">/// CTA</span></div>
          <div className="panel-body">
            <div className="hero" style={{minHeight: 'unset'}}>
              <p>¿Listo para soltar un artefacto en la bóveda? Cada archivo necesita un nombre, una descripción y una miniatura para que quede como debe.</p>
              <p style={{color:'var(--fg-dim)', fontSize: 18}}>Máximo 8 MB por archivo · 25 MB en total.</p>
              <button className="big-btn" style={{marginTop: 14}} onClick={() => onNav({ page: 'SUBIR' })}>
                ↑ IR A SUBIR ARCHIVO
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
          <div className="panel-hd">ARCHIVOS RECIENTES <span className="dots">// {Math.min(files.length, 8)} DE {files.length}</span></div>
          <div className="panel-body">
            {recent.length === 0 ? (
              <div style={{padding:'24px 0', textAlign:'center', color:'var(--fg-dim)', fontSize:20}}>
                ◇ LA BÓVEDA ESTÁ VACÍA ◇<br/>SUBE TU PRIMER ARTEFACTO ARRIBA
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
function UploadPage({ allCats, vault, onUpload, onNav, onCreateCat }) {
  const [file, setFile] = useState(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState(allCats[0] || 'OTROS');
  const [thumb, setThumb] = useState(null); // data URL
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInput = useRef(null);
  const thumbInput = useRef(null);

  const totalBytes = vault.reduce((a, f) => a + f.fileSize, 0);

  const handleFile = async (f) => {
    if (!f) return;
    setErr("");
    if (f.size > SIZE_CAP) { setErr(`Archivo demasiado grande: ${fmtBytes(f.size)} (máximo 8 MB)`); return; }
    if (totalBytes + f.size > VAULT_CAP) { setErr(`No cabe en la bóveda: agregar ${fmtBytes(f.size)} excedería los 25 MB`); return; }
    setFile(f);
    if (!name) setName(f.name.replace(/\.[^.]+$/, ''));
    if (!cat || cat === 'OTROS') setCat(autoCategory(f.name, f.type || ''));
  };

  const handleThumb = async (f) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) { setErr('La miniatura debe ser una imagen'); return; }
    if (f.size > 5 * 1024 * 1024) { setErr('Miniatura demasiado grande (máximo 5 MB de origen)'); return; }
    try {
      const data = await processThumb(f);
      setThumb(data);
      setErr('');
    } catch (e) {
      setErr('No se pudo procesar la miniatura');
    }
  };

  const submit = () => {
    if (!file) { setErr('Arrastra o elige un archivo'); return; }
    if (!name.trim()) { setErr('Ponle un nombre al archivo'); return; }
    if (!cat) { setErr('Elige una categoría'); return; }
    onUpload({
      _rawFile: file,
      name: name.trim(),
      description: desc.trim(),
      category: cat,
      thumbnail: thumb,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type || 'application/octet-stream',
    });
  };

  return (
    <div>
      <div className="panel">
        <div className="panel-hd">SUBIR ARCHIVO <span className="dots">━━━━━━━</span></div>
        <div className="panel-body">
          <div className="upload-grid">
            {/* LEFT: drop zone */}
            <div>
              <div
                className={"dropzone" + (drag ? " drag" : "") + (file ? " has-file" : "")}
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
                onClick={() => fileInput.current && fileInput.current.click()}
              >
                <div className="dz-glyph">
                  <svg viewBox="0 0 60 60" width="60" height="60">
                    <path d="M30 4 L30 38 M16 22 L30 8 L44 22" fill="none" stroke="currentColor" strokeWidth="3"/>
                    <path d="M6 42 L6 54 L54 54 L54 42" fill="none" stroke="currentColor" strokeWidth="3"/>
                  </svg>
                </div>
                <div className="dz-title">
                  {file ? "✓ ARCHIVO LISTO" : drag ? "SUELTA PARA CARGAR" : "ARRASTRA EL ARCHIVO AQUÍ"}
                </div>
                <div className="dz-sub">
                  {file
                    ? `${file.name} · ${fmtBytes(file.size)}`
                    : "O HAZ CLICK PARA EXPLORAR ◆ MAX 8MB"}
                </div>
                <input ref={fileInput} type="file" style={{display:'none'}}
                       onChange={(e) => handleFile(e.target.files[0])} />
              </div>

              {/* Thumbnail uploader */}
              <div style={{marginTop: 14}}>
                <div className="field-label">MINIATURA <span style={{color:'var(--fg-dim)'}}>· OPCIONAL</span></div>
                <div className="thumb-zone" onClick={() => thumbInput.current && thumbInput.current.click()}>
                  {thumb ? (
                    <img src={thumb} alt="thumb" />
                  ) : (
                    <div className="thumb-empty">
                      <CameraGlyph size={48} />
                      <div style={{fontFamily:'var(--pixel)', fontSize:10, color:'var(--fg-dim)', marginTop:6, letterSpacing:'0.1em'}}>
                        SIN MINIATURA · CLICK PARA AGREGAR
                      </div>
                    </div>
                  )}
                  <input ref={thumbInput} type="file" accept="image/*" style={{display:'none'}}
                         onChange={(e) => handleThumb(e.target.files[0])} />
                </div>
                {thumb && (
                  <button className="mini-btn alt" style={{marginTop: 8}} onClick={() => setThumb(null)}>✕ QUITAR MINIATURA</button>
                )}
              </div>
            </div>

            {/* RIGHT: form */}
            <div className="upload-form">
              <div className="field">
                <div className="field-label">NOMBRE DEL ARCHIVO</div>
                <input className="field-input" value={name} onChange={(e) => setName(e.target.value)}
                       placeholder="Ponle un nombre digno..." maxLength={80} />
              </div>

              <div className="field">
                <div className="field-label">DESCRIPCIÓN</div>
                <textarea className="field-input" value={desc} onChange={(e) => setDesc(e.target.value)}
                          rows={4} maxLength={500}
                          placeholder="¿De qué va? ¿De dónde viene? ¿Por qué importa?"></textarea>
              </div>

              <div className="field">
                <div className="field-label">CATEGORÍA</div>
                <div className="cat-picker">
                  {allCats.map((c) => (
                    <button key={c} className={"cat-pill " + (cat === c ? "on" : "")} onClick={() => setCat(c)}>
                      <CategoryGlyph cat={c} size={18} />
                      <span>{c}</span>
                    </button>
                  ))}
                  <button className="cat-pill new" onClick={onCreateCat}>
                    <NavGlyph kind="CREAR" /><span>CREAR NUEVA</span>
                  </button>
                </div>
              </div>

              {err && <div className="dz-err">! {err}</div>}

              <div className="form-actions">
                <button className="big-btn" disabled={busy} onClick={submit}>
                  {busy ? "GUARDANDO..." : "↑ SUBIR"}
                </button>
                <button className="big-btn ghost" onClick={() => { setFile(null); setName(''); setDesc(''); setThumb(null); setErr(''); }}>
                  ✕ LIMPIAR
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PAGE: CATEGORY ────────────────────────────────────────────
function CategoryPage({ cat, files, onOpenFile, onNav, selectedIds, toggleSel, clearSel, onBulkDownload, onBulkDelete, busy }) {
  const list = files.filter((f) => f.category === cat);
  const [query, setQuery] = useState('');
  const [ext, setExt] = useState('');
  const [dateRange, setDateRange] = useState('all');
  const [sort, setSort] = useState('date-desc');
  const [view, setView] = useState('grid');

  const allExts = [...new Set(list.map(extOf).filter(Boolean))].sort();
  const filtered = filterAndSort(list, { query, ext, dateRange, sort });

  return (
    <div>
      <div className="panel">
        <div className="panel-hd">{cat} <span className="dots">/// {list.length} ARCHIVO{list.length===1?'':'S'}</span></div>
        <div className="panel-body">
          <div className="cat-header">
            <CategoryGlyph cat={cat} size={56} />
            <div>
              <h2 style={{fontFamily:'var(--pixel)', fontSize:18, color:'var(--fg-primary)', textShadow:'0 0 8px var(--fg-primary)'}}>{cat}</h2>
              <p style={{fontSize:20, color:'var(--fg-text)', marginTop: 6}}>
                {list.length === 0
                  ? `Aún no hay archivos en ${cat}. Sube uno para inaugurar la categoría.`
                  : `Todos los archivos de la bóveda etiquetados como ${cat}. ${filtered.length !== list.length ? `${filtered.length} de ${list.length} tras filtrar.` : 'Click en cualquiera para ver el detalle.'}`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {list.length > 0 && (
        <div className="section">
          <SearchBar query={query} setQuery={setQuery} ext={ext} setExt={setExt}
                     dateRange={dateRange} setDateRange={setDateRange}
                     sort={sort} setSort={setSort} view={view} setView={setView}
                     allExts={allExts} />
        </div>
      )}

      <div className="section">
        <div className="panel">
          <div className="panel-hd">RESULTADOS <span className="dots">/// {filtered.length}</span></div>
          <div className="panel-body">
            {list.length === 0 ? (
              <div style={{padding:'40px 0', textAlign:'center', color:'var(--fg-dim)', fontSize: 22}}>
                ◇ CATEGORÍA VACÍA ◇
              </div>
            ) : filtered.length === 0 ? (
              <div style={{padding:'40px 0', textAlign:'center', color:'var(--fg-dim)', fontSize: 22}}>
                ◇ NINGÚN ARCHIVO COINCIDE CON LOS FILTROS ◇
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
              <FileListTable files={filtered} sort={sort} setSort={setSort}
                             onOpen={onOpenFile} selectedIds={selectedIds} toggleSel={toggleSel} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── FILE CARD (grid item) ─────────────────────────────────────
function FileCard({ file, onClick }) {
  return (
    <div className="file-card" onClick={onClick}>
      <div className="file-card-thumb">
        {file.thumbnail
          ? <img src={file.thumbnail} alt={file.name} />
          : <div className="file-card-glyph"><CategoryGlyph cat={file.category} size={56} /></div>}
        <div className="file-card-cat">{file.category}</div>
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
function CreateCategoryModal({ onClose, onSubmit, existing }) {
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const submit = () => {
    const v = name.trim().toUpperCase();
    if (!v) { setErr("Escribe un nombre"); return; }
    if (v.length > 20) { setErr("Máximo 20 caracteres"); return; }
    if (existing.includes(v)) { setErr("Esa categoría ya existe"); return; }
    onSubmit(v);
  };
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
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
          <div style={{marginTop: 12, fontSize: 18, color: 'var(--fg-dim)'}}>
            Se añadirá a la barra de navegación y al selector al subir archivos.
            Las letras se convierten en mayúsculas.
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

function AudioInfo({ file, tags, onPlay, isPlaying }) {
  return (
    <div className="media-view audio-info">
      <div className="audio-card">
        <div className="audio-cover">
          {tags && tags.coverArt
            ? <img src={tags.coverArt} alt="cover" />
            : file.thumbnail
              ? <img src={file.thumbnail} alt="cover" />
              : <div className="audio-cover-empty"><CategoryGlyph cat="MÚSICA" size={80} /></div>}
        </div>
        <div className="audio-meta">
          <div className="audio-title">{(tags && tags.title) || file.name}</div>
          {tags && tags.artist && <div className="audio-artist">▸ {tags.artist}</div>}
          {tags && tags.album && <div className="audio-album">◆ {tags.album}{tags.year ? ' · ' + tags.year : ''}</div>}
          {tags && tags.genre && <div className="audio-genre">{tags.genre}</div>}
          <div className="audio-buttons">
            <button className="big-btn" onClick={onPlay}>
              {isPlaying ? "❚❚ PAUSAR" : "▶ REPRODUCIR"}
            </button>
          </div>
        </div>
      </div>
      <audio src={file.fileData} controls className="audio-fallback" preload="metadata"></audio>
      <div className="media-meta">
        ◆ {file.fileType || 'audio'} · {fmtBytes(file.fileSize)}
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
  // By category
  const byCat = allCats.map((c) => {
    const fs = files.filter((f) => f.category === c);
    return { cat: c, count: fs.length, size: fs.reduce((a, f) => a + f.fileSize, 0) };
  });
  const maxCatSize = Math.max(1, ...byCat.map((c) => c.size));
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
          <div className="player-section-label">USO DEL DISCO ({pct.toFixed(1)}%)</div>
          <div className="meter big"><div className="fill" style={{width: pct + '%'}}></div></div>
        </div>

        <div className="stats-section">
          <div className="player-section-label">POR CATEGORÍA · BYTES OCUPADOS</div>
          <div className="bar-chart">
            {byCat.map((c, i) => {
              const w = (c.size / maxCatSize) * 100;
              const color = folderColors[i % folderColors.length];
              return (
                <div key={c.cat} className="bar-row">
                  <div className="bar-lbl" style={{color}}>{c.cat}</div>
                  <div className="bar-bg">
                    <div className="bar-fill" style={{width: w + '%', background: color, boxShadow: '0 0 8px ' + color}}></div>
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
function MusicPlayer({ track, queue, isPlaying, position, duration, volume, onPlayPause, onSeek, onPrev, onNext, onVolume, onClose, tags }) {
  if (!track) return null;
  const fmtTime = (s) => {
    if (!s || !isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const ss = Math.floor(s % 60);
    return `${m}:${String(ss).padStart(2, '0')}`;
  };
  const progressPct = duration > 0 ? (position / duration) * 100 : 0;
  return (
    <div className="music-player">
      <div className="mp-cover">
        {tags && tags.coverArt
          ? <img src={tags.coverArt} alt="cover" />
          : track.thumbnail
            ? <img src={track.thumbnail} alt="cover" />
            : <div className="mp-cover-empty"><CategoryGlyph cat="MÚSICA" size={36} /></div>}
      </div>
      <div className="mp-info">
        <div className="mp-title">{(tags && tags.title) || track.name}</div>
        <div className="mp-artist">{(tags && tags.artist) || '— sin metadatos —'}{tags && tags.album ? ` · ${tags.album}` : ''}</div>
        <div className="mp-progress">
          <span className="mp-time">{fmtTime(position)}</span>
          <div className="mp-bar" onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const p = (e.clientX - r.left) / r.width;
            onSeek(p * duration);
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
        <span>🔊</span>
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
function DetailPage({ file, onBack, onDownload, onDelete, allCats, onUpdate, onPlayAudio, currentPlayingId, isPlaying, id3Tags, requestID3 }) {
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
            {/* Top: cassette deck w/ thumbnail */}
            <div className="player-deck">
              <div className="deck-reel left"></div>
              <div className="deck-screen">
                {file.thumbnail
                  ? <img src={file.thumbnail} alt={file.name} />
                  : <div className="deck-glyph"><CategoryGlyph cat={file.category} size={120} /></div>}
                <div className="deck-overlay">
                  <div className="deck-cat">▸ {file.category}</div>
                </div>
              </div>
              <div className="deck-reel right"></div>
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
                           isPlaying={currentPlayingId === file.id && isPlaying} />
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
  const catCount = allCats.length;
  const fileCount = files.length;

  const byCat = allCats.map((c) => ({
    cat: c,
    files: files.filter((f) => f.category === c),
  }));

  // Subtle color rotation for category folders so the eye can split them
  const folderClasses = ['fold-a', 'fold-b', 'fold-c', 'fold-d', 'fold-e', 'fold-f'];

  const lines = [];
  lines.push(
    <div key="cmd" className="line">
      <span className="t-prompt">C:\&gt;</span>{' '}
      <span className="t-cmd">ls </span>
      <span className="t-arg">/metal.sys</span>
      <span className="t-cmd"> --tree</span>
    </div>
  );
  lines.push(<div key="path" className="line"><span className="t-path">\METAL.SYS\</span></div>);

  byCat.forEach((entry, ci) => {
    const isLast = ci === byCat.length - 1;
    const elbow = isLast ? '└── ' : '├── ';
    const bar = isLast ? '    ' : '│   ';
    const count = entry.files.length;
    const size = entry.files.reduce((a, f) => a + f.fileSize, 0);
    const folderColor = folderClasses[ci % folderClasses.length];

    lines.push(
      <div key={`dir-${ci}`} className="line">
        <span className="t-box">{elbow}</span>
        <span className={"t-folder " + folderColor}>{entry.cat}</span>
        <span className="t-meta">{' '}{count === 0
          ? '[vacío]'
          : <>[<span className="t-num">{count}</span> archivo{count===1?'':'s'} · <span className="t-num">{fmtBytes(size)}</span>]</>}</span>
      </div>
    );

    entry.files.forEach((f, fi) => {
      const isLastFile = fi === entry.files.length - 1;
      const fileElbow = isLastFile ? '└── ' : '├── ';
      const name = trunc(f.name, 40);
      const ext = (f.fileName.split('.').pop() || '').toUpperCase();
      return lines.push(
        <div key={`file-${ci}-${fi}`} className="line">
          <span className="t-box">{bar}{fileElbow}</span>
          <span className="t-file">{name}</span>
          {ext && <span className="t-ext"> .{ext}</span>}
          <span className="t-meta">  ({fmtBytes(f.fileSize)})</span>
        </div>
      );
    });
  });

  lines.push(<div key="blank" className="line">&nbsp;</div>);
  lines.push(
    <div key="summary" className="line">
      <span className="t-num">{catCount}</span>{' '}<span className="t-label">categoría{catCount===1?'':'s'}</span>
      <span className="t-sep"> · </span>
      <span className="t-num">{fileCount}</span>{' '}<span className="t-label">archivo{fileCount===1?'':'s'}</span>
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
  const [customCats, setCustomCats] = useState(loadCats);
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
  const [currentTrackId, setCurrentTrackId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [id3Cache, setId3Cache] = useState({}); // {fileId: tags}

  useEffect(() => { saveVault(files); }, [files]);
  useEffect(() => { saveCats(customCats); }, [customCats]);
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

  const allCats = [...DEFAULT_CATS, ...customCats];

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
        name: meta.name,
        description: meta.description,
        category: meta.category,
        thumbnail: meta.thumbnail,
        fileName: meta.fileName,
        fileSize: meta.fileSize,
        fileType: meta.fileType,
        fileData: reader.result,
        uploadedAt: Date.now(),
        downloads: 0,
      };
      setFiles((prev) => [entry, ...prev]);
      addToLog({ kind: 'UP', name: entry.name, size: entry.fileSize });
      setTimeout(() => {
        setUploadProgress(null);
        setRoute({ page: 'CAT', cat: meta.category });
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
  const submitCreateCat = (name) => {
    setCustomCats((p) => [...p, name]);
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
  const musicQueue = files.filter((f) => f.category === 'MÚSICA' || isAudioFile(f));
  const currentTrack = currentTrackId ? files.find((f) => f.id === currentTrackId) : null;

  const requestID3 = async (file) => {
    if (id3Cache[file.id] !== undefined) return id3Cache[file.id];
    const tags = await readID3(file.fileData);
    setId3Cache((p) => ({ ...p, [file.id]: tags }));
    return tags;
  };

  const playTrack = (file) => {
    const audio = audioRef.current;
    if (currentTrackId === file.id) {
      // toggle
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
            <Nav current={route} onNav={setRoute} customCats={customCats} onCreateCat={handleCreateCat} />
            <Marquee />

            <div className="grid">
              <div>
                {route.page === 'INICIO' && (
                  <HomePage files={files} allCats={allCats} onOpenFile={openFile} onNav={setRoute} />
                )}
                {route.page === 'SUBIR' && (
                  <UploadPage allCats={allCats} vault={files}
                              onUpload={startUpload} onNav={setRoute} onCreateCat={handleCreateCat} />
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
                                  requestID3={requestID3} />
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
                   tags={currentTrackId ? id3Cache[currentTrackId] : null} />

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
