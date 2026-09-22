import test from 'node:test';
import assert from 'node:assert/strict';
import { ChatService, ChatError, splitMessage, conversationKey } from '../src/chat.js';
import { loadConfig } from '../src/config.js';
import { createHandler } from '../src/interactions.js';
import { command } from '../src/commands.js';

function fixture(options = {}) {
  const calls = [];
  const ai = { responses: { create: async request => {
    calls.push(request);
    return { output_text: 'I am ULTRON.' };
  } } };
  return { calls, ai, chat: new ChatService(ai, 'test-model', { cooldownMs: 0, ...options }) };
}

test('conversations isolate users and channels, remember turns, and reset', async () => {
  const { chat, calls } = fixture();
  await chat.ask('guild:channel:alice', 'alice', 'My name is Alice');
  await chat.ask('guild:channel:bob', 'bob', 'Hello');
  assert.equal(calls[1].input.length, 1);
  await chat.ask('guild:elsewhere:alice', 'alice', 'Hello elsewhere');
  assert.equal(calls[2].input.length, 1);
  await chat.ask('guild:channel:alice', 'alice', 'Remember me?');
  assert.deepEqual(calls[3].input.map(item => item.role), ['user', 'assistant', 'user']);
  assert.equal(calls[3].input[0].content, 'My name is Alice');
  assert.equal(calls[3].store, false);
  chat.reset('guild:channel:alice');
  await chat.ask('guild:channel:alice', 'alice', 'Fresh start');
  assert.equal(calls[4].input.length, 1);
});

test('failed and empty AI responses never enter memory and release the active slot', async () => {
  const { chat, ai, calls } = fixture();
  await chat.ask('a', 'a', 'Remember this');
  const original = ai.responses.create;
  ai.responses.create = async () => { throw new Error('offline'); };
  await assert.rejects(chat.ask('a', 'a', 'Failed prompt'), /offline/);
  assert.equal(chat.active.size, 0);
  ai.responses.create = async () => ({ output_text: ' ' });
  await assert.rejects(chat.ask('a', 'a', 'Empty prompt'), ChatError);
  ai.responses.create = original;
  await chat.ask('a', 'a', 'Continue');
  assert.deepEqual(calls.at(-1).input.map(item => item.content),
    ['Remember this', 'I am ULTRON.', 'Continue']);
});

test('in-flight requests cannot be reset or raced; global concurrency is bounded', async () => {
  let resolve;
  const { chat, ai } = fixture({ maxConcurrent: 1 });
  ai.responses.create = () => new Promise(done => { resolve = done; });
  const pending = chat.ask('a', 'a', 'Hello');
  assert.throws(() => chat.reset('a'), /current reply/);
  await assert.rejects(chat.ask('a', 'a', 'Again'), /still processing/);
  await assert.rejects(chat.ask('b', 'b', 'Hello'), /Too many conversations/);
  resolve({ output_text: 'Done' });
  assert.equal(await pending, 'Done');
  assert.equal(chat.active.size, 0);
});

test('cooldown applies across channels, expires, and rejects whitespace before charging', async () => {
  let time = 0;
  const { chat, calls } = fixture({ now: () => time, cooldownMs: 5000 });
  await assert.rejects(chat.ask('a', 'user', '   '), /between/);
  await chat.ask('a', 'user', 'Hello');
  await assert.rejects(chat.ask('b', 'user', 'Hello'), /Give me a few seconds/);
  assert.equal(calls.length, 1);
  time = 5000;
  await chat.ask('b', 'user', 'Hello');
  assert.equal(calls.length, 2);
});

