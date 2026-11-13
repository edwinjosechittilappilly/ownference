#!/usr/bin/env node
import { createServer } from './server.js';
import { grant, revoke, defaultConfigDir } from './config.js';
import { providerConfig, listModels } from './providers.js';

const usage = 'Usage: ownference serve [--port 3210] [--ollama-url URL] [--lmstudio-url URL] [--config-dir PATH]\n       ownference grant|revoke --origin ORIGIN [--config-dir PATH]\n       ownference doctor [--ollama-url URL] [--lmstudio-url URL] [--config-dir PATH]';
async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === '--help' || command === 'help') { console.log(usage); return; }
  const allowed = { serve: ['port', 'ollama-url', 'lmstudio-url', 'config-dir'], doctor: ['ollama-url', 'lmstudio-url', 'config-dir'], grant: ['origin', 'config-dir'], revoke: ['origin', 'config-dir'] }[command];
  if (!allowed) throw new Error(usage);
  const flags = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.startsWith('--') && args[i].slice(2);
    if (!key || !allowed.includes(key) || !args[i + 1] || args[i + 1].startsWith('--') || flags[key] !== undefined) throw new Error(usage);
    flags[key] = args[i + 1];
  }
  const configDir = flags['config-dir'] || defaultConfigDir();
  if (command === 'grant' || command === 'revoke') {
    if (!flags.origin) throw new Error('--origin is required');
    if (command === 'grant') console.log(`Token for ${flags.origin} (shown once):\n${await grant(flags.origin, configDir)}`);
    else if (await revoke(flags.origin, configDir)) console.log(`Revoked ${flags.origin}`);
    else throw new Error(`No grant found for ${flags.origin}. Origins must match exactly.`);
    return;
  }
  const options = { configDir, ollamaURL: flags['ollama-url'], lmstudioURL: flags['lmstudio-url'] };
  if (command === 'doctor') {
    const result = await listModels(providerConfig(options), AbortSignal.timeout(3000));
    for (const p of result.providers) console.log(`${p.id}: ${p.available ? 'available' : p.reason}`);
    for (const m of result.models) console.log(`  ${m.id}`);
    return;
  }
  const port = flags.port === undefined ? 3210 : Number(flags.port);
  if (!Number.isInteger(port) || port < 0 || port > 65535 || (flags.port !== undefined && !/^\d+$/.test(flags.port))) throw new Error('Invalid port');
  const server = createServer(options);
  server.on('error', e => { console.error(`Server failed: ${e.message}`); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`Ownference listening at http://127.0.0.1:${server.address().port}`));
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
