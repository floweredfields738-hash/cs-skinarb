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

// ─── Sync Skinport prices to database ────────────────
export async function syncSkinportPrices(): Promise<{ updated: number; skipped: number }> {
  const stats = { updated: 0, skipped: 0 };
  const skinportMarketId = 3;

  const priceMap = await fetchSkinportPrices();
  if (priceMap.size === 0) {
    logger.warn('Skinport: no prices fetched, skipping sync');
    return stats;
  }

  const skins = await queryMany('SELECT id, name FROM skins ORDER BY id');
  const EXTERIORS = ['Factory New', 'Minimal Wear', 'Field-Tested', 'Well-Worn', 'Battle-Scarred'];

  for (const skin of skins) {
    const isKnife = skin.name.includes('Knife') || skin.name.includes('Karambit') || skin.name.includes('Bayonet') || skin.name.includes('Daggers') || skin.name.includes('Kukri');
    const isGlove = skin.name.includes('Gloves') || skin.name.includes('Wraps');
    let skinMatched = false;

    // Store a separate price row for EACH exterior — this prevents comparing BS vs FN in arbitrage
    for (const ext of EXTERIORS) {
      // Try: "AK-47 | Redline (Field-Tested)" and "★ Karambit | Doppler (Factory New)"
      const lookups = [`${skin.name} (${ext})`];
      if (isKnife || isGlove) lookups.push(`★ ${skin.name} (${ext})`);

      for (const lookupName of lookups) {
        const found = priceMap.get(lookupName);
        if (!found || found.price <= 0) continue;

        // Build direct URL to this skin's listings on Skinport
        let directUrl: string;
        if (found.marketPage) {
          directUrl = `${found.marketPage}&sort=price&order=asc`;
        } else {
          const withoutStar = lookupName.replace(/^★\s*/, '');
          const withoutExt = withoutStar.replace(/\s*\([^)]+\)\s*$/, '').trim();
          const parts = withoutExt.split(' | ');
          directUrl = parts.length === 2
            ? `https://skinport.com/market?item=${encodeURIComponent(parts[1])}&type=${encodeURIComponent(parts[0])}&sort=price&order=asc`
            : `https://skinport.com/market?search=${encodeURIComponent(lookupName)}&sort=price&order=asc`;
        }

        // Upsert: one row per (skin_id, market_id, exterior)
        const existing = await queryOne(
          'SELECT id, price FROM market_prices WHERE skin_id = $1 AND market_id = $2 AND exterior = $3',
          [skin.id, skinportMarketId, ext]
        );

        if (existing) {
          await query(
            `UPDATE market_prices SET price = $1, volume = $2, matched_name = $3, direct_url = $4, exterior = $5, last_updated = NOW()
             WHERE skin_id = $6 AND market_id = $7 AND exterior = $8`,
            [found.price, found.volume, lookupName, directUrl, ext, skin.id, skinportMarketId, ext]
          );
        } else {
          await query(
            `INSERT INTO market_prices (skin_id, market_id, price, volume, matched_name, direct_url, exterior, last_updated)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
            [skin.id, skinportMarketId, found.price, found.volume, lookupName, directUrl, ext]
          );
        }

        skinMatched = true;
        stats.updated++;
        break; // Only one lookup per exterior
      }
    }

    // Also try exact match (vanilla knives etc — no exterior)
    if (!skinMatched) {
      const exactLookups = [skin.name];
      if (isKnife || isGlove) exactLookups.push(`★ ${skin.name}`);

      for (const lookupName of exactLookups) {
        const found = priceMap.get(lookupName);
        if (!found || found.price <= 0) continue;

        const directUrl = found.marketPage
          ? `${found.marketPage}&sort=price&order=asc`
          : `https://skinport.com/market?search=${encodeURIComponent(lookupName)}&sort=price&order=asc`;

        const existing = await queryOne(
          'SELECT id FROM market_prices WHERE skin_id = $1 AND market_id = $2 AND exterior IS NULL',
          [skin.id, skinportMarketId]
        );

        if (existing) {
          await query(
            `UPDATE market_prices SET price = $1, volume = $2, matched_name = $3, direct_url = $4, last_updated = NOW()
             WHERE skin_id = $5 AND market_id = $6 AND exterior IS NULL`,
            [found.price, found.volume, lookupName, directUrl, skin.id, skinportMarketId]
          );
        } else {
          await query(
            `INSERT INTO market_prices (skin_id, market_id, price, volume, matched_name, direct_url, last_updated)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
            [skin.id, skinportMarketId, found.price, found.volume, lookupName, directUrl]
          );
        }

        skinMatched = true;
        stats.updated++;
        break;
      }
    }

    if (!skinMatched) stats.skipped++;
  }

  logger.info(`Skinport sync: ${stats.updated} updated, ${stats.skipped} skipped`);
  return stats;
}
