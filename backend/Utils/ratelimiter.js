// filename: AdaptiveRateLimiter.js
import { initRedis } from "../Connectors/Redis.js";

const REDIS_PREFIX = "ratelimit:";
const DEFAULT_WINDOW_MS = 60 * 1000;       // 1 minute
const DEFAULT_BURST_WINDOW_MS = 10 * 1000; // 10 seconds

// Circuit-breaker / redis health parameters (tweak to taste)
const REDIS_FAILURE_THRESHOLD = 3;     // how many consecutive failures before tripping
const REDIS_FAILURE_WINDOW_MS = 10 * 1000; // window to count failures
const REDIS_COOLDOWN_MS = 30 * 1000;  // stay in fallback for this long when tripped

let redisClient;
let initialized = false;

// Circuit breaker state
let redisFailureCount = 0;
let lastRedisFailureAt = 0;
let redisTrippedUntil = 0;

// In-memory fallback
const memoryStore = new Map();

// Memory GC interval (clean entries that haven't seen activity in 10 minutes)
const MEMORY_GC_INTERVAL_MS = 10 * 60 * 1000;
const MEMORY_ENTRY_TTL_MS = 10 * 60 * 1000;

let memoryGcHandle = null;

async function lazyInit() {
  if (initialized) return;
  try {
    await initRedis();
    // your getRedisClient() should return an already connected redis v4 client
    redisClient = (await import("../Connectors/Redis.js")).getRedisClient();
    initialized = true;
  } catch (err) {
    console.warn("Redis initialization failed, using in-memory fallback:", err.message);
    redisClient = null;
  }
  // start memory GC once
  if (!memoryGcHandle) {
    memoryGcHandle = setInterval(() => {
      const now = Date.now();
      for (const [ip, rec] of memoryStore.entries()) {
        if ((now - (rec.lastSeen || 0)) > MEMORY_ENTRY_TTL_MS) {
          memoryStore.delete(ip);
        }
      }
    }, MEMORY_GC_INTERVAL_MS);
  }
}

/**
 * Circuit-aware safe Redis call helper.
 * - Immediately returns fallbackValue when circuit is tripped.
 * - On Redis errors, increments failure counter and trips circuit if threshold exceeded.
 * - On success, resets failure counter.
 *
 * @param {Function} fn async function that executes Redis calls (must return value)
 * @param {*} fallbackValue value to return on failure
 */
async function safeRedisCall(fn, fallbackValue) {
  const now = Date.now();

  // if circuit is tripped, and still in cooldown, skip redis
  if (redisTrippedUntil && now < redisTrippedUntil) {
    return fallbackValue;
  }

  try {
    const result = await fn();
    // success -> reset failure counters
    redisFailureCount = 0;
    lastRedisFailureAt = 0;
    return result;
  } catch (err) {
    // failure -> bump counters
    const prevFailureAt = lastRedisFailureAt || 0;
    if (!prevFailureAt || now - prevFailureAt > REDIS_FAILURE_WINDOW_MS) {
      // outside window: reset counter
      redisFailureCount = 1;
    } else {
      redisFailureCount += 1;
    }
    lastRedisFailureAt = now;

    if (redisFailureCount >= REDIS_FAILURE_THRESHOLD) {
      // trip the circuit for cooldown duration
      redisTrippedUntil = now + REDIS_COOLDOWN_MS;
      console.warn(`Redis circuit tripped until ${new Date(redisTrippedUntil).toISOString()}. Error:`, err?.message || err);
    } else {
      console.warn("Redis transient error:", err?.message || err);
    }

    return fallbackValue;
  }
}

/**
 * Lua script to atomically:
 *  - INCR fixedKey (set PEXPIRE on first)
 *  - ZREMRANGEBYSCORE on burstKey (older than now - burstWindowMs)
 *  - ZADD current timestamp to burstKey
 *  - ZCARD burstKey
 *  - PEXPIRE burstKey to windowMs + burstWindowMs
 *  - GET penaltyKey (no expiry change)
 *
 * Returns {fixedCount, burstCount, penalty}
 */
