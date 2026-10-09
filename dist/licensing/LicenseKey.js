import { createPublicKey, verify } from 'node:crypto';
const PREFIX = 'VW1';
const VALID_TIERS = ['free', 'site', 'five_sites'];
function isLicenseTier(value) {
    return VALID_TIERS.includes(value);
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
export function verifyLicenseKey(rawKey, publicKeyBase64) {
    const parts = rawKey.trim().split('.');
    if (parts.length !== 3 || parts[0] !== PREFIX) {
        return null;
    }
    const [prefix, payloadB64, sigB64] = parts;
    const publicKeyRaw = Buffer.from(publicKeyBase64, 'base64');
    const signature = Buffer.from(sigB64, 'base64url');
    const payloadJson = Buffer.from(payloadB64, 'base64url');
    if (publicKeyRaw.length !== 32 || signature.length !== 64) {
        return null;
    }
    let valid;
    try {
        const keyObject = createPublicKey({
            key: { kty: 'OKP', crv: 'Ed25519', x: publicKeyRaw.toString('base64url') },
            format: 'jwk',
        });
        valid = verify(null, Buffer.from(`${prefix}.${payloadB64}`), keyObject, signature);
    }
    catch {
        return null;
    }
    if (!valid) {
        return null;
    }
    let payload;
    try {
        payload = JSON.parse(payloadJson.toString('utf8'));
    }
    catch {
        return null;
    }
    if (typeof payload !== 'object' ||
        payload === null ||
        typeof payload.id !== 'string' ||
        typeof payload.tier !== 'string') {
        return null;
    }
    const record = payload;
    if (!isLicenseTier(record.tier)) {
        return null;
    }
    return {
        licenseId: record.id,
        tier: record.tier,
        expiresAt: typeof record.exp === 'number' ? record.exp : null,
    };
}
export function isLicenseExpired(key, now = Math.floor(Date.now() / 1000)) {
    return key.expiresAt !== null && now >= key.expiresAt;
}
//# sourceMappingURL=LicenseKey.js.map