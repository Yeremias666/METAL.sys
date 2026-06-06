const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function randomHex(bytes = 32) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
    key, 256
  );
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (context.request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const { KV } = context.env;
  if (!KV) return new Response('KV not configured', { status: 500 });

  let body;
  try { body = await context.request.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }

  const login    = (body.login || '').trim().toLowerCase();
  const password = body.password || '';

  if (!login || !password) return json({ error: 'Faltan campos' }, 400);

  // Resolve username — accept email or username
  let username = login;
  if (login.includes('@')) {
    const found = await KV.get(`email:${login}`);
    if (!found) return json({ error: 'Usuario o contraseña incorrectos' }, 401);
    username = found;
  }

  const raw = await KV.get(`user:${username}`);
  if (!raw) return json({ error: 'Usuario o contraseña incorrectos' }, 401);

  const user = JSON.parse(raw);
  const hash = await hashPassword(password, user.salt);
  if (hash !== user.passwordHash) return json({ error: 'Usuario o contraseña incorrectos' }, 401);

  const token = randomHex(32);
  await KV.put(`session:${token}`, JSON.stringify({ username, expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 }), { expirationTtl: 30 * 24 * 60 * 60 });

  return json({ token, username, email: user.email, avatar: user.avatar || null });

  function json(data, status = 200) {
    return new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
}
