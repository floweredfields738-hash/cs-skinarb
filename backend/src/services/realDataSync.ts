import { query, queryOne, queryMany } from '../utils/database';
import { broadcastMarketUpdate } from '../utils/websocket';
import { syncSteamPrices, syncTopSkins } from './steamMarketApi';
import { syncSkinportPrices, resolveExactSkinportUrls, syncSkinportHistory } from './skinportApi';
import { syncCSFloatPrices } from './csfloatApi';
import { syncPriceEmpirePrices } from './priceEmpireApi';
import { recalculateAllScores } from '../engines/opportunityEngine';
import { addAffiliate } from '../utils/affiliateLinks';
import { checkAlerts, checkInstantArbitrageAlerts, checkAutoSniper } from './alertChecker';
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

    logger.info('▶ Syncing real historical sales data...');
    await syncSkinportHistory();

    logger.info('▶ Updating price statistics...');
    await updatePriceStatistics();

    logger.info('▶ Recalculating opportunity scores...');
    await recalculateAllScores();

    logger.info('▶ Checking price alerts...');
    await checkAlerts();

    logger.info('▶ Checking instant arbitrage alerts (premium)...');
    await checkInstantArbitrageAlerts();

    logger.info('▶ Checking auto-sniper targets (premium)...');
    await checkAutoSniper();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`═══ Full sync complete in ${elapsed}s ═══`);
  } catch (error: any) {
    logger.error(`Sync error: ${error.message}`);
  } finally {
    isSyncing = false;
  }
}

