import { createClient, RedisClientType } from 'redis';

let redisClient: RedisClientType;

export async function connectRedis(): Promise<void> {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    redisClient = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 5000,
      },
    });

    redisClient.on('error', (error) => {
      console.error('❌ Redis connection error:', error);
    });

    redisClient.on('connect', () => {
      console.log('🔄 Connecting to Redis...');
    });

    redisClient.on('ready', () => {
      console.log('✅ Connected to Redis');
    });

    redisClient.on('end', () => {
      console.warn('⚠️ Redis connection ended');
    });

    redisClient.on('reconnecting', () => {
      console.log('🔄 Reconnecting to Redis...');
    });

    await redisClient.connect();
    
    // Test the connection
    await redisClient.ping();
    
  } catch (error) {
    console.error('❌ Failed to connect to Redis:', error);
    // Don't throw error - Redis is optional for basic functionality
    console.warn('⚠️ Continuing without Redis (caching disabled)');
  }
}

export async function disconnectRedis(): Promise<void> {
  try {
    if (redisClient && redisClient.isOpen) {
      await redisClient.quit();
      console.log('✅ Disconnected from Redis');
    }
  } catch (error) {
    console.error('❌ Error disconnecting from Redis:', error);
  }
}

export function getRedisClient(): RedisClientType | null {
  return redisClient && redisClient.isOpen ? redisClient : null;
}

// Cache utilities
export class CacheService {
  private static instance: CacheService;
  
  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const client = getRedisClient();
      if (!client) return null;
      
      const value = await client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<boolean> {
    try {
      const client = getRedisClient();
      if (!client) return false;
      
      await client.setEx(key, ttlSeconds, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      const client = getRedisClient();
      if (!client) return false;
      
      await client.del(key);
      return true;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const client = getRedisClient();
      if (!client) return false;
      
      const result = await client.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  }

  async increment(key: string, ttlSeconds: number = 3600): Promise<number> {
    try {
      const client = getRedisClient();
      if (!client) return 0;
      
      const result = await client.incr(key);
      if (result === 1) {
        // First increment, set TTL
        await client.expire(key, ttlSeconds);
      }
      return result;
    } catch (error) {
      console.error('Cache increment error:', error);
      return 0;
    }
  }

  async getPattern(pattern: string): Promise<string[]> {
    try {
      const client = getRedisClient();
      if (!client) return [];
      
      return await client.keys(pattern);
    } catch (error) {
      console.error('Cache pattern get error:', error);
      return [];
    }
  }
}
