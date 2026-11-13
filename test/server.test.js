import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from '../src/server.js';
import { grant, revoke } from '../src/config.js';
import { localURL } from '../src/providers.js';

const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
const close = server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
async function fixture(t, handler) {
  const dir = await mkdtemp(join(tmpdir(), 'ownference-test-'));
  const provider = http.createServer(handler || ((req, res) => {
    if (req.url === '/api/tags') return res.end(JSON.stringify({ models: [{ name: 'test' }] }));
    res.writeHead(200, { 'content-type': 'application/x-ndjson' });
    res.end('{"response":"hello","done":false}\n{"done":true}\n');
  }));
  const port = await listen(provider);
  const server = createServer({ configDir: dir, ollamaURL: `http://127.0.0.1:${port}`, lmstudioURL: 'http://127.0.0.1:1/v1', appleExecutable: '/nonexistent', deadlineMs: 2000 });
  const serverPort = await listen(server), url = `http://127.0.0.1:${serverPort}`;
  const token = await grant('http://localhost:4173', dir);
  t.after(async () => { await close(server); await close(provider); await rm(dir, { recursive: true, force: true }); });
  return { dir, url, token, port: serverPort };
}
const headers = token => ({ authorization: `Bearer ${token}`, origin: 'http://localhost:4173', 'content-type': 'application/json' });
const input = { model: 'ollama:test', task: 'summarize', text: 'hello' };
const execFileAsync = promisify(execFile);
test('grants are private, scoped, rotated and revoked', async t => {
  const f = await fixture(t);
  assert.equal((await stat(f.dir)).mode & 0o777, 0o700);
  assert.equal((await stat(join(f.dir, 'grants.json'))).mode & 0o777, 0o600);
  assert.equal((await readFile(join(f.dir, 'grants.json'), 'utf8')).includes(f.token), false);
  assert.equal((await fetch(f.url + '/v1/models', { headers: headers(f.token) })).status, 200);
  assert.equal((await fetch(f.url + '/v1/models', { headers: { ...headers(f.token), origin: 'null' } })).status, 403);
  const otherToken = await grant('http://localhost:4174', f.dir);
  assert.equal((await fetch(f.url + '/v1/models', { headers: { ...headers(otherToken), origin: 'http://localhost:4173' } })).status, 403);
  assert.equal((await fetch(f.url + '/v1/models', { headers: { ...headers(f.token), origin: 'https://localhost:4173' } })).status, 403);
  assert.equal((await fetch(f.url + '/v1/models')).status, 401);
  const next = await grant('http://localhost:4173', f.dir);
  assert.equal((await fetch(f.url + '/v1/models', { headers: headers(f.token) })).status, 401);
  assert.equal(await revoke('http://localhost:9999', f.dir), false);
  assert.equal((await fetch(f.url + '/v1/models', { headers: { ...headers(otherToken), origin: 'http://localhost:4174' } })).status, 200);
  await assert.rejects(
    execFileAsync(process.execPath, ['src/cli.js', 'revoke', '--origin', 'http://localhost:9999', '--config-dir', f.dir], { cwd: new URL('..', import.meta.url) }),
    e => e.code === 1 && /No grant found/.test(e.stderr) && /match exactly/.test(e.stderr)
  );
  assert.equal((await fetch(f.url + '/v1/models', { headers: { ...headers(otherToken), origin: 'http://localhost:4174' } })).status, 200);
  assert.equal(await revoke('http://localhost:4173', f.dir), true);
  assert.equal((await fetch(f.url + '/v1/models', { headers: { authorization: `Bearer ${next}` } })).status, 401);
  await assert.rejects(grant('https://example.com/path', f.dir));
});
test('Chrome extension origins can be granted, authenticated and revoked without accepting paths or ports', async t => {
  const f = await fixture(t);
  const origin = 'chrome-extension://iacejanagmkfpcajmcnlbikgnmomdpba';
  const token = await grant(origin, f.dir);
  assert.equal((await fetch(f.url + '/v1/models', { headers: { authorization: `Bearer ${token}`, origin } })).status, 200);
  for (const invalid of [origin + '/', origin + ':3210', origin + '/popup.html', 'chrome-extension://not-an-extension']) {
    await assert.rejects(grant(invalid, f.dir));
  }
  await revoke(origin, f.dir);
  assert.equal((await fetch(f.url + '/v1/models', { headers: { authorization: `Bearer ${token}`, origin } })).status, 403);
  assert.equal((await fetch(f.url + '/v1/models', { headers: { authorization: `Bearer ${token}` } })).status, 401);
});
test('host validation, preflight and streaming', async t => {
  const f = await fixture(t);
  // Node's Fetch implementation rewrites Host; raw HTTP exercises the actual rebinding defense.
  const forgedHostStatus = await new Promise((resolve, reject) => {
    http.get(f.url + '/health', { headers: { host: `evil.example:${f.port}` } }, response => {
      response.resume();
      resolve(response.statusCode);
    }).on('error', reject);
  });
  assert.equal(forgedHostStatus, 403);
  const preflight = await fetch(f.url + '/v1/generate', { method: 'OPTIONS', headers: { origin: 'http://localhost:4173' } });
  assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://localhost:4173');
  assert.equal((await fetch(f.url + '/v1/generate', { method: 'OPTIONS', headers: { origin: 'http://localhost:4174' } })).status, 403);
  assert.equal((await fetch(f.url + '/v1/models', { headers: { origin: 'http://localhost:4173' } })).status, 401);
  const response = await fetch(f.url + '/v1/generate', { method: 'POST', headers: headers(f.token), body: JSON.stringify(input) });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.text()).trim().split('\n').map(JSON.parse), [{ type: 'delta', text: 'hello' }, { type: 'done' }]);
});
test('validation rejects unsafe requests and remote providers', async t => {
  const f = await fixture(t);
  for (const u of ['https://example.com', 'http://example.com', 'http://127.0.0.2:1234', 'http://user@localhost']) assert.throws(() => localURL(u));
  for (const value of [{ ...input, text: '' }, { ...input, task: 'shell' }, { ...input, tools: [] }, { ...input, text: 'x'.repeat(24001) }, { ...input, model: 'ollama:missing' }]) {
    assert.equal((await fetch(f.url + '/v1/generate', { method: 'POST', headers: headers(f.token), body: JSON.stringify(value) })).status, 400);
  }
  assert.equal((await fetch(f.url + '/v1/generate', { method: 'POST', headers: headers(f.token), body: 'x'.repeat(140000) })).status, 413);
});
test('provider errors are sanitized', async t => {
  const f = await fixture(t, (req, res) => {
    if (req.url === '/api/tags') return res.end(JSON.stringify({ models: [{ name: 'test' }] }));
    res.writeHead(500); res.end('SECRET upstream data');
  });
  const response = await fetch(f.url + '/v1/generate', { method: 'POST', headers: headers(f.token), body: JSON.stringify(input) });
  const text = await response.text(); assert.match(text, /provider_error/); assert.doesNotMatch(text, /SECRET/);
});
test('Apple provider errors map known codes without exposing provider text', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'ownference-apple-test-'));
  const executable = join(dir, 'apple');
  await writeFile(executable, '#!/bin/sh\nif [ "$1" = status ]; then echo available; else echo \'{"type":"error","code":"input_too_large","text":"SECRET"}\'; fi\n', { mode: 0o700 });
  const server = createServer({ configDir: dir, ollamaURL: 'http://127.0.0.1:1', lmstudioURL: 'http://127.0.0.1:1', appleExecutable: executable });
  const port = await listen(server);
  t.after(async () => { await close(server); await rm(dir, { recursive: true, force: true }); });
  const token = await grant('http://localhost:4173', dir);
  const response = await fetch(`http://127.0.0.1:${port}/v1/generate`, {
    method: 'POST', headers: headers(token), body: JSON.stringify({ ...input, model: 'apple:system' })
  });
  const event = JSON.parse((await response.text()).trim());
  assert.deepEqual(event, { type: 'error', error: { code: 'input_too_large', message: 'Input is too large for the model. Shorten the input and try again.' } });
  await writeFile(executable, '#!/bin/sh\nif [ "$1" = status ]; then echo available; else echo \'{"type":"error","code":"guardrail_violation","text":"SECRET"}\'; fi\n');
  const blocked = await fetch(`http://127.0.0.1:${port}/v1/generate`, {
    method: 'POST', headers: headers(token), body: JSON.stringify({ ...input, model: 'apple:system' })
  });
  assert.deepEqual(JSON.parse((await blocked.text()).trim()), { type: 'error', error: { code: 'guardrail_violation', message: 'The model declined this request due to its safety guardrails.' } });
  await writeFile(executable, '#!/bin/sh\nif [ "$1" = status ]; then echo available; else echo \'{"type":"error","code":"SECRET","text":"SECRET"}\'; fi\n');
  const unknown = await fetch(`http://127.0.0.1:${port}/v1/generate`, {
    method: 'POST', headers: headers(token), body: JSON.stringify({ ...input, model: 'apple:system' })
  });
  const unknownText = await unknown.text();
  assert.match(unknownText, /provider_error/);
  assert.doesNotMatch(unknownText, /SECRET/);
});
test('disconnect cancels upstream and concurrency is bounded', async t => {
  let closed;
  const disconnected = new Promise(resolve => { closed = resolve; });
  const f = await fixture(t, (req, res) => {
    if (req.url === '/api/tags') return res.end(JSON.stringify({ models: [{ name: 'test' }] }));
    res.on('close', closed); res.writeHead(200); res.write('{"response":"first","done":false}\n');
  });
  const controller = new AbortController();
  const response = await fetch(f.url + '/v1/generate', { method: 'POST', headers: headers(f.token), body: JSON.stringify(input), signal: controller.signal });
  await response.body.getReader().read();
  const controller2 = new AbortController();
  const second = await fetch(f.url + '/v1/generate', { method: 'POST', headers: headers(f.token), body: JSON.stringify(input), signal: controller2.signal });
  await second.body.getReader().read();
  const third = await fetch(f.url + '/v1/generate', { method: 'POST', headers: headers(f.token), body: JSON.stringify(input) });
  assert.equal(third.status, 429);
  controller.abort(); controller2.abort();
  await Promise.race([disconnected, new Promise((_, reject) => setTimeout(() => reject(new Error('upstream not cancelled')), 1500))]);
});
