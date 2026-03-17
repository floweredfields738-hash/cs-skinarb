import express, { Request, Response, NextFunction } from 'express';
import { query, queryOne, queryMany } from '../../utils/database';
import { authMiddleware } from '../../middleware/auth';
import { logger } from '../../utils/logging';

const router = express.Router();

// All watchlist routes require auth
router.use(authMiddleware);

// ─── Get user's watchlist with live prices ────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;

    // Get or create default watchlist
    let watchlist = await queryOne(
      'SELECT id FROM watchlists WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1',
      [userId]
    );

    if (!watchlist) {
      watchlist = await queryOne(
        `INSERT INTO watchlists (user_id, name, created_at, updated_at)
         VALUES ($1, 'My Watchlist', NOW(), NOW()) RETURNING id`,
        [userId]
      );
    }

    // Get all items with live prices
    const items = await queryMany(
      `SELECT wi.id, wi.skin_id, wi.target_price, wi.added_at,
              s.name, s.weapon_name, s.skin_name, s.rarity, s.min_float, s.max_float,
              (SELECT MIN(mp.price) FROM market_prices mp WHERE mp.skin_id = wi.skin_id AND mp.price > 0) as current_price,
              (SELECT COUNT(DISTINCT mp.market_id) FROM market_prices mp WHERE mp.skin_id = wi.skin_id AND mp.price > 0) as market_count
       FROM watchlist_items wi
       JOIN skins s ON s.id = wi.skin_id
       WHERE wi.watchlist_id = $1
       ORDER BY wi.added_at DESC`,
      [watchlist.id]
    );

    res.json({
      success: true,
      watchlistId: watchlist.id,
      items: items.map((i: any) => ({
        ...i,
        current_price: i.current_price ? parseFloat(i.current_price) : null,
        target_price: i.target_price ? parseFloat(i.target_price) : null,
        min_float: i.min_float ? parseFloat(i.min_float) : 0,
        max_float: i.max_float ? parseFloat(i.max_float) : 1,
        hit_target: i.target_price && i.current_price && parseFloat(i.current_price) <= parseFloat(i.target_price),
      })),
    });
  } catch (error) {
    next(error);
  }
});

// ─── Add skin to watchlist ────────────────────────────
router.post('/add', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { skinId, targetPrice } = req.body;

    if (!skinId) {
      return res.status(400).json({ success: false, error: 'skinId is required' });
    }

    // Verify skin exists
    const skin = await queryOne('SELECT id, name FROM skins WHERE id = $1', [skinId]);
    if (!skin) {
      return res.status(404).json({ success: false, error: 'Skin not found' });
    }

    // Get or create default watchlist
    let watchlist = await queryOne(
      'SELECT id FROM watchlists WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1',
      [userId]
    );

    if (!watchlist) {
      watchlist = await queryOne(
        `INSERT INTO watchlists (user_id, name, created_at, updated_at)
         VALUES ($1, 'My Watchlist', NOW(), NOW()) RETURNING id`,
        [userId]
      );
    }

    // Check if already in watchlist
    const existing = await queryOne(
      'SELECT id FROM watchlist_items WHERE watchlist_id = $1 AND skin_id = $2',
      [watchlist.id, skinId]
    );

    if (existing) {
      // Update target price if provided
      if (targetPrice !== undefined) {
        await query(
          'UPDATE watchlist_items SET target_price = $1 WHERE id = $2',
          [targetPrice || null, existing.id]
        );
      }
      return res.json({ success: true, message: 'Already in watchlist', updated: !!targetPrice });
    }

    // Add to watchlist
    await query(
      `INSERT INTO watchlist_items (watchlist_id, skin_id, target_price, added_at)
       VALUES ($1, $2, $3, NOW())`,
      [watchlist.id, skinId, targetPrice || null]
    );

    logger.info(`User ${userId} added skin ${skin.name} to watchlist`);

    res.json({ success: true, message: `${skin.name} added to watchlist` });
  } catch (error) {
    next(error);
  }
});

// ─── Remove skin from watchlist ───────────────────────
router.delete('/remove/:skinId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { skinId } = req.params;

    const watchlist = await queryOne(
      'SELECT id FROM watchlists WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1',
      [userId]
    );

    if (!watchlist) {
      return res.status(404).json({ success: false, error: 'No watchlist found' });
    }

    const result = await query(
      'DELETE FROM watchlist_items WHERE watchlist_id = $1 AND skin_id = $2',
      [watchlist.id, skinId]
    );

    res.json({
      success: true,
      removed: (result.rowCount || 0) > 0,
    });
  } catch (error) {
    next(error);
  }
});

// ─── Check if skin is in watchlist ────────────────────
router.get('/check/:skinId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { skinId } = req.params;

    const watchlist = await queryOne(
      'SELECT id FROM watchlists WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1',
      [userId]
    );

    if (!watchlist) {
      return res.json({ success: true, inWatchlist: false });
    }

    const item = await queryOne(
      'SELECT id, target_price FROM watchlist_items WHERE watchlist_id = $1 AND skin_id = $2',
      [watchlist.id, skinId]
    );

    res.json({
      success: true,
      inWatchlist: !!item,
      targetPrice: item?.target_price ? parseFloat(item.target_price) : null,
    });
  } catch (error) {
    next(error);
  }
});

// ─── Update target price ─────────────────────────────
router.put('/target/:skinId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { skinId } = req.params;
    const { targetPrice } = req.body;

    const watchlist = await queryOne(
      'SELECT id FROM watchlists WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1',
      [userId]
    );

    if (!watchlist) {
      return res.status(404).json({ success: false, error: 'No watchlist found' });
    }

    await query(
      'UPDATE watchlist_items SET target_price = $1 WHERE watchlist_id = $2 AND skin_id = $3',
      [targetPrice || null, watchlist.id, skinId]
    );

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
