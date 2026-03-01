const UINT32_MAX_EXCLUSIVE = 0x1_0000_0000;

function getCrypto() {
  const cryptoObject = globalThis.crypto;
  if (!cryptoObject?.getRandomValues) {
    throw new Error("Web Crypto API is unavailable in this environment.");
  }
  return cryptoObject;
}

export function secureRandomFloat() {
  const values = new Uint32Array(1);
  getCrypto().getRandomValues(values);
  return values[0] / UINT32_MAX_EXCLUSIVE;
}
