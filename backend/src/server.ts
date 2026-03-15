import dotenv from 'dotenv';
import { createServer } from './app';
import { initializeDatabase } from './utils/database';
import { initializeRedis } from './utils/cache';
import { logger } from './utils/logging';
import { seedDatabase } from './services/seedData';
import { startPriceSimulator, stopPriceSimulator } from './services/priceSimulator';
import { startRealDataSync, stopRealDataSync } from './services/realDataSync';
import { seedHistoricalCandles, startCandlestickAggregation, stopCandlestickAggregation } from './services/candlestickService';

dotenv.config();

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const USE_REAL_DATA = process.env.USE_REAL_DATA === 'true';

async function startServer() {
  try {
    logger.info('🚀 Starting CS Skin Intelligence Platform...');
    logger.info(`📡 Environment: ${NODE_ENV}`);

    // Initialize Database
    logger.info('📊 Initializing database connection...');
    await initializeDatabase();
    logger.info('✓ Database connected');

    // Initialize Redis
    logger.info('⚡ Initializing Redis...');
    await initializeRedis();
    logger.info('✓ Redis connected');

    // Seed database with initial data if empty
    logger.info('🌱 Checking database seed data...');
    await seedDatabase();

    // Run OHLC migration and seed candlestick data
    logger.info('📊 Ensuring OHLC candlestick table exists...');
    try {
      await initializeDatabase(); // ensure pool is ready
      const { query: dbQuery } = await import('./utils/database');
      await dbQuery(`
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
      await dbQuery(`CREATE INDEX IF NOT EXISTS idx_price_history_ohlc_composite ON price_history_ohlc(skin_id, market_id, interval, timestamp DESC)`);
      await dbQuery(`CREATE INDEX IF NOT EXISTS idx_price_history_ohlc_interval ON price_history_ohlc(interval, timestamp DESC)`);
      await dbQuery(`CREATE INDEX IF NOT EXISTS idx_price_history_ohlc_skin_interval ON price_history_ohlc(skin_id, interval, timestamp DESC)`);
      await seedHistoricalCandles();
      logger.info('✓ OHLC candlestick data ready');
    } catch (ohlcErr) {
      logger.warn('OHLC setup skipped (non-critical):', ohlcErr);
    }

    // Create and start server
    const server = createServer();

    server.listen(PORT, () => {
      logger.info(`✅ Server running on port ${PORT}`);
      logger.info(`🔗 http://localhost:${PORT}`);
      logger.info(`📍 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);

      if (USE_REAL_DATA) {
        // Real market data from Steam, Skinport, CSFloat APIs
        logger.info('📈 Mode: REAL DATA — connecting to market APIs...');
        startRealDataSync();
      } else {
        // Simulated price movements for development
        logger.info('🎮 Mode: SIMULATION — using price simulator');
        startPriceSimulator();
      }

      // Start candlestick aggregation (converts price_history ticks into OHLC)
      startCandlestickAggregation();
    });

    // Graceful Shutdown
    process.on('SIGTERM', async () => {
      logger.info('📩 SIGTERM received, shutting down gracefully...');
      if (USE_REAL_DATA) { stopRealDataSync(); } else { stopPriceSimulator(); }
      stopCandlestickAggregation();
      server.close(async () => {
        logger.info('✓ Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      logger.info('📩 SIGINT received, shutting down gracefully...');
      if (USE_REAL_DATA) { stopRealDataSync(); } else { stopPriceSimulator(); }
      stopCandlestickAggregation();
      server.close(async () => {
        logger.info('✓ Server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
