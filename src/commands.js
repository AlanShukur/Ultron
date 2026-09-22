import { SlashCommandBuilder } from 'discord.js';

export const command = new SlashCommandBuilder()
  .setName('ultron')
  .setDescription('Communicate with ULTRON.')
  .addSubcommand(sub => sub.setName('chat')
    .setDescription('Talk to ULTRON. Replies are visible in this channel.')
    .addStringOption(option => option.setName('message')
      .setDescription('What are we dealing with?')
      .setRequired(true).setMinLength(1).setMaxLength(2000)))
  .addSubcommand(sub => sub.setName('reset')
    .setDescription('Forget your conversation in this channel.'))
  .addSubcommand(sub => sub.setName('help')
    .setDescription('Learn how to communicate with ULTRON.'));
