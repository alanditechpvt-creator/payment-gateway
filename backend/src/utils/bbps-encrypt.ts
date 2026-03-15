import crypto from 'crypto';

/**
 * Bill Avenue encryption: AES-128-CBC, PKCS7 padding.
 * - Key: by default MD5(workingKey); set BBPS_KEY_RAW=true to use workingKey as 16-byte key (padded/trimmed).
 * - IV: BBPS_IV (32-char hex), or BBPS_IV_USE_ZERO=true for zero IV, else 0x00..0x0f.
 * - Output: hex-encoded ciphertext (or base64 if BBPS_ENC_REQUEST_BASE64=true).
 */
const FIXED_IV = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f]);
const ZERO_IV = Buffer.alloc(16, 0);

function getKey(workingKey: string, useRawKey?: boolean): Buffer {
  if (useRawKey) {
    const buf = Buffer.from(workingKey, 'utf8');
    if (buf.length >= 16) return buf.subarray(0, 16);
    const out = Buffer.alloc(16, 0);
    buf.copy(out);
    return out;
  }
  return crypto.createHash('md5').update(workingKey).digest();
}

export function resolveIv(ivHex: string | null | undefined, useZeroDefault?: boolean): Buffer {
  if (ivHex && /^[0-9a-fA-F]{32}$/.test(ivHex)) {
    return Buffer.from(ivHex, 'hex');
  }
  return useZeroDefault ? ZERO_IV : FIXED_IV;
}

export function encryptBBPSRequest(
  xml: string,
  workingKey: string,
  ivHex?: string | null,
  useZeroIv?: boolean,
  useRawKey?: boolean
): string {
  if (!workingKey) {
    throw new Error('BBPS working key is missing');
  }
  const key = getKey(workingKey, useRawKey ?? false);
  const iv = resolveIv(ivHex ?? null, useZeroIv ?? false);
  const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
  let encrypted = cipher.update(xml, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

/**
 * Decrypts the response from Bill Avenue (same key/IV as encrypt).
 */
export function decryptBBPSResponse(
  encryptedText: string,
  workingKey: string,
  ivHex?: string | null,
  useZeroIv?: boolean,
  useRawKey?: boolean
): string {
  if (!workingKey) {
    throw new Error('BBPS working key is missing');
  }
  const key = getKey(workingKey, useRawKey ?? false);
  const iv = resolveIv(ivHex ?? null, useZeroIv ?? false);
  const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
