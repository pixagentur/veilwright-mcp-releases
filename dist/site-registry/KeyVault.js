import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
/**
 * Encrypts WordPress site secrets at rest using AES-256-GCM (Node's
 * built-in crypto, authenticated encryption) rather than an external
 * libsodium dependency — equally secure for this purpose and easier
 * to verify by reading the code alone, since no local runtime is
 * available in this environment to execute a new package's API.
 *
 * Ciphertext layout: iv (12 bytes) || authTag (16 bytes) || ciphertext, base64-encoded.
 */
export class KeyVault {
    masterKey;
    constructor(masterKey) {
        this.masterKey = masterKey;
        if (masterKey.length !== 32) {
            throw new Error('KeyVault master key must be 32 bytes (256 bits).');
        }
    }
    encrypt(plaintext) {
        const iv = randomBytes(IV_LENGTH);
        const cipher = createCipheriv(ALGORITHM, this.masterKey, iv);
        const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
        const authTag = cipher.getAuthTag();
        return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
    }
    decrypt(encoded) {
        const raw = Buffer.from(encoded, 'base64');
        const iv = raw.subarray(0, IV_LENGTH);
        const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
        const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
        const decipher = createDecipheriv(ALGORITHM, this.masterKey, iv);
        decipher.setAuthTag(authTag);
        return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    }
}
//# sourceMappingURL=KeyVault.js.map