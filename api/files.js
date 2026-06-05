// api/files.js — Lista los MP3 de B2 y devuelve metadatos completos (ID3 leído server-side).
// El cliente recibe todo en una sola llamada, sin descargas en el navegador.
//
// GET /api/files
// Variables de entorno: B2_KEY_ID, B2_APP_KEY, B2_BUCKET_ID (opcional)

const BUCKET   = 'METAL.sys';
const AUTH_URL = 'https://api.backblazeb2.com/b2api/v2/b2_authorize_account';
const AUTH_TTL = 23 * 60 * 60 * 1000;
const ID3_RANGE = 'bytes=0-1048575'; // 1 MB — suficiente para cualquier etiqueta ID3

let _cache = null, _cacheAt = 0;

async function getAuth() {
  if (_cache && Date.now() - _cacheAt < AUTH_TTL) return _cache;

  const creds = Buffer
    .from(`${process.env.B2_KEY_ID}:${process.env.B2_APP_KEY}`)
    .toString('base64');

  const res = await fetch(AUTH_URL, { headers: { Authorization: `Basic ${creds}` } });
  if (!res.ok) throw Object.assign(new Error('B2 auth failed'), { status: 502 });
  const auth = await res.json();

  let bucketId = process.env.B2_BUCKET_ID;
  if (!bucketId) {
    const bRes = await fetch(`${auth.apiUrl}/b2api/v2/b2_list_buckets`, {
      method: 'POST',
      headers: { Authorization: auth.authorizationToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: auth.accountId, bucketName: BUCKET }),
    });
    const bData = await bRes.json();
    bucketId = bData.buckets?.[0]?.bucketId;
    if (!bucketId) throw Object.assign(new Error(`Bucket "${BUCKET}" no encontrado`), { status: 404 });
  }

  _cache = { ...auth, bucketId };
  _cacheAt = Date.now();
  return _cache;
}

// ── Parser ID3v2 (Node.js) ────────────────────────────────────────────────────
// Extrae title/artist/album/year/genre/track + cover art (APIC) de un ArrayBuffer.
function parseID3(buf) {
  if (buf.byteLength < 10) return {};
  const view = new DataView(buf);
  if (String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2)) !== 'ID3') return {};

  const major   = view.getUint8(3);
  const tagSize = ((view.getUint8(6) & 0x7f) << 21) | ((view.getUint8(7) & 0x7f) << 14)
                | ((view.getUint8(8) & 0x7f) << 7)  |  (view.getUint8(9) & 0x7f);

  let offset = 10;
  const end  = Math.min(10 + tagSize, buf.byteLength);
  const tags = {};

  const decUtf   = new TextDecoder('utf-8');
  const decUtf16 = new TextDecoder('utf-16');
  const decLatin = new TextDecoder('latin1');

  while (offset + 10 < end) {
    const frameId = String.fromCharCode(
      view.getUint8(offset),   view.getUint8(offset+1),
      view.getUint8(offset+2), view.getUint8(offset+3)
    );
    if (!/^[A-Z0-9]{4}$/.test(frameId)) break;

    let frameSize;
    if (major === 4) {
      frameSize = ((view.getUint8(offset+4) & 0x7f) << 21) | ((view.getUint8(offset+5) & 0x7f) << 14)
                | ((view.getUint8(offset+6) & 0x7f) << 7)  |  (view.getUint8(offset+7) & 0x7f);
    } else {
      frameSize = view.getUint32(offset + 4);
    }
    if (frameSize <= 0 || offset + 10 + frameSize > end) break;
    const fdStart = offset + 10;

    if (frameId.startsWith('T')) {
      try {
        const enc   = view.getUint8(fdStart);
        const bytes = new Uint8Array(buf, fdStart + 1, frameSize - 1);
        let text;
        if      (enc === 0) text = decLatin.decode(bytes);
        else if (enc === 1) text = decUtf16.decode(bytes);
        else if (enc === 2) text = decUtf16.decode(bytes);
        else                text = decUtf.decode(bytes);
        text = text.replace(/\0+$/g, '').replace(/^﻿/, '').trim();
        if (frameId === 'TIT2') tags.title      = text;
        if (frameId === 'TPE1') tags.artist     = text;
        if (frameId === 'TPE2') tags.albumArtist= text;
        if (frameId === 'TALB') tags.album      = text;
        if (frameId === 'TYER' || frameId === 'TDRC') tags.year = text.slice(0, 4);
        if (frameId === 'TCON') tags.genre = text.replace(/^\(?\d+\)?/, '').trim() || text;
        if (frameId === 'TRCK') tags.track = text;
      } catch {}
    } else if (frameId === 'APIC' && !tags.coverArt) {
      try {
        const frameEnd   = Math.min(fdStart + frameSize, buf.byteLength);
        const frameBytes = new Uint8Array(buf, fdStart, frameEnd - fdStart);
        for (let i = 0; i < frameBytes.length - 3; i++) {
          const isJpeg = frameBytes[i] === 0xFF && frameBytes[i+1] === 0xD8 && frameBytes[i+2] === 0xFF;
          const isPng  = frameBytes[i] === 0x89 && frameBytes[i+1] === 0x50 && frameBytes[i+2] === 0x4E;
          if (isJpeg || isPng) {
            const mime   = isJpeg ? 'image/jpeg' : 'image/png';
            const imgBuf = Buffer.from(new Uint8Array(buf, fdStart + i, frameEnd - (fdStart + i)));
            tags.coverArt = `data:${mime};base64,${imgBuf.toString('base64')}`;
            break;
          }
        }
      } catch {}
    }
    offset = fdStart + frameSize;
  }
  return tags;
}

