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
                mp.quantity, mp.last_updated
         FROM market_prices mp
         JOIN skins s ON mp.skin_id = s.id
         WHERE mp.last_updated >= NOW() - INTERVAL '1 hour'
         ORDER BY mp.last_updated DESC`,
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
router.get('/compare/:skinId', optionalAuthMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skinId } = req.params;

    const result = await query(
      `SELECT mp.market_id, mp.price, mp.volume, mp.quantity, mp.last_updated,
              CASE
                WHEN mp.market_id = 'steam' THEN 0.13
                WHEN mp.market_id = 'buff163' THEN 0.05
                WHEN mp.market_id = 'skinport' THEN 0.10
                WHEN mp.market_id = 'csfloat' THEN 0.03
                ELSE 0
              END as fee_percent,
              ROUND((mp.price * (1 + (CASE
                WHEN mp.market_id = 'steam' THEN 0.13
                WHEN mp.market_id = 'buff163' THEN 0.05
                WHEN mp.market_id = 'skinport' THEN 0.10
                WHEN mp.market_id = 'csfloat' THEN 0.03
                ELSE 0
              END)))::numeric, 2) as price_with_fee
       FROM market_prices mp
       WHERE mp.skin_id = $1
       AND mp.last_updated >= NOW() - INTERVAL '1 hour'
       ORDER BY mp.last_updated DESC, mp.market_id`,
      [skinId]
    );

    if (!result.rows.length) {
      return next(new AppError('No price data found', 404, 'NO_PRICE_DATA'));
    }

    // Find best buy/sell opportunities
    const lowestPrice = Math.min(...result.rows.map(r => r.price));
    const highestPrice = Math.max(...result.rows.map(r => r.price));

    res.json({
      success: true,
      data: {
        prices: result.rows,
        bestBuy: {
          market: result.rows.find(r => r.price === lowestPrice)?.market_id,
          price: lowestPrice,
        },
        bestSell: {
          market: result.rows.find(r => r.price === highestPrice)?.market_id,
          price: highestPrice,
        },
        spread: parseFloat((((highestPrice - lowestPrice) / lowestPrice) * 100).toFixed(2)),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get market activity feed (recent price updates)
router.get('/feed', optionalAuthMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);

    const result = await query(
      `SELECT mp.skin_id, s.name, NULL as image_url, mp.market_id, mp.price, mp.volume,
              mp.last_updated,
              (SELECT MIN(mp2.price) FROM market_prices mp2 WHERE mp2.skin_id = s.id) as current_price,
              ROUND(((mp.price - (SELECT MIN(mp2.price) FROM market_prices mp2 WHERE mp2.skin_id = s.id)) / NULLIF((SELECT MIN(mp2.price) FROM market_prices mp2 WHERE mp2.skin_id = s.id), 0) * 100)::numeric, 2) as price_diff_percent
       FROM market_prices mp
       JOIN skins s ON mp.skin_id = s.id
       WHERE mp.last_updated >= NOW() - INTERVAL '1 hour'
       ORDER BY mp.last_updated DESC
       LIMIT $1`,
      [limit]
    );

    res.json({
      success: true,
      data: result.rows,
    });
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
      const [generalStats, volumeStats, opportunityStats] = await Promise.all([
        query(
          `SELECT COUNT(*) as active_skins,
                  ROUND(AVG(ps.avg_price_7d)::numeric, 2) as market_avg_price,
                  ROUND(SUM(ps.trading_volume_7d)::numeric, 0) as total_volume
           FROM skins s
           LEFT JOIN price_statistics ps ON ps.skin_id = s.id
           WHERE ps.trading_volume_7d > 0`,
          []
        ),
        query(
          `SELECT market_id, COUNT(*) as update_count,
                  ROUND(AVG(price)::numeric, 2) as avg_price
           FROM market_prices
           WHERE last_updated >= NOW() - INTERVAL '1 hour'
           GROUP BY market_id`,
          []
        ),
        query(
          `SELECT COUNT(*) as strong_buys,
                  ROUND(AVG(os.overall_score)::numeric, 2) as avg_score
           FROM skins s
           LEFT JOIN opportunity_scores os ON os.skin_id = s.id
           WHERE os.overall_score >= 75`,
          []
        ),
      ]);

      summary = {
        general: generalStats.rows[0],
        markets: volumeStats.rows,
        opportunities: opportunityStats.rows[0],
        lastUpdated: new Date(),
      };

      await cacheSet(cacheKey, summary, 600); // Cache for 10 minutes
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

export default router;
