import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { openDatabase } from '../db/Database.js';
import { KeyVault } from '../site-registry/KeyVault.js';
import { SiteRegistry } from '../site-registry/SiteRegistry.js';
import { SqliteSiteKeyRepository } from '../site-registry/SqliteSiteKeyRepository.js';
import { SqliteSiteRepository } from '../site-registry/SqliteSiteRepository.js';
import { getVaultMasterKeyFromEnv } from '../support/config.js';
import { SERVER_INSTRUCTIONS } from './instructions.js';
import { registerResources } from './resources.js';
import { registerTools } from './tools/index.js';
import { SessionState } from './SessionState.js';
import { WpClientFactory } from './WpClientFactory.js';
/**
 * Single fixed tenant: this process runs on one person's own
 * machine for their own WordPress site(s), there is no multi-user
 * concept here — unlike the hosted HTTP entrypoint (src/http/
 * server.ts), which resolves a real per-account tenantId from an
 * OAuth token.
 */
const LOCAL_TENANT_ID = 'local';
function defaultDbPath() {
    const dir = join(homedir(), '.veilwright');
    mkdirSync(dir, { recursive: true });
    return join(dir, 'veilwright.sqlite3');
}
/**
 * Builds the dependencies for local, self-hosted use: SQLite-backed
 * (site registrations survive Claude Desktop/Code restarts, unlike
 * the plain in-memory default in tools/index.ts's
 * buildDefaultDependencies). No TierLookup/license key here — the
 * site-limit-per-license-key enforcement point is veilwright.one
 * (domain-to-key activation when the WP plugin's license key is
 * entered), not this local process, which has no way to see how
 * many *other* domains share the same key anyway. See
 * docs/self-hosting.md for the end-user setup guide.
 */
function buildLocalDependencies(env) {
    const vault = new KeyVault(getVaultMasterKeyFromEnv(env)); // validate env before any file I/O
    const db = openDatabase(env.VEILWRIGHT_DB_PATH ?? defaultDbPath());
    const siteRegistry = new SiteRegistry(new SqliteSiteRepository(db), new SqliteSiteKeyRepository(db), vault);
    return {
        tenantId: LOCAL_TENANT_ID,
        siteRegistry,
        clients: new WpClientFactory(siteRegistry),
        session: new SessionState(),
    };
}
export function createServer() {
    const server = new McpServer({
        name: 'veilwright-mcp',
        version: '0.17.0',
    }, { instructions: SERVER_INSTRUCTIONS });
    registerTools(server, buildLocalDependencies(process.env));
    registerResources(server);
    return server;
}
async function main() {
    const server = createServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((error) => {
    console.error('[veilwright-mcp] fatal error during startup', error);
    process.exit(1);
});
//# sourceMappingURL=server.js.map