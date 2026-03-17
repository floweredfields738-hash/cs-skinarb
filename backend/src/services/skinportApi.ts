import axios from 'axios';
import { query, queryOne, queryMany } from '../utils/database';
import { broadcastMarketUpdate } from '../utils/websocket';
import { logger } from '../utils/logging';

const SKINPORT_BASE = 'https://api.skinport.com/v1';
const SKINPORT_API_KEY = process.env.SKINPORT_API_KEY || '';

// ─── Fetch the cheapest listing's exact URL from a Skinport item page ───
// Scrapes the item page HTML to find the first (cheapest) listing's sale ID
// Returns the exact URL like: https://skinport.com/item/ak-47-redline-field-tested/77240131
export async function fetchExactListingUrl(itemPageSlug: string): Promise<string | null> {
  try {
    const url = `https://skinport.com/item/${itemPageSlug}`;
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    const html = response.data as string;

    // Look for listing URLs in the HTML: /item/slug/12345678
    const pattern = new RegExp(`/item/${itemPageSlug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/(\\d+)`, 'g');
    const matches = [...html.matchAll(pattern)];

    if (matches.length > 0) {
      // First match is typically the cheapest listing (page sorts by price)
      const saleId = matches[0][1];
      return `https://skinport.com/item/${itemPageSlug}/${saleId}`;
    }

    return null;
  } catch (error: any) {
    logger.debug(`Failed to fetch exact Skinport listing for "${itemPageSlug}": ${error.message}`);
    return null;
  }
}

