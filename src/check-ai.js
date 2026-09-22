import { loadConfig } from './config.js';
import { createAIClient } from './ai-client.js';
import { ChatService } from './chat.js';
import { describeRequestError } from './request-errors.js';

try {
  const config = loadConfig();
  console.log(`Testing ${config.provider} / ${config.model} without connecting to Discord...`);
  const chat = new ChatService(createAIClient(config), config.model);
  const reply = await chat.ask('local-test', 'local-test', 'ultron, introduce yourself in one short sentence.');
  console.log(reply);
} catch (error) {
  console.error(describeRequestError(error));
  process.exitCode = 1;
}
