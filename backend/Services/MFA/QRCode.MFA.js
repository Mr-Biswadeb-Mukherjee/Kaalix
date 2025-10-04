// qrcode.mfa.js
import QRCode from "qrcode";

/**
 * Generate a QR code (PNG Buffer) for an OTPAuth URL
 * @param {string} otpauthUrl - The OTPAuth URL (otpauth://totp/...)
 * @returns {Promise<Buffer>} - PNG buffer of the QR code
 */
export async function generateQRCodeBuffer(otpauthUrl) {
  return await QRCode.toBuffer(otpauthUrl, { type: "png" });
}

/**
 * Generate a QR code as Base64 data URI (frontend friendly)
 * @param {string} otpauthUrl
 * @returns {Promise<string>} - data:image/png;base64 string
 */
export async function generateQRCodeDataUrl(otpauthUrl) {
  const buffer = await generateQRCodeBuffer(otpauthUrl);
  return `data:image/png;base64,${buffer.toString("base64")}`;
}
