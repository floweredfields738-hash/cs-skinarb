import axios from 'axios';
import { Pool } from 'pg';
import { createClient } from 'redis';

const db = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost/cs-skin-platform'
});

const redis = createClient({
  url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`
});

// Market configurations
const MARKETS = {
  steam: {
    name: 'Steam Community Market',
    url: 'https://steamcommunity.com/market/priceoverview',
    fee: 0.13,
    currency: 'USD'
  },
  buff163: {
    name: 'Buff163',
    url: 'https://buff.163.com/api/market/goods',
    fee: 0.05,
    currency: 'CNY'
  },
  skinport: {
    name: 'Skinport',
    url: 'https://api.skinport.com/v1/items',
    fee: 0.10,
    currency: 'EUR'
  },
  csfloat: {
    name: 'CSGOFloat',
    url: 'https://csgofloat.com/api/v1/listings',
    fee: 0.03,
    currency: 'USD'
  }
};

interface MarketPrice {
  skinId: string;
  marketId: string;
  price: number;
  volume: number;
  quantity: number;
  timestamp: Date;
}

/**
 * Fetch prices from Steam Community Market
 */
async function fetchSteamPrices(): Promise<MarketPrice[]> {
  try {
    console.log('[STEAM] Fetching prices...');
    const prices: MarketPrice[] = [];

    // Get all skins from database
    const result = await db.query('SELECT id, steam_market_name FROM skins');
    const skins = result.rows;

    for (const skin of skins) {
      try {
        const response = await axios.get(MARKETS.steam.url, {
          params: {
            appid: 730, // CSGO app ID
            market_hash_name: skin.steam_market_name
          },
          timeout: 5000
        });

        if (response.data && response.data.success) {
          prices.push({
            skinId: skin.id,
            marketId: 'steam',
            price: parseFloat(response.data.lowest_price || 0),
            volume: response.data.volume ? parseInt(response.data.volume.replace(',', '')) : 0,
            quantity: response.data.volume ? parseInt(response.data.volume.replace(',', '')) : 0,
            timestamp: new Date()
          });
        }
      } catch (err) {
        console.error(`[STEAM] Error fetching ${skin.steam_market_name}:`, err);
      }

      // Rate limiting - Steam API is strict
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`[STEAM] Fetched ${prices.length} prices`);
    return prices;
  } catch (err) {
    console.error('[STEAM] Fatal error:', err);
    return [];
  }
}

/**
 * Fetch prices from Buff163 (China market)
 */
async function fetchBuff163Prices(): Promise<MarketPrice[]> {
  try {
    console.log('[BUFF163] Fetching prices...');
    const prices: MarketPrice[] = [];

    try {
      const response = await axios.get(MARKETS.buff163.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });

      if (response.data && response.data.data) {
        const goods = response.data.data.items || [];

        for (const good of goods) {
          // Map Buff163 items to skins
          const skinResult = await db.query(
            'SELECT id FROM skins WHERE name ILIKE $1 LIMIT 1',
            [`%${good.name}%`]
          );

          if (skinResult.rows.length > 0) {
            prices.push({
              skinId: skinResult.rows[0].id,
              marketId: 'buff163',
              price: good.price || 0,
              volume: good.buy_num || 0,
              quantity: good.all_count || 0,
              timestamp: new Date()
            });
          }
        }
      }
    } catch (err) {
      console.error('[BUFF163] Error:', err);
    }

    console.log(`[BUFF163] Fetched ${prices.length} prices`);
    return prices;
  } catch (err) {
    console.error('[BUFF163] Fatal error:', err);
    return [];
  }
}

/**
 * Fetch prices from Skinport
 */
async function fetchSkinportPrices(): Promise<MarketPrice[]> {
  try {
    console.log('[SKINPORT] Fetching prices...');
    const prices: MarketPrice[] = [];

    try {
      const response = await axios.get(MARKETS.skinport.url, {
        timeout: 10000
      });

      if (response.data && Array.isArray(response.data)) {
        for (const item of response.data) {
          // Map Skinport items to skins
          const skinResult = await db.query(
            'SELECT id FROM skins WHERE name ILIKE $1 LIMIT 1',
            [`%${item.name}%`]
          );

          if (skinResult.rows.length > 0) {
            prices.push({
              skinId: skinResult.rows[0].id,
              marketId: 'skinport',
              price: item.min_price || 0,
              volume: item.sales_24_hours || 0,
              quantity: item.in_stock || 0,
              timestamp: new Date()
            });
          }
        }
      }
    } catch (err) {
      console.error('[SKINPORT] Error:', err);
    }

    console.log(`[SKINPORT] Fetched ${prices.length} prices`);
    return prices;
  } catch (err) {
    console.error('[SKINPORT] Fatal error:', err);
    return [];
  }
}

/**
 * Fetch prices from CSGOFloat
 */
async function fetchCSFloatPrices(): Promise<MarketPrice[]> {
  try {
    console.log('[CSFLOAT] Fetching prices...');
    const prices: MarketPrice[] = [];

    try {
      const response = await axios.get(MARKETS.csfloat.url, {
        timeout: 10000
      });

      if (response.data && Array.isArray(response.data)) {
        for (const listing of response.data) {
          // Map CSGOFloat items to skins
          const skinResult = await db.query(
            'SELECT id FROM skins WHERE name ILIKE $1 LIMIT 1',
            [`%${listing.item}%`]
          );

          if (skinResult.rows.length > 0) {
            prices.push({
              skinId: skinResult.rows[0].id,
              marketId: 'csfloat',
              price: listing.price || 0,
              volume: listing.count || 0,
              quantity: listing.listing_count || 0,
              timestamp: new Date()
            });
          }
        }
      }
    } catch (err) {
      console.error('[CSFLOAT] Error:', err);
    }

    console.log(`[CSFLOAT] Fetched ${prices.length} prices`);
    return prices;
  } catch (err) {
    console.error('[CSFLOAT] Fatal error:', err);
    return [];
  }
}

/**
 * Store market prices in database
 */
async function storeMarketPrices(prices: MarketPrice[]): Promise<void> {
  if (prices.length === 0) return;

  try {
    const query = `
      INSERT INTO market_prices (skin_id, market_id, price, volume, quantity, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (skin_id, market_id) DO UPDATE SET
        price = EXCLUDED.price,
        volume = EXCLUDED.volume,
        quantity = EXCLUDED.quantity,
        timestamp = EXCLUDED.timestamp
    `;

    for (const price of prices) {
      await db.query(query, [
        price.skinId,
        price.marketId,
        price.price,
        price.volume,
        price.quantity,
        price.timestamp
      ]);
    }

    console.log(`[DB] Stored ${prices.length} market prices`);
  } catch (err) {
    console.error('[DB] Error storing prices:', err);
  }
}

/**
 * Update market summary statistics (7-day and 30-day volumes)
 */
async function updateMarketStatistics(): Promise<void> {
  try {
    console.log('[STATS] Updating market statistics...');

    const query = `
      UPDATE skins SET
        volume_7d = (
          SELECT SUM(volume) FROM market_prices
          WHERE skin_id = skins.id
          AND timestamp >= NOW() - INTERVAL '7 days'
        ),
        volume_30d = (
          SELECT SUM(volume) FROM market_prices
          WHERE skin_id = skins.id
          AND timestamp >= NOW() - INTERVAL '30 days'
        ),
        current_price = (
          SELECT AVG(price) FROM market_prices
          WHERE skin_id = skins.id
          AND timestamp >= NOW() - INTERVAL '1 hour'
        ),
        last_updated = NOW()
      WHERE id IN (
        SELECT DISTINCT skin_id FROM market_prices
        WHERE timestamp >= NOW() - INTERVAL '1 hour'
      )
    `;

    await db.query(query);
    console.log('[STATS] Market statistics updated');
  } catch (err) {
    console.error('[STATS] Error updating statistics:', err);
  }
}

/**
 * Calculate price history and trends
 */
async function calculatePriceTrends(): Promise<void> {
  try {
    console.log('[TRENDS] Calculating price trends...');

    const query = `
      WITH price_data AS (
        SELECT 
          skin_id,
          AVG(price) as current_price,
          LAG(AVG(price)) OVER (PARTITION BY skin_id ORDER BY DATE(timestamp)) as prev_price
        FROM market_prices
        WHERE timestamp >= NOW() - INTERVAL '30 days'
        GROUP BY skin_id, DATE(timestamp)
      )
      UPDATE skins SET
        trend = (
          SELECT ROUND(((current_price - prev_price) / prev_price * 100)::numeric, 2)
          FROM price_data
          WHERE price_data.skin_id = skins.id
          ORDER BY current_price DESC NULLS LAST
          LIMIT 1
        ),
        updated_at = NOW()
      WHERE id IN (SELECT DISTINCT skin_id FROM price_data)
    `;

    await db.query(query);
    console.log('[TRENDS] Price trends calculated');
  } catch (err) {
    console.error('[TRENDS] Error calculating trends:', err);
  }
}

/**
 * Clear old price data (keep last 90 days)
 */
async function cleanupOldData(): Promise<void> {
  try {
    console.log('[CLEANUP] Removing old data...');

    await db.query(
      'DELETE FROM market_prices WHERE timestamp < NOW() - INTERVAL \'90 days\''
    );

    console.log('[CLEANUP] Old data removed');
  } catch (err) {
    console.error('[CLEANUP] Error:', err);
  }
}

/**
 * Invalidate cache for market data
 */
async function invalidateMarketCache(): Promise<void> {
  try {
    await redis.connect().catch(() => {}); // connect if not already
    const keys = await redis.keys('market:*');

    for (const key of keys) {
      await redis.del(key);
    }

    console.log(`[CACHE] Invalidated ${keys.length} cache keys`);
  } catch (err) {
    console.error('[CACHE] Error invalidating cache:', err);
  }
}

/**
 * Main sync function
 */
export async function syncMarketData(): Promise<void> {
  try {
    console.log('\n========================================');
    console.log('Starting Market Data Sync at', new Date().toISOString());
    console.log('========================================\n');

    const startTime = Date.now();

    // Fetch prices from all markets in parallel
    const [steamPrices, buff163Prices, skinportPrices, csfloatPrices] = await Promise.all([
      fetchSteamPrices(),
      fetchBuff163Prices(),
      fetchSkinportPrices(),
      fetchCSFloatPrices(),
    ]);

    // Combine all prices
    const allPrices = [
      ...steamPrices,
      ...buff163Prices,
      ...skinportPrices,
      ...csfloatPrices,
    ];

    // Store in database
    await storeMarketPrices(allPrices);

    // Update statistics
    await updateMarketStatistics();

    // Calculate trends
    await calculatePriceTrends();

    // Cleanup old data
    await cleanupOldData();

    // Invalidate cache
    await invalidateMarketCache();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✓ Market sync completed in ${duration}s\n`);
  } catch (err) {
    console.error('Fatal sync error:', err);
  }
}

/**
 * Schedule regular syncs
 */
export function startMarketSyncScheduler(): void {
  const SYNC_INTERVAL = parseInt(process.env.MARKET_SYNC_INTERVAL || '300000'); // 5 minutes default

  console.log(`Market sync scheduled every ${SYNC_INTERVAL / 1000}s`);

  // Run immediately on start
  syncMarketData().catch(err => console.error('Initial sync failed:', err));

  // Then schedule at intervals
  setInterval(() => {
    syncMarketData().catch(err => console.error('Scheduled sync failed:', err));
  }, SYNC_INTERVAL);
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\nShutting down market sync...');
  await db.end();
  await redis.quit();
  process.exit(0);
});

// Run if executed directly
if (require.main === module) {
  startMarketSyncScheduler();
}
