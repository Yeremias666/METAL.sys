// api/audio.js — devuelve URL presignada temporal de Cloudflare R2 (compatible S3).
// El navegador la usa directamente en <audio src="">, el audio nunca pasa por Vercel.
//
// GET /api/audio?path=Artista/Album/01%20-%20Titulo.mp3
// → { url: "https://...r2.cloudflarestorage.com/metalsys/...?X-Amz-Signature=..." }
//
// Variables de entorno: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY

const crypto = require('crypto');

const BUCKET   = 'metalsys';
const ENDPOINT = 'https://97bd5e1fe0734dd2a333126bb65abbf8.r2.cloudflarestorage.com';
const REGION   = 'auto';
const TTL      = 3600; // URL presignada válida 1 hora

// ── AWS Signature V4 helpers ──────────────────────────────────────────────────

function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}
function hmacHex(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest('hex');
}
function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Genera una URL presignada para GET de un objeto en R2 (S3 Signature V4).
 * La firma va en la query string — no se necesita ningún header especial al acceder.
 */
function presignedGet(accessKey, secretKey, objectKey, ttlSeconds) {
  const now = new Date();
  // YYYYMMDD
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  // YYYYMMDDTHHmmssZ
  const datetime = now.toISOString().replace(/[:\-]/g, '').slice(0, 15) + 'Z';

  const host    = new URL(ENDPOINT).host;
  const service = 's3';
  const scope   = `${date}/${REGION}/${service}/aws4_request`;

  // Cada segmento del path se codifica por separado
  const encodedKey = objectKey.split('/').map(encodeURIComponent).join('/');

  // Parámetros de la firma — deben estar ordenados lexicográficamente por clave
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

  // Canonical request (AWS Signature V4 spec)
  // CanonicalHeaders termina con \n; el join('\n') añade otro \n antes de SignedHeaders
  const canonicalRequest = [
    'GET',
    `/${BUCKET}/${encodedKey}`,
    canonicalQS,
    `host:${host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  // String to sign
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    datetime,
    scope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  // Signing key: HMAC chain sobre secretKey → date → region → service → "aws4_request"
  const signingKey = hmac(
    hmac(hmac(hmac(Buffer.from('AWS4' + secretKey), date), REGION), service),
    'aws4_request'
  );

  const signature = hmacHex(signingKey, stringToSign);

  return `${ENDPOINT}/${BUCKET}/${encodedKey}?${canonicalQS}&X-Amz-Signature=${signature}`;
}

// ── Handler ───────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') { res.status(405).end(); return; }

  const raw = req.query.path;
  if (!raw) { res.status(400).json({ error: 'Falta ?path=' }); return; }

  const safePath = decodeURIComponent(String(raw))
    .split('/')
    .filter(s => s && s !== '..' && s !== '.')
    .join('/');
  if (!safePath) { res.status(400).json({ error: 'Path inválido' }); return; }

  const accessKey = process.env.R2_ACCESS_KEY_ID;
  const secretKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accessKey || !secretKey) {
    res.status(500).json({ error: 'Credenciales R2 no configuradas' });
    return;
  }

  try {
    const url = presignedGet(accessKey, secretKey, safePath, TTL);
    // Cacheable en navegador hasta 10 min antes de que expire
    res.setHeader('Cache-Control', `public, max-age=${TTL - 600}`);
    res.json({ url });
  } catch (err) {
    console.error('[api/audio]', err);
    res.status(500).json({ error: err.message });
  }
};
