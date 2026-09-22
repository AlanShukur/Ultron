import test from 'node:test';
import assert from 'node:assert/strict';
import { ChatService, ChatError } from '../src/chat.js';
import { createMessageHandler } from '../src/messages.js';

function message(content = 'hey ultron, hello', overrides = {}) {
  const sent = [];
  return {
    content, guildId: 'guild', channelId: 'channel', author: { id: 'user', bot: false },
    webhookId: null, sent,
    channel: {
      async sendTyping() { sent.push(['typing']); },
      async send(payload) { sent.push(['send', payload]); },
    },
    async reply(payload) { sent.push(['reply', payload]); },
    ...overrides,
  };
}

test('ULTRON triggers alone or anywhere in a message regardless of case', async () => {
  for (const content of ['ultron', 'ULTRON!', 'hey Ultron, hello', 'are you there, ultron?']) {
    const event = message(content);
    const calls = [];
    await createMessageHandler({ ask: async (...args) => { calls.push(args); return 'Online.'; } })(event);
    assert.deepEqual(calls, [['guild:channel:user', 'user', content]]);
    assert.equal(event.sent.at(-1)[1].content, 'Online.');
    assert.deepEqual(event.sent.at(-1)[1].allowedMentions, { parse: [], repliedUser: false });
  }
});

test('unrelated messages, partial words, bots, webhooks, and DMs never call AI', async () => {
  const handler = createMessageHandler({ ask: async () => assert.fail('Must not call AI') });
  for (const event of [
    message('hello'), message('ultronic'), message('myultron'), message(''),
    message('ultron', { author: { id: 'bot', bot: true } }),
    message('ultron', { webhookId: 'webhook' }), message('ultron', { guildId: null }),
  ]) {
    await handler(event);
    assert.deepEqual(event.sent, []);
  }
});

test('name-triggered chat shares slash-command memory and reset', async () => {
  const calls = [];
  const chat = new ChatService({ responses: { create: async request => {
    calls.push(request);
    return { output_text: 'Online.' };
  } } }, 'test-model', { cooldownMs: 0 });
  await chat.ask('guild:channel:user', 'user', 'Remember this slash prompt');
  await createMessageHandler(chat)(message());
  assert.equal(calls[1].input[0].content, 'Remember this slash prompt');
  chat.reset('guild:channel:user');
  await createMessageHandler(chat)(message());
  assert.equal(calls[2].input.length, 1);
});

test('long replies are split and all chunks suppress mentions', async () => {
  const event = message();
  const answer = '@everyone ' + 'x'.repeat(4000);
  await createMessageHandler({ ask: async () => answer })(event);
  const delivered = event.sent.filter(([type]) => type !== 'typing');
  assert.deepEqual(delivered.map(([type]) => type), ['reply', 'send', 'send']);
  assert.equal(delivered.map(([, payload]) => payload.content).join(''), answer);
  for (const [, payload] of delivered) {
    assert.ok(payload.content.length <= 1900);
    assert.deepEqual(payload.allowedMentions.parse, []);
  }
});

test('typing failure does not prevent a reply and cooldown errors are delivered', async () => {
  const event = message();
  event.channel.sendTyping = async () => { throw new Error('Typing unavailable'); };
  await createMessageHandler({ ask: async () => 'Online.' })(event);
  assert.equal(event.sent.at(-1)[1].content, 'Online.');
  await createMessageHandler({ ask: async () => { throw new ChatError('Wait a few seconds.'); } })(event);
  assert.equal(event.sent.at(-1)[1].content, 'Wait a few seconds.');
});

test('API and Discord send failures are handled without leaking errors into chat', async t => {
  t.mock.method(console, 'error', () => {});
  const event = message();
  await createMessageHandler({ ask: async () => { throw new Error('private provider details'); } })(event);
  assert.match(event.sent.at(-1)[1].content, /connection faltered/);
  assert.doesNotMatch(event.sent.at(-1)[1].content, /private provider details/);
  event.reply = async () => { throw new Error('Missing permissions'); };
  await assert.doesNotReject(createMessageHandler({ ask: async () => 'Online.' })(event));
});
