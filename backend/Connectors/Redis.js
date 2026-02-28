import { createClient } from 'redis';
import { redis as redisConfig } from '../Confs/config.js'; // Adjust path if needed
import { LoggerContainer, flushLogger } from "../Logger/Logger.js";

const RLogger = LoggerContainer.get("Redis");

const {
  host: REDIS_HOST,
  port: REDIS_PORT,
  username: REDIS_USERNAME,
  password: REDIS_PASSWORD,
  db: REDIS_DB = 0,
  poolMax: REDIS_MAX_SESSIONS = 1000, // reusing poolMax as maxSessions
} = redisConfig;

let redisClient;
let redisInitPromise = null;
let evictionSchedulerStarted = false;

const LRU_ZSET_KEY = 'meta:lru';
const LIFO_STACK_KEY = 'meta:lifo';

/**
 * Initialize Redis connection
 */
export async function initRedis() {
  if (redisClient?.isOpen) return redisClient;
  if (redisInitPromise) return redisInitPromise;

  redisInitPromise = (async () => {
    try {
      if (!redisClient) {
        redisClient = createClient({
          username: REDIS_USERNAME || undefined,
          socket: {
            host: REDIS_HOST,
            port: REDIS_PORT,
            connectTimeout: 10000,
          },
          password: REDIS_PASSWORD || undefined,
          database: REDIS_DB,
        });

        redisClient.on('error', (err) => {
          RLogger.error(`❌ Redis Client Error: ${err.message}`);
        });
      }

      if (!redisClient.isOpen) {
        await redisClient.connect();
        RLogger.info('🔗 Redis connected');
      }

      // Start eviction loop only after Redis is ready
      startEvictionScheduler();
      return redisClient;
    } catch (err) {
      RLogger.error(`❌ Redis Initialization Error: ${err.message}`);
      await flushLogger();
      throw err;
    } finally {
      redisInitPromise = null;
    }
  })();

  return redisInitPromise;
}

/**
 * Accessor for Redis client (enforces prior init)
 */
export function getRedisClient() {
  if (!redisClient || !redisClient.isOpen) {
    throw new Error('Redis client not initialized. Call initRedis() first.');
  }
  return redisClient;
}

export async function getOrInitRedisClient() {
  await initRedis();
  return getRedisClient();
}

// ─────────────────────────────────────────────
// SESSION MANAGEMENT HELPERS
// ─────────────────────────────────────────────

/**
 * Store session and update LRU + LIFO + active sets
 */
export async function userLogin(userId, sessionData) {
  const redis = await getOrInitRedisClient();
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
  const redis = await getOrInitRedisClient();
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
  const redis = await getOrInitRedisClient();
  const key = `session:${userId}`;

  await redis.del(key);
  await redis.zRem(LRU_ZSET_KEY, key);
  await redis.lRem(LIFO_STACK_KEY, 1, key);
  await redis.sRem('meta:active', key);
}

/**
 * Hybrid LRU + LIFO eviction strategy
 */
async function enforceHybridEviction() {
  const redis = await getOrInitRedisClient();
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
  }
}

/**
 * Starts periodic eviction scheduler
 */
function startEvictionScheduler() {
  if (evictionSchedulerStarted) return;
  evictionSchedulerStarted = true;
  setInterval(() => {
    enforceHybridEviction().catch(RLogger.error);
  }, 60_000); // every 60 seconds
}

// ─────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────

export {
  LRU_ZSET_KEY,
  LIFO_STACK_KEY,
};
