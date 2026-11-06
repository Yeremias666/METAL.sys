// functions/_lib/r2.js — Helpers compartidos para hablar con Cloudflare R2 desde las Pages Functions.
//
// No es una ruta (no exporta onRequest): solo lo importan otras funciones.
// Usa la API S3 de R2 firmada con AWS Signature V4, igual que files.js / audio.js / admin/r2.js,
// así que solo necesita las variables de entorno que ya existen:
//   R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
//
// Estructura de claves que usa la app para datos de usuario:
//   _users/<usuario>/data.json            → stats, likes, playlists, bookmarks, clips, artistMeta, perf, log
//   _users/<usuario>/library.json         → índice de canciones escaneadas (para que las stats coincidan entre dispositivos)
//   _users/<usuario>/images/<id>          → imágenes subidas por el usuario (portadas de artista y de playlist)

export const BUCKET   = 'metalsys';
export const ENDPOINT = 'https://97bd5e1fe0734dd2a333126bb65abbf8.r2.cloudflarestorage.com';
const REGION       = 'auto';
const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', ...extraHeaders },
  });
}

// ── Sesión (las sesiones viven en KV) ────────────────────────────────────────

export async function getSession(request, KV) {
  const auth  = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token) return null;
  const raw = await KV.get(`session:${token}`);
  if (!raw) return null;
  const session = JSON.parse(raw);
  if (session.expiresAt < Date.now()) { await KV.delete(`session:${token}`); return null; }
  return session;
}

// Los nombres de usuario solo pueden tener [a-z0-9_] (lo impone register.js); se vuelve a comprobar
// antes de construir cualquier clave de R2 para que nadie pueda salirse de su carpeta.
export const isValidUsername = (u) => typeof u === 'string' && /^[a-z0-9_]{1,64}$/.test(u);
export const isValidImageId  = (id) => typeof id === 'string' && /^[a-f0-9]{24}$/.test(id);

export function randomHex(bytes = 12) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── AWS Signature V4 ─────────────────────────────────────────────────────────

const te = new TextEncoder();
const toBytes   = v => (v instanceof Uint8Array ? v : te.encode(String(v)));
const awsEncode = s => encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
const toHex     = bytes => Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
const unxml     = s => s.replace(/&amp;/g, '&').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');

async function hmac(key, data) {
  const k = await crypto.subtle.importKey('raw', toBytes(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, toBytes(data)));
}

async function sha256Hex(data) {
  return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', toBytes(data))));
}

async function signedHeaders(method, path, queryStr, env, bodyHash = EMPTY_SHA256, contentType = '') {
  const now      = new Date();
  const date     = now.toISOString().slice(0, 10).replace(/-/g, '');
  const datetime = now.toISOString().replace(/[:\-]/g, '').slice(0, 15) + 'Z';
  const host     = new URL(ENDPOINT).host;
  const scope    = `${date}/${REGION}/s3/aws4_request`;

  const hdrs = { host, 'x-amz-content-sha256': bodyHash, 'x-amz-date': datetime };
  if (contentType) hdrs['content-type'] = contentType;

  const sortedKeys       = Object.keys(hdrs).sort();
  const canonicalHeaders = sortedKeys.map(k => `${k}:${hdrs[k]}\n`).join('');
  const signedList       = sortedKeys.join(';');
  const canonicalRequest = [method, path, queryStr, canonicalHeaders, signedList, bodyHash].join('\n');
  const stringToSign     = ['AWS4-HMAC-SHA256', datetime, scope, await sha256Hex(canonicalRequest)].join('\n');

  const k1  = await hmac(te.encode('AWS4' + env.R2_SECRET_ACCESS_KEY), date);
  const k2  = await hmac(k1, REGION);
  const k3  = await hmac(k2, 's3');
  const k4  = await hmac(k3, 'aws4_request');
  const sig = toHex(await hmac(k4, stringToSign));

  const out = {
    'Authorization': `AWS4-HMAC-SHA256 Credential=${env.R2_ACCESS_KEY_ID}/${scope}, SignedHeaders=${signedList}, Signature=${sig}`,
    'x-amz-date': datetime,
    'x-amz-content-sha256': bodyHash,
  };
  if (contentType) out['content-type'] = contentType;
  return out;
}

const objectPath = key => `/${BUCKET}/${key.split('/').map(awsEncode).join('/')}`;

function r2Error(op, res) {
  return Object.assign(new Error(`R2 ${op} ${res.status}`), { status: 502 });
}

// ── Operaciones sobre objetos ────────────────────────────────────────────────

export const r2Configured = env => !!(env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY);

// Devuelve la Response de R2 (con body en streaming) o null si el objeto no existe.
export async function r2Get(env, key) {
  const path = objectPath(key);
  const res  = await fetch(`${ENDPOINT}${path}`, { headers: await signedHeaders('GET', path, '', env) });
  if (res.status === 404) return null;
  if (!res.ok) throw r2Error('GET', res);
  return res;
}

// Lee un objeto JSON. null si no existe o si no es JSON válido.
export async function r2GetJson(env, key) {
  const res = await r2Get(env, key);
  if (!res) return null;
  try { return await res.json(); } catch { return null; }
}

// body: string o Uint8Array
export async function r2Put(env, key, body, contentType = 'application/octet-stream') {
  const path  = objectPath(key);
  const bytes = body instanceof Uint8Array ? body : te.encode(String(body));
  const hash  = await sha256Hex(bytes);
  const res   = await fetch(`${ENDPOINT}${path}`, {
    method: 'PUT',
    headers: await signedHeaders('PUT', path, '', env, hash, contentType),
    body: bytes,
  });
  if (!res.ok) throw r2Error('PUT', res);
}

export async function r2Delete(env, key) {
  const path = objectPath(key);
  const res  = await fetch(`${ENDPOINT}${path}`, { method: 'DELETE', headers: await signedHeaders('DELETE', path, '', env) });
  if (!res.ok && res.status !== 204 && res.status !== 404) throw r2Error('DELETE', res);
}

// Claves de todos los objetos bajo un prefijo (paginado).
export async function r2ListKeys(env, prefix) {
  const keys = [];
  let token;
  do {
    const qp = { 'list-type': '2', 'max-keys': '1000', prefix };
    if (token) qp['continuation-token'] = token;
    const qs = Object.entries(qp)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${awsEncode(k)}=${awsEncode(v)}`)
      .join('&');
    const res = await fetch(`${ENDPOINT}/${BUCKET}?${qs}`, { headers: await signedHeaders('GET', `/${BUCKET}`, qs, env) });
    if (!res.ok) throw r2Error('LIST', res);
    const xml = await res.text();
    for (const m of xml.matchAll(/<Key>([\s\S]*?)<\/Key>/g)) keys.push(unxml(m[1]));
    const next = /<IsTruncated>true<\/IsTruncated>/.test(xml)
      ? (xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/) || [])[1]
      : undefined;
    token = next ? unxml(next) : undefined;
  } while (token);
  return keys;
}
