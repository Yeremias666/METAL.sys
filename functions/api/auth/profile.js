const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

async function getSession(request, KV) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token) return null;
  const raw = await KV.get(`session:${token}`);
  if (!raw) return null;
  const session = JSON.parse(raw);
  if (session.expiresAt < Date.now()) { await KV.delete(`session:${token}`); return null; }
  return session;
}

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const { KV } = context.env;
  if (!KV) return new Response('KV not configured', { status: 500 });

  const session = await getSession(context.request, KV);
  if (!session) return json({ error: 'No autenticado' }, 401);

  const raw = await KV.get(`user:${session.username}`);
  if (!raw) return json({ error: 'Usuario no encontrado' }, 404);
  const user = JSON.parse(raw);

  if (context.request.method === 'GET') {
    return json({ username: session.username, email: user.email, avatar: user.avatar || null, createdAt: user.createdAt, role: user.role || 'user' });
  }

  if (context.request.method === 'PUT') {
    let body;
    try { body = await context.request.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }
    if (body.avatar !== undefined) user.avatar = body.avatar;
    if (body.newPassword) {
      if (body.newPassword.length < 6) return json({ error: 'Contraseña demasiado corta' }, 400);
      const enc = new TextEncoder();
      const key = await crypto.subtle.importKey('raw', enc.encode(body.newPassword), 'PBKDF2', false, ['deriveBits']);
      const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: enc.encode(user.salt), iterations: 100000, hash: 'SHA-256' }, key, 256
      );
      user.passwordHash = btoa(String.fromCharCode(...new Uint8Array(bits)));
    }
    await KV.put(`user:${session.username}`, JSON.stringify(user));
    return json({ username: session.username, email: user.email, avatar: user.avatar || null });
  }

  return new Response('Method not allowed', { status: 405 });

  function json(data, status = 200) {
    return new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
}
