import { WpClient } from '../wp-client/WpClient.js';
/**
 * Builds and caches one WpClient per (tenant, site) pair, so a
 * site's CircuitBreaker state persists across tool calls within a
 * session instead of resetting on every request.
 */
export class WpClientFactory {
    siteRegistry;
    clients = new Map();
    constructor(siteRegistry) {
        this.siteRegistry = siteRegistry;
    }
    async forSite(tenantId, siteId) {
        const cacheKey = `${tenantId}:${siteId}`;
        const cached = this.clients.get(cacheKey);
        if (cached) {
            return cached;
        }
        const site = await this.siteRegistry.getSite(tenantId, siteId);
        const credentials = await this.siteRegistry.getCredentials(tenantId, siteId);
        const client = new WpClient({
            baseUrl: site.url.replace(/\/$/, ''),
            keyId: credentials.keyId,
            secret: credentials.secret,
        });
        this.clients.set(cacheKey, client);
        return client;
    }
    invalidate(tenantId, siteId) {
        this.clients.delete(`${tenantId}:${siteId}`);
    }
}
//# sourceMappingURL=WpClientFactory.js.map