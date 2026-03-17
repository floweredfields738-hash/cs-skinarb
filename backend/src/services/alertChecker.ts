import { queryMany, query, queryOne } from '../utils/database';
import { broadcastMarketUpdate } from '../utils/websocket';
import { sendTelegramAlert, broadcastTelegram } from './telegramBot';
import { logger } from '../utils/logging';

// Check all active alerts against current prices
export async function checkAlerts(): Promise<number> {
  try {
    // Get all active alerts with current prices
    const alerts = await queryMany(
      `SELECT a.id, a.user_id, a.skin_id, a.alert_type, a.trigger_condition,
              a.trigger_value, s.name as skin_name,
              (SELECT MIN(mp.price) FROM market_prices mp WHERE mp.skin_id = a.skin_id AND mp.price > 0) as current_price
       FROM alerts a
       JOIN skins s ON s.id = a.skin_id
       WHERE a.is_active = true`
    );

    let triggered = 0;

    for (const alert of alerts) {
      const currentPrice = parseFloat(alert.current_price);
      const targetValue = parseFloat(alert.trigger_value);

      if (!currentPrice || currentPrice <= 0) continue;

      let shouldTrigger = false;

      switch (alert.alert_type) {
        case 'price_above':
          shouldTrigger = currentPrice >= targetValue;
          break;
        case 'price_below':
          shouldTrigger = currentPrice <= targetValue;
          break;
        case 'volume_spike':
          // Would need volume tracking — skip for now
          break;
        case 'arbitrage_found':
          // Check if arbitrage exists for this skin above threshold
          const arb = await queryMany(
            'SELECT net_profit FROM arbitrage_opportunities WHERE skin_id = $1 AND is_active = true AND net_profit >= $2',
            [alert.skin_id, targetValue]
          );
          shouldTrigger = arb.length > 0;
          break;
      }

      if (shouldTrigger) {
        // Update alert
        await query(
          'UPDATE alerts SET last_triggered = NOW(), trigger_count = trigger_count + 1, is_active = false, updated_at = NOW() WHERE id = $1',
          [alert.id]
        );

        // Broadcast via WebSocket
        broadcastMarketUpdate({
          type: 'alert_triggered',
          data: {
            alertId: alert.id,
            userId: alert.user_id,
            skinName: alert.skin_name,
            alertType: alert.alert_type,
            targetValue,
            currentPrice,
            message: `${alert.skin_name} hit your ${alert.alert_type.replace('_', ' ')} target of $${targetValue.toFixed(2)} (currently $${currentPrice.toFixed(2)})`,
            timestamp: new Date().toISOString(),
          },
        });

        // Send Telegram notification
        sendTelegramAlert(
          alert.user_id,
          `🚨 *Alert Triggered!*\n\n*${alert.skin_name}*\n${alert.alert_type.replace('_', ' ')}: $${targetValue.toFixed(2)}\nCurrent price: *$${currentPrice.toFixed(2)}*\n\nAct now on CSkinArb!`
        );

        triggered++;
        logger.info(`Alert triggered: ${alert.skin_name} ${alert.alert_type} $${targetValue} (current: $${currentPrice})`);
      }
    }

    if (triggered > 0) {
      logger.info(`✓ ${triggered} alert(s) triggered`);
    }
    return triggered;
  } catch (error: any) {
    logger.error('Alert check error:', error.message);
    return 0;
  }
}

