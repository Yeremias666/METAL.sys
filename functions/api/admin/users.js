// GET  /api/admin/users          — list all users
// PUT  /api/admin/users          — update role  { username, role }
// DELETE /api/admin/users?u=xxx  — delete user (y sus datos en R2: _users/<usuario>/)

import { r2Configured, r2ListKeys, r2Delete, isValidUsername } from '../../_lib/r2.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

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
  if (user.role !== 'admin') return null;
  return session.username;
}

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const { KV } = context.env;
  if (!KV) return json({ error: 'KV not configured' }, 500);

  const caller = await requireAdmin(context.request, KV);
  if (!caller) return json({ error: 'Acceso denegado' }, 403);

  // ── GET: list users ─────────────────────────────────────────────────────────
  if (context.request.method === 'GET') {
    const list = await KV.list({ prefix: 'user:' });
    const users = await Promise.all(
      list.keys.map(async ({ name }) => {
        const raw = await KV.get(name);
        if (!raw) return null;
        const u = JSON.parse(raw);
        return { username: name.slice(5), email: u.email, role: u.role || 'user', createdAt: u.createdAt, avatar: u.avatar || null };
      })
    );
    return json(users.filter(Boolean));
  }

  // ── PUT: change role ─────────────────────────────────────────────────────────
  if (context.request.method === 'PUT') {
    let body;
    try { body = await context.request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
    const { username, role } = body;
    if (!username || !['admin', 'user'].includes(role)) return json({ error: 'username y role requeridos' }, 400);
    if (username === caller) return json({ error: 'No puedes cambiar tu propio rol' }, 400);
    const raw = await KV.get(`user:${username}`);
    if (!raw) return json({ error: 'Usuario no encontrado' }, 404);
    const user = JSON.parse(raw);
    user.role = role;
    await KV.put(`user:${username}`, JSON.stringify(user));
    return json({ ok: true });
  }

  // ── DELETE: remove user ──────────────────────────────────────────────────────
  if (context.request.method === 'DELETE') {
    const url = new URL(context.request.url);
    const username = url.searchParams.get('u');
    if (!username) return json({ error: 'Falta parámetro u' }, 400);
    if (username === caller) return json({ error: 'No puedes eliminarte a ti mismo' }, 400);
    const raw = await KV.get(`user:${username}`);
    if (!raw) return json({ error: 'Usuario no encontrado' }, 404);
    const user = JSON.parse(raw);
    await KV.delete(`user:${username}`);
    if (user.email) await KV.delete(`email:${user.email}`);
    await KV.delete(`data:${username}`);   // datos antiguos (versión previa a R2), si existen

    // Datos del usuario en R2 (stats, biblioteca, imágenes). Si falla no se bloquea el borrado de la cuenta.
    let r2Removed = 0;
    if (isValidUsername(username) && r2Configured(context.env)) {
      try {
        for (const key of await r2ListKeys(context.env, `_users/${username}/`)) {
          await r2Delete(context.env, key);
          r2Removed++;
        }
      } catch (err) { console.error('[admin/users] limpieza R2', err); }
    }
    return json({ ok: true, r2Removed });
  }

  return new Response('Method not allowed', { status: 405 });
}
