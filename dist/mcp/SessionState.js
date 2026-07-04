/**
 * In-memory "active site" selection, set via the site.select tool.
 *
 * This is a convenience default, not a safe source of truth: Claude
 * Desktop connects to a configured stdio server once at app startup
 * and that one process is plausibly shared by every open
 * conversation, not spawned fresh per chat. If two conversations are
 * open against different sites, one calling site.select can silently
 * redirect the other's page/media/job/audit calls. Every such tool
 * therefore also accepts an explicit `siteId` argument (see
 * resolveSiteId() in mcp/tools/index.ts) that bypasses this entirely
 * — treat SessionState as a fallback for the common single-site-at-a-
 * time case, not something call sites should rely on for isolation.
 */
export class SessionState {
    activeSiteId = null;
    setActiveSite(siteId) {
        this.activeSiteId = siteId;
    }
    getActiveSite() {
        return this.activeSiteId;
    }
    clearActiveSite() {
        this.activeSiteId = null;
    }
    requireActiveSite() {
        if (this.activeSiteId === null) {
            throw new Error('No active site selected. Call site.select first.');
        }
        return this.activeSiteId;
    }
}
//# sourceMappingURL=SessionState.js.map