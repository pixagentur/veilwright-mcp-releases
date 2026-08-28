import type { SqliteDatabase } from '../db/Database.js';
import type { SiteKeyRecord, SiteKeyRepository } from './types.js';
/** SQLite-backed SiteKeyRepository — see SqliteSiteRepository's docblock. */
export declare class SqliteSiteKeyRepository implements SiteKeyRepository {
    private readonly db;
    constructor(db: SqliteDatabase);
    store(tenantId: string, record: SiteKeyRecord): Promise<void>;
    find(tenantId: string, siteId: string): Promise<SiteKeyRecord | null>;
    delete(tenantId: string, siteId: string): Promise<boolean>;
}
