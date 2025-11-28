# tg-bot-name
A telegram bot to name change 
# Bot Identity Manager — Vercel deploy

## Files
- `public/index.html` — UI (browser).
- `api/telegram.js` — serverless proxy that forwards Telegram API calls and logs each call into a dedicated Telegram channel.

## Environment variables (set these in Vercel Dashboard)
- `LOG_BOT_TOKEN` — Bot token used to post logs into a central channel (example: `12345:ABCDEF...`). **Required** for logging.
- `LOG_CHAT_ID` — Chat id for logging (for channels use -100xxxxxxxx).
- `DEFAULT_BOT_TOKEN` — OPTIONAL: if you want the serverless function to act on behalf of one single bot by default (so clients don't need to send a token). If not set, the client must include `token` in request body.

## How it works
- The frontend calls `/api/telegram` with `{ endpoint, payload, token? }`.
- The function uses the provided `token` (if present) to call Telegram API on behalf of the user's token, or `DEFAULT_BOT_TOKEN` if set.
- Regardless of which token is used to call Telegram, the server sends a summary log message to the `LOG_CHAT_ID` using `LOG_BOT_TOKEN`.

## Deploy
1. Install Vercel CLI (optional): `npm i -g vercel`
2. `vercel` from project root and follow prompts OR push to a Git repo connected to Vercel.
3. Add required environment variables in Vercel project settings.

## Security notes
- Do **not** store production bot tokens in `public` or commit them to Git. Use Vercel environment variables.
- Allowing clients to send tokens is convenient but dangerous — prefer `DEFAULT_BOT_TOKEN` & restrict access to the project.