// ─── Instant arbitrage alerts for premium users ─────
export async function checkInstantArbitrageAlerts(): Promise<void> {
  try {
    // Get new high-value opportunities (>$20 profit)
    const newOpps = await queryMany(
      `SELECT s.name, ao.exterior, ao.buy_price, ao.sell_price, ao.net_profit, ao.roi,
              sm.display_name as buy_market, tm.display_name as sell_market
       FROM arbitrage_opportunities ao
       JOIN skins s ON s.id = ao.skin_id
       JOIN markets sm ON sm.id = ao.source_market_id
       JOIN markets tm ON tm.id = ao.target_market_id
       WHERE ao.is_active = TRUE AND ao.net_profit >= 20
         AND ao.created_at > NOW() - INTERVAL '6 minutes'
       ORDER BY ao.net_profit DESC
       LIMIT 3`
    );

    if (newOpps.length === 0) return;

    // Get premium users with Telegram
    const premiumUsers = await queryMany(
      `SELECT id, telegram_chat_id FROM users
       WHERE premium_tier = 'premium' AND premium_expires > NOW()
         AND telegram_chat_id IS NOT NULL AND telegram_alerts = TRUE`
    );

    if (premiumUsers.length === 0) return;

    // Build message
    const topOpp = newOpps[0];
    const msg = `🚀 *Instant Arbitrage Alert!*\n\n*${topOpp.name}* (${topOpp.exterior || '?'})\nBuy: $${parseFloat(topOpp.buy_price).toFixed(2)} on ${topOpp.buy_market}\nSell: $${parseFloat(topOpp.sell_price).toFixed(2)} on ${topOpp.sell_market}\n💰 Profit: *$${parseFloat(topOpp.net_profit).toFixed(2)}* (${parseFloat(topOpp.roi).toFixed(1)}%)`;

    // Send to all premium users
    for (const user of premiumUsers) {
      sendTelegramAlert(user.id, msg);
    }

    // Also broadcast via WebSocket
    broadcastMarketUpdate({
      type: 'instant_arbitrage',
      data: newOpps.map((o: any) => ({
        name: o.name,
        exterior: o.exterior,
        buyPrice: parseFloat(o.buy_price),
        sellPrice: parseFloat(o.sell_price),
        profit: parseFloat(o.net_profit),
        roi: parseFloat(o.roi),
        buyMarket: o.buy_market,
        sellMarket: o.sell_market,
      })),
    });

    logger.info(`Instant arbitrage alert sent to ${premiumUsers.length} premium user(s)`);
  } catch (error: any) {
    logger.error('Instant alert error:', error.message);
  }
}

// ─── Auto-sniper: check watchlist targets (premium) ──
export async function checkAutoSniper(): Promise<number> {
  try {
    // Get all watchlist items with target prices where user is premium
    const sniperItems = await queryMany(
      `SELECT wi.id, wi.skin_id, wi.target_price, wi.user_id,
              s.name as skin_name, u.telegram_chat_id,
              (SELECT MIN(mp.price) FROM market_prices mp
               WHERE mp.skin_id = wi.skin_id AND mp.price > 0) as current_price,
              (SELECT m.display_name FROM market_prices mp
               JOIN markets m ON m.id = mp.market_id
               WHERE mp.skin_id = wi.skin_id AND mp.price > 0
               ORDER BY mp.price ASC LIMIT 1) as cheapest_market
       FROM watchlist_items wi
       JOIN skins s ON s.id = wi.skin_id
       JOIN watchlists w ON w.id = wi.watchlist_id
       JOIN users u ON u.id = w.user_id
       WHERE wi.target_price IS NOT NULL
         AND u.premium_tier = 'premium'
         AND u.premium_expires > NOW()`
    );

    let triggered = 0;

    for (const item of sniperItems) {
      const current = parseFloat(item.current_price);
      const target = parseFloat(item.target_price);

      if (!current || current <= 0 || current > target) continue;

      // Price dropped below target — fire!
      const msg = `🎯 *Sniper Alert!*\n\n*${item.skin_name}* just dropped to *$${current.toFixed(2)}*\nYour target: $${target.toFixed(2)}\nCheapest on: ${item.cheapest_market}\n\n🔥 Act fast — this won't last!`;

      // Send Telegram
      sendTelegramAlert(item.user_id, msg);

      // Broadcast WebSocket
      broadcastMarketUpdate({
        type: 'sniper_alert',
        data: {
          userId: item.user_id,
          skinName: item.skin_name,
          currentPrice: current,
          targetPrice: target,
          market: item.cheapest_market,
        },
      });

      // Remove target so it doesn't fire again
      await query('UPDATE watchlist_items SET target_price = NULL WHERE id = $1', [item.id]);

      triggered++;
      logger.info(`Sniper triggered: ${item.skin_name} $${current} < $${target} for user ${item.user_id}`);
    }

    if (triggered > 0) logger.info(`✓ ${triggered} sniper alert(s) fired`);
    return triggered;
  } catch (error: any) {
    logger.error('Auto-sniper error:', error.message);
    return 0;
  }
}
