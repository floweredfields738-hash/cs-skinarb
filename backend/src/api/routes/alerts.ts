import express, { Request, Response, NextFunction } from 'express';
import { query } from '../../utils/database';
import { authMiddleware } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { broadcastUserAlert } from '../../utils/websocket';
import { logger } from '../../utils/logging';

const router = express.Router();

// Get user alerts
router.get('/', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const status = (req.query.status as string) || 'all'; // 'triggered', 'active', 'all'

    let whereClause = 'WHERE a.user_id = $1';
    const params: any[] = [userId];

    if (status === 'triggered') {
      whereClause += ' AND a.triggered_at IS NOT NULL';
    } else if (status === 'active') {
      whereClause += ' AND a.triggered_at IS NULL AND a.enabled = true';
    }

    const result = await query(
      `SELECT a.id, a.skin_id, s.name, s.image_url, a.alert_type, a.condition, a.value,
              a.enabled, a.triggered_at, a.created_at
       FROM alerts a
       JOIN skins s ON a.skin_id = s.id
       ${whereClause}
       ORDER BY a.triggered_at DESC NULLS LAST, a.created_at DESC`,
      params
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// Create new alert
router.post('/', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { skinId, alertType, condition, value } = req.body;

    // Validate inputs
    if (!skinId || !alertType || !condition || value === undefined) {
      return next(
        new AppError('skinId, alertType, condition, and value are required', 400, 'MISSING_FIELDS')
      );
    }

    // Validate alert type
    const validAlertTypes = ['price', 'volume', 'opportunity', 'arbitrage'];
    if (!validAlertTypes.includes(alertType)) {
      return next(
        new AppError(`Invalid alertType. Must be one of: ${validAlertTypes.join(', ')}`, 400, 'INVALID_ALERT_TYPE')
      );
    }

    // Validate condition
    const validConditions = ['above', 'below', 'equals', 'increases', 'decreases'];
    if (!validConditions.includes(condition)) {
      return next(
        new AppError(`Invalid condition. Must be one of: ${validConditions.join(', ')}`, 400, 'INVALID_CONDITION')
      );
    }

    // Check if skin exists
    const skinResult = await query('SELECT id FROM skins WHERE id = $1', [skinId]);
    if (!skinResult.rows.length) {
      return next(new AppError('Skin not found', 404, 'SKIN_NOT_FOUND'));
    }

    // Create alert
    const result = await query(
      `INSERT INTO alerts (user_id, skin_id, alert_type, condition, value, enabled, created_at)
       VALUES ($1, $2, $3, $4, $5, true, NOW())
       RETURNING id, skin_id, alert_type, condition, value, enabled, created_at`,
      [userId, skinId, alertType, condition, value]
    );

    logger.info(`Alert created for user ${userId}: ${alertType} on skin ${skinId}`);

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// Get triggered alerts
router.get(
  '/history/triggered',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);

      const result = await query(
        `SELECT a.id, a.skin_id, s.name, s.image_url, a.alert_type, a.condition, a.value,
                a.triggered_at, a.created_at
         FROM alerts a
         JOIN skins s ON a.skin_id = s.id
         WHERE a.user_id = $1 AND a.triggered_at IS NOT NULL
         ORDER BY a.triggered_at DESC
         LIMIT $2`,
        [userId, limit]
      );

      res.json({
        success: true,
        data: result.rows,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get alert statistics
router.get(
  '/stats/overview',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;

      const result = await query(
        `SELECT
           COUNT(*) as total_alerts,
           COUNT(CASE WHEN enabled = true THEN 1 END) as active_alerts,
           COUNT(CASE WHEN triggered_at IS NOT NULL THEN 1 END) as triggered_alerts,
           COUNT(DISTINCT alert_type) as alert_types
         FROM alerts
         WHERE user_id = $1`,
        [userId]
      );

      const byTypeResult = await query(
        `SELECT alert_type, COUNT(*) as count
         FROM alerts
         WHERE user_id = $1
         GROUP BY alert_type`,
        [userId]
      );

      res.json({
        success: true,
        data: {
          overall: result.rows[0],
          byType: byTypeResult.rows,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Update alert
router.put('/:alertId', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { alertId } = req.params;
    const { condition, value, enabled } = req.body;

    // Verify ownership
    const alertResult = await query(
      'SELECT id FROM alerts WHERE id = $1 AND user_id = $2',
      [alertId, userId]
    );

    if (!alertResult.rows.length) {
      return next(new AppError('Alert not found', 404, 'ALERT_NOT_FOUND'));
    }

    // Update alert
    await query(
      `UPDATE alerts SET condition = COALESCE($1, condition),
                               value = COALESCE($2, value),
                               enabled = COALESCE($3, enabled)
       WHERE id = $4`,
      [condition || null, value !== undefined ? value : null, enabled !== undefined ? enabled : null, alertId]
    );

    res.json({
      success: true,
      message: 'Alert updated',
    });
  } catch (error) {
    next(error);
  }
});

// Delete alert
router.delete('/:alertId', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { alertId } = req.params;

    // Verify ownership
    const alertResult = await query(
      'SELECT id FROM alerts WHERE id = $1 AND user_id = $2',
      [alertId, userId]
    );

    if (!alertResult.rows.length) {
      return next(new AppError('Alert not found', 404, 'ALERT_NOT_FOUND'));
    }

    // Delete alert
    await query('DELETE FROM alerts WHERE id = $1', [alertId]);

    res.json({
      success: true,
      message: 'Alert deleted',
    });
  } catch (error) {
    next(error);
  }
});

// Disable all alerts for a skin
router.post(
  '/:skinId/disable-all',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;
      const { skinId } = req.params;

      const result = await query(
        `UPDATE alerts SET enabled = false
         WHERE user_id = $1 AND skin_id = $2
         RETURNING id`,
        [userId, skinId]
      );

      res.json({
        success: true,
        message: `Disabled ${result.rows.length} alerts for this skin`,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Acknowledge triggered alert
router.post(
  '/:alertId/acknowledge',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;
      const { alertId } = req.params;

      // Verify ownership
      const alertResult = await query(
        `SELECT id, skin_id FROM alerts
         WHERE id = $1 AND user_id = $2 AND triggered_at IS NOT NULL`,
        [alertId, userId]
      );

      if (!alertResult.rows.length) {
        return next(new AppError('Alert not found or not triggered', 404, 'ALERT_NOT_FOUND'));
      }

      // Reset triggered_at to acknowledge
      await query(
        'UPDATE alerts SET triggered_at = NULL WHERE id = $1',
        [alertId]
      );

      res.json({
        success: true,
        message: 'Alert acknowledged',
      });
    } catch (error) {
      next(error);
    }
  }
);

// Test alert (manually trigger for testing)
router.post(
  '/:alertId/test',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;
      const { alertId } = req.params;

      // Verify ownership
      const alertResult = await query(
        `SELECT id, skin_id, alert_type FROM alerts
         WHERE id = $1 AND user_id = $2`,
        [alertId, userId]
      );

      if (!alertResult.rows.length) {
        return next(new AppError('Alert not found', 404, 'ALERT_NOT_FOUND'));
      }

      const alert = alertResult.rows[0];

      // Broadcast test notification
      broadcastUserAlert(userId, {
        alertId,
        type: 'test',
        message: `Test alert for ${alert.alert_type}`,
        timestamp: new Date(),
      });

      logger.info(`Test alert sent to user ${userId}`);

      res.json({
        success: true,
        message: 'Test alert sent to your device',
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
