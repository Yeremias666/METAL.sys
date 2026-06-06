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

  const username = (body.username || '').trim().toLowerCase();
  const email    = (body.email || '').trim().toLowerCase();
  const password = body.password || '';

  if (!username || username.length < 3)
    return json({ error: 'Nombre de usuario demasiado corto (mín. 3 caracteres)' }, 400);
  if (!/^[a-z0-9_]+$/.test(username))
    return json({ error: 'Usuario: solo letras, números y guión bajo' }, 400);
  if (!email || !email.includes('@'))
    return json({ error: 'Email no válido' }, 400);
  if (password.length < 6)
    return json({ error: 'Contraseña demasiado corta (mín. 6 caracteres)' }, 400);

  if (await KV.get(`user:${username}`))
    return json({ error: 'Ese nombre de usuario ya existe' }, 409);
  if (await KV.get(`email:${email}`))
    return json({ error: 'Ese email ya está registrado' }, 409);

  const salt = randomHex(16);
  const passwordHash = await hashPassword(password, salt);

  await KV.put(`user:${username}`, JSON.stringify({ passwordHash, salt, email, createdAt: Date.now(), avatar: null }));
  await KV.put(`email:${email}`, username);

  const token = randomHex(32);
  await KV.put(`session:${token}`, JSON.stringify({ username, expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 }), { expirationTtl: 30 * 24 * 60 * 60 });

  return json({ token, username, email, avatar: null }, 201);

  function json(data, status = 200) {
    return new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
}
