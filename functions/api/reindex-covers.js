// functions/api/reindex-covers.js
// Extrae portadas de los MP3 y las sube como _covers/Artista/Album.jpg a R2.
// Procesa 15 álbumes por llamada para no superar el límite de tiempo.
//
// Uso desde la consola del navegador (llámalo en bucle hasta done=true):
//   await fetch('/api/reindex-covers?offset=0').then(r=>r.json()).then(console.log)
//
// O usa el botón "Reindexar portadas" en la página de Inicio.

const BUCKET    = 'metalsys';
const ENDPOINT  = 'https://97bd5e1fe0734dd2a333126bb65abbf8.r2.cloudflarestorage.com';
const REGION    = 'auto';
const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const ID3_RANGE = 'bytes=0-1048575'; // 1 MB — captura cualquier portada por grande que sea
const PER_CALL  = 15;

const te = new TextEncoder();

function toBytes(v) { return v instanceof Uint8Array ? v : te.encode(String(v)); }

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

function dataUrlToBytes(dataUrl) {
  const b64    = dataUrl.split(',')[1];
  const binary = atob(b64);
  const out    = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
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

// ID3 parser mínimo — solo extrae APIC (portada)
function extractCover(buf) {
  if (buf.byteLength < 10) return null;
  const view = new DataView(buf);
  if (String.fromCharCode(view.getUint8(0),view.getUint8(1),view.getUint8(2)) !== 'ID3') return null;
  const major   = view.getUint8(3);
  const tagSize = ((view.getUint8(6)&0x7f)<<21)|((view.getUint8(7)&0x7f)<<14)|((view.getUint8(8)&0x7f)<<7)|(view.getUint8(9)&0x7f);
  let offset = 10;
  const end  = Math.min(10+tagSize, buf.byteLength);
  while (offset+10 < end) {
    const fid = String.fromCharCode(view.getUint8(offset),view.getUint8(offset+1),view.getUint8(offset+2),view.getUint8(offset+3));
    if (!/^[A-Z0-9]{4}$/.test(fid)) break;
    let fs;
    if (major===4) fs=((view.getUint8(offset+4)&0x7f)<<21)|((view.getUint8(offset+5)&0x7f)<<14)|((view.getUint8(offset+6)&0x7f)<<7)|(view.getUint8(offset+7)&0x7f);
    else fs=view.getUint32(offset+4);
    if (fs<=0||offset+10+fs>end) break;
    const fdStart = offset+10;
    if (fid==='APIC') {
      try {
        const frameEnd   = Math.min(fdStart+fs, buf.byteLength);
        const frameBytes = new Uint8Array(buf, fdStart, frameEnd-fdStart);
        for (let i=0; i<frameBytes.length-3; i++) {
          const isJpeg = frameBytes[i]===0xFF&&frameBytes[i+1]===0xD8&&frameBytes[i+2]===0xFF;
          const isPng  = frameBytes[i]===0x89&&frameBytes[i+1]===0x50&&frameBytes[i+2]===0x4E;
          if (isJpeg||isPng) {
            return { bytes: new Uint8Array(buf, fdStart+i, frameEnd-(fdStart+i)), mime: isJpeg?'image/jpeg':'image/png' };
          }
        }
      } catch {}
    }
    offset = fdStart+fs;
  }
  return null;
}

async function listAllAudio(accessKey, secretKey) {
  const all = []; let ct;
  const audioExts = /\.(mp3|wav|ogg|flac|m4a|aac|opus|aiff|wma)$/i;
  do {
    const qp = { 'list-type':'2','max-keys':'1000' };
    if (ct) qp['continuation-token'] = ct;
    const sq = Object.entries(qp).sort(([a],[b])=>a<b?-1:1).map(([k,v])=>`${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    const hdrs = await makeGetHeaders(accessKey, secretKey, `/${BUCKET}`, sq);
    const res  = await fetch(`${ENDPOINT}/${BUCKET}?${sq}`, { headers: hdrs });
    if (!res.ok) throw new Error(`ListObjects ${res.status}`);
    const xml = await res.text();
    const blocks = [...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)].map(m=>m[1]);
    for (const b of blocks) {
      const key = b.match(/<Key>([\s\S]*?)<\/Key>/)?.[1];
      if (key && audioExts.test(key)) all.push(key);
    }
    const trunc = xml.match(/<IsTruncated>([\s\S]*?)<\/IsTruncated>/)?.[1]==='true';
    ct = trunc ? xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/)?.[1] : undefined;
  } while (ct);
  return all;
}

function jsonRes(body, status=200) {
  return new Response(JSON.stringify(body), { status, headers:{'Content-Type':'application/json'} });
}

export async function onRequest({ request, env }) {
  if (request.method !== 'GET') return new Response(null,{status:405});
  const accessKey = env.R2_ACCESS_KEY_ID;
  const secretKey = env.R2_SECRET_ACCESS_KEY;
  if (!accessKey||!secretKey) return jsonRes({error:'Credenciales no configuradas'},500);

  const offset = parseInt(new URL(request.url).searchParams.get('offset')||'0', 10);

  try {
    const allKeys = await listAllAudio(accessKey, secretKey);

    // Una canción representativa por álbum
    const albumMap = {};
    for (const key of allKeys) {
      const parts  = key.split('/');
      const prefix = parts.length>=3 ? parts.slice(0,-1).join('/') : parts[0];
      if (!albumMap[prefix]) albumMap[prefix] = key;
    }

    const albums  = Object.entries(albumMap);
    const total   = albums.length;
    const batch   = albums.slice(offset, offset+PER_CALL);
    const next    = offset+PER_CALL;
    const done    = next >= total;

    // Procesar el batch: leer MP3, extraer portada, subir como _covers/...
    const results = await Promise.allSettled(batch.map(async ([prefix, repKey]) => {
      const coverKey    = `_covers/${prefix}.jpg`;
      const encodedAudio = repKey.split('/').map(encodeURIComponent).join('/');
      const encodedCover = coverKey.split('/').map(encodeURIComponent).join('/');

      // Leer primeros 200KB del MP3
      const getHdrs = await makeGetHeaders(accessKey, secretKey, `/${BUCKET}/${encodedAudio}`, '', { Range: ID3_RANGE });
      const dlRes   = await fetch(`${ENDPOINT}/${BUCKET}/${encodedAudio}`, { headers: getHdrs });
      if (!dlRes.ok && dlRes.status!==206) return { prefix, ok:false, reason:`dl ${dlRes.status}` };

      const cover = extractCover(await dlRes.arrayBuffer());
      if (!cover) return { prefix, ok:false, reason:'no cover' };

      // Subir portada a R2
      const putHdrs = await makePutHeaders(accessKey, secretKey, `/${BUCKET}/${encodedCover}`, cover.mime, cover.bytes);
      const putRes  = await fetch(`${ENDPOINT}/${BUCKET}/${encodedCover}`, {
        method:'PUT', headers:putHdrs, body:cover.bytes,
      });
      return { prefix, ok:putRes.ok, status:putRes.status };
    }));

    const processed = results.filter(r=>r.status==='fulfilled'&&r.value?.ok).length;
    return jsonRes({ done, offset, next: done ? null : next, total, processed, batchSize: batch.length });

  } catch(err) {
    console.error('[reindex-covers]', err);
    return jsonRes({ error:err.message },500);
  }
}
