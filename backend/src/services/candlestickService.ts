import { query, queryOne, queryMany } from '../utils/database';
import { logger } from '../utils/logging';

// ── Interval definitions ─────────────────────────────────────────────────────

const INTERVAL_MS: Record<string, number> = {
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '1w': 7 * 24 * 60 * 60 * 1000,
};

const VALID_INTERVALS = Object.keys(INTERVAL_MS);

// ── Fetch candlestick data ───────────────────────────────────────────────────

export async function getCandlestickData(
  skinId: number,
  marketId: number,
  interval: string,
  limit: number = 100,
  exterior: string = 'Factory New'
): Promise<any[]> {
  if (!VALID_INTERVALS.includes(interval)) {
    throw new Error(`Invalid interval: ${interval}. Must be one of: ${VALID_INTERVALS.join(', ')}`);
  }

  const rows = await queryMany(
    `SELECT id, skin_id, market_id, exterior, interval,
            open_price, high_price, low_price, close_price,
            volume, timestamp
     FROM price_history_ohlc
     WHERE skin_id = $1 AND market_id = $2 AND interval = $3
     ORDER BY timestamp DESC
     LIMIT $4`,
    [skinId, marketId, interval, limit]
  );

  if (rows.length >= 2) {
    // Return in chronological order (oldest first)
    return rows.reverse().map((r: any) => ({
      timestamp: r.timestamp,
      open: parseFloat(r.open_price),
      high: parseFloat(r.high_price),
      low: parseFloat(r.low_price),
      close: parseFloat(r.close_price),
      volume: parseInt(r.volume) || 0,
    }));
  }

  // Fallback: generate candles from current market prices if no OHLC data
  // Uses the current price and creates a minimal chart showing real value
  const currentPrice = await queryOne(
    `SELECT mp.price, s.name FROM market_prices mp
     JOIN skins s ON s.id = mp.skin_id
     WHERE mp.skin_id = $1 AND mp.market_id = $2 AND mp.price > 0
     ORDER BY mp.last_updated DESC LIMIT 1`,
    [skinId, marketId]
  );

  if (!currentPrice || !currentPrice.price) {
    // Try any market
    const anyPrice = await queryOne(
      `SELECT mp.price, mp.market_id FROM market_prices mp
       WHERE mp.skin_id = $1 AND mp.price > 0
       ORDER BY mp.last_updated DESC LIMIT 1`,
      [skinId]
    );
    if (!anyPrice) return [];

    const p = parseFloat(anyPrice.price);
    return generateMinimalCandles(p, interval, limit);
  }

  const p = parseFloat(currentPrice.price);
  return generateMinimalCandles(p, interval, limit);
}

// Generate a single candle from the current real price
// This gives the chart something to display while real history accumulates
function generateMinimalCandles(currentPrice: number, interval: string, _count: number): any[] {
  // Just return the current price as a single data point — no fake history
  const now = new Date().toISOString();
  return [{
    timestamp: now,
    open: currentPrice,
    high: currentPrice,
    low: currentPrice,
    close: currentPrice,
    volume: 0,
  }];
}

// ── Aggregate price_history into OHLC candles ────────────────────────────────

