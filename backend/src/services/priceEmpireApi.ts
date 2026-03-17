import axios from 'axios';
import { query, queryOne, queryMany } from '../utils/database';
import { broadcastMarketUpdate } from '../utils/websocket';
import { logger } from '../utils/logging';

// PriceEmpire API — https://pricempire.com/api
// One call gets prices from 30+ markets for ALL CS2 skins
const PRICEMPIRE_BASE = 'https://api.pricempire.com/v3';
const PRICEMPIRE_API_KEY = process.env.PRICEMPIRE_API_KEY || '';

const EXTERIORS = ['Factory New', 'Minimal Wear', 'Field-Tested', 'Well-Worn', 'Battle-Scarred'];

// Market name mapping: PriceEmpire source → our DB market
const MARKET_MAP: Record<string, { id: number; displayName: string; fee: number; urlPrefix: string }> = {
  'steam':    { id: 1,  displayName: 'Steam Community Market', fee: 13.0, urlPrefix: 'https://steamcommunity.com/market/listings/730/' },
  'buff163':  { id: 2,  displayName: 'Buff163',                fee: 2.5,  urlPrefix: 'https://buff.163.com/market/csgo#tab=selling&search=' },
  'skinport': { id: 3,  displayName: 'Skinport',               fee: 6.0,  urlPrefix: 'https://skinport.com/item/cs2/' },
  'csfloat':  { id: 4,  displayName: 'CSFloat',                fee: 3.0,  urlPrefix: 'https://csfloat.com/search?sort_by=lowest_price&market_hash_name=' },
  'dmarket':  { id: 5,  displayName: 'DMarket',                fee: 3.0,  urlPrefix: 'https://dmarket.com/ingame-items/item-list/csgo-skins?title=' },
  'waxpeer':  { id: 6,  displayName: 'Waxpeer',                fee: 5.0,  urlPrefix: 'https://waxpeer.com/csgo/' },
  'bitskins': { id: 7,  displayName: 'BitSkins',               fee: 5.0,  urlPrefix: 'https://bitskins.com/view/cs2?search=' },
  'tradeit':  { id: 8,  displayName: 'Tradeit.gg',             fee: 5.0,  urlPrefix: 'https://tradeit.gg/csgo/store?search=' },
  'lootfarm': { id: 9,  displayName: 'LootFarm',               fee: 3.0,  urlPrefix: 'https://loot.farm/' },
  'csdeals':  { id: 10, displayName: 'CS.Deals',               fee: 2.0,  urlPrefix: 'https://cs.deals/market/csgo/?search=' },
};

// Which markets to request from PriceEmpire
const PRICE_SOURCES = Object.keys(MARKET_MAP);

// ─── Ensure all markets exist in DB ──────────────────
async function ensureMarketsExist(): Promise<void> {
  for (const [source, info] of Object.entries(MARKET_MAP)) {
    await query(
      `INSERT INTO markets (id, name, display_name, fee_percentage, is_active)
       VALUES ($1, $2, $3, $4, TRUE)
       ON CONFLICT (id) DO UPDATE SET display_name = $3, fee_percentage = $4, is_active = TRUE`,
      [info.id, source, info.displayName, info.fee]
    );
  }
}

// ─── Generate direct URL for a skin on a market ─────
function generateDirectUrl(source: string, fullName: string): string {
  const info = MARKET_MAP[source];
  if (!info) return '';

  if (source === 'skinport') {
    const slug = fullName
      .replace(/★\s*/g, '')
      .replace(/\s*\|\s*/g, '-')
      .replace(/[()]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-');
    return `${info.urlPrefix}${slug}`;
  }
  if (source === 'steam') {
    return `${info.urlPrefix}${encodeURIComponent(fullName)}`;
  }
  if (source === 'csfloat') {
    return `${info.urlPrefix}${encodeURIComponent(fullName)}`;
  }
  return `${info.urlPrefix}${encodeURIComponent(fullName.replace(/★\s*/g, ''))}`;
}

// ─── Parse exterior from full item name ──────────────
function parseExterior(name: string): string | null {
  const match = name.match(/\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)/);
  return match ? match[1] : null;
}

// ─── Strip exterior from name ────────────────────────
function stripExterior(name: string): string {
  return name.replace(/\s*\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)\s*/g, '').replace(/^★\s*/, '').trim();
}

