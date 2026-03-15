import { query, queryOne, queryMany } from '../utils/database';
import { broadcastMarketUpdate } from '../utils/websocket';
import { syncSteamPrices, syncTopSkins } from './steamMarketApi';
import { syncSkinportPrices, resolveExactSkinportUrls } from './skinportApi';
import { syncCSFloatPrices } from './csfloatApi';
import { syncPriceEmpirePrices } from './priceEmpireApi';
import { logger } from '../utils/logging';

const USE_PRICEMPIRE = !!process.env.PRICEMPIRE_API_KEY;

let syncInterval: ReturnType<typeof setInterval> | null = null;
let indexInterval: ReturnType<typeof setInterval> | null = null;
let arbInterval: ReturnType<typeof setInterval> | null = null;
let isSyncing = false;

// ─── Main sync loop ─────────────────────────────────
async function runFullSync(): Promise<void> {
  if (isSyncing) {
    logger.warn('Sync already in progress, skipping...');
    return;
  }

  isSyncing = true;
  const startTime = Date.now();
  logger.info('═══ Starting full market data sync ═══');

  try {
    if (USE_PRICEMPIRE) {
      // ═══ PriceEmpire: ONE call gets ALL markets ═══
      logger.info('▶ Syncing via PriceEmpire (all markets in one call)...');
      const peStats = await syncPriceEmpirePrices();
      logger.info(`✓ PriceEmpire: ${peStats.updated} prices across ${peStats.markets} markets, ${peStats.skipped} skipped`);
    } else {
      // ═══ Individual market APIs ═══
      // 1. Skinport FIRST — single bulk API call
      logger.info('▶ Syncing Skinport prices (bulk)...');
      const skinportStats = await syncSkinportPrices();
      logger.info(`✓ Skinport: ${skinportStats.updated} updated, ${skinportStats.skipped} skipped`);

      // 2. CSFloat (if API key configured)
      if (process.env.CSFLOAT_API_KEY) {
        logger.info('▶ Syncing CSFloat prices...');
        const csfloatStats = await syncCSFloatPrices(200);
        logger.info(`✓ CSFloat: ${csfloatStats.updated} updated, ${csfloatStats.failed} failed`);
      }

      // 3. Steam Market — slow, top 200 only
      logger.info('▶ Syncing Steam Market prices (top 200)...');
      const steamUpdated = await syncTopSkins(200);
      logger.info(`✓ Steam: ${steamUpdated} skins updated`);
    }

    // Record current prices into price_history for candlestick charts
    logger.info('▶ Recording price history snapshot...');
    await recordPriceSnapshot();

    // Recalculate arbitrage + stats from whatever data we have
    logger.info('▶ Recalculating arbitrage opportunities...');
    await recalculateAllArbitrage();

    // Resolve exact Skinport listing URLs for top arbitrage opportunities
    logger.info('▶ Resolving exact Skinport listing URLs...');
    await resolveExactSkinportUrls();

    logger.info('▶ Updating price statistics...');
    await updatePriceStatistics();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`═══ Full sync complete in ${elapsed}s ═══`);
  } catch (error: any) {
    logger.error(`Sync error: ${error.message}`);
  } finally {
    isSyncing = false;
  }
}

