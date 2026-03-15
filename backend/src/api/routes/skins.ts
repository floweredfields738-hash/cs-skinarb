import express, { Request, Response, NextFunction } from 'express';
import { query } from '../../utils/database';
import { optionalAuthMiddleware } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { calculateOpportunityScore } from '../../engines/opportunityEngine';
import { predictPrice } from '../../engines/predictionEngine';
import { logger } from '../../utils/logging';

const router = express.Router();

// Get all skins with filtering, sorting, and pagination
router.get('/', optionalAuthMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    let params: any[] = [];
    let paramCount = 1;

    // Filter by rarity
    if (req.query.rarity) {
      whereClause += ` AND rarity = $${paramCount}`;
      params.push(req.query.rarity);
      paramCount++;
    }

    // Filter by case
    if (req.query.case) {
      whereClause += ` AND s.case_name = $${paramCount}`;
      params.push(req.query.case);
      paramCount++;
    }

    // Filter by price range
    if (req.query.minPrice) {
      whereClause += ` AND (SELECT MIN(mp2.price) FROM market_prices mp2 WHERE mp2.skin_id = s.id) >= $${paramCount}`;
      params.push(parseFloat(req.query.minPrice as string));
      paramCount++;
    }

    if (req.query.maxPrice) {
      whereClause += ` AND (SELECT MIN(mp2.price) FROM market_prices mp2 WHERE mp2.skin_id = s.id) <= $${paramCount}`;
      params.push(parseFloat(req.query.maxPrice as string));
      paramCount++;
    }

    // Filter by opportunity score
    if (req.query.minScore) {
      whereClause += ` AND os.overall_score >= $${paramCount}`;
      params.push(parseFloat(req.query.minScore as string));
      paramCount++;
    }

    // Search by name
    if (req.query.search) {
      whereClause += ` AND name ILIKE $${paramCount}`;
      params.push(`%${req.query.search}%`);
      paramCount++;
    }

    // Sorting
    const sortBy = (req.query.sortBy as string) || 'opportunity_score';
    const sortOrder = (req.query.sortOrder as string) === 'asc' ? 'ASC' : 'DESC';
    const sortFieldMap: Record<string, string> = {
      'opportunity_score': 'os.overall_score',
      'current_price': 'current_price',
      'volume_7d': 'ps.trading_volume_7d',
      'trend': 's.name',
      'name': 's.name',
    };
    const sortField = sortFieldMap[sortBy] || 'os.overall_score';

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as count FROM skins s
       LEFT JOIN opportunity_scores os ON os.skin_id = s.id
       LEFT JOIN price_statistics ps ON ps.skin_id = s.id
       ${whereClause}`,
      params
    );
    const total = countResult.rows[0].count;

    // Get paginated results
    params.push(limit, offset);
    const result = await query(
      `SELECT s.id, s.name, s.rarity, NULL as image_url,
              (SELECT MIN(mp.price) FROM market_prices mp WHERE mp.skin_id = s.id) as current_price,
              ps.trading_volume_7d as volume_7d, NULL as trend,
              os.overall_score as opportunity_score, s.min_float, s.case_name, s.updated_at as last_updated
       FROM skins s
       LEFT JOIN opportunity_scores os ON os.skin_id = s.id
       LEFT JOIN price_statistics ps ON ps.skin_id = s.id
       ${whereClause}
       ORDER BY ${sortField} ${sortOrder} NULLS LAST
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      params
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get skins by opportunity score range
router.get('/trending/opportunity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);

    const result = await query(
      `SELECT s.id, s.name, s.rarity,
              (SELECT MIN(mp.price) FROM market_prices mp WHERE mp.skin_id = s.id) as current_price,
              os.overall_score as opportunity_score,
              ps.trading_volume_7d as volume_7d, NULL as trend, NULL as image_url
       FROM skins s
       LEFT JOIN opportunity_scores os ON os.skin_id = s.id
       LEFT JOIN price_statistics ps ON ps.skin_id = s.id
       WHERE os.overall_score >= 60
       ORDER BY os.overall_score DESC
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

// Get single skin with detailed analysis
router.get('/:id', optionalAuthMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Get skin details
    const skinResult = await query(
      `SELECT s.id, s.name, s.rarity, NULL as image_url,
              (SELECT MIN(mp.price) FROM market_prices mp WHERE mp.skin_id = s.id) as current_price,
              ps.trading_volume_7d as volume_7d, ps.trading_volume_30d as volume_30d,
              NULL as trend, os.overall_score as opportunity_score,
              s.min_float as float_min, s.max_float as float_max,
              s.case_name, s.release_date, s.updated_at as last_updated
       FROM skins s
       LEFT JOIN opportunity_scores os ON os.skin_id = s.id
       LEFT JOIN price_statistics ps ON ps.skin_id = s.id
       WHERE s.id = $1`,
      [id]
    );

    if (!skinResult.rows.length) {
      return next(new AppError('Skin not found', 404, 'SKIN_NOT_FOUND'));
    }

    const skin = skinResult.rows[0];

    // Get market prices from multiple sources
    const marketResult = await query(
      `SELECT market_id, price, volume, last_updated
       FROM market_prices
       WHERE skin_id = $1
       ORDER BY last_updated DESC
       LIMIT 4`,
      [id]
    );

    // Get 30-day price history
    const historyResult = await query(
      `SELECT price, timestamp FROM price_history
       WHERE skin_id = $1
       AND timestamp >= NOW() - INTERVAL '30 days'
       ORDER BY timestamp ASC`,
      [id]
    );

    // Get arbitrage opportunities for this skin
    const arbitrageResult = await query(
      `SELECT sm.display_name as source_market, tm.display_name as target_market,
              ao.buy_price, ao.sell_price, ao.net_profit, ao.profit_margin,
              ao.roi, ao.liquidity_score, ao.risk_level, ao.expires_at
       FROM arbitrage_opportunities ao
       JOIN markets sm ON sm.id = ao.source_market_id
       JOIN markets tm ON tm.id = ao.target_market_id
       WHERE ao.skin_id = $1 AND ao.expires_at > NOW()
       ORDER BY ao.roi DESC
       LIMIT 10`,
      [id]
    );

    // Calculate current prediction if available (or predict on demand)
    let prediction = null;
    try {
      prediction = await predictPrice(id);
    } catch (err) {
      logger.warn(`Unable to predict price for skin ${id}:`, err);
    }

    res.json({
      success: true,
      data: {
        skin,
        marketPrices: marketResult.rows,
        priceHistory: historyResult.rows,
        arbitrageOpportunities: arbitrageResult.rows,
        prediction,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get price history for a skin
router.get('/:id/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const days = Math.min(parseInt(req.query.days as string) || 30, 365);

    const result = await query(
      `SELECT price, timestamp FROM price_history
       WHERE skin_id = $1
       AND timestamp >= NOW() - make_interval(days => $2)
       ORDER BY timestamp ASC`,
      [id, days]
    );

    if (!result.rows.length) {
      return next(new AppError('No price history found', 404, 'NO_HISTORY'));
    }

    res.json({
      success: true,
      data: result.rows,
      period: { days },
    });
  } catch (error) {
    next(error);
  }
});

// Get skinanalysis (technical analysis data)
router.get('/:id/analysis', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Get skin
    const skinResult = await query('SELECT id, name FROM skins WHERE id = $1', [id]);
    if (!skinResult.rows.length) {
      return next(new AppError('Skin not found', 404, 'SKIN_NOT_FOUND'));
    }

    // Get 30-day history for analysis
    const historyResult = await query(
      `SELECT price, timestamp FROM price_history
       WHERE skin_id = $1 AND timestamp >= NOW() - INTERVAL '30 days'
       ORDER BY timestamp ASC`,
      [id]
    );

    if (historyResult.rows.length < 7) {
      return next(new AppError('Insufficient data for analysis', 400, 'INSUFFICIENT_DATA'));
    }

    // Calculate moving averages
    const prices = historyResult.rows.map(r => parseFloat(r.price));
    const ma7 = prices.slice(-7).reduce((a, b) => a + b, 0) / 7;
    const ma30 = prices.reduce((a, b) => a + b, 0) / prices.length;

    // Calculate volatility
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / prices.length;
    const stdDev = Math.sqrt(variance);
    const volatility = (stdDev / mean) * 100;

    // Determine trend
    const latest = prices[prices.length - 1];
    const oldest = prices[0];
    const priceChange = ((latest - oldest) / oldest) * 100;

    let trendDirection = 'stable';
    let trendStrength = 'weak';

    if (ma7 > ma30 * 1.05) {
      trendDirection = 'up';
      const diff = ((ma7 - ma30) / ma30) * 100;
      if (diff > 5) trendStrength = 'strong';
      else if (diff > 2) trendStrength = 'moderate';
    } else if (ma7 < ma30 * 0.95) {
      trendDirection = 'down';
      const diff = ((ma30 - ma7) / ma30) * 100;
      if (diff > 5) trendStrength = 'strong';
      else if (diff > 2) trendStrength = 'moderate';
    }

    res.json({
      success: true,
      data: {
        skin: skinResult.rows[0],
        technical: {
          movingAverage7d: parseFloat(ma7.toFixed(2)),
          movingAverage30d: parseFloat(ma30.toFixed(2)),
          volatility: parseFloat(volatility.toFixed(2)),
          priceChange: parseFloat(priceChange.toFixed(2)),
          trendDirection,
          trendStrength,
        },
        priceHistory: historyResult.rows,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
