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

const COVER_TTL = 7 * 24 * 3600; // 7 días — portadas no cambian

// URL presignada para GET de una portada en _covers/
async function presignedCoverUrl(accessKey, secretKey, prefix) {
  const now      = new Date();
  const date     = now.toISOString().slice(0, 10).replace(/-/g, '');
  const datetime = now.toISOString().replace(/[:\-]/g, '').slice(0, 15) + 'Z';
  const host     = new URL(ENDPOINT).host;
  const service  = 's3';
  const scope    = `${date}/${REGION}/${service}/aws4_request`;
  const coverKey = `_covers/${prefix}.jpg`;
  const encoded  = coverKey.split('/').map(encodeURIComponent).join('/');

  const sigParams = [
    ['X-Amz-Algorithm',     'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential',    `${accessKey}/${scope}`],
    ['X-Amz-Date',          datetime],
    ['X-Amz-Expires',       String(COVER_TTL)],
    ['X-Amz-SignedHeaders', 'host'],
  ].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  const canonicalQS = sigParams
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');

  const canonicalRequest = [
    'GET', `/${BUCKET}/${encoded}`, canonicalQS, `host:${host}\n`, 'host', 'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256', datetime, scope, await sha256Hex(canonicalRequest),
  ].join('\n');

  const k1  = await hmac(te.encode('AWS4' + secretKey), date);
  const k2  = await hmac(k1, REGION);
  const k3  = await hmac(k2, service);
  const k4  = await hmac(k3, 'aws4_request');
  const sig = await hmacHex(k4, stringToSign);

  return `${ENDPOINT}/${BUCKET}/${encoded}?${canonicalQS}&X-Amz-Signature=${sig}`;
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

    // 2. Qué portadas existen realmente en R2 (_covers/)
    const coverExists = new Set();
    try {
      const coverQP = Object.entries({ 'list-type': '2', 'max-keys': '1000', 'prefix': '_covers/' })
        .sort(([a],[b]) => a < b ? -1 : 1)
        .map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
      const coverHdrs = await makeSignedHeaders(accessKey, secretKey, `/${BUCKET}`, coverQP);
      const coverRes  = await fetch(`${ENDPOINT}/${BUCKET}?${coverQP}`, { headers: coverHdrs });
      if (coverRes.ok) {
        const xml = await coverRes.text();
        for (const m of xml.matchAll(/<Key>([\s\S]*?)<\/Key>/g)) coverExists.add(m[1]);
      }
    } catch {}

    // 3. Álbumes únicos → URL presignada solo si la portada existe
    const albumMap = {};
    for (const { key } of audioFiles) {
      const parts  = key.split('/');
      const prefix = parts.length >= 3 ? parts.slice(0, -1).join('/') : parts[0];
      if (!albumMap[prefix]) albumMap[prefix] = null;
    }
    await Promise.all(
      Object.keys(albumMap).map(async prefix => {
        if (coverExists.has(`_covers/${prefix}.jpg`)) {
          albumMap[prefix] = await presignedCoverUrl(accessKey, secretKey, prefix);
        }
      })
    );

    // 4. Construir listado final
    const results = audioFiles.map(({ key, size, lastModified }) => {
      const f      = parsePath(key);
      const parts  = key.split('/');
      const prefix = parts.length >= 3 ? parts.slice(0, -1).join('/') : parts[0];
      return {
        id:          `r2:${key}`,
        name:        f.title,
        artist:      f.artist,
        album:       f.album,
        track:       f.track,
        disc:        '',
        year:        '',
        genre:       '',
        description: f.album,
        category:    f.artist,
        fileName:    f.fileName,
        fileSize:    size,
        fileType:    'audio/mpeg',
        fileData:    null,
        r2Path:      key,
        coverUrl:    albumMap[prefix] || null, // URL presignada de la portada en R2
        thumbnail:   null,
        coverArt:    null,
        uploadedAt:  lastModified ? new Date(lastModified).getTime() : Date.now(),
        downloads:   0,
      };
    });

    // 5 min en CDN de Cloudflare, 1 min en navegador
    return jsonResponse(results, 200, {
      'Cache-Control': 'public, s-maxage=300, max-age=60',
    });

  } catch (err) {
    console.error('[api/files]', err);
    return jsonResponse({ error: err.message }, err.status || 500);
  }
}
