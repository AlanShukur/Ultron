import { ChatError } from './chat.js';

export function describeRequestError(error) {
  if (error instanceof ChatError) return error.message;
  if (error.code === 'OLLAMA_UNAVAILABLE') {
    return 'My local AI is offline. The bot owner needs to start Ollama on the computer running me.';
  }
  if (error.code === 'OLLAMA_MODEL_MISSING') {
    return 'My local model is not downloaded yet. The bot owner needs to run ollama pull with the model named in OLLAMA_MODEL.';
  }
  if (error.code === 'OLLAMA_TIMEOUT') {
    return 'My local AI took too long to respond. Try again shortly; the first reply can take longer while the model loads.';
  }
  if (error.code === 'OLLAMA_GENERATION_FAILED') {
    return 'My local AI could not generate a reply. The bot owner should check Ollama and available graphics memory.';
  }
  if (error.code === 'credit_balance_exhausted') {
    return 'My AI service has run out of API credits. The bot owner needs to add credits in OpenAI API billing before I can respond.';
  }
  if (['organization_spend_limit_exceeded', 'project_spend_limit_exceeded', 'organization_usage_limit_exceeded'].includes(error.code)) {
    return 'My AI service has reached an API usage or spending limit. The bot owner needs to check the OpenAI project and organization limits.';
  }
  if (error.code === 'insufficient_quota' || error.type === 'insufficient_quota') {
    return 'My AI service has no available API quota. The bot owner needs to check OpenAI API billing, credits, and usage limits.';
  }
  if (error.status === 429) {
    return 'My AI service is receiving too many requests. Wait a little, then try again.';
  }
  if (error.code === 'invalid_api_key') {
    return 'My AI service rejected its API key. The bot owner needs to update OPENAI_API_KEY in .env and restart me.';
  }
  if (error.code === 'model_not_found') {
    return 'My configured AI model is unavailable. The bot owner needs to check OPENAI_MODEL and model access.';
  }
  // Never include raw provider errors, which can contain credentials or prompts.
  return 'My connection faltered. Try again shortly. If this continues, ask the bot owner to check API access, billing, and channel permissions.';
}