// ─── Resolve exact listing URLs for arbitrage opportunities ───
// Called after arbitrage recalculation to upgrade Skinport URLs to exact listings
export async function resolveExactSkinportUrls(): Promise<number> {
  // Find arbitrage opportunities with Skinport as source that don't have exact URLs yet
  const opps = await queryMany(
    `SELECT ao.id, mp.matched_name, mp.direct_url
     FROM arbitrage_opportunities ao
     JOIN market_prices mp ON mp.skin_id = ao.skin_id AND mp.market_id = ao.source_market_id
       AND mp.exterior = (
         SELECT mp2.exterior FROM market_prices mp2
         WHERE mp2.skin_id = ao.skin_id AND mp2.market_id = ao.source_market_id
         ORDER BY mp2.price ASC LIMIT 1
       )
     WHERE ao.is_active = TRUE AND ao.source_market_id = 3
     ORDER BY ao.roi DESC
     LIMIT 20`
  );

  let resolved = 0;

  for (const opp of opps) {
    // Skip if already has exact URL (contains a sale ID number at the end)
    if (opp.direct_url && /\/\d+$/.test(opp.direct_url)) continue;

    // Build slug from matched_name: "AK-47 | Green Laminate (Field-Tested)" -> "ak-47-green-laminate-field-tested"
    const matchedName = opp.matched_name || '';
    const slug = matchedName
      .replace(/^★\s*/, '')
      .replace(/\s*\|\s*/g, '-')
      .replace(/[()]/g, '')
      .replace(/[^a-zA-Z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();

    if (!slug) continue;

    const exactUrl = await fetchExactListingUrl(slug);
    if (exactUrl) {
      await query('UPDATE arbitrage_opportunities SET buy_link = $1 WHERE id = $2', [exactUrl, opp.id]);
      resolved++;
    }

    // Small delay to be respectful to Skinport
    await new Promise(r => setTimeout(r, 2000));
  }

  if (resolved > 0) {
    logger.info(`✓ Resolved ${resolved} exact Skinport listing URLs`);
  }
  return resolved;
}

// ─── Rate limit protection ───────────────────────────
let lastSkinportFetch = 0;
const SKINPORT_COOLDOWN = 5 * 60 * 1000; // Don't fetch more than once per 5 minutes

// ─── Get all CS2 item prices from Skinport ───────────
export async function fetchSkinportPrices(): Promise<Map<string, { price: number; volume: number; itemPage: string; marketPage: string }>> {
  const priceMap = new Map<string, { price: number; volume: number; itemPage: string; marketPage: string }>();

  // Enforce cooldown to avoid rate limiting
  const timeSinceLast = Date.now() - lastSkinportFetch;
  if (timeSinceLast < SKINPORT_COOLDOWN) {
    logger.info(`Skinport: skipping fetch (cooldown, ${Math.round((SKINPORT_COOLDOWN - timeSinceLast) / 1000)}s remaining)`);
    return priceMap;
  }

  try {
    const response = await axios.get(`${SKINPORT_BASE}/items`, {
      params: {
        app_id: 730,
        currency: 'USD',
      },
      headers: {
        'Accept-Encoding': 'br, gzip, deflate',
        ...(SKINPORT_API_KEY ? { 'Authorization': `Bearer ${SKINPORT_API_KEY}` } : {}),
      },
      timeout: 30000,
    });

    if (!Array.isArray(response.data)) {
      logger.error('Skinport API: response is not an array', typeof response.data);
      return priceMap;
    }

    for (const item of response.data) {
      const name = item.market_hash_name;
      // Skinport returns prices in USD already (NOT cents)
      const price = item.min_price || item.suggested_price || 0;
      const volume = item.quantity || 0;
      const itemPage = item.item_page || '';
      // market_page filters to exactly this skin showing all active listings
      const marketPage = item.market_page || '';

      if (name && price > 0) {
        priceMap.set(name, { price, volume, itemPage, marketPage });
      }
    }

    lastSkinportFetch = Date.now();
    logger.info(`Skinport: fetched ${priceMap.size} item prices (USD)`);
  } catch (error: any) {
    if (error.response?.status === 429) {
      // On rate limit, set cooldown to 10 minutes
      lastSkinportFetch = Date.now() - SKINPORT_COOLDOWN + 10 * 60 * 1000;
    }
    logger.error(`Skinport API error: ${error.message}`);
  }

  return priceMap;
}

// ─── Parse market_hash_name into components ──────────
function parseHashName(hashName: string): { baseName: string; exterior: string | null; isStatTrak: boolean; isSouvenir: boolean; isKnife: boolean; isGlove: boolean; weaponName: string; skinName: string } {
  let name = hashName;
  const isStatTrak = name.startsWith('StatTrak™ ');
  const isSouvenir = name.startsWith('Souvenir ');
  if (isStatTrak) name = name.replace('StatTrak™ ', '');
  if (isSouvenir) name = name.replace('Souvenir ', '');

  // Remove star for knives/gloves
  name = name.replace(/^★\s*/, '');

  // Extract exterior
  let exterior: string | null = null;
  const extMatch = name.match(/\s*\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)\s*$/);
  if (extMatch) {
    exterior = extMatch[1];
    name = name.replace(extMatch[0], '').trim();
  }

  const knifeNames = ['Knife', 'Bayonet', 'Karambit', 'Daggers', 'Stiletto', 'Navaja', 'Ursus', 'Talon', 'Paracord', 'Survival', 'Nomad', 'Skeleton', 'Kukri', 'Bowie'];
  const isKnife = knifeNames.some(k => name.includes(k));
  const isGlove = name.includes('Gloves') || name.includes('Hand Wraps');

  const parts = name.split(' | ');
  const weaponName = parts[0] || name;
  const skinName = parts[1] || '';

  return { baseName: name, exterior, isStatTrak, isSouvenir, isKnife, isGlove, weaponName, skinName };
}

// ─── Determine rarity from price and type ────────────
function guessRarity(price: number, isKnife: boolean, isGlove: boolean): string {
  if (isKnife || isGlove) return 'Extraordinary';
  if (price > 200) return 'Covert';
  if (price > 50) return 'Classified';
  if (price > 10) return 'Restricted';
  if (price > 2) return 'Mil-Spec';
  if (price > 0.5) return 'Industrial Grade';
  return 'Consumer Grade';
}

// ─── Sync Skinport prices to database ────────────────
// This is the master sync: it auto-creates skins that don't exist in our DB
export async function syncSkinportPrices(): Promise<{ updated: number; skipped: number; created: number }> {
  const stats = { updated: 0, skipped: 0, created: 0 };
  const skinportMarketId = 3;

  const priceMap = await fetchSkinportPrices();
  if (priceMap.size === 0) {
    logger.warn('Skinport: no prices fetched, skipping sync');
    return stats;
  }

  // Load existing skins into a lookup map: baseName -> id
  const existingSkins = await queryMany('SELECT id, name FROM skins');
  const skinLookup = new Map<string, number>();
  for (const s of existingSkins) {
    skinLookup.set(s.name, s.id);
  }

  // Process EVERY item from Skinport
  for (const [hashName, data] of priceMap.entries()) {
    // Only process weapon skins (items with " | " in the name)
    if (!hashName.includes(' | ')) {
      stats.skipped++;
      continue;
    }

    const parsed = parseHashName(hashName);
    if (!parsed.baseName || !parsed.skinName) {
      stats.skipped++;
      continue;
    }

    // Build the base name we store in our skins table
    // StatTrak and Souvenir are variants of the same base skin
    let dbBaseName = parsed.baseName;
    let fullName = hashName; // The full market_hash_name including exterior

    // Check if this base skin exists in our DB, if not — create it
    let skinId = skinLookup.get(dbBaseName);
    if (!skinId) {
      // Auto-create the skin
      try {
        const result = await queryOne(
          `INSERT INTO skins (name, weapon_name, skin_name, rarity, min_float, max_float, is_knife, is_glove, has_souvenir, created_at, updated_at)
           VALUES ($1, $2, $3, $4, 0.0, 1.0, $5, $6, $7, NOW(), NOW())
           ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
           RETURNING id`,
          [dbBaseName, parsed.weaponName, parsed.skinName, guessRarity(data.price, parsed.isKnife, parsed.isGlove), parsed.isKnife, parsed.isGlove, parsed.isSouvenir]
        );
        skinId = result?.id;
        if (skinId) {
          skinLookup.set(dbBaseName, skinId);
          stats.created++;
        }
      } catch (e: any) {
        // Might fail on unique constraint race — try to fetch existing
        const existing = await queryOne('SELECT id FROM skins WHERE name = $1', [dbBaseName]);
        skinId = existing?.id;
        if (skinId) skinLookup.set(dbBaseName, skinId);
      }
    }

    if (!skinId) {
      stats.skipped++;
      continue;
    }

    // Build direct URL
    let directUrl: string;
    if (data.marketPage) {
      directUrl = `${data.marketPage}&sort=price&order=asc`;
    } else if (data.itemPage) {
      directUrl = data.itemPage;
    } else {
      directUrl = `https://skinport.com/market?search=${encodeURIComponent(hashName)}&sort=price&order=asc`;
    }

    // Upsert price row: one per (skin_id, market_id, exterior)
    const existing = await queryOne(
      parsed.exterior
        ? 'SELECT id FROM market_prices WHERE skin_id = $1 AND market_id = $2 AND exterior = $3'
        : 'SELECT id FROM market_prices WHERE skin_id = $1 AND market_id = $2 AND exterior IS NULL',
      parsed.exterior ? [skinId, skinportMarketId, parsed.exterior] : [skinId, skinportMarketId]
    );

    if (existing) {
      await query(
        parsed.exterior
          ? `UPDATE market_prices SET price = $1, volume = $2, matched_name = $3, direct_url = $4, last_updated = NOW()
             WHERE skin_id = $5 AND market_id = $6 AND exterior = $7`
          : `UPDATE market_prices SET price = $1, volume = $2, matched_name = $3, direct_url = $4, last_updated = NOW()
             WHERE skin_id = $5 AND market_id = $6 AND exterior IS NULL`,
        parsed.exterior
          ? [data.price, data.volume, fullName, directUrl, skinId, skinportMarketId, parsed.exterior]
          : [data.price, data.volume, fullName, directUrl, skinId, skinportMarketId]
      );
    } else {
      await query(
        `INSERT INTO market_prices (skin_id, market_id, price, volume, matched_name, direct_url, exterior, last_updated)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [skinId, skinportMarketId, data.price, data.volume, fullName, directUrl, parsed.exterior || null]
      );
    }

    stats.updated++;
  }

  logger.info(`Skinport sync: ${stats.updated} updated, ${stats.created} new skins created, ${stats.skipped} skipped`);
  return stats;
}

// ─── Sync REAL historical sales data from Skinport ───
export async function syncSkinportHistory(): Promise<number> {
  try {
    logger.info('▶ Fetching real sales history from Skinport...');

    const response = await axios.get(`${SKINPORT_BASE}/sales/history`, {
      params: { app_id: 730, currency: 'USD' },
      headers: {
        'Accept-Encoding': 'br, gzip',
        'User-Agent': 'CSkinArb/1.0',
      },
      timeout: 30000,
    });

    const items = response.data;
    if (!Array.isArray(items)) {
      logger.warn('Skinport history: unexpected response format');
      return 0;
    }

    logger.info(`Skinport history: ${items.length} items received`);

    // Build skin name → id lookup
    const skins = await queryMany('SELECT id, name FROM skins');
    const skinLookup = new Map<string, number>();
    for (const s of skins) {
      skinLookup.set(s.name.toLowerCase(), s.id);
    }

    let updated = 0;

    for (const item of items) {
      const fullName = item.market_hash_name;
      if (!fullName) continue;

      const d30 = item.last_30_days;
      const d7 = item.last_7_days;
      const d24 = item.last_24_hours;
      const d90 = item.last_90_days;

      // Skip items with no sales data
      if (!d30?.volume && !d7?.volume) continue;

      // Match to our skin (strip exterior for base name match)
      const baseName = fullName.replace(/\s*\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)\s*$/i, '').trim();
      const skinId = skinLookup.get(baseName.toLowerCase());
      if (!skinId) continue;

      // Calculate real volatility from 30d data
      const volatility = d30?.avg > 0 ? Math.round(((d30.max - d30.min) / d30.avg) * 100 * 100) / 100 : 0;

      // Upsert price_statistics with REAL data
      await query(
        `INSERT INTO price_statistics (skin_id, avg_price_7d, avg_price_30d, min_price_7d, max_price_7d,
           min_price_30d, max_price_30d, price_volatility, trading_volume_7d, trading_volume_30d, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
         ON CONFLICT (skin_id) DO UPDATE SET
           avg_price_7d = $2, avg_price_30d = $3, min_price_7d = $4, max_price_7d = $5,
           min_price_30d = $6, max_price_30d = $7, price_volatility = $8,
           trading_volume_7d = $9, trading_volume_30d = $10, updated_at = NOW()`,
        [
          skinId,
          d7?.avg || d30?.avg || 0,
          d30?.avg || 0,
          d7?.min || d30?.min || 0,
          d7?.max || d30?.max || 0,
          d30?.min || 0,
          d30?.max || 0,
          volatility,
          d7?.volume || 0,
          d30?.volume || 0,
        ]
      );

      // Also insert synthetic price_history points so charts have real data
      // Create 4 points: 90d ago, 30d ago, 7d ago, now
      const now = Date.now();
      const points = [
        { time: now - 90 * 86400000, price: d90?.median || d90?.avg },
        { time: now - 30 * 86400000, price: d30?.median || d30?.avg },
        { time: now - 7 * 86400000, price: d7?.median || d7?.avg },
        { time: now - 86400000, price: d24?.median || d24?.avg },
      ].filter(pt => pt.price && pt.price > 0);

      for (const pt of points) {
        await query(
          `INSERT INTO price_history (skin_id, market_id, price, timestamp)
           VALUES ($1, 3, $2, to_timestamp($3))
           ON CONFLICT DO NOTHING`,
          [skinId, pt.price, pt.time / 1000]
        ).catch(() => {}); // ignore conflicts
      }

      updated++;
    }

    logger.info(`✓ Skinport history: ${updated} skins updated with real 7d/30d/90d sales data`);
    return updated;
  } catch (error: any) {
    if (error.response?.status === 429) {
      logger.warn('Skinport history: rate limited, will retry next cycle');
    } else {
      logger.error(`Skinport history error: ${error.message}`);
    }
    return 0;
  }
}
