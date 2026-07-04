import { randomUUID } from 'node:crypto';
import { NotFoundError, ValidationError } from '../support/errors.js';
/**
 * Tenant-scoped CRUD for registered WordPress sites plus their
 * encrypted API credentials. Every method requires tenantId and
 * delegates to tenant-scoped repository ports, so a caller can never
 * read, list, update, or delete another tenant's site — even when
 * given that site's ID directly.
 */
export class SiteRegistry {
    sites;
    siteKeys;
    vault;
    tierLookup;
    constructor(sites, siteKeys, vault, tierLookup) {
        this.sites = sites;
        this.siteKeys = siteKeys;
        this.vault = vault;
        this.tierLookup = tierLookup;
    }
    async addSite(tenantId, input, keyId, secret) {
        if (input.url.trim() === '' || input.name.trim() === '') {
            throw new ValidationError('url and name are required.');
        }
        if (this.tierLookup) {
            const [limit, existing] = await Promise.all([this.tierLookup.siteLimit(tenantId), this.sites.list(tenantId)]);
            if (existing.length >= limit) {
                throw new ValidationError(`Site limit reached for the current plan (${limit}). Upgrade to add more sites.`);
            }
        }
        const now = new Date().toISOString();
        const site = {
            id: randomUUID(),
            tenantId,
            url: input.url,
            name: input.name,
            description: input.description ?? null,
            theme: input.theme ?? null,
            plugins: input.plugins ?? [],
            wpVersion: null,
            elementorVersion: null,
            keyId,
            healthStatus: 'unknown',
            createdAt: now,
            updatedAt: now,
        };
        await this.sites.create(tenantId, site);
        await this.siteKeys.store(tenantId, {
            siteId: site.id,
            keyId,
            encryptedSecret: this.vault.encrypt(secret),
            rotatedAt: now,
        });
        return site;
    }
    async getSite(tenantId, siteId) {
        const site = await this.sites.findById(tenantId, siteId);
        if (site === null) {
            throw new NotFoundError(`Site ${siteId} not found.`);
        }
        return site;
    }
    async listSites(tenantId) {
        return this.sites.list(tenantId);
    }
    async updateSite(tenantId, siteId, patch) {
        await this.getSite(tenantId, siteId);
        const updated = await this.sites.update(tenantId, siteId, { ...patch, updatedAt: new Date().toISOString() });
        if (updated === null) {
            throw new NotFoundError(`Site ${siteId} not found.`);
        }
        return updated;
    }
    async removeSite(tenantId, siteId) {
        await this.getSite(tenantId, siteId);
        await this.siteKeys.delete(tenantId, siteId);
        await this.sites.delete(tenantId, siteId);
    }
    /**
     * Decrypts stored credentials for wp-client to sign requests with.
     * Callers must never log the returned secret.
     */
    async getCredentials(tenantId, siteId) {
        const record = await this.siteKeys.find(tenantId, siteId);
        if (record === null) {
            throw new NotFoundError(`No credentials stored for site ${siteId}.`);
        }
        return { keyId: record.keyId, secret: this.vault.decrypt(record.encryptedSecret) };
    }
}
//# sourceMappingURL=SiteRegistry.js.map