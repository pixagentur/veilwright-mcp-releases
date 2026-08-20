function toRecord(row) {
    return { siteId: row.site_id, keyId: row.key_id, encryptedSecret: row.encrypted_secret, rotatedAt: row.rotated_at };
}
/** SQLite-backed SiteKeyRepository — see SqliteSiteRepository's docblock. */
export class SqliteSiteKeyRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async store(tenantId, record) {
        this.db
            .prepare(`INSERT INTO site_keys (site_id, tenant_id, key_id, encrypted_secret, rotated_at)
         VALUES (@siteId, @tenantId, @keyId, @encryptedSecret, @rotatedAt)
         ON CONFLICT(site_id) DO UPDATE SET
           key_id = excluded.key_id,
           encrypted_secret = excluded.encrypted_secret,
           rotated_at = excluded.rotated_at`)
            .run({ siteId: record.siteId, tenantId, keyId: record.keyId, encryptedSecret: record.encryptedSecret, rotatedAt: record.rotatedAt });
    }
    async find(tenantId, siteId) {
        const row = this.db.prepare('SELECT * FROM site_keys WHERE site_id = ? AND tenant_id = ?').get(siteId, tenantId);
        return row ? toRecord(row) : null;
    }
    async delete(tenantId, siteId) {
        const result = this.db.prepare('DELETE FROM site_keys WHERE site_id = ? AND tenant_id = ?').run(siteId, tenantId);
        return result.changes > 0;
    }
}
//# sourceMappingURL=SqliteSiteKeyRepository.js.map