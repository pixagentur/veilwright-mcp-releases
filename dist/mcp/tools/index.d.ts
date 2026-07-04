import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SiteRegistry } from '../../site-registry/SiteRegistry.js';
import { SessionState } from '../SessionState.js';
import { WpClientFactory } from '../WpClientFactory.js';
/**
 * Everything one call to registerTools() closes over. tenantId is
 * per-*connection*, not per-process: the stdio entrypoint (one
 * process per Claude Code session) and the HTTP entrypoint (one
 * long-running process shared by every authenticated user) both call
 * registerTools once per McpServer instance, but the HTTP side builds
 * a fresh McpServer + SessionState per authenticated session with
 * that session's own tenantId — see src/http/mcpRoute.ts.
 */
export interface ToolDependencies {
    tenantId: string;
    siteRegistry: SiteRegistry;
    clients: WpClientFactory;
    session: SessionState;
}
/**
 * Reproduces the original stdio-only behaviour: one env-configured
 * tenant, in-memory site storage, valid only for the lifetime of this
 * process. Used by the stdio entrypoint (src/mcp/server.ts) and by
 * tests; the HTTP entrypoint builds its own ToolDependencies per
 * authenticated session instead (SQLite-backed, real tenantId from
 * the verified OAuth token).
 */
export declare function buildDefaultDependencies(env: NodeJS.ProcessEnv): ToolDependencies;
/**
 * Registers all Veilwright MCP tools on the given server instance,
 * scoped to one tenant via `deps`.
 *
 * site.add/list/select/update/remove/healthCheck, page.*
 * (create/get/update/delete/list/backup/restore/listBackups),
 * media.upload, job.status, audit.run.
 * site.healthCheck pings the site's /system endpoint and records
 * healthStatus ('healthy'/'unreachable') on the SiteRegistry record.
 *
 * IMPORTANT: this wiring has not been type-checked against the
 * installed @modelcontextprotocol/sdk version — no Node/npm is
 * available in this environment. Run `npm install && npm run
 * typecheck` before relying on it; server.tool()'s exact signature
 * has changed across SDK versions.
 */
export declare function registerTools(server: McpServer, deps?: ToolDependencies): void;
