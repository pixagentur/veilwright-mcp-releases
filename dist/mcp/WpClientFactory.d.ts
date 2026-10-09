import type { SiteRegistry } from '../site-registry/SiteRegistry.js';
import { WpClient } from '../wp-client/WpClient.js';
/**
 * Builds and caches one WpClient per (tenant, site) pair, so a
 * site's CircuitBreaker state persists across tool calls within a
 * session instead of resetting on every request.
 */
export declare class WpClientFactory {
    private readonly siteRegistry;
    private readonly clients;
    constructor(siteRegistry: SiteRegistry);
    forSite(tenantId: string, siteId: string): Promise<WpClient>;
    invalidate(tenantId: string, siteId: string): void;
}
