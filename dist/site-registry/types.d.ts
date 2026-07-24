export type SiteHealthStatus = 'unknown' | 'healthy' | 'unreachable';
export interface Site {
    id: string;
    tenantId: string;
    url: string;
    name: string;
    description: string | null;
    theme: string | null;
    plugins: string[];
    wpVersion: string | null;
    elementorVersion: string | null;
    keyId: string;
    healthStatus: SiteHealthStatus;
    createdAt: string;
    updatedAt: string;
}
export interface SiteInput {
    url: string;
    name: string;
    description?: string;
    theme?: string;
    plugins?: string[];
}
export interface SiteUpdateInput {
    name?: string;
    description?: string;
    theme?: string;
    plugins?: string[];
    wpVersion?: string;
    elementorVersion?: string;
    healthStatus?: SiteHealthStatus;
}
/**
 * Storage port for sites. Every method takes tenantId and must scope
 * its query/mutation to it — this is the mechanism that makes
 * cross-tenant access impossible.
 */
export interface SiteRepository {
    create(tenantId: string, site: Site): Promise<void>;
    findById(tenantId: string, siteId: string): Promise<Site | null>;
    list(tenantId: string): Promise<Site[]>;
    update(tenantId: string, siteId: string, patch: Partial<Site>): Promise<Site | null>;
    delete(tenantId: string, siteId: string): Promise<boolean>;
}
export interface SiteKeyRecord {
    siteId: string;
    keyId: string;
    encryptedSecret: string;
    rotatedAt: string;
}
/** Storage port for encrypted site credentials. Tenant-scoped like SiteRepository. */
export interface SiteKeyRepository {
    store(tenantId: string, record: SiteKeyRecord): Promise<void>;
    find(tenantId: string, siteId: string): Promise<SiteKeyRecord | null>;
    delete(tenantId: string, siteId: string): Promise<boolean>;
}
/**
 * Resolves how many sites a tenant's current plan allows, so
 * SiteRegistry can enforce it centrally — a single WP install can
 * never know how many *other* sites share its license key, only this
 * registry can. See src/auth/UserTierLookup.ts for the real
 * implementation.
 */
export interface TierLookup {
    siteLimit(tenantId: string): Promise<number>;
}
