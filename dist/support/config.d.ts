/** Parses a hex-encoded 32-byte (256-bit) key. Pure — no environment dependency. */
export declare function parseMasterKeyHex(hex: string): Buffer;
/**
 * Reads the vault master key from the environment. `env` is
 * injectable for testing; defaults to `process.env` at call sites.
 */
export declare function getVaultMasterKeyFromEnv(env: NodeJS.ProcessEnv): Buffer;
