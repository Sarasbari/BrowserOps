import { redis } from "./queue";

interface RateLimitOptions {
  key: string;
  limit: number;
  durationSeconds: number;
}

// In-memory fallback if Redis fails or isn't connected
const memoryStore = new Map<string, number[]>();

export async function rateLimit(options: RateLimitOptions): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}> {
  const { key, limit, durationSeconds } = options;
  const now = Date.now();
  const windowStart = now - durationSeconds * 1000;

  try {
    // Check if redis is connected (status === 'ready')
    if (redis && redis.status === "ready") {
      const redisKey = `ratelimit:${key}`;
      
      const transaction = redis.multi();
      // Remove elements older than windowStart
      transaction.zremrangebyscore(redisKey, 0, windowStart);
      // Get all elements in window
      transaction.zcard(redisKey);
      // Add current timestamp
      transaction.zadd(redisKey, now.toString(), now.toString());
      // Set TTL
      transaction.expire(redisKey, durationSeconds);
      
      const results = await transaction.exec();
      if (!results) {
        throw new Error("Redis transaction failed");
      }

      // zcard result is at index 1
      const count = results[1][1] as number;
      
      const success = count < limit;
      const remaining = Math.max(0, limit - (success ? count + 1 : count));
      
      return {
        success,
        limit,
        remaining,
        reset: Math.round((now + durationSeconds * 1000) / 1000),
      };
    }
  } catch (err) {
    console.warn("Redis rate limiter failed, falling back to in-memory: ", err);
  }

  // In-memory fallback
  if (!memoryStore.has(key)) {
    memoryStore.set(key, []);
  }

  const timestamps = memoryStore.get(key) || [];
  
  // Filter timestamps within window
  const validTimestamps = timestamps.filter((t) => t > windowStart);
  
  const count = validTimestamps.length;
  const success = count < limit;
  
  if (success) {
    validTimestamps.push(now);
  }
  
  memoryStore.set(key, validTimestamps);
  
  return {
    success,
    limit,
    remaining: Math.max(0, limit - validTimestamps.length),
    reset: Math.round((now + durationSeconds * 1000) / 1000),
  };
}
