// functions/api/userimage.js — Imágenes subidas por el usuario (portadas de artista y de playlist), en R2
//
// PUT    /api/userimage[?replace=<id>]   (auth) body = bytes de la imagen, Content-Type image/jpeg|png|webp|gif
//                                        → { id, url }   y borra la imagen anterior `replace` si es del mismo usuario
// GET    /api/userimage?u=<usuario>&id=<id>   (público) → la imagen
// DELETE /api/userimage?id=<id>          (auth) borra una imagen propia
//
// Objeto en R2: _users/<usuario>/images/<id>
//
// El GET es público a propósito: un <img src> no puede enviar cabecera Authorization. El <id> son 96 bits
// aleatorios (no se pueden adivinar) y cada subida genera un id nuevo, por eso la respuesta es cacheable
// "para siempre" y la misma URL se ve igual en todos los dispositivos de la cuenta.

import {
  CORS, json, getSession, r2Configured, r2Get, r2Put, r2Delete, r2ListKeys,
  isValidUsername, isValidImageId, randomHex,
} from '../_lib/r2.js';

const MAX_IMAGE_BYTES   = 3 * 1024 * 1024;
const MAX_IMAGES_PER_USER = 400;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Comprueba la firma real del archivo: el Content-Type que envía el cliente no es de fiar.
function sniffType(b) {
  if (b.length < 12) return null;
  if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'image/gif';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return null;
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

  if (!r2Configured(env)) return json({ error: 'Credenciales R2 no configuradas' }, 500);

  const url = new URL(request.url);

  try {
    // ── GET público ────────────────────────────────────────────────────────────
    if (request.method === 'GET') {
      const u  = url.searchParams.get('u');
      const id = url.searchParams.get('id');
      if (!isValidUsername(u) || !isValidImageId(id)) return new Response('Not found', { status: 404 });

      const obj = await r2Get(env, `_users/${u}/images/${id}`);
      if (!obj) return new Response('Not found', { status: 404 });

      const stored = (obj.headers.get('content-type') || '').toLowerCase();
      return new Response(obj.body, {
        headers: {
          'Content-Type': ALLOWED_TYPES.includes(stored) ? stored : 'application/octet-stream',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'X-Content-Type-Options': 'nosniff',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // ── Resto de métodos: requieren sesión ────────────────────────────────────
    const { KV } = env;
    if (!KV) return json({ error: 'KV not configured' }, 500);
    const session = await getSession(request, KV);
    if (!session) return json({ error: 'No autenticado' }, 401);
    const username = session.username;
    if (!isValidUsername(username)) return json({ error: 'Usuario no válido' }, 400);

    if (request.method === 'PUT') {
      const bytes = new Uint8Array(await request.arrayBuffer());
      if (!bytes.length) return json({ error: 'Imagen vacía' }, 400);
      if (bytes.length > MAX_IMAGE_BYTES) return json({ error: 'Imagen demasiado grande (máx. 3 MB)' }, 413);

      const type = sniffType(bytes);
      if (!type) return json({ error: 'Formato de imagen no admitido' }, 415);

      const keys = await r2ListKeys(env, `_users/${username}/images/`);
      if (keys.length >= MAX_IMAGES_PER_USER) return json({ error: 'Límite de imágenes alcanzado' }, 429);

      const id = randomHex(12);
      await r2Put(env, `_users/${username}/images/${id}`, bytes, type);

      const replace = url.searchParams.get('replace');
      if (isValidImageId(replace) && replace !== id) {
        try { await r2Delete(env, `_users/${username}/images/${replace}`); } catch {}
      }

      return json({ id, url: `/api/userimage?u=${username}&id=${id}` }, 201);
    }

    if (request.method === 'DELETE') {
      const id = url.searchParams.get('id');
      if (!isValidImageId(id)) return json({ error: 'id no válido' }, 400);
      await r2Delete(env, `_users/${username}/images/${id}`);
      return json({ ok: true });
    }

    return new Response('Method not allowed', { status: 405, headers: CORS });
  } catch (err) {
    console.error('[api/userimage]', err);
    return json({ error: err.message }, err.status || 500);
  }
}
