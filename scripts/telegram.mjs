// Telegram helper for the order bot.
//   node --env-file=.env.local scripts/telegram.mjs whoami                       prints your chat id (send any message to the bot first)
//   node --env-file=.env.local scripts/telegram.mjs poll                         local testing: pulls button presses from Telegram and forwards them to the local shop
//   node --env-file=.env.local scripts/telegram.mjs webhook https://your-domain  production: Telegram calls the shop directly
const [command, arg] = process.argv.slice(2);
const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set');
const api = (method, body) =>
  fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  }).then((r) => r.json());

if (command === 'whoami') {
  const updates = await api('getUpdates', {});
  const chats = new Map();
  for (const item of updates.result ?? []) {
    const chat = item.message?.chat ?? item.callback_query?.message?.chat;
    if (chat) chats.set(chat.id, chat.first_name || chat.title || chat.username || '');
  }
  console.log(
    chats.size
      ? [...chats].map(([id, name]) => `chat id: ${id}  (${name})`).join('\n')
      : 'No messages yet - send any message to your bot, then run this again.',
  );
} else if (command === 'webhook') {
  if (!arg || !secret) throw new Error('usage: webhook <https://shop-domain> (and TELEGRAM_WEBHOOK_SECRET must be set)');
  const result = await api('setWebhook', {
    url: `${arg.replace(/\/+$/, '')}/api/telegram/webhook`,
    secret_token: secret,
    allowed_updates: ['callback_query'],
  });
  console.log(result);
} else if (command === 'poll') {
  if (!secret) throw new Error('TELEGRAM_WEBHOOK_SECRET is not set');
  const target = process.env.SHOP_LOCAL_URL || 'http://localhost:3003';
  await api('deleteWebhook', {}); // polling and a webhook cannot be used together
  console.log(`Polling Telegram, forwarding button presses to ${target}/api/telegram/webhook (Ctrl+C to stop)`);
  let offset = 0;
  for (;;) {
    // A dropped connection must never stop the loop: retry after a short pause.
    const updates = await api('getUpdates', { offset, timeout: 25, allowed_updates: ['callback_query'] }).catch((error) => {
      console.warn(`getUpdates failed (${error?.cause?.code || error.message}), retrying in 3s`);
      return null;
    });
    if (!updates) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      continue;
    }
    for (const update of updates.result ?? []) {
      offset = update.update_id + 1;
      const response = await fetch(`${target}/api/telegram/webhook`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': secret },
        body: JSON.stringify(update),
      }).catch(() => null);
      console.log(`update ${update.update_id} -> ${response ? response.status : 'shop unreachable'}`);
    }
  }
} else if (command === 'agent-webhook' || command === 'agent-poll') {
  // The customer-facing assistant bot (a separate bot from the order bot above).
  const agentToken = process.env.TELEGRAM_AGENT_BOT_TOKEN;
  const agentSecret = process.env.TELEGRAM_AGENT_WEBHOOK_SECRET;
  if (!agentToken || !agentSecret) throw new Error('TELEGRAM_AGENT_BOT_TOKEN and TELEGRAM_AGENT_WEBHOOK_SECRET must be set');
  const agentApi = (method, body) =>
    fetch(`https://api.telegram.org/bot${agentToken}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    }).then((r) => r.json());

  if (command === 'agent-webhook') {
    if (!arg) throw new Error('usage: agent-webhook <https://shop-domain>');
    console.log(
      await agentApi('setWebhook', {
        url: `${arg.replace(/\/+$/, '')}/api/agent/telegram`,
        secret_token: agentSecret,
        allowed_updates: ['message'],
      }),
    );
  } else {
    const target = process.env.SHOP_LOCAL_URL || 'http://localhost:3003';
    await agentApi('deleteWebhook', {});
    console.log(`Polling the assistant bot, forwarding messages to ${target}/api/agent/telegram (Ctrl+C to stop)`);
    let offset = 0;
    for (;;) {
      const updates = await agentApi('getUpdates', { offset, timeout: 25, allowed_updates: ['message'] }).catch(() => null);
      if (!updates) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        continue;
      }
      for (const update of updates.result ?? []) {
        offset = update.update_id + 1;
        const response = await fetch(`${target}/api/agent/telegram`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': agentSecret },
          body: JSON.stringify(update),
        }).catch(() => null);
        console.log(`update ${update.update_id} -> ${response ? response.status : 'shop unreachable'}`);
      }
    }
  }
} else {
  console.log('usage: whoami | poll | webhook <url> | agent-poll | agent-webhook <url>');
}