// ─── Fetch all prices from PriceEmpire ──────────────
export async function fetchPriceEmpirePrices(): Promise<Map<string, Record<string, number>>> {
  const priceMap = new Map<string, Record<string, number>>();

  if (!PRICEMPIRE_API_KEY) {
    logger.warn('PriceEmpire: no API key configured — skipping');
    return priceMap;
  }

  try {
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
    if (!data || typeof data !== 'object') return priceMap;

    // Handle both object and array response formats
    const entries: [string, any][] = Array.isArray(data)
      ? data.map((item: any) => [item.market_hash_name || item.name, item.prices || item])
      : Object.entries(data);

    for (const [itemName, sources] of entries) {
      if (!itemName || typeof sources !== 'object') continue;

      const prices: Record<string, number> = {};
      for (const [source, priceData] of Object.entries(sources as Record<string, any>)) {
        const sourceLower = source.toLowerCase();
        if (!MARKET_MAP[sourceLower]) continue;

        const price = typeof priceData === 'number'
          ? priceData
          : priceData?.price || priceData?.min_price || priceData?.avg || 0;

        // PriceEmpire may return cents — normalize
        const normalized = price > 10000 ? price / 100 : price;
        if (normalized > 0.01) {
          prices[sourceLower] = Math.round(normalized * 100) / 100;
        }
      }

      if (Object.keys(prices).length > 0) {
        priceMap.set(itemName, prices);
      }
    }

    logger.info(`PriceEmpire: fetched prices for ${priceMap.size} items`);
  } catch (error: any) {
    const msg = error.response?.data?.message || error.message;
    if (msg.includes('subscription')) {
      logger.warn('PriceEmpire: subscription required — using free APIs instead');
    } else {
      logger.error(`PriceEmpire API error: ${msg}`);
    }
  }

  return priceMap;
}

// ─── Sync all PriceEmpire prices to DB (per-exterior) ─
export async function syncPriceEmpirePrices(): Promise<{ updated: number; skipped: number; markets: number }> {
  const stats = { updated: 0, skipped: 0, markets: 0 };

  const priceMap = await fetchPriceEmpirePrices();
  if (priceMap.size === 0) return stats;

  await ensureMarketsExist();

  // Build a lookup: baseName → skinId
  const skins = await queryMany('SELECT id, name FROM skins ORDER BY id');
  const skinLookup = new Map<string, number>();
  for (const skin of skins) {
    skinLookup.set(skin.name.toLowerCase(), skin.id);
  }

  const marketsUpdated = new Set<string>();
  let batchCount = 0;

  for (const [fullName, marketPrices] of priceMap.entries()) {
    const exterior = parseExterior(fullName);
    const baseName = stripExterior(fullName);
    const skinId = skinLookup.get(baseName.toLowerCase());

    if (!skinId) {
      stats.skipped++;
      continue;
    }

    for (const [source, price] of Object.entries(marketPrices)) {
      const marketInfo = MARKET_MAP[source];
      if (!marketInfo || price <= 0) continue;

      const directUrl = generateDirectUrl(source, fullName);

      // Upsert per skin + market + exterior
      const existing = await queryOne(
        exterior
          ? 'SELECT id, price FROM market_prices WHERE skin_id = $1 AND market_id = $2 AND exterior = $3'
          : 'SELECT id, price FROM market_prices WHERE skin_id = $1 AND market_id = $2 AND exterior IS NULL',
        exterior ? [skinId, marketInfo.id, exterior] : [skinId, marketInfo.id]
      );

      if (existing) {
        await query(
          'UPDATE market_prices SET price = $1, last_updated = NOW(), matched_name = $2, direct_url = $3 WHERE id = $4',
          [price, fullName, directUrl, existing.id]
        );
      } else {
        await query(
          `INSERT INTO market_prices (skin_id, market_id, price, volume, last_updated, exterior, matched_name, direct_url)
           VALUES ($1, $2, $3, 0, NOW(), $4, $5, $6)`,
          [skinId, marketInfo.id, price, exterior, fullName, directUrl]
        );
      }

      marketsUpdated.add(source);
      stats.updated++;
      batchCount++;

      // Broadcast live update every 50 items
      if (batchCount % 50 === 0) {
        broadcastMarketUpdate({
          type: 'price_update',
          data: {
            skinId, skinName: baseName,
            marketId: marketInfo.id, marketName: marketInfo.displayName,
            oldPrice: existing ? parseFloat(existing.price) : 0,
            newPrice: price,
            change: existing ? Math.round((price - parseFloat(existing.price)) * 100) / 100 : 0,
            changePercent: 0,
            volume: 0,
            timestamp: new Date().toISOString(),
          },
        });
      }
    }
  }

  stats.markets = marketsUpdated.size;
  logger.info(`PriceEmpire sync: ${stats.updated} prices across ${stats.markets} markets (${stats.skipped} unmatched)`);
  return stats;
}
