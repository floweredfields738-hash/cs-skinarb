/**
 * Run OHLC migration and seed historical candlestick data.
 *
 * Usage:
 *   npx ts-node scripts/run-ohlc-migration.ts
 *
 * Or via the backend's database utils:
 *   node -e "require('./backend/src/utils/database').initializeDatabase().then(...);"
 */

import { initializeDatabase, query, closeDatabase } from '../backend/src/utils/database';
import { seedHistoricalCandles } from '../backend/src/services/candlestickService';
import { logger } from '../backend/src/utils/logging';

async function main() {
  try {
    await initializeDatabase();
    logger.info('Running OHLC migration...');

    // Create table if not exists
    await query(`
      CREATE TABLE IF NOT EXISTS price_history_ohlc (
        id BIGSERIAL PRIMARY KEY,
        skin_id INT NOT NULL REFERENCES skins(id) ON DELETE CASCADE,
        market_id INT NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
        exterior VARCHAR(50) DEFAULT 'Factory New',
        interval VARCHAR(10) NOT NULL,
        open_price DECIMAL(12, 2) NOT NULL,
        high_price DECIMAL(12, 2) NOT NULL,
        low_price DECIMAL(12, 2) NOT NULL,
        close_price DECIMAL(12, 2) NOT NULL,
        volume INT DEFAULT 0,
        timestamp TIMESTAMP NOT NULL,
        UNIQUE(skin_id, market_id, interval, timestamp)
      )
    `);

    await query(`CREATE INDEX IF NOT EXISTS idx_price_history_ohlc_composite ON price_history_ohlc(skin_id, market_id, interval, timestamp DESC)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_price_history_ohlc_interval ON price_history_ohlc(interval, timestamp DESC)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_price_history_ohlc_skin_interval ON price_history_ohlc(skin_id, interval, timestamp DESC)`);

    logger.info('OHLC table and indexes created.');

    // Seed historical data
    await seedHistoricalCandles();

    logger.info('OHLC migration complete.');
    await closeDatabase();
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

main();
