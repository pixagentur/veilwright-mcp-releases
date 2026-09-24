/**
 * In-process SiteKeyRepository. Current default implementation —
 * see InMemorySiteRepository for why Postgres is deferred.
 */
export class InMemorySiteKeyRepository {
    records = new Map();
    async store(tenantId, record) {
        this.records.set(record.siteId, { ...record, tenantId });
    }
    async find(tenantId, siteId) {
        const record = this.records.get(siteId);
        return record && record.tenantId === tenantId ? record : null;
    }
    async delete(tenantId, siteId) {
        const record = this.records.get(siteId);
        if (!record || record.tenantId !== tenantId) {
            return false;
        }
        return this.records.delete(siteId);
    }
}
//# sourceMappingURL=InMemorySiteKeyRepository.js.map