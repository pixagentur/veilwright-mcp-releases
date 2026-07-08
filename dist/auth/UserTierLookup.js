import { siteLimitForTier } from '../licensing/LicenseTier.js';
/** TierLookup backed by UserRepository — unknown tenant (no account row) falls back to Free. */
export class UserTierLookup {
    users;
    constructor(users) {
        this.users = users;
    }
    async siteLimit(tenantId) {
        const user = await this.users.findById(tenantId);
        return siteLimitForTier(user?.tier ?? 'free');
    }
}
//# sourceMappingURL=UserTierLookup.js.map