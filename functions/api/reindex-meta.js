// functions/api/reindex-meta.js
// Lee etiquetas ID3 de todos los MP3 en R2 y las guarda en _meta/index.json.
// Solo procesa archivos que aún no están en el índice — nunca sobreescribe entradas existentes.
// Procesa PER_CALL archivos por llamada para no superar el límite de tiempo.
//
// Uso desde la consola del navegador (llámalo en bucle hasta done=true):
//   await fetch('/api/reindex-meta?offset=0').then(r=>r.json()).then(console.log)

const BUCKET     = 'metalsys';
const ENDPOINT   = 'https://97bd5e1fe0734dd2a333126bb65abbf8.r2.cloudflarestorage.com';
const REGION     = 'auto';
const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const ID3_RANGE  = 'bytes=0-262143'; // 256 KB — más que suficiente para etiquetas ID3 de texto
const META_KEY   = '_meta/index.json';
const PER_CALL   = 8;

const te = new TextEncoder();
function toBytes(v) { return v instanceof Uint8Array ? v : te.encode(String(v)); }
const awsEncode = s => encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
const unxml = s => s.replace(/&amp;/g,'&').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"');

async function hmac(key, data) {
  const ck = await crypto.subtle.importKey('raw', toBytes(key), { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', ck, toBytes(data)));
}
async function hmacHex(key, data) {
  return Array.from(await hmac(key, data)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function sha256Hex(data) {
  const bytes = data instanceof Uint8Array ? data : te.encode(String(data));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
}

async function makeGetHeaders(accessKey, secretKey, path, queryStr, extraHeaders = {}) {
  const now      = new Date();
  const date     = now.toISOString().slice(0,10).replace(/-/g,'');
  const datetime = now.toISOString().replace(/[:\-]/g,'').slice(0,15)+'Z';
  const host     = new URL(ENDPOINT).host;
  const scope    = `${date}/${REGION}/s3/aws4_request`;
  const hdrs     = { host, 'x-amz-content-sha256': EMPTY_SHA256, 'x-amz-date': datetime };
  for (const [k,v] of Object.entries(extraHeaders)) hdrs[k.toLowerCase()] = v;
  const sortedKeys        = Object.keys(hdrs).sort();
  const canonicalHeaders  = sortedKeys.map(k=>`${k}:${hdrs[k]}\n`).join('');
  const signedHeadersList = sortedKeys.join(';');
  const canonicalRequest  = ['GET', path, queryStr, canonicalHeaders, signedHeadersList, EMPTY_SHA256].join('\n');
  const stringToSign      = ['AWS4-HMAC-SHA256', datetime, scope, await sha256Hex(canonicalRequest)].join('\n');
  const k1 = await hmac(te.encode('AWS4'+secretKey), date);
  const k2 = await hmac(k1, REGION); const k3 = await hmac(k2, 's3'); const k4 = await hmac(k3, 'aws4_request');
  const sig = await hmacHex(k4, stringToSign);
  return {
    'Authorization': `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeadersList}, Signature=${sig}`,
    'x-amz-date': datetime, 'x-amz-content-sha256': EMPTY_SHA256,
    ...Object.fromEntries(Object.entries(extraHeaders).map(([k,v])=>[k.toLowerCase(),v])),
  };
}

async function makePutHeaders(accessKey, secretKey, path, contentType, bodyBytes) {
  const now      = new Date();
  const date     = now.toISOString().slice(0,10).replace(/-/g,'');
  const datetime = now.toISOString().replace(/[:\-]/g,'').slice(0,15)+'Z';
  const host     = new URL(ENDPOINT).host;
  const scope    = `${date}/${REGION}/s3/aws4_request`;
  const bodyHash = await sha256Hex(bodyBytes);
  const hdrs     = { 'content-type': contentType, host, 'x-amz-content-sha256': bodyHash, 'x-amz-date': datetime };
  const sortedKeys        = Object.keys(hdrs).sort();
  const canonicalHeaders  = sortedKeys.map(k=>`${k}:${hdrs[k]}\n`).join('');
  const signedHeadersList = sortedKeys.join(';');
  const canonicalRequest  = ['PUT', path, '', canonicalHeaders, signedHeadersList, bodyHash].join('\n');
  const stringToSign      = ['AWS4-HMAC-SHA256', datetime, scope, await sha256Hex(canonicalRequest)].join('\n');
  const k1 = await hmac(te.encode('AWS4'+secretKey), date);
  const k2 = await hmac(k1, REGION); const k3 = await hmac(k2, 's3'); const k4 = await hmac(k3, 'aws4_request');
  const sig = await hmacHex(k4, stringToSign);
  return {
    'Authorization': `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeadersList}, Signature=${sig}`,
    'x-amz-date': datetime, 'x-amz-content-sha256': bodyHash, 'content-type': contentType,
  };
}

async function listAllAudio(accessKey, secretKey) {
  const all = []; let ct;
  const audioExts = /\.(mp3|wav|ogg|flac|m4a|aac|opus|aiff|wma)$/i;
  do {
    const qp = { 'list-type':'2', 'max-keys':'1000' };
    if (ct) qp['continuation-token'] = ct;
    const sq = Object.entries(qp).sort(([a],[b])=>a<b?-1:1).map(([k,v])=>`${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    const hdrs = await makeGetHeaders(accessKey, secretKey, `/${BUCKET}`, sq);
    const res  = await fetch(`${ENDPOINT}/${BUCKET}?${sq}`, { headers: hdrs });
    if (!res.ok) throw new Error(`ListObjects ${res.status}`);
    const xml = await res.text();
    for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const key = m[1].match(/<Key>([\s\S]*?)<\/Key>/)?.[1];
      if (key && audioExts.test(key)) all.push(unxml(key));
    }
    const trunc = xml.match(/<IsTruncated>([\s\S]*?)<\/IsTruncated>/)?.[1] === 'true';
    ct = trunc ? xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/)?.[1] : undefined;
  } while (ct);
  return all;
}

// Parser ID3v2 — soporta v2.2 (3 chars), v2.3 y v2.4 (4 chars)
function parseID3(buf) {
  if (buf.byteLength < 10) return {};
  const view = new DataView(buf);
  if (String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2)) !== 'ID3') return {};

  const major   = view.getUint8(3);
  const tagSize = ((view.getUint8(6)&0x7f)<<21)|((view.getUint8(7)&0x7f)<<14)|((view.getUint8(8)&0x7f)<<7)|(view.getUint8(9)&0x7f);
  const end     = Math.min(10 + tagSize, buf.byteLength);
  const tags    = {};

  const decUtf   = new TextDecoder('utf-8');
  const decUtf16 = new TextDecoder('utf-16');
  const decLatin = new TextDecoder('latin1');

  const decodeText = (enc, bytes) => {
    let text;
    if      (enc === 0) text = decLatin.decode(bytes);
    else if (enc === 1) text = decUtf16.decode(bytes);
    else if (enc === 2) text = decUtf16.decode(bytes);
    else                text = decUtf.decode(bytes);
    return text.replace(/\0+$/g, '').replace(/^﻿/, '').trim();
  };

  // ── ID3v2.2: frames de 3 chars + 3 bytes de tamaño ─────────────
  if (major === 2) {
    let o = 10;
    while (o + 6 < end) {
      const fid = String.fromCharCode(view.getUint8(o), view.getUint8(o+1), view.getUint8(o+2));
      if (!/^[A-Z0-9]{3}$/.test(fid)) break;
      const fs = (view.getUint8(o+3)<<16)|(view.getUint8(o+4)<<8)|view.getUint8(o+5);
      if (fs <= 0 || o+6+fs > end) break;
      if (fid.startsWith('T')) {
        try {
          const text = decodeText(view.getUint8(o+6), new Uint8Array(buf, o+7, fs-1));
          if (fid === 'TT2') tags.title       = text;
          if (fid === 'TP1') tags.artist      = text;
          if (fid === 'TP2') tags.albumArtist = text;
          if (fid === 'TAL') tags.album       = text;
          if (fid === 'TYE') tags.year        = text.slice(0, 4);
          if (fid === 'TCO') tags.genre       = text.replace(/^\(?\d+\)?/, '').trim() || text;
          if (fid === 'TRK') tags.track       = text;
          if (fid === 'TPA') tags.disc        = text;
        } catch {}
      }
      o += 6 + fs;
    }
    return tags;
  }

  // ── ID3v2.3 / v2.4: frames de 4 chars + 4 bytes de tamaño ──────
  let o = 10;
  while (o + 10 < end) {
    const fid = String.fromCharCode(view.getUint8(o), view.getUint8(o+1), view.getUint8(o+2), view.getUint8(o+3));
    if (!/^[A-Z0-9]{4}$/.test(fid)) break;
    const fs = major === 4
      ? ((view.getUint8(o+4)&0x7f)<<21)|((view.getUint8(o+5)&0x7f)<<14)|((view.getUint8(o+6)&0x7f)<<7)|(view.getUint8(o+7)&0x7f)
      : view.getUint32(o+4);
    if (fs <= 0 || o+10+fs > end) break;
    const fd = o + 10;
    if (fid.startsWith('T')) {
      try {
        const text = decodeText(view.getUint8(fd), new Uint8Array(buf, fd+1, fs-1));
        if (fid === 'TIT2') tags.title       = text;
        if (fid === 'TPE1') tags.artist      = text;
        if (fid === 'TPE2') tags.albumArtist = text;
        if (fid === 'TALB') tags.album       = text;
        if (fid === 'TYER' || fid === 'TDRC') tags.year  = text.slice(0, 4);
        if (fid === 'TCON') tags.genre  = text.replace(/^\(?\d+\)?/, '').trim() || text;
        if (fid === 'TRCK') tags.track  = text;
        if (fid === 'TPOS') tags.disc   = text;
      } catch {}
    }
    o = fd + fs;
  }
  return tags;
}

function jsonRes(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function onRequest({ request, env }) {
  if (request.method !== 'GET') return new Response(null, { status: 405 });
  const accessKey = env.R2_ACCESS_KEY_ID;
  const secretKey = env.R2_SECRET_ACCESS_KEY;
  if (!accessKey || !secretKey) return jsonRes({ error: 'Credenciales no configuradas' }, 500);

  try {
    const allKeys = await listAllAudio(accessKey, secretKey);

    // Leer índice existente desde R2
    let metaIndex = {};
    try {
      const metaPath = `/${BUCKET}/${META_KEY}`;
      const metaHdrs = await makeGetHeaders(accessKey, secretKey, metaPath, '');
      const metaRes  = await fetch(`${ENDPOINT}${metaPath}`, { headers: metaHdrs });
      if (metaRes.ok) metaIndex = await metaRes.json();
    } catch {}

    // Solo archivos que aún no están en el índice
    // Siempre tomamos los primeros PER_CALL — no se usa offset porque la lista
    // mengua con cada llamada y un offset fijo saltaría entradas.
    const missing   = allKeys.filter(k => !metaIndex[k]);
    const total     = allKeys.length;
    const remaining = missing.length;
    const batch     = missing.slice(0, PER_CALL);
    const done      = remaining === 0;

    // Procesar batch: descargar primeros 256 KB, parsear ID3, guardar en índice
    const results = await Promise.allSettled(batch.map(async key => {
      const encodedKey = key.split('/').map(awsEncode).join('/');
      const getHdrs    = await makeGetHeaders(accessKey, secretKey, `/${BUCKET}/${encodedKey}`, '', { Range: ID3_RANGE });
      const dlRes      = await fetch(`${ENDPOINT}/${BUCKET}/${encodedKey}`, { headers: getHdrs });
      if (!dlRes.ok && dlRes.status !== 206) return { key, ok: false, reason: `dl_${dlRes.status}` };

      const buf  = await dlRes.arrayBuffer();
      const tags = parseID3(buf);
      metaIndex[key] = {
        title:       tags.title       || '',
        artist:      tags.artist      || '',
        albumArtist: tags.albumArtist || '',
        album:       tags.album       || '',
        year:        tags.year        || '',
        genre:       tags.genre       || '',
        track:       tags.track       || '',
        disc:        tags.disc        || '',
      };
      return { key, ok: true, tags: metaIndex[key] };
    }));

    // Guardar índice actualizado en R2
    if (batch.length > 0) {
      const jsonBytes  = te.encode(JSON.stringify(metaIndex));
      const metaPath   = `/${BUCKET}/${META_KEY}`;
      const putHdrs    = await makePutHeaders(accessKey, secretKey, metaPath, 'application/json', jsonBytes);
      const putRes     = await fetch(`${ENDPOINT}${metaPath}`, { method: 'PUT', headers: putHdrs, body: jsonBytes });
      if (!putRes.ok) {
        const body = await putRes.text().catch(() => '');
        return jsonRes({ error: `Error al guardar índice: ${putRes.status} ${body.slice(0, 120)}` }, 500);
      }
    }

    const processed = results.filter(r => r.status === 'fulfilled' && r.value?.ok).length;
    const details   = results.map(r => r.status === 'fulfilled' ? r.value : { ok: false, reason: 'exception:' + r.reason?.message });
    const doneAfter = missing.length - batch.length === 0;
    return jsonRes({ done: doneAfter, total, remaining: remaining - processed, processed, batchSize: batch.length, details });

  } catch (err) {
    console.error('[reindex-meta]', err);
    return jsonRes({ error: err.message }, 500);
  }
}
