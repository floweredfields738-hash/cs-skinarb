// Drop-in replacement for backend/src/utils/cache.ts
// Works without Redis — uses in-memory Map with TTL
// To activate: copy this file to backend/src/utils/cache.ts

import { createClient, RedisClientType } from 'redis';
import { logger } from './logging';

let redisClient: RedisClientType | null = null;
let useMemoryCache = false;

// In-memory fallback cache
const memoryCache = new Map<string, { value: string; expires: number }>();

export async function initializeRedis() {
  const redisHost = process.env.REDIS_HOST;
  const redisPort = process.env.REDIS_PORT || '6379';

  // If no Redis host configured, use memory cache
  if (!redisHost) {
    logger.info('✓ Redis not configured — using in-memory cache');
    useMemoryCache = true;
    return null;
  }

  try {
    const redisPassword = process.env.REDIS_PASSWORD;
    const redisUrl = process.env.REDIS_URL ||
      (redisPassword
        ? `redis://default:${redisPassword}@${redisHost}:${redisPort}`
        : `redis://${redisHost}:${redisPort}`);

    redisClient = createClient({ url: redisUrl });

    redisClient.on('error', (err: any) => {
      logger.warn('Redis error, falling back to memory cache:', err.message);
      useMemoryCache = true;
    });
    redisClient.on('connect', () => logger.info('✓ Redis connected'));

    await redisClient.connect();
    return redisClient;
  } catch (error: any) {
    logger.warn(`Redis unavailable (${error.message}) — using in-memory cache`);
    useMemoryCache = true;
    return null;
  }
}

export function getRedisClient(): RedisClientType | null {
  return redisClient;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    if (useMemoryCache || !redisClient) {
      const entry = memoryCache.get(key);
      if (!entry) return null;
      if (Date.now() > entry.expires) {
        memoryCache.delete(key);
        return null;
      }
      return JSON.parse(entry.value);
    }
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: any, expiresIn: number = 3600) {
  try {
    const serialized = JSON.stringify(value);
    if (useMemoryCache || !redisClient) {
      memoryCache.set(key, { value: serialized, expires: Date.now() + expiresIn * 1000 });
      // Prevent memory leak — cap at 1000 entries
      if (memoryCache.size > 1000) {
        const firstKey = memoryCache.keys().next().value;
        if (firstKey) memoryCache.delete(firstKey);
      }
      return;
    }
    await redisClient.setEx(key, expiresIn, serialized);
  } catch { /* silent */ }
}

export async function cacheDel(key: string) {
  try {
    if (useMemoryCache || !redisClient) {
      memoryCache.delete(key);
      return;
    }
    await redisClient.del(key);
  } catch { /* silent */ }
}

export async function cacheFlush() {
  try {
    if (useMemoryCache || !redisClient) {
      memoryCache.clear();
      logger.info('✓ Memory cache flushed');
      return;
    }
    await redisClient.flushDb();
    logger.info('✓ Cache flushed');
  } catch { /* silent */ }
}

export async function closeRedis() {
  if (redisClient) {
    await redisClient.disconnect();
    logger.info('✓ Redis connection closed');
  }
}
