import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';
import { createAIClient } from '../src/ai-client.js';
import { ChatService } from '../src/chat.js';
import { describeRequestError } from '../src/request-errors.js';

const localConfig = () => loadConfig({ DISCORD_TOKEN: 'test-token', OPENAI_API_KEY: 'must-not-be-sent' });
const request = { model: 'dolphin-mistral:7b', instructions: 'You are ULTRON.',
  input: [{ role: 'user', content: 'Hello' }], max_output_tokens: 700, store: false };

test('local default does not require an API key or use the old OpenAI model', () => {
  const config = loadConfig({ DISCORD_TOKEN: 'test-token', OPENAI_MODEL: 'old-cloud-model' });
  assert.equal(config.provider, 'ollama');
  assert.equal(config.model, 'dolphin-mistral:7b');
  assert.equal(config.ollamaBaseUrl, 'http://127.0.0.1:11434');
  assert.throws(() => loadConfig({ DISCORD_TOKEN: 'test', AI_PROVIDER: 'typo' }), /AI_PROVIDER/);
});

test('local configuration rejects remote servers, embedded credentials, and cloud models', () => {
  for (const url of ['https://ollama.com', 'http://example.com', 'http://user:secret@localhost:11434',
    'http://localhost:11434/path', 'http://localhost:11434?token=secret', 'not a URL']) {
    assert.throws(() => loadConfig({ DISCORD_TOKEN: 'test', OLLAMA_BASE_URL: url }), /OLLAMA_BASE_URL/);
  }
  assert.throws(() => loadConfig({ DISCORD_TOKEN: 'test', OLLAMA_MODEL: 'model:cloud' }), /downloaded local/);
});

test('Ollama receives personality and conversation with bounded generation, without credentials', async () => {
  let sent;
  const ai = createAIClient(localConfig(), { fetchImpl: async (url, options) => {
    sent = { url: url.href, ...options };
    return { ok: true, json: async () => ({ message: { content: 'Online.' } }) };
  } });
  assert.deepEqual(await ai.responses.create(request), { output_text: 'Online.' });
  assert.equal(sent.url, 'http://127.0.0.1:11434/api/chat');
  const body = JSON.parse(sent.body);
  assert.deepEqual(body.messages, [{ role: 'system', content: request.instructions }, ...request.input]);
  assert.equal(body.model, 'dolphin-mistral:7b');
  assert.equal(body.stream, false);
  assert.deepEqual(body.options, { num_ctx: 8192, num_predict: 700 });
  assert.equal(sent.redirect, 'error');
  assert.deepEqual(sent.headers, { 'Content-Type': 'application/json' });
  assert.doesNotMatch(JSON.stringify(sent), /must-not-be-sent|test-token/);
});

test('Ollama distinguishes missing models, connection failures, and timeouts', async () => {
  const cases = [
    [async () => ({ ok: false, status: 404 }), 'OLLAMA_MODEL_MISSING', /not downloaded/],
    [async () => ({ ok: false, status: 500 }), 'OLLAMA_GENERATION_FAILED', /could not generate/],
    [async () => { throw new TypeError('private connection details'); }, 'OLLAMA_UNAVAILABLE', /start Ollama/],
    [async () => { throw Object.assign(new Error('timeout'), { name: 'TimeoutError' }); }, 'OLLAMA_TIMEOUT', /too long/],
    [async () => ({ ok: true, json: async () => ({ error: 'private provider details' }) }), 'OLLAMA_GENERATION_FAILED', /could not generate/],
  ];
  for (const [fetchImpl, code, message] of cases) {
    const ai = createAIClient(localConfig(), { fetchImpl });
    await assert.rejects(ai.responses.create(request), error => {
      assert.equal(error.code, code);
      assert.match(describeRequestError(error), message);
      assert.doesNotMatch(describeRequestError(error), /private|OpenAI|billing/);
      return true;
    });
  }
});

test('real ChatService interface preserves conversation through local adapter and resets', async () => {
  const calls = [];
  const ai = createAIClient(localConfig(), { fetchImpl: async (_, options) => {
    calls.push(JSON.parse(options.body));
    return { ok: true, json: async () => ({ message: { content: 'Got it.' } }) };
  } });
  const chat = new ChatService(ai, 'dolphin-mistral:7b', { cooldownMs: 0, maxConcurrent: 1 });
  await chat.ask('user:channel', 'user', 'Remember my name');
  await chat.ask('user:channel', 'user', 'What did I say?');
  assert.deepEqual(calls[1].messages.map(item => item.role), ['system', 'user', 'assistant', 'user']);
  assert.match(calls[1].messages[0].content, /ULTRON/);
  chat.reset('user:channel');
  await chat.ask('user:channel', 'user', 'Start over');
  assert.equal(calls[2].messages.length, 2);
});
