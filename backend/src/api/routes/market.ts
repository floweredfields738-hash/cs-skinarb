import express, { Request, Response, NextFunction } from 'express';
import { query } from '../../utils/database';
import { optionalAuthMiddleware } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { cacheGet, cacheSet } from '../../utils/cache';
import { logger } from '../../utils/logging';
import { getCandlestickData } from '../../services/candlestickService';

const router = express.Router();

// Get real-time market prices across all markets
router.get('/prices', optionalAuthMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cacheKey = 'market:prices:all';
    let prices = await cacheGet(cacheKey);

    if (!prices) {
      const result = await query(
        `SELECT mp.skin_id, s.name, mp.market_id, mp.price, mp.volume,
                mp.quantity, mp.last_updated, mp.exterior, mp.float_value,
                mp.custom_name, s.min_float, s.max_float, s.rarity,
                m.display_name as market_name
         FROM market_prices mp
         JOIN skins s ON mp.skin_id = s.id
         JOIN markets m ON mp.market_id = m.id
         WHERE mp.price > 5
           AND mp.last_updated >= NOW() - INTERVAL '2 hours'
           AND s.name NOT LIKE 'Sticker |%'
           AND s.name NOT LIKE '%Capsule%'
           AND s.name NOT LIKE '%Graffiti%'
           AND s.name NOT LIKE 'Patch |%'
           AND s.name NOT LIKE 'Music Kit%'
           AND s.name NOT LIKE 'Pin |%'
           AND s.name NOT LIKE '%Slab%'
         ORDER BY mp.price DESC
         LIMIT 500`,
        []
      );

      prices = result.rows;
      await cacheSet(cacheKey, prices, 300); // Cache for 5 minutes
    }

    // Group by market for client-side visualization
    const pricesByMarket: Record<string, any[]> = {};
    (prices as any[]).forEach(p => {
      if (!pricesByMarket[p.market_id]) {
        pricesByMarket[p.market_id] = [];
      }
      pricesByMarket[p.market_id].push(p);
    });

    res.json({
      success: true,
      data: {
        prices,
        pricesByMarket,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get market trends (7-day volumes and prices)
router.get('/trends', optionalAuthMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT s.id, s.name,
              (SELECT MIN(mp.price) FROM market_prices mp WHERE mp.skin_id = s.id) as current_price,
              ps.trading_volume_7d as volume_7d, ps.trading_volume_30d as volume_30d,
              NULL as trend, s.rarity, NULL as image_url,
              ROUND(((ps.trading_volume_7d - ps.trading_volume_30d) / NULLIF(ps.trading_volume_30d, 0) * 100)::numeric, 2) as volume_change_percent
       FROM skins s
       LEFT JOIN price_statistics ps ON ps.skin_id = s.id
       WHERE ps.trading_volume_7d > 0 AND ps.trading_volume_30d > 0
       ORDER BY volume_change_percent DESC
       LIMIT 100`,
      []
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// Get market leaders (top gainers/losers)
router.get('/leaders', optionalAuthMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const type = (req.query.type as string) || 'gainers'; // gainers or losers
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);

    let orderBy = 'DESC'; // For gainers
    if (type === 'losers') {
      orderBy = 'ASC';
    }

    const result = await query(
      `SELECT s.id, s.name, s.rarity,
              (SELECT MIN(mp.price) FROM market_prices mp WHERE mp.skin_id = s.id) as current_price,
              ps.trading_volume_7d as volume_7d, NULL as trend, NULL as image_url,
              ROUND((ps.price_volatility)::numeric, 2) as price_change_percent
       FROM skins s
       LEFT JOIN price_statistics ps ON ps.skin_id = s.id
       WHERE ps.price_volatility != 0
       ORDER BY ps.price_volatility ${orderBy}
       LIMIT $1`,
      [limit]
    );

    res.json({
      success: true,
      data: {
        type,
        skins: result.rows,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get market heatmap data (rarity + price distribution)
router.get('/heatmap', optionalAuthMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT s.rarity,
              COUNT(*) as count,
              ROUND(AVG(ps.avg_price_7d)::numeric, 2) as avg_price,
              ROUND(MAX(ps.max_price_7d)::numeric, 2) as max_price,
              ROUND(MIN(ps.min_price_7d)::numeric, 2) as min_price,
              ROUND(AVG(os.overall_score)::numeric, 2) as avg_opportunity
       FROM skins s
       LEFT JOIN price_statistics ps ON ps.skin_id = s.id
       LEFT JOIN opportunity_scores os ON os.skin_id = s.id
       GROUP BY s.rarity
       ORDER BY 
         CASE 
           WHEN rarity = 'Covert' THEN 1
           WHEN rarity = 'Classified' THEN 2
           WHEN rarity = 'Restricted' THEN 3
           WHEN rarity = 'Mil-Spec' THEN 4
           WHEN rarity = 'Industrial' THEN 5
           WHEN rarity = 'Consumer' THEN 6
           ELSE 7
         END`,
      []
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// Get market statistics
router.get('/stats', optionalAuthMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cacheKey = 'market:stats';
    let stats = await cacheGet(cacheKey);

    if (!stats) {
      const statsResult = await query(
        `SELECT
           COUNT(*) as total_skins,
           ROUND(AVG(ps.avg_price_7d)::numeric, 2) as avg_price,
           ROUND(MAX(ps.max_price_7d)::numeric, 2) as max_price,
           ROUND(MIN(ps.min_price_7d)::numeric, 2) as min_price,
           ROUND(SUM(ps.trading_volume_7d)::numeric, 0) as total_volume_7d,
           ROUND(AVG(os.overall_score)::numeric, 2) as avg_opportunity,
           MAX(os.overall_score) as max_opportunity
         FROM skins s
         LEFT JOIN price_statistics ps ON ps.skin_id = s.id
         LEFT JOIN opportunity_scores os ON os.skin_id = s.id`,
        []
      );

      const rarityResult = await query(
        `SELECT rarity, COUNT(*) as count
         FROM skins
         GROUP BY rarity`,
        []
      );

      stats = {
        overall: statsResult.rows[0],
        byRarity: rarityResult.rows,
      };

      await cacheSet(cacheKey, stats, 600); // Cache for 10 minutes
    }

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
});

// Get price comparison across markets
// Old compare route removed — replaced by cross-market comparison below

// Get market activity feed with REAL price changes from history
router.get('/feed', optionalAuthMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);

    // Get skins with real price changes by comparing latest vs previous price_history snapshot
    const result = await query(
      `SELECT
        mp.skin_id, s.name, mp.market_id, m.name as market_name,
        mp.price as new_price, mp.last_updated,
        COALESCE(
          (SELECT ph.price FROM price_history ph
           WHERE ph.skin_id = mp.skin_id AND ph.market_id = mp.market_id
             AND ph.timestamp < mp.last_updated - INTERVAL '10 minutes'
           ORDER BY ph.timestamp DESC LIMIT 1),
          mp.price
        ) as previous_price
       FROM market_prices mp
       JOIN skins s ON mp.skin_id = s.id
       JOIN markets m ON m.id = mp.market_id
       WHERE mp.price > 5
         AND mp.last_updated > NOW() - INTERVAL '2 hours'
         AND s.name NOT LIKE 'Sticker |%'
         AND s.name NOT LIKE '%Capsule%'
         AND s.name NOT LIKE '%Graffiti%'
         AND s.name NOT LIKE 'Patch |%'
         AND s.name NOT LIKE 'Music Kit%'
         AND s.name NOT LIKE 'Pin |%'
         AND s.name NOT LIKE '%Slab%'
       ORDER BY mp.last_updated DESC
       LIMIT $1`,
      [limit]
    );

    const data = result.rows.map((r: any) => {
      const newPrice = parseFloat(r.new_price);
      const prevPrice = parseFloat(r.previous_price);
      const change = newPrice - prevPrice;
      const changePct = prevPrice > 0 ? (change / prevPrice) * 100 : 0;
      return {
        skin_id: r.skin_id,
        name: r.name,
        market_id: r.market_id,
        market_name: r.market_name,
        price: newPrice,
        previous_price: prevPrice,
        change: Math.round(change * 100) / 100,
        change_percent: Math.round(changePct * 100) / 100,
        last_updated: r.last_updated,
      };
    });

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Get market summary (cached)
router.get('/summary', optionalAuthMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cacheKey = 'market:summary';
    let summary = await cacheGet(cacheKey);

    if (!summary) {
      const [volumeResult, skinsResult, changeResult, gainers, losers, arbResult] = await Promise.all([
        query(`SELECT COALESCE(SUM(volume), 0) as total_volume FROM market_prices`, []),
        query(`SELECT COUNT(DISTINCT skin_id) as count FROM market_prices`, []),
        query(
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
           ) ph2 ON ph1.skin_id = ph2.skin_id AND ph1.rn = 1 AND ph2.rn = 1`,
          []
        ),
        query(
          `SELECT s.name,
             COALESCE(((mp_latest.price - ps.avg_price_7d) / NULLIF(ps.avg_price_7d, 0)) * 100, 0) as change_pct
           FROM skins s
           JOIN price_statistics ps ON ps.skin_id = s.id
           JOIN (
             SELECT DISTINCT ON (skin_id) skin_id, price
             FROM market_prices ORDER BY skin_id, last_updated DESC
           ) mp_latest ON mp_latest.skin_id = s.id
           ORDER BY change_pct DESC LIMIT 1`,
          []
        ),
        query(
          `SELECT s.name,
             COALESCE(((mp_latest.price - ps.avg_price_7d) / NULLIF(ps.avg_price_7d, 0)) * 100, 0) as change_pct
           FROM skins s
           JOIN price_statistics ps ON ps.skin_id = s.id
           JOIN (
             SELECT DISTINCT ON (skin_id) skin_id, price
             FROM market_prices ORDER BY skin_id, last_updated DESC
           ) mp_latest ON mp_latest.skin_id = s.id
           ORDER BY change_pct ASC LIMIT 1`,
          []
        ),
        query(`SELECT COUNT(*) as count FROM arbitrage_opportunities WHERE is_active = TRUE`, []),
      ]);

      const topGainer = gainers.rows.length > 0
        ? { name: gainers.rows[0].name, change: Math.round(parseFloat(gainers.rows[0].change_pct) * 100) / 100 }
        : { name: 'N/A', change: 0 };
      const topLoser = losers.rows.length > 0
        ? { name: losers.rows[0].name, change: Math.round(parseFloat(losers.rows[0].change_pct) * 100) / 100 }
        : { name: 'N/A', change: 0 };

      summary = {
        totalVolume24h: parseInt(volumeResult.rows[0]?.total_volume || '0'),
        activeSkins: parseInt(skinsResult.rows[0]?.count || '0'),
        avgChange24h: Math.round(parseFloat(changeResult.rows[0]?.avg_change || '0') * 100) / 100,
        topGainer,
        topLoser,
        arbitrageCount: parseInt(arbResult.rows[0]?.count || '0'),
        timestamp: new Date().toISOString(),
      };

      await cacheSet(cacheKey, summary, 30); // Cache for 30s to stay fresh
    }

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
});

// Get candlestick (OHLC) data for charting
router.get('/candles', optionalAuthMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const skinId = parseInt(req.query.skin_id as string);
    const marketId = parseInt(req.query.market_id as string) || 1;
    const interval = (req.query.interval as string) || '1d';
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const exterior = (req.query.exterior as string) || 'Factory New';

    if (!skinId || isNaN(skinId)) {
      return next(new AppError('skin_id is required', 400, 'MISSING_SKIN_ID'));
    }

    const validIntervals = ['1h', '4h', '1d', '1w'];
    if (!validIntervals.includes(interval)) {
      return next(new AppError(`Invalid interval. Must be one of: ${validIntervals.join(', ')}`, 400, 'INVALID_INTERVAL'));
    }

    const cacheKey = `candles:${skinId}:${marketId}:${interval}:${limit}`;
    let candles = await cacheGet(cacheKey);

    if (!candles) {
      candles = await getCandlestickData(skinId, marketId, interval, limit, exterior);
      await cacheSet(cacheKey, candles, 30); // Cache for 30 seconds
    }

    res.json({
      success: true,
      data: {
        skinId,
        marketId,
        interval,
        candles,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Search skins by name (for market monitor)
router.get('/search', optionalAuthMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = (req.query.q as string) || '';
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    if (q.length < 2) {
      return res.json({ success: true, data: [] });
    }

    const result = await query(
      `SELECT s.id, s.name, s.weapon_name, s.skin_name, s.rarity,
              (SELECT MIN(mp.price) FROM market_prices mp WHERE mp.skin_id = s.id) as current_price
       FROM skins s
       WHERE LOWER(s.name) LIKE $1
       ORDER BY s.name ASC
       LIMIT $2`,
      [`%${q.toLowerCase()}%`, limit]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// ─── Market Index OHLC Candles ───────────────────────
router.get('/index-candles', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const interval = (req.query.interval as string) || '1h';
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);

    // Map interval to PostgreSQL date_trunc bucket
    let bucket = '1 hour';
    let lookback = '7 days';
    if (interval === '4h') { bucket = '4 hours'; lookback = '30 days'; }
    else if (interval === '1d') { bucket = '1 day'; lookback = '90 days'; }
    else if (interval === '1w') { bucket = '1 week'; lookback = '365 days'; }
    else if (interval === '1h') { bucket = '1 hour'; lookback = '7 days'; }

    const result = await query(
      `SELECT
         date_trunc('hour', timestamp) -
           (EXTRACT(HOUR FROM timestamp)::int % CASE
             WHEN $1 = '4 hours' THEN 4
             WHEN $1 = '1 day' THEN 24
             ELSE 1
           END) * INTERVAL '1 hour' AS bucket,
         (array_agg(total_value ORDER BY timestamp ASC))[1] AS open,
         MAX(total_value) AS high,
         MIN(total_value) AS low,
         (array_agg(total_value ORDER BY timestamp DESC))[1] AS close,
         COUNT(*) AS volume
       FROM market_index_history
       WHERE timestamp > NOW() - INTERVAL '${lookback}'
       GROUP BY bucket
       ORDER BY bucket ASC
       LIMIT $2`,
      [bucket, limit]
    );

    let candles = result.rows.map((r: any) => ({
      timestamp: r.bucket,
      open: parseFloat(r.open),
      high: parseFloat(r.high),
      low: parseFloat(r.low),
      close: parseFloat(r.close),
      volume: parseInt(r.volume),
    }));

    // Filter out outlier candles where price jumped more than 500% in one period
    // (happens during initial data import)
    if (candles.length > 1) {
      candles = candles.filter((c: any, i: number) => {
        if (i === 0) {
          const next = candles[1];
          const ratio = c.high / c.low;
          return ratio < 5; // Skip if high/low ratio > 5x
        }
        return true;
      });
    }

    res.json({
      success: true,
      data: { candles },
    });
  } catch (error) {
    next(error);
  }
});

// ─── Cross-market price comparison for a skin ────────
router.get('/compare/:skinId', optionalAuthMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skinId } = req.params;

    // Get skin info
    const skinResult = await query(
      'SELECT id, name, weapon_name, skin_name, rarity, min_float, max_float FROM skins WHERE id = $1',
      [skinId]
    );

    if (!skinResult.rows.length) {
      return res.status(404).json({ success: false, error: 'Skin not found' });
    }

    const skin = skinResult.rows[0];

    // Get ALL real prices across ALL markets for this skin, grouped by exterior
    const pricesResult = await query(
      `SELECT mp.market_id, m.name as market_name, m.display_name,
              mp.price, mp.volume, mp.exterior, mp.float_value,
              mp.custom_name, mp.matched_name, mp.direct_url,
              mp.last_updated
       FROM market_prices mp
       JOIN markets m ON m.id = mp.market_id
       WHERE mp.skin_id = $1 AND mp.price > 0
       ORDER BY mp.exterior, mp.price ASC`,
      [skinId]
    );

    // Group by exterior, then by market
    const byExterior: Record<string, any[]> = {};
    for (const row of pricesResult.rows) {
      const ext = row.exterior || 'Unknown';
      if (!byExterior[ext]) byExterior[ext] = [];
      byExterior[ext].push({
        market_id: row.market_id,
        market_name: row.display_name || row.market_name,
        price: parseFloat(row.price),
        volume: row.volume,
        float_value: row.float_value ? parseFloat(row.float_value) : null,
        custom_name: row.custom_name,
        direct_url: row.direct_url,
        last_updated: row.last_updated,
      });
    }

    // Find best buy/sell per exterior
    const comparisons = Object.entries(byExterior).map(([exterior, markets]) => {
      const sorted = [...markets].sort((a, b) => a.price - b.price);
      const cheapest = sorted[0];
      const mostExpensive = sorted[sorted.length - 1];
      const spread = sorted.length >= 2
        ? mostExpensive.price - cheapest.price
        : 0;
      const spreadPercent = cheapest.price > 0
        ? (spread / cheapest.price) * 100
        : 0;

      return {
        exterior,
        markets,
        cheapest,
        mostExpensive: sorted.length >= 2 ? mostExpensive : null,
        spread: Math.round(spread * 100) / 100,
        spreadPercent: Math.round(spreadPercent * 100) / 100,
        marketCount: markets.length,
      };
    });

    res.json({
      success: true,
      skin,
      comparisons,
      totalMarkets: new Set(pricesResult.rows.map((r: any) => r.market_id)).size,
      totalListings: pricesResult.rows.length,
    });
  } catch (error) {
    next(error);
  }
});

// Market sentiment — buy/sell pressure indicator
router.get('/sentiment', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Calculate sentiment from price movements:
    // - Count skins where current price > 7d avg (bullish) vs < 7d avg (bearish)
    // - Use real price stats
    const result = await query(
      `SELECT
         COUNT(CASE WHEN mp_min < ps.avg_price_7d THEN 1 END) as bearish_count,
         COUNT(CASE WHEN mp_min >= ps.avg_price_7d THEN 1 END) as bullish_count,
         COUNT(*) as total
       FROM price_statistics ps
       JOIN LATERAL (
         SELECT MIN(mp.price) as mp_min FROM market_prices mp
         WHERE mp.skin_id = ps.skin_id AND mp.price > 0
       ) mp ON TRUE
       WHERE ps.avg_price_7d > 0 AND mp.mp_min > 0`
    );

    const r = result.rows[0];
    const total = parseInt(r.total) || 1;
    const bullish = parseInt(r.bullish_count) || 0;
    const bearish = parseInt(r.bearish_count) || 0;
    const bullishPct = Math.round((bullish / total) * 100);
    const bearishPct = Math.round((bearish / total) * 100);

    let sentiment: 'extreme_fear' | 'fear' | 'neutral' | 'greed' | 'extreme_greed';
    let score: number;

    if (bullishPct >= 70) { sentiment = 'extreme_greed'; score = 80 + Math.round((bullishPct - 70) / 3); }
    else if (bullishPct >= 55) { sentiment = 'greed'; score = 60 + Math.round((bullishPct - 55) / 1.5); }
    else if (bullishPct >= 45) { sentiment = 'neutral'; score = 45 + Math.round((bullishPct - 45)); }
    else if (bullishPct >= 30) { sentiment = 'fear'; score = 20 + Math.round((bullishPct - 30) * 1.5); }
    else { sentiment = 'extreme_fear'; score = Math.max(0, Math.round(bullishPct * 0.7)); }

    // Volume trend
    const volumeResult = await query(
      `SELECT ROUND(AVG(trading_volume_7d)::numeric, 0) as avg_vol,
              ROUND(AVG(trading_volume_30d)::numeric, 0) as avg_vol_30d
       FROM price_statistics WHERE trading_volume_7d > 0`
    );
    const vol7 = parseInt(volumeResult.rows[0]?.avg_vol || 0);
    const vol30 = parseInt(volumeResult.rows[0]?.avg_vol_30d || 0);
    const volumeTrend = vol30 > 0 ? Math.round(((vol7 - vol30 / 4.29) / (vol30 / 4.29)) * 100) : 0;

    res.json({
      success: true,
      data: {
        sentiment,
        score: Math.min(100, Math.max(0, score)),
        bullishPercent: bullishPct,
        bearishPercent: bearishPct,
        bullishCount: bullish,
        bearishCount: bearish,
        totalTracked: total,
        volumeTrend,
        description: sentiment === 'extreme_greed' ? 'Market is highly bullish — most skins trading above average'
          : sentiment === 'greed' ? 'Market is trending up — majority of skins above 7-day average'
          : sentiment === 'neutral' ? 'Market is balanced — roughly equal bullish and bearish movement'
          : sentiment === 'fear' ? 'Market is trending down — many skins below 7-day average'
          : 'Market is highly bearish — most skins trading below average, potential buying opportunities',
      },
    });
  } catch (error) { next(error); }
});

// Price predictions for a skin
router.get('/predict/:skinId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { predictPrice } = await import('../../engines/predictionEngine');
    const skinId = parseInt(req.params.skinId);
    if (isNaN(skinId)) return res.status(400).json({ error: 'Invalid skin ID' });

    const prediction = await predictPrice(skinId);
    if (!prediction) return res.status(404).json({ error: 'No prediction available — insufficient data' });

    res.json({ success: true, data: prediction });
  } catch (error) { next(error); }
});

// Top predictions — biggest expected movers
router.get('/predictions/top', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    const result = await query(
      `SELECT pp.skin_id, s.name, pp.predicted_price, pp.confidence_score,
              pp.trend_direction, pp.prediction_strength,
              pp.moving_avg_7d, pp.moving_avg_30d, pp.volatility_forecast,
              (SELECT MIN(mp.price) FROM market_prices mp WHERE mp.skin_id = s.id AND mp.price > 0) as current_price
       FROM price_predictions pp
       JOIN skins s ON s.id = pp.skin_id
       WHERE pp.prediction_date = CURRENT_DATE
       ORDER BY ABS(pp.predicted_price - (SELECT MIN(mp.price) FROM market_prices mp WHERE mp.skin_id = s.id AND mp.price > 0)) DESC
       LIMIT $1`,
      [limit]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) { next(error); }
});

export default router;