// ─── Generate market URLs for arbitrage links ────────
function generateMarketUrl(marketName: string, fullSkinName: string): string {
  const m = (marketName || '').toLowerCase();
  const encoded = encodeURIComponent(fullSkinName);

  if (m.includes('steam')) {
    return `https://steamcommunity.com/market/listings/730/${encoded}`;
  }
  if (m.includes('skinport')) {
    // Skinport slug: lowercase, spaces→hyphens, remove special chars, strip pipe
    const slug = fullSkinName
      .replace(/\s*\|\s*/g, '-')
      .replace(/[()]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-');
    return `https://skinport.com/item/cs2/${slug}`;
  }
  if (m.includes('csfloat') || m.includes('float')) {
    return `https://csfloat.com/search?market_hash_name=${encoded}`;
  }
  return `https://www.google.com/search?q=${encodeURIComponent(fullSkinName + ' buy ' + marketName)}`;
}

// ─── Arbitrage algorithm config ──────────────────────
const ARB_CONFIG = {
  MIN_PROFIT: 5.00,       // Minimum $5 net profit — anything less isn't worth the effort
  MAX_ROI: 80,            // Cap at 80% ROI — anything higher is almost certainly bad data
  MIN_BUY_PRICE: 2.00,    // Ignore skins under $2
  MAX_PRICE_AGE_MIN: 30,  // Both prices must be updated within 30 minutes
  CONFIDENCE_THRESHOLDS: {
    HIGH: { maxSpread: 25, maxAge: 10 },   // <25% spread, <10 min old = high confidence
    MEDIUM: { maxSpread: 50, maxAge: 20 },  // <50% spread, <20 min old = medium
    // Everything else = low confidence
  },
};

// ─── Recalculate arbitrage from real prices ──────────
async function recalculateAllArbitrage(): Promise<void> {
  // Delete all old opportunities (clean slate each cycle)
  await query('DELETE FROM arbitrage_opportunities');

  // Find all skin+exterior combos with prices on 2+ markets
  // Require: exterior NOT NULL, price > min, updated recently
  const combos = await queryMany(
    `SELECT skin_id, exterior, COUNT(DISTINCT market_id) as market_count
     FROM market_prices
     WHERE price > $1
       AND exterior IS NOT NULL
       AND last_updated > NOW() - INTERVAL '${ARB_CONFIG.MAX_PRICE_AGE_MIN} minutes'
     GROUP BY skin_id, exterior
     HAVING COUNT(DISTINCT market_id) >= 2`,
    [ARB_CONFIG.MIN_BUY_PRICE]
  );

  let inserted = 0;
  let filtered = 0;

  // Pre-fetch all market fees + skin names to avoid N+1 queries
  const allFees = await queryMany('SELECT id, fee_percentage FROM markets');
  const feeMap = new Map<number, number>();
  allFees.forEach((m: any) => feeMap.set(m.id, parseFloat(m.fee_percentage) / 100));

  const allSkinNames = await queryMany('SELECT id, name FROM skins');
  const skinNameMap = new Map<number, string>();
  allSkinNames.forEach((s: any) => skinNameMap.set(s.id, s.name));

  // Pre-fetch ALL fresh prices in one query instead of per-combo
  const allPrices = await queryMany(
    `SELECT mp.skin_id, mp.market_id, m.name as market_name, mp.price, mp.direct_url,
            mp.matched_name, mp.exterior, mp.last_updated
     FROM market_prices mp
     JOIN markets m ON m.id = mp.market_id
     WHERE mp.price > $1 AND mp.exterior IS NOT NULL
       AND mp.last_updated > NOW() - INTERVAL '${ARB_CONFIG.MAX_PRICE_AGE_MIN} minutes'
     ORDER BY mp.skin_id, mp.exterior, mp.price ASC`,
    [ARB_CONFIG.MIN_BUY_PRICE]
  );

  // Group by skin_id + exterior
  const priceGroups = new Map<string, any[]>();
  allPrices.forEach((p: any) => {
    const key = `${p.skin_id}_${p.exterior}`;
    if (!priceGroups.has(key)) priceGroups.set(key, []);
    priceGroups.get(key)!.push(p);
  });

  for (const { skin_id, exterior } of combos) {
    const prices = priceGroups.get(`${skin_id}_${exterior}`) || [];

    if (prices.length < 2) continue;

    const cheapest = prices[0];
    const mostExpensive = [...prices].reverse().find(p => p.market_id !== cheapest.market_id);
    if (!mostExpensive) continue;

    const buyPrice = parseFloat(cheapest.price);
    const sellPrice = parseFloat(mostExpensive.price);

    // Get market fees from pre-fetched map
    const sellFee = feeMap.get(mostExpensive.market_id) || 0.05;

    const grossProfit = sellPrice - buyPrice;
    // Only the sell-side market charges a fee on proceeds — buyer pays listing price
    const feeCost = Math.round((sellPrice * sellFee) * 100) / 100;
    const netProfit = Math.round((grossProfit - feeCost) * 100) / 100;

    // ── FILTERS ──
    // Skip if profit too low
    if (netProfit < ARB_CONFIG.MIN_PROFIT) { filtered++; continue; }

    const roi = Math.round((netProfit / buyPrice) * 100 * 100) / 100;

    // Skip if ROI suspiciously high (bad data)
    if (roi > ARB_CONFIG.MAX_ROI) { filtered++; continue; }

    const profitMargin = Math.round((netProfit / sellPrice) * 100 * 100) / 100;
    const spreadPct = ((sellPrice - buyPrice) / buyPrice) * 100;

    // ── CONFIDENCE SCORE ──
    const buyAge = (Date.now() - new Date(cheapest.last_updated).getTime()) / 60000; // minutes
    const sellAge = (Date.now() - new Date(mostExpensive.last_updated).getTime()) / 60000;
    const maxAge = Math.max(buyAge, sellAge);

    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (spreadPct <= ARB_CONFIG.CONFIDENCE_THRESHOLDS.HIGH.maxSpread && maxAge <= ARB_CONFIG.CONFIDENCE_THRESHOLDS.HIGH.maxAge) {
      confidence = 'high';
    } else if (spreadPct <= ARB_CONFIG.CONFIDENCE_THRESHOLDS.MEDIUM.maxSpread && maxAge <= ARB_CONFIG.CONFIDENCE_THRESHOLDS.MEDIUM.maxAge) {
      confidence = 'medium';
    }

    // ── RISK LEVEL (based on profit + confidence) ──
    const riskLevel = confidence === 'high' && roi > 10 ? 'low'
      : confidence === 'medium' && roi > 5 ? 'medium'
      : 'high';

    // Get skin name from pre-fetched map
    const skinName = skinNameMap.get(skin_id) || '';
    const fullName = `${skinName} (${exterior})`;
    const buyLink = addAffiliate(cheapest.direct_url || generateMarketUrl(cheapest.market_name, fullName));
    const sellLink = addAffiliate(mostExpensive.direct_url || generateMarketUrl(mostExpensive.market_name, fullName));

    await query(
      `INSERT INTO arbitrage_opportunities
         (skin_id, source_market_id, target_market_id, buy_price, sell_price,
          gross_profit, fee_cost, net_profit, profit_margin, roi,
          buy_link, sell_link, exterior,
          risk_level, confidence, is_active, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, TRUE, NOW() + INTERVAL '6 hours')`,
      [skin_id, cheapest.market_id, mostExpensive.market_id, buyPrice, sellPrice,
       Math.round(grossProfit * 100) / 100, feeCost, netProfit, profitMargin, Math.min(roi, ARB_CONFIG.MAX_ROI),
       buyLink, sellLink, exterior || null, riskLevel, confidence]
    );

    // Record to history for tracking frequency + lifespan
    await query(
      `INSERT INTO arbitrage_history (skin_id, exterior, source_market_id, target_market_id, buy_price, sell_price, net_profit, roi, detected_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [skin_id, exterior, cheapest.market_id, mostExpensive.market_id, buyPrice, sellPrice, netProfit, Math.min(roi, ARB_CONFIG.MAX_ROI)]
    ).catch(() => {});

    inserted++;
  }

  logger.info(`Arbitrage: ${inserted} opportunities found, ${filtered} filtered out (below $${ARB_CONFIG.MIN_PROFIT} profit or >${ARB_CONFIG.MAX_ROI}% ROI)`);
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
       // Real volatility: (max - min) / avg * 100
       stats.avg_price > 0 ? Math.round(((stats.max_price - stats.min_price) / stats.avg_price) * 100 * 100) / 100 : 0,
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
let lastIndexSave = 0;
async function broadcastMarketIndex(): Promise<void> {
  try {
    // Sum every unique (skin_id, exterior) combo — each exterior is a distinct tradeable item
    const result = await queryOne(
      `SELECT COALESCE(SUM(price), 0) as total_value, COUNT(*) as skin_count
       FROM (
         SELECT DISTINCT ON (skin_id, COALESCE(exterior, '')) skin_id, exterior, price
         FROM market_prices WHERE price > 0.03
         ORDER BY skin_id, COALESCE(exterior, ''), price ASC
       ) sub`
    );

    const totalValue = parseFloat(result?.total_value || '0');
    const skinCount = parseInt(result?.skin_count || '0');
    const timestamp = new Date().toISOString();

    broadcastMarketUpdate({
      type: 'market_index',
      data: { totalValue, skinCount, timestamp },
    });

    // Persist to history every 60 seconds (not every broadcast)
    const now = Date.now();
    if (now - lastIndexSave >= 60000 && totalValue > 0) {
      lastIndexSave = now;
      await query(
        `INSERT INTO market_index_history (total_value, skin_count, timestamp) VALUES ($1, $2, NOW())`,
        [totalValue, skinCount]
      );
    }
  } catch { /* silent */ }
}

// ─── Update float ranges in DB from known data ──────
async function updateFloatRanges(): Promise<void> {
  try {
    const { FLOAT_RANGES } = await import('../data/floatRanges');
    let updated = 0;
    for (const [name, [minFloat, maxFloat]] of Object.entries(FLOAT_RANGES)) {
      const result = await query(
        'UPDATE skins SET min_float = $1, max_float = $2 WHERE name = $3 AND (min_float != $1 OR max_float != $2)',
        [minFloat, maxFloat, name]
      );
      if ((result.rowCount ?? 0) > 0) updated++;
    }
    // Set glove defaults (0.06-0.80) for any glove with default 0-1
    const gloveResult = await query(
      `UPDATE skins SET min_float = 0.06, max_float = 0.80
       WHERE (name LIKE '%Gloves%' OR name LIKE '%Hand Wraps%')
       AND min_float = 0 AND max_float = 1`
    );
    updated += gloveResult.rowCount || 0;
    if (updated > 0) logger.info(`✓ Updated float ranges for ${updated} skins`);
  } catch (e: any) {
    logger.error('Float range update error:', e.message);
  }
}

// ─── Start the real data sync service ────────────────
export function startRealDataSync(): void {
  logger.info('Starting real market data sync service...');

  // Update float ranges on startup
  setTimeout(updateFloatRanges, 3000);

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
