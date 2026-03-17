import express, { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { query, queryOne, queryMany } from '../../utils/database';
import { authMiddleware } from '../../middleware/auth';
import { logger } from '../../utils/logging';
import { cacheGet, cacheSet } from '../../utils/cache';

const router = express.Router();

// All portfolio routes require auth
router.use(authMiddleware);

// ─── Get portfolio with holdings and P&L ─────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;

    // Get or create portfolio
    let portfolio = await queryOne(
      'SELECT id FROM portfolios WHERE user_id = $1',
      [userId]
    );

    if (!portfolio) {
      portfolio = await queryOne(
        `INSERT INTO portfolios (user_id, total_value, total_invested, total_profit, profit_percentage, total_items, created_at)
         VALUES ($1, 0, 0, 0, 0, 0, NOW()) RETURNING id`,
        [userId]
      );
    }

    // Get all holdings with live market prices
    const items = await queryMany(
      `SELECT pi.id, pi.skin_id, pi.quantity, pi.purchase_price, pi.condition, pi.float_value,
              pi.purchase_date, pi.notes, pi.created_at,
              s.name, s.weapon_name, s.skin_name, s.rarity, s.min_float, s.max_float,
              (SELECT MIN(mp.price) FROM market_prices mp WHERE mp.skin_id = pi.skin_id AND mp.price > 0) as market_price
       FROM portfolio_items pi
       JOIN skins s ON s.id = pi.skin_id
       WHERE pi.portfolio_id = $1
       ORDER BY pi.created_at DESC`,
      [portfolio.id]
    );

    // Calculate P&L for each item
    const holdings = items.map((i: any) => {
      const purchasePrice = parseFloat(i.purchase_price) || 0;
      const marketPrice = i.market_price ? parseFloat(i.market_price) : null;
      const quantity = i.quantity || 1;
      const totalCost = purchasePrice * quantity;
      const totalValue = marketPrice ? marketPrice * quantity : null;
      const profitLoss = totalValue !== null ? totalValue - totalCost : null;
      const profitPercent = totalCost > 0 && profitLoss !== null ? (profitLoss / totalCost) * 100 : null;

      return {
        id: i.id,
        skin_id: i.skin_id,
        name: i.name,
        weapon_name: i.weapon_name,
        skin_name: i.skin_name,
        rarity: i.rarity,
        quantity,
        purchase_price: purchasePrice,
        market_price: marketPrice,
        total_cost: Math.round(totalCost * 100) / 100,
        total_value: totalValue !== null ? Math.round(totalValue * 100) / 100 : null,
        profit_loss: profitLoss !== null ? Math.round(profitLoss * 100) / 100 : null,
        profit_percent: profitPercent !== null ? Math.round(profitPercent * 100) / 100 : null,
        condition: i.condition,
        float_value: i.float_value ? parseFloat(i.float_value) : null,
        min_float: i.min_float ? parseFloat(i.min_float) : 0,
        max_float: i.max_float ? parseFloat(i.max_float) : 1,
        purchase_date: i.purchase_date,
        notes: i.notes,
        added_at: i.created_at,
      };
    });

    // Summary stats
    const totalInvested = holdings.reduce((sum: number, h: any) => sum + h.total_cost, 0);
    const totalValue = holdings.reduce((sum: number, h: any) => sum + (h.total_value || h.total_cost), 0);
    const totalPL = totalValue - totalInvested;
    const totalPLPercent = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;

    res.json({
      success: true,
      portfolio: {
        id: portfolio.id,
        totalInvested: Math.round(totalInvested * 100) / 100,
        totalValue: Math.round(totalValue * 100) / 100,
        profitLoss: Math.round(totalPL * 100) / 100,
        profitPercent: Math.round(totalPLPercent * 100) / 100,
        itemCount: holdings.length,
      },
      holdings,
    });
  } catch (error) {
    next(error);
  }
});