export async function aggregateCandles(
  skinId: number,
  marketId: number,
  interval: string
): Promise<void> {
  if (!VALID_INTERVALS.includes(interval)) return;

  const intervalMs = INTERVAL_MS[interval];

  // Determine Postgres interval string for date_trunc / date_bin
  let pgInterval: string;
  switch (interval) {
    case '1h': pgInterval = '1 hour'; break;
    case '4h': pgInterval = '4 hours'; break;
    case '1d': pgInterval = '1 day'; break;
    case '1w': pgInterval = '7 days'; break;
    default: return;
  }

  // Use date_bin to bucket price_history into OHLC candles and upsert
  await query(
    `INSERT INTO price_history_ohlc (skin_id, market_id, exterior, interval, open_price, high_price, low_price, close_price, volume, timestamp)
     SELECT
       $1 as skin_id,
       $2 as market_id,
       'Factory New' as exterior,
       $3 as interval,
       (array_agg(price ORDER BY ph.timestamp ASC))[1] as open_price,
       MAX(price) as high_price,
       MIN(price) as low_price,
       (array_agg(price ORDER BY ph.timestamp DESC))[1] as close_price,
       COALESCE(MAX(volume), 0) as volume,
       date_bin($4::interval, ph.timestamp, '2020-01-01'::timestamp) as bucket
     FROM price_history ph
     WHERE ph.skin_id = $1 AND ph.market_id = $2
     GROUP BY bucket
     HAVING COUNT(*) > 0
     ON CONFLICT (skin_id, market_id, interval, timestamp)
     DO UPDATE SET
       open_price = EXCLUDED.open_price,
       high_price = EXCLUDED.high_price,
       low_price = EXCLUDED.low_price,
       close_price = EXCLUDED.close_price,
       volume = EXCLUDED.volume`,
    [skinId, marketId, interval, pgInterval]
  );
}

// ── Seed realistic 30-day OHLC data for all skins ────────────────────────────

export async function seedHistoricalCandles(): Promise<void> {
  try {
    // Check if we already have OHLC data
    const existing = await queryOne('SELECT COUNT(*) as count FROM price_history_ohlc');
    if (existing && parseInt(existing.count) > 100) {
      logger.info('OHLC candle data already exists, skipping seed.');
      return;
    }

    // Check if we have real price_history data to aggregate from
    const historyCount = await queryOne('SELECT COUNT(*) as count FROM price_history');
    if (historyCount && parseInt(historyCount.count) > 50) {
      logger.info('Real price history found — aggregating into candles instead of seeding fake data.');
      // Aggregate real data for all active skin/market pairs
      const activePairs = await queryMany(
        `SELECT DISTINCT skin_id, market_id FROM price_history LIMIT 200`
      );
      for (const pair of activePairs) {
        for (const iv of VALID_INTERVALS) {
          await aggregateCandles(pair.skin_id, pair.market_id, iv);
        }
      }
      logger.info(`Aggregated real candle data for ${activePairs.length} pairs.`);
      return;
    }

    logger.info('Seeding initial candlestick data (will be replaced by real data over time)...');

    // Get top 50 skins by price — seed minimal fake data as placeholder
    const pairs = await queryMany(
      `SELECT DISTINCT ON (mp.skin_id) mp.skin_id, mp.market_id, mp.price
       FROM market_prices mp
       WHERE mp.price > 0
       ORDER BY mp.skin_id, mp.price DESC
       LIMIT 50`
    );

    if (pairs.length === 0) {
      logger.warn('No market prices found, cannot seed OHLC data.');
      return;
    }

    const now = new Date();
    let totalCandles = 0;

    for (const pair of pairs) {
      const basePrice = parseFloat(pair.price);
      if (basePrice <= 0) continue;

      // Generate candles for each interval
      for (const interval of VALID_INTERVALS) {
        const ms = INTERVAL_MS[interval];
        let candleCount: number;
        switch (interval) {
          case '1h': candleCount = 24 * 7; break;  // 168 hourly candles (7 days)
          case '4h': candleCount = 6 * 14; break;  // 84 4h candles (14 days)
          case '1d': candleCount = 30; break;       // 30 daily candles
          case '1w': candleCount = 8; break;        // 8 weekly candles
          default: candleCount = 30;
        }

        // Generate realistic price walk
        let price = basePrice * (0.85 + Math.random() * 0.15); // start 85-100% of current
        const volatility = getVolatilityForPrice(basePrice);

        const values: string[] = [];
        const params: any[] = [];
        let paramIdx = 1;

        for (let i = candleCount; i > 0; i--) {
          const candleTime = new Date(now.getTime() - i * ms);

          // Random walk with mean reversion toward current price
          const drift = (basePrice - price) * 0.02; // mean reversion
          const noise = (Math.random() - 0.48) * volatility * price;
          const open = Math.max(0.01, price);
          price = Math.max(0.01, price + drift + noise);
          const close = price;

          // High and low based on the candle range
          const range = Math.abs(close - open);
          const wickUp = Math.random() * range * 1.5;
          const wickDown = Math.random() * range * 1.5;
          const high = Math.max(open, close) + wickUp;
          const low = Math.max(0.01, Math.min(open, close) - wickDown);

          // Volume varies with price volatility
          const vol = Math.floor(20 + Math.random() * 200 * (1 + Math.abs(close - open) / open * 10));

          values.push(
            `($${paramIdx}, $${paramIdx + 1}, 'Factory New', $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4}, $${paramIdx + 5}, $${paramIdx + 6}, $${paramIdx + 7}, $${paramIdx + 8})`
          );
          params.push(
            pair.skin_id, pair.market_id, interval,
            round2(open), round2(high), round2(low), round2(close),
            vol, candleTime.toISOString()
          );
          paramIdx += 9;

          // Insert in batches of 100 to avoid huge queries
          if (values.length >= 100) {
            await query(
              `INSERT INTO price_history_ohlc (skin_id, market_id, exterior, interval, open_price, high_price, low_price, close_price, volume, timestamp)
               VALUES ${values.join(', ')}
               ON CONFLICT (skin_id, market_id, interval, timestamp) DO NOTHING`,
              params
            );
            totalCandles += values.length;
            values.length = 0;
            params.length = 0;
            paramIdx = 1;
          }
        }

        // Insert remaining
        if (values.length > 0) {
          await query(
            `INSERT INTO price_history_ohlc (skin_id, market_id, exterior, interval, open_price, high_price, low_price, close_price, volume, timestamp)
             VALUES ${values.join(', ')}
             ON CONFLICT (skin_id, market_id, interval, timestamp) DO NOTHING`,
            params
          );
          totalCandles += values.length;
        }
      }
    }

    logger.info(`Seeded ${totalCandles} OHLC candles for ${pairs.length} skin/market pairs.`);
  } catch (error) {
    logger.error('Failed to seed OHLC candle data:', error);
  }
}

