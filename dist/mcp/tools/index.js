import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { z } from 'zod';
import { InMemorySiteKeyRepository } from '../../site-registry/InMemorySiteKeyRepository.js';
import { InMemorySiteRepository } from '../../site-registry/InMemorySiteRepository.js';
import { KeyVault } from '../../site-registry/KeyVault.js';
import { SiteRegistry } from '../../site-registry/SiteRegistry.js';
import { getVaultMasterKeyFromEnv } from '../../support/config.js';
import { getDefaultTenantId } from '../../tenancy/defaultTenant.js';
import { detectMimeType } from '../../wp-client/mimeTypes.js';
import { SessionState } from '../SessionState.js';
import { WpClientFactory } from '../WpClientFactory.js';
function jsonContent(data) {
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}
const elementorElementSchema = z.lazy(() => z.object({
    elType: z.string().min(1),
    widgetType: z.string().min(1).optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
    elements: z.array(elementorElementSchema).optional(),
    id: z.string().optional(),
}));
const fluentFormFieldSchema = z.lazy(() => z.object({
    element: z.string().min(1),
    attributes: z.record(z.string(), z.unknown()).optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
    uniqElKey: z.string().optional(),
    columns: z
        .array(z.object({
        width: z.string().optional(),
        fields: z.array(fluentFormFieldSchema).optional(),
    }))
        .optional(),
}));
function errorContent(error) {
    const message = error instanceof Error ? error.message : String(error);
    return { content: [{ type: 'text', text: message }], isError: true };
}
/**
 * Resolves which site a page/media/job/audit call targets: the
 * explicit `siteId` argument if given, otherwise `session`'s
 * currently-selected site. The explicit argument exists because
 * `session` is one mutable value per running MCP process — if a
 * single process instance is ever shared by more than one concurrent
 * conversation (plausible for Claude Desktop, which connects to a
 * configured stdio server once at app startup, not per-chat), one
 * conversation's `site_select` would otherwise silently redirect
 * another conversation's calls. Passing siteId explicitly sidesteps
 * that regardless of Claude Desktop's exact process model.
 */
function resolveSiteId(explicitSiteId, session) {
    return explicitSiteId ?? session.requireActiveSite();
}
/**
 * Reproduces the original stdio-only behaviour: one env-configured
 * tenant, in-memory site storage, valid only for the lifetime of this
 * process. Used by the stdio entrypoint (src/mcp/server.ts) and by
 * tests; the HTTP entrypoint builds its own ToolDependencies per
 * authenticated session instead (SQLite-backed, real tenantId from
 * the verified OAuth token).
 */
export function buildDefaultDependencies(env) {
    const vault = new KeyVault(getVaultMasterKeyFromEnv(env));
    const siteRegistry = new SiteRegistry(new InMemorySiteRepository(), new InMemorySiteKeyRepository(), vault);
    return {
        tenantId: getDefaultTenantId(env),
        siteRegistry,
        clients: new WpClientFactory(siteRegistry),
        session: new SessionState(),
    };
}
/**
 * Registers all Veilwright MCP tools on the given server instance,
 * scoped to one tenant via `deps`.
 *
 * site_add/list/select/update/remove/healthCheck, page.*
 * (create/get/update/delete/list/backup/restore/listBackups),
 * media_upload, job_status, audit_run.
 * site_healthCheck pings the site's /system endpoint and records
 * healthStatus ('healthy'/'unreachable') on the SiteRegistry record.
 *
 * IMPORTANT: this wiring has not been type-checked against the
 * installed @modelcontextprotocol/sdk version — no Node/npm is
 * available in this environment. Run `npm install && npm run
 * typecheck` before relying on it; server.tool()'s exact signature
 * has changed across SDK versions.
 */