// ─── Add item to portfolio ───────────────────────────
router.post('/add', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { skinId, purchasePrice, quantity, condition, notes } = req.body;

    if (!skinId || !purchasePrice) {
      return res.status(400).json({ success: false, error: 'skinId and purchasePrice are required' });
    }

    // Verify skin exists
    const skin = await queryOne('SELECT id, name FROM skins WHERE id = $1', [skinId]);
    if (!skin) {
      return res.status(404).json({ success: false, error: 'Skin not found' });
    }

    // Get or create portfolio
    let portfolio = await queryOne('SELECT id FROM portfolios WHERE user_id = $1', [userId]);
    if (!portfolio) {
      portfolio = await queryOne(
        `INSERT INTO portfolios (user_id, total_value, total_invested, total_profit, profit_percentage, total_items, created_at)
         VALUES ($1, 0, 0, 0, 0, 0, NOW()) RETURNING id`,
        [userId]
      );
    }

    // Add item
    const item = await queryOne(
      `INSERT INTO portfolio_items (portfolio_id, skin_id, quantity, purchase_price, condition, notes, purchase_date, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING id`,
      [portfolio.id, skinId, quantity || 1, purchasePrice, condition || null, notes || null]
    );

    logger.info(`User ${userId} added ${skin.name} to portfolio at $${purchasePrice}`);

    res.json({ success: true, message: `${skin.name} added to portfolio`, itemId: item?.id });
  } catch (error) {
    next(error);
  }
});

// ─── Remove item from portfolio ──────────────────────
router.delete('/remove/:itemId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { itemId } = req.params;

    const portfolio = await queryOne('SELECT id FROM portfolios WHERE user_id = $1', [userId]);
    if (!portfolio) {
      return res.status(404).json({ success: false, error: 'Portfolio not found' });
    }

    const result = await query(
      'DELETE FROM portfolio_items WHERE id = $1 AND portfolio_id = $2',
      [itemId, portfolio.id]
    );

    res.json({ success: true, removed: (result.rowCount || 0) > 0 });
  } catch (error) {
    next(error);
  }
});

