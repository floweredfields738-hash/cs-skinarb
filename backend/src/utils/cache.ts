import { createClient, RedisClientType } from 'redis';
import { logger } from './logging';

let redisClient: RedisClientType;

export async function initializeRedis() {
  try {
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = process.env.REDIS_PORT || '6379';
    redisClient = createClient({
      url: `redis://${redisHost}:${redisPort}`,
    });

    redisClient.on('error', (err: any) => logger.error('Redis error:', err));
    redisClient.on('connect', () => logger.info('✓ Redis connected'));

    await redisClient.connect();

    return redisClient;
  } catch (error) {
    logger.error('❌ Failed to initialize Redis:', error);
    throw error;
  }
}

export function getRedisClient(): RedisClientType {
  if (!redisClient) {
    throw new Error('Redis not initialized');
  }
  return redisClient;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const data = await getRedisClient().get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error('Cache get error:', { key, error });
    return null;
  }
}

export async function cacheSet(key: string, value: any, expiresIn: number = 3600) {
  try {
    await getRedisClient().setEx(key, expiresIn, JSON.stringify(value));
  } catch (error) {
    logger.error('Cache set error:', { key, error });
  }
}

export async function cacheDel(key: string) {
  try {
    await getRedisClient().del(key);
  } catch (error) {
    logger.error('Cache delete error:', { key, error });
  }
}

export async function cacheFlush() {
  try {
    await getRedisClient().flushDb();
    logger.info('✓ Cache flushed');
  } catch (error) {
    logger.error('Cache flush error:', error);
  }
}

export async function closeRedis() {
  if (redisClient) {
    await redisClient.disconnect();
    logger.info('✓ Redis connection closed');
  }
}
