import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { grant } from '../src/config.js';
import { createServer } from '../src/server.js';

const dir = await mkdtemp(join(tmpdir(), 'ownmode-smoke-'));
const server = createServer({ configDir: dir });
try {
  const token = await grant('http://localhost:4173', dir);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const url = `http://127.0.0.1:${server.address().port}`;
  const headers = { authorization: `Bearer ${token}`, origin: 'http://localhost:4173', 'content-type': 'application/json' };
  const model = `ollama:${process.env.OLLAMA_MODEL || 'llama3.2:latest'}`;
  const modelsResponse = await fetch(`${url}/v1/models`, { headers });
  const { models } = await modelsResponse.json();
  if (!modelsResponse.ok || !models?.some(item => item.id === model)) throw new Error(`Model ${model} unavailable; start Ollama and pull it first`);
  const response = await fetch(`${url}/v1/generate`, { method: 'POST', headers, body: JSON.stringify({ model, task: 'summarize', text: 'A red kite flew above the quiet park.' }), signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`Generation failed: HTTP ${response.status}`);
  const events = (await response.text()).trim().split('\n').map(JSON.parse);
  if (events.at(-1)?.type !== 'done' || !events.some(event => event.type === 'delta' && event.text.trim())) throw new Error('Generation did not complete with text');
  console.log(`Ollama live smoke passed: ${model}`);
} finally {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  await rm(dir, { recursive: true, force: true });
}
