const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (context.request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const { KV } = context.env;
  const auth = context.request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '').trim();

  if (token && KV) await KV.delete(`session:${token}`);

  return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
}
