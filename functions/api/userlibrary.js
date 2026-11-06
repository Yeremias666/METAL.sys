// functions/api/userlibrary.js — Índice de la biblioteca del usuario (canciones escaneadas), en Cloudflare R2
// GET /api/userlibrary   → { songs: [...], updatedAt }
// PUT /api/userlibrary   → body { songs: [...] }; se UNE con lo ya guardado (por id) y devuelve { ok, count }
//
// Objeto en R2: _users/<usuario>/library.json
//
// La música vive solo en el disco de cada dispositivo; aquí se guardan únicamente los metadatos
// (sin audio ni portadas) para que la pestaña STATS pueda mostrar las mismas canciones, discos y artistas
// en cualquier dispositivo, aunque ahí no se haya escaneado la carpeta.
// La unión nunca borra: una canción que desaparece del disco sigue contando en el historial.

import { CORS, json, getSession, r2Configured, r2GetJson, r2Put } from '../_lib/r2.js';

const MAX_SONGS      = 60000;
const MAX_BODY_BYTES = 12 * 1024 * 1024;

const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = v => (Number.isFinite(v) && v >= 0 ? v : 0);

// Solo se conservan campos conocidos y acotados: el cliente no puede colar datos arbitrarios.
function cleanSong(s) {
  if (!s || typeof s !== 'object' || typeof s.id !== 'string' || !s.id || s.id.length > 300) return null;
  return {
    id:         s.id,
    name:       str(s.name, 300),
    artist:     str(s.artist, 200),
    category:   str(s.category, 200),
    album:      str(s.album, 300),
    track:      str(String(s.track ?? ''), 20),
    year:       str(String(s.year ?? ''), 10),
    genre:      str(s.genre, 100),
    fileName:   str(s.fileName, 400),
    fileType:   str(s.fileType, 60),
    fileSize:   num(s.fileSize),
    duration:   num(s.duration),
    uploadedAt: num(s.uploadedAt),
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const { KV } = env;
  if (!KV) return json({ error: 'KV not configured' }, 500);
  if (!r2Configured(env)) return json({ error: 'Credenciales R2 no configuradas' }, 500);

  const session = await getSession(request, KV);
  if (!session) return json({ error: 'No autenticado' }, 401);

  const key     = `_users/${session.username}/library.json`;
  const noStore = { 'Cache-Control': 'no-store' };

  try {
    if (request.method === 'GET') {
      const lib = await r2GetJson(env, key);
      return json(lib && Array.isArray(lib.songs) ? lib : { songs: [], updatedAt: 0 }, 200, noStore);
    }

    if (request.method === 'PUT') {
      const text = await request.text();
      if (text.length > MAX_BODY_BYTES) return json({ error: 'Demasiado grande' }, 413);
      let body;
      try { body = JSON.parse(text); } catch { return json({ error: 'Invalid JSON' }, 400); }
      if (!body || !Array.isArray(body.songs)) return json({ error: 'songs requerido' }, 400);

      const stored = await r2GetJson(env, key);
      const map = new Map();
      for (const s of (stored && Array.isArray(stored.songs)) ? stored.songs : []) map.set(s.id, s);
      for (const raw of body.songs) { const s = cleanSong(raw); if (s) map.set(s.id, s); }   // lo nuevo gana
      if (map.size > MAX_SONGS) return json({ error: 'Biblioteca demasiado grande' }, 413);

      const songs = [...map.values()];
      await r2Put(env, key, JSON.stringify({ songs, updatedAt: Date.now() }), 'application/json');
      return json({ ok: true, count: songs.length }, 200, noStore);
    }

    return new Response('Method not allowed', { status: 405, headers: CORS });
  } catch (err) {
    console.error('[api/userlibrary]', err);
    return json({ error: err.message }, err.status || 500);
  }
}
