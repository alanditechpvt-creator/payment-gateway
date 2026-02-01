import crypto from 'crypto';

/**
 * Encrypts the XML request for BillAvenue using the provided working key.
 * Uses AES-128-CBC encryption with MD5-hashed key
 */
export function encryptBBPSRequest(xml: string, workingKey: string): string {
  if (!workingKey) {
    throw new Error('BBPS working key is missing');
  }
  
  const iv = Buffer.alloc(16, 0); // Initialize with zeros
  const key = crypto.createHash('md5').update(workingKey).digest();
  const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
  let encrypted = cipher.update(xml, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

/**
 * Decrypts the response from BillAvenue
 */
export function decryptBBPSResponse(encryptedText: string, workingKey: string): string {
  if (!workingKey) {
    throw new Error('BBPS working key is missing');
  }
  
  const iv = Buffer.alloc(16, 0); // Initialize with zeros
  const key = crypto.createHash('md5').update(workingKey).digest();
  const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
