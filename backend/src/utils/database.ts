import pkg from 'pg';
const { Pool } = pkg;
import { logger } from './logging';

let pool: pkg.Pool;

export async function initializeDatabase() {
  try {
    const useSSL = process.env.DB_SSL === 'true' || process.env.DATABASE_URL?.includes('supabase');

    // Use explicit connection params (not DATABASE_URL) to avoid Node 20 SSL issues
    const poolConfig: any = {
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'cs_skin_intelligence',
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };
    if (useSSL) {
      poolConfig.ssl = { rejectUnauthorized: false };
    }
    pool = new Pool(poolConfig);

    // Test connection
    const result = await pool.query('SELECT NOW()');
    logger.info('✓ Database connection successful');

    // Fix auto-increment sequences that may be out of sync
    await pool.query(`
      SELECT setval(pg_get_serial_sequence('market_prices', 'id'),
        COALESCE((SELECT MAX(id) FROM market_prices), 0) + 1, false)
    `).catch(err => logger.warn('Could not reset market_prices sequence:', err.message));

    return pool;
  } catch (error) {
    logger.error('❌ Failed to initialize database:', error);
    throw error;
  }
}

export function getPool(): pkg.Pool {
  if (!pool) {
    throw new Error('Database not initialized');
  }
  return pool;
}

export async function query(text: string, params?: any[]) {
  try {
    const result = await getPool().query(text, params);
    return result;
  } catch (error) {
    logger.error('Database query error:', { text, params, error });
    throw error;
  }
}

export async function queryOne(text: string, params?: any[]) {
  const result = await query(text, params);
  return result.rows[0] || null;
}

export async function queryMany(text: string, params?: any[]) {
  const result = await query(text, params);
  return result.rows;
}

export async function closeDatabase() {
  if (pool) {
    await pool.end();
    logger.info('✓ Database connection closed');
  }
}
