import express, { Request, Response, NextFunction } from 'express';
import { query, queryMany, queryOne } from '../../utils/database';
import { authMiddleware } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logging';
import { cacheGet, cacheSet } from '../../utils/cache';

const router = express.Router();

// All trade routes require auth
router.use(authMiddleware);

// ─── Get all trades with stats ───────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);

    const trades = await queryMany(
      `SELECT t.id, t.skin_id, s.name as skin_name, s.weapon_name, s.rarity,
              t.trade_type, t.quantity, t.price_per_unit, t.total_value,
              t.fee, t.net_value, t.trade_status, t.notes,
              t.created_at, t.completed_at,
              m.display_name as market_name
       FROM trades t
       JOIN skins s ON s.id = t.skin_id
       LEFT JOIN markets m ON m.id = t.market_id
       WHERE t.user_id = $1
       ORDER BY t.created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    // Calculate stats
    const statsResult = await queryOne(
      `SELECT
         COUNT(*) as total_trades,
         COUNT(CASE WHEN trade_type = 'sell' THEN 1 END) as sells,
         COUNT(CASE WHEN trade_type = 'buy' THEN 1 END) as buys,
         COALESCE(SUM(CASE WHEN trade_type = 'buy' THEN net_value ELSE 0 END), 0) as total_spent,
         COALESCE(SUM(CASE WHEN trade_type = 'sell' THEN net_value ELSE 0 END), 0) as total_earned,
         COALESCE(SUM(fee), 0) as total_fees
       FROM trades WHERE user_id = $1`,
      [userId]
    );

    const totalSpent = parseFloat(statsResult?.total_spent || 0);
    const totalEarned = parseFloat(statsResult?.total_earned || 0);
    const totalFees = parseFloat(statsResult?.total_fees || 0);
    const realizedPL = totalEarned - totalSpent;
    const winRate = await queryOne(
      `SELECT
         COUNT(DISTINCT skin_id) as total_skins,
         COUNT(DISTINCT CASE WHEN sell_total > buy_total THEN skin_id END) as profitable_skins
       FROM (
         SELECT skin_id,
           SUM(CASE WHEN trade_type = 'buy' THEN net_value ELSE 0 END) as buy_total,
           SUM(CASE WHEN trade_type = 'sell' THEN net_value ELSE 0 END) as sell_total
         FROM trades WHERE user_id = $1
         GROUP BY skin_id
         HAVING SUM(CASE WHEN trade_type = 'sell' THEN 1 ELSE 0 END) > 0
       ) sub`,
      [userId]
    );

    const totalSkins = parseInt(winRate?.total_skins || 0);
    const profitableSkins = parseInt(winRate?.profitable_skins || 0);

    res.json({
      success: true,
      trades,
      stats: {
        totalTrades: parseInt(statsResult?.total_trades || 0),
        buys: parseInt(statsResult?.buys || 0),
        sells: parseInt(statsResult?.sells || 0),
        totalSpent: Math.round(totalSpent * 100) / 100,
        totalEarned: Math.round(totalEarned * 100) / 100,
        totalFees: Math.round(totalFees * 100) / 100,
        realizedPL: Math.round(realizedPL * 100) / 100,
        realizedPLPercent: totalSpent > 0 ? Math.round((realizedPL / totalSpent) * 100 * 100) / 100 : 0,
        winRate: totalSkins > 0 ? Math.round((profitableSkins / totalSkins) * 100) : 0,
        profitableTrades: profitableSkins,
        totalCompletedSkins: totalSkins,
      },
    });
  } catch (error) { next(error); }
});

// ─── Log a trade ─────────────────────────────────────
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { skinId, tradeType, marketId, quantity, pricePerUnit, fee, notes } = req.body;

    if (!skinId || !tradeType || !pricePerUnit) {
      return next(new AppError('skinId, tradeType, and pricePerUnit are required', 400));
    }

    if (!['buy', 'sell'].includes(tradeType)) {
      return next(new AppError('tradeType must be buy or sell', 400));
    }

    const skin = await queryOne('SELECT id, name FROM skins WHERE id = $1', [skinId]);
    if (!skin) return next(new AppError('Skin not found', 404));

    const qty = quantity || 1;
    const price = parseFloat(pricePerUnit);
    const feeAmount = fee ? parseFloat(fee) : Math.round(price * qty * 0.05 * 100) / 100; // default 5% fee
    const totalValue = Math.round(price * qty * 100) / 100;
    const netValue = tradeType === 'buy'
      ? Math.round((totalValue + feeAmount) * 100) / 100
      : Math.round((totalValue - feeAmount) * 100) / 100;

    const result = await query(
      `INSERT INTO trades (user_id, skin_id, trade_type, market_id, quantity, price_per_unit,
         total_value, fee, net_value, trade_status, notes, created_at, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'completed', $10, NOW(), NOW())
       RETURNING id`,
      [userId, skinId, tradeType, marketId || null, qty, price, totalValue, feeAmount, netValue, notes || null]
    );

    logger.info(`Trade logged: user ${userId} ${tradeType} ${skin.name} x${qty} at $${price}`);
    res.json({ success: true, tradeId: result.rows[0]?.id });
  } catch (error) { next(error); }
});

// ─── Delete a trade ──────────────────────────────────
router.delete('/:tradeId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { tradeId } = req.params;
    const result = await query('DELETE FROM trades WHERE id = $1 AND user_id = $2', [tradeId, userId]);
    if (result.rowCount === 0) return next(new AppError('Trade not found', 404));
    res.json({ success: true });
  } catch (error) { next(error); }
});

export default router;
