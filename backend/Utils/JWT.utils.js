import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getOrInitRedisClient } from '../Connectors/Redis.js';

const JWT_SECRET_PREFIX = 'jwt:secret:';
const CURRENT_KID_KEY = 'jwt:current_kid';
const KID_LIST_KEY = 'jwt:kid_list';
const REVOCATION_SET_PREFIX = 'jwt:revoked:';
const USER_REVOCATION_PREFIX = 'jwt:revoked:user:'; // 👈 NEW
const ROTATION_INTERVAL = 10 * 60 * 1000; // 10 min
const TOKEN_TTL_SECONDS = 10 * 60;        // 10 min
const MAX_KIDS = 2;

let initialized = false;
let rotationInFlight = null;

function parseJwtHeader(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) {
    throw new Error("Invalid token format");
  }

  const base64 = parts[0].replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');

  let header;
  try {
    header = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch {
    throw new Error("Invalid token header");
  }

  if (!header || typeof header !== 'object' || !header.kid) {
    throw new Error("Missing kid in token header");
  }

  return header;
}

async function lazyInit() {
  if (initialized) return;
  await getOrInitRedisClient();
  startRotationScheduler();
  initialized = true;
}

function generateSecret() {
  return crypto.randomBytes(64).toString('hex');
}

function generateJTI() {
  return crypto.randomUUID();
}

async function rotateSecret() {
  if (rotationInFlight) return rotationInFlight;

  rotationInFlight = (async () => {
    const redis = await getOrInitRedisClient();
    const newKid = Date.now().toString();
    const newSecret = generateSecret();

    await redis.set(`${JWT_SECRET_PREFIX}${newKid}`, newSecret);
    await redis.set(CURRENT_KID_KEY, newKid);
    await redis.lPush(KID_LIST_KEY, newKid);
    const knownKids = await redis.lRange(KID_LIST_KEY, 0, -1);
    const staleKids = knownKids.slice(MAX_KIDS);

    for (const oldKid of staleKids) {
      await redis.del(`${JWT_SECRET_PREFIX}${oldKid}`);
    }
    await redis.lTrim(KID_LIST_KEY, 0, MAX_KIDS - 1);

    console.log(`🔁 JWT secret rotated. New kid: ${newKid} at ${new Date().toISOString()}`);
  })();

  try {
    await rotationInFlight;
  } finally {
    rotationInFlight = null;
  }
}

function startRotationScheduler() {
  rotateSecret().catch(console.error);
  setInterval(() => {
    rotateSecret().catch(console.error);
  }, ROTATION_INTERVAL);
}

/**
 * 🔑 Generate a JWT with user_id included
 */
async function generateToken(payload) {
  await lazyInit();

  if (!payload.user_id) {
    throw new Error("Payload must include user_id");
  }

  const redis = await getOrInitRedisClient();
  const kid = await redis.get(CURRENT_KID_KEY);
  if (!kid) throw new Error('Current KID not found');

  const secret = await redis.get(`${JWT_SECRET_PREFIX}${kid}`);
  if (!secret) throw new Error(`Secret not found for kid=${kid}`);

  const jti = generateJTI();

  const token = jwt.sign({ ...payload, jti }, secret, {
    algorithm: 'HS512',
    expiresIn: `${TOKEN_TTL_SECONDS}s`,
    header: { kid },
  });

  console.log(`✅ JWT generated with kid: ${kid}, jti: ${jti}`);
  return token;
}

/**
 * 🔎 Verify JWT with optional revocation
 */
async function verifyToken(token, options = { revoke: true }) {
  await lazyInit();

  const { kid } = parseJwtHeader(token);
  const redis = await getOrInitRedisClient();

  const secret = await redis.get(`${JWT_SECRET_PREFIX}${kid}`);
  if (!secret) throw new Error(`Secret not found for kid=${kid}`);

  const payload = jwt.verify(token, secret, { algorithms: ["HS512"] });

  // 🔍 Check if user has been globally revoked
  const userRevokedAt = await redis.get(`${USER_REVOCATION_PREFIX}${payload.user_id}`);
  if (userRevokedAt) {
    throw new Error("User account revoked");
  }

  const jtiKey = `${REVOCATION_SET_PREFIX}${payload.jti}`;

  // 🛡️ Always check if token was revoked (replay attack protection)
  const alreadyRevoked = await redis.get(jtiKey);
  if (alreadyRevoked) {
    throw new Error("Token has been revoked or reused");
  }

  // 🔐 Only write revocation if intended
  if (options.revoke) {
    const lua = `
      local key = KEYS[1]
      if redis.call("GET", key) then
        return 0
      else
        redis.call("SET", key, "revoked", "EX", ARGV[1])
        return 1
      end
    `;
    const success = await redis.eval(lua, {
      keys: [jtiKey],
      arguments: [String(TOKEN_TTL_SECONDS)],
    });

    if (success === 0) {
      throw new Error("Token has already been used or revoked");
    }

    console.log(`🛡️ Token verified and now revoked: jti=${payload.jti}`);
  } else {
    console.log(`🔎 Token verified (read-only): jti=${payload.jti}`);
  }

  return payload; // includes user_id
}

/**
 * ❌ Manual revocation by JTI
 */
async function revokeToken(token) {
  await lazyInit();

  const { kid } = parseJwtHeader(token);
  const redis = await getOrInitRedisClient();
  const secret = await redis.get(`${JWT_SECRET_PREFIX}${kid}`);
  if (!secret) throw new Error(`Secret not found for kid=${kid}`);

  const payload = jwt.verify(token, secret, { algorithms: ["HS512"] });
  if (!payload || typeof payload !== "object" || !payload.jti) {
    throw new Error('Cannot revoke: missing JTI');
  }

  await redis.set(`${REVOCATION_SET_PREFIX}${payload.jti}`, 'revoked', {
    EX: TOKEN_TTL_SECONDS,
  });

  console.log(`⛔ Token manually revoked: jti=${payload.jti}`);
}

/**
 * ❌ Revoke all tokens for a user (account deletion, forced logout) with Redis lock
 */
async function revokeUserTokens(userId) {
  await lazyInit();
  const redis = await getOrInitRedisClient();
  const lockKey = `lock:revoke:${userId}`;

  // acquire lock (set if not exists, expire after 5 sec)
  const locked = await redis.set(lockKey, "1", { NX: true, EX: 5 });
  if (!locked) {
    console.log(`⚠️ Another process is revoking tokens for user ${userId}, skipping`);
    return;
  }

  try {
    await redis.set(`${USER_REVOCATION_PREFIX}${userId}`, Date.now());
    console.log(`⛔ All tokens revoked for user_id=${userId}`);
  } finally {
    await redis.del(lockKey); // release lock
  }
}


export {
  generateToken,
  verifyToken,
  revokeToken,
  revokeUserTokens, // 👈 NEW
};
