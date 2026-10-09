import type { LicenseTier } from './LicenseTier.js';
export interface VerifiedLicenseKey {
    licenseId: string;
    tier: LicenseTier;
    expiresAt: number | null;
}
/**
 * TypeScript mirror of veilwright-ai's src/Licensing/LicenseKey.php —
 * same format (`VW1.<payload>.<signature>`, Ed25519 over
 * "VW1.<payload>", both segments base64url), same public key.
 * Verified independently here so self-hosted local MCP mode can
 * resolve a site limit offline, without our server ever being
 * involved (see LocalTierLookup.ts).
 *
 * Uses Node's built-in crypto — Ed25519 support is native since
 * Node 12, no extra dependency. The raw 32-byte public key is
 * wrapped as a JWK (`{kty:'OKP',crv:'Ed25519',x}`) since that's the
 * simplest format `createPublicKey` accepts for a raw Ed25519 key,
 * no DER/SPKI wrapping needed.
 *
 * Pure — fully unit-testable, and its tests reuse the exact same
 * signed fixtures as veilwright-ai's LicenseKeyTest.php, proving the
 * two implementations agree on the same license keys.
 */
export declare function verifyLicenseKey(rawKey: string, publicKeyBase64: string): VerifiedLicenseKey | null;
export declare function isLicenseExpired(key: VerifiedLicenseKey, now?: number): boolean;
