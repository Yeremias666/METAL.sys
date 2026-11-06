// functions/api/userdata.js — Datos de la cuenta del usuario, guardados en Cloudflare R2
// GET /api/userdata   → documento del usuario
// PUT /api/userdata   → guarda (fusionando con lo que ya hay) y devuelve el documento resultante
//
// Objeto en R2: _users/<usuario>/data.json
//
// Documento (v2):
//   {
//     v: 2,
//     ts: { <sección>: <ms de la última modificación> },   // solo secciones "editables"
//     // Secciones editables (gana la modificación más reciente según ts):
//     likedIds[], playlists[], bookmarks{}, clipStore{}, artistMeta{}, perf{}
//     // Secciones acumulativas (nunca retroceden, se fusionan siempre):
//     playCounts{id:n}   → máximo por canción
//     playLog[]          → unión por (id, ts), 2000 más recientes
//     log[]              → unión por (kind, ts, name), 200 más recientes
//     listenSecs         → máximo
//   }
//
// Compatibilidad: si el usuario aún no tiene data.json pero sí tiene el antiguo `data:<usuario>` en KV,
// se parte de él (el de KV no se borra).

import { CORS, json, getSession, r2Configured, r2GetJson, r2Put } from '../_lib/r2.js';

const MAX_BODY_BYTES = 6 * 1024 * 1024;
const MAX_PLAYLOG    = 2000;
const MAX_LOG        = 200;

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

// Validación de cada sección editable
const EDITABLE = {
  likedIds:   v => Array.isArray(v) && v.length <= 100000,
  playlists:  v => Array.isArray(v) && v.length <= 1000,
  bookmarks:  isObj,
  clipStore:  isObj,
  artistMeta: isObj,
  perf:       isObj,
};

function emptyDoc() {
  return {
    v: 2, ts: {},
    likedIds: [], playlists: [], bookmarks: {}, clipStore: {}, artistMeta: {},
    playCounts: {}, playLog: [], log: [], listenSecs: 0,
  };
}

// Documento antiguo de KV → v2. Las secciones con datos reciben ts=1: cualquier dispositivo que nunca
// haya sincronizado (ts local 0) adopta lo de la nube en vez de pisarlo con sus datos vacíos.
function fromLegacy(old) {
  const doc = emptyDoc();
  if (!isObj(old)) return doc;
  for (const k of Object.keys(EDITABLE)) {
    if (old[k] !== undefined && EDITABLE[k](old[k])) { doc[k] = old[k]; doc.ts[k] = 1; }
  }
  if (isObj(old.playCounts)) doc.playCounts = old.playCounts;
  if (Array.isArray(old.playLog)) doc.playLog = old.playLog.slice(0, MAX_PLAYLOG);
  if (Number.isFinite(old.listenSecs)) doc.listenSecs = old.listenSecs;
  return doc;
}

async function loadDoc(env, KV, username) {
  const stored = await r2GetJson(env, `_users/${username}/data.json`);
  if (isObj(stored)) return { ...emptyDoc(), ...stored, ts: isObj(stored.ts) ? stored.ts : {} };
  try {
    const raw = await KV.get(`data:${username}`);
    if (raw) return fromLegacy(JSON.parse(raw));
  } catch {}
  return emptyDoc();
}

// ── Fusión ───────────────────────────────────────────────────────────────────

function mergeCounts(a, b) {
  const out = isObj(a) ? { ...a } : {};
  if (isObj(b)) for (const [id, n] of Object.entries(b)) {
    const v = Number(n);
    if (Number.isFinite(v) && v > (out[id] || 0)) out[id] = v;
  }
  return out;
}

function mergeEntries(a, b, keyOf, cap) {
  const map = new Map();
  for (const list of [a, b]) {
    if (!Array.isArray(list)) continue;
    for (const e of list) {
      if (!isObj(e) || !Number.isFinite(e.ts)) continue;
      map.set(keyOf(e), e);
    }
  }
  return [...map.values()].sort((x, y) => y.ts - x.ts).slice(0, cap);
}

function mergeDoc(stored, inc) {
  const now = Date.now();
  const out = { ...emptyDoc(), ...stored, v: 2, ts: { ...(stored.ts || {}) } };

  // ¿El cliente envía marcas de tiempo por sección? Los clientes antiguos no las envían: se toma "ahora".
  const incTs = isObj(inc.ts) ? inc.ts : null;

  for (const k of Object.keys(EDITABLE)) {
    if (inc[k] === undefined || !EDITABLE[k](inc[k])) continue;
    let t = incTs ? Number(incTs[k]) : now;
    if (!Number.isFinite(t) || t <= 0) continue;
    t = Math.min(t, now + 60_000);                      // un reloj adelantado no puede "ganar para siempre"
    if (t >= (out.ts[k] || 0)) { out[k] = inc[k]; out.ts[k] = t; }
  }

  out.playCounts = mergeCounts(out.playCounts, inc.playCounts);
  out.playLog    = mergeEntries(out.playLog, inc.playLog, e => `${e.id}|${e.ts}`, MAX_PLAYLOG);
  out.log        = mergeEntries(out.log,     inc.log,     e => `${e.kind}|${e.ts}|${e.name}`, MAX_LOG);
  if (Number.isFinite(inc.listenSecs) && inc.listenSecs > (out.listenSecs || 0)) out.listenSecs = inc.listenSecs;

  out.updatedAt = now;
  return out;
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const { KV } = env;
  if (!KV) return json({ error: 'KV not configured' }, 500);
  if (!r2Configured(env)) return json({ error: 'Credenciales R2 no configuradas' }, 500);

  const session = await getSession(request, KV);
  if (!session) return json({ error: 'No autenticado' }, 401);

  const noStore = { 'Cache-Control': 'no-store' };

  try {
    if (request.method === 'GET') {
      return json(await loadDoc(env, KV, session.username), 200, noStore);
    }

    if (request.method === 'PUT') {
      const text = await request.text();
      if (text.length > MAX_BODY_BYTES) return json({ error: 'Demasiado grande' }, 413);
      let body;
      try { body = JSON.parse(text); } catch { return json({ error: 'Invalid JSON' }, 400); }
      if (!isObj(body)) return json({ error: 'Invalid JSON' }, 400);

      const merged = mergeDoc(await loadDoc(env, KV, session.username), body);
      await r2Put(env, `_users/${session.username}/data.json`, JSON.stringify(merged), 'application/json');
      return json(merged, 200, noStore);
    }

    return new Response('Method not allowed', { status: 405, headers: CORS });
  } catch (err) {
    console.error('[api/userdata]', err);
    return json({ error: err.message }, err.status || 500);
  }
}
