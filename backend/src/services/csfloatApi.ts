import axios from 'axios';
import { query, queryOne, queryMany } from '../utils/database';
import { broadcastMarketUpdate } from '../utils/websocket';
import { logger } from '../utils/logging';

// CSFloat API — https://csfloat.com/developers
// Docs: https://docs.csfloat.com
const CSFLOAT_BASE = 'https://csfloat.com/api/v1';
const CSFLOAT_API_KEY = process.env.CSFLOAT_API_KEY || '';

// Rate limit protection
let lastCsfloatFetch = 0;
let csfloatRateLimited = false;
const CSFLOAT_COOLDOWN = 10 * 60 * 1000; // 10 minutes between full syncs

class CSFloatRateLimitError extends Error {
  constructor() { super('CSFloat rate limited'); this.name = 'CSFloatRateLimitError'; }
}

// ─── Fetch listings for a skin from CSFloat ──────────
export async function fetchCSFloatListings(skinName: string): Promise<{
  price: number;
  count: number;
  cheapestListingId: string | null;
  listings: { price: number; float_value: number; id: string }[];
} | null> {
  try {
    const response = await axios.get(`${CSFLOAT_BASE}/listings`, {
      params: {
        market_hash_name: skinName,
        sort_by: 'lowest_price',
        limit: 5,
      },
      headers: CSFLOAT_API_KEY
        ? { 'Authorization': CSFLOAT_API_KEY }
        : {},
      timeout: 5000,
    });

    const data = response.data;
    // Check for rate limit response — set flag so sync loop stops
    if (data?.code === 20 || data?.message?.includes('too many requests')) {
      csfloatRateLimited = true;
      return null;
    }
    if (!data || !Array.isArray(data.data)) return null;

    const listings = data.data.map((l: any) => ({
      price: (l.price || 0) / 100, // CSFloat returns cents
      float_value: l.float_value || 0,
      id: l.id || '',
    }));

    const lowestPrice = listings.length > 0 ? listings[0].price : 0;
    const cheapestListingId = listings.length > 0 && listings[0].id ? listings[0].id : null;

    return {
      price: lowestPrice,
      count: data.count || listings.length,
      cheapestListingId,
      listings,
    };
  } catch (error: any) {
    // Re-throw rate limit errors so sync can stop
    if (error instanceof CSFloatRateLimitError) throw error;
    logger.debug(`CSFloat fetch failed for "${skinName}": ${error.message}`);
    return null;
  }
}

// ─── Sync CSFloat prices to database ─────────────────
// Stores each exterior separately, with direct listing URLs
export async function syncCSFloatPrices(batchSize = 100): Promise<{ updated: number; failed: number }> {
  const stats = { updated: 0, failed: 0 };
  const csfloatMarketId = 4; // CSFloat is market_id = 4
  const EXTERIORS = ['Factory New', 'Minimal Wear', 'Field-Tested', 'Well-Worn', 'Battle-Scarred'];

  // Enforce cooldown
  const timeSinceLast = Date.now() - lastCsfloatFetch;
  if (timeSinceLast < CSFLOAT_COOLDOWN) {
    logger.info(`CSFloat: skipping sync (cooldown, ${Math.round((CSFLOAT_COOLDOWN - timeSinceLast) / 1000)}s remaining)`);
    return stats;
  }

  const skins = await queryMany(
    `SELECT s.id, s.name FROM skins s ORDER BY s.id LIMIT $1`,
    [batchSize]
  );

  logger.info(`Starting CSFloat sync for ${skins.length} skins...`);

  for (const skin of skins) {
    // If we got rate limited, stop immediately
    if (csfloatRateLimited) {
      logger.warn('CSFloat: rate limited — stopping sync, will retry in 10 minutes');
      lastCsfloatFetch = Date.now();
      return stats;
    }

    let skinUpdated = false;

    for (const ext of EXTERIORS) {
      try {
        const fullName = `${skin.name} (${ext})`;
        const result = await fetchCSFloatListings(fullName);

        if (!result || result.price === 0) continue;

        // Build direct CSFloat URL — use exact listing ID if available, otherwise search
        const directUrl = result.cheapestListingId
          ? `https://csfloat.com/item/${result.cheapestListingId}`
          : `https://csfloat.com/search?sort_by=lowest_price&market_hash_name=${encodeURIComponent(fullName)}`;

        const existing = await queryOne(
          'SELECT price FROM market_prices WHERE skin_id = $1 AND market_id = $2 AND exterior = $3',
          [skin.id, csfloatMarketId, ext]
        );

        if (existing) {
          await query(
            `UPDATE market_prices SET price = $1, volume = $2, matched_name = $3, direct_url = $4, last_updated = NOW()
             WHERE skin_id = $5 AND market_id = $6 AND exterior = $7`,
            [result.price, result.count, fullName, directUrl, skin.id, csfloatMarketId, ext]
          );
        } else {
          await query(
            `INSERT INTO market_prices (skin_id, market_id, price, volume, matched_name, direct_url, exterior, last_updated)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
            [skin.id, csfloatMarketId, result.price, result.count, fullName, directUrl, ext]
          );
        }

        stats.updated++;
        skinUpdated = true;

        // CSFloat rate limit: ~1 req/sec
        await new Promise((resolve) => setTimeout(resolve, 1500));
      } catch (error: any) {
        // If rate limited, stop entire sync immediately
        if (error instanceof CSFloatRateLimitError || error.response?.status === 429) {
          logger.warn('CSFloat: rate limited — stopping sync, will retry in 10 minutes');
          csfloatRateLimited = true;
          lastCsfloatFetch = Date.now();
          return stats;
        }
        // Other errors — skip this exterior
      }
    }

    if (!skinUpdated) stats.failed++;

    // Log progress every 20 skins
    if ((stats.updated + stats.failed) % 20 === 0) {
      logger.info(`CSFloat sync progress: ${stats.updated} updated, ${stats.failed} failed`);
    }
  }

  lastCsfloatFetch = Date.now();
  csfloatRateLimited = false;
  logger.info(`CSFloat sync: ${stats.updated} updated, ${stats.failed} failed`);
  return stats;
}
