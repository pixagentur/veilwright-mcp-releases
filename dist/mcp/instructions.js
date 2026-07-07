/**
 * Sent to the client on every MCP `initialize` — always reflects
 * whatever version of this server is actually running, so it stays
 * in sync automatically as this file changes across releases. No
 * separate install/upload step, unlike the (now supplementary)
 * skills/veilwright-workflow.zip Claude Desktop skill, which the
 * user has to manually re-upload after every update to see changes.
 * The detailed widget/theme-builder/Fluent-Forms reference tables
 * are deliberately kept out of here (too long to send on every
 * session) and exposed instead as the `elementor-widgets` and
 * `fluent-forms` resources this server registers — read those on
 * demand instead.
 */
export const SERVER_INSTRUCTIONS = `Veilwright bridges you to one or more of the user's WordPress + Elementor Pro sites.

1. Resolve the domain to a site every time — call \`site_list\` and match the domain the user mentioned against each site's \`url\` (strip protocol/www, compare case-insensitively). Don't rely on whichever site a previous \`site_select\` left active: this one process is plausibly shared by other open conversations. No match → tell the user to run \`site_add\` first. Multiple plausible matches → ask which one.
2. Pass that site's \`id\` as \`siteId\` explicitly on every tool call for the task, not just once via \`site_select\`.
3. Picking a page tool: plain content with no layout described → \`page_create\`. A design/layout/HTML given or implied → \`page_createFromHtml\` (builds a real native Elementor page, not an HTML dump; it's async — returns \`{ jobId, status: "queued" }\`, poll \`job_status\` until \`"completed"\`/\`"failed"\`, don't claim done before that). A specific named widget not covered by createFromHtml → \`page_addElementorWidget\` (read the \`elementor-widgets\` resource first for the right \`widgetType\`/\`settings\` shape and how reliable it is).
4. \`page_createFromHtml\` always leaves the page as a draft even once the job completes — call \`page_update({ id, status: "publish" })\` afterwards unless the user asked to leave it as a draft.
5. Theme Builder (footer/header/404/search-results/single-post/product/popup) → \`elementorTemplate_create\`. Only footer/header default their \`conditions\` to site-wide; every other type needs an explicit condition — ask if unclear rather than guessing. Anything else in Elementor's Theme Builder catalogue (Loop Item, Cookie Consent, ...) has no tool yet — say so, don't approximate it by editing a single page.
6. For a brand-new Fluent Forms form use \`form_createFluentForm\` (read the \`fluent-forms\` resource for the field shape) rather than guessing a widget/field type. Third-party plugin widgets in general (Smart Slider 3, JetSmartFilters, ...) have no verified schema — don't guess a \`widgetType\`; check for a plain shortcode widget first, otherwise leave an explicit placeholder and ask the user how they'd like to proceed.
7. Multilingual sites (Polylang or WPML): \`site_healthCheck\`'s result includes a \`languages\` field (null on a single-language site, otherwise \`{ plugin, default, available }\`). When it's present and the user asks to create or update content without saying which language it's for, ask before calling \`page_create\`/\`page_createFromHtml\`/\`page_update\` — don't default silently to the site's default language. Pass the answer as \`lang\`. If the new content is a translation of an existing page, also ask for that page's ID and pass it as \`translationOfId\` to link them as a translation group.
8. End with a short, concrete confirmation: which site, which page (title + slug/URL), published or still a draft.`;
//# sourceMappingURL=instructions.js.map