import http from 'node:http';
import { once } from 'node:events';
import { readGrants, authenticate, defaultConfigDir } from './config.js';
import { providerConfig, listModels, generate, validTasks, ProviderError } from './providers.js';

const MAX_BODY = 128 * 1024;
function error(res, status, code, message) {
  if (res.headersSent) return;
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: { code, message } }));
}
function body(req) {
  return new Promise((resolve, reject) => {
    let size = 0, parts = [], exceeded = false;
    req.on('data', chunk => {
      if (exceeded) return;
      size += chunk.length;
      if (size > MAX_BODY) {
        exceeded = true; parts = [];
        const e = new Error('Request body too large'); e.status = 413; reject(e);
      } else parts.push(chunk);
    });
    req.on('end', () => {
      if (exceeded) return;
      try { resolve(JSON.parse(Buffer.concat(parts).toString('utf8'))); }
      catch { const e = new Error('Invalid JSON'); e.status = 400; reject(e); }
    });
    req.on('error', reject);
    req.on('aborted', () => reject(new Error('Request aborted')));
  });
}
function validate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k => !['model', 'task', 'text', 'instruction'].includes(k))) return false;
  return typeof input.model === 'string' && input.model.length <= 300 && validTasks.includes(input.task) && typeof input.text === 'string' && input.text.length >= 1 && input.text.length <= 24000 && (input.instruction === undefined || (typeof input.instruction === 'string' && input.instruction.length <= 2000));
}
export function createServer(options = {}) {
  const config = providerConfig(options);
  const configDir = options.configDir || defaultConfigDir();
  const maxConcurrent = options.maxConcurrent ?? 2;
  const deadlineMs = options.deadlineMs ?? 120000;
  const discoveryMs = options.discoveryMs ?? 3000;
  let active = 0;
  const server = http.createServer(async (req, res) => {
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('cache-control', 'no-store');
    res.setHeader('content-security-policy', "default-src 'none'; frame-ancestors 'none'");
    res.setHeader('x-frame-options', 'DENY');
    const port = server.address()?.port;
    if (!port || ![ `127.0.0.1:${port}`, `localhost:${port}` ].includes(req.headers.host)) return error(res, 403, 'invalid_host', 'Invalid Host header');
    const origin = req.headers.origin;
    try {
      const grants = await readGrants(configDir);
      const knownOrigin = typeof origin === 'string' && grants.some(g => g.origin === origin);
      if (origin !== undefined && !knownOrigin) return error(res, 403, 'invalid_origin', 'Origin is not authorized');
      if (knownOrigin) { res.setHeader('access-control-allow-origin', origin); res.setHeader('vary', 'Origin'); }
      if (req.method === 'OPTIONS') {
        if (!knownOrigin) return error(res, 403, 'invalid_origin', 'Origin is not authorized');
        res.writeHead(204, { 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'Authorization, Content-Type', 'access-control-max-age': '600' }); return res.end();
      }
      if (req.method === 'GET' && req.url === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ ok: true, version: '0.2.0' })); }
      const authorization = /^Bearer ([A-Za-z0-9_-]+)$/.exec(req.headers.authorization || '');
      const authorized = authorization && authenticate(grants, authorization[1]);
      if (!authorized) return error(res, 401, 'unauthorized', 'A valid bearer token is required');
      if (origin !== undefined && origin !== authorized.origin) return error(res, 403, 'invalid_origin', 'Token does not authorize this origin');
      if (req.method === 'GET' && req.url === '/v1/models') {
        const result = await listModels(config, AbortSignal.timeout(discoveryMs));
        res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(result));
      }
      if (req.method !== 'POST' || req.url !== '/v1/generate') return error(res, 404, 'not_found', 'Not found');
      if (!/^application\/json(?:\s*;|\s*$)/i.test(req.headers['content-type'] || '')) return error(res, 400, 'invalid_request', 'Content-Type must be application/json');
      if (Number(req.headers['content-length']) > MAX_BODY) { req.resume(); return error(res, 413, 'body_too_large', 'Request body too large'); }
      let input;
      try { input = await body(req); } catch (e) { return error(res, e.status || 400, e.status === 413 ? 'body_too_large' : 'invalid_request', e.message); }
      if (!validate(input)) return error(res, 400, 'invalid_request', 'Invalid model, task, text, instruction, or unexpected field');
      if (active >= maxConcurrent) return error(res, 429, 'busy', 'Too many active requests');
      active++;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), deadlineMs); timer.unref();
      const disconnect = () => { if (!res.writableEnded) controller.abort(); };
      res.on('close', disconnect);
      try {
        const available = await listModels(config, AbortSignal.any([controller.signal, AbortSignal.timeout(discoveryMs)]));
        if (controller.signal.aborted) return error(res, 503, 'provider_unavailable', 'Provider timed out');
        if (!available.models.some(m => m.id === input.model)) return error(res, 400, 'unknown_model', 'Model is not available');
        res.writeHead(200, { 'content-type': 'application/x-ndjson; charset=utf-8' });
        res.flushHeaders();
        let outputSize = 0;
        for await (const text of generate(config, input, controller.signal)) {
          outputSize += text.length;
          if (outputSize > 128 * 1024) throw new Error('Output limit exceeded');
          if (!res.write(JSON.stringify({ type: 'delta', text }) + '\n')) await once(res, 'drain', { signal: controller.signal });
        }
        if (!res.destroyed) res.end(JSON.stringify({ type: 'done' }) + '\n');
      } catch (e) {
        if (!res.destroyed) {
          const failure = e instanceof ProviderError
            ? { code: e.code, message: e.message }
            : { code: 'provider_error', message: 'Local provider request failed or timed out' };
          if (!res.headersSent) error(res, 502, failure.code, failure.message);
          else res.end(JSON.stringify({ type: 'error', error: failure }) + '\n');
        }
      } finally { clearTimeout(timer); res.off('close', disconnect); controller.abort(); active--; }
    } catch { error(res, 503, 'unavailable', 'Runtime configuration unavailable'); }
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 10000;
  return server;
}