test('history length, idle expiration, and session capacity are bounded', async () => {
  let time = 0;
  const { chat, calls } = fixture({ now: () => time, ttlMs: 100, maxSessions: 2 });
  for (let i = 0; i < 10; i++) await chat.ask('a', 'a', String(i));
  assert.equal(chat.sessions.get('a').messages.length, 12);
  assert.equal(chat.sessions.get('a').messages[0].content, '4');
  await chat.ask('b', 'b', 'Hello');
  await chat.ask('c', 'c', 'Hello');
  assert.equal(chat.sessions.size, 2);
  assert.equal(chat.sessions.has('a'), false);
  time = 100;
  await chat.ask('b', 'b', 'Expired?');
  assert.equal(calls.at(-1).input.length, 1);
});

test('Discord chunks preserve long text and emoji without exceeding size limits', () => {
  const text = 'x'.repeat(1899) + '🤖'.repeat(1500) + 'end';
  const chunks = splitMessage(text);
  assert.equal(chunks.join(''), text);
  assert.ok(chunks.every(chunk => chunk.length <= 1900 && chunk.isWellFormed()));
});

test('config rejects placeholders and malformed IDs without disclosing credentials', () => {
  assert.throws(() => loadConfig({ DISCORD_TOKEN: 'replace_with_token' }), /DISCORD_TOKEN/);
  assert.throws(() => loadConfig({ DISCORD_TOKEN: 'secret', AI_PROVIDER: 'openai' }), /OPENAI_API_KEY/);
  assert.throws(() => loadConfig({
    DISCORD_TOKEN: 'secret', DISCORD_CLIENT_ID: 'abc', DISCORD_GUILD_ID: '123456789012345678',
  }, { registration: true }), /numeric ID/);
  assert.equal(loadConfig({ DISCORD_TOKEN: 'secret', AI_PROVIDER: 'openai', OPENAI_API_KEY: 'secret' }).model, 'gpt-4.1-mini');
});

function interaction(subcommand = 'chat') {
  const sent = [];
  return {
    sent, guildId: 'guild', channelId: 'channel', user: { id: 'user' },
    commandName: 'ultron', deferred: false, replied: false,
    isChatInputCommand: () => true,
    options: { getSubcommand: () => subcommand, getString: () => 'Hello' },
    async deferReply() { this.deferred = true; sent.push(['defer']); },
    async reply(payload) { this.replied = true; sent.push(['reply', payload]); },
    async editReply(payload) { sent.push(['edit', payload]); },
    async followUp(payload) { sent.push(['followUp', payload]); },
  };
}

test('chat acknowledges before AI work and suppresses all generated mentions', async () => {
  const event = interaction();
  const answer = '@everyone ' + 'x'.repeat(4000);
  const chat = { ask: async (key, user, prompt) => {
    assert.equal(event.deferred, true);
    assert.equal(key, conversationKey(event));
    assert.equal(user, 'user');
    assert.equal(prompt, 'Hello');
    return answer;
  } };
  await createHandler(chat)(event);
  assert.deepEqual(event.sent.map(item => item[0]), ['defer', 'edit', 'followUp', 'followUp']);
  assert.equal(event.sent.slice(1).map(item => item[1].content).join(''), answer);
  for (const [, payload] of event.sent.slice(1)) assert.deepEqual(payload.allowedMentions.parse, []);
});

test('recoverable errors reach the deferred interaction and reset/help are private', async () => {
  const event = interaction();
  await createHandler({ ask: async () => { throw new ChatError('Try again'); } })(event);
  assert.equal(event.sent.at(-1)[1].content, 'Try again');
  const reset = interaction('reset');
  let resetKey;
  await createHandler({ reset: key => { resetKey = key; } })(reset);
  assert.equal(resetKey, conversationKey(reset));
  assert.equal(reset.sent[0][1].flags, 64);
  const help = interaction('help');
  await createHandler({})(help);
  assert.equal(help.sent[0][1].flags, 64);
});

test('slash command schema includes all three subcommands and required bounded input', () => {
  const json = command.toJSON();
  assert.deepEqual(json.options.map(option => option.name), ['chat', 'reset', 'help']);
  assert.equal(json.options[0].options[0].required, true);
  assert.equal(json.options[0].options[0].max_length, 2000);
});
