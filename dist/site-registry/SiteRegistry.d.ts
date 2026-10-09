import type { KeyVault } from './KeyVault.js';
import type { Site, SiteInput, SiteKeyRepository, SiteRepository, SiteUpdateInput, TierLookup } from './types.js';
/**
 * Tenant-scoped CRUD for registered WordPress sites plus their
 * encrypted API credentials. Every method requires tenantId and
 * delegates to tenant-scoped repository ports, so a caller can never
 * read, list, update, or delete another tenant's site — even when
 * given that site's ID directly.
 */
export declare class SiteRegistry {
    private readonly sites;
    private readonly siteKeys;
    private readonly vault;
    private readonly tierLookup?;
    constructor(sites: SiteRepository, siteKeys: SiteKeyRepository, vault: KeyVault, tierLookup?: TierLookup | undefined);
    addSite(tenantId: string, input: SiteInput, keyId: string, secret: string): Promise<Site>;
    getSite(tenantId: string, siteId: string): Promise<Site>;
    listSites(tenantId: string): Promise<Site[]>;
    updateSite(tenantId: string, siteId: string, patch: SiteUpdateInput): Promise<Site>;
    removeSite(tenantId: string, siteId: string): Promise<void>;
    /**
     * Decrypts stored credentials for wp-client to sign requests with.
     * Callers must never log the returned secret.
     */
    getCredentials(tenantId: string, siteId: string): Promise<{
        keyId: string;
        secret: string;
    }>;
}
