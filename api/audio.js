// api/audio.js — devuelve una URL firmada temporal de Backblaze B2.
// El navegador la usa directamente en <audio src="">, el audio nunca pasa por Vercel.
//
// GET /api/audio?path=Artista/Album/01%20-%20Titulo.mp3
// Respuesta: { url: "https://f004.backblazeb2.com/file/METAL.sys/...?Authorization=TOKEN" }

const BUCKET            = 'METAL.sys';
const AUTH_URL          = 'https://api.backblazeb2.com/b2api/v2/b2_authorize_account';
const AUTH_TTL          = 23 * 60 * 60 * 1000; // 23 h
const SIGNED_URL_TTL    = 3600;                 // URL firmada válida 1 hora

let _cache = null, _cacheAt = 0;

async function getAuth() {
  if (_cache && Date.now() - _cacheAt < AUTH_TTL) return _cache;

  const creds = Buffer
    .from(`${process.env.B2_KEY_ID}:${process.env.B2_APP_KEY}`)
    .toString('base64');

  const res = await fetch(AUTH_URL, { headers: { Authorization: `Basic ${creds}` } });
  if (!res.ok) throw Object.assign(new Error('B2 auth failed'), { status: 502 });
  const auth = await res.json();

  let bucketId = process.env.B2_BUCKET_ID;
  if (!bucketId) {
    const bRes = await fetch(`${auth.apiUrl}/b2api/v2/b2_list_buckets`, {
      method: 'POST',
      headers: { Authorization: auth.authorizationToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: auth.accountId, bucketName: BUCKET }),
    });
    const bData = await bRes.json();
    bucketId = bData.buckets?.[0]?.bucketId;
    if (!bucketId) throw Object.assign(new Error(`Bucket "${BUCKET}" no encontrado`), { status: 404 });
  }

  _cache = { ...auth, bucketId };
  _cacheAt = Date.now();
  return _cache;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') { res.status(405).end(); return; }

  const raw = req.query.path;
  if (!raw) { res.status(400).json({ error: 'Falta ?path=' }); return; }

  const safePath = decodeURIComponent(String(raw))
    .split('/')
    .filter(s => s && s !== '..' && s !== '.')
    .join('/');
  if (!safePath) { res.status(400).json({ error: 'Path inválido' }); return; }

  try {
    const { apiUrl, authorizationToken, downloadUrl, bucketId } = await getAuth();

    // Token temporal para este archivo concreto
    const dlRes = await fetch(`${apiUrl}/b2api/v2/b2_get_download_authorization`, {
      method: 'POST',
      headers: { Authorization: authorizationToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bucketId,
        fileNamePrefix: safePath,
        validDurationInSeconds: SIGNED_URL_TTL,
      }),
    });

    if (!dlRes.ok) {
      if (dlRes.status === 401) _cache = null;
      throw Object.assign(new Error('b2_get_download_authorization failed'), { status: 502 });
    }

    const { authorizationToken: dlToken } = await dlRes.json();

    const encodedPath = safePath.split('/').map(encodeURIComponent).join('/');
    const signedUrl   = `${downloadUrl}/file/${BUCKET}/${encodedPath}?Authorization=${encodeURIComponent(dlToken)}`;

    // Cacheable en el navegador hasta 10 min antes de que expire
    res.setHeader('Cache-Control', `public, max-age=${SIGNED_URL_TTL - 600}`);
    res.json({ url: signedUrl });

  } catch (err) {
    console.error('[api/audio]', err);
    if (!_cache && err.status === 401) _cache = null;
    res.status(err.status || 500).json({ error: err.message });
  }
};
