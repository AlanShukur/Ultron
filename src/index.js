import { Client, Events, GatewayIntentBits, ActivityType } from 'discord.js';
import { createAIClient } from './ai-client.js';
import { loadConfig } from './config.js';
import { ChatService } from './chat.js';
import { createHandler } from './interactions.js';
import { createMessageHandler } from './messages.js';
import { describeDiscordError } from './discord-errors.js';

let config;
try {
  config = loadConfig();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const ai = createAIClient(config);
const chat = new ChatService(ai, config.model, { maxConcurrent: config.provider === 'ollama' ? 1 : 5 });
console.log(`AI backend: ${config.provider}; model: ${config.model}`);
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  allowedMentions: { parse: [], repliedUser: false },
});
const cleanup = setInterval(() => chat.prune(), 60_000);
cleanup.unref();

client.once(Events.ClientReady, ready => {
  console.log(`ULTRON online as ${ready.user.tag}. Say "ultron" in a server channel to chat.`);
  if (config.guildId && !ready.guilds.cache.has(config.guildId)) {
    console.warn('DISCORD_GUILD_ID does not match a connected server. Check it before registering slash commands.');
  }
  ready.user.setActivity('the situation deteriorate | say ultron', { type: ActivityType.Watching });
});
client.on(Events.InteractionCreate, createHandler(chat, { provider: config.provider }));
client.on(Events.MessageCreate, createMessageHandler(chat));
client.on(Events.Error, error => console.error(describeDiscordError(error, [config.token, config.apiKey])));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    clearInterval(cleanup);
    client.destroy();
    process.exit(0);
  });
}
try {
  await client.login(config.token);
} catch (error) {
  console.error(describeDiscordError(error, [config.token, config.apiKey]));
  clearInterval(cleanup);
  client.destroy();
  process.exitCode = 1;
}