const LUA_READ_COUNTS = `
  local now = tonumber(ARGV[1])
  local windowMs = tonumber(ARGV[2])
  local burstWindowMs = tonumber(ARGV[3])

  local fixedCount = redis.call("INCR", KEYS[1])
  if fixedCount == 1 then
    redis.call("PEXPIRE", KEYS[1], windowMs)
  end

  -- maintain sliding window via zset
  redis.call("ZREMRANGEBYSCORE", KEYS[2], 0, now - burstWindowMs)
  redis.call("ZADD", KEYS[2], now, tostring(now))
  local burstCount = redis.call("ZCARD", KEYS[2])
  redis.call("PEXPIRE", KEYS[2], windowMs + burstWindowMs)

  local penalty = redis.call("GET", KEYS[3])
  if not penalty then penalty = "0" end

  return {tostring(fixedCount), tostring(burstCount), tostring(penalty)}
`;

/**
 * Lua script to increment penalty atomically and set PX expiry (penaltyDecayMs)
 * Keys: [penaltyKey]
 * ARGV[1] = penaltyDecayMs
 * Returns new penalty value as string
 */
const LUA_INC_PENALTY = `
  local cur = tonumber(redis.call("GET", KEYS[1]) or "0")
  cur = cur + 1
  local px = tonumber(ARGV[1])
  if px and px > 0 then
    redis.call("SET", KEYS[1], tostring(cur), "PX", px)
  else
    redis.call("SET", KEYS[1], tostring(cur))
  end
  return tostring(cur)
`;

/**
 * Utility to call the read-counts Lua script
 */
async function redisReadCounts(fixedKey, burstKey, penaltyKey, now, windowMs, burstWindowMs) {
  if (!redisClient) return null;
  // EVAL the script
  const res = await redisClient.eval(LUA_READ_COUNTS, {
    keys: [fixedKey, burstKey, penaltyKey],
    arguments: [now.toString(), windowMs.toString(), burstWindowMs.toString()],
  });
  // res is array of strings
  return res;
}

/**
 * Utility to increment penalty in redis atomically
 */
async function redisIncPenalty(penaltyKey, penaltyDecayMs) {
  if (!redisClient) return null;
  const res = await redisClient.eval(LUA_INC_PENALTY, {
    keys: [penaltyKey],
    arguments: [penaltyDecayMs.toString()],
  });
  return res;
}

