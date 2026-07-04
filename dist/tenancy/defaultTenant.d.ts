/**
 * Placeholder single-tenant ID used until Phase 6 wires up real
 * OAuth2 user/tenant resolution. Matches the phased approach in
 * docs/architecture.md Teil F/P: the registry is tenant-scoped from
 * day one, but self-service multi-user onboarding lands later.
 */
export declare function getDefaultTenantId(env: NodeJS.ProcessEnv): string;
