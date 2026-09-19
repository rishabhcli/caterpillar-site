/** Optional, same-origin AI adapter. This module never runs in the browser. */
import * as cursor from './providers/cursor.mjs';
import * as openai from './providers/openai.mjs';

const PROVIDERS = [cursor, openai];
/** AI_PROVIDER pins one adapter; otherwise the first configured one wins. An unknown or unconfigured pin stays unavailable rather than silently using another provider. */
function pickProvider(env) {
  const pinned = env.AI_PROVIDER?.trim().toLowerCase();
  if (pinned) { const match = PROVIDERS.find(p => p.id === pinned); return match && match.available(env) ? match : undefined; }
  return PROVIDERS.find(p => p.available(env));
}
const MAX_BODY = 16_384;
const WINDOW_MS = 60_000;
const LOOPBACK = ['localhost', '127.0.0.1', '[::1]'];

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(data));
}

/** Default profile: loopback hosts over http. `hosted` profile: a public https deployment, same-origin only. */
function sameOrigin(req, hosted, allowedHosts) {
  try {
    const host = new URL(`http://${req.headers.host}`);
    const permitted = allowedHosts.length ? allowedHosts : hosted ? null : LOOPBACK;
    if (permitted && !permitted.includes(host.hostname)) return false;
    if (req.headers['sec-fetch-site'] === 'cross-site') return false;
    // Anyone can reach a hosted deployment, so it requires a browser same-origin signal; loopback also serves local non-browser clients.
    if (!req.headers.origin) return hosted ? req.headers['sec-fetch-site'] === 'same-origin' : true;
    const origin = new URL(req.headers.origin);
    return origin.protocol === (hosted ? 'https:' : 'http:') && origin.host === host.host;
  } catch { return false; }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    const timer = setTimeout(() => finish(new Error('timeout')), 10_000);
    timer.unref();
    function cleanup() {
      clearTimeout(timer);
      req.off('data', onData); req.off('end', onEnd); req.off('error', onError); req.off('aborted', onAbort);
    }
    function finish(error, value) {
      cleanup();
      if (error) { req.resume(); reject(error); } else resolve(value);
    }
    function onData(chunk) {
      size += chunk.length;
      if (size > MAX_BODY) finish(new Error('too_large'));
      else chunks.push(chunk);
    }
    function onEnd() {
      try { finish(null, JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { finish(new Error('invalid_json')); }
    }
    function onError() { finish(new Error('read_error')); }
    function onAbort() { finish(new Error('aborted')); }
    req.on('data', onData); req.on('end', onEnd); req.on('error', onError); req.on('aborted', onAbort);
  });
}

export function createAssistantMiddleware({ content, env = process.env, fetchImpl = globalThis.fetch, hosted = false }) {
  const sourceMap = new Map(content.map(item => [item.id, item]));
  // Optional trusted-origin pin for a hosted deployment; unset means "any host, still same-origin only".
  const allowedHosts = (env.ASSISTANT_ALLOWED_HOSTS || '').split(',').map(host => host.trim().toLowerCase()).filter(Boolean);
  const rates = new Map();
  let inFlight = 0;
  const available = () => Boolean(pickProvider(env));
  return async function assistant(req, res, next = () => json(res, 404, { error: 'Not found' })) {
    const path = req.url?.split('?')[0];
    if (path !== '/api/assistant' && path !== '/api/assistant/status') return next();
    if (!sameOrigin(req, hosted, allowedHosts)) return json(res, 403, { error: 'Same-origin requests only.' });
    if (path === '/api/assistant/status') {
      if (req.method !== 'GET') return json(res, 405, { error: 'Use GET.' });
      return json(res, 200, { available: available() });
    }
    if (req.method !== 'POST') return json(res, 405, { error: 'Use POST.' });
    if (!available()) return json(res, 503, { error: 'Live AI is not configured. Local site search remains available.' });
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) return json(res, 415, { error: 'Use application/json.' });
    if (Number(req.headers['content-length']) > MAX_BODY) return json(res, 413, { error: 'Request is too large.' });
    const now = Date.now();
    for (const [key, entry] of rates) if (now - entry.started > WINDOW_MS) rates.delete(key);
    // Behind Vercel's proxy every socket looks the same, so the hosted profile keys the window on the forwarded client.
    const ip = (hosted ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() : '') || req.socket.remoteAddress || 'local';
    const entry = rates.get(ip) || { started: now, count: 0 };
    if (++entry.count > 12 || inFlight >= 4) {
      res.setHeader('Retry-After', '60');
      return json(res, 429, { error: 'Please wait before asking another question.' });
    }
    rates.set(ip, entry);
    let body;
    try { body = await readBody(req); }
    catch (error) { return json(res, error.message === 'too_large' ? 413 : 400, { error: 'Invalid or oversized JSON request.' }); }
    if (!body || typeof body.query !== 'string' || !body.query.trim() || body.query.length > 1200 || !Array.isArray(body.sourceIds) || body.sourceIds.length > 6 || body.sourceIds.some(id => typeof id !== 'string' || !sourceMap.has(id))) {
      return json(res, 400, { error: 'Provide a question of 1–1,200 characters and valid site source IDs.' });
    }
    const sources = [...new Set(body.sourceIds)].map(id => sourceMap.get(id)).map(({ id, title, summary, url }) => ({ id, title, summary, url }));
    if (!sources.length) return json(res, 422, { error: 'No matching site sources. Use the local guide.' });
    if (inFlight >= 4) return json(res, 429, { error: 'The guide is busy. Please try again shortly.' });
    inFlight++;
    try {
      const provider = pickProvider(env);
      const { text } = await provider.respond({ query: body.query.trim(), sources, env, fetchImpl });
      if (!text) return json(res, 502, { error: 'Live AI could not complete a grounded response.' });
      return json(res, 200, { text: text.slice(0, 12_000), mode: 'ai', sourceIds: sources.map(s => s.id) });
    } catch (error) {
      // The client response stays sanitized; the operator still needs the real reason locally.
      console.error('[assistant] provider failed:', error?.message || error);
      return json(res, 502, { error: 'Live AI is unavailable. Please use local site search.' });
    } finally { inFlight--; }
  };
}
