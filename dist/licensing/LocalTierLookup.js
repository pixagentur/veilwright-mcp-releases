import { isLicenseExpired, verifyLicenseKey } from './LicenseKey.js';
import { siteLimitForTier } from './LicenseTier.js';
/**
 * TierLookup for the local self-hosted MCP entrypoint
 * (src/mcp/server.ts). No account, no server involved: verifies a
 * single license key from the environment once at startup, fully
 * offline, the same way veilwright-ai's WP plugin does. No/invalid/
 * expired key all resolve to Free (site limit 1) — a safe fallback,
 * never a crash.
 */
export class LocalTierLookup {
    limit;
    constructor(licenseKeyRaw, publicKeyBase64) {
        const key = licenseKeyRaw ? verifyLicenseKey(licenseKeyRaw, publicKeyBase64) : null;
        const valid = key !== null && !isLicenseExpired(key);
        this.limit = siteLimitForTier(valid && key ? key.tier : 'free');
    }
    async siteLimit() {
        return this.limit;
    }
}
//# sourceMappingURL=LocalTierLookup.js.map