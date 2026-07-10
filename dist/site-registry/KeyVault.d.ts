/**
 * Encrypts WordPress site secrets at rest using AES-256-GCM (Node's
 * built-in crypto, authenticated encryption) rather than an external
 * libsodium dependency — equally secure for this purpose and easier
 * to verify by reading the code alone, since no local runtime is
 * available in this environment to execute a new package's API.
 *
 * Ciphertext layout: iv (12 bytes) || authTag (16 bytes) || ciphertext, base64-encoded.
 */
export declare class KeyVault {
    private readonly masterKey;
    constructor(masterKey: Buffer);
    encrypt(plaintext: string): string;
    decrypt(encoded: string): string;
}
