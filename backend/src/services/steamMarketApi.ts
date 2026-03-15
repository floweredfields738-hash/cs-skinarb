import axios from 'axios';
import { query, queryOne, queryMany } from '../utils/database';
import { broadcastMarketUpdate } from '../utils/websocket';
import { logger } from '../utils/logging';

const STEAM_API_KEY = process.env.STEAM_API_KEY || '';
const STEAM_MARKET_BASE = 'https://steamcommunity.com/market';
const CS2_APP_ID = 730;

// Rate limiting for bulk search: 6s between requests to be safe
const BULK_RATE_LIMIT_MS = 6000;
let lastRequestTime = 0;
let consecutiveFailures = 0;

async function rateLimitedFetch(url: string, params?: Record<string, any>): Promise<any> {
  const now = Date.now();
  const wait = BULK_RATE_LIMIT_MS - (now - lastRequestTime);
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }

  if (consecutiveFailures > 0) {
    const backoff = Math.min(consecutiveFailures * 15000, 120000);
    await new Promise((resolve) => setTimeout(resolve, backoff));
  }

  lastRequestTime = Date.now();

  try {
    const response = await axios.get(url, {
      params,
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    consecutiveFailures = 0;
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 429) {
      consecutiveFailures++;
      const waitTime = Math.min(60000 + consecutiveFailures * 30000, 180000);
      logger.warn(`Steam API rate limited (${consecutiveFailures}x), waiting ${waitTime / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      return rateLimitedFetch(url, params);
    }
    throw error;
  }
}

// ─── Parse Steam price string ($XX.XX) to number ────
function parsePrice(priceStr?: string): number | undefined {
  if (!priceStr) return undefined;
  const cleaned = priceStr.replace(/[^0-9.]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? undefined : parsed;
}

// ─── Bulk fetch prices via Steam Market search/render ──
// Returns up to 100 items per call with current prices.
// This is MUCH faster than individual priceoverview calls.
async function fetchSteamBulkPage(start: number, count: number = 100): Promise<{
  success: boolean;
  total_count: number;
  results: Array<{
    hash_name: string;
    sell_price: number;        // price in cents
    sell_price_text: string;   // "$12.34"
    sell_listings: number;     // number of active listings
    asset_description?: {
      icon_url?: string;
    };
  }>;
} | null> {
  try {
    const data = await rateLimitedFetch(
      `${STEAM_MARKET_BASE}/search/render/`,
      {
        query: '',
        start,
        count,
        search_descriptions: 0,
        sort_column: 'name',
        sort_dir: 'asc',
        appid: CS2_APP_ID,
        norender: 1,
      }
    );

    if (!data?.success) return null;
    return data;
  } catch (error: any) {
    logger.error(`Steam bulk fetch failed at start=${start}: ${error.message}`);
    return null;
  }
}

// ─── Main bulk sync: fetches ALL CS2 skin prices from Steam ──
// Uses search/render endpoint: ~100 items per page
// Total CS2 items ~32k, but we only need to match our ~1400 skins
export async function syncSteamPrices(): Promise<{ updated: number; failed: number; skipped: number }> {
  const stats = { updated: 0, failed: 0, skipped: 0 };

  // Load all our skins into a lookup map
  const skins = await queryMany('SELECT id, name FROM skins ORDER BY id');
  const skinMap = new Map<string, { id: number; name: string }>();

  // Build lookup: exact name AND name with exteriors
  for (const skin of skins) {
    skinMap.set(skin.name.toLowerCase(), skin);
  }

  const steamMarketId = 1;
  const ITEMS_PER_PAGE = 100;
  let start = 0;
  let totalCount = 0;
  let matchedSkinIds = new Set<string>();
  let pageNum = 0;

  logger.info(`▶ Starting Steam bulk price sync for ${skins.length} skins...`);

  do {
    pageNum++;
    const page = await fetchSteamBulkPage(start, ITEMS_PER_PAGE);

    if (!page || !page.results || page.results.length === 0) {
      if (!page) {
        stats.failed++;
        logger.warn(`Steam bulk page ${pageNum} failed, skipping...`);
      }
      break;
    }

    if (totalCount === 0) {
      totalCount = page.total_count;
      logger.info(`Steam Market has ${totalCount} total items. Scanning for our ${skins.length} skins...`);
    }

    for (const item of page.results) {
      const hashName = item.hash_name;
      const priceCents = item.sell_price; // Price in cents
      const priceUsd = priceCents / 100;
      const listings = item.sell_listings;

      if (priceUsd <= 0) continue;

      // Try to match to our skin database
      // Steam names include exterior: "AK-47 | Redline (Field-Tested)"
      // Our DB stores: "AK-47 | Redline"
      // Match by stripping the exterior
      const baseName = hashName
        .replace(/\s*\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)\s*$/i, '')
        .trim();

      const skin = skinMap.get(baseName.toLowerCase());
      if (!skin) continue;

      // Store EVERY exterior separately — don't skip duplicates
      // Track by skin_id + exterior to avoid true duplicates
      const extMatch = hashName.match(/\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)\s*$/i);
      const ext = extMatch ? extMatch[1] : 'none';
      const dedupeKey = `${skin.id}:${ext}`;
      if (matchedSkinIds.has(dedupeKey)) continue;
      matchedSkinIds.add(dedupeKey);

      try {
        await updateSkinPrice(skin.id, steamMarketId, priceUsd, listings, skin.name, hashName);
        stats.updated++;
      } catch (error: any) {
        logger.debug(`Failed to update Steam price for "${skin.name}": ${error.message}`);
        stats.failed++;
      }
    }

    start += page.results.length;

    // Log progress
    if (pageNum % 10 === 0) {
      logger.info(`Steam bulk sync: page ${pageNum}, scanned ${start}/${totalCount} items, matched ${matchedSkinIds.size}/${skins.length} skins`);
    }

    // If we've matched all our skins, stop early
    if (matchedSkinIds.size >= skins.length) {
      logger.info(`✓ All ${skins.length} skins matched! Stopping early at page ${pageNum}.`);
      break;
    }

  } while (start < totalCount);

  stats.skipped = skins.length - matchedSkinIds.size;

  logger.info(`✓ Steam bulk sync complete: ${stats.updated} updated, ${stats.failed} failed, ${stats.skipped} unmatched`);
  return stats;
}

// ─── Quick sync: just fetch the first few pages to get cheap/common skins fast ──
export async function syncTopSkins(limit = 50): Promise<number> {
  logger.info(`▶ Quick-syncing top ${limit} skins from Steam (bulk)...`);

  const skins = await queryMany('SELECT id, name FROM skins ORDER BY id');
  const skinMap = new Map<string, { id: number; name: string }>();
  for (const skin of skins) {
    skinMap.set(skin.name.toLowerCase(), skin);
  }

  const steamMarketId = 1;
  let updated = 0;
  let start = 0;
  const matchedIds = new Set<string>();

  // Fetch pages until we have enough matches
  for (let page = 0; page < 20 && updated < limit; page++) {
    const data = await fetchSteamBulkPage(start, 100);
    if (!data?.results?.length) break;

    for (const item of data.results) {
      if (updated >= limit) break;

      const baseName = item.hash_name
        .replace(/\s*\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)\s*$/i, '')
        .trim();

      const skin = skinMap.get(baseName.toLowerCase());
      if (!skin) continue;

      const extMatch = item.hash_name.match(/\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)\s*$/i);
      const ext = extMatch ? extMatch[1] : 'none';
      const dedupeKey = `${skin.id}:${ext}`;
      if (matchedIds.has(dedupeKey)) continue;

      const priceUsd = item.sell_price / 100;
      if (priceUsd <= 0) continue;

      matchedIds.add(dedupeKey);

      try {
        await updateSkinPrice(skin.id, steamMarketId, priceUsd, item.sell_listings, skin.name, item.hash_name);
        updated++;
      } catch { /* skip */ }
    }

    start += data.results.length;
  }

  logger.info(`✓ Quick sync complete: ${updated} skins updated from Steam`);
  return updated;
}

// ─── Get price for a single skin from Steam Market ───
export async function getSteamMarketPrice(skinName: string): Promise<{
  success: boolean;
  lowest_price?: number;
  median_price?: number;
  volume?: number;
} | null> {
  try {
    const data = await rateLimitedFetch(
      `${STEAM_MARKET_BASE}/priceoverview/`,
      {
        appid: CS2_APP_ID,
        currency: 1,
        market_hash_name: skinName,
      }
    );

    if (!data?.success) return null;

    return {
      success: true,
      lowest_price: parsePrice(data.lowest_price),
      median_price: parsePrice(data.median_price),
      volume: parseInt(data.volume?.replace(/,/g, '') || '0'),
    };
  } catch (error: any) {
    logger.debug(`Steam price fetch failed for "${skinName}": ${error.message}`);
    return null;
  }
}

// ─── Get price history for a skin ────────────────────
export async function getSteamPriceHistory(skinName: string): Promise<{
  date: Date;
  price: number;
  volume: number;
}[]> {
  try {
    const data = await rateLimitedFetch(
      `${STEAM_MARKET_BASE}/pricehistory/`,
      {
        appid: CS2_APP_ID,
        market_hash_name: skinName,
        key: STEAM_API_KEY,
      }
    );

    if (!data?.success || !data.prices) return [];

    return data.prices.map((entry: [string, number, string]) => ({
      date: new Date(entry[0]),
      price: entry[1],
      volume: parseInt(entry[2]),
    }));
  } catch (error: any) {
    logger.debug(`Steam price history failed for "${skinName}": ${error.message}`);
    return [];
  }
}

// ─── Update price in database and broadcast ──────────
async function updateSkinPrice(
  skinId: number,
  marketId: number,
  newPrice: number,
  volume: number,
  skinName: string,
  matchedName?: string,
): Promise<void> {
  // Extract exterior from matched name: "AK-47 | Redline (Field-Tested)" -> "Field-Tested"
  const steamHashName = matchedName || skinName;
  const extMatch = steamHashName.match(/\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)\s*$/i);
  const exterior = extMatch ? extMatch[1] : null;

  const existing = await queryOne(
    exterior
      ? 'SELECT price FROM market_prices WHERE skin_id = $1 AND market_id = $2 AND exterior = $3'
      : 'SELECT price FROM market_prices WHERE skin_id = $1 AND market_id = $2 AND exterior IS NULL',
    exterior ? [skinId, marketId, exterior] : [skinId, marketId]
  );

  const oldPrice = existing ? parseFloat(existing.price) : 0;
  const change = newPrice - oldPrice;
  const changePercent = oldPrice > 0 ? (change / oldPrice) * 100 : 0;

  // Build direct Steam listing URL using the exact matched name (with exterior)
  const directUrl = `https://steamcommunity.com/market/listings/730/${encodeURIComponent(steamHashName)}`;

  if (existing) {
    await query(
      exterior
        ? 'UPDATE market_prices SET price = $1, volume = $2, matched_name = $3, direct_url = $4, last_updated = NOW() WHERE skin_id = $5 AND market_id = $6 AND exterior = $7'
        : 'UPDATE market_prices SET price = $1, volume = $2, matched_name = $3, direct_url = $4, last_updated = NOW() WHERE skin_id = $5 AND market_id = $6 AND exterior IS NULL',
      exterior
        ? [newPrice, volume, steamHashName, directUrl, skinId, marketId, exterior]
        : [newPrice, volume, steamHashName, directUrl, skinId, marketId]
    );
  } else {
    await query(
      'INSERT INTO market_prices (skin_id, market_id, price, volume, matched_name, direct_url, exterior, last_updated) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())',
      [skinId, marketId, newPrice, volume, steamHashName, directUrl, exterior]
    );
  }

  broadcastMarketUpdate({
    type: 'price_update',
    data: {
      skinId,
      skinName,
      marketId,
      marketName: 'Steam Community Market',
      oldPrice,
      newPrice,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
      volume,
      timestamp: new Date().toISOString(),
    },
  });
}

// ─── Get Steam Market image URL for a skin ───────────
export function getSteamImageUrl(skinName: string): string {
  const encoded = encodeURIComponent(skinName);
  return `https://steamcommunity.com/market/listings/${CS2_APP_ID}/${encoded}`;
}
