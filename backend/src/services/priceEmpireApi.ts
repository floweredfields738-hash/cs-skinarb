import axios from 'axios';
import { query, queryOne, queryMany } from '../utils/database';
import { broadcastMarketUpdate } from '../utils/websocket';
import { logger } from '../utils/logging';

// PriceEmpire API — https://pricempire.com/api
// Provides prices from 30+ markets in a single API call
const PRICEMPIRE_BASE = 'https://api.pricempire.com/v3';
const PRICEMPIRE_API_KEY = process.env.PRICEMPIRE_API_KEY || '';

// Market name mapping: PriceEmpire source names → our market IDs
const MARKET_MAP: Record<string, { id: number; displayName: string }> = {
  'steam': { id: 1, displayName: 'Steam Community Market' },
  'buff163': { id: 2, displayName: 'Buff163' },
  'skinport': { id: 3, displayName: 'Skinport' },
  'csfloat': { id: 4, displayName: 'CSFloat' },
  // Additional markets PriceEmpire supports:
  'dmarket': { id: 5, displayName: 'DMarket' },
  'waxpeer': { id: 6, displayName: 'Waxpeer' },
  'bitskins': { id: 7, displayName: 'BitSkins' },
  'tradeit': { id: 8, displayName: 'Tradeit.gg' },
  'lootfarm': { id: 9, displayName: 'LootFarm' },
  'csdeals': { id: 10, displayName: 'CS.Deals' },
};

// Sources we want prices from (PriceEmpire parameter)
const PRICE_SOURCES = ['steam', 'buff163', 'skinport', 'csfloat'];

// ─── Ensure extra markets exist in DB ────────────────
async function ensureMarketsExist(): Promise<void> {
  for (const [source, info] of Object.entries(MARKET_MAP)) {
    if (info.id <= 4) continue; // Markets 1-4 already seeded
    await query(
      `INSERT INTO markets (id, name, display_name, fee_percentage, is_active)
       VALUES ($1, $2, $3, $4, TRUE)
       ON CONFLICT (id) DO NOTHING`,
      [info.id, source, info.displayName, 5.0]
    );
  }
}

// ─── Fetch all item prices from PriceEmpire ──────────
export async function fetchPriceEmpirePrices(): Promise<Map<string, Record<string, number>>> {
  // Returns: Map<skinName, { steam: price, buff163: price, skinport: price, ... }>
  const priceMap = new Map<string, Record<string, number>>();

  if (!PRICEMPIRE_API_KEY) {
    logger.warn('PriceEmpire: no API key configured');
    return priceMap;
  }

  try {
    // PriceEmpire v3 endpoint — gets all CS2 item prices
    const response = await axios.get(`${PRICEMPIRE_BASE}/items/prices`, {
      params: {
        api_key: PRICEMPIRE_API_KEY,
        currency: 'USD',
        appId: 730,
        sources: PRICE_SOURCES.join(','),
      },
      timeout: 30000,
    });

    const data = response.data;

    // PriceEmpire v3 returns: { [market_hash_name]: { steam: { price: X }, buff163: { price: Y }, ... } }
    // Or alternatively: array of items with prices per source
    if (data && typeof data === 'object') {
      // Handle object format: { "AK-47 | Redline (Field-Tested)": { steam: { price: 1200 }, buff163: { price: 980 } } }
      if (!Array.isArray(data)) {
        for (const [itemName, sources] of Object.entries(data)) {
          if (typeof sources !== 'object' || !sources) continue;
          const prices: Record<string, number> = {};

          for (const [source, priceData] of Object.entries(sources as Record<string, any>)) {
            const price = typeof priceData === 'number'
              ? priceData
              : priceData?.price || priceData?.min_price || priceData?.avg || 0;

            // PriceEmpire often returns prices in cents — check magnitude
            const normalizedPrice = price > 10000 ? price / 100 : price;
            if (normalizedPrice > 0) {
              prices[source.toLowerCase()] = Math.round(normalizedPrice * 100) / 100;
            }
          }

          if (Object.keys(prices).length > 0) {
            priceMap.set(itemName, prices);
          }
        }
      }
      // Handle array format: [{ market_hash_name: "...", prices: { steam: 1200, buff163: 980 } }]
      else if (Array.isArray(data)) {
        for (const item of data) {
          const name = item.market_hash_name || item.name;
          if (!name) continue;

          const prices: Record<string, number> = {};
          const sourcePrices = item.prices || item;

          for (const source of PRICE_SOURCES) {
            const priceData = sourcePrices[source];
            const price = typeof priceData === 'number'
              ? priceData
              : priceData?.price || priceData?.min_price || priceData?.avg || 0;

            const normalizedPrice = price > 10000 ? price / 100 : price;
            if (normalizedPrice > 0) {
              prices[source] = Math.round(normalizedPrice * 100) / 100;
            }
          }

          if (Object.keys(prices).length > 0) {
            priceMap.set(name, prices);
          }
        }
      }
    }

    logger.info(`PriceEmpire: fetched prices for ${priceMap.size} items across ${PRICE_SOURCES.length} markets`);
  } catch (error: any) {
    if (error.response?.data?.message) {
      logger.error(`PriceEmpire API error: ${error.response.data.message}`);
    } else {
      logger.error(`PriceEmpire API error: ${error.message}`);
    }
  }

  return priceMap;
}

