/** Parses a hex-encoded 32-byte (256-bit) key. Pure — no environment dependency. */
export function parseMasterKeyHex(hex) {
    const buffer = Buffer.from(hex, 'hex');
    if (buffer.length !== 32) {
        throw new Error('Vault master key must be 64 hex characters (32 bytes).');
    }
    return buffer;
}
/**
 * Reads the vault master key from the environment. `env` is
 * injectable for testing; defaults to `process.env` at call sites.
 */
export function getVaultMasterKeyFromEnv(env) {
    const hex = env.VEILWRIGHT_VAULT_KEY;
    if (!hex) {
        throw new Error('VEILWRIGHT_VAULT_KEY environment variable is not set.');
    }
    return parseMasterKeyHex(hex);
}
//# sourceMappingURL=config.js.map