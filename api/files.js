// api/files.js — Lista los MP3 de Cloudflare R2 y devuelve metadatos con ID3 leído server-side.
// El cliente recibe todo en una sola llamada; el audio nunca pasa por Vercel.
//
// GET /api/files
// Variables de entorno: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY

const crypto = require('crypto');

const BUCKET   = 'metalsys';
const ENDPOINT = 'https://97bd5e1fe0734dd2a333126bb65abbf8.r2.cloudflarestorage.com';
const REGION   = 'auto';
const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const ID3_RANGE    = 'bytes=0-1048575'; // 1 MB — suficiente para cualquier etiqueta ID3

// ── AWS Signature V4 helpers ──────────────────────────────────────────────────

function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}
function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function signingKey(secretKey, date) {
  return hmac(
    hmac(hmac(hmac(Buffer.from('AWS4' + secretKey), date), REGION), 's3'),
    'aws4_request'
  );
}

/**
 * Construye los headers de autenticación AWS Signature V4 para una petición GET
 * a R2/S3 con firma en el header Authorization.
 *
 * @param {string} accessKey
 * @param {string} secretKey
 * @param {string} path       - Ruta URL incluyendo bucket, ej. "/metalsys/key"
 * @param {string} queryStr   - Query string ya ordenada, ej. "list-type=2&max-keys=1000"
 * @param {Object} extraHeaders - Headers adicionales a firmar, ej. { range: 'bytes=0-...' }
 * @returns {{ Authorization, 'x-amz-date', 'x-amz-content-sha256' }}
 */
function signedHeaders(accessKey, secretKey, path, queryStr, extraHeaders = {}) {
  const now      = new Date();
  const date     = now.toISOString().slice(0, 10).replace(/-/g, '');
  const datetime = now.toISOString().replace(/[:\-]/g, '').slice(0, 15) + 'Z';
  const host     = new URL(ENDPOINT).host;
  const scope    = `${date}/${REGION}/s3/aws4_request`;

  // Construir y ordenar los headers a firmar
  const hdrs = { host, 'x-amz-content-sha256': EMPTY_SHA256, 'x-amz-date': datetime };
  for (const [k, v] of Object.entries(extraHeaders)) hdrs[k.toLowerCase()] = v;
  const sortedKeys = Object.keys(hdrs).sort();

  const canonicalHeaders = sortedKeys.map(k => `${k}:${hdrs[k]}\n`).join('');
  const signedHeadersList = sortedKeys.join(';');

  const canonicalRequest = [
    'GET',
    path,
    queryStr,
    canonicalHeaders,
    signedHeadersList,
    EMPTY_SHA256,
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    datetime,
    scope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const sig = crypto.createHmac('sha256', signingKey(secretKey, date))
    .update(stringToSign).digest('hex');

  return {
    'Authorization': `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeadersList}, Signature=${sig}`,
    'x-amz-date': datetime,
    'x-amz-content-sha256': EMPTY_SHA256,
    ...Object.fromEntries(Object.entries(extraHeaders).map(([k, v]) => [k.toLowerCase(), v])),
  };
}

// ── S3 API helpers ────────────────────────────────────────────────────────────

/** Extrae texto de una sola etiqueta XML, p.ej. <Key>valor</Key> */
function xmlTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return m ? m[1] : '';
}

/** Extrae todas las ocurrencias de una etiqueta XML como array de strings */
function xmlTags(xml, tag) {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'g');
  const out = [];
  let m;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}

/** Extrae bloques de un tag contenedor y devuelve el contenido de cada bloque */
function xmlBlocks(xml, tag) {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'g');
  const out = [];
  let m;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}

/**
 * ListObjectsV2: devuelve todos los objetos del bucket (paginado).
 * https://docs.aws.amazon.com/AmazonS3/latest/API/API_ListObjectsV2.html
 */
async function listAllObjects(accessKey, secretKey) {
  const all = [];
  let continuationToken;

  do {
    const qp = { 'list-type': '2', 'max-keys': '1000' };
    if (continuationToken) qp['continuation-token'] = continuationToken;

    const sortedQP = Object.entries(qp)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');

    const hdrs = signedHeaders(accessKey, secretKey, `/${BUCKET}`, sortedQP);

    const res = await fetch(`${ENDPOINT}/${BUCKET}?${sortedQP}`, { headers: hdrs });
    if (!res.ok) {
      throw Object.assign(new Error(`R2 ListObjectsV2 failed: ${res.status}`), { status: 502 });
    }

    const xml = await res.text();
    const blocks = xmlBlocks(xml, 'Contents');
    for (const b of blocks) {
      all.push({
        key:          xmlTag(b, 'Key'),
        size:         parseInt(xmlTag(b, 'Size') || '0', 10),
        lastModified: xmlTag(b, 'LastModified'),
      });
    }

    const truncated = xmlTag(xml, 'IsTruncated') === 'true';
    continuationToken = truncated ? xmlTag(xml, 'NextContinuationToken') : undefined;
  } while (continuationToken);

  return all;
}