// ─── Sync all PriceEmpire prices to database ─────────
export async function syncPriceEmpirePrices(): Promise<{ updated: number; skipped: number; markets: number }> {
  const stats = { updated: 0, skipped: 0, markets: 0 };

  const priceMap = await fetchPriceEmpirePrices();
  if (priceMap.size === 0) {
    logger.warn('PriceEmpire: no prices fetched');
    return stats;
  }

  await ensureMarketsExist();

  const skins = await queryMany('SELECT id, name FROM skins ORDER BY id');
  const marketsUpdated = new Set<string>();

  for (const skin of skins) {
    // Try matching with exteriors (PriceEmpire uses full names like "AK-47 | Redline (Field-Tested)")
    let bestPrices: Record<string, number> | null = null;

    // 1. Exact match
    if (priceMap.has(skin.name)) {
      bestPrices = priceMap.get(skin.name)!;
    }

    // 2. Try with exteriors — pick the most common (Field-Tested)
    if (!bestPrices) {
      for (const ext of ['Field-Tested', 'Minimal Wear', 'Factory New', 'Well-Worn', 'Battle-Scarred']) {
        const nameWithExt = `${skin.name} (${ext})`;
        if (priceMap.has(nameWithExt)) {
          bestPrices = priceMap.get(nameWithExt)!;
          break;
        }
      }
    }

    // 3. Try with ★ prefix for knives/gloves
    if (!bestPrices) {
      for (const ext of ['Factory New', 'Minimal Wear', 'Field-Tested', 'Well-Worn', 'Battle-Scarred']) {
        const starName = `★ ${skin.name} (${ext})`;
        if (priceMap.has(starName)) {
          bestPrices = priceMap.get(starName)!;
          break;
        }
      }
      if (!bestPrices && priceMap.has(`★ ${skin.name}`)) {
        bestPrices = priceMap.get(`★ ${skin.name}`)!;
      }
    }

    if (!bestPrices || Object.keys(bestPrices).length === 0) {
      stats.skipped++;
      continue;
    }

    // Update prices for each market source
    for (const [source, price] of Object.entries(bestPrices)) {
      const marketInfo = MARKET_MAP[source];
      if (!marketInfo || price <= 0) continue;

      const existing = await queryOne(
        'SELECT price FROM market_prices WHERE skin_id = $1 AND market_id = $2',
        [skin.id, marketInfo.id]
      );

      const oldPrice = existing ? parseFloat(existing.price) : 0;
      const change = Math.round((price - oldPrice) * 100) / 100;
      const changePercent = oldPrice > 0 ? Math.round((change / oldPrice) * 100 * 100) / 100 : 0;

      if (existing) {
        await query(
          'UPDATE market_prices SET price = $1, volume = 0, last_updated = NOW() WHERE skin_id = $2 AND market_id = $3',
          [price, skin.id, marketInfo.id]
        );
      } else {
        await query(
          'INSERT INTO market_prices (skin_id, market_id, price, volume, last_updated) VALUES ($1, $2, $3, 0, NOW())',
          [skin.id, marketInfo.id, price]
        );
      }

      broadcastMarketUpdate({
        type: 'price_update',
        data: {
          skinId: skin.id, skinName: skin.name,
          marketId: marketInfo.id, marketName: marketInfo.displayName,
          oldPrice, newPrice: price,
          change, changePercent,
          volume: 0,
          timestamp: new Date().toISOString(),
        },
      });

      marketsUpdated.add(source);
      stats.updated++;
    }
  }

  stats.markets = marketsUpdated.size;
  logger.info(`PriceEmpire sync: ${stats.updated} prices updated across ${stats.markets} markets, ${stats.skipped} skins skipped`);
  return stats;
}
