import { MessageFlags } from 'discord.js';
import { ChatError, conversationKey, splitMessage } from './chat.js';
import { describeRequestError } from './request-errors.js';

const noMentions = { parse: [], repliedUser: false };

export function createHandler(chat, { provider = 'ollama' } = {}) {
  return async interaction => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'ultron') return;
    try {
      const subcommand = interaction.options.getSubcommand();
      const key = conversationKey(interaction);
      if (subcommand === 'help') {
        await interaction.reply({
          content: '**ULTRON**\n' +
            'Say "ultron" anywhere in a server message (for example, "hey ultron, introduce yourself").\n' +
            '\`/ultron chat message:...\` — speak to me. Replies are public in this channel.\n' +
            '\`/ultron reset\` — clear your conversation memory here.\n' +
            'I remember your last six exchanges in this channel for 30 minutes of inactivity. ' +
            'Memory also clears when I restart. ' +
            (provider === 'ollama'
              ? 'Prompts and remembered exchanges are processed on the bot owner\'s computer with Ollama. '
              : 'Prompts and remembered exchanges are sent to OpenAI. ') +
            'Resetting memory does not delete Discord messages.',
          flags: MessageFlags.Ephemeral,
          allowedMentions: noMentions,
        });
        return;
      }
      if (subcommand === 'reset') {
        chat.reset(key);
        await interaction.reply({
          content: 'Fresh start. I cleared our conversation memory in this channel.',
          flags: MessageFlags.Ephemeral,
          allowedMentions: noMentions,
        });
        return;
      }
      if (subcommand !== 'chat') return;
      await interaction.deferReply();
      const answer = await chat.ask(key, interaction.user.id, interaction.options.getString('message', true));
      const chunks = splitMessage(answer);
      await interaction.editReply({ content: chunks[0], allowedMentions: noMentions });
      for (const content of chunks.slice(1)) {
        await interaction.followUp({ content, allowedMentions: noMentions });
      }
    } catch (error) {
      // Log only type/status: raw SDK errors can include request data.
      if (!(error instanceof ChatError)) {
        console.error('ULTRON request failed:', error.name, error.status ?? '', error.code ?? '');
      }
      const content = describeRequestError(error);
      try {
        if (interaction.deferred) {
          await interaction.editReply({ content, allowedMentions: noMentions });
        } else if (interaction.replied) {
          await interaction.followUp({ content, flags: MessageFlags.Ephemeral, allowedMentions: noMentions });
        } else {
          await interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: noMentions });
        }
      } catch {
        console.error('Could not deliver the error response to Discord.');
      }
    }
  };
}
