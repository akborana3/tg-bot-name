// api/telegram.js
// Vercel serverless function to proxy Telegram API calls and log each request to a channel.
//
// Security notes:
// - Provide LOG_BOT_TOKEN and LOG_CHAT_ID in Vercel env vars (these are used for logging).
// - If client supplies token in request body, this function will forward the request using that token.
//   This is allowed for compatibility but not recommended (exposes token to network).
//
// Request (POST JSON):
// {
//   "endpoint": "setMyName",
//   "payload": { "name": "New Bot Name" },
//   "token": "<OPTIONAL - bot token to use instead of server one>",
//   "logToChannel": true   // default true
// }
//
// Response:
// - returns the Telegram API JSON response for the forwarded call (status code 200).
//
// Note: Vercel node has built-in fetch.

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    // CORS preflight
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const serverLogBotToken = process.env.LOG_BOT_TOKEN || '';
  const serverLogChatId = process.env.LOG_CHAT_ID || '';

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { endpoint, payload = {}, token: providedToken, logToChannel = true } = body || {};

    if (!endpoint) {
      return res.status(400).json({ ok: false, description: 'Missing endpoint' });
    }

    // Use provided token if present, otherwise attempt to use server LOG_BOT_TOKEN (but server token is intended for logging)
    const useToken = providedToken && providedToken.length > 10 ? providedToken : (process.env.DEFAULT_BOT_TOKEN || '');

    if (!useToken) {
      // still allow request to proceed if user included token but policy disallows? We'll return error.
      return res.status(400).json({ ok: false, description: 'No bot token provided. Include "token" in the body or set DEFAULT_BOT_TOKEN env var.' });
    }

    const telegramApiUrl = `https://api.telegram.org/bot${useToken}/${endpoint}`;

    // Forward the user's request to Telegram
    const tgResp = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      // timeout is not built-in; Vercel handles function timeouts.
    });

    const tgJson = await tgResp.json().catch(() => ({ ok: false, description: 'invalid json from telegram' }));

    // Build a concise log message for your log channel
    if (logToChannel && serverLogBotToken && serverLogChatId) {
      try {
        // Compose a summary: endpoint, params (trimmed), whether success
        const safePayload = JSON.stringify(payload, (k, v) => {
          // hide long tokens if accidentally sent in payload
          if (typeof v === 'string' && v.length > 200) return v.slice(0, 200) + '...';
          return v;
        });

        const status = tgJson && tgJson.ok ? 'SUCCESS' : 'FAIL';
        const shortMsg = `<b>Proxy ${status}</b>\nEndpoint: <code>${endpoint}</code>\nResult: <code>${tgJson && tgJson.description ? tgJson.description : (tgJson && tgJson.ok ? 'OK' : 'See result')}</code>\nPayload: <code>${safePayload}</code>\nFrom IP: <code>${req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown'}</code>`;

        const logUrl = `https://api.telegram.org/bot${serverLogBotToken}/sendMessage`;
        await fetch(logUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: serverLogChatId,
            text: shortMsg,
            parse_mode: 'HTML'
          })
        }).catch(() => { /* swallow logging errors */ });
      } catch (le) {
        // don't crash if logging fails
        console.error('Log send failed', le?.message || le);
      }
    }

    // Return telegram's response to client (status 200)
    return res.status(200).json(tgJson);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, description: 'Server error', error: err.message });
  }
}
