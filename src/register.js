import { REST, Routes } from 'discord.js';
import { loadConfig } from './config.js';
import { command } from './commands.js';

let config;
try {
  config = loadConfig(process.env, { registration: true });
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

try {
  const rest = new REST({ version: '10' }).setToken(config.token);
  // Upsert only /ultron, preserving other commands owned by this application.
  await rest.post(Routes.applicationGuildCommands(config.clientId, config.guildId), {
    body: command.toJSON(),
  });
  console.log('Registered /ultron for your server. Start the bot with npm start.');
} catch (error) {
  console.error('Registration failed. Check your token, application ID, server ID, and server installation.',
    error.name, error.status ?? error.code ?? '');
  process.exitCode = 1;
}