// --- Hybrid Adaptive Ratelimiter with improved Redis reliability ---
const Ratelimiter = ({
  windowMs = DEFAULT_WINDOW_MS,
  burstWindowMs = DEFAULT_BURST_WINDOW_MS,
  baseMax = 100,          // steady requests per window
  baseBurst = 20,         // burst requests per burstWindow
  penaltyDecayMs = 5 * 60 * 1000, // 5 minutes decay time
  maxPenalty = 5,         // cap to prevent infinite blocking
} = {}) => async (req, res, next) => {
  await lazyInit();
  const ip = req.ip;
  const endpoint = req.originalUrl || req.url || "unknown";
  const now = Date.now();

  const fixedKey = `${REDIS_PREFIX}fixed:${endpoint}:${ip}`;
  const burstKey = `${REDIS_PREFIX}burst:${endpoint}:${ip}`;
  const penaltyKey = `${REDIS_PREFIX}penalty:${endpoint}:${ip}`;

  let fixedCount = 0;
  let burstCount = 0;
  let penalty = 0;

  const useRedis = redisClient && (!redisTrippedUntil || Date.now() >= redisTrippedUntil);

  if (useRedis) {
    // Attempt atomic read/update via Lua. If it fails the safeRedisCall will manage circuit.
    const resArr = await safeRedisCall(
      () => redisReadCounts(fixedKey, burstKey, penaltyKey, now, windowMs, burstWindowMs),
      null
    );

    if (resArr && Array.isArray(resArr) && resArr.length >= 3) {
      fixedCount = parseInt(resArr[0], 10) || 0;
      burstCount = parseInt(resArr[1], 10) || 0;
      penalty = parseInt(resArr[2], 10) || 0;
    } else {
      // fallback to in-memory if redis read failed or circuit tripped
      // Note: safeRedisCall already updates circuit breaker if needed.
      // Continue to memory fallback below.
    }
  }

  if (!useRedis || (fixedCount === 0 && burstCount === 0 && penalty === 0 && redisClient)) {
    // Memory fallback path or redis read failed.
    const record = memoryStore.get(ip) || {
      fixed: [],
      burst: [],
      penalty: 0,
      lastPenaltyAt: now,
      lastSeen: now,
    };

    // fixed window counting
    record.fixed = record.fixed.filter(ts => ts > now - windowMs);
    record.fixed.push(now);

    // burst window counting
    record.burst = record.burst.filter(ts => ts > now - burstWindowMs);
    record.burst.push(now);

    // penalty decay: compute how many decay steps should have happened
    const elapsed = now - (record.lastPenaltyAt || now);
    if (elapsed >= penaltyDecayMs && record.penalty > 0) {
      // decay by floor(elapsed / penaltyDecayMs) but at least 1
      const steps = Math.floor(elapsed / penaltyDecayMs);
      record.penalty = Math.max(0, record.penalty - steps);
      record.lastPenaltyAt = now;
    }

    record.lastSeen = now;
    memoryStore.set(ip, record);

    fixedCount = record.fixed.length;
    burstCount = record.burst.length;
    penalty = record.penalty;
  }

  // --- Adaptive thresholds (same hybrid idea) ---
  const penaltyFactor = Math.max(1, penalty);

  // Soft opening: small activity-based boost, bounded
  const activityBoost = Math.min(20, Math.floor(fixedCount / 10));

  // Hard closing: penalties cut limits aggressively (tweak multiplier to taste)
  const adaptiveMax = Math.max(5, baseMax + activityBoost - penaltyFactor * 15);
  const adaptiveBurst = Math.max(3, baseBurst + Math.floor(burstCount / 5) - penaltyFactor * 5);

  // --- Enforcement ---
  if (fixedCount > adaptiveMax || burstCount > adaptiveBurst) {
    // Increase penalty for sustained abuse (atomic in redis if available)
    if (useRedis) {
      // increment penalty atomically and set expiry
      await safeRedisCall(
        () => redisIncPenalty(penaltyKey, penaltyDecayMs),
        null
      );
    } else {
      // memory fallback inc
      const rec = memoryStore.get(ip);
      if (rec) {
        rec.penalty = Math.min(maxPenalty, (rec.penalty || 0) + 1);
        rec.lastPenaltyAt = now;
        memoryStore.set(ip, rec);
      }
    }

    // helpful headers
    res.set("Retry-After", Math.ceil(windowMs / 1000));
    res.set("X-RateLimit-Limit", adaptiveMax);
    res.set("X-RateLimit-Remaining", Math.max(0, adaptiveMax - fixedCount));
    res.set("X-RateLimit-Burst-Limit", adaptiveBurst);
    res.set("X-RateLimit-Burst-Remaining", Math.max(0, adaptiveBurst - burstCount));
    res.set("X-RateLimit-Penalty", penalty);

    return res.status(429).json({
      message: "Too many requests, please try again later.",
      retryAfter: Math.ceil(windowMs / 1000),
      limits: { adaptiveMax, adaptiveBurst, penalty },
    });
  }

  // success path: set headers with current values
  res.set("X-RateLimit-Limit", adaptiveMax);
  res.set("X-RateLimit-Remaining", Math.max(0, adaptiveMax - fixedCount));
  res.set("X-RateLimit-Burst-Limit", adaptiveBurst);
  res.set("X-RateLimit-Burst-Remaining", Math.max(0, adaptiveBurst - burstCount));
  res.set("X-RateLimit-Penalty", penalty);

  next();
};

export default Ratelimiter;