// ── Periodic aggregation job ─────────────────────────────────────────────────

let aggregationInterval: ReturnType<typeof setInterval> | null = null;

export function startCandlestickAggregation(): void {
  if (aggregationInterval) return;

  logger.info('Starting candlestick aggregation (every 60s)...');

  // Run aggregation every 60 seconds for active pairs
  aggregationInterval = setInterval(async () => {
    try {
      // Get recently active pairs
      const activePairs = await queryMany(
        `SELECT DISTINCT skin_id, market_id
         FROM price_history
         WHERE timestamp > NOW() - INTERVAL '2 hours'
         LIMIT 50`
      );

      for (const pair of activePairs) {
        for (const interval of VALID_INTERVALS) {
          await aggregateCandles(pair.skin_id, pair.market_id, interval);
        }
      }
    } catch (error) {
      logger.error('Candlestick aggregation error:', error);
    }
  }, 60000);

  // Initial run
  setTimeout(async () => {
    try {
      const activePairs = await queryMany(
        `SELECT DISTINCT skin_id, market_id
         FROM market_prices
         LIMIT 20`
      );
      for (const pair of activePairs) {
        for (const interval of VALID_INTERVALS) {
          await aggregateCandles(pair.skin_id, pair.market_id, interval);
        }
      }
    } catch (err) {
      // non-critical
    }
  }, 5000);
}

export function stopCandlestickAggregation(): void {
  if (aggregationInterval) {
    clearInterval(aggregationInterval);
    aggregationInterval = null;
    logger.info('Candlestick aggregation stopped.');
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function getVolatilityForPrice(price: number): number {
  // Higher-priced items tend to have more absolute movement but similar % volatility
  if (price > 1000) return 0.015;
  if (price > 100) return 0.025;
  if (price > 10) return 0.035;
  return 0.05;
}
