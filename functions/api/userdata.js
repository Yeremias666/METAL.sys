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
  if (!session) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } });

  const key = `data:${session.username}`;

  if (context.request.method === 'GET') {
    const raw = await KV.get(key);
    const data = raw ? JSON.parse(raw) : { bookmarks: {}, clipStore: {}, likedIds: [], playCounts: {} };
    return new Response(JSON.stringify(data), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  if (context.request.method === 'PUT') {
    let body;
    try { body = await context.request.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }
    await KV.put(key, JSON.stringify(body));
    return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  return new Response('Method not allowed', { status: 405 });
}