export function registerTools(server, deps = buildDefaultDependencies(process.env)) {
    const { tenantId, siteRegistry, clients, session } = deps;
    server.tool('site_add', 'Register a new WordPress site for this tenant, storing its API credentials encrypted.', {
        url: z.string().url(),
        name: z.string().min(1),
        apiKeyId: z.string().min(1),
        apiSecret: z.string().min(1),
        description: z.string().optional(),
    }, async (args) => {
        try {
            const site = await siteRegistry.addSite(tenantId, { url: args.url, name: args.name, description: args.description }, args.apiKeyId, args.apiSecret);
            return jsonContent(site);
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('site_list', 'List all WordPress sites registered for this tenant.', {}, async () => {
        try {
            return jsonContent(await siteRegistry.listSites(tenantId));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('site_select', 'Set the active site for subsequent page/media/job tool calls.', { siteId: z.string().min(1) }, async (args) => {
        try {
            const site = await siteRegistry.getSite(tenantId, args.siteId);
            session.setActiveSite(site.id);
            return jsonContent({ selected: site.id, name: site.name });
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('site_update', 'Update a registered site\'s name, description, theme, or plugin list.', {
        siteId: z.string().min(1),
        name: z.string().optional(),
        description: z.string().optional(),
        theme: z.string().optional(),
        plugins: z.array(z.string()).optional(),
    }, async (args) => {
        try {
            const { siteId, ...patch } = args;
            const site = await siteRegistry.updateSite(tenantId, siteId, patch);
            return jsonContent(site);
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('site_remove', 'Remove a registered site and its stored credentials.', { siteId: z.string().min(1) }, async (args) => {
        try {
            await siteRegistry.removeSite(tenantId, args.siteId);
            clients.invalidate(tenantId, args.siteId);
            if (session.getActiveSite() === args.siteId) {
                session.clearActiveSite();
            }
            return jsonContent({ removed: args.siteId });
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('site_healthCheck', 'Ping a registered site\'s /system endpoint and record whether it is reachable. The result includes `languages` (null on a single-language site) — ' +
        'check this before creating content and ask the user which language it\'s for if it\'s present, passing that as `lang` to page_create/page_createFromHtml.', { siteId: z.string().min(1) }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, args.siteId);
            const info = await client.request('GET', '/wp-json/veilwright/v1/system');
            const site = await siteRegistry.updateSite(tenantId, args.siteId, {
                healthStatus: 'healthy',
                wpVersion: info.wp_version,
                elementorVersion: info.environment?.elementor ?? undefined,
            });
            return jsonContent({ ...site, languages: info.languages ?? null });
        }
        catch (error) {
            await siteRegistry.updateSite(tenantId, args.siteId, { healthStatus: 'unreachable' }).catch(() => undefined);
            return errorContent(error);
        }
    });
    const SITE_ID_PARAM = {
        siteId: z
            .string()
            .min(1)
            .optional()
            .describe('Target site ID. Defaults to the site chosen via site_select. Pass explicitly when working across multiple sites so calls cannot land on the wrong one.'),
    };
    const DATE_PARAM = {
        date: z
            .string()
            .optional()
            .describe('Backdate the publish date — "YYYY-MM-DD" or "YYYY-MM-DD HH:MM:SS", site-local time. Only needed when backfilling historical content that must sort/display by its real ' +
            'original date (e.g. a changelog entry for a past release) rather than today. Omit for normal new content, which uses the actual creation time as usual.'),
    };
    server.tool('page_create', 'Create a page on a site.', {
        title: z.string().min(1),
        content: z.string().optional(),
        status: z.string().optional(),
        lang: z
            .string()
            .optional()
            .describe('Language code (e.g. "de", "en") to assign — only meaningful, and only takes effect, if Polylang or WPML is active (check site_healthCheck\'s `languages` field first). Ask the user which language if it\'s ambiguous.'),
        translationOfId: z
            .number()
            .int()
            .positive()
            .optional()
            .describe('An existing page ID this one is a translation of — links them as a translation group. Requires `lang` to also be set.'),
        ...DATE_PARAM,
        ...SITE_ID_PARAM,
    }, async (args) => {
        try {
            const { siteId, ...attributes } = args;
            const client = await clients.forSite(tenantId, resolveSiteId(siteId, session));
            return jsonContent(await client.request('POST', '/wp-json/veilwright/v1/pages', attributes));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('page_get', 'Get a page from a site by ID.', { id: z.number().int().positive(), ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('GET', `/wp-json/veilwright/v1/pages/${args.id}`));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('page_update', 'Update a page on a site.', {
        id: z.number().int().positive(),
        title: z.string().optional(),
        content: z.string().optional(),
        status: z.string().optional(),
        lang: z.string().optional().describe('Language code (e.g. "de", "en") to (re-)assign — only takes effect if Polylang or WPML is active.'),
        translationOfId: z
            .number()
            .int()
            .positive()
            .optional()
            .describe('An existing page ID this one is a translation of — links them as a translation group. Requires `lang` to also be set.'),
        ...DATE_PARAM,
        ...SITE_ID_PARAM,
    }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            const { id, siteId: _siteId, ...attributes } = args;
            return jsonContent(await client.request('PUT', `/wp-json/veilwright/v1/pages/${id}`, attributes));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('page_delete', 'Delete a page on a site.', { id: z.number().int().positive(), ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('DELETE', `/wp-json/veilwright/v1/pages/${args.id}`));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('page_list', 'List pages on a site.', { ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('GET', '/wp-json/veilwright/v1/pages'));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    const POST_CATEGORIES_PARAM = {
        categories: z
            .array(z.string())
            .optional()
            .describe('Category names (or numeric term IDs as strings) to tag this post with — a name that doesn\'t exist yet on the site is created automatically, no separate lookup needed.'),
    };
    server.tool('post_create', 'Create a regular WordPress post (the built-in Blog Post type — not a page, not an Elementor template). Useful for anything meant to show up as a chronological, ' +
        'categorized feed (a changelog, a blog, news) rather than a standalone page — pair with an Elementor `posts` widget filtered to the same category to render the feed automatically.', {
        title: z.string().min(1),
        content: z.string().optional(),
        status: z.string().optional(),
        lang: z
            .string()
            .optional()
            .describe('Language code (e.g. "de", "en") to assign — only meaningful, and only takes effect, if Polylang or WPML is active (check site_healthCheck\'s `languages` field first). Ask the user which language if it\'s ambiguous.'),
        translationOfId: z
            .number()
            .int()
            .positive()
            .optional()
            .describe('An existing post ID this one is a translation of — links them as a translation group. Requires `lang` to also be set.'),
        ...DATE_PARAM,
        ...POST_CATEGORIES_PARAM,
        ...SITE_ID_PARAM,
    }, async (args) => {
        try {
            const { siteId, ...attributes } = args;
            const client = await clients.forSite(tenantId, resolveSiteId(siteId, session));
            return jsonContent(await client.request('POST', '/wp-json/veilwright/v1/posts', attributes));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('post_get', 'Get a WordPress post from a site by ID.', { id: z.number().int().positive(), ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('GET', `/wp-json/veilwright/v1/posts/${args.id}`));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('post_update', 'Update a WordPress post on a site.', {
        id: z.number().int().positive(),
        title: z.string().optional(),
        content: z.string().optional(),
        status: z.string().optional(),
        lang: z.string().optional().describe('Language code (e.g. "de", "en") to (re-)assign — only takes effect if Polylang or WPML is active.'),
        translationOfId: z
            .number()
            .int()
            .positive()
            .optional()
            .describe('An existing post ID this one is a translation of — links them as a translation group. Requires `lang` to also be set.'),
        ...DATE_PARAM,
        ...POST_CATEGORIES_PARAM,
        ...SITE_ID_PARAM,
    }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            const { id, siteId: _siteId, ...attributes } = args;
            return jsonContent(await client.request('PUT', `/wp-json/veilwright/v1/posts/${id}`, attributes));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('post_delete', 'Delete a WordPress post on a site.', { id: z.number().int().positive(), ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('DELETE', `/wp-json/veilwright/v1/posts/${args.id}`));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('post_list', 'List WordPress posts on a site, optionally filtered to one category — use this to check which entries already exist (e.g. changelog versions already published) before creating more.', {
        category: z.string().optional().describe('Filter to posts in this category (exact name match). Omit to list every post.'),
        ...SITE_ID_PARAM,
    }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            const path = args.category
                ? `/wp-json/veilwright/v1/posts?category=${encodeURIComponent(args.category)}`
                : '/wp-json/veilwright/v1/posts';
            return jsonContent(await client.request('GET', path));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('customPostType_create', 'Create an entry of a custom post type the site owner already registered themselves (via ACF, code, another plugin — not a page, not the built-in Post type, not an Elementor template). ' +
        'Pass its exact registered slug as `postType` (ask the user or check WP-admin if unsure). Only sets the standard title/content/status/language fields — any field specific to the custom ' +
        'post type itself (ACF fields, etc.) must be set afterward with `acf_update`/`acf_updateAll` on the returned `id`, which work on any post regardless of its post type.', {
        postType: z.string().min(1).describe('The custom post type\'s exact registered slug, e.g. "changelog_eintrag".'),
        title: z.string().min(1),
        content: z.string().optional(),
        status: z.string().optional(),
        lang: z
            .string()
            .optional()
            .describe('Language code (e.g. "de", "en") to assign — only meaningful, and only takes effect, if Polylang or WPML is active (check site_healthCheck\'s `languages` field first). Ask the user which language if it\'s ambiguous.'),
        translationOfId: z
            .number()
            .int()
            .positive()
            .optional()
            .describe('An existing entry ID (same post type) this one is a translation of — links them as a translation group. Requires `lang` to also be set.'),
        ...DATE_PARAM,
        ...SITE_ID_PARAM,
    }, async (args) => {
        try {
            const { siteId, postType, ...attributes } = args;
            const client = await clients.forSite(tenantId, resolveSiteId(siteId, session));
            return jsonContent(await client.request('POST', `/wp-json/veilwright/v1/custom-post-types/${encodeURIComponent(postType)}`, attributes));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('customPostType_get', 'Get one entry of a custom post type by ID.', {
        postType: z.string().min(1).describe('The custom post type\'s exact registered slug.'),
        id: z.number().int().positive(),
        ...SITE_ID_PARAM,
    }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('GET', `/wp-json/veilwright/v1/custom-post-types/${encodeURIComponent(args.postType)}/${args.id}`));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('customPostType_update', 'Update an entry of a custom post type — only the standard title/content/status/language fields; use acf_update/acf_updateAll for fields specific to the post type itself.', {
        postType: z.string().min(1).describe('The custom post type\'s exact registered slug.'),
        id: z.number().int().positive(),
        title: z.string().optional(),
        content: z.string().optional(),
        status: z.string().optional(),
        lang: z.string().optional().describe('Language code (e.g. "de", "en") to (re-)assign — only takes effect if Polylang or WPML is active.'),
        translationOfId: z
            .number()
            .int()
            .positive()
            .optional()
            .describe('An existing entry ID (same post type) this one is a translation of — links them as a translation group. Requires `lang` to also be set.'),
        ...DATE_PARAM,
        ...SITE_ID_PARAM,
    }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            const { postType, id, siteId: _siteId, ...attributes } = args;
            return jsonContent(await client.request('PUT', `/wp-json/veilwright/v1/custom-post-types/${encodeURIComponent(postType)}/${id}`, attributes));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('customPostType_delete', 'Delete an entry of a custom post type.', {
        postType: z.string().min(1).describe('The custom post type\'s exact registered slug.'),
        id: z.number().int().positive(),
        ...SITE_ID_PARAM,
    }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('DELETE', `/wp-json/veilwright/v1/custom-post-types/${encodeURIComponent(args.postType)}/${args.id}`));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('customPostType_list', 'List entries of a custom post type — use this to check what already exists before creating more.', {
        postType: z.string().min(1).describe('The custom post type\'s exact registered slug.'),
        ...SITE_ID_PARAM,
    }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('GET', `/wp-json/veilwright/v1/custom-post-types/${encodeURIComponent(args.postType)}`));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('page_createFromHtml', 'Convert HTML into a native Elementor page (widgets, not an HTML blob) — this is what to use whenever there is a design/layout to build, not page_create. ' +
        'Async: returns { jobId, status: "queued", postId } immediately. Poll job_status(jobId) until its status is "completed" (or "failed"), then call ' +
        'page_update({ id: postId, status: "publish" }) — the converted page is always left as a draft, publishing is a separate step. Pass postId to convert into an existing page instead of creating a new one.', {
        html: z.string().min(1),
        title: z.string().optional().describe('New page title. Ignored if postId is given.'),
        slug: z.string().optional().describe('New page slug. Ignored if postId is given.'),
        postId: z.number().int().positive().optional().describe('Convert into this existing page instead of creating a new one.'),
        lang: z
            .string()
            .optional()
            .describe('Language code (e.g. "de", "en") to assign to the new page — only meaningful if Polylang or WPML is active (check site_healthCheck\'s `languages` field first). Ignored if postId is given (converting into an existing page doesn\'t change its language).'),
        translationOfId: z
            .number()
            .int()
            .positive()
            .optional()
            .describe('An existing page ID the new page is a translation of — links them as a translation group. Requires `lang`, and is ignored if postId is given.'),
        ...SITE_ID_PARAM,
    }, async (args) => {
        try {
            const { siteId, ...body } = args;
            const client = await clients.forSite(tenantId, resolveSiteId(siteId, session));
            return jsonContent(await client.request('POST', '/wp-json/veilwright/v1/convert/elementor', body));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('page_getElementorData', "Read a page's actual, currently-persisted Elementor element tree (`_elementor_data`) — independent of frontend rendering (which depends on caching/theme/CSS regeneration) " +
        "and independent of any previous page_addElementorWidget/page_createFromHtml response. Use this to verify content really persisted, especially after several writes to the " +
        'same page in a row, or when a page looks empty/wrong and you need to know whether the data is actually missing or something else (rendering, caching) is the problem. ' +
        "`page_get`'s `content` field is never this — that's the classic WordPress post_content field, which Elementor leaves empty on purpose.", { id: z.number().int().positive().describe('The page to read.'), ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('GET', `/wp-json/veilwright/v1/pages/${args.id}/elementor/elements`));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('page_addElementorWidget', 'Append a specific Elementor widget (or a container with nested widgets) to an existing page — use this for widget types page_createFromHtml has no native mapping for ' +
        '(accordion, testimonial, countdown, icon-box, rating, and more). Check the veilwright-workflow skill\'s ELEMENTOR_WIDGETS.md for widgetType/settings examples and how ' +
        'confident that reference is for the widget you need — not everything there is equally certain, especially query-driven Pro widgets. Not for building a whole page from ' +
        'scratch — use page_createFromHtml or page_create for that, then add specific widgets with this afterwards.', {
        id: z.number().int().positive().describe('The page to append the element to.'),
        element: elementorElementSchema.describe('{ elType: "widget"|"container", widgetType?, settings?, elements? } — see ELEMENTOR_WIDGETS.md for real widgetType/settings values, this does not validate them.'),
        ...SITE_ID_PARAM,
    }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('POST', `/wp-json/veilwright/v1/pages/${args.id}/elementor/elements`, args.element));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('page_updateElementorWidget', 'Fix an existing Elementor widget/container on a page in place — e.g. a typo, a wrong link, a color — without resending the whole element or rebuilding the page. ' +
        '`elementId` is that element\'s own `id` (returned by page_addElementorWidget when it was created, or from page_createFromHtml\'s conversion — not currently otherwise ' +
        'readable back, so keep track of ids returned when building a page if you may need to fix them later). `settings` is shallow-merged into the element\'s existing settings — ' +
        'only the keys you pass change, everything else stays. Cannot change `elType`/`widgetType`/child elements this way — remove and re-add the element instead if the widget ' +
        'type itself needs to change, not just its settings.', {
        id: z.number().int().positive().describe('The page the element lives on.'),
        elementId: z.string().min(1).describe("The element's own id (not the page id)."),
        settings: z.record(z.string(), z.unknown()).describe('Only the settings keys that should change.'),
        ...SITE_ID_PARAM,
    }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('PUT', `/wp-json/veilwright/v1/pages/${args.id}/elementor/elements/${args.elementId}`, {
                settings: args.settings,
            }));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('elementorTemplate_list', 'List Theme Builder templates without their content — each item has id/title/type/lang. Use this to check which languages already have a template of a given type ' +
        '(e.g. before offering to create a search-results/footer/404 template on a multilingual site) instead of guessing from titles or calling elementorTemplate_get on every ' +
        'known ID — titles are cosmetic, only `lang` (from Polylang/WPML) is real.', {
        type: z
            .enum(['footer', 'header', 'error-404', 'search-results', 'single-post', 'product', 'popup'])
            .optional()
            .describe('Filter to one template type. Omit to list every managed type.'),
        ...SITE_ID_PARAM,
    }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            const path = args.type
                ? `/wp-json/veilwright/v1/elementor/templates?type=${encodeURIComponent(args.type)}`
                : '/wp-json/veilwright/v1/elementor/templates';
            return jsonContent(await client.request('GET', path));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('elementorTemplate_create', 'Create a conditional Elementor Theme Builder template (footer, header, 404, search-results, single-post, product, or popup) — for a request naming one of these, use this ' +
        "instead of page_create/page_addElementorWidget, which would only edit a single page's content, not a real site-wide/conditional template. Build `elements` the same way as " +
        'page_addElementorWidget\'s `element` (see ELEMENTOR_WIDGETS.md — for single-post/product templates, use context-only widgets like theme-post-content/woocommerce-*). ' +
        '`conditions` only defaults to entire-site ("include/general") for footer/header; every other type REQUIRES an explicit condition string (see FLUENT_FORMS.md\'s sibling doc ' +
        "elementor-templates.md for suggested strings per type, e.g. [\"include/404\"], [\"include/singular/post-type/product\"]) — ask the user if it's unclear rather than guessing. " +
        'None of the condition strings are verified against a live install, check in the Elementor editor afterwards. For a popup, `pageSettings` covers width/close-button/background ' +
        "only — its trigger (on page load, on scroll, ...) has no ground truth yet and needs setting manually in the editor's Popup Settings → Triggers tab; always tell the user this " +
        "after creating one, an untriggered popup never shows. On a multilingual site (Polylang/WPML), pass `lang` explicitly — templates otherwise land in whatever language Polylang " +
        "defaults new elementor_library posts to (its own site default, not necessarily the language the template is actually for), and there's no other way to set it at creation time.", {
        title: z.string().min(1),
        type: z.enum(['footer', 'header', 'error-404', 'search-results', 'single-post', 'product', 'popup']),
        elements: z.array(elementorElementSchema).min(1).describe('Top-level Elementor elements — same shape as page_addElementorWidget\'s element.'),
        conditions: z
            .array(z.string())
            .optional()
            .describe('Elementor Pro display-condition strings. Defaults to ["include/general"] for footer/header only; required for every other type.'),
        pageSettings: z
            .record(z.string(), z.unknown())
            .optional()
            .describe('Per-document settings, mainly for popups (width, close-button, background) — not trigger timing, see tool description.'),
        lang: z
            .string()
            .optional()
            .describe('Language code (e.g. "de", "en") to assign — only takes effect if Polylang or WPML is active. Ask the user if a multilingual site and no language was specified.'),
        translationOfId: z
            .number()
            .int()
            .positive()
            .optional()
            .describe('An existing template ID this one is a translation of — links them as a translation group. Requires `lang` to also be set.'),
        ...SITE_ID_PARAM,
    }, async (args) => {
        try {
            const { siteId, ...body } = args;
            const client = await clients.forSite(tenantId, resolveSiteId(siteId, session));
            return jsonContent(await client.request('POST', '/wp-json/veilwright/v1/elementor/templates', body));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('elementorTemplate_get', 'Read back a Theme Builder template created via elementorTemplate_create (id, title, type, conditions, pageSettings, elements, lang).', { id: z.number().int().positive(), ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('GET', `/wp-json/veilwright/v1/elementor/templates/${args.id}`));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('elementorTemplate_updateConditions', 'Change which pages/context a Theme Builder template applies to, without touching its content.', {
        id: z.number().int().positive(),
        conditions: z.array(z.string()).min(1),
        ...SITE_ID_PARAM,
    }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('PUT', `/wp-json/veilwright/v1/elementor/templates/${args.id}/conditions`, {
                conditions: args.conditions,
            }));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('elementorTemplate_updatePageSettings', 'Change a Theme Builder template\'s per-document settings (mainly popup width/close-button/background) without touching its content or conditions.', {
        id: z.number().int().positive(),
        pageSettings: z.record(z.string(), z.unknown()),
        ...SITE_ID_PARAM,
    }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('PUT', `/wp-json/veilwright/v1/elementor/templates/${args.id}/page-settings`, {
                pageSettings: args.pageSettings,
            }));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('elementorTemplate_updateLanguage', 'Set or correct a Theme Builder template\'s language on a multilingual site (Polylang/WPML) — for when it landed in the wrong language at creation time (e.g. elementorTemplate_create ' +
        "was called without `lang` and Polylang defaulted it to the site's own default language), or needs fixing after the fact. Templates have no general update endpoint the way pages " +
        "do, so this is its own tool rather than folded into something else. `translationOfId` links this template to an existing one as a translation group (requires `lang` — always " +
        'passed here anyway).', {
        id: z.number().int().positive().describe('The template to update.'),
        lang: z.string().min(1).describe('Language code (e.g. "de", "en").'),
        translationOfId: z.number().int().positive().optional().describe('An existing template ID this one is a translation of — links them as a translation group.'),
        ...SITE_ID_PARAM,
    }, async (args) => {
        try {
            const { siteId, id, ...body } = args;
            const client = await clients.forSite(tenantId, resolveSiteId(siteId, session));
            return jsonContent(await client.request('PUT', `/wp-json/veilwright/v1/elementor/templates/${id}/language`, body));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('elementorTemplate_delete', "Delete a Theme Builder template (footer, header, etc.) — trashes it (recoverable in WP-admin), not permanent. `page_delete` can't reach a template, it's scoped to " +
        'regular pages/posts and 404s on a template\'s post; this is the only way to remove one via the API. Use this instead of leaving a wrongly-configured template ' +
        '(wrong type, wrong language, wrong content) sitting around after replacing it with a corrected one.', { id: z.number().int().positive().describe('The template to delete.'), ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('DELETE', `/wp-json/veilwright/v1/elementor/templates/${args.id}`));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('elementorKit_listColors', 'List the active Elementor Kit\'s Global Colors: the 4 system slots (primary/secondary/text/accent, always present) plus any custom colors. Speculative — see the tool\'s ' +
        'own docs/elementor-kit.md for why (no Kit template export exists yet, unlike everything else Elementor-related in this skill). Verify a change actually shows up in ' +
        "Elementor's Site Settings → Global Colors panel before relying on it.", { ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('GET', '/wp-json/veilwright/v1/elementor/kit/colors'));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('elementorKit_addColor', 'Add a custom Global Color to the active Elementor Kit (not one of the 4 fixed system slots — use elementorKit_updateColor for those). `color` must be a hex string ' +
        '(3/6/8-digit, e.g. "#1E5AA8" or "#FFFFFFE6" with alpha).', { title: z.string().min(1), color: z.string().min(1), ...SITE_ID_PARAM }, async (args) => {
        try {
            const { siteId, ...body } = args;
            const client = await clients.forSite(tenantId, resolveSiteId(siteId, session));
            return jsonContent(await client.request('POST', '/wp-json/veilwright/v1/elementor/kit/colors', body));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('elementorKit_updateColor', 'Update a Global Color by its _id (from elementorKit_listColors) — works for both system slots (primary/secondary/text/accent) and custom colors, including renaming a system slot\'s display title (e.g. "Primär" → "Überschrift H1") — only its _id stays fixed since widgets reference colors by _id, not by title.', { id: z.string().min(1), color: z.string().optional(), title: z.string().optional(), ...SITE_ID_PARAM }, async (args) => {
        try {
            const { siteId, id, ...body } = args;
            const client = await clients.forSite(tenantId, resolveSiteId(siteId, session));
            return jsonContent(await client.request('PUT', `/wp-json/veilwright/v1/elementor/kit/colors/${id}`, body));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('elementorKit_deleteColor', 'Delete a custom Global Color by its _id. Fails if the id belongs to a system slot (primary/secondary/text/accent) — those can only be updated, not deleted.', { id: z.string().min(1), ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('DELETE', `/wp-json/veilwright/v1/elementor/kit/colors/${args.id}`));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('elementorKit_listFonts', 'List the active Elementor Kit\'s Global Fonts: the 4 system slots (primary/secondary/text/accent) plus any custom fonts. Same speculative-shape caveat as ' +
        'elementorKit_listColors — verify in the Elementor editor.', { ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('GET', '/wp-json/veilwright/v1/elementor/kit/fonts'));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('elementorKit_addFont', 'Add a custom Global Font to the active Elementor Kit. `typography` is a flat object of typography_*-prefixed settings (typography_typography, typography_font_family, ' +
        'typography_font_weight, typography_font_size, typography_line_height, ...) — the same convention seen throughout ELEMENTOR_WIDGETS.md for widget typography. ' +
        '`typography_font_family` only actually renders if that font is already available — a system font, or any other font (including Google Fonts) self-hosted first via ' +
        'customFont_upload. Never reference a Google Font by name/CDN directly — that loads it live from Google\'s servers, a GDPR/DSGVO problem for an EU-facing site. ' +
        'A font uploaded manually through Elementor Pro\'s separate Custom Fonts screen (WP-admin → Elementor → Custom Elements → Fonts, Pro-only) also works if the user already set it up there.', { title: z.string().min(1), typography: z.record(z.string(), z.unknown()), ...SITE_ID_PARAM }, async (args) => {
        try {
            const { siteId, ...body } = args;
            const client = await clients.forSite(tenantId, resolveSiteId(siteId, session));
            return jsonContent(await client.request('POST', '/wp-json/veilwright/v1/elementor/kit/fonts', body));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('elementorKit_updateFont', 'Update a Global Font by its _id (from elementorKit_listFonts) — works for both system slots (primary/secondary/text/accent) and custom fonts, including renaming a system slot\'s display title (e.g. "Primär" → "Überschrift H1") — only its _id stays fixed since widgets reference typography by _id, not by title.', {
        id: z.string().min(1),
        typography: z.record(z.string(), z.unknown()).optional(),
        title: z.string().optional(),
        ...SITE_ID_PARAM,
    }, async (args) => {
        try {
            const { siteId, id, ...body } = args;
            const client = await clients.forSite(tenantId, resolveSiteId(siteId, session));
            return jsonContent(await client.request('PUT', `/wp-json/veilwright/v1/elementor/kit/fonts/${id}`, body));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('elementorKit_deleteFont', 'Delete a custom Global Font by its _id. Fails if the id belongs to a system slot (primary/secondary/text/accent) — those can only be updated, not deleted.', { id: z.string().min(1), ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('DELETE', `/wp-json/veilwright/v1/elementor/kit/fonts/${args.id}`));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('elementorKit_updateFontFallback', 'Set the active Elementor Kit\'s Kit-wide "Fallback Font Family" (Elementor\'s own `default_generic_fonts` setting, shown below the Global Fonts list in the Kit editor — Elementor\'s own default is "Sans-serif") — used if a referenced font isn\'t available. ' +
        'This is a single site-wide string, not per-font. Only set this once, the first time a site\'s Kit is baselined (see the Kit-baseline rule) — check elementorKit_listFonts\' `defaultGenericFonts` first; if it\'s already set (by this baseline or by the user manually), leave it alone unless the user explicitly asks to change it.', { defaultGenericFonts: z.string().min(1), ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('PUT', '/wp-json/veilwright/v1/elementor/kit/font-fallback', {
                defaultGenericFonts: args.defaultGenericFonts,
            }));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('elementorKit_getLayout', "Read the active Elementor Kit's Layout settings — content width (containerWidth) and responsive breakpoints (activeBreakpoints, viewportMobile/viewportMobileExtra/viewportTablet/viewportTabletExtra/viewportLaptop/viewportWidescreen).", { ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('GET', '/wp-json/veilwright/v1/elementor/kit/layout'));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('elementorKit_updateLayout', 'Update the active Elementor Kit\'s Layout settings. Only send the fields that should change. `containerWidth` is the page content\'s max width in px (Elementor\'s own default is 1140 — set to a specific design\'s value, e.g. 1300, when one is given). ' +
        '`activeBreakpoints` is the array of breakpoint keys that are enabled ("viewport_mobile"/"viewport_tablet" are always active and locked; add "viewport_mobile_extra"/"viewport_tablet_extra"/"viewport_laptop"/"viewport_widescreen" to enable those too — pass all six to enable everything). ' +
        'Each `viewport*` field sets that breakpoint\'s own px value (Elementor\'s real defaults: mobile 767, mobileExtra 880, tablet 1024, tabletExtra 1200, laptop 1366, widescreen 2400).', {
        containerWidth: z.number().optional(),
        activeBreakpoints: z.array(z.string()).optional(),
        viewportMobile: z.number().int().optional(),
        viewportMobileExtra: z.number().int().optional(),
        viewportTablet: z.number().int().optional(),
        viewportTabletExtra: z.number().int().optional(),
        viewportLaptop: z.number().int().optional(),
        viewportWidescreen: z.number().int().optional(),
        ...SITE_ID_PARAM,
    }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            const body = {};
            if (args.containerWidth !== undefined)
                body.container_width = args.containerWidth;
            if (args.activeBreakpoints !== undefined)
                body.active_breakpoints = args.activeBreakpoints;
            if (args.viewportMobile !== undefined)
                body.viewport_mobile = args.viewportMobile;
            if (args.viewportMobileExtra !== undefined)
                body.viewport_mobile_extra = args.viewportMobileExtra;
            if (args.viewportTablet !== undefined)
                body.viewport_tablet = args.viewportTablet;
            if (args.viewportTabletExtra !== undefined)
                body.viewport_tablet_extra = args.viewportTabletExtra;
            if (args.viewportLaptop !== undefined)
                body.viewport_laptop = args.viewportLaptop;
            if (args.viewportWidescreen !== undefined)
                body.viewport_widescreen = args.viewportWidescreen;
            return jsonContent(await client.request('PUT', '/wp-json/veilwright/v1/elementor/kit/layout', body));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('elementorSettings_get', "Read Elementor's own Google Fonts settings: googleFontsEnabled (Elementor's built-in Google Fonts integration) and loadGoogleFontsLocally (self-hosts any Google Font that IS still referenced, instead of loading it live from Google's servers).", { ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('GET', '/wp-json/veilwright/v1/elementor/settings'));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('elementorSettings_update', 'Update Elementor\'s own Google Fonts settings. This project\'s mandatory GDPR/DSGVO baseline (see rule 5a) is `googleFontsEnabled: false` + `loadGoogleFontsLocally: true` — set both as part of the Kit baseline check, before building any page, unless the user explicitly says otherwise.', {
        googleFontsEnabled: z.boolean().optional(),
        loadGoogleFontsLocally: z.boolean().optional(),
        ...SITE_ID_PARAM,
    }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            const { siteId, ...body } = args;
            return jsonContent(await client.request('PUT', '/wp-json/veilwright/v1/elementor/settings', body));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('form_createFluentForm', 'Build a brand-new Fluent Forms form (fields, submit button, settings, notifications) — for embedding a form that already exists instead, use the fluent-form-widget via ' +
        "page_addElementorWidget with { form_list: \"<id>\" }. Check this skill's FLUENT_FORMS.md for the field-tree shape, known element types, and how confident that reference " +
        'is (payment fields, multi-step, conditional logic are not verified). Returns { id, title, status, fieldCount } — embed the returned id with fluent-form-widget afterwards.', {
        title: z.string().min(1),
        fields: z
            .array(fluentFormFieldSchema)
            .min(1)
            .describe('Top-level field nodes — wrap each row in a "container" element with columns[].fields[], see FLUENT_FORMS.md.'),
        submitButton: fluentFormFieldSchema.optional().describe('Defaults to a plain "Submit" button if omitted.'),
        status: z.enum(['published', 'draft']).optional(),
        formSettings: z.record(z.string(), z.unknown()).optional().describe('Merged over sane confirmation-message defaults.'),
        notifications: z
            .array(z.record(z.string(), z.unknown()))
            .optional()
            .describe('One object per email notification. Defaults to a single "email the site admin" notification if omitted.'),
        ...SITE_ID_PARAM,
    }, async (args) => {
        try {
            const { siteId, ...body } = args;
            const client = await clients.forSite(tenantId, resolveSiteId(siteId, session));
            return jsonContent(await client.request('POST', '/wp-json/veilwright/v1/fluentforms', body));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('form_getFluentForm', 'Read back a Fluent Form created via form_createFluentForm (id, title, status, field tree).', { id: z.number().int().positive(), ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('GET', `/wp-json/veilwright/v1/fluentforms/${args.id}`));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    const CODE_SNIPPET_SCOPES = [
        'global', 'admin', 'front-end', 'single-use',
        'content', 'head-content', 'footer-content',
        'admin-css', 'site-css',
        'site-head-js', 'site-footer-js',
        'condition',
    ];
    server.tool('codeSnippet_list', 'List all Code Snippets (codesnippets.pro) snippets on a site — custom PHP/CSS/JS/HTML snippets, not Elementor widgets or Theme Builder templates. Requires the Code Snippets plugin active on the site.', { ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('GET', '/wp-json/veilwright/v1/code-snippets'));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('codeSnippet_get', 'Get a single Code Snippets snippet by ID.', { id: z.number().int().positive(), ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('GET', `/wp-json/veilwright/v1/code-snippets/${args.id}`));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('codeSnippet_create', 'Create a new Code Snippets snippet. It is created inactive unless `active: true` is passed — for PHP snippets, the plugin itself will force it back to inactive if the code has a syntax error ' +
        '(check the returned `codeError` field). `condition_id` (Pro\'s snippet-conditions feature) is not supported — there is no visibility into that data model from here.', {
        name: z.string().min(1),
        code: z.string().min(1).describe('The executable snippet code, without surrounding <?php tags for PHP scopes.'),
        desc: z.string().optional(),
        scope: z.enum(CODE_SNIPPET_SCOPES).optional().describe('Defaults to "global" (runs everywhere, PHP). CSS/JS/content scopes only actually execute with Code Snippets Pro active.'),
        tags: z.array(z.string()).optional(),
        priority: z.number().int().optional(),
        active: z.boolean().optional(),
        ...SITE_ID_PARAM,
    }, async (args) => {
        try {
            const { siteId, ...body } = args;
            const client = await clients.forSite(tenantId, resolveSiteId(siteId, session));
            return jsonContent(await client.request('POST', '/wp-json/veilwright/v1/code-snippets', body));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('codeSnippet_update', 'Update an existing Code Snippets snippet. Only send the fields that should change.', {
        id: z.number().int().positive(),
        name: z.string().optional(),
        code: z.string().optional(),
        desc: z.string().optional(),
        scope: z.enum(CODE_SNIPPET_SCOPES).optional(),
        tags: z.array(z.string()).optional(),
        priority: z.number().int().optional(),
        active: z.boolean().optional(),
        ...SITE_ID_PARAM,
    }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            const { id, siteId: _siteId, ...attributes } = args;
            return jsonContent(await client.request('PUT', `/wp-json/veilwright/v1/code-snippets/${id}`, attributes));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('codeSnippet_delete', 'Delete (trash) a Code Snippets snippet.', { id: z.number().int().positive(), ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('DELETE', `/wp-json/veilwright/v1/code-snippets/${args.id}`));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('codeSnippet_activate', 'Activate a Code Snippets snippet.', { id: z.number().int().positive(), ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('POST', `/wp-json/veilwright/v1/code-snippets/${args.id}/activate`));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('codeSnippet_deactivate', 'Deactivate a Code Snippets snippet.', { id: z.number().int().positive(), ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('POST', `/wp-json/veilwright/v1/code-snippets/${args.id}/deactivate`));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    const seoAttributesShape = {
        title: z.string().optional(),
        metaDescription: z.string().optional(),
        focusKeyword: z.string().optional(),
        canonical: z.string().optional(),
        noindex: z.boolean().optional(),
        nofollow: z.boolean().optional(),
        ogTitle: z.string().optional(),
        ogDescription: z.string().optional(),
        ogImage: z.string().optional(),
        twitterTitle: z.string().optional(),
        twitterDescription: z.string().optional(),
        twitterImage: z.string().optional(),
    };
    function registerSeoTools(plugin, label) {
        server.tool(`${plugin}_get`, `Read a post/page's SEO metadata as managed by ${label}.`, { postId: z.number().int().positive(), ...SITE_ID_PARAM }, async (args) => {
            try {
                const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
                return jsonContent(await client.request('GET', `/wp-json/veilwright/v1/${plugin}/${args.postId}`));
            }
            catch (error) {
                return errorContent(error);
            }
        });
        server.tool(`${plugin}_update`, `Update a post/page's SEO metadata as managed by ${label}. Only send the fields that should change.`, { postId: z.number().int().positive(), ...seoAttributesShape, ...SITE_ID_PARAM }, async (args) => {
            try {
                const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
                const { postId, siteId: _siteId, ...attributes } = args;
                return jsonContent(await client.request('PUT', `/wp-json/veilwright/v1/${plugin}/${postId}`, attributes));
            }
            catch (error) {
                return errorContent(error);
            }
        });
    }
    registerSeoTools('yoast', 'Yoast SEO');
    registerSeoTools('rankmath', 'Rank Math');
    registerSeoTools('aioseo', 'All in One SEO');
    registerSeoTools('seopress', 'SeoPress');
    server.tool('woocommerceProduct_list', 'List all WooCommerce products on a site. Simple products only.', { ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('GET', '/wp-json/veilwright/v1/woocommerce/products'));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('woocommerceProduct_get', 'Get a single WooCommerce product by ID.', { id: z.number().int().positive(), ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('GET', `/wp-json/veilwright/v1/woocommerce/products/${args.id}`));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('woocommerceProduct_create', 'Create a new WooCommerce simple product. Variable products (with variations) are not supported.', {
        name: z.string().min(1),
        description: z.string().optional(),
        shortDescription: z.string().optional(),
        sku: z.string().optional(),
        status: z.enum(['publish', 'draft', 'pending', 'private']).optional(),
        regularPrice: z.union([z.string(), z.number()]).optional(),
        salePrice: z.union([z.string(), z.number()]).optional(),
        manageStock: z.boolean().optional(),
        stockQuantity: z.number().optional(),
        stockStatus: z.enum(['instock', 'outofstock', 'onbackorder']).optional(),
        weight: z.union([z.string(), z.number()]).optional(),
        virtual: z.boolean().optional(),
        downloadable: z.boolean().optional(),
        ...SITE_ID_PARAM,
    }, async (args) => {
        try {
            const { siteId, ...body } = args;
            const client = await clients.forSite(tenantId, resolveSiteId(siteId, session));
            return jsonContent(await client.request('POST', '/wp-json/veilwright/v1/woocommerce/products', body));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('woocommerceProduct_update', 'Update an existing WooCommerce product. Only send the fields that should change.', {
        id: z.number().int().positive(),
        name: z.string().optional(),
        description: z.string().optional(),
        shortDescription: z.string().optional(),
        sku: z.string().optional(),
        status: z.enum(['publish', 'draft', 'pending', 'private']).optional(),
        regularPrice: z.union([z.string(), z.number()]).optional(),
        salePrice: z.union([z.string(), z.number()]).optional(),
        manageStock: z.boolean().optional(),
        stockQuantity: z.number().optional(),
        stockStatus: z.enum(['instock', 'outofstock', 'onbackorder']).optional(),
        weight: z.union([z.string(), z.number()]).optional(),
        virtual: z.boolean().optional(),
        downloadable: z.boolean().optional(),
        ...SITE_ID_PARAM,
    }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            const { id, siteId: _siteId, ...attributes } = args;
            return jsonContent(await client.request('PUT', `/wp-json/veilwright/v1/woocommerce/products/${id}`, attributes));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('woocommerceProduct_delete', 'Delete a WooCommerce product (moves to trash unless forceDelete is set).', { id: z.number().int().positive(), forceDelete: z.boolean().optional(), ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            const url = `/wp-json/veilwright/v1/woocommerce/products/${args.id}${args.forceDelete ? '?force=1' : ''}`;
            return jsonContent(await client.request('DELETE', url));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    function registerFieldTools(plugin, toolPrefix, label, supportsGetAll) {
        if (supportsGetAll) {
            server.tool(`${toolPrefix}_getAll`, `Get all ${label} field values on a page/post.`, { postId: z.number().int().positive(), ...SITE_ID_PARAM }, async (args) => {
                try {
                    const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
                    return jsonContent(await client.request('GET', `/wp-json/veilwright/v1/${plugin}/${args.postId}`));
                }
                catch (error) {
                    return errorContent(error);
                }
            });
        }
        server.tool(`${toolPrefix}_get`, `Get a single ${label} field's value on a page/post.`, { postId: z.number().int().positive(), selector: z.string().min(1).describe('The field name/key.'), ...SITE_ID_PARAM }, async (args) => {
            try {
                const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
                return jsonContent(await client.request('GET', `/wp-json/veilwright/v1/${plugin}/${args.postId}/${encodeURIComponent(args.selector)}`));
            }
            catch (error) {
                return errorContent(error);
            }
        });
        server.tool(`${toolPrefix}_update`, `Set a single ${label} field's value on a page/post.`, { postId: z.number().int().positive(), selector: z.string().min(1).describe('The field name/key.'), value: z.unknown(), ...SITE_ID_PARAM }, async (args) => {
            try {
                const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
                return jsonContent(await client.request('PUT', `/wp-json/veilwright/v1/${plugin}/${args.postId}/${encodeURIComponent(args.selector)}`, { value: args.value }));
            }
            catch (error) {
                return errorContent(error);
            }
        });
        server.tool(`${toolPrefix}_updateAll`, `Set multiple ${label} field values at once on a page/post.`, { postId: z.number().int().positive(), fields: z.record(z.string(), z.unknown()).describe('Field name/key -> value.'), ...SITE_ID_PARAM }, async (args) => {
            try {
                const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
                return jsonContent(await client.request('PUT', `/wp-json/veilwright/v1/${plugin}/${args.postId}`, { fields: args.fields }));
            }
            catch (error) {
                return errorContent(error);
            }
        });
    }
    registerFieldTools('acf', 'acf', 'ACF', true);
    registerFieldTools('pods', 'pods', 'Pods', false);
    registerFieldTools('meta-box', 'metaBox', 'Meta Box', false);
    server.tool('cf7_list', 'List all Contact Form 7 forms on a site.', { ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('GET', '/wp-json/veilwright/v1/cf7/forms'));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('cf7_get', 'Get a single Contact Form 7 form by ID, including its form/mail/mail2/messages properties.', { id: z.number().int().positive(), ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('GET', `/wp-json/veilwright/v1/cf7/forms/${args.id}`));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('cf7_create', "Create a new Contact Form 7 form. `form` is CF7's own shortcode-tag markup (e.g. \"[text* your-name]\"), not HTML. `mail`/`mail2`/`messages` use CF7's own field names (subject/sender/body/recipient/additional_headers/attachments/use_html for mail; message keys like mail_sent_ok for messages).", {
        title: z.string().min(1),
        locale: z.string().optional(),
        form: z.string().optional().describe("CF7 shortcode-tag markup, e.g. '[text* your-name][submit \"Submit\"]'."),
        mail: z.record(z.string(), z.unknown()).optional(),
        mail2: z.record(z.string(), z.unknown()).optional(),
        messages: z.record(z.string(), z.string()).optional(),
        additionalSettings: z.string().optional(),
        ...SITE_ID_PARAM,
    }, async (args) => {
        try {
            const { siteId, ...body } = args;
            const client = await clients.forSite(tenantId, resolveSiteId(siteId, session));
            return jsonContent(await client.request('POST', '/wp-json/veilwright/v1/cf7/forms', body));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('cf7_update', 'Update an existing Contact Form 7 form. Only send the fields that should change. See cf7_create for the form/mail/mail2/messages shape.', {
        id: z.number().int().positive(),
        title: z.string().optional(),
        locale: z.string().optional(),
        form: z.string().optional(),
        mail: z.record(z.string(), z.unknown()).optional(),
        mail2: z.record(z.string(), z.unknown()).optional(),
        messages: z.record(z.string(), z.string()).optional(),
        additionalSettings: z.string().optional(),
        ...SITE_ID_PARAM,
    }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            const { id, siteId: _siteId, ...attributes } = args;
            return jsonContent(await client.request('PUT', `/wp-json/veilwright/v1/cf7/forms/${id}`, attributes));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('cf7_delete', 'Delete a Contact Form 7 form permanently.', { id: z.number().int().positive(), ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('DELETE', `/wp-json/veilwright/v1/cf7/forms/${args.id}`));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('wpforms_list', 'List all WPForms forms on a site.', { ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('GET', '/wp-json/veilwright/v1/wpforms/forms'));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('wpforms_get', 'Get a single WPForms form by ID, including its fields/settings.', { id: z.number().int().positive(), ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('GET', `/wp-json/veilwright/v1/wpforms/forms/${args.id}`));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('wpforms_create', "Create a new WPForms form. `fields`/`settings` use WPForms's own JSON shape (as seen in an exported form) — pass them through as-is rather than inventing a new shape. Creating without `fields` produces an empty form.", {
        title: z.string().min(1),
        description: z.string().optional(),
        fields: z.array(z.record(z.string(), z.unknown())).optional(),
        settings: z.record(z.string(), z.unknown()).optional(),
        status: z.enum(['publish', 'draft', 'pending', 'private']).optional(),
        ...SITE_ID_PARAM,
    }, async (args) => {
        try {
            const { siteId, ...body } = args;
            const client = await clients.forSite(tenantId, resolveSiteId(siteId, session));
            return jsonContent(await client.request('POST', '/wp-json/veilwright/v1/wpforms/forms', body));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('wpforms_update', 'Update an existing WPForms form. Only send the fields that should change. Note: the WP user mapped to the API key needs WPForms\'s own capabilities for this to succeed.', {
        id: z.number().int().positive(),
        title: z.string().optional(),
        description: z.string().optional(),
        fields: z.array(z.record(z.string(), z.unknown())).optional(),
        settings: z.record(z.string(), z.unknown()).optional(),
        status: z.enum(['publish', 'draft', 'pending', 'private']).optional(),
        ...SITE_ID_PARAM,
    }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            const { id, siteId: _siteId, ...attributes } = args;
            return jsonContent(await client.request('PUT', `/wp-json/veilwright/v1/wpforms/forms/${id}`, attributes));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('wpforms_delete', 'Delete a WPForms form permanently.', { id: z.number().int().positive(), ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('DELETE', `/wp-json/veilwright/v1/wpforms/forms/${args.id}`));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('ninjaForms_list', 'List all Ninja Forms forms on a site.', { ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('GET', '/wp-json/veilwright/v1/ninja-forms/forms'));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('ninjaForms_get', 'Get a single Ninja Forms form by ID, including its fields/actions/settings.', { id: z.number().int().positive(), ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('GET', `/wp-json/veilwright/v1/ninja-forms/forms/${args.id}`));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('ninjaForms_create', "Create a new Ninja Forms form. `fields`/`actions` use Ninja Forms's own settings-object shape (as seen in an exported form) — pass them through as-is. A default 'Save Form' action is added if `actions` is omitted.", {
        title: z.string().min(1),
        fields: z.array(z.record(z.string(), z.unknown())).optional(),
        actions: z.array(z.record(z.string(), z.unknown())).optional(),
        settings: z.record(z.string(), z.unknown()).optional(),
        ...SITE_ID_PARAM,
    }, async (args) => {
        try {
            const { siteId, ...body } = args;
            const client = await clients.forSite(tenantId, resolveSiteId(siteId, session));
            return jsonContent(await client.request('POST', '/wp-json/veilwright/v1/ninja-forms/forms', body));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('ninjaForms_update', "Update an existing Ninja Forms form's title/settings. Only send the fields that should change. Note: fields/actions can't be changed after creation with this tool — recreate the form if they need to change.", {
        id: z.number().int().positive(),
        title: z.string().optional(),
        settings: z.record(z.string(), z.unknown()).optional(),
        ...SITE_ID_PARAM,
    }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            const { id, siteId: _siteId, ...attributes } = args;
            return jsonContent(await client.request('PUT', `/wp-json/veilwright/v1/ninja-forms/forms/${id}`, attributes));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('ninjaForms_delete', 'Delete a Ninja Forms form permanently (also removes its entries).', { id: z.number().int().positive(), ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('DELETE', `/wp-json/veilwright/v1/ninja-forms/forms/${args.id}`));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('formidable_list', 'List all Formidable Forms forms on a site.', { ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('GET', '/wp-json/veilwright/v1/formidable/forms'));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('formidable_get', 'Get a single Formidable Forms form by ID, including its fields.', { id: z.number().int().positive(), ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('GET', `/wp-json/veilwright/v1/formidable/forms/${args.id}`));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('formidable_create', "Create a new Formidable Forms form. `fields` use Formidable's own settings-object shape (each with `type`/`name`/`fieldOptions`/optional `choices`) — pass them through as-is. `options` is the form-level options object (before/after/submit HTML, etc.).", {
        name: z.string().min(1),
        description: z.string().optional(),
        status: z.enum(['published', 'draft', 'trash']).optional(),
        options: z.record(z.string(), z.unknown()).optional(),
        fields: z.array(z.record(z.string(), z.unknown())).optional(),
        ...SITE_ID_PARAM,
    }, async (args) => {
        try {
            const { siteId, ...body } = args;
            const client = await clients.forSite(tenantId, resolveSiteId(siteId, session));
            return jsonContent(await client.request('POST', '/wp-json/veilwright/v1/formidable/forms', body));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('formidable_update', 'Update an existing Formidable Forms form. Only send the fields that should change.', {
        id: z.number().int().positive(),
        name: z.string().optional(),
        description: z.string().optional(),
        status: z.enum(['published', 'draft', 'trash']).optional(),
        options: z.record(z.string(), z.unknown()).optional(),
        ...SITE_ID_PARAM,
    }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            const { id, siteId: _siteId, ...attributes } = args;
            return jsonContent(await client.request('PUT', `/wp-json/veilwright/v1/formidable/forms/${id}`, attributes));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('formidable_delete', 'Delete a Formidable Forms form. Moves to trash (recoverable) unless `permanent` is set, which also removes its fields/entries/actions.', { id: z.number().int().positive(), permanent: z.boolean().optional(), ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            const url = `/wp-json/veilwright/v1/formidable/forms/${args.id}${args.permanent ? '?force=1' : ''}`;
            return jsonContent(await client.request('DELETE', url));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('menu_list', 'List all navigation menus on a site.', { ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('GET', '/wp-json/veilwright/v1/menus'));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('menu_get', 'Get a single navigation menu by ID (name/slug/item count — use menuItem_list for its items).', { id: z.number().int().positive(), ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('GET', `/wp-json/veilwright/v1/menus/${args.id}`));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('menu_create', 'Create a new (empty) navigation menu. Add items to it afterwards with menuItem_create, then assign it to a theme location manually in WP-admin → Appearance → Menus (no API for theme-location assignment).', { name: z.string().min(1), ...SITE_ID_PARAM }, async (args) => {
        try {
            const { siteId, ...body } = args;
            const client = await clients.forSite(tenantId, resolveSiteId(siteId, session));
            return jsonContent(await client.request('POST', '/wp-json/veilwright/v1/menus', body));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('menu_update', 'Rename an existing navigation menu.', { id: z.number().int().positive(), name: z.string().min(1), ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            const { id, siteId: _siteId, ...attributes } = args;
            return jsonContent(await client.request('PUT', `/wp-json/veilwright/v1/menus/${id}`, attributes));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('menu_delete', 'Delete a navigation menu permanently (also removes its items).', { id: z.number().int().positive(), ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('DELETE', `/wp-json/veilwright/v1/menus/${args.id}`));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('menuItem_list', 'List all items in a navigation menu, in display order.', { menuId: z.number().int().positive(), ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('GET', `/wp-json/veilwright/v1/menus/${args.menuId}/items`));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('menuItem_create', 'Add an item to a navigation menu. For a custom link, set `url` (and leave `type`/`objectType`/`objectId` unset). To link an existing page/post/category instead, set `objectType` (e.g. "page", "post", "category") and `objectId` to its ID — `url` is then derived by WordPress itself. `parentId` nests this item as a submenu entry under another item\'s ID; `position` controls display order (WordPress\'s own `menu_order`, ties broken by creation order). ' +
        'Always set `titleAttribute` too — the HTML `title=""` tooltip attribute WordPress\'s own menu editor calls "Title Attribute" (distinct from `title`, the visible link label). Write it SEO-optimized (a short, natural description of the destination, not just a repeat of the label) and in the menu\'s actual language, not assumed from the label text alone.', {
        menuId: z.number().int().positive(),
        title: z.string().min(1),
        titleAttribute: z.string().min(1).describe('The HTML title="" tooltip attribute — SEO-optimized, in the menu\'s actual language. Always provide this.'),
        url: z.string().optional(),
        type: z.string().optional().describe('WordPress\'s own menu-item type, e.g. "custom", "post_type", "taxonomy".'),
        objectType: z.string().optional().describe('e.g. "page", "post", "category" — set with objectId to link an existing item.'),
        objectId: z.number().int().optional(),
        parentId: z.number().int().optional(),
        position: z.number().int().optional(),
        ...SITE_ID_PARAM,
    }, async (args) => {
        try {
            const { menuId, siteId, ...body } = args;
            const client = await clients.forSite(tenantId, resolveSiteId(siteId, session));
            return jsonContent(await client.request('POST', `/wp-json/veilwright/v1/menus/${menuId}/items`, body));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('menuItem_update', 'Update an existing menu item. Only send the fields that should change. See menuItem_create for the field shapes. If this item has no `titleAttribute` yet (check menu_get/menuItem_list first), set one now — SEO-optimized, in the menu\'s actual language — rather than leaving it missing.', {
        menuId: z.number().int().positive(),
        itemId: z.number().int().positive(),
        title: z.string().optional(),
        titleAttribute: z.string().optional().describe('The HTML title="" tooltip attribute — SEO-optimized, in the menu\'s actual language.'),
        url: z.string().optional(),
        type: z.string().optional(),
        objectType: z.string().optional(),
        objectId: z.number().int().optional(),
        parentId: z.number().int().optional(),
        position: z.number().int().optional(),
        ...SITE_ID_PARAM,
    }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            const { menuId, itemId, siteId: _siteId, ...attributes } = args;
            return jsonContent(await client.request('PUT', `/wp-json/veilwright/v1/menus/${menuId}/items/${itemId}`, attributes));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('menuItem_delete', 'Remove an item from a navigation menu permanently.', { menuId: z.number().int().positive(), itemId: z.number().int().positive(), ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('DELETE', `/wp-json/veilwright/v1/menus/${args.menuId}/items/${args.itemId}`));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('page_backup', 'Create a manual point-in-time snapshot of a page (content + Elementor data) on a site.', { id: z.number().int().positive(), reason: z.string().optional(), ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            const body = args.reason ? { reason: args.reason } : {};
            return jsonContent(await client.request('POST', `/wp-json/veilwright/v1/pages/${args.id}/backups`, body));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('page_listBackups', 'List available backup snapshots for a page on a site, newest first.', { id: z.number().int().positive(), ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('GET', `/wp-json/veilwright/v1/pages/${args.id}/backups`));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('page_restore', 'Restore a page on a site from a previously created backup snapshot.', { backupId: z.string().min(1), ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('POST', `/wp-json/veilwright/v1/backups/${args.backupId}/restore`));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('audit_run', 'Run accessibility and SEO checks against a page on a site.', { id: z.number().int().positive(), ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('GET', `/wp-json/veilwright/v1/audits/${args.id}`));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('media_upload', 'Upload a local file to a site\'s media library.', {
        filePath: z.string().min(1),
        title: z.string().optional(),
        alt: z.string().optional(),
        description: z.string().optional(),
        caption: z.string().optional(),
        copyright: z.string().optional(),
        ...SITE_ID_PARAM,
    }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            const data = await readFile(args.filePath);
            const filename = basename(args.filePath);
            const fields = {};
            if (args.title)
                fields.title = args.title;
            if (args.alt)
                fields.alt = args.alt;
            if (args.description)
                fields.description = args.description;
            if (args.caption)
                fields.caption = args.caption;
            if (args.copyright)
                fields.copyright = args.copyright;
            const media = await client.uploadFile('/wp-json/veilwright/v1/media', fields, {
                fieldName: 'file',
                filename,
                contentType: detectMimeType(filename),
                data,
            });
            return jsonContent(media);
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('customFont_upload', 'Upload a local font file (.ttf/.otf/.woff/.woff2/.eot) and register it so it actually renders wherever elementorKit_addFont/updateFont references its family name in typography_font_family. ' +
        "This does NOT use Elementor Pro's own Custom Fonts screen (closed-source, no API) — it registers the font independently via a real @font-face rule this plugin prints itself, which works " +
        "identically from the browser's perspective. It won't appear in Elementor's own Custom Fonts list/picker in WP-admin, only in the rendered result. Upload one file per weight/style combination " +
        '(e.g. call twice for a regular + bold variant of the same family, both with the same `family` name).', {
        filePath: z.string().min(1),
        family: z.string().min(1),
        weight: z.enum(['100', '200', '300', '400', '500', '600', '700', '800', '900']).optional(),
        style: z.enum(['normal', 'italic']).optional(),
        ...SITE_ID_PARAM,
    }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            const data = await readFile(args.filePath);
            const filename = basename(args.filePath);
            const fields = { family: args.family };
            if (args.weight)
                fields.weight = args.weight;
            if (args.style)
                fields.style = args.style;
            const font = await client.uploadFile('/wp-json/veilwright/v1/custom-fonts', fields, {
                fieldName: 'file',
                filename,
                contentType: detectMimeType(filename),
                data,
            });
            return jsonContent(font);
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('customFont_list', 'List all custom fonts uploaded via customFont_upload on a site.', { ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('GET', '/wp-json/veilwright/v1/custom-fonts'));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('customFont_delete', 'Delete a custom font (and its uploaded file) by its id (from customFont_upload/customFont_list).', { id: z.number().int().positive(), ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('DELETE', `/wp-json/veilwright/v1/custom-fonts/${args.id}`));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('job_status', 'Check the status of an async job (e.g. HTML-to-Elementor conversion) on a site.', { jobId: z.string().min(1), ...SITE_ID_PARAM }, async (args) => {
        try {
            const client = await clients.forSite(tenantId, resolveSiteId(args.siteId, session));
            return jsonContent(await client.request('GET', `/wp-json/veilwright/v1/jobs/${args.jobId}`));
        }
        catch (error) {
            return errorContent(error);
        }
    });
}
//# sourceMappingURL=index.js.map