// ─── Update item (quantity, notes) ───────────────────
router.put('/update/:itemId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { itemId } = req.params;
    const { quantity, purchasePrice, notes } = req.body;

    const portfolio = await queryOne('SELECT id FROM portfolios WHERE user_id = $1', [userId]);
    if (!portfolio) {
      return res.status(404).json({ success: false, error: 'Portfolio not found' });
    }

    const updates: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    if (quantity !== undefined) { updates.push(`quantity = $${paramCount++}`); params.push(quantity); }
    if (purchasePrice !== undefined) { updates.push(`purchase_price = $${paramCount++}`); params.push(purchasePrice); }
    if (notes !== undefined) { updates.push(`notes = $${paramCount++}`); params.push(notes); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    params.push(itemId, portfolio.id);
    await query(
      `UPDATE portfolio_items SET ${updates.join(', ')}, last_updated = NOW()
       WHERE id = $${paramCount++} AND portfolio_id = $${paramCount}`,
      params
    );

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ─── Fetch Steam inventory for logged-in user ───────
router.get('/inventory', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;

    // Get user's Steam ID
    const user = await queryOne('SELECT steam_id FROM users WHERE id = $1', [userId]);
    if (!user?.steam_id) {
      return res.status(400).json({ success: false, error: 'No Steam account linked' });
    }

    // Fetch CS2 inventory from Steam (app 730, context 2)
    logger.info(`Fetching inventory for Steam ID: "${user.steam_id}"`);
    const steamUrl = `https://steamcommunity.com/inventory/${user.steam_id}/730/2?l=english&count=500`;
    logger.info(`Steam URL: ${steamUrl}`);
    const response = await axios.get(steamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 15000,
    });

    const data = response.data;
    if (!data || !data.success) {
      return res.json({
        success: false,
        error: 'Inventory is private or empty. Set your Steam inventory to public in Steam privacy settings.',
      });
    }

    // Parse inventory items
    const descriptions = data.descriptions || [];
    const assets = data.assets || [];

    // Build asset count map (some items stack)
    const assetCounts: Record<string, number> = {};
    for (const asset of assets) {
      const key = `${asset.classid}_${asset.instanceid}`;
      assetCounts[key] = (assetCounts[key] || 0) + 1;
    }

    // Map descriptions to items with counts and prices
    const items = [];
    const seen = new Set<string>();

    for (const desc of descriptions) {
      const key = `${desc.classid}_${desc.instanceid}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const name = desc.market_hash_name || desc.name || '';
      const count = assetCounts[key] || 1;

      // Skip non-tradeable items
      if (desc.tradable === 0 && desc.marketable === 0) continue;

      // Get rarity from tags
      const rarityTag = desc.tags?.find((t: any) => t.category === 'Rarity');
      const exteriorTag = desc.tags?.find((t: any) => t.category === 'Exterior');
      const typeTag = desc.tags?.find((t: any) => t.category === 'Type');
      const weaponTag = desc.tags?.find((t: any) => t.category === 'Weapon');

      // Get the exterior from the full name or tags
      const exterior = exteriorTag?.localized_tag_name || null;
      const baseName = name.replace(/\s*\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)\s*$/i, '').trim();

      // Find prices from ALL markets
      // Match by exact matched_name (full Skinport name) when possible,
      // otherwise match by base name + exterior
      // Always filter: if user's item is NOT souvenir, exclude souvenir prices
      const isSouvenir = name.toLowerCase().includes('souvenir');

      // Try exact match on matched_name first (e.g. "MP9 | Orange Peel (Field-Tested)")
      let priceResults = await queryMany(
        `SELECT mp.price, m.name as market_name, m.display_name, mp.exterior, mp.matched_name
         FROM market_prices mp
         JOIN skins s ON s.id = mp.skin_id
         JOIN markets m ON m.id = mp.market_id
         WHERE mp.matched_name = $1 AND mp.price > 0
         ORDER BY mp.price ASC`,
        [name]
      );

      // Fallback: match by base name + exterior
      if (priceResults.length === 0) {
        priceResults = await queryMany(
          `SELECT mp.price, m.name as market_name, m.display_name, mp.exterior, mp.matched_name
           FROM market_prices mp
           JOIN skins s ON s.id = mp.skin_id
           JOIN markets m ON m.id = mp.market_id
           WHERE s.name = $1 AND mp.price > 0
             AND ($2::text IS NULL OR mp.exterior = $2)
           ORDER BY mp.price ASC`,
          [baseName, exterior]
        );

        // Filter out souvenir/non-souvenir mismatches in JS (simpler than SQL)
        if (!isSouvenir) {
          priceResults = priceResults.filter((r: any) =>
            !r.matched_name || !r.matched_name.toLowerCase().includes('souvenir')
          );
        }
      }

      // Cheapest price across all markets = main price
      const cheapestPrice = priceResults.length > 0 ? parseFloat(priceResults[0].price) : null;

      // Build per-market price list
      const marketPrices = priceResults.map((r: any) => ({
        market: r.display_name || r.market_name,
        price: parseFloat(r.price),
        exterior: r.exterior,
      }));

      items.push({
        name,
        market_hash_name: name,
        icon_url: desc.icon_url ? `https://community.cloudflare.steamstatic.com/economy/image/${desc.icon_url}` : null,
        rarity: rarityTag?.localized_tag_name || null,
        exterior,
        type: typeTag?.localized_tag_name || null,
        weapon: weaponTag?.localized_tag_name || null,
        tradable: desc.tradable === 1,
        marketable: desc.marketable === 1,
        quantity: count,
        market_price: cheapestPrice,
        market_prices: marketPrices,
        total_value: cheapestPrice ? Math.round(cheapestPrice * count * 100) / 100 : null,
        name_color: desc.name_color || null,
      });
    }

    // Sort by value (highest first)
    items.sort((a, b) => (b.total_value || 0) - (a.total_value || 0));

    // Calculate totals
    const totalValue = items.reduce((sum, i) => sum + (i.total_value || 0), 0);
    const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
    const tradableItems = items.filter(i => i.tradable).length;

    res.json({
      success: true,
      inventory: {
        steam_id: user.steam_id,
        total_items: totalItems,
        unique_items: items.length,
        tradable_items: tradableItems,
        total_value: Math.round(totalValue * 100) / 100,
        items,
      },
    });
  } catch (error: any) {
    if (error.response?.status === 403) {
      return res.json({
        success: false,
        error: 'Inventory is private. Set your Steam inventory to public.',
      });
    }
    if (error.response?.status === 429) {
      return res.json({
        success: false,
        error: 'Steam rate limited. Try again in a minute.',
      });
    }
    logger.error('Inventory fetch error:', error.message, error.response?.status);
    return res.status(500).json({
      success: false,
      error: `Failed to fetch inventory: ${error.message}`,
    });
  }
});

export default router;
