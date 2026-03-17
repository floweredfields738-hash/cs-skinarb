import express, { Request, Response, NextFunction } from 'express';
import { query } from '../../utils/database';
import { authMiddleware, optionalAuthMiddleware } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { cacheGet, cacheSet } from '../../utils/cache';
import { getTopArbitrageOpportunities } from '../../engines/arbitrageEngine';
import { logger } from '../../utils/logging';

const router = express.Router();

// Get all active arbitrage opportunities
router.get(
  '/',
  optionalAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
      const minProfit = parseFloat(req.query.minProfit as string) || 0;
      const riskLevel = (req.query.riskLevel as string) || null; // 'low', 'medium', 'high'
      const exterior = (req.query.exterior as string) || null; // 'Factory New', 'Minimal Wear', etc.

      let whereClause = 'WHERE ao.is_active = TRUE AND ao.expires_at > NOW()';
      const params: any[] = [];
      let paramCount = 1;

      if (minProfit > 0) {
        whereClause += ` AND net_profit >= $${paramCount}`;
        params.push(minProfit);
        paramCount++;
      }

      if (riskLevel) {
        whereClause += ` AND risk_level = $${paramCount}`;
        params.push(riskLevel);
        paramCount++;
      }

      if (exterior) {
        whereClause += ` AND ao.exterior = $${paramCount}`;
        params.push(exterior);
        paramCount++;
      }

      params.push(limit);

      const result = await query(
        `SELECT ao.id, ao.skin_id, s.name, s.image_url,
                sm.display_name as source_market, tm.display_name as target_market,
                ao.buy_price, ao.sell_price, ao.net_profit, ao.profit_margin, ao.roi,
                ao.buy_link, ao.sell_link, ao.exterior,
                ao.confidence, ao.risk_level, ao.expires_at,
                ao.created_at,
                s.min_float, s.max_float, s.rarity, s.weapon_name,
                (SELECT mp.float_value FROM market_prices mp
                 WHERE mp.skin_id = ao.skin_id AND mp.market_id = ao.source_market_id
                 AND mp.exterior = ao.exterior AND mp.float_value IS NOT NULL
                 LIMIT 1) as exact_float,
                (SELECT mp.paint_seed FROM market_prices mp
                 WHERE mp.skin_id = ao.skin_id AND mp.market_id = ao.source_market_id
                 AND mp.exterior = ao.exterior AND mp.paint_seed IS NOT NULL
                 LIMIT 1) as paint_seed
         FROM arbitrage_opportunities ao
         JOIN skins s ON ao.skin_id = s.id
         JOIN markets sm ON sm.id = ao.source_market_id
         JOIN markets tm ON tm.id = ao.target_market_id
         ${whereClause}
         ORDER BY ao.net_profit DESC, ao.roi DESC
         LIMIT $${paramCount}`,
        params
      );

      res.json({
        success: true,
        data: result.rows,
        filters: {
          minProfit,
          riskLevel,
          exterior,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get arbitrage statistics
router.get(
  '/stats/overview',
  optionalAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cacheKey = 'arbitrage:stats';
      let stats = await cacheGet(cacheKey);

      if (!stats) {
        const statsResult = await query(
          `SELECT
             COUNT(*) as total_opportunities,
             ROUND(AVG(roi)::numeric, 2) as avg_roi,
             ROUND(MAX(roi)::numeric, 2) as max_roi,
             ROUND(AVG(net_profit)::numeric, 2) as avg_profit,
             ROUND(MAX(net_profit)::numeric, 2) as max_profit,
             COUNT(CASE WHEN risk_level = 'low' THEN 1 END) as low_risk_count,
             COUNT(CASE WHEN risk_level = 'medium' THEN 1 END) as medium_risk_count,
             COUNT(CASE WHEN risk_level = 'high' THEN 1 END) as high_risk_count
           FROM arbitrage_opportunities
           WHERE expires_at > NOW()`,
          []
        );

        const marketStats = await query(
          `SELECT sm.display_name as source_market, tm.display_name as target_market,
                  COUNT(*) as opp_count,
                  ROUND(AVG(ao.roi)::numeric, 2) as avg_roi
           FROM arbitrage_opportunities ao
           JOIN markets sm ON sm.id = ao.source_market_id
           JOIN markets tm ON tm.id = ao.target_market_id
           WHERE ao.expires_at > NOW()
           GROUP BY sm.display_name, tm.display_name
           ORDER BY opp_count DESC`,
          []
        );

        stats = {
          overall: statsResult.rows[0],
          marketPairs: marketStats.rows,
        };

        await cacheSet(cacheKey, stats, 300); // Cache 5 minutes
      }

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get high-confidence arbitrage for specific risk level
router.get(
  '/filter/by-risk',
  optionalAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const riskLevel = (req.query.level as string) || 'low'; // 'low', 'medium', 'high'
      const minRoi = parseFloat(req.query.minRoi as string) || 0;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);

      const result = await query(
        `SELECT ao.id, ao.skin_id, s.name, NULL as image_url,
                sm.display_name as source_market, tm.display_name as target_market,
                ao.buy_price, ao.sell_price, ao.net_profit, ao.roi,
                ao.exterior, ao.liquidity_score, ao.expires_at
         FROM arbitrage_opportunities ao
         JOIN skins s ON ao.skin_id = s.id
         JOIN markets sm ON sm.id = ao.source_market_id
         JOIN markets tm ON tm.id = ao.target_market_id
         WHERE ao.risk_level = $1
         AND ao.roi >= $2
         AND ao.expires_at > NOW()
         ORDER BY ao.roi DESC
         LIMIT $3`,
        [riskLevel, minRoi, limit]
      );

      res.json({
        success: true,
        data: result.rows,
        filter: { riskLevel, minRoi },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get arbitrage details for specific opportunity
// Historical arbitrage data — frequency, lifespan, patterns (must be before /:id)
router.get('/history', optionalAuthMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    const frequent = await query(
      `SELECT s.name, ah.exterior,
              sm.display_name as buy_market, tm.display_name as sell_market,
              COUNT(*) as occurrences,
              ROUND(AVG(ah.net_profit)::numeric, 2) as avg_profit,
              ROUND(AVG(ah.roi)::numeric, 1) as avg_roi,
              MIN(ah.detected_at) as first_seen,
              MAX(ah.detected_at) as last_seen
       FROM arbitrage_history ah
       JOIN skins s ON s.id = ah.skin_id
       JOIN markets sm ON sm.id = ah.source_market_id
       JOIN markets tm ON tm.id = ah.target_market_id
       GROUP BY s.name, ah.exterior, sm.display_name, tm.display_name
       ORDER BY COUNT(*) DESC
       LIMIT $1`,
      [limit]
    );

    const stats = await query(
      `SELECT COUNT(*) as total_recorded,
              COUNT(DISTINCT skin_id) as unique_skins,
              ROUND(AVG(net_profit)::numeric, 2) as avg_profit,
              ROUND(AVG(roi)::numeric, 1) as avg_roi,
              MIN(detected_at) as tracking_since
       FROM arbitrage_history`
    );

    res.json({ success: true, frequent: frequent.rows, stats: stats.rows[0] });
  } catch (error) { next(error); }
});

router.get(
  '/:id',
  optionalAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const result = await query(
        `SELECT ao.id, ao.skin_id, s.name, NULL as image_url,
                (SELECT MIN(mp.price) FROM market_prices mp WHERE mp.skin_id = s.id) as current_price,
                s.rarity, ao.exterior,
                sm.display_name as source_market, tm.display_name as target_market,
                ao.buy_price, ao.sell_price,
                ao.net_profit, ao.profit_margin, ao.roi, ao.liquidity_score,
                ao.risk_level, ao.expires_at, ao.created_at
         FROM arbitrage_opportunities ao
         JOIN skins s ON ao.skin_id = s.id
         JOIN markets sm ON sm.id = ao.source_market_id
         JOIN markets tm ON tm.id = ao.target_market_id
         WHERE ao.id = $1 AND ao.expires_at > NOW()`,
        [id]
      );

      if (!result.rows.length) {
        return next(
          new AppError('Arbitrage opportunity not found or expired', 404, 'OPP_NOT_FOUND')
        );
      }

      const opp = result.rows[0];

      // Get additional market context
      const marketContext = await query(
        `SELECT mp.market_id, mp.price, mp.volume, mp.last_updated
         FROM market_prices mp
         WHERE mp.skin_id = $1
         AND mp.market_id IN ($2, $3)
         ORDER BY mp.last_updated DESC
         LIMIT 2`,
        [opp.skin_id, opp.source_market, opp.target_market]
      );

      res.json({
        success: true,
        data: {
          opportunity: opp,
          marketContext: marketContext.rows,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get arbitrage opportunities by market pair
router.get(
  '/market-pair/:sourceMarket/:targetMarket',
  optionalAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sourceMarket, targetMarket } = req.params;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);

      const result = await query(
        `SELECT ao.id, ao.skin_id, s.name, NULL as image_url, ao.buy_price, ao.sell_price,
                ao.net_profit, ao.profit_margin, ao.roi, ao.exterior,
                ao.liquidity_score, ao.risk_level, ao.expires_at
         FROM arbitrage_opportunities ao
         JOIN skins s ON ao.skin_id = s.id
         JOIN markets sm ON sm.id = ao.source_market_id
         JOIN markets tm ON tm.id = ao.target_market_id
         WHERE sm.display_name = $1
         AND tm.display_name = $2
         AND ao.expires_at > NOW()
         ORDER BY ao.roi DESC
         LIMIT $3`,
        [sourceMarket, targetMarket, limit]
      );

      res.json({
        success: true,
        data: result.rows,
        marketPair: { sourceMarket, targetMarket },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Simulate arbitrage transaction (for logged-in users)
router.post(
  '/:id/simulate',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = (req as any).userId;

      // Get opportunity
      const oppResult = await query(
        `SELECT * FROM arbitrage_opportunities
         WHERE id = $1 AND expires_at > NOW()`,
        [id]
      );

      if (!oppResult.rows.length) {
        return next(
          new AppError('Opportunity not found or expired', 404, 'OPP_NOT_FOUND')
        );
      }

      const opp = oppResult.rows[0];

      // Check if user has portfolio
      const portfolioResult = await query(
        'SELECT id FROM portfolios WHERE user_id = $1',
        [userId]
      );

      if (!portfolioResult.rows.length) {
        return next(
          new AppError(
            'User portfolio not found. Import inventory first.',
            404,
            'PORTFOLIO_NOT_FOUND'
          )
        );
      }

      const portfolioId = portfolioResult.rows[0].id;

      // Simulate transaction
      const simulation = {
        buyPrice: opp.buy_price,
        quantity: 1,
        buyTotal: opp.buy_price,
        sellPrice: opp.sell_price,
        sellTotal: opp.sell_price,
        fees: {
          buy: parseFloat((opp.buy_price * 0.05).toFixed(2)), // Assume 5% avg fee
          sell: parseFloat((opp.sell_price * 0.05).toFixed(2)),
        },
        netProfit: opp.net_profit,
        roi: parseFloat((opp.roi.toFixed(2))),
        riskLevel: opp.risk_level,
        liquidity: opp.liquidity_score,
        expiresIn: opp.expires_at,
      };

      res.json({
        success: true,
        data: simulation,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Add arbitrage to watchlist (logged-in users)
router.post(
  '/:id/add-to-watchlist',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = (req as any).userId;

      // Get opportunity with skin info
      const oppResult = await query(
        `SELECT ao.skin_id, s.name FROM arbitrage_opportunities ao
         JOIN skins s ON ao.skin_id = s.id
         WHERE ao.id = $1`,
        [id]
      );

      if (!oppResult.rows.length) {
        return next(new AppError('Opportunity not found', 404, 'OPP_NOT_FOUND'));
      }

      const { skin_id, name } = oppResult.rows[0];

      // Check if skin already in watchlist
      const existingResult = await query(
        `SELECT id FROM watchlists
         WHERE user_id = $1 AND skin_id = $2`,
        [userId, skin_id]
      );

      if (existingResult.rows.length) {
        return res.json({
          success: true,
          message: 'Skin already in watchlist',
        });
      }

      // Add to watchlist
      await query(
        `INSERT INTO watchlists (user_id, skin_id, added_at)
         VALUES ($1, $2, NOW())`,
        [userId, skin_id]
      );

      res.json({
        success: true,
        message: `${name} added to watchlist`,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
