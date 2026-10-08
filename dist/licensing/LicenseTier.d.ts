/**
 * Mirrors src/Licensing/LicenseTier.php in veilwright-ai — same three
 * tiers, same site limits. Kept as a separate literal type (not a
 * shared package) the same way the HMAC scheme is duplicated across
 * the two repos: cheap to keep in sync by hand, no cross-repo build
 * dependency.
 */
export type LicenseTier = 'free' | 'site' | 'five_sites';
export declare function siteLimitForTier(tier: LicenseTier): number;
