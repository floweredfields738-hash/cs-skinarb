import express, { Request, Response, NextFunction } from 'express';
import { query, queryMany } from '../../utils/database';
import { authMiddleware } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logging';
import { cacheGet, cacheSet } from '../../utils/cache';

const router = express.Router();

// Get user alerts
router.get('/', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const status = (req.query.status as string) || 'all';

    let whereClause = 'WHERE a.user_id = $1';
    if (status === 'triggered') whereClause += ' AND a.last_triggered IS NOT NULL';
    else if (status === 'active') whereClause += ' AND a.is_active = true';

    const result = await query(
      `SELECT a.id, a.skin_id, s.name as skin_name, a.alert_type,
              a.trigger_condition, a.trigger_value, a.is_active,
              a.send_email, a.send_push, a.last_triggered, a.trigger_count,
              a.created_at,
              (SELECT MIN(mp.price) FROM market_prices mp WHERE mp.skin_id = a.skin_id AND mp.price > 0) as current_price
       FROM alerts a
       JOIN skins s ON a.skin_id = s.id
       ${whereClause}
       ORDER BY a.last_triggered DESC NULLS LAST, a.created_at DESC`,
      [userId]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) { next(error); }
});

// Create alert
router.post('/', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { skinId, alertType, condition, value, sendEmail, sendPush } = req.body;

    if (!skinId || !alertType || !condition || value === undefined) {
      return next(new AppError('skinId, alertType, condition, and value are required', 400));
    }

    const validTypes = ['price_above', 'price_below', 'volume_spike', 'arbitrage_found'];
    if (!validTypes.includes(alertType)) {
      return next(new AppError(`alertType must be: ${validTypes.join(', ')}`, 400));
    }

    const skin = await query('SELECT id, name FROM skins WHERE id = $1', [skinId]);
    if (!skin.rows.length) return next(new AppError('Skin not found', 404));

    const result = await query(
      `INSERT INTO alerts (user_id, skin_id, alert_type, trigger_condition, trigger_value,
         is_active, send_email, send_push, trigger_count, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, true, $6, $7, 0, NOW(), NOW())
       RETURNING *`,
      [userId, skinId, alertType, condition, value, sendEmail || false, sendPush || false]
    );

    logger.info(`Alert created: user ${userId}, ${alertType} on ${skin.rows[0].name} at $${value}`);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) { next(error); }
});

// Update alert
router.put('/:alertId', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { alertId } = req.params;
    const { condition, value, isActive, sendEmail, sendPush } = req.body;

    const alert = await query('SELECT id FROM alerts WHERE id = $1 AND user_id = $2', [alertId, userId]);
    if (!alert.rows.length) return next(new AppError('Alert not found', 404));

    await query(
      `UPDATE alerts SET
         trigger_condition = COALESCE($1, trigger_condition),
         trigger_value = COALESCE($2, trigger_value),
         is_active = COALESCE($3, is_active),
         send_email = COALESCE($4, send_email),
         send_push = COALESCE($5, send_push),
         updated_at = NOW()
       WHERE id = $6`,
      [condition, value, isActive, sendEmail, sendPush, alertId]
    );

    res.json({ success: true });
  } catch (error) { next(error); }
});

// Toggle alert active/paused
router.post('/:alertId/toggle', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { alertId } = req.params;

    const result = await query(
      'UPDATE alerts SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING is_active',
      [alertId, userId]
    );

    if (!result.rows.length) return next(new AppError('Alert not found', 404));
    res.json({ success: true, isActive: result.rows[0].is_active });
  } catch (error) { next(error); }
});

// Delete alert
router.delete('/:alertId', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { alertId } = req.params;

    const result = await query('DELETE FROM alerts WHERE id = $1 AND user_id = $2', [alertId, userId]);
    if (result.rowCount === 0) return next(new AppError('Alert not found', 404));

    res.json({ success: true });
  } catch (error) { next(error); }
});

// Get stats
router.get('/stats', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const result = await query(
      `SELECT
         COUNT(*) as total,
         COUNT(CASE WHEN is_active THEN 1 END) as active,
         COUNT(CASE WHEN last_triggered IS NOT NULL THEN 1 END) as triggered,
         COUNT(CASE WHEN NOT is_active THEN 1 END) as paused
       FROM alerts WHERE user_id = $1`,
      [userId]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) { next(error); }
});

export default router;
