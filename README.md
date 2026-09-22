# ULTRON

An ULTRON-inspired Discord AI companion: blunt replies, dark humor, occasional swearing, and fictional contempt for humanity's bad decisions. Runs **Dolphin Mistral 7B locally through Ollama** by default, with no OpenAI API credits required. Built with Node.js and discord.js.

## Commands

- Say **ultron** anywhere in a server message, for example `hey ultron, introduce yourself` or simply `ultron`. Matching ignores capitalization and treats ULTRON as a whole word. Replies are public in the same channel. Messages from bots and webhooks are ignored.
- `/ultron chat message:Hello` — talk to ULTRON; replies are visible in the channel.
- `/ultron reset` — forget your conversation in this channel.
- `/ultron help` — show usage and memory details.

ULTRON remembers up to six exchanges per person per channel, shared between name-triggered messages and slash commands. Memory expires after 30 minutes of inactivity, clears on restart, and is capped at 1,000 conversations. Messages containing the word "ultron", slash-command prompts, and your remembered exchanges are processed on your computer by Ollama. Unrelated messages and other people's conversations are not included in your context. Reset clears the bot's local context, not messages already posted on Discord. Discord still receives the messages you post there. Local mode never falls back to a paid cloud provider.

## Setup on Windows

Use Node.js 22.12 or newer.

1. Open the [Discord Developer Portal](https://discord.com/developers/applications), create an application, and name it **ULTRON**.
2. On **Bot**, obtain the bot token. Under **Privileged Gateway Intents**, enable **Message Content Intent** and save. This is required to detect "ultron" in ordinary messages. On **General Information**, copy the Application ID.
3. On **Installation**, enable **Guild Install**, select the `bot` and `applications.commands` scopes, and grant **View Channels**, **Send Messages**, and **Read Message History** (for replies). For threads, also grant **Send Messages in Threads**. Use the install link to add ULTRON to your server. Administrator permission is not needed.
4. In Discord, enable **User Settings → Advanced → Developer Mode**. Right-click your server and select **Copy Server ID**.
5. Install and open [Ollama for Windows](https://ollama.com/download/windows). Download the model (about 4.1 GB):

   ```powershell
   ollama pull dolphin-mistral:7b
   ```
6. Open PowerShell in this project and run:

   ```powershell
   npm.cmd install
   if (-not (Test-Path .env)) { Copy-Item .env.example .env }
   notepad .env
   ```

7. Fill in your Discord bot token and IDs in `.env`. Keep the token private. Use these local AI settings; no OpenAI API key is needed:

   ```env
   AI_PROVIDER=ollama
   OLLAMA_BASE_URL=http://127.0.0.1:11434
   OLLAMA_MODEL=dolphin-mistral:7b
   ```

   `OLLAMA_BASE_URL` must be a loopback address. Keep Ollama running in the background. First try `npm.cmd run ai:check` to generate a local test reply without connecting to Discord.
8. Start the bot (registration is only needed if you also want slash commands):

   ```powershell
   npm.cmd start
   ```

9. In your server, send `hey ultron, introduce yourself`. To enable slash commands too, run `npm.cmd run register` in another terminal.

Run registration again after command changes or when changing the configured server. Registration updates only the app's `/ultron` command for that server. The bot stays online while this process runs; stop with Ctrl+C. Continuous availability requires a computer or host running the process continuously.

## Customize

Edit `src/personality.js` to change ULTRON's voice, then restart the bot. The bot has no browsing, moderation, or system-control tools.

Each user has a five-second cooldown across channels and both ways of chatting. Local mode generates one reply at a time to fit the laptop GPU; other requests get a busy message. Prompts are limited to 2,000 characters and generation to 700 output tokens. Ollama uses an 8,192-token context and keeps the model loaded for ten minutes after a request. Long histories may exceed the model's context and be truncated. The first reply may take longer while the model loads. Your computer and Ollama must stay running for ULTRON to answer.

Restrict channel access using the bot's role permissions if needed; integration command restrictions apply only to slash commands.

## Optional OpenAI backend

To switch back, set `AI_PROVIDER=openai`, `OPENAI_API_KEY`, and `OPENAI_MODEL` (default `gpt-4.1-mini`) in `.env`, then restart. This mode sends prompts and remembered exchanges to OpenAI, uses `store: false`, allows five simultaneous requests, and requires API billing. Any old OpenAI key retained in `.env` is unused in Ollama mode.

## Verification

```powershell
npm.cmd test
npm.cmd run check
```

Tests use fake AI clients and Discord interactions. They do not connect to a server. `npm.cmd run ai:check` makes a real request to the configured AI backend; with Ollama it stays local, while OpenAI mode uses API credits.

## Troubleshooting

- **Missing configuration:** Copy `.env.example` to `.env` and replace every placeholder.
- **No slash commands:** Check the application and server IDs, install the app to that server, and run registration again. Reopen Discord if its command menu is stale.
- **Saying "ultron" does nothing / disallowed intents:** Enable **Bot → Privileged Gateway Intents → Message Content Intent** in the Developer Portal, save, and restart the bot. Send a new message in a server channel that the bot can view and reply in. Message edits and DMs do not trigger this feature.
- **Local AI offline:** Open Ollama from the Start menu, then retry. You can also run `ollama serve` in another terminal if it is not already running.
- **Model not downloaded:** Run `ollama pull dolphin-mistral:7b`; `ollama list` should then include that exact name.
- **Slow or failed local replies:** Close GPU-heavy apps, check Ollama is running, and try `npm.cmd run ai:check`. Local requests time out after two minutes.
- **No answer:** Keep the bot process running and check its terminal. Confirm Ollama and channel permissions. For OpenAI mode, also check API access and billing.
- **401 / 429 errors:** Check credentials or API quota/rate limits respectively. Logs omit prompts and tokens.
- **Out of API credits:** `credit_balance_exhausted` means the OpenAI API account has no prepaid credits remaining. Add credits in [API billing](https://platform.openai.com/settings/organization/billing/overview), then try again. Repeated requests cannot fix an exhausted balance. Other quota errors may require checking project or organization limits. See [OpenAI error codes](https://developers.openai.com/api/docs/guides/error-codes).
- **PowerShell blocks npm.ps1:** Use `npm.cmd` as shown above.

Implementation references: [Dolphin Mistral 7B](https://ollama.com/library/dolphin-mistral:7b), [Ollama chat API](https://docs.ollama.com/api/chat), [Ollama on Windows](https://docs.ollama.com/windows), [Discord setup](https://docs.discord.com/developers/quick-start/getting-started), and [discord.js](https://discord.js.org/docs/packages/discord.js/14.27.0).
