export function loadConfig(env = process.env, { registration = false } = {}) {
  const provider = env.AI_PROVIDER?.trim().toLowerCase() || 'ollama';
  if (!registration && !['ollama', 'openai'].includes(provider)) {
    throw new Error('AI_PROVIDER must be ollama or openai.');
  }
  const required = registration
    ? ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'DISCORD_GUILD_ID']
    : provider === 'openai' ? ['DISCORD_TOKEN', 'OPENAI_API_KEY'] : ['DISCORD_TOKEN'];
  for (const name of required) {
    if (!env[name]?.trim() || env[name].startsWith('replace_with_')) {
      throw new Error(`Set ${name} in your .env file first (see .env.example).`);
    }
  }
  if (registration) {
    for (const name of ['DISCORD_CLIENT_ID', 'DISCORD_GUILD_ID']) {
      if (!/^\d{17,20}$/.test(env[name].trim())) {
        throw new Error(`${name} must be a Discord numeric ID.`);
      }
    }
  }
  const ollamaBaseUrl = env.OLLAMA_BASE_URL?.trim() || 'http://127.0.0.1:11434';
  if (!registration && provider === 'ollama') {
    let url;
    try { url = new URL(ollamaBaseUrl); } catch { /* handled below */ }
    if (!url || !['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
        url.search || url.hash || url.pathname !== '/' ||
        !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
      throw new Error('OLLAMA_BASE_URL must point to your local Ollama server, for example http://127.0.0.1:11434.');
    }
  }
  const model = provider === 'ollama'
    ? env.OLLAMA_MODEL?.trim() || 'dolphin-mistral:7b'
    : env.OPENAI_MODEL?.trim() || 'gpt-4.1-mini';
  if (!registration && provider === 'ollama' && /cloud/i.test(model)) {
    throw new Error('Choose a downloaded local OLLAMA_MODEL, such as dolphin-mistral:7b, instead of a cloud model.');
  }
  return {
    provider,
    ollamaBaseUrl,
    token: env.DISCORD_TOKEN.trim(),
    clientId: env.DISCORD_CLIENT_ID?.trim(),
    guildId: env.DISCORD_GUILD_ID?.trim(),
    apiKey: env.OPENAI_API_KEY?.trim(),
    model,
  };
}
