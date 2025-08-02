import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const {
  REDIS_HOST,
  REDIS_PORT,
  REDIS_PASSWORD,
  REDIS_MAX_SESSIONS = 1000,
} = process.env;

let redisClient;

const LRU_ZSET_KEY = 'meta:lru';
const LIFO_STACK_KEY = 'meta:lifo';

/**
 * Initialize Redis connection
 */
export async function initRedis() {
  try {
    redisClient = createClient({
      url: `redis://${REDIS_HOST}:${REDIS_PORT}`,
      password: REDIS_PASSWORD,
      socket: {
        connectTimeout: 10000,
      },
    });

    redisClient.on('error', (err) => {
      console.error('❌ Redis Client Error', err);
    });

    await redisClient.connect();
    console.log('🔗 Redis connected');

    // ✅ Start eviction loop only after Redis is ready
    startEvictionScheduler();
  } catch (error) {
    console.error('❌ Redis Initialization Error:', error.message);
    process.exit(1);
  }
}

/**
 * Accessor for Redis client (enforces prior init)
 */
export function getRedisClient() {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call initRedis() first.');
  }
  return redisClient;
}

// ─────────────────────────────────────────────
// SESSION MANAGEMENT HELPERS
// ─────────────────────────────────────────────

/**
 * Store session and update LRU + LIFO + active sets
 */
export async function userLogin(userId, sessionData) {
  const redis = getRedisClient();
  const key = `session:${userId}`;
  const now = Date.now();

  await redis.set(key, JSON.stringify(sessionData));
  await redis.zAdd(LRU_ZSET_KEY, [{ score: now, value: key }]);
  await redis.lPush(LIFO_STACK_KEY, key);
  await redis.sAdd('meta:active', key);

  await enforceHybridEviction();
}

/**
 * Touch session on access (LRU refresh)
 */
export async function userAccess(userId) {
  const redis = getRedisClient();
  const key = `session:${userId}`;
  const now = Date.now();

  const session = await redis.get(key);
  if (!session) return null;

  await redis.zAdd(LRU_ZSET_KEY, [{ score: now, value: key }]);
  return JSON.parse(session);
}

/**
 * Destroy session and clean up metadata
 */
export async function userLogout(userId) {
  const redis = getRedisClient();
  const key = `session:${userId}`;

  await redis.del(key);
  await redis.zRem(LRU_ZSET_KEY, key);
  await redis.lRem(LIFO_STACK_KEY, 1, key);
  await redis.sRem('meta:active', key);

  console.log(`🚪 Logged out: ${userId}`);
}

/**
 * Hybrid LRU + LIFO eviction strategy
 */
async function enforceHybridEviction() {
  const redis = getRedisClient();
  const currentSessions = await redis.zCard(LRU_ZSET_KEY);
  const maxSessions = parseInt(REDIS_MAX_SESSIONS, 10);

  if (currentSessions <= maxSessions) return;

  const [lruEvict] = await redis.zRange(LRU_ZSET_KEY, 0, 0);
  const [lifoEvict] = await redis.lRange(LIFO_STACK_KEY, -1, -1);

  const candidate = Math.random() < 0.5 ? lruEvict : lifoEvict;

  if (candidate) {
    await redis.del(candidate);
    await redis.zRem(LRU_ZSET_KEY, candidate);
    await redis.lRem(LIFO_STACK_KEY, 1, candidate);
    await redis.sRem('meta:active', candidate);
    console.log(`♻️ Evicted stale session: ${candidate}`);
  }
}

/**
 * Starts periodic eviction scheduler
 */
function startEvictionScheduler() {
  setInterval(() => {
    enforceHybridEviction().catch(console.error);
  }, 60_000); // every 60 seconds
}

// ─────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────

export {
  LRU_ZSET_KEY,
  LIFO_STACK_KEY,
};
