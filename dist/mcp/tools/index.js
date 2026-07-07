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
    server.tool('elementorTemplate_create', 'Create a conditional Elementor Theme Builder template (footer, header, 404, search-results, single-post, product, or popup) — for a request naming one of these, use this ' +
        "instead of page_create/page_addElementorWidget, which would only edit a single page's content, not a real site-wide/conditional template. Build `elements` the same way as " +
        'page_addElementorWidget\'s `element` (see ELEMENTOR_WIDGETS.md — for single-post/product templates, use context-only widgets like theme-post-content/woocommerce-*). ' +
        '`conditions` only defaults to entire-site ("include/general") for footer/header; every other type REQUIRES an explicit condition string (see FLUENT_FORMS.md\'s sibling doc ' +
        "elementor-templates.md for suggested strings per type, e.g. [\"include/404\"], [\"include/singular/post-type/product\"]) — ask the user if it's unclear rather than guessing. " +
        'None of the condition strings are verified against a live install, check in the Elementor editor afterwards. For a popup, `pageSettings` covers width/close-button/background ' +
        "only — its trigger (on page load, on scroll, ...) has no ground truth yet and needs setting manually in the editor's Popup Settings → Triggers tab; always tell the user this " +
        'after creating one, an untriggered popup never shows.', {
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
    server.tool('elementorTemplate_get', 'Read back a Theme Builder template created via elementorTemplate_create (id, title, type, conditions, pageSettings, elements).', { id: z.number().int().positive(), ...SITE_ID_PARAM }, async (args) => {
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
    server.tool('elementorKit_updateColor', 'Update a Global Color by its _id (from elementorKit_listColors) — works for both system slots (primary/secondary/text/accent, color only, title is ignored) and custom colors.', { id: z.string().min(1), color: z.string().optional(), title: z.string().optional(), ...SITE_ID_PARAM }, async (args) => {
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
        'typography_font_weight, typography_font_size, typography_line_height, ...) — the same convention seen throughout ELEMENTOR_WIDGETS.md for widget typography.', { title: z.string().min(1), typography: z.record(z.string(), z.unknown()), ...SITE_ID_PARAM }, async (args) => {
        try {
            const { siteId, ...body } = args;
            const client = await clients.forSite(tenantId, resolveSiteId(siteId, session));
            return jsonContent(await client.request('POST', '/wp-json/veilwright/v1/elementor/kit/fonts', body));
        }
        catch (error) {
            return errorContent(error);
        }
    });
    server.tool('elementorKit_updateFont', 'Update a Global Font by its _id (from elementorKit_listFonts) — works for both system slots (typography only, title is ignored) and custom fonts.', {
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