import type { SiteKeyRecord, SiteKeyRepository } from './types.js';
/**
 * In-process SiteKeyRepository. Current default implementation —
 * see InMemorySiteRepository for why Postgres is deferred.
 */
export declare class InMemorySiteKeyRepository implements SiteKeyRepository {
    private readonly records;
    store(tenantId: string, record: SiteKeyRecord): Promise<void>;
    find(tenantId: string, siteId: string): Promise<SiteKeyRecord | null>;
    delete(tenantId: string, siteId: string): Promise<boolean>;
}
