import type { TierLookup } from '../site-registry/types.js';
import type { UserRepository } from './UserRepository.js';
/** TierLookup backed by UserRepository — unknown tenant (no account row) falls back to Free. */
export declare class UserTierLookup implements TierLookup {
    private readonly users;
    constructor(users: UserRepository);
    siteLimit(tenantId: string): Promise<number>;
}
