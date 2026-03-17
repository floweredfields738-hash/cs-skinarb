import { query, queryOne, queryMany } from '../utils/database';
import { logger } from '../utils/logging';

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
let bot: any = null;

// ─── Initialize the bot ──────────────────────────────
export async function initTelegramBot(): Promise<void> {
  if (!TELEGRAM_TOKEN) {
    logger.info('Telegram bot: no token configured — skipping');
    return;
  }

  try {
    const TelegramBot = (await import('node-telegram-bot-api')).default;
    bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

    // /start — link account
    bot.onText(/\/start(.*)/, async (msg: any, match: any) => {
      const chatId = msg.chat.id;
      const linkCode = (match[1] || '').trim();

      if (linkCode) {
        // User came from the website with a link code
        const user = await queryOne(
          'SELECT id, username FROM users WHERE id = $1',
          [linkCode]
        );

        if (user) {
          await query(
            'UPDATE users SET telegram_chat_id = $1, telegram_username = $2, telegram_alerts = TRUE WHERE id = $3',
            [chatId, msg.from?.username || null, user.id]
          );
          bot.sendMessage(chatId,
            `✅ *Linked to CSkinArb!*\n\nWelcome, *${user.username}*! You'll receive:\n• Price alert notifications\n• Top arbitrage opportunities\n• Market movement alerts\n\nCommands:\n/alerts — View your active alerts\n/arb — Top arbitrage opportunities\n/mute — Pause notifications\n/unmute — Resume notifications`,
            { parse_mode: 'Markdown' }
          );
          logger.info(`Telegram linked: user ${user.id} → chat ${chatId}`);
        } else {
          bot.sendMessage(chatId, '❌ Invalid link code. Go to CSkinArb Settings to get your link.');
        }
      } else {
        bot.sendMessage(chatId,
          `🎯 *CSkinArb Bot*\n\nLink your account to receive real-time CS2 skin arbitrage alerts.\n\nGo to *CSkinArb → Settings → Telegram* and click "Link Telegram" to connect your account.`,
          { parse_mode: 'Markdown' }
        );
      }
    });

    // /arb — top arbitrage opportunities
    bot.onText(/\/arb/, async (msg: any) => {
      const chatId = msg.chat.id;
      try {
        const opps = await queryMany(
          `SELECT s.name, ao.exterior, ao.buy_price, ao.sell_price, ao.net_profit, ao.roi,
                  sm.display_name as buy_market, tm.display_name as sell_market
           FROM arbitrage_opportunities ao
           JOIN skins s ON s.id = ao.skin_id
           JOIN markets sm ON sm.id = ao.source_market_id
           JOIN markets tm ON tm.id = ao.target_market_id
           WHERE ao.is_active = TRUE
           ORDER BY ao.net_profit DESC
           LIMIT 5`
        );

        if (opps.length === 0) {
          bot.sendMessage(chatId, '📊 No arbitrage opportunities right now. Check back soon!');
          return;
        }

        let msg_text = '🎯 *Top Arbitrage Opportunities*\n\n';
        opps.forEach((o: any, i: number) => {
          const profit = parseFloat(o.net_profit).toFixed(2);
          const roi = parseFloat(o.roi).toFixed(1);
          msg_text += `*${i + 1}. ${o.name}* (${o.exterior || '?'})\n`;
          msg_text += `   Buy: $${parseFloat(o.buy_price).toFixed(2)} on ${o.buy_market}\n`;
          msg_text += `   Sell: $${parseFloat(o.sell_price).toFixed(2)} on ${o.sell_market}\n`;
          msg_text += `   💰 Profit: *$${profit}* (${roi}%)\n\n`;
        });

        bot.sendMessage(chatId, msg_text, { parse_mode: 'Markdown' });
      } catch (e: any) {
        bot.sendMessage(chatId, '❌ Error fetching opportunities. Try again later.');
      }
    });

    // /alerts — show user's active alerts
    bot.onText(/\/alerts/, async (msg: any) => {
      const chatId = msg.chat.id;
      const user = await queryOne('SELECT id FROM users WHERE telegram_chat_id = $1', [chatId]);
      if (!user) {
        bot.sendMessage(chatId, '❌ Account not linked. Use /start to connect.');
        return;
      }

      const alerts = await queryMany(
        `SELECT a.alert_type, a.trigger_value, s.name, a.is_active
         FROM alerts a JOIN skins s ON s.id = a.skin_id
         WHERE a.user_id = $1 ORDER BY a.created_at DESC LIMIT 10`,
        [user.id]
      );

      if (alerts.length === 0) {
        bot.sendMessage(chatId, '🔔 No alerts set. Create one on CSkinArb!');
        return;
      }

      let msg_text = '🔔 *Your Alerts*\n\n';
      alerts.forEach((a: any) => {
        const status = a.is_active ? '🟢' : '⏸️';
        const type = a.alert_type.replace('_', ' ');
        msg_text += `${status} *${a.name}*\n   ${type}: $${parseFloat(a.trigger_value).toFixed(2)}\n\n`;
      });

      bot.sendMessage(chatId, msg_text, { parse_mode: 'Markdown' });
    });

    // /mute and /unmute
    bot.onText(/\/mute/, async (msg: any) => {
      await query('UPDATE users SET telegram_alerts = FALSE WHERE telegram_chat_id = $1', [msg.chat.id]);
      bot.sendMessage(msg.chat.id, '🔇 Notifications muted. Use /unmute to resume.');
    });

    bot.onText(/\/unmute/, async (msg: any) => {
      await query('UPDATE users SET telegram_alerts = TRUE WHERE telegram_chat_id = $1', [msg.chat.id]);
      bot.sendMessage(msg.chat.id, '🔔 Notifications resumed!');
    });

    logger.info('✓ Telegram bot initialized');
  } catch (error: any) {
    logger.error('Telegram bot error:', error.message);
  }
}

// ─── Send alert to a user via Telegram ──────────────
export async function sendTelegramAlert(userId: number, message: string): Promise<boolean> {
  if (!bot) return false;

  try {
    const user = await queryOne(
      'SELECT telegram_chat_id, telegram_alerts FROM users WHERE id = $1',
      [userId]
    );

    if (!user?.telegram_chat_id || !user.telegram_alerts) return false;

    await bot.sendMessage(user.telegram_chat_id, message, { parse_mode: 'Markdown' });
    return true;
  } catch (error: any) {
    logger.error(`Telegram send error for user ${userId}:`, error.message);
    return false;
  }
}

// ─── Broadcast to all linked users ──────────────────
export async function broadcastTelegram(message: string): Promise<number> {
  if (!bot) return 0;

  try {
    const users = await queryMany(
      'SELECT telegram_chat_id FROM users WHERE telegram_chat_id IS NOT NULL AND telegram_alerts = TRUE'
    );

    let sent = 0;
    for (const user of users) {
      try {
        await bot.sendMessage(user.telegram_chat_id, message, { parse_mode: 'Markdown' });
        sent++;
      } catch {}
    }
    return sent;
  } catch { return 0; }
}
