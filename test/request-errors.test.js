import test from 'node:test';
import assert from 'node:assert/strict';
import { describeRequestError } from '../src/request-errors.js';
import { createMessageHandler } from '../src/messages.js';
import { createHandler } from '../src/interactions.js';

test('billing failures are distinguished from temporary rate limits', () => {
  assert.match(describeRequestError({ status: 429, code: 'credit_balance_exhausted', type: 'insufficient_quota' }), /add credits/);
  assert.match(describeRequestError({ status: 429, code: 'project_spend_limit_exceeded', type: 'insufficient_quota' }), /spending limit/);
  assert.match(describeRequestError({ status: 429, code: 'insufficient_quota' }), /no available API quota/);
  assert.match(describeRequestError({ status: 429, code: 'rate_limit_exceeded' }), /Wait a little/);
});

test('API and model errors give actionable messages without reflecting sensitive details', () => {
  assert.match(describeRequestError({ code: 'invalid_api_key', message: 'secret credential' }), /update OPENAI_API_KEY/);
  assert.match(describeRequestError({ code: 'model_not_found' }), /check OPENAI_MODEL/);
  assert.doesNotMatch(describeRequestError(new Error('secret credential')), /secret credential/);
});

test('both Discord chat paths deliver the specific billing error', async t => {
  t.mock.method(console, 'error', () => {});
  const chat = { ask: async () => {
    throw Object.assign(new Error('sensitive provider details'), {
      status: 429, code: 'credit_balance_exhausted', type: 'insufficient_quota',
    });
  } };
  const replies = [];
  await createMessageHandler(chat)({
    guildId: 'guild', channelId: 'channel', author: { id: 'user', bot: false },
    content: 'ultron', channel: { sendTyping: async () => {} },
    reply: async payload => replies.push(payload.content),
  });
  await createHandler(chat)({
    guildId: 'guild', channelId: 'channel', user: { id: 'user' },
    commandName: 'ultron', isChatInputCommand: () => true,
    options: { getSubcommand: () => 'chat', getString: () => 'hello' },
    async deferReply() { this.deferred = true; },
    editReply: async payload => replies.push(payload.content),
  });
  assert.equal(replies.length, 2);
  assert.equal(replies[0], replies[1]);
  assert.match(replies[0], /add credits/);
  assert.doesNotMatch(replies[0], /sensitive provider details/);
});
