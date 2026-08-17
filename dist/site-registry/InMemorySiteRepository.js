/**
 * In-process SiteRepository. Current default implementation — the
 * Postgres-backed repository from docs/architecture.md Teil H is
 * deferred until Docker/Postgres infra is set up and can actually be
 * tested. Suitable for single-instance dev/test use; state is lost
 * on process restart.
 */
export class InMemorySiteRepository {
    sites = new Map();
    async create(tenantId, site) {
        this.sites.set(site.id, { ...site, tenantId });
    }
    async findById(tenantId, siteId) {
        const site = this.sites.get(siteId);
        return site && site.tenantId === tenantId ? site : null;
    }
    async list(tenantId) {
        return [...this.sites.values()].filter((site) => site.tenantId === tenantId);
    }
    async update(tenantId, siteId, patch) {
        const existing = await this.findById(tenantId, siteId);
        if (existing === null) {
            return null;
        }
        const updated = { ...existing, ...patch, id: existing.id, tenantId };
        this.sites.set(siteId, updated);
        return updated;
    }
    async delete(tenantId, siteId) {
        const existing = await this.findById(tenantId, siteId);
        if (existing === null) {
            return false;
        }
        return this.sites.delete(siteId);
    }
}
//# sourceMappingURL=InMemorySiteRepository.js.map