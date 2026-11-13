import { chmod, copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { authenticate, defaultConfigDir, grantNative, readGrants, revokeNative } from './config.js';
import { executableNode, persistentNodePath } from './node-path.js';

export const NATIVE_HOST_NAME = 'com.ownference.bridge';
const MAX_FRAME = 128 * 1024;
const extensionPattern = /^[a-p]{32}$/;
const shellQuote = value => `'${value.replaceAll("'", "'\\''")}'`;
function paths(options) {
  if (options.manifestDir !== undefined && (typeof options.manifestDir !== 'string' || !isAbsolute(options.manifestDir))) throw new Error('Native manifest directory must be absolute');
  const configDir = resolve(options.configDir || defaultConfigDir());
  const manifestDir = resolve(options.manifestDir || (process.platform === 'darwin'
    ? join(homedir(), 'Library/Application Support/Google/Chrome/NativeMessagingHosts')
    : join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'google-chrome/NativeMessagingHosts')));
  return { configDir, manifestDir, nativeDir: join(configDir, 'native'), manifest: join(manifestDir, `${NATIVE_HOST_NAME}.json`) };
}

export async function installNative(options = {}) {
  const { extensionId, port = 3210 } = options;
  const nodePath = persistentNodePath(options.nodePath);
  if (!extensionPattern.test(extensionId || '')) throw new Error('A valid 32-character Chrome extension ID is required');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid bridge port');
  const p = paths(options);
  if ([p.nativeDir, p.manifestDir].some(path => /[\r\n]/.test(path))) throw new Error('Native host paths must not contain newlines');
  const previous = await nativeStatus(options);
  if (previous.installed && previous.extensionId !== extensionId) throw new Error('Uninstall the existing native host before changing extension ID');
  try {
    const existing = JSON.parse(await readFile(p.manifest, 'utf8'));
    if (existing.name !== NATIVE_HOST_NAME || existing.path !== join(p.nativeDir, 'host.sh')) throw new Error('Native host manifest belongs to another installation');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await mkdir(p.nativeDir, { recursive: true, mode: 0o700 });
  await chmod(p.nativeDir, 0o700);
  await mkdir(p.manifestDir, { recursive: true, mode: 0o700 });
  const origin = `chrome-extension://${extensionId}`;
  const token = await grantNative(origin, p.configDir);
  const sourceDir = dirname(fileURLToPath(import.meta.url));
  await copyFile(join(sourceDir, 'native.js'), join(p.nativeDir, 'native.js'));
  await copyFile(join(sourceDir, 'config.js'), join(p.nativeDir, 'config.js'));
  await copyFile(join(sourceDir, 'node-path.js'), join(p.nativeDir, 'node-path.js'));
  await writeFile(join(p.nativeDir, 'package.json'), '{"type":"module"}\n', { mode: 0o600 });
  await writeFile(join(p.nativeDir, 'host.json'), JSON.stringify({ extensionId, token, port, nodePath }) + '\n', { mode: 0o600 });
  await chmod(join(p.nativeDir, 'host.json'), 0o600);
  const launcher = join(p.nativeDir, 'host.sh');
  await writeFile(launcher, `#!/bin/sh\nexec ${shellQuote(nodePath)} ${shellQuote(join(p.nativeDir, 'native.js'))} --host ${shellQuote(join(p.nativeDir, 'host.json'))}\n`, { mode: 0o700 });
  await chmod(launcher, 0o700);
  await writeFile(p.manifest, JSON.stringify({ name: NATIVE_HOST_NAME, description: 'Ownference local bridge', path: launcher, type: 'stdio', allowed_origins: [`${origin}/`] }, null, 2) + '\n', { mode: 0o600 });
  return { installed: true, extensionId, manifest: p.manifest, launcher };
}

export async function nativeStatus(options = {}) {
  const p = paths(options);
  try {
    const [host, manifest] = await Promise.all([readFile(join(p.nativeDir, 'host.json'), 'utf8'), readFile(p.manifest, 'utf8')]);
    const config = JSON.parse(host), registration = JSON.parse(manifest);
    const grant = authenticate(await readGrants(p.configDir), config.token);
    const installed = extensionPattern.test(config.extensionId || '') && registration.name === NATIVE_HOST_NAME && registration.path === join(p.nativeDir, 'host.sh') && registration.allowed_origins?.length === 1 && registration.allowed_origins[0] === `chrome-extension://${config.extensionId}/` && grant?.native === true && grant.origin === `chrome-extension://${config.extensionId}` && executableNode(config.nodePath);
    return { installed, extensionId: config.extensionId, manifest: p.manifest, launcher: join(p.nativeDir, 'host.sh'), ...(!installed ? { reason: 'Native host configuration, grant, or Node executable is unavailable. Reinstall the native host.' } : {}) };
  } catch (error) { if (error.code === 'ENOENT') return { installed: false, manifest: p.manifest }; throw error; }
}

export async function uninstallNative(options = {}) {
  const p = paths(options);
  let config;
  try { config = JSON.parse(await readFile(join(p.nativeDir, 'host.json'), 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (config && extensionPattern.test(config.extensionId || '') && typeof config.token === 'string') {
    await revokeNative(`chrome-extension://${config.extensionId}`, config.token, p.configDir);
  }
  try {
    const registration = JSON.parse(await readFile(p.manifest, 'utf8'));
    if (registration.name === NATIVE_HOST_NAME && registration.path === join(p.nativeDir, 'host.sh')) await rm(p.manifest);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await rm(p.nativeDir, { recursive: true, force: true });
  return { installed: false, manifest: p.manifest };
}

export function runNativeHost({ token, port = 3210, input = process.stdin, output = process.stdout }) {
  let buffer = Buffer.alloc(0), closed = false;
  const active = new Map();
  const stop = () => { closed = true; for (const controller of active.values()) controller.abort(); active.clear(); };
  const send = message => {
    if (closed) return;
    const body = Buffer.from(JSON.stringify(message));
    if (body.length > MAX_FRAME) return send({ v: 1, id: message.id, event: 'error', error: { code: 'response_too_large', message: 'Bridge response exceeds the native message limit' } });
    const header = Buffer.alloc(4); header.writeUInt32LE(body.length);
    if (output.writableLength + body.length + 4 > 1024 * 1024) {
      stop(); input.destroy(); output.destroy(); return;
    }
    output.write(Buffer.concat([header, body]));
  };
  const safeError = (value, fallback) => typeof value === 'string' ? (token ? value.replaceAll(token, '[redacted]') : value).slice(0, 2048) : fallback;
  const fail = (id, code, message) => send({ v: 1, id, event: 'error', error: { code: safeError(code, 'bridge_error'), message: safeError(message, 'Bridge request failed') } });
  async function request(message) {
    const { id, op } = message || {};
    if (message?.v !== 1 || typeof id !== 'string' || !id || id.length > 256 || !['models', 'generate', 'cancel'].includes(op)) { fail(typeof id === 'string' ? id.slice(0, 256) : '', 'invalid_request', 'Invalid native request'); return; }
    if (active.has(id)) { fail(id, 'invalid_request', 'Request ID is already active'); return; }
    if (op === 'cancel') {
      if (typeof message.target !== 'string') { fail(id, 'invalid_request', 'Invalid cancellation target'); return; }
      active.get(message.target)?.abort();
      send({ v: 1, id, event: 'done' }); return;
    }
    if (active.size >= 8) { fail(id, 'busy', 'Too many active native requests'); return; }
    const controller = new AbortController(); active.set(id, controller);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/v1/${op}`, { method: op === 'models' ? 'GET' : 'POST', headers: { authorization: `Bearer ${token}`, ...(op === 'generate' ? { 'content-type': 'application/json' } : {}) }, ...(op === 'generate' ? { body: JSON.stringify(message.input) } : {}), signal: controller.signal });
      if (!response.ok) {
        if (response.status === 401) { fail(id, 'native_grant_revoked', 'Native host authorization was revoked. Reinstall with ownference native install --extension-id <ID>.'); return; }
        const data = await response.json().catch(() => ({}));
        fail(id, data.error?.code || 'bridge_error', data.error?.message || 'Bridge request failed'); return;
      }
      if (op === 'models') { send({ v: 1, id, event: 'models', data: await response.json() }); return; }
      let pending = '', terminal = false;
      const decoder = new TextDecoder();
      for await (const chunk of response.body) {
        pending += decoder.decode(chunk, { stream: true });
        if (pending.length > MAX_FRAME) throw new Error('Bridge response exceeds the message limit');
        let end;
        while ((end = pending.indexOf('\n')) !== -1) {
          const line = pending.slice(0, end); pending = pending.slice(end + 1);
          if (!line) continue;
          const event = JSON.parse(line);
          if (event.type === 'delta' && typeof event.text === 'string') send({ v: 1, id, event: 'delta', text: event.text });
          else if (event.type === 'done') { send({ v: 1, id, event: 'done' }); terminal = true; }
          else if (event.type === 'error') { fail(id, event.error?.code || 'bridge_error', event.error?.message || 'Bridge request failed'); terminal = true; }
          else throw new Error('Invalid bridge stream');
          if (terminal) break;
        }
        if (terminal) break;
      }
      if (!terminal) throw new Error('Bridge stream ended unexpectedly');
    } catch {
      if (controller.signal.aborted) fail(id, 'cancelled', 'Request cancelled');
      else fail(id, 'bridge_unavailable', 'Cannot reach the local Ownference bridge. Start it with ownference serve.');
    } finally { active.delete(id); }
  }
  input.on('data', chunk => {
    if (closed) return;
    let offset = 0;
    while (offset < chunk.length) {
      const needed = buffer.length < 4 ? 4 - buffer.length : buffer.readUInt32LE(0) + 4 - buffer.length;
      const count = Math.min(needed, chunk.length - offset);
      buffer = Buffer.concat([buffer, chunk.subarray(offset, offset + count)]); offset += count;
      if (buffer.length < 4) continue;
      const size = buffer.readUInt32LE(0);
      if (size > MAX_FRAME || size === 0) { stop(); input.destroy(); return; }
      if (buffer.length < size + 4) continue;
      const body = buffer.subarray(4); buffer = Buffer.alloc(0);
      try { void request(JSON.parse(body.toString('utf8'))); } catch { fail('', 'invalid_request', 'Invalid native message'); }
    }
  });
  input.on('end', () => {
    if (buffer.length) fail('', 'invalid_request', 'Truncated native message');
    stop();
  });
  input.on('error', stop); output.on('error', stop);
  return { close: stop };
}

if (process.argv[2] === '--host' && process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  readFile(process.argv[3], 'utf8').then(data => runNativeHost(JSON.parse(data))).catch(() => { console.error('Ownference native host configuration unavailable. Reinstall the native host.'); process.exitCode = 1; });
}
