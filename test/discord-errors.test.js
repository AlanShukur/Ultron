import test from 'node:test';
import assert from 'node:assert/strict';
import { describeDiscordError } from '../src/discord-errors.js';

test('intent and authentication failures give different actionable instructions', () => {
  assert.match(describeDiscordError(new Error('Used disallowed intents')), /Enable it in Developer Portal/);
  assert.match(describeDiscordError({ code: 'TokenInvalid' }), /Bot > Reset Token/);
  assert.doesNotMatch(describeDiscordError({ code: 'TokenInvalid' }), /Message Content/);
});

test('unknown errors retain the reason while redacting credentials and newlines', () => {
  const result = describeDiscordError(new Error('Failed with secret-token\nsecret-api-key'), ['secret-token', 'secret-api-key']);
  assert.match(result, /Failed with \[redacted\] \[redacted\]/);
  assert.doesNotMatch(result, /secret-token|secret-api-key|\n/);
});

test('nested network failures explain connection restrictions', () => {
  const error = new TypeError('fetch failed', { cause: { code: 'EACCES' } });
  assert.match(describeDiscordError(error), /network connection failed \(EACCES\)/);
});
