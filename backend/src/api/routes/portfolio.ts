import express, { Request, Response, NextFunction } from 'express';
import { query } from '../../utils/database';
import { authMiddleware } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logging';

const router = express.Router();

// Get user portfolio
router.get('/', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;

    // Get portfolio
    const portfolioResult = await query(
      `SELECT id, user_id, total_value, created_at, updated_at
       FROM portfolios WHERE user_id = $1`,
      [userId]
    );

    if (!portfolioResult.rows.length) {
      return next(
        new AppError('Portfolio not found. Import inventory first.', 404, 'PORTFOLIO_NOT_FOUND')
      );
    }

    const portfolio = portfolioResult.rows[0];

    // Get portfolio items (skins in inventory)
    const itemsResult = await query(
      `SELECT pi.id, pi.skin_id, s.name, s.image_url, s.rarity, 
              pi.quantity, pi.purchase_price, pi.current_price,
              pi.added_at, pi.updated_at,
              ROUND(((s.current_price - pi.purchase_price) / pi.purchase_price * 100)::numeric, 2) as profit_loss_percent
       FROM portfolio_items pi
       JOIN skins s ON pi.skin_id = s.id
       WHERE pi.portfolio_id = $1
       ORDER BY pi.current_price DESC`,
      [portfolio.id]
    );

    // Calculate portfolio stats
    const statsResult = await query(
      `SELECT 
         COUNT(*) as total_items,
         SUM(quantity) as total_quantity,
         ROUND(SUM(purchase_price * quantity)::numeric, 2) as total_cost,
         ROUND(SUM(current_price)::numeric, 2) as total_current_value,
         ROUND((SUM(current_price) - SUM(purchase_price * quantity))::numeric, 2) as total_profit_loss
       FROM portfolio_items
       WHERE portfolio_id = $1`,
      [portfolio.id]
    );

    const stats = statsResult.rows[0];

    res.json({
      success: true,
      data: {
        portfolio,
        items: itemsResult.rows,
        stats: {
          ...stats,
          profitLossPercent: parseFloat(
            (
              ((stats.total_current_value - stats.total_cost) / stats.total_cost) *
              100
            ).toFixed(2)
          ),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get portfolio performance over time
router.get(
  '/performance/:period',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;
      const period = (req.params.period as string) || '7d'; // 7d, 30d, 90d, 1y

      let intervalDays = 7;
      if (period === '30d') intervalDays = 30;
      else if (period === '90d') intervalDays = 90;
      else if (period === '1y') intervalDays = 365;

      const portfolioResult = await query(
        'SELECT id FROM portfolios WHERE user_id = $1',
        [userId]
      );

      if (!portfolioResult.rows.length) {
        return next(new AppError('Portfolio not found', 404, 'PORTFOLIO_NOT_FOUND'));
      }

      const portfolioId = portfolioResult.rows[0].id;

      // Get performance data from database
      const performanceResult = await query(
        `SELECT 
           DATE(timestamp) as date,
           ROUND(SUM(current_price)::numeric, 2) as portfolio_value,
           ROUND(SUM(current_price) - SUM(cost)::numeric, 2) as profit_loss
         FROM portfolio_snapshots
         WHERE portfolio_id = $1
         AND timestamp >= NOW() - INTERVAL '${intervalDays} days'
         GROUP BY DATE(timestamp)
         ORDER BY date ASC`,
        [portfolioId]
      );

      res.json({
        success: true,
        data: {
          period,
          performance: performanceResult.rows,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get portfolio item details
router.get(
  '/items/:skinId',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;
      const { skinId } = req.params;

      const portfolioResult = await query(
        'SELECT id FROM portfolios WHERE user_id = $1',
        [userId]
      );

      if (!portfolioResult.rows.length) {
        return next(new AppError('Portfolio not found', 404, 'PORTFOLIO_NOT_FOUND'));
      }

      const portfolioId = portfolioResult.rows[0].id;

      const itemResult = await query(
        `SELECT pi.id, pi.skin_id, s.name, s.image_url, s.rarity, s.current_price,
                pi.quantity, pi.purchase_price, pi.current_price, pi.added_at,
                ROUND(((s.current_price - pi.purchase_price) / pi.purchase_price * 100)::numeric, 2) as profit_loss_percent
         FROM portfolio_items pi
         JOIN skins s ON pi.skin_id = s.id
         WHERE pi.portfolio_id = $1 AND pi.skin_id = $2`,
        [portfolioId, skinId]
      );

      if (!itemResult.rows.length) {
        return next(new AppError('Portfolio item not found', 404, 'ITEM_NOT_FOUND'));
      }

      // Get price history for this item
      const historyResult = await query(
        `SELECT price, timestamp FROM price_history
         WHERE skin_id = $1
         AND timestamp >= NOW() - INTERVAL '30 days'
         ORDER BY timestamp ASC`,
        [skinId]
      );

      res.json({
        success: true,
        data: {
          item: itemResult.rows[0],
          priceHistory: historyResult.rows,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Import Steam inventory to portfolio
router.post(
  '/import-inventory',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;
      const { steamInventoryItems } = req.body; // Expects array of {skinId, quantity, price}

      if (!steamInventoryItems || !Array.isArray(steamInventoryItems)) {
        return next(
          new AppError('Invalid inventory items format', 400, 'INVALID_FORMAT')
        );
      }

      // Get or create portfolio
      let portfolioResult = await query(
        'SELECT id FROM portfolios WHERE user_id = $1',
        [userId]
      );

      let portfolioId;
      if (portfolioResult.rows.length) {
        portfolioId = portfolioResult.rows[0].id;
        // Clear existing items
        await query('DELETE FROM portfolio_items WHERE portfolio_id = $1', [portfolioId]);
      } else {
        // Create new portfolio
        const createResult = await query(
          `INSERT INTO portfolios (user_id, total_value, created_at, updated_at)
           VALUES ($1, 0, NOW(), NOW())
           RETURNING id`,
          [userId]
        );
        portfolioId = createResult.rows[0].id;
      }

      // Insert new items
      let totalValue = 0;
      for (const item of steamInventoryItems) {
        const { skinId, quantity, price } = item;

        await query(
          `INSERT INTO portfolio_items (portfolio_id, skin_id, quantity, purchase_price, current_price, added_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
          [portfolioId, skinId, quantity, price, quantity * price]
        );

        totalValue += quantity * price;
      }

      // Update portfolio total value
      await query(
        'UPDATE portfolios SET total_value = $1, updated_at = NOW() WHERE id = $2',
        [totalValue, portfolioId]
      );

      logger.info(`Portfolio imported for user ${userId} with ${steamInventoryItems.length} items`);

      res.json({
        success: true,
        message: `Imported ${steamInventoryItems.length} items`,
        data: {
          portfolioId,
          itemsImported: steamInventoryItems.length,
          totalValue: parseFloat(totalValue.toFixed(2)),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Add item to portfolio manually
router.post(
  '/items/add',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;
      const { skinId, quantity, price } = req.body;

      if (!skinId || !quantity || !price) {
        return next(
          new AppError('skinId, quantity, and price are required', 400, 'MISSING_FIELDS')
        );
      }

      // Get portfolio
      const portfolioResult = await query(
        'SELECT id FROM portfolios WHERE user_id = $1',
        [userId]
      );

      if (!portfolioResult.rows.length) {
        return next(new AppError('Portfolio not found', 404, 'PORTFOLIO_NOT_FOUND'));
      }

      const portfolioId = portfolioResult.rows[0].id;

      // Check if item exists
      const existingResult = await query(
        'SELECT id, quantity, purchase_price FROM portfolio_items WHERE portfolio_id = $1 AND skin_id = $2',
        [portfolioId, skinId]
      );

      if (existingResult.rows.length > 0) {
        // Update existing item
        const existing = existingResult.rows[0];
        const newQuantity = existing.quantity + quantity;
        const newAvgPrice =
          (existing.purchase_price * existing.quantity + price * quantity) / newQuantity;

        await query(
          `UPDATE portfolio_items 
           SET quantity = $1, purchase_price = $2, current_price = $3, updated_at = NOW()
           WHERE id = $4`,
          [newQuantity, newAvgPrice, newQuantity * newAvgPrice, existing.id]
        );
      } else {
        // Insert new item
        await query(
          `INSERT INTO portfolio_items (portfolio_id, skin_id, quantity, purchase_price, current_price, added_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
          [portfolioId, skinId, quantity, price, quantity * price]
        );
      }

      // Recalculate portfolio total
      const totalResult = await query(
        'SELECT SUM(current_price) as total FROM portfolio_items WHERE portfolio_id = $1',
        [portfolioId]
      );

      const total = totalResult.rows[0].total || 0;
      await query(
        'UPDATE portfolios SET total_value = $1, updated_at = NOW() WHERE id = $2',
        [total, portfolioId]
      );

      res.json({
        success: true,
        message: 'Item added to portfolio',
      });
    } catch (error) {
      next(error);
    }
  }
);

// Remove item from portfolio
router.delete(
  '/items/:itemId',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;
      const { itemId } = req.params;

      // Verify ownership
      const itemResult = await query(
        `SELECT pi.id, pi.portfolio_id FROM portfolio_items pi
         JOIN portfolios p ON pi.portfolio_id = p.id
         WHERE pi.id = $1 AND p.user_id = $2`,
        [itemId, userId]
      );

      if (!itemResult.rows.length) {
        return next(new AppError('Item not found', 404, 'ITEM_NOT_FOUND'));
      }

      const portfolioId = itemResult.rows[0].portfolio_id;

      // Delete item
      await query('DELETE FROM portfolio_items WHERE id = $1', [itemId]);

      // Recalculate portfolio total
      const totalResult = await query(
        'SELECT SUM(current_price) as total FROM portfolio_items WHERE portfolio_id = $1',
        [portfolioId]
      );

      const total = totalResult.rows[0].total || 0;
      await query(
        'UPDATE portfolios SET total_value = $1, updated_at = NOW() WHERE id = $2',
        [total, portfolioId]
      );

      res.json({
        success: true,
        message: 'Item removed from portfolio',
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get portfolio diversification analysis
router.get(
  '/analysis/diversification',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;

      const portfolioResult = await query(
        'SELECT id FROM portfolios WHERE user_id = $1',
        [userId]
      );

      if (!portfolioResult.rows.length) {
        return next(new AppError('Portfolio not found', 404, 'PORTFOLIO_NOT_FOUND'));
      }

      const portfolioId = portfolioResult.rows[0].id;

      const diversificationResult = await query(
        `SELECT s.rarity, COUNT(*) as count, ROUND(SUM(pi.current_price)::numeric, 2) as total_value
         FROM portfolio_items pi
         JOIN skins s ON pi.skin_id = s.id
         WHERE pi.portfolio_id = $1
         GROUP BY s.rarity
         ORDER BY total_value DESC`,
        [portfolioId]
      );

      res.json({
        success: true,
        data: diversificationResult.rows,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
