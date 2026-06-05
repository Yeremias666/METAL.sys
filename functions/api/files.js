// functions/api/files.js — Lista MP3 de Cloudflare R2 con metadatos ID3 (Cloudflare Pages Function)
// GET /api/files
//
// Variables de entorno (Pages → Settings → Variables):
//   R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY

const BUCKET      = 'metalsys';
const ENDPOINT    = 'https://97bd5e1fe0734dd2a333126bb65abbf8.r2.cloudflarestorage.com';
const REGION      = 'auto';
const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const ID3_RANGE   = 'bytes=0-1048575'; // 1 MB — suficiente para cualquier etiqueta ID3

// ── Web Crypto helpers ────────────────────────────────────────────────────────

const te = new TextEncoder();

function toBytes(v) {
  return v instanceof Uint8Array ? v : te.encode(String(v));
}

async function hmac(key, data) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', toBytes(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, toBytes(data)));
}

async function hmacHex(key, data) {
  return Array.from(await hmac(key, data))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(str) {
  const hash = await crypto.subtle.digest('SHA-256', te.encode(str));
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── AWS Signature V4 — signed request (Authorization header) ─────────────────
//
// Se usa para peticiones server-to-R2 directas (ListObjectsV2, GetObject).
// La firma va en el header Authorization, no en la query string.

async function makeSignedHeaders(accessKey, secretKey, path, queryStr, extraHeaders = {}) {
  const now      = new Date();
  const date     = now.toISOString().slice(0, 10).replace(/-/g, '');
  const datetime = now.toISOString().replace(/[:\-]/g, '').slice(0, 15) + 'Z';
  const host     = new URL(ENDPOINT).host;
  const scope    = `${date}/${REGION}/s3/aws4_request`;

  // Construir mapa de headers a firmar (todos en minúsculas, requerido por AWS)
  const hdrs = { host, 'x-amz-content-sha256': EMPTY_SHA256, 'x-amz-date': datetime };
  for (const [k, v] of Object.entries(extraHeaders)) hdrs[k.toLowerCase()] = v;

  const sortedKeys        = Object.keys(hdrs).sort();
  const canonicalHeaders  = sortedKeys.map(k => `${k}:${hdrs[k]}\n`).join('');
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
    await sha256Hex(canonicalRequest),
  ].join('\n');

  const k1  = await hmac(te.encode('AWS4' + secretKey), date);
  const k2  = await hmac(k1, REGION);
  const k3  = await hmac(k2, 's3');
  const k4  = await hmac(k3, 'aws4_request');
  const sig = await hmacHex(k4, stringToSign);

  return {
    'Authorization': `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeadersList}, Signature=${sig}`,
    'x-amz-date':              datetime,
    'x-amz-content-sha256':    EMPTY_SHA256,
    // Añadir extraHeaders (ya en minúsculas) para el fetch real
    ...Object.fromEntries(Object.entries(extraHeaders).map(([k, v]) => [k.toLowerCase(), v])),
  };
}

// ── S3 XML helpers ────────────────────────────────────────────────────────────

function xmlTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return m ? m[1] : '';
}

function xmlBlocks(xml, tag) {
  const re  = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'g');
  const out = [];
  let m;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}

// ── S3 ListObjectsV2 (paginado) ───────────────────────────────────────────────

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

    const hdrs = await makeSignedHeaders(accessKey, secretKey, `/${BUCKET}`, sortedQP);
    const res  = await fetch(`${ENDPOINT}/${BUCKET}?${sortedQP}`, { headers: hdrs });

    if (!res.ok) {
      throw Object.assign(new Error(`R2 ListObjectsV2 ${res.status}`), { status: 502 });
    }

    const xml = await res.text();
    for (const block of xmlBlocks(xml, 'Contents')) {
      all.push({
        key:          xmlTag(block, 'Key'),
        size:         parseInt(xmlTag(block, 'Size') || '0', 10),
        lastModified: xmlTag(block, 'LastModified'),
      });
    }

    const truncated = xmlTag(xml, 'IsTruncated') === 'true';
    continuationToken = truncated ? xmlTag(xml, 'NextContinuationToken') : undefined;
  } while (continuationToken);

  return all;
}

// ── Parser ID3v2 ─────────────────────────────────────────────────────────────
// DataView, Uint8Array y TextDecoder son globales en Workers.
// Buffer (Node.js) NO existe — se usa btoa() para base64.

function uint8ToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

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
      view.getUint8(offset), view.getUint8(offset + 1),
      view.getUint8(offset + 2), view.getUint8(offset + 3)
    );
    if (!/^[A-Z0-9]{4}$/.test(frameId)) break;

    let frameSize;
    if (major === 4) {
      frameSize = ((view.getUint8(offset + 4) & 0x7f) << 21) | ((view.getUint8(offset + 5) & 0x7f) << 14)
                | ((view.getUint8(offset + 6) & 0x7f) << 7)  |  (view.getUint8(offset + 7) & 0x7f);
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
          const isJpeg = frameBytes[i] === 0xFF && frameBytes[i + 1] === 0xD8 && frameBytes[i + 2] === 0xFF;
          const isPng  = frameBytes[i] === 0x89 && frameBytes[i + 1] === 0x50 && frameBytes[i + 2] === 0x4E;
          if (isJpeg || isPng) {
            const mime     = isJpeg ? 'image/jpeg' : 'image/png';
            const imgBytes = new Uint8Array(buf, fdStart + i, frameEnd - (fdStart + i));
            tags.coverArt  = `data:${mime};base64,${uint8ToBase64(imgBytes)}`;
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

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

export async function onRequest({ request, env }) {
  if (request.method !== 'GET') {
    return new Response(null, { status: 405 });
  }

  const accessKey = env.R2_ACCESS_KEY_ID;
  const secretKey = env.R2_SECRET_ACCESS_KEY;
  if (!accessKey || !secretKey) {
    return jsonResponse({ error: 'Credenciales R2 no configuradas' }, 500);
  }

  try {
    // 1. Listar todos los objetos del bucket (paginado)
    const allObjects = await listAllObjects(accessKey, secretKey);
    const audioExts  = /\.(mp3|wav|ogg|flac|m4a|aac|opus|aiff|wma)$/i;
    const audioFiles = allObjects.filter(o => audioExts.test(o.key));

    // 2. Leer ID3 de cada archivo en lotes de 5 para no saturar R2
    const BATCH   = 5;
    const results = [];

    for (let i = 0; i < audioFiles.length; i += BATCH) {
      const batch  = audioFiles.slice(i, i + BATCH);
      const parsed = await Promise.all(batch.map(async ({ key, size, lastModified }) => {
        const fallback   = parsePath(key);
        let tags         = {};

        try {
          const encodedKey = key.split('/').map(encodeURIComponent).join('/');
          const hdrs = await makeSignedHeaders(
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
          b2Path:      key,   // mantenido por compatibilidad con app.jsx
          thumbnail:   tags.coverArt || null,
          coverArt:    tags.coverArt || null,
          uploadedAt:  lastModified ? new Date(lastModified).getTime() : Date.now(),
          downloads:   0,
        };
      }));
      results.push(...parsed);
    }

    // 5 min en CDN de Cloudflare, 1 min en navegador
    return jsonResponse(results, 200, {
      'Cache-Control': 'public, s-maxage=300, max-age=60',
    });

  } catch (err) {
    console.error('[api/files]', err);
    return jsonResponse({ error: err.message }, err.status || 500);
  }
}