// Fallback: extrae artista/álbum/pista/título del path cuando no hay ID3
function parsePath(filePath) {
  const parts    = filePath.split('/');
  const fileName = parts[parts.length - 1];
  const artist   = parts[0] || 'DESCONOCIDO';
  const album    = parts.length >= 3 ? parts.slice(1, -1).join('/') : '';
  const nameNoExt = fileName.replace(/\.(mp3|wav|ogg|flac|m4a|aac|opus|aiff|wma)$/i, '');
  const m = nameNoExt.match(/^(\d+)\s*[-–.]\s*(.+)/);
  return {
    artist,
    album,
    track: m ? m[1] : '',
    title: m ? m[2].trim() : nameNoExt,
    fileName,
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') { res.status(405).end(); return; }

  try {
    const { apiUrl, authorizationToken, downloadUrl, bucketId } = await getAuth();

    // 1. Listar todos los archivos del bucket (paginado)
    const allFiles = [];
    let startFileName;
    do {
      const body = { bucketId, maxFileCount: 1000 };
      if (startFileName) body.startFileName = startFileName;

      const listRes = await fetch(`${apiUrl}/b2api/v2/b2_list_file_names`, {
        method: 'POST',
        headers: { Authorization: authorizationToken, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!listRes.ok) {
        if (listRes.status === 401) _cache = null;
        throw Object.assign(new Error('b2_list_file_names failed'), { status: 502 });
      }
      const data = await listRes.json();
      allFiles.push(...data.files);
      startFileName = data.nextFileName;
    } while (startFileName);

    const audioExts = /\.(mp3|wav|ogg|flac|m4a|aac|opus|aiff|wma)$/i;
    const audioFiles = allFiles.filter(f => audioExts.test(f.fileName) && f.action === 'upload');

    // 2. Leer ID3 de cada archivo en paralelo (Range: primeros 1 MB, server-side)
    //    Procesamos en lotes de 5 para no saturar B2.
    const BATCH = 5;
    const results = [];

    for (let i = 0; i < audioFiles.length; i += BATCH) {
      const batch = audioFiles.slice(i, i + BATCH);
      const parsed = await Promise.all(batch.map(async f => {
        const path     = f.fileName;
        const fallback = parsePath(path);
        let tags       = {};

        try {
          const encodedPath = path.split('/').map(encodeURIComponent).join('/');
          const dlRes = await fetch(`${downloadUrl}/file/${BUCKET}/${encodedPath}`, {
            headers: { Authorization: authorizationToken, Range: ID3_RANGE },
          });
          if (dlRes.ok || dlRes.status === 206) {
            const buf = await dlRes.arrayBuffer();
            tags = parseID3(buf);
          }
        } catch {}

        const artist = tags.artist || tags.albumArtist || fallback.artist;
        const album  = tags.album  || fallback.album;

        return {
          id:          `b2:${path}`,
          name:        tags.title  || fallback.title,
          artist,
          album,
          track:       tags.track  || fallback.track,
          year:        tags.year   || '',
          genre:       tags.genre  || '',
          description: album,
          category:    artist,
          fileName:    fallback.fileName,
          fileSize:    f.contentLength,
          fileType:    f.contentType || 'audio/mpeg',
          fileData:    null,
          b2Path:      path,
          thumbnail:   tags.coverArt || null,
          coverArt:    tags.coverArt || null,
          uploadedAt:  f.uploadTimestamp,
          downloads:   0,
        };
      }));
      results.push(...parsed);
    }

    // 5 min en CDN de Vercel, 1 min en navegador
    res.setHeader('Cache-Control', 'public, s-maxage=300, max-age=60');
    res.json(results);

  } catch (err) {
    console.error('[api/files]', err);
    res.status(err.status || 500).json({ error: err.message });
  }
};