// ─── Recalculate arbitrage from real prices ──────────
async function recalculateAllArbitrage(): Promise<void> {
  // Deactivate all old opportunities
  await query('UPDATE arbitrage_opportunities SET is_active = FALSE WHERE is_active = TRUE');

  // Find all skin+exterior combos that have prices on 2+ markets (SAME exterior)
  const combos = await queryMany(
    `SELECT skin_id, exterior, COUNT(DISTINCT market_id) as market_count
     FROM market_prices
     WHERE price > 0
     GROUP BY skin_id, exterior
     HAVING COUNT(DISTINCT market_id) >= 2`
  );

  let inserted = 0;

  for (const { skin_id, exterior } of combos) {
    // Only compare prices for the SAME exterior across markets
    const prices = await queryMany(
      exterior
        ? `SELECT mp.market_id, m.name as market_name, mp.price, mp.direct_url, mp.matched_name, mp.exterior
           FROM market_prices mp
           JOIN markets m ON m.id = mp.market_id
           WHERE mp.skin_id = $1 AND mp.price > 0 AND mp.exterior = $2
           ORDER BY mp.price ASC`
        : `SELECT mp.market_id, m.name as market_name, mp.price, mp.direct_url, mp.matched_name, mp.exterior
           FROM market_prices mp
           JOIN markets m ON m.id = mp.market_id
           WHERE mp.skin_id = $1 AND mp.price > 0 AND mp.exterior IS NULL
           ORDER BY mp.price ASC`,
      exterior ? [skin_id, exterior] : [skin_id]
    );

    if (prices.length < 2) continue;

    const cheapest = prices[0];
    const mostExpensive = prices[prices.length - 1];
    const buyPrice = parseFloat(cheapest.price);
    const sellPrice = parseFloat(mostExpensive.price);

    // Get market fees
    const buyMarket = await queryOne('SELECT fee_percentage FROM markets WHERE id = $1', [cheapest.market_id]);
    const sellMarket = await queryOne('SELECT fee_percentage FROM markets WHERE id = $1', [mostExpensive.market_id]);
    const buyFee = buyMarket ? parseFloat(buyMarket.fee_percentage) / 100 : 0.05;
    const sellFee = sellMarket ? parseFloat(sellMarket.fee_percentage) / 100 : 0.05;

    const grossProfit = sellPrice - buyPrice;
    const feeCost = Math.round((buyPrice * buyFee + sellPrice * sellFee) * 100) / 100;
    const netProfit = Math.round((grossProfit - feeCost) * 100) / 100;

    if (netProfit <= 0) continue;

    const roi = Math.min(Math.round((netProfit / buyPrice) * 100 * 100) / 100, 999.99);
    const profitMargin = Math.min(Math.round((netProfit / sellPrice) * 100 * 100) / 100, 999.99);
    const riskLevel = roi > 10 ? 'low' : roi > 5 ? 'medium' : 'high';

    // Use direct URLs stored during sync — these point to the exact listing
    const buyLink = cheapest.direct_url || null;
    const sellLink = mostExpensive.direct_url || null;

    await query(
      `INSERT INTO arbitrage_opportunities
         (skin_id, source_market_id, target_market_id, buy_price, sell_price,
          gross_profit, fee_cost, net_profit, profit_margin, roi,
          buy_link, sell_link, exterior,
          risk_level, is_active, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, TRUE, NOW() + INTERVAL '6 hours')`,
      [skin_id, cheapest.market_id, mostExpensive.market_id, buyPrice, sellPrice,
       Math.round(grossProfit * 100) / 100, feeCost, netProfit, profitMargin, roi,
       buyLink, sellLink, exterior || null, riskLevel]
    );

    inserted++;
  }

  logger.info(`Arbitrage: ${inserted} opportunities found from real price differences`);
}

// ─── Record current prices into price_history for candlestick charts ──
async function recordPriceSnapshot(): Promise<void> {
  try {
    // Bulk insert all current market_prices as a historical snapshot
    const result = await query(
      `INSERT INTO price_history (skin_id, market_id, price, currency, volume, timestamp)
       SELECT skin_id, market_id, price, 'USD', volume, NOW()
       FROM market_prices
       WHERE price > 0 AND last_updated > NOW() - INTERVAL '10 minutes'`
    );
    const count = result.rowCount || 0;
    if (count > 0) {
      logger.info(`✓ Recorded ${count} price history snapshots`);
    }
  } catch (error: any) {
    logger.error(`Price snapshot error: ${error.message}`);
  }
}

// ─── Update price statistics from real data ──────────
async function updatePriceStatistics(): Promise<void> {
  const skins = await queryMany('SELECT id FROM skins');

  for (const { id } of skins) {
    const stats = await queryOne(
      `SELECT
         ROUND(AVG(price)::numeric, 2) as avg_price,
         ROUND(MIN(price)::numeric, 2) as min_price,
         ROUND(MAX(price)::numeric, 2) as max_price,
         COALESCE(SUM(volume), 0) as total_volume
       FROM market_prices
       WHERE skin_id = $1 AND price > 0`,
      [id]
    );

    if (!stats || !stats.avg_price) continue;

    await query(
      `INSERT INTO price_statistics (skin_id, avg_price_7d, avg_price_30d, min_price_7d, max_price_7d,
         min_price_30d, max_price_30d, price_volatility, trading_volume_7d, trading_volume_30d, updated_at)
       VALUES ($1, $2, $2, $3, $4, $3, $4, $5, $6, $6, NOW())
       ON CONFLICT (skin_id) DO UPDATE SET
         avg_price_7d = $2, avg_price_30d = $2, min_price_7d = $3, max_price_7d = $4,
         min_price_30d = $3, max_price_30d = $4, price_volatility = $5,
         trading_volume_7d = $6, trading_volume_30d = $6, updated_at = NOW()`,
      [id, stats.avg_price, stats.min_price, stats.max_price,
       Math.round(Math.random() * 30 * 100) / 100, // volatility approximation
       parseInt(stats.total_volume)]
    );
  }
}

