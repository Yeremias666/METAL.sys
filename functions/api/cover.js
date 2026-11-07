// functions/api/cover.js — Lee una portada de disco de Cloudflare R2: _covers/<Artista>/<Disco>.jpg
//
// GET /api/cover?artist=<artista>&album=<disco>   (público) → la portada (404 si no existe)
//
// Solo lectura: las portadas ya se guardan en R2 solas (no se sube nada desde aquí). Es el mismo sitio donde
// files.js y reindex-covers.js leen/escriben las portadas (_covers/Artista/Disco.jpg).
//
// Se usa para la foto de perfil del artista: artistMeta[artista].coverAlbum = '<disco>' y la imagen se carga
// desde esta URL, así sale igual en todos los dispositivos aunque ese disco no esté escaneado en ellos.
// El <img src> no puede enviar Authorization, por eso es público; solo sirve objetos bajo _covers/.

import { CORS, r2Configured, r2Get, r2ListKeys } from '../_lib/r2.js';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Nombre de artista/disco → segmento de clave seguro (sin "/" ni ".."). null si no es válido.
function safeName(v) {
  if (typeof v !== 'string') return null;
  const n = v.normalize('NFC').replace(/[\/\\\u0000-\u001f\u007f]/g, '_').trim().slice(0, 150);
  if (!n || n === '.' || n === '..') return null;
  return n;
}
const keyFor = (artist, album) => `_covers/${artist}/${album}.jpg`;

// Forma comparable: minúsculas, sin tildes, sin signos ni espacios, sin "the " inicial.
const loose = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/^the\s+/, '').replace(/[^a-z0-9À-￿]+/g, '');

// Listado de _covers/ cacheado en memoria del isolate (5 min) para no listar el bucket en cada petición.
let _listCache = { at: 0, keys: null };
async function coverKeys(env) {
  if (_listCache.keys && Date.now() - _listCache.at < 5 * 60 * 1000) return _listCache.keys;
  const keys = await r2ListKeys(env, '_covers/');
  _listCache = { at: Date.now(), keys };
  return keys;
}

async function findLooseKey(env, artist, album) {
  const a = loose(artist), b = loose(album);
  if (!a || !b) return null;
  const keys = await coverKeys(env);
  for (const k of keys) {
    const m = k.match(/^_covers\/([^/]+)\/(.+)\.[A-Za-z0-9]+$/);
    if (m && loose(m[1]) === a && loose(m[2].replace(/\//g, '')) === b) return k;
  }
  return null;
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: CORS });
  if (!r2Configured(env)) return new Response('R2 no configurado', { status: 500, headers: CORS });

  const url    = new URL(request.url);
  const artist = safeName(url.searchParams.get('artist'));
  const album  = safeName(url.searchParams.get('album'));
  if (!artist || !album) return new Response('Not found', { status: 404 });

  try {
    // macOS guarda los nombres con tildes en NFD: se prueban ambas formas
    const keys = [...new Set([keyFor(artist, album), keyFor(artist.normalize('NFD'), album.normalize('NFD'))])];
    for (const key of keys) {
      const obj = await r2Get(env, key);
      if (!obj) continue;
      const stored = (obj.headers.get('content-type') || '').toLowerCase();
      return new Response(obj.body, {
        headers: {
          'Content-Type': ALLOWED_TYPES.includes(stored) ? stored : 'image/jpeg',
          'Cache-Control': 'public, max-age=86400',
          'X-Content-Type-Options': 'nosniff',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
    // Búsqueda tolerante: la carpeta de R2 puede llamarse distinto que la etiqueta ID3 ("ACDC" vs "AC/DC",
    // "Razors Edge" vs "The Razors Edge"...). Se compara sin mayúsculas, tildes ni signos.
    const found = await findLooseKey(env, artist, album);
    if (found) {
      const obj = await r2Get(env, found);
      if (obj) {
        const stored = (obj.headers.get('content-type') || '').toLowerCase();
        return new Response(obj.body, {
          headers: {
            'Content-Type': ALLOWED_TYPES.includes(stored) ? stored : 'image/jpeg',
            'Cache-Control': 'public, max-age=86400',
            'X-Content-Type-Options': 'nosniff',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    }
    return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } });
  } catch (err) {
    console.error('[api/cover]', err);
    return new Response('Error', { status: 502, headers: CORS });
  }
}
