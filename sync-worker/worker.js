// Pilinha Sync: guarda só um blob cifrado (AES-GCM, ponta a ponta) por id.
// O servidor nunca vê a carteira nem o código de pareamento: o id e o token de escrita
// são derivados do código no Mac/iPhone. Só quem tem o token de escrita sobrescreve.
const MAX = 64 * 1024;
const ID = /^[0-9a-f]{32}$/;
const hits = new Map(); // rate limit simples por isolate: 60 req/min por IP
function limited(ip) {
  const now = Math.floor(Date.now() / 60000), k = `${ip}|${now}`;
  const n = (hits.get(k) ?? 0) + 1; hits.set(k, n);
  if (hits.size > 5000) for (const key of hits.keys()) if (!key.endsWith(`|${now}`)) hits.delete(key);
  return n > 60;
}
async function sha256hex(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,PUT,OPTIONS', 'access-control-allow-headers': 'content-type,x-write-token' };
const j = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...cors } });
export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    const url = new URL(req.url);
    if (url.pathname === '/' || url.pathname === '/health') return j(200, { ok: true, service: 'pilinha-sync' });
    const m = url.pathname.match(/^\/v1\/sync\/([^/]+)$/);
    if (!m || !ID.test(m[1])) return j(404, { error: 'not_found' });
    const ip = req.headers.get('cf-connecting-ip') ?? 'x';
    if (limited(ip)) return j(429, { error: 'rate_limited' });
    const id = m[1];
    if (req.method === 'GET') {
      const { value, metadata } = await env.SYNC.getWithMetadata(`b:${id}`, { type: 'arrayBuffer' });
      if (!value) return j(404, { error: 'not_found' });
      return new Response(value, { headers: { 'content-type': 'application/octet-stream', 'cache-control': 'no-store', 'x-updated-at': String(metadata?.t ?? ''), ...cors } });
    }
    if (req.method === 'PUT') {
      const tok = req.headers.get('x-write-token') ?? '';
      if (!/^[0-9a-f]{64}$/.test(tok)) return j(401, { error: 'bad_token' });
      const len = Number(req.headers.get('content-length') ?? '0');
      if (len > MAX) return j(413, { error: 'too_large' });
      const body = await req.arrayBuffer();
      if (body.byteLength < 29 || body.byteLength > MAX) return j(413, { error: 'bad_size' });
      const th = await sha256hex(tok);
      const owner = await env.SYNC.get(`w:${id}`);
      if (owner && owner !== th) return j(403, { error: 'forbidden' });
      if (!owner) await env.SYNC.put(`w:${id}`, th);
      const t = Date.now();
      // Some sozinho se o Mac parar de mandar por 180 dias.
      await env.SYNC.put(`b:${id}`, body, { metadata: { t }, expirationTtl: 180 * 86400 });
      return j(200, { ok: true, t });
    }
    return j(405, { error: 'method' });
  },
};
