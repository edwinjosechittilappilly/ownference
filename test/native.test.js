import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import http from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { installNative, nativeStatus, uninstallNative, runNativeHost } from '../src/native.js';
import { authenticate, grant, readGrants, revoke } from '../src/config.js';

const extensionId = 'abcdefghijklmnopabcdefghijklmnop';
function frame(value) {
  const data = Buffer.from(JSON.stringify(value));
  const header = Buffer.alloc(4); header.writeUInt32LE(data.length);
  return Buffer.concat([header, data]);
}
function messages(stream) {
  let buffer = Buffer.alloc(0);
  const queue = [], waiters = [];
  stream.on('data', data => {
    buffer = Buffer.concat([buffer, data]);
    while (buffer.length >= 4 && buffer.length >= buffer.readUInt32LE(0) + 4) {
      const size = buffer.readUInt32LE(0);
      const value = JSON.parse(buffer.subarray(4, size + 4)); buffer = buffer.subarray(size + 4);
      if (waiters.length) waiters.shift()(value); else queue.push(value);
    }
  });
  return () => queue.length ? Promise.resolve(queue.shift()) : new Promise(resolve => waiters.push(resolve));
}

test('installation registers an explicit extension, keeps credentials private and removes only its grant', async t => {
  const root = await mkdtemp(join(tmpdir(), 'ownmode-native-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const options = { extensionId, configDir: join(root, 'config'), manifestDir: join(root, 'manifests') };
  await assert.rejects(installNative({ ...options, extensionId: 'bad' }), /extension ID/);
  await grant('https://example.com', options.configDir);
  const installed = await installNative(options);
  assert.equal((await nativeStatus(options)).installed, true);
  const manifest = JSON.parse(await readFile(installed.manifest, 'utf8'));
  assert.deepEqual(manifest.allowed_origins, [`chrome-extension://${extensionId}/`]);
  assert.equal(manifest.path, installed.launcher);
  assert.match(await readFile(installed.launcher, 'utf8'), /native\.js/);
  assert.equal((await stat(join(options.configDir, 'native/host.json'))).mode & 0o777, 0o600);
  assert.equal((await readGrants(options.configDir)).length, 2);
  await uninstallNative(options);
  assert.equal((await nativeStatus(options)).installed, false);
  assert.deepEqual((await readGrants(options.configDir)).map(g => g.origin), ['https://example.com']);
});

test('uninstall preserves a separately renewed grant and unrelated manifest', async t => {
  const root = await mkdtemp(join(tmpdir(), 'ownmode-native-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const options = { extensionId, configDir: join(root, 'config'), manifestDir: join(root, 'manifests') };
  const origin = `chrome-extension://${extensionId}`;
  const original = await grant(origin, options.configDir);
  const installed = await installNative(options);
  const nativeToken = JSON.parse(await readFile(join(options.configDir, 'native/host.json'), 'utf8')).token;
  assert.ok(authenticate(await readGrants(options.configDir), original));
  const renewed = await grant(origin, options.configDir);
  assert.ok(authenticate(await readGrants(options.configDir), nativeToken));
  await writeFile(installed.manifest, JSON.stringify({ name: 'other', path: '/other' }));
  await uninstallNative(options);
  assert.equal((await readGrants(options.configDir)).length, 1);
  assert.ok(authenticate(await readGrants(options.configDir), renewed));
  assert.equal(Boolean(authenticate(await readGrants(options.configDir), nativeToken)), false);
  assert.equal(JSON.parse(await readFile(installed.manifest, 'utf8')).name, 'other');
});

test('framed requests authenticate, stream, and cancel bridge work', async t => {
  let sawAbort;
  const aborted = new Promise(resolve => { sawAbort = resolve; });
  const server = http.createServer((req, res) => {
    assert.equal(req.headers.authorization, 'Bearer private-token');
    if (req.url === '/v1/models') { res.end(JSON.stringify({ models: [{ id: 'local:test' }] })); return; }
    req.resume();
    res.writeHead(200, { 'content-type': 'application/x-ndjson' });
    res.write(JSON.stringify({ type: 'delta', text: 'hello' }) + '\n');
    res.on('close', sawAbort);
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => server.close());
  const input = new PassThrough(), output = new PassThrough(), next = messages(output);
  const host = runNativeHost({ token: 'private-token', port: server.address().port, input, output });
  t.after(() => { host.close(); input.destroy(); output.destroy(); });
  const models = frame({ v: 1, id: 'm', op: 'models' });
  input.write(models.subarray(0, 2)); input.write(models.subarray(2));
  assert.deepEqual(await next(), { v: 1, id: 'm', event: 'models', data: { models: [{ id: 'local:test' }] } });
  input.write(frame({ v: 1, id: 'g', op: 'generate', input: { model: 'local:test', task: 'draft', text: 'x' } }));
  assert.deepEqual(await next(), { v: 1, id: 'g', event: 'delta', text: 'hello' });
  input.write(frame({ v: 1, id: 'c', op: 'cancel', target: 'g' }));
  assert.deepEqual(await next(), { v: 1, id: 'c', event: 'done' });
  assert.equal((await next()).error.code, 'cancelled');
  await aborted;
});

test('oversized frames close the input without forwarding work', async () => {
  const input = new PassThrough(), output = new PassThrough();
  const host = runNativeHost({ token: 'private-token', input, output });
  const header = Buffer.alloc(4); header.writeUInt32LE(128 * 1024 + 1);
  input.write(header);
  assert.equal(input.destroyed, true);
  host.close(); output.destroy();
});

test('limits concurrent work and rejects a cancel using an active ID', async () => {
  const input = new PassThrough(), output = new PassThrough(), next = messages(output);
  const host = runNativeHost({ token: 'private-token', port: 1, input, output });
  const requests = Array.from({ length: 8 }, (_, i) => frame({ v: 1, id: String(i), op: 'models' }));
  requests.push(frame({ v: 1, id: '0', op: 'cancel', target: '1' }));
  requests.push(frame({ v: 1, id: 'overflow', op: 'models' }));
  input.write(Buffer.concat(requests));
  assert.equal((await next()).error.code, 'invalid_request');
  assert.equal((await next()).error.code, 'busy');
  host.close(); input.destroy(); output.destroy();
});

test('rejects an incomplete native frame at end of input', async () => {
  const input = new PassThrough(), output = new PassThrough(), next = messages(output);
  runNativeHost({ token: 'private-token', input, output });
  input.end(frame({ v: 1, id: 'm', op: 'models' }).subarray(0, 6));
  assert.deepEqual(await next(), { v: 1, id: '', event: 'error', error: { code: 'invalid_request', message: 'Truncated native message' } });
  output.destroy();
});

test('closes a stalled connection rather than buffering unbounded output', () => {
  const input = new PassThrough();
  const output = new Writable({ write() { /* Deliberately never completes: exercise stalled-output bounds. */ } });
  runNativeHost({ token: 'private-token', input, output });
  const invalid = frame({ v: 1, id: 'x', op: 'unknown' });
  for (let i = 0; i < 20000 && !input.destroyed; i++) input.write(invalid);
  assert.equal(input.destroyed, true);
  assert.equal(output.destroyed, true);
});

test('reports upstream and disconnected bridge failures without exposing credentials', async t => {
  const server = http.createServer((_req, res) => {
    res.writeHead(401, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: { code: 'unauthorized', message: 'Rejected private-token' } }));
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = server.address().port;
  const input = new PassThrough(), output = new PassThrough(), next = messages(output);
  const host = runNativeHost({ token: 'private-token', port, input, output });
  t.after(() => { host.close(); input.destroy(); output.destroy(); });
  input.write(frame({ v: 1, id: 'first', op: 'models' }));
  const denied = await next();
  assert.equal(denied.error.code, 'native_grant_revoked');
  assert.match(denied.error.message, /Reinstall/);
  await new Promise(resolve => server.close(resolve));
  input.write(frame({ v: 1, id: 'second', op: 'models' }));
  const disconnected = await next();
  assert.equal(disconnected.error.code, 'bridge_unavailable');
  assert.match(disconnected.error.message, /ownmode serve/);
  assert.doesNotMatch(JSON.stringify(disconnected), /private-token/);
});

test('installed launcher handles framed HTTP through a symlinked installation', async t => {
  const root = await mkdtemp(join(tmpdir(), 'ownmode-host-spawn-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const alias = join(root, 'alias');
  await symlink(root, alias);
  const server = http.createServer((req, res) => {
    assert.match(req.headers.authorization, /^Bearer /);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ models: [{ id: 'fixture:model' }] }));
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => server.close());
  const options = { extensionId, configDir: join(alias, 'config'), manifestDir: join(alias, 'manifest'), port: server.address().port };
  const installed = await installNative(options);
  const child = spawn(installed.launcher, [], { stdio: ['pipe', 'pipe', 'pipe'] });
  t.after(() => child.kill());
  const next = messages(child.stdout);
  child.stdin.write(frame({ v: 1, id: 'spawned', op: 'models' }));
  const response = await Promise.race([next(), new Promise((_, reject) => setTimeout(() => reject(new Error('installed host did not answer')), 3000))]);
  assert.deepEqual(response.data.models, [{ id: 'fixture:model' }]);
  assert.equal(response.id, 'spawned');
  child.stdin.end();
});

test('native status detects revoked grant and missing Node executable', async t => {
  const root = await mkdtemp(join(tmpdir(), 'ownmode-native-status-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const options = { extensionId, configDir: join(root, 'config'), manifestDir: join(root, 'manifest') };
  await installNative(options);
  await revoke(`chrome-extension://${extensionId}`, options.configDir);
  assert.equal((await nativeStatus(options)).installed, false);
  await installNative(options);
  const host = join(options.configDir, 'native', 'host.json');
  const config = JSON.parse(await readFile(host, 'utf8'));
  config.nodePath = join(root, 'missing-node');
  await writeFile(host, JSON.stringify(config));
  assert.equal((await nativeStatus(options)).installed, false);
});