// ── Parser ID3v2 (Node.js) ────────────────────────────────────────────────────

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
  const decUtf = new TextDecoder('utf-8'), decUtf16 = new TextDecoder('utf-16'), decLatin = new TextDecoder('latin1');

  while (offset + 10 < end) {
    const frameId = String.fromCharCode(
      view.getUint8(offset), view.getUint8(offset+1),
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
        if (frameId === 'TIT2') tags.title       = text;
        if (frameId === 'TPE1') tags.artist      = text;
        if (frameId === 'TPE2') tags.albumArtist = text;
        if (frameId === 'TALB') tags.album       = text;
        if (frameId === 'TYER' || frameId === 'TDRC') tags.year = text.slice(0, 4);
        if (frameId === 'TCON') tags.genre = text.replace(/^\(?\d+\)?/, '').trim() || text;
        if (frameId === 'TRCK') tags.track = text;
        if (frameId === 'TPOS') tags.disc  = text;
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

function parsePath(filePath) {
  const parts     = filePath.split('/');
  const fileName  = parts[parts.length - 1];
  const artist    = parts[0] || 'DESCONOCIDO';
  const album     = parts.length >= 3 ? parts.slice(1, -1).join('/') : '';
  const nameNoExt = fileName.replace(/\.(mp3|wav|ogg|flac|m4a|aac|opus|aiff|wma)$/i, '');
  const m         = nameNoExt.match(/^(\d+)\s*[-–.]\s*(.+)/);
  return { artist, album, track: m ? m[1] : '', title: m ? m[2].trim() : nameNoExt, fileName };
}

// ── Handler ───────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') { res.status(405).end(); return; }

  const accessKey = process.env.R2_ACCESS_KEY_ID;
  const secretKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accessKey || !secretKey) {
    res.status(500).json({ error: 'Credenciales R2 no configuradas' });
    return;
  }

  try {
    // 1. Listar todos los objetos del bucket
    const allObjects = await listAllObjects(accessKey, secretKey);
    const audioExts  = /\.(mp3|wav|ogg|flac|m4a|aac|opus|aiff|wma)$/i;
    const audioFiles = allObjects.filter(o => audioExts.test(o.key));

    // 2. Leer ID3 de cada archivo en paralelo, en lotes de 5
    const BATCH   = 5;
    const results = [];

    for (let i = 0; i < audioFiles.length; i += BATCH) {
      const batch  = audioFiles.slice(i, i + BATCH);
      const parsed = await Promise.all(batch.map(async ({ key, size, lastModified }) => {
        const fallback = parsePath(key);
        let tags = {};

        try {
          const encodedKey = key.split('/').map(encodeURIComponent).join('/');
          const hdrs = signedHeaders(
            accessKey, secretKey,
            `/${BUCKET}/${encodedKey}`, '',
            { Range: ID3_RANGE }
          );
          const dlRes = await fetch(`${ENDPOINT}/${BUCKET}/${encodedKey}`, { headers: hdrs });
          if (dlRes.ok || dlRes.status === 206) {
            tags = parseID3(await dlRes.arrayBuffer());
          }
        } catch {}

        const artist = tags.albumArtist || tags.artist || fallback.artist;
        const album  = tags.album || fallback.album;

        return {
          id:          `r2:${key}`,
          name:        tags.title  || fallback.title,
          artist,
          album,
          track:       tags.track  || fallback.track,
          disc:        tags.disc   || '',
          year:        tags.year   || '',
          genre:       tags.genre  || '',
          description: album,
          category:    artist,
          fileName:    fallback.fileName,
          fileSize:    size,
          fileType:    'audio/mpeg',
          fileData:    null,
          b2Path:      key,   // campo mantenido por compatibilidad con app.jsx
          thumbnail:   tags.coverArt || null,
          coverArt:    tags.coverArt || null,
          uploadedAt:  lastModified ? new Date(lastModified).getTime() : Date.now(),
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
