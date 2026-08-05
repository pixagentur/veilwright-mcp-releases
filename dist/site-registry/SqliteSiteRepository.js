function toSite(row) {
    return {
        id: row.id,
        tenantId: row.tenant_id,
        url: row.url,
        name: row.name,
        description: row.description,
        theme: row.theme,
        plugins: JSON.parse(row.plugins),
        wpVersion: row.wp_version,
        elementorVersion: row.elementor_version,
        keyId: row.key_id,
        healthStatus: row.health_status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
/**
 * SQLite-backed SiteRepository for the hosted MCP server — replaces
 * InMemorySiteRepository once sites must survive a process restart
 * and be visible across every connected user's session. Same
 * tenant-scoping contract as the in-memory version: every query is
 * filtered by tenant_id, so SiteRegistry's cross-tenant-isolation
 * guarantee holds regardless of which SiteRepository backs it.
 *
 * Not unit tested here — see Database.ts's docblock.
 */
export class SqliteSiteRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async create(tenantId, site) {
        this.db
            .prepare(`INSERT INTO sites (id, tenant_id, url, name, description, theme, plugins, wp_version, elementor_version, key_id, health_status, created_at, updated_at)
         VALUES (@id, @tenantId, @url, @name, @description, @theme, @plugins, @wpVersion, @elementorVersion, @keyId, @healthStatus, @createdAt, @updatedAt)`)
            .run({
            id: site.id,
            tenantId,
            url: site.url,
            name: site.name,
            description: site.description,
            theme: site.theme,
            plugins: JSON.stringify(site.plugins),
            wpVersion: site.wpVersion,
            elementorVersion: site.elementorVersion,
            keyId: site.keyId,
            healthStatus: site.healthStatus,
            createdAt: site.createdAt,
            updatedAt: site.updatedAt,
        });
    }
    async findById(tenantId, siteId) {
        const row = this.db.prepare('SELECT * FROM sites WHERE id = ? AND tenant_id = ?').get(siteId, tenantId);
        return row ? toSite(row) : null;
    }
    async list(tenantId) {
        const rows = this.db.prepare('SELECT * FROM sites WHERE tenant_id = ? ORDER BY created_at DESC').all(tenantId);
        return rows.map(toSite);
    }
    async update(tenantId, siteId, patch) {
        const existing = await this.findById(tenantId, siteId);
        if (existing === null) {
            return null;
        }
        const merged = { ...existing, ...patch, id: existing.id, tenantId };
        this.db
            .prepare(`UPDATE sites SET url=@url, name=@name, description=@description, theme=@theme, plugins=@plugins,
           wp_version=@wpVersion, elementor_version=@elementorVersion, key_id=@keyId, health_status=@healthStatus, updated_at=@updatedAt
         WHERE id=@id AND tenant_id=@tenantId`)
            .run({
            id: merged.id,
            tenantId,
            url: merged.url,
            name: merged.name,
            description: merged.description,
            theme: merged.theme,
            plugins: JSON.stringify(merged.plugins),
            wpVersion: merged.wpVersion,
            elementorVersion: merged.elementorVersion,
            keyId: merged.keyId,
            healthStatus: merged.healthStatus,
            updatedAt: merged.updatedAt,
        });
        return merged;
    }
    async delete(tenantId, siteId) {
        const result = this.db.prepare('DELETE FROM sites WHERE id = ? AND tenant_id = ?').run(siteId, tenantId);
        return result.changes > 0;
    }
}
//# sourceMappingURL=SqliteSiteRepository.js.map