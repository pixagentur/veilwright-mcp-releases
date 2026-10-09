import type { LicenseTier } from '../licensing/LicenseTier.js';
/** A veilwright.one account. accountId == the OAuth `sub` claim == the MCP tenantId — one identity, three names. */
export interface User {
    id: string;
    email: string;
    passwordHash: string;
    tier: LicenseTier;
    createdAt: string;
}
