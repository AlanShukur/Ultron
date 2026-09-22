import OpenAI from 'openai';

function localError(code) {
  return Object.assign(new Error(code), { name: 'OllamaError', code });
}

export function createAIClient(config, { fetchImpl = fetch } = {}) {
  if (config.provider === 'openai') {
    return new OpenAI({ apiKey: config.apiKey, timeout: 45_000, maxRetries: 1 });
  }

  // Adapt Ollama's local chat endpoint to the interface used by ChatService.
  // No API key, cloud fallback, or chat content is sent to OpenAI in this mode.
  return {
    responses: {
      async create({ model, instructions, input, max_output_tokens }) {
        try {
          const response = await fetchImpl(new URL('/api/chat', config.ollamaBaseUrl), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            redirect: 'error',
            signal: AbortSignal.timeout(120_000),
            body: JSON.stringify({
              model,
              messages: [{ role: 'system', content: instructions }, ...input],
              stream: false,
              keep_alive: '10m',
              options: { num_ctx: 8192, num_predict: max_output_tokens },
            }),
          });
          if (!response.ok) {
            throw localError(response.status === 404 ? 'OLLAMA_MODEL_MISSING' : 'OLLAMA_GENERATION_FAILED');
          }
          const result = await response.json();
          if (result.error || typeof result.message?.content !== 'string') {
            throw localError('OLLAMA_GENERATION_FAILED');
          }
          return { output_text: result.message.content };
        } catch (error) {
          if (error.name === 'OllamaError') throw error;
          if (error.name === 'TimeoutError' || error.name === 'AbortError') {
            throw localError('OLLAMA_TIMEOUT');
          }
          throw localError('OLLAMA_UNAVAILABLE');
        }
      },
    },
  };
}
