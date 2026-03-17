import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { query, queryOne, queryMany } from '../../utils/database';
import { authMiddleware } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logging';
import { cacheGet, cacheSet } from '../../utils/cache';

const router = express.Router();

// API tier limits
const API_TIERS: Record<string, { daily: number; perMinute: number; label: string; price: string }> = {
  free:       { daily: 100,   perMinute: 10,  label: 'Free',       price: '$0' },
  premium:    { daily: 5000,  perMinute: 60,  label: 'Pro',        price: '$9.99/mo (included with Premium)' },
  enterprise: { daily: 50000, perMinute: 300, label: 'Enterprise', price: '$99/mo' },
};

// ─── API Key auth middleware with tiered limits ──────
async function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const key = (req.headers['x-api-key'] as string) || (req.query.api_key as string);
  if (!key) return res.status(401).json({ error: 'API key required. Pass via x-api-key header or api_key query param.' });

  const result = await queryOne(
    `SELECT ak.id, ak.user_id, ak.requests_today, ak.is_active,
            COALESCE(u.premium_tier, 'free') as tier,
            u.premium_expires
     FROM api_keys ak
     JOIN users u ON u.id = ak.user_id
     WHERE ak.key = $1`, [key]
  );
  if (!result || !result.is_active) return res.status(403).json({ error: 'Invalid or disabled API key.' });

  // Determine tier
  const isPremium = result.tier === 'premium' && result.premium_expires && new Date(result.premium_expires) > new Date();
  const tierName = isPremium ? 'premium' : 'free';
  const limits = API_TIERS[tierName];

  if (result.requests_today >= limits.daily) {
    return res.status(429).json({
      error: `Daily limit of ${limits.daily} requests reached (${limits.label} tier). Upgrade for more.`,
      tier: tierName,
      limit: limits.daily,
      upgrade: tierName === 'free' ? '/settings' : null,
    });
  }

  await query(
    'UPDATE api_keys SET requests_today = requests_today + 1, last_request = NOW() WHERE id = $1',
    [result.id]
  );

  // Add rate info to response headers
  res.set('X-RateLimit-Tier', limits.label);
  res.set('X-RateLimit-Limit', String(limits.daily));
  res.set('X-RateLimit-Remaining', String(limits.daily - result.requests_today - 1));

  (req as any).apiUserId = result.user_id;
  (req as any).apiTier = tierName;
  next();
}

// ─── Generate API key ────────────────────────────────
router.post('/keys', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { name } = req.body;

    // Check existing keys (max 3)
    const existing = await queryMany('SELECT id FROM api_keys WHERE user_id = $1', [userId]);
    if (existing.length >= 3) return next(new AppError('Maximum 3 API keys allowed', 400));

    const key = `csa_${crypto.randomBytes(24).toString('hex')}`;
    const result = await query(
      'INSERT INTO api_keys (user_id, key, name) VALUES ($1, $2, $3) RETURNING id, key, name, created_at',
      [userId, key, name || 'Default']
    );

    logger.info(`API key created for user ${userId}`);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) { next(error); }
});

