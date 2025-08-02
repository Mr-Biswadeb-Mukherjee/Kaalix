import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { initRedis, getRedisClient } from '../Connectors/Redis.js';

const JWT_SECRET_PREFIX = 'jwt:secret:';
const CURRENT_KID_KEY = 'jwt:current_kid';
const KID_LIST_KEY = 'jwt:kid_list';
const REVOCATION_SET_PREFIX = 'jwt:revoked:';
const ROTATION_INTERVAL = 10 * 60 * 1000;
const TOKEN_TTL_SECONDS = 10 * 60;
const MAX_KIDS = 2;

let initialized = false;

async function lazyInit() {
  if (initialized) return;
  await initRedis();
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
  const redis = getRedisClient();
  const newKid = Date.now().toString();
  const newSecret = generateSecret();

  await redis.set(`${JWT_SECRET_PREFIX}${newKid}`, newSecret);
  await redis.set(CURRENT_KID_KEY, newKid);
  await redis.lPush(KID_LIST_KEY, newKid);
  await redis.lTrim(KID_LIST_KEY, 0, MAX_KIDS - 1);

  const oldKids = await redis.lRange(KID_LIST_KEY, MAX_KIDS, -1);
  for (const oldKid of oldKids) {
    await redis.del(`${JWT_SECRET_PREFIX}${oldKid}`);
  }

  console.log(`🔁 JWT secret rotated. New kid: ${newKid} at ${new Date().toISOString()}`);
}

function startRotationScheduler() {
  rotateSecret().catch(console.error);
  setInterval(() => {
    rotateSecret().catch(console.error);
  }, ROTATION_INTERVAL);
}

/**
 * 🔑 Generate a JWT with a unique JTI and Redis-managed secret
 */
async function generateToken(payload) {
  await lazyInit();

  const redis = getRedisClient();
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
 * ✅ Verify JWT and enforce single-use by revoking it immediately
 */
async function verifyToken(token) {
  await lazyInit();

  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || !decoded.header?.kid) {
    throw new Error('Missing kid in token header');
  }

  const { kid } = decoded.header;
  const redis = getRedisClient();

  const secret = await redis.get(`${JWT_SECRET_PREFIX}${kid}`);
  if (!secret) throw new Error(`Secret not found for kid=${kid}`);

  const payload = jwt.verify(token, secret, { algorithms: ['HS512'] });

  const jtiKey = `${REVOCATION_SET_PREFIX}${payload.jti}`;

  // Atomically check and revoke using a Lua script
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
    arguments: [TOKEN_TTL_SECONDS],
  });

  if (success === 0) {
    throw new Error('Token has already been used or revoked');
  }

  console.log(`🛡️ Token verified and now revoked: jti=${payload.jti}`);
  return payload;
}

/**
 * ❌ Revoke JWT by JTI (manual revocation)
 */
async function revokeToken(token) {
  await lazyInit();

  const decoded = jwt.decode(token);
  if (!decoded || !decoded.jti) {
    throw new Error('Cannot revoke: missing JTI');
  }

  const redis = getRedisClient();
  await redis.set(`${REVOCATION_SET_PREFIX}${decoded.jti}`, 'revoked', {
    EX: TOKEN_TTL_SECONDS,
  });

  console.log(`⛔ Token manually revoked: jti=${decoded.jti}`);
}

export {
  generateToken,
  verifyToken,
  revokeToken,
};
