// Utils/APP_KEY.js
import crypto from "crypto";

class AppKeyManager {
  constructor({ algo = "sha256", ttlMs = 3 * 60 * 1000, clockSkewMs = 30 * 1000 } = {}) {
    this._algo = algo;
    this._secret = null;
    this._createdAt = null;
    this._ttlMs = ttlMs;
    this._clockSkewMs = clockSkewMs; 
  }

  static _generateRawKey(byteLen = 32) {
    return crypto.randomBytes(byteLen).toString("hex");
  }

  generateKey() {
    const rawKey = AppKeyManager._generateRawKey();
    this._secret = rawKey;
    this._createdAt = new Date();

    // NOTE: Do not log rawKey in prod
    console.log("[AppKeyManager] New key generated (store it securely).");

    const expiresAt = new Date(this._createdAt.getTime() + this._ttlMs);
    return { rawKey, createdAt: this._createdAt, expiresAt };
  }

  rotate() {
    return this.generateKey();
  }

  isExpired() {
    if (!this._createdAt) return true;
    return Date.now() - this._createdAt.getTime() > this._ttlMs;
  }

  remainingTTL() {
    if (!this._createdAt) return 0;
    const remaining = this._createdAt.getTime() + this._ttlMs - Date.now();
    return remaining > 0 ? remaining : 0;
  }

  getCreatedAt() {
    return this._createdAt;
  }

  getExpiresAt() {
    if (!this._createdAt) return null;
    return new Date(this._createdAt.getTime() + this._ttlMs);
  }

  loadRawKey(rawKeyHex, createdAt = null) {
    this._secret = rawKeyHex;
    this._createdAt = createdAt ? new Date(createdAt) : new Date();
  }

  _hmacHex(message) {
    if (!this._secret) throw new Error("No key loaded");
    return crypto.createHmac(this._algo, this._secret).update(message, "utf8").digest("hex");
  }

  // Convenience: sign arbitrary message string (keeps old API)
  sign(message) {
    if (this.isExpired()) throw new Error("Key expired");
    return this._hmacHex(message);
  }

  createToken(payload) {
    if (!this._secret) throw new Error("No key loaded");
    if (this.isExpired()) throw new Error("Key expired");

    const ts = Date.now(); 
    const nonce = crypto.randomBytes(16).toString("hex"); 

    const object = { payload, ts, nonce };
    const json = JSON.stringify(object);
    const token = Buffer.from(json, "utf8").toString("base64");
    const signature = this._hmacHex(token);

    return {
      token,
      signature, // hex
      createdAt: this._createdAt,
      expiresAt: this.getExpiresAt(),
    };
  }

  async verifyToken(token, signatureHex, { redisClient = null, disableNonceCheck = false } = {}) {
    // Must have a loaded key and valid within TTL
    if (!this._secret) return false;
    if (this.isExpired()) return false;

    let expectedHex;
    try {
      expectedHex = this._hmacHex(token);
    } catch (err) {
      return false;
    }

    try {
      const sigBuf = Buffer.from(signatureHex, "hex");
      const expBuf = Buffer.from(expectedHex, "hex");
      if (sigBuf.length !== expBuf.length) return false;
      if (!crypto.timingSafeEqual(sigBuf, expBuf)) return false;
    } catch {
      return false;
    }

    let json;
    try {
      json = Buffer.from(token, "base64").toString("utf8");
    } catch {
      return false;
    }

    let obj;
    try {
      obj = JSON.parse(json);
    } catch {
      return false;
    }

    const { ts, nonce } = obj || {};
    if (!ts || !nonce) return false;

    const now = Date.now();
    const earliestAllowed = now - this._ttlMs - this._clockSkewMs;
    const latestAllowed = now + this._clockSkewMs;
    if (ts < earliestAllowed || ts > latestAllowed) return false;

    if (!disableNonceCheck && redisClient) {
      const key = `appkey:nonce:${nonce}`;
      const px = Math.min(this._ttlMs, Math.max(1000, this._ttlMs)); // ensure > 0

      try {

        const res = await redisClient.set(key, "1", { NX: true, PX: px });
        if (res !== "OK") {
          return false;
        }
      } catch (err) {
        console.error("[AppKeyManager] Redis nonce check error:", err);
        return false;
      }
    }
    return true;
  }
}

const instance = new AppKeyManager();
export default instance;

if (import.meta.url === `file://${process.argv[1]}`) {
  const info = instance.generateKey();
  console.log("[AppKeyManager] key created at:", info.createdAt.toISOString());
  console.log("[AppKeyManager] expires at:", info.expiresAt.toISOString());
}
