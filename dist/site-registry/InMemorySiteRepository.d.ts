import type { Site, SiteRepository } from './types.js';
/**
 * In-process SiteRepository. Current default implementation — the
 * Postgres-backed repository from docs/architecture.md Teil H is
 * deferred until Docker/Postgres infra is set up and can actually be
 * tested. Suitable for single-instance dev/test use; state is lost
 * on process restart.
 */
export declare class InMemorySiteRepository implements SiteRepository {
    private readonly sites;
    create(tenantId: string, site: Site): Promise<void>;
    findById(tenantId: string, siteId: string): Promise<Site | null>;
    list(tenantId: string): Promise<Site[]>;
    update(tenantId: string, siteId: string, patch: Partial<Site>): Promise<Site | null>;
    delete(tenantId: string, siteId: string): Promise<boolean>;
}