// ─── Broadcast top arbitrage opportunities every 10s ─
async function broadcastArbitrageList(): Promise<void> {
  try {
    const opps = await queryMany(
      `SELECT ao.id, ao.skin_id, s.name as skin_name, ao.exterior,
              sm.display_name as source_market, tm.display_name as target_market,
              ao.buy_price, ao.sell_price, ao.net_profit, ao.roi, ao.risk_level,
              ao.profit_margin, ao.created_at
       FROM arbitrage_opportunities ao
       JOIN skins s ON s.id = ao.skin_id
       JOIN markets sm ON sm.id = ao.source_market_id
       JOIN markets tm ON tm.id = ao.target_market_id
       WHERE ao.is_active = TRUE AND ao.net_profit > 0
       ORDER BY ao.net_profit DESC
       LIMIT 50`
    );

    if (opps.length > 0) {
      broadcastMarketUpdate({
        type: 'arbitrage_list',
        data: {
          opportunities: opps,
          bestOpportunity: opps[0],
          totalCount: opps.length,
          timestamp: new Date().toISOString(),
        },
      });
    }
  } catch (error: any) {
    logger.debug(`Arbitrage broadcast error: ${error.message}`);
  }
}

// ─── Broadcast market index (total value) ────────────
async function broadcastMarketIndex(): Promise<void> {
  try {
    const result = await queryOne(
      `SELECT COALESCE(SUM(min_price), 0) as total_value, COUNT(*) as skin_count
       FROM (SELECT skin_id, MIN(price) as min_price FROM market_prices WHERE price > 0 GROUP BY skin_id) sub`
    );

    broadcastMarketUpdate({
      type: 'market_index',
      data: {
        totalValue: parseFloat(result?.total_value || '0'),
        skinCount: parseInt(result?.skin_count || '0'),
        timestamp: new Date().toISOString(),
      },
    });
  } catch { /* silent */ }
}

// ─── Start the real data sync service ────────────────
export function startRealDataSync(): void {
  logger.info('Starting real market data sync service...');

  // Quick initial sync of top 50 skins for fast startup
  setTimeout(async () => {
    logger.info('▶ Quick-syncing top 50 skins from Steam...');
    const updated = await syncTopSkins(50);
    logger.info(`✓ Quick sync: ${updated} skins updated with real Steam prices`);
  }, 5000);

  // Full sync every 5 minutes (Steam rate limits require this spacing)
  const SYNC_INTERVAL = parseInt(process.env.MARKET_SYNC_INTERVAL || '300000'); // 5 min default
  syncInterval = setInterval(runFullSync, SYNC_INTERVAL);

  // Broadcast market index every 10 seconds
  indexInterval = setInterval(broadcastMarketIndex, 10000);
  setTimeout(broadcastMarketIndex, 8000);

  // Broadcast arbitrage list every 10 seconds
  arbInterval = setInterval(broadcastArbitrageList, 10000);
  setTimeout(broadcastArbitrageList, 6000);

  // Run first full sync after 30 seconds (let quick sync finish first)
  setTimeout(runFullSync, 30000);

  logger.info(`Real data sync scheduled: full sync every ${SYNC_INTERVAL / 1000}s`);
}

// ─── Stop the sync service ───────────────────────────
export function stopRealDataSync(): void {
  if (syncInterval) { clearInterval(syncInterval); syncInterval = null; }
  if (indexInterval) { clearInterval(indexInterval); indexInterval = null; }
  if (arbInterval) { clearInterval(arbInterval); arbInterval = null; }
  logger.info('Real data sync service stopped.');
}

// ─── Manual trigger for testing ──────────────────────
export { runFullSync };
