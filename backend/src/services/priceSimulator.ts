import { query, queryOne, queryMany } from '../utils/database';
import { broadcastMarketUpdate, broadcastArbitrageOpportunity } from '../utils/websocket';
import { logger } from '../utils/logging';

let priceInterval: ReturnType<typeof setInterval> | null = null;
let summaryInterval: ReturnType<typeof setInterval> | null = null;

const MARKET_NAMES: Record<number, string> = {
  1: 'Steam Community Market',
  2: 'Buff163',
  3: 'Skinport',
  4: 'CSFloat',
};

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, arr.length));
}

async function simulatePriceTick(): Promise<void> {
  try {
    // Get all skins
    const skins = await queryMany('SELECT id, name FROM skins ORDER BY id');
    if (skins.length === 0) return;

    // Pick 5-8 random skins per tick for continuous flow
    const count = 5 + Math.floor(Math.random() * 4);
    const selectedSkins = pickRandom(skins, count);

    for (const skin of selectedSkins) {
      // Pick 1-2 random markets to update
      const marketCount = 1 + Math.floor(Math.random() * 2);
      const allMarketIds = [1, 2, 3, 4];
      const selectedMarkets = pickRandom(allMarketIds, marketCount);

      for (const marketId of selectedMarkets) {
        // Get current price
        const current = await queryOne(
          `SELECT id, price, volume FROM market_prices
           WHERE skin_id = $1 AND market_id = $2
           ORDER BY last_updated DESC LIMIT 1`,
          [skin.id, marketId]
        );

        if (!current) continue;

        const oldPrice = parseFloat(current.price);
        // Small micro-movements for smooth flow: -0.4% to +0.6%
        const changePercent = randomInRange(-0.4, 0.6);
        const change = oldPrice * (changePercent / 100);
        const newPrice = Math.round(Math.max(0.01, oldPrice + change) * 100) / 100;
        const actualChange = Math.round((newPrice - oldPrice) * 100) / 100;
        const actualChangePercent = Math.round((actualChange / oldPrice) * 100 * 100) / 100;

        // Small random volume adjustment
        const oldVolume = current.volume || 0;
        const volumeChange = Math.floor(randomInRange(-5, 15));
        const newVolume = Math.max(0, oldVolume + volumeChange);

        // Update market_prices
        await query(
          `UPDATE market_prices SET price = $1, volume = $2, last_updated = NOW()
           WHERE id = $3`,
          [newPrice, newVolume, current.id]
        );

        // Broadcast market update
        broadcastMarketUpdate({
          type: 'price_update',
          data: {
            skinId: skin.id,
            skinName: skin.name,
            marketId,
            marketName: MARKET_NAMES[marketId] || `Market ${marketId}`,
            oldPrice,
            newPrice,
            change: actualChange,
            changePercent: actualChangePercent,
            volume: newVolume,
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Recalculate arbitrage for this skin
      await recalculateArbitrage(skin.id, skin.name);
    }

    // Compute and broadcast total market index (sum of cheapest price per skin across all markets)
    await broadcastMarketIndex();
  } catch (error) {
    logger.error('Price simulator tick error:', error);
  }
}

async function broadcastMarketIndex(): Promise<void> {
  try {
    const result = await queryOne(
      `SELECT
         COALESCE(SUM(min_price), 0) as total_value,
         COUNT(*) as skin_count
       FROM (
         SELECT skin_id, MIN(price) as min_price
         FROM market_prices
         GROUP BY skin_id
       ) sub`
    );

    const totalValue = parseFloat(result?.total_value || '0');
    const skinCount = parseInt(result?.skin_count || '0');

    broadcastMarketUpdate({
      type: 'market_index',
      data: {
        totalValue,
        skinCount,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    // Silently ignore — not critical
  }
}

async function recalculateArbitrage(skinId: number, skinName: string): Promise<void> {
  try {
    // Get all current market prices for this skin
    const prices = await queryMany(
      `SELECT mp.market_id, m.name as market_name, mp.price
       FROM market_prices mp
       JOIN markets m ON m.id = mp.market_id
       WHERE mp.skin_id = $1
       ORDER BY mp.price ASC`,
      [skinId]
    );

    if (prices.length < 2) return;

    const cheapest = prices[0];
    const expensive = prices[prices.length - 1];
    const buyPrice = parseFloat(cheapest.price);
    const sellPrice = parseFloat(expensive.price);
    const grossProfit = sellPrice - buyPrice;
    const feeCost = Math.round(buyPrice * 0.05 * 100) / 100;
    const netProfit = Math.round((grossProfit - feeCost) * 100) / 100;
    const roi = Math.round((netProfit / buyPrice) * 100 * 100) / 100;

    if (netProfit <= 0) {
      // Deactivate any existing arb for this skin
      await query(
        `UPDATE arbitrage_opportunities SET is_active = FALSE WHERE skin_id = $1 AND is_active = TRUE`,
        [skinId]
      );
      return;
    }

    // Clamp to DECIMAL(5,2) max of 999.99
    const clampedRoi = Math.min(roi, 999.99);
    const riskLevel = clampedRoi > 10 ? 'low' : clampedRoi > 5 ? 'medium' : 'high';
    const profitMargin = Math.min(Math.round((netProfit / sellPrice) * 100 * 100) / 100, 999.99);

    // Upsert: deactivate old, insert new
    await query(
      `UPDATE arbitrage_opportunities SET is_active = FALSE WHERE skin_id = $1 AND is_active = TRUE`,
      [skinId]
    );

    await query(
      `INSERT INTO arbitrage_opportunities
         (skin_id, source_market_id, target_market_id, buy_price, sell_price,
          gross_profit, fee_cost, net_profit, profit_margin, roi,
          risk_level, is_active, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE, NOW() + INTERVAL '6 hours')`,
      [skinId, cheapest.market_id, expensive.market_id, buyPrice, sellPrice,
       Math.round(grossProfit * 100) / 100, feeCost, netProfit, profitMargin, clampedRoi, riskLevel]
    );

    // Broadcast arbitrage update
    broadcastArbitrageOpportunity({
      type: 'arbitrage_update',
      data: {
        skinId,
        skinName,
        sourceMarket: MARKET_NAMES[cheapest.market_id] || cheapest.market_name,
        targetMarket: MARKET_NAMES[expensive.market_id] || expensive.market_name,
        buyPrice,
        sellPrice,
        profit: netProfit,
        roi: clampedRoi,
        riskLevel,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error(`Arbitrage recalculation error for skin ${skinId}:`, error);
  }
}

async function broadcastMarketSummary(): Promise<void> {
  try {
    // Total volume across all markets in the last 24 hours
    const volumeResult = await queryOne(
      `SELECT COALESCE(SUM(volume), 0) as total_volume FROM market_prices`
    );

    // Active skins count
    const skinsResult = await queryOne(
      `SELECT COUNT(DISTINCT skin_id) as count FROM market_prices`
    );

    // Average price change - approximate from price_history in last 24h
    const changeResult = await queryOne(
      `SELECT
         COALESCE(AVG(
           CASE WHEN ph2.price > 0 THEN ((ph1.price - ph2.price) / ph2.price) * 100 ELSE 0 END
         ), 0) as avg_change
       FROM (
         SELECT skin_id, price, ROW_NUMBER() OVER (PARTITION BY skin_id ORDER BY timestamp DESC) as rn
         FROM price_history WHERE timestamp > NOW() - INTERVAL '24 hours'
       ) ph1
       JOIN (
         SELECT skin_id, price, ROW_NUMBER() OVER (PARTITION BY skin_id ORDER BY timestamp ASC) as rn
         FROM price_history WHERE timestamp > NOW() - INTERVAL '24 hours'
       ) ph2 ON ph1.skin_id = ph2.skin_id AND ph1.rn = 1 AND ph2.rn = 1`
    );

    // Top gainer and loser from price_history
    const gainers = await queryMany(
      `SELECT s.name,
         COALESCE(((mp_latest.price - ps.avg_price_7d) / NULLIF(ps.avg_price_7d, 0)) * 100, 0) as change_pct
       FROM skins s
       JOIN price_statistics ps ON ps.skin_id = s.id
       JOIN (
         SELECT DISTINCT ON (skin_id) skin_id, price
         FROM market_prices ORDER BY skin_id, last_updated DESC
       ) mp_latest ON mp_latest.skin_id = s.id
       ORDER BY change_pct DESC LIMIT 1`
    );

    const losers = await queryMany(
      `SELECT s.name,
         COALESCE(((mp_latest.price - ps.avg_price_7d) / NULLIF(ps.avg_price_7d, 0)) * 100, 0) as change_pct
       FROM skins s
       JOIN price_statistics ps ON ps.skin_id = s.id
       JOIN (
         SELECT DISTINCT ON (skin_id) skin_id, price
         FROM market_prices ORDER BY skin_id, last_updated DESC
       ) mp_latest ON mp_latest.skin_id = s.id
       ORDER BY change_pct ASC LIMIT 1`
    );

    // Active arbitrage count
    const arbResult = await queryOne(
      `SELECT COUNT(*) as count FROM arbitrage_opportunities WHERE is_active = TRUE`
    );

    const topGainer = gainers.length > 0
      ? { name: gainers[0].name, change: Math.round(parseFloat(gainers[0].change_pct) * 100) / 100 }
      : { name: 'N/A', change: 0 };

    const topLoser = losers.length > 0
      ? { name: losers[0].name, change: Math.round(parseFloat(losers[0].change_pct) * 100) / 100 }
      : { name: 'N/A', change: 0 };

    broadcastMarketUpdate({
      type: 'market_summary',
      data: {
        totalVolume24h: parseInt(volumeResult?.total_volume || '0'),
        activeSkins: parseInt(skinsResult?.count || '0'),
        avgChange24h: Math.round(parseFloat(changeResult?.avg_change || '0') * 100) / 100,
        topGainer,
        topLoser,
        arbitrageCount: parseInt(arbResult?.count || '0'),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Market summary broadcast error:', error);
  }
}

export function startPriceSimulator(): void {
  if (priceInterval) {
    logger.warn('Price simulator already running.');
    return;
  }

  logger.info('Starting price simulator (tick every 800ms, summary every 10s)...');

  // Price tick every 800ms for smooth continuous flow
  priceInterval = setInterval(simulatePriceTick, 800);

  // Market summary every 10 seconds
  summaryInterval = setInterval(broadcastMarketSummary, 10000);

  // Run initial summary after a short delay
  setTimeout(broadcastMarketSummary, 3000);
}

export function stopPriceSimulator(): void {
  if (priceInterval) {
    clearInterval(priceInterval);
    priceInterval = null;
  }
  if (summaryInterval) {
    clearInterval(summaryInterval);
    summaryInterval = null;
  }
  logger.info('Price simulator stopped.');
}
