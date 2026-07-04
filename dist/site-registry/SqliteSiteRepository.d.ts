import type { SqliteDatabase } from '../db/Database.js';
import type { Site, SiteRepository } from './types.js';
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
export declare class SqliteSiteRepository implements SiteRepository {
    private readonly db;
    constructor(db: SqliteDatabase);
    create(tenantId: string, site: Site): Promise<void>;
    findById(tenantId: string, siteId: string): Promise<Site | null>;
    list(tenantId: string): Promise<Site[]>;
    update(tenantId: string, siteId: string, patch: Partial<Site>): Promise<Site | null>;
    delete(tenantId: string, siteId: string): Promise<boolean>;
}
