import pkg from 'pg';
const { Pool } = pkg;
import { logger } from './logging';

let pool: pkg.Pool;

export async function initializeDatabase() {
  try {
    pool = new Pool({
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'cs_skin_intelligence',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Test connection
    const result = await pool.query('SELECT NOW()');
    logger.info('✓ Database connection successful');

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
