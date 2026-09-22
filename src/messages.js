import { ChatError, conversationKey, splitMessage } from './chat.js';
import { describeRequestError } from './request-errors.js';

const noMentions = { parse: [], repliedUser: false };

export function createMessageHandler(chat) {
  return async message => {
    if (!message.guildId || message.author.bot || message.webhookId) return;
    if (!/\bultron\b/i.test(message.content)) return;

    try {
      // A failed typing indicator should not prevent the actual response.
      await message.channel.sendTyping().catch(() => {});
      const key = conversationKey({
        guildId: message.guildId,
        channelId: message.channelId,
        user: message.author,
      });
      const answer = await chat.ask(key, message.author.id, message.content);
      const chunks = splitMessage(answer);
      await message.reply({
        content: chunks[0], allowedMentions: noMentions, failIfNotExists: false,
      });
      for (const content of chunks.slice(1)) {
        await message.channel.send({ content, allowedMentions: noMentions });
      }
    } catch (error) {
      if (!(error instanceof ChatError)) {
        console.error('ULTRON message failed:', error.name, error.status ?? '', error.code ?? '');
      }
      const content = describeRequestError(error);
      try {
        await message.reply({ content, allowedMentions: noMentions, failIfNotExists: false });
      } catch {
        console.error('Could not deliver the error response to Discord. Check channel permissions.');
      }
    }
  };
}
