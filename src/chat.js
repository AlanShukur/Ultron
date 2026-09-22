import { personality } from './personality.js';

export class ChatError extends Error {}

export function conversationKey(interaction) {
  return [interaction.guildId ?? 'dm', interaction.channelId, interaction.user.id].join(':');
}

export class ChatService {
  constructor(ai, model, { now = Date.now, cooldownMs = 5000,
    ttlMs = 30 * 60 * 1000, maxSessions = 1000, maxConcurrent = 5 } = {}) {
    this.ai = ai;
    this.model = model;
    this.now = now;
    this.cooldownMs = cooldownMs;
    this.ttlMs = ttlMs;
    this.maxSessions = maxSessions;
    this.maxConcurrent = maxConcurrent;
    this.sessions = new Map();
    this.active = new Set();
    this.cooldowns = new Map();
  }

  prune() {
    const now = this.now();
    for (const [key, session] of this.sessions) {
      if (now - session.updated >= this.ttlMs) this.sessions.delete(key);
    }
    for (const [user, expires] of this.cooldowns) {
      if (expires <= now) this.cooldowns.delete(user);
    }
  }

  reset(key) {
    if (this.active.has(key)) throw new ChatError('Wait for my current reply, then reset.');
    this.sessions.delete(key);
  }

  async ask(key, userId, prompt) {
    prompt = prompt.trim();
    if (!prompt || prompt.length > 2000) {
      throw new ChatError('Give me a message between 1 and 2,000 characters.');
    }
    this.prune();
    if (this.active.has(key)) throw new ChatError('I am still processing your last message.');
    if (this.cooldowns.has(userId)) throw new ChatError('One thing at a time. Give me a few seconds.');
    if (this.active.size >= this.maxConcurrent) throw new ChatError('Too many conversations at once. Try again in a moment.');

    this.active.add(key);
    this.cooldowns.set(userId, this.now() + this.cooldownMs);
    try {
      const input = [...(this.sessions.get(key)?.messages ?? []), { role: 'user', content: prompt }];
      const response = await this.ai.responses.create({
        model: this.model,
        instructions: personality,
        input,
        max_output_tokens: 700,
        store: false,
      });
      const output = response.output_text?.trim();
      if (!output) throw new ChatError('No response reached my systems. Try again.');
      // Bound stored/output text as well as the number of conversation turns.
      const answer = output.length > 6000 ? output.slice(0, 5900) + '\n[Reply shortened.]' : output;
      const messages = [...input, { role: 'assistant', content: answer }].slice(-12);
      this.sessions.delete(key);
      this.sessions.set(key, { messages, updated: this.now() });
      while (this.sessions.size > this.maxSessions) {
        this.sessions.delete(this.sessions.keys().next().value);
      }
      return answer;
    } finally {
      this.active.delete(key);
    }
  }
}

// Count UTF-16 units conservatively while preserving emoji surrogate pairs.
export function splitMessage(text, limit = 1900) {
  const chunks = [];
  let chunk = '';
  for (const character of text) {
    if (chunk.length + character.length > limit) {
      chunks.push(chunk);
      chunk = '';
    }
    chunk += character;
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}
