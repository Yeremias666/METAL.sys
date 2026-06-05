// functions/api/audio.js — URL presignada de Cloudflare R2 (Cloudflare Pages Function)
// GET /api/audio?path=Artista/Album/01%20-%20Titulo.mp3
// → { url: "https://...r2.cloudflarestorage.com/metalsys/...?X-Amz-Signature=..." }
//
// Variables de entorno (Pages → Settings → Variables):
//   R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY

const BUCKET   = 'metalsys';
const ENDPOINT = 'https://97bd5e1fe0734dd2a333126bb65abbf8.r2.cloudflarestorage.com';
const REGION   = 'auto';
const TTL      = 3600; // URL válida 1 hora

// ── Web Crypto helpers (no existe require('crypto') en Workers) ───────────────

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
  const date     = now.toISOString().slice(0, 10).replace(/-/g, '');        // YYYYMMDD
  const datetime = now.toISOString().replace(/[:\-]/g, '').slice(0, 15) + 'Z'; // YYYYMMDDTHHmmssZ

  const host    = new URL(ENDPOINT).host;
  const service = 's3';
  const scope   = `${date}/${REGION}/${service}/aws4_request`;

  const encodedKey = objectKey.split('/').map(awsEncode).join('/');

  // Parámetros de la firma, ordenados lexicográficamente por clave (requerido por AWS)
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

  // CanonicalHeaders termina con \n; el join('\n') siguiente añade otro \n antes de SignedHeaders
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

  // Signing key: cadena de HMAC sobre secretKey → date → region → service → "aws4_request"
  const k1  = await hmac(te.encode('AWS4' + secretKey), date);
  const k2  = await hmac(k1, REGION);
  const k3  = await hmac(k2, service);
  const k4  = await hmac(k3, 'aws4_request');
  const sig = await hmacHex(k4, stringToSign);

  return `${ENDPOINT}/${BUCKET}/${encodedKey}?${canonicalQS}&X-Amz-Signature=${sig}`;
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

  const url  = new URL(request.url);
  const path = url.searchParams.get('path');
  if (!path) return jsonResponse({ error: 'Falta ?path=' }, 400);

  const safePath = decodeURIComponent(path)
    .split('/')
    .filter(s => s && s !== '..' && s !== '.')
    .join('/');
  if (!safePath) return jsonResponse({ error: 'Path inválido' }, 400);

  const accessKey = env.R2_ACCESS_KEY_ID;
  const secretKey = env.R2_SECRET_ACCESS_KEY;
  if (!accessKey || !secretKey) {
    return jsonResponse({ error: 'Credenciales R2 no configuradas' }, 500);
  }

  try {
    const signedUrl = await presignedGet(accessKey, secretKey, safePath, TTL);
    return jsonResponse({ url: signedUrl }, 200, {
      'Cache-Control': `public, max-age=${TTL - 600}`,
    });
  } catch (err) {
    console.error('[api/audio]', err);
    return jsonResponse({ error: err.message }, 500);
  }
}
