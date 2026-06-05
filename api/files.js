// api/files.js — Lista todos los MP3 del bucket B2 y los devuelve como
// objetos de archivo compatibles con el vault de METAL.SYS.
//
// GET /api/files
// Respuesta: array de file objects (fileData=null, el audio se sirve vía URL firmada)
//
// Variables de entorno necesarias:
//   B2_KEY_ID, B2_APP_KEY          (requeridas)
//   B2_BUCKET_ID                   (opcional — si no está se obtiene automáticamente)

const BUCKET   = 'METAL.sys';
const AUTH_URL = 'https://api.backblazeb2.com/b2api/v2/b2_authorize_account';
const AUTH_TTL = 23 * 60 * 60 * 1000;

let _cache   = null;
let _cacheAt = 0;

async function getAuth() {
  if (_cache && Date.now() - _cacheAt < AUTH_TTL) return _cache;

  const creds = Buffer
    .from(`${process.env.B2_KEY_ID}:${process.env.B2_APP_KEY}`)
    .toString('base64');

  const authRes = await fetch(AUTH_URL, {
    headers: { Authorization: `Basic ${creds}` },
  });
  if (!authRes.ok) {
    throw Object.assign(new Error('B2 auth failed'), { status: 502 });
  }
  const auth = await authRes.json();

  // Obtener bucketId: desde env var o llamando a b2_list_buckets
  let bucketId = process.env.B2_BUCKET_ID;
  if (!bucketId) {
    const bRes = await fetch(`${auth.apiUrl}/b2api/v2/b2_list_buckets`, {
      method: 'POST',
      headers: {
        Authorization:  auth.authorizationToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ accountId: auth.accountId, bucketName: BUCKET }),
    });
    const bData = await bRes.json();
    bucketId = bData.buckets?.[0]?.bucketId;
    if (!bucketId) {
      throw Object.assign(
        new Error(`Bucket "${BUCKET}" no encontrado`),
        { status: 404 }
      );
    }
  }

  _cache   = { ...auth, bucketId };
  _cacheAt = Date.now();
  return _cache;
}

// Extrae metadatos de la ruta: Artista/Album/01 - Titulo.mp3
function parsePath(filePath) {
  const parts    = filePath.split('/');
  const fileName = parts[parts.length - 1];
  const artist   = parts[0] || 'DESCONOCIDO';
  const album    = parts.length >= 3 ? parts.slice(1, -1).join('/') : '';

  const nameNoExt = fileName.replace(/\.(mp3|wav|ogg|flac|m4a|aac|opus|aiff|wma)$/i, '');
  const m     = nameNoExt.match(/^(\d+)\s*[-–.]\s*(.+)/);
  const track = m ? m[1] : '';
  const title = m ? m[2].trim() : nameNoExt;

  return { artist, album, track, title, fileName };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') { res.status(405).end(); return; }

  try {
    const { apiUrl, authorizationToken, bucketId } = await getAuth();

    // Listar todos los archivos (paginado)
    const allFiles = [];
    let startFileName;

    do {
      const body = { bucketId, maxFileCount: 1000 };
      if (startFileName) body.startFileName = startFileName;

      const listRes = await fetch(`${apiUrl}/b2api/v2/b2_list_file_names`, {
        method: 'POST',
        headers: {
          Authorization:  authorizationToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!listRes.ok) {
        // Token expirado — invalidar caché
        if (listRes.status === 401) _cache = null;
        throw Object.assign(new Error('b2_list_file_names failed'), { status: 502 });
      }

      const data = await listRes.json();
      allFiles.push(...data.files);
      startFileName = data.nextFileName;
    } while (startFileName);

    // Filtrar solo archivos de audio y construir objetos de archivo
    const audioExts = /\.(mp3|wav|ogg|flac|m4a|aac|opus|aiff|wma)$/i;
    const result = allFiles
      .filter(f => audioExts.test(f.fileName) && f.action === 'upload')
      .map(f => {
        const { artist, album, track, title, fileName } = parsePath(f.fileName);

        // fileData es la URL del proxy — el reproductor la usa igual que un data URL
        return {
          id:          `b2:${f.fileName}`,
          name:        title,
          artist,
          album,
          track,
          year:        '',
          genre:       '',
          description: album,
          category:    artist,
          fileName,
          fileSize:    f.contentLength,
          fileType:    f.contentType || 'audio/mpeg',
          fileData:    null,          // nunca en local — se solicita URL firmada al reproducir
          b2Path:      f.fileName,  // ruta original en B2
          thumbnail:   null,
          coverArt:    null,
          uploadedAt:  f.uploadTimestamp,
          downloads:   0,
        };
      });

    // 5 min en CDN de Vercel, 1 min en navegador
    res.setHeader('Cache-Control', 'public, s-maxage=300, max-age=60');
    res.json(result);

  } catch (err) {
    console.error('[api/files]', err);
    if (_cache && err.status === 401) _cache = null; // forzar re-auth
    res.status(err.status || 500).json({ error: err.message });
  }
};
