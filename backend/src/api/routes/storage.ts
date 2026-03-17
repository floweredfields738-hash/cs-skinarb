import express, { Request, Response, NextFunction } from 'express';
import { query, queryOne, queryMany } from '../../utils/database';
import { authMiddleware } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logging';
import { cacheGet, cacheSet } from '../../utils/cache';

const router = express.Router();
router.use(authMiddleware);

// Get all containers with items and values
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;

    const containers = await queryMany(
      'SELECT id, name, created_at FROM storage_containers WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    const result = [];
    for (const c of containers) {
      const items = await queryMany(
        `SELECT si.id, si.skin_id, si.custom_name, si.exterior, si.float_value, si.notes, si.added_at,
                s.name as skin_name, s.rarity, s.weapon_name,
                (SELECT MIN(mp.price) FROM market_prices mp WHERE mp.skin_id = si.skin_id AND mp.price > 0
                  AND ($1::text IS NULL OR mp.exterior = $1)) as market_price
         FROM storage_items si
         LEFT JOIN skins s ON s.id = si.skin_id
         WHERE si.container_id = $2
         ORDER BY si.added_at DESC`,
        [null, c.id]
      );

      const totalValue = items.reduce((sum: number, i: any) => sum + (parseFloat(i.market_price) || 0), 0);

      result.push({
        ...c,
        items: items.map((i: any) => ({
          ...i,
          market_price: i.market_price ? parseFloat(i.market_price) : null,
        })),
        itemCount: items.length,
        totalValue: Math.round(totalValue * 100) / 100,
      });
    }

    const grandTotal = result.reduce((sum, c) => sum + c.totalValue, 0);

    res.json({
      success: true,
      containers: result,
      totalContainers: result.length,
      totalItems: result.reduce((sum, c) => sum + c.itemCount, 0),
      grandTotal: Math.round(grandTotal * 100) / 100,
    });
  } catch (error) { next(error); }
});

// Create container
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { name } = req.body;
    if (!name) return next(new AppError('Container name required', 400));

    const result = await query(
      'INSERT INTO storage_containers (user_id, name) VALUES ($1, $2) RETURNING id, name, created_at',
      [userId, name]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) { next(error); }
});

// Delete container
router.delete('/:containerId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    await query('DELETE FROM storage_containers WHERE id = $1 AND user_id = $2', [req.params.containerId, userId]);
    res.json({ success: true });
  } catch (error) { next(error); }
});

// Add item to container
router.post('/:containerId/items', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { containerId } = req.params;
    const { skinId, customName, exterior, floatValue, notes } = req.body;

    // Verify container ownership
    const container = await queryOne(
      'SELECT id FROM storage_containers WHERE id = $1 AND user_id = $2', [containerId, userId]
    );
    if (!container) return next(new AppError('Container not found', 404));

    const result = await query(
      `INSERT INTO storage_items (container_id, skin_id, custom_name, exterior, float_value, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [containerId, skinId || null, customName || null, exterior || null, floatValue || null, notes || null]
    );
    res.json({ success: true, itemId: result.rows[0]?.id });
  } catch (error) { next(error); }
});

// Remove item from container
router.delete('/:containerId/items/:itemId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { containerId, itemId } = req.params;

    const container = await queryOne(
      'SELECT id FROM storage_containers WHERE id = $1 AND user_id = $2', [containerId, userId]
    );
    if (!container) return next(new AppError('Container not found', 404));

    await query('DELETE FROM storage_items WHERE id = $1 AND container_id = $2', [itemId, containerId]);
    res.json({ success: true });
  } catch (error) { next(error); }
});

// Rename container
router.put('/:containerId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { name } = req.body;
    await query(
      'UPDATE storage_containers SET name = $1 WHERE id = $2 AND user_id = $3',
      [name, req.params.containerId, userId]
    );
    res.json({ success: true });
  } catch (error) { next(error); }
});

export default router;
