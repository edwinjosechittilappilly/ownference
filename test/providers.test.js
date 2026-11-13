import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { generate, providerConfig, listModels } from '../src/providers.js';

test('LM Studio streams split UTF-8 and stops at DONE', async t => {
  const provider = http.createServer((req, res) => {
    if (req.url === '/v1/models') return res.end(JSON.stringify({ data: [{ id: 'local-model' }] }));
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    const frame = Buffer.from('data: {"choices":[{"delta":{"content":"café"}}]}\n\ndata: [DONE]\n\n');
    const split = frame.indexOf(Buffer.from('é')) + 1;
    res.write(frame.subarray(0, split)); setTimeout(() => res.end(frame.subarray(split)), 5);
  });
  await new Promise(resolve => provider.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => provider.close(resolve)));
  const config = providerConfig({ ollamaURL: 'http://127.0.0.1:1', lmstudioURL: `http://127.0.0.1:${provider.address().port}/v1`, appleExecutable: '/nonexistent' });
  const found = await listModels(config, AbortSignal.timeout(2000));
  assert.deepEqual(found.models, [{ id: 'lmstudio:local-model', provider: 'lmstudio', name: 'local-model' }]);
  let output = '';
  for await (const part of generate(config, { model: 'lmstudio:local-model', task: 'draft', text: 'test' }, AbortSignal.timeout(2000))) output += part;
  assert.equal(output, 'café');
});
test('unterminated provider stream fails', async t => {
  const provider = http.createServer((req, res) => res.end('{"response":"partial"}\n'));
  await new Promise(resolve => provider.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => provider.close(resolve)));
  const config = providerConfig({ ollamaURL: `http://127.0.0.1:${provider.address().port}` });
  await assert.rejects(Array.fromAsync(generate(config, { model: 'ollama:test', task: 'draft', text: 'test' }, AbortSignal.timeout(2000))), /ended unexpectedly/);
});
