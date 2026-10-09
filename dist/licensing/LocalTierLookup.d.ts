import type { TierLookup } from '../site-registry/types.js';
/**
 * TierLookup for the local self-hosted MCP entrypoint
 * (src/mcp/server.ts). No account, no server involved: verifies a
 * single license key from the environment once at startup, fully
 * offline, the same way veilwright-ai's WP plugin does. No/invalid/
 * expired key all resolve to Free (site limit 1) — a safe fallback,
 * never a crash.
 */
export declare class LocalTierLookup implements TierLookup {
    private readonly limit;
    constructor(licenseKeyRaw: string | undefined, publicKeyBase64: string);
    siteLimit(): Promise<number>;
}
