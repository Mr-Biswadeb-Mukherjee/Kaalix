//Utils/Session.js

import crypto from 'crypto';

class SessionManager {
  constructor({
    hashAlgorithm = 'sha512',
    keyLength = 128,
    rotateIntervalMs = 5 * 60 * 1000, // 5 minutes
  } = {}) {
    this.hashAlgorithm = hashAlgorithm;
    this.keyLength = keyLength;
    this.rotateIntervalMs = rotateIntervalMs;
    this.sessionKey = null;
    this.rotationTimer = null;

    this.rotateKey();      // Generate first key
    this.startRotation();  // Begin rotation schedule
  }

  generateHKDFKey(saltLength = 128, ikmLength = 128) {
    const salt = crypto.randomBytes(saltLength);
    const ikm = crypto.randomBytes(ikmLength);
    const info = Buffer.from('key derivation');

    const derivedKey = crypto.hkdfSync(
      this.hashAlgorithm,
      ikm,
      salt,
      info,
      this.keyLength
    );

    return Buffer.from(derivedKey).toString('base64'); // 👈 Base64 instead of hex
  }

  rotateKey() {
    this.sessionKey = this.generateHKDFKey();

    // 🔍 Truncated preview for logging (6 + ... + 6)
    const preview = `${this.sessionKey.slice(0, 6)}...${this.sessionKey.slice(-6)}`;
    console.log(`🔑 Session Key Rotated: ${preview}`);
  }


  getSessionKey() {
    return this.sessionKey;
  }

  startRotation() {
    this.rotationTimer = setInterval(
      () => this.rotateKey(),
      this.rotateIntervalMs
    );
  }

  stopRotation() {
    clearInterval(this.rotationTimer);
  }
}

const sessionManager = new SessionManager();
export default sessionManager;
