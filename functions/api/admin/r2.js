// GET    /api/admin/r2           — list R2 objects
// DELETE /api/admin/r2           — delete R2 object  { key }

const BUCKET   = 'metalsys';
const ENDPOINT = 'https://97bd5e1fe0734dd2a333126bb65abbf8.r2.cloudflarestorage.com';
const REGION   = 'auto';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

// ── AWS helpers ───────────────────────────────────────────────────────────────

const te = new TextEncoder();
function toBytes(v) { return v instanceof Uint8Array ? v : te.encode(String(v)); }
const awsEncode = s => encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());

async function hmac(key, data) {
  const k = await crypto.subtle.importKey('raw', toBytes(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, toBytes(data)));
}
async function hmacHex(key, data) { return Array.from(await hmac(key, data)).map(b => b.toString(16).padStart(2, '0')).join(''); }
async function sha256Hex(str) {
  const h = await crypto.subtle.digest('SHA-256', te.encode(str));
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

async function signedHeaders(method, path, queryStr, accessKey, secretKey, bodyHash = EMPTY_SHA256) {
  const now      = new Date();
  const date     = now.toISOString().slice(0, 10).replace(/-/g, '');
  const datetime = now.toISOString().replace(/[:\-]/g, '').slice(0, 15) + 'Z';
  const host     = new URL(ENDPOINT).host;
  const scope    = `${date}/${REGION}/s3/aws4_request`;
  const hdrs     = { host, 'x-amz-content-sha256': bodyHash, 'x-amz-date': datetime };
  const sortedKeys       = Object.keys(hdrs).sort();
  const canonicalHeaders = sortedKeys.map(k => `${k}:${hdrs[k]}\n`).join('');
  const signedList       = sortedKeys.join(';');
  const canonicalRequest = [method, path, queryStr, canonicalHeaders, signedList, bodyHash].join('\n');
  const stringToSign     = ['AWS4-HMAC-SHA256', datetime, scope, await sha256Hex(canonicalRequest)].join('\n');
  const k1  = await hmac(te.encode('AWS4' + secretKey), date);
  const k2  = await hmac(k1, REGION);
  const k3  = await hmac(k2, 's3');
  const k4  = await hmac(k3, 'aws4_request');
  const sig = await hmacHex(k4, stringToSign);
  return {
    'Authorization': `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedList}, Signature=${sig}`,
    'x-amz-date': datetime,
    'x-amz-content-sha256': bodyHash,
  };
}

function xmlTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return m ? m[1] : '';
}
function xmlBlocks(xml, tag) {
  return [...xml.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'g'))].map(m => m[1]);
}
const unxml = s => s.replace(/&amp;/g, '&').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');

// ── Auth helper ───────────────────────────────────────────────────────────────

async function requireAdmin(request, KV) {
  const token = (request.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  if (!token) return null;
  const raw = await KV.get(`session:${token}`);
  if (!raw) return null;
  const session = JSON.parse(raw);
  if (session.expiresAt < Date.now()) { await KV.delete(`session:${token}`); return null; }
  const userRaw = await KV.get(`user:${session.username}`);
  if (!userRaw) return null;
  const user = JSON.parse(userRaw);
  return user.role === 'admin' ? session.username : null;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const { KV, R2_ACCESS_KEY_ID: accessKey, R2_SECRET_ACCESS_KEY: secretKey } = context.env;
  if (!KV) return json({ error: 'KV not configured' }, 500);
  if (!accessKey || !secretKey) return json({ error: 'R2 credentials not configured' }, 500);

  const caller = await requireAdmin(context.request, KV);
  if (!caller) return json({ error: 'Acceso denegado' }, 403);

  // ── GET: list objects ────────────────────────────────────────────────────────
  if (context.request.method === 'GET') {
    const url = new URL(context.request.url);
    const prefix    = url.searchParams.get('prefix') || '';
    const pageToken = url.searchParams.get('token') || '';
    const qs = `list-type=2&max-keys=200${prefix ? '&prefix=' + encodeURIComponent(prefix) : ''}${pageToken ? '&continuation-token=' + encodeURIComponent(pageToken) : ''}`;
    const path = `/${BUCKET}/`;
    const headers = await signedHeaders('GET', path, qs, accessKey, secretKey);
    const r2 = await fetch(`${ENDPOINT}${path}?${qs}`, { headers });
    if (!r2.ok) return json({ error: 'R2 list failed', status: r2.status }, 502);
    const xml = await r2.text();
    const objects = xmlBlocks(xml, 'Contents').map(b => ({
      key:          unxml(xmlTag(b, 'Key')),
      size:         parseInt(xmlTag(b, 'Size') || '0', 10),
      lastModified: xmlTag(b, 'LastModified'),
    }));
    const nextToken = xmlTag(xml, 'NextContinuationToken') || null;
    return json({ objects, nextToken });
  }

  // ── DELETE: remove object ────────────────────────────────────────────────────
  if (context.request.method === 'DELETE') {
    let body;
    try { body = await context.request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
    const { key } = body;
    if (!key) return json({ error: 'key requerido' }, 400);
    const path = `/${BUCKET}/${key.split('/').map(awsEncode).join('/')}`;
    const headers = await signedHeaders('DELETE', path, '', accessKey, secretKey);
    const r2 = await fetch(`${ENDPOINT}${path}`, { method: 'DELETE', headers });
    if (!r2.ok && r2.status !== 204) return json({ error: 'R2 delete failed', status: r2.status }, 502);
    return json({ ok: true });
  }

  return new Response('Method not allowed', { status: 405 });
}
