import express, { Request, Response, NextFunction } from 'express';
import { query, queryMany } from '../../utils/database';
import { logger } from '../../utils/logging';
import { cacheGet, cacheSet } from '../../utils/cache';

const router = express.Router();

// Get active sponsored listings for a position
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const position = (req.query.position as string) || 'arbitrage';

    const result = await queryMany(
      `SELECT id, market_name, display_text, url, logo_url, position
       FROM sponsored_listings
       WHERE is_active = TRUE AND position = $1
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY RANDOM()
       LIMIT 3`,
      [position]
    );

    res.json({ success: true, data: result });
  } catch (error) { next(error); }
});

// Track click
router.post('/:id/click', async (req: Request, res: Response) => {
  try {
    await query('UPDATE sponsored_listings SET clicks = clicks + 1 WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch { res.json({ success: false }); }
});

export default router;
