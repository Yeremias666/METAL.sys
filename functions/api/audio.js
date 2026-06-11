// functions/api/audio.js — Proxy streaming de Cloudflare R2 (Cloudflare Pages Function)
// GET /api/audio?path=Artista/Album/01%20-%20Titulo.mp3
// → stream de audio directo desde R2, con soporte Range para seeking
//
// El Worker firma la petición server-side (no hay URL presignada expuesta al navegador),
// por lo que no hay problemas de CORS: el navegador solo habla con el mismo origen.
//
// Variables de entorno (Pages → Settings → Variables):
//   R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY

const BUCKET   = 'metalsys';
const ENDPOINT = 'https://97bd5e1fe0734dd2a333126bb65abbf8.r2.cloudflarestorage.com';
const REGION   = 'auto';
const TTL      = 3600;

// ── Web Crypto helpers ────────────────────────────────────────────────────────

const te = new TextEncoder();

const awsEncode = s => encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());

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

// ── AWS Signature V4 — presigned GET URL ─────────────────────────────────────

async function presignedGet(accessKey, secretKey, objectKey, ttlSeconds) {
  const now      = new Date();
  const date     = now.toISOString().slice(0, 10).replace(/-/g, '');
  const datetime = now.toISOString().replace(/[:\-]/g, '').slice(0, 15) + 'Z';

  const host    = new URL(ENDPOINT).host;
  const service = 's3';
  const scope   = `${date}/${REGION}/${service}/aws4_request`;

  const encodedKey = objectKey.split('/').map(awsEncode).join('/');

  const sigParams = [
    ['X-Amz-Algorithm',     'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential',    `${accessKey}/${scope}`],
    ['X-Amz-Date',          datetime],
    ['X-Amz-Expires',       String(ttlSeconds)],
    ['X-Amz-SignedHeaders', 'host'],
  ].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  const canonicalQS = sigParams
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const canonicalRequest = [
    'GET',
    `/${BUCKET}/${encodedKey}`,
    canonicalQS,
    `host:${host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    datetime,
    scope,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  const k1  = await hmac(te.encode('AWS4' + secretKey), date);
  const k2  = await hmac(k1, REGION);
  const k3  = await hmac(k2, service);
  const k4  = await hmac(k3, 'aws4_request');
  const sig = await hmacHex(k4, stringToSign);

  return `${ENDPOINT}/${BUCKET}/${encodedKey}?${canonicalQS}&X-Amz-Signature=${sig}`;
}

// ── Handler ───────────────────────────────────────────────────────────────────

function errJson(msg, status) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequest({ request, env }) {
  const method = request.method;
  if (method !== 'GET' && method !== 'HEAD') return new Response(null, { status: 405 });

  const url  = new URL(request.url);
  const path = url.searchParams.get('path');
  if (!path) return errJson('Falta ?path=', 400);

  const safePath = decodeURIComponent(path)
    .split('/')
    .filter(s => s && s !== '..' && s !== '.')
    .join('/');
  if (!safePath) return errJson('Path inválido', 400);

  const accessKey = env.R2_ACCESS_KEY_ID;
  const secretKey = env.R2_SECRET_ACCESS_KEY;
  if (!accessKey || !secretKey) return errJson('Credenciales R2 no configuradas', 500);

  try {
    // Generar URL presignada y hacer la petición desde el Worker (server-side, sin CORS)
    const signedUrl = await presignedGet(accessKey, secretKey, safePath, TTL);

    const fetchHeaders = {};
    const rangeHeader = request.headers.get('Range');
    if (rangeHeader) fetchHeaders['Range'] = rangeHeader;

    const r2Res = await fetch(signedUrl, { headers: fetchHeaders });

    // Reenviar headers relevantes al cliente
    const resHeaders = new Headers();
    resHeaders.set('Access-Control-Allow-Origin', '*');
    resHeaders.set('Accept-Ranges', 'bytes');
    resHeaders.set('Cache-Control', 'private, max-age=3600');

    for (const h of ['Content-Type', 'Content-Length', 'Content-Range', 'ETag', 'Last-Modified']) {
      const v = r2Res.headers.get(h);
      if (v) resHeaders.set(h, v);
    }

    return new Response(method === 'HEAD' ? null : r2Res.body, {
      status: r2Res.status,
      headers: resHeaders,
    });
  } catch (err) {
    console.error('[api/audio]', err);
    return errJson(err.message, 500);
  }
}