// ─── List user's API keys ────────────────────────────
router.get('/keys', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const keys = await queryMany(
      `SELECT id, CONCAT(LEFT(key, 8), '...', RIGHT(key, 4)) as key_preview,
              name, requests_today, last_request, is_active, created_at
       FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    res.json({ success: true, data: keys });
  } catch (error) { next(error); }
});

// ─── Delete API key ──────────────────────────────────
router.delete('/keys/:keyId', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    await query('DELETE FROM api_keys WHERE id = $1 AND user_id = $2', [req.params.keyId, userId]);
    res.json({ success: true });
  } catch (error) { next(error); }
});

// ═══════════════════════════════════════════════════════
// PUBLIC API ENDPOINTS (authenticated via API key)
// ═══════════════════════════════════════════════════════

// GET /v1/prices — all skin prices
router.get('/v1/prices', apiKeyAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const offset = parseInt(req.query.offset as string) || 0;
    const search = req.query.search as string;

    let where = 'WHERE mp.price > 0';
    const params: any[] = [];
    let paramCount = 1;

    if (search) { where += ` AND s.name ILIKE $${paramCount++}`; params.push(`%${search}%`); }
    params.push(limit, offset);

    const result = await queryMany(
      `SELECT s.name, mp.price, mp.exterior, m.name as market,
              mp.last_updated
       FROM market_prices mp
       JOIN skins s ON s.id = mp.skin_id
       JOIN markets m ON m.id = mp.market_id
       ${where}
       ORDER BY s.name, mp.price ASC
       LIMIT $${paramCount++} OFFSET $${paramCount}`,
      params
    );

    res.json({ data: result, limit, offset });
  } catch (error) { next(error); }
});

// GET /v1/arbitrage — current opportunities
router.get('/v1/arbitrage', apiKeyAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const minProfit = parseFloat(req.query.min_profit as string) || 0;

    const result = await queryMany(
      `SELECT s.name, ao.exterior, ao.buy_price, ao.sell_price, ao.net_profit, ao.roi,
              ao.confidence, ao.risk_level,
              sm.name as buy_market, tm.name as sell_market,
              ao.buy_link, ao.sell_link, ao.created_at
       FROM arbitrage_opportunities ao
       JOIN skins s ON s.id = ao.skin_id
       JOIN markets sm ON sm.id = ao.source_market_id
       JOIN markets tm ON tm.id = ao.target_market_id
       WHERE ao.is_active = TRUE AND ao.net_profit >= $1
       ORDER BY ao.net_profit DESC
       LIMIT $2`,
      [minProfit, limit]
    );

    res.json({ data: result, count: result.length });
  } catch (error) { next(error); }
});

// GET /v1/skin/:name — single skin with all market prices
router.get('/v1/skin/:name', apiKeyAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const name = req.params.name.replace(/-/g, ' ');
    const skin = await queryOne('SELECT id, name, rarity, weapon_name FROM skins WHERE name ILIKE $1', [name]);
    if (!skin) return res.status(404).json({ error: 'Skin not found' });

    const prices = await queryMany(
      `SELECT m.name as market, mp.price, mp.exterior, mp.last_updated
       FROM market_prices mp JOIN markets m ON m.id = mp.market_id
       WHERE mp.skin_id = $1 AND mp.price > 0
       ORDER BY mp.exterior, mp.price ASC`,
      [skin.id]
    );

    res.json({ data: { ...skin, prices } });
  } catch (error) { next(error); }
});

// GET /v1/market/summary — market overview
router.get('/v1/market/summary', apiKeyAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await queryOne(
      `SELECT COUNT(DISTINCT skin_id) as skins_tracked,
              COUNT(*) as total_prices,
              ROUND(AVG(price)::numeric, 2) as avg_price
       FROM market_prices WHERE price > 0`
    );
    const arbCount = await queryOne('SELECT COUNT(*) FROM arbitrage_opportunities WHERE is_active = TRUE');

    res.json({
      data: {
        skinsTracked: parseInt(stats?.skins_tracked || 0),
        totalPrices: parseInt(stats?.total_prices || 0),
        avgPrice: parseFloat(stats?.avg_price || 0),
        activeArbitrage: parseInt(arbCount?.count || 0),
      }
    });
  } catch (error) { next(error); }
});

// GET /v1/docs — API documentation
router.get('/v1/docs', (req: Request, res: Response) => {
  res.json({
    name: 'CSkinArb Public API',
    version: 'v1',
    baseUrl: '/api/public/v1',
    auth: 'Pass your API key via x-api-key header or api_key query parameter',
    tiers: Object.entries(API_TIERS).map(([k, v]) => ({ tier: k, ...v })),
    endpoints: [
      { method: 'GET', path: '/v1/prices', params: 'limit, offset, search', description: 'Get skin prices across all markets' },
      { method: 'GET', path: '/v1/arbitrage', params: 'limit, min_profit', description: 'Get active arbitrage opportunities' },
      { method: 'GET', path: '/v1/skin/:name', params: '', description: 'Get a specific skin with all market prices' },
      { method: 'GET', path: '/v1/market/summary', params: '', description: 'Get market overview stats' },
      { method: 'GET', path: '/v1/docs', params: '', description: 'This documentation' },
    ],
    example: 'curl -H "x-api-key: csa_your_key_here" https://cs-skin-backend-production.up.railway.app/api/public/v1/prices?search=AK-47&limit=5',
  });
});

// GET /v1/trends — anonymized user trends (what people are watching/trading)
router.get('/v1/trends', apiKeyAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Most watched skins
    const watched = await queryMany(
      `SELECT s.name, COUNT(*) as watchers
       FROM watchlist_items wi
       JOIN watchlists w ON w.id = wi.watchlist_id
       JOIN skins s ON s.id = wi.skin_id
       GROUP BY s.name
       ORDER BY COUNT(*) DESC
       LIMIT 10`
    );

    // Most traded skins
    const traded = await queryMany(
      `SELECT s.name, COUNT(*) as trades,
              SUM(CASE WHEN t.trade_type = 'buy' THEN 1 ELSE 0 END) as buys,
              SUM(CASE WHEN t.trade_type = 'sell' THEN 1 ELSE 0 END) as sells
       FROM trades t
       JOIN skins s ON s.id = t.skin_id
       GROUP BY s.name
       ORDER BY COUNT(*) DESC
       LIMIT 10`
    );

    // Most alerted skins
    const alerted = await queryMany(
      `SELECT s.name, COUNT(*) as alert_count
       FROM alerts a
       JOIN skins s ON s.id = a.skin_id
       GROUP BY s.name
       ORDER BY COUNT(*) DESC
       LIMIT 10`
    );

    res.json({
      data: {
        mostWatched: watched,
        mostTraded: traded,
        mostAlerted: alerted,
      },
    });
  } catch (error) { next(error); }
});

export default router;
