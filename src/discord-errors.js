export function describeDiscordError(error, secrets = []) {
  // Include the actual cause, but never print configured credentials or headers.
  let detail = String(error.message ?? error.name ?? 'Unknown error');
  for (const secret of secrets) {
    if (secret) detail = detail.split(secret).join('[redacted]');
  }
  detail = detail.replace(/[\r\n]/g, ' ').slice(0, 500);

  if (error.code === 'DisallowedIntents' || /disallowed intents|privileged intent/i.test(detail)) {
    return 'Discord rejected Message Content Intent. Enable it in Developer Portal > Bot > Privileged Gateway Intents, save, then restart.';
  }
  if (error.code === 'TokenInvalid' || error.status === 401 || /authentication failed|invalid token/i.test(detail)) {
    return 'Discord rejected DISCORD_TOKEN. Copy the bot token from Developer Portal > Bot > Reset Token into .env, save, then restart.';
  }
  if (['EACCES', 'EPERM', 'ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT'].includes(error.cause?.code ?? error.code)) {
    return `Discord network connection failed (${error.cause?.code ?? error.code}). Check network access, firewall, or sandbox restrictions.`;
  }
  return `Discord connection failed: ${detail}`;
}
