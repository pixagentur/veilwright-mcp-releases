---
name: veilwright-workflow
description: Use whenever the user asks to create, edit, or publish content on a WordPress site through Veilwright AI — especially when they name a domain (e.g. "on lustigebeispiel.de, create an Impressum page" or "add a page to waldbären.de"). Resolves the domain to the correct registered site and picks the right tool so work reliably lands on the right site with the right result.
---

# Veilwright site work

## 1. Resolve the domain to a site — every time, don't assume

Before calling any `page.*`/`media.*`/`job.*`/`audit.*` tool, call `site_list` and match the domain the user mentioned (strip `https://`, `http://`, `www.`; compare case-insensitively) against each returned site's `url`.

- No match: tell the user this site isn't registered yet and that they need to run `site_add` first (WP-admin → Veilwright AI → create an API key, then "add my site: <url>, key ID ..., secret ...").
- More than one plausible match: ask which one before doing anything.
- Never fall back to whichever site a previous `site_select` left active in this process. Claude Desktop connects to Veilwright's MCP server once at app startup and that one process is plausibly shared by every open conversation — a different, unrelated chat may have already changed the "selected" site. Always resolve the domain explicitly.

## 2. Pass `siteId` explicitly on every call for this request

Once resolved, pass that site's `id` as the `siteId` argument on every tool call for this task (`page_create`, `page_createFromHtml`, `page_update`, `media_upload`, `job_status`, ...). Don't rely on `site_select` alone — it's a convenience for a single ad-hoc call, not something to lean on across a multi-step task.

## 3. Pick the right page tool

- **Plain content, no design/layout described** ("create an Impressum page with this text") → `page_create` (title + content).
- **A design, layout, or HTML is given or implied** ("build this page to look like...", HTML pasted in, a screenshot/description of a layout) → `page_createFromHtml`. This builds a *native* Elementor page (real widgets), not a content dump.
  - It's async: it returns `{ jobId, status: "queued", postId }` immediately. Poll `job_status(jobId)` — wait a couple seconds between checks — until the status is `"completed"` or `"failed"`. Don't tell the user the page is done before that.
  - On `"failed"`, report the actual error to the user; don't silently retry or fall back to `page_create` without saying so.
- **A specific widget is named** ("add an accordion FAQ", "add a countdown", "add a testimonial") that `page_createFromHtml` wouldn't produce on its own → `page_addElementorWidget`, after the target page exists (create it first with either tool above if it doesn't yet). See `ELEMENTOR_WIDGETS.md` in this skill for `widgetType`/`settings` values and how confident each one is — it's not all equally reliable, and some (Loop Grid, Portfolio, Off-Canvas) have real limitations spelled out there. Say so to the user instead of presenting a best-effort result as finished.

## 3a. Kit baseline setup — check once per site before the first page/template

Before the *first* `page_create`/`page_createFromHtml`/`page_addElementorWidget`/`elementorTemplate_create` call on a given site in this conversation, call `elementorKit_getLayout` once. If it comes back with no `container_width` set, this site's Kit has never been customized — apply the baseline below before building anything. If `container_width` is already set (from an earlier task, possibly in a different conversation — this is real, persisted site state, not session state), skip straight to building content; the baseline only ever needs doing once per site.

1. **Layout — always, regardless of whether a design was given:** `elementorKit_updateLayout` with `containerWidth: 1300` and all six breakpoints active (`activeBreakpoints: ["viewport_mobile","viewport_mobile_extra","viewport_tablet","viewport_tablet_extra","viewport_laptop","viewport_widescreen"]`, keeping Elementor's own default px values for each unless told otherwise). This is a basic setup step, not something tied to a specific design — do it even for a single-page request.
1a. **GDPR/DSGVO — always, mandatory, not a design choice:** `elementorSettings_update({ googleFontsEnabled: false, loadGoogleFontsLocally: true })`. This disables Elementor's own live-from-Google Fonts integration and, as a safety net, makes it self-host any Google Font that's still referenced somehow instead of loading it from Google's servers — do this even on a plain content request with no design at all, unless the user explicitly says not to. (This is a real Elementor setting, confirmed in its own source — not this project's own invention.)
2. **Colors/Fonts — only if the request includes or implies a brand/design spec** (a color palette, typography, a mockup, a screenshot): set up the Kit's Global Colors/Fonts before building any page — never hardcode the design's colors/fonts directly into page content when a reusable global palette makes more sense, and never as a "Snippet"/custom CSS — write via `elementorKit_*`, which edits the real active Kit's settings natively. If no brand/design spec exists yet, skip this step silently and build with Elementor's defaults — don't interrupt a plain content request to ask for a palette that was never part of it.
   - `elementorKit_listColors`/`elementorKit_listFonts` first, to see what's already there (a fresh site already has 4 system color slots — primary/secondary/text/accent — and matching system font slots).
   - Rename the system slots to match the design's own naming via `elementorKit_updateColor`/`elementorKit_updateFont` with a new `title` (e.g. "Primär" → "Überschrift H1", "Akzentfarbe" → "Hervorgehoben") — renaming a system slot's title is supported, only its `_id` is fixed.
   - Set each system slot's `color`/`typography` to the design's values.
   - For every other palette color/typeface the design defines, add it as a custom entry via `elementorKit_addColor`/`elementorKit_addFont` (there's no fixed limit). Always include a plain white and black among the custom colors if the design doesn't already define its own equivalents.
   - Set a `typography_font_family_fallback`-style value (Elementor calls this "Fallback-Schriftfamilie" in its editor) on each font — `"Arial"`/`"sans-serif"` if the design doesn't specify one.
   - `typography_font_family` only actually renders if that typeface is available. **Never reference a Google Font by name directly** — Elementor/the browser would load it live from Google's CDN, which is a GDPR/DSGVO problem for an EU-facing site (a well-known real legal risk, not a style preference). Instead, self-host every font — including Google Fonts — via `customFont_upload` (see section 5h): download the font file first, then upload it, then reference that same `family` name. A system font (Arial, Helvetica, ...) is the only case that needs no upload at all.

   Every page/template built afterward with `page_createFromHtml`/`elementorTemplate_create` can then reference these same global tokens instead of hardcoding colors per page.

## 3b. Building a whole site from a design ("build me a site based on this template")

Break this into separate tool calls per piece — never fold the footer or navigation into a page's own content. Run the 3a baseline check first, then:

1. **Each page** (home, about, contact, ...) → `page_createFromHtml` (see section 3), one call per page.
2. **Footer and header** → `elementorTemplate_create` with `type: "footer"`/`"header"` (see section 5) — **not** a section added to a page's own content. A footer built as page content only appears on that one page; a footer built as a Theme Builder template appears site-wide and shows up correctly in Elementor's own "My Templates" screen. After creating one, tell the user to spot-check it in `/wp-admin/edit.php?post_type=elementor_library` or the Elementor editor — this plugin doesn't have a way to browse/list existing templates back, only fetch one by ID (`elementorTemplate_get`).
3. **Navigation menu** → `menu_create` (name only, creates an empty menu), then `menuItem_create` per link (see section 5g) — **not** a page or Theme Builder header. Assigning the finished menu to a theme location (header/footer nav) has no API; tell the user to do that manually in WP-admin → Appearance → Menus after building it.

Report each piece's outcome separately (page IDs, footer/header template IDs, menu ID) rather than one blanket "site built" summary — that's what makes a partial failure (e.g. the footer template silently not saving correctly) visible instead of hidden inside an overall success claim.

## 4. Publishing

`page_createFromHtml` always leaves the resulting page as a **draft**, even after the conversion job completes — publishing is a separate step. Once the job is `"completed"`, call `page_update({ id: postId, status: "publish" })` unless the user explicitly asked to leave it as a draft for review first.

## 4a. Multilingual sites (Polylang or WPML)

`site_healthCheck`'s result includes a `languages` field — `null` on a single-language site, otherwise `{ plugin, default, available }`. If it's set and the user asks to create or update content without saying which language it's for, **ask before calling `page_create`/`page_createFromHtml`/`page_update`** — don't silently assume the site's default language. Pass the answer as `lang`. If the new page is meant to be a translation of an existing one, ask for that page's ID too and pass it as `translationOfId` to link them as a translation group.

## 5. Theme Builder templates — footer, header, 404, search-results, single-post, product, popup

A request for a site-wide **footer**, **header**, custom **404 page**, **search-results page**, **single-post/single-[custom-post-type] template**, WooCommerce **product template**, or **popup** → `elementorTemplate_create({ title, type, elements, conditions?, pageSettings?, siteId })`. Build `elements` the same way as `page_addElementorWidget`'s `element` (see `ELEMENTOR_WIDGETS.md`), just as a top-level array — for single-post/product templates, use the context-only widgets documented there (`theme-post-title`, `theme-post-content`, `woocommerce-*`, ...).

- `type`: `"footer"`, `"header"`, `"error-404"`, `"search-results"`, `"single-post"`, `"product"`, or `"popup"`.
- `conditions`: only `footer`/`header` default to `["include/general"]` (entire site) if omitted. **Every other type requires an explicit condition** — see `elementor-templates.md`'s suggested-strings table (e.g. `["include/404"]`, `["include/singular/post-type/product"]`). Ask the user if it's unclear what the condition should be rather than guessing. None of these condition strings are verified against a live install — say so, and check the result in the Elementor editor.
- `pageSettings`: mainly for popups (width, close-button, background). **After creating a popup, always tell the user its trigger (on page load, on scroll, on exit intent, ...) still needs setting manually in the Elementor editor's Popup Settings → Triggers tab** — there's no ground truth for that config yet, so this tool can't set it, and an untriggered popup never shows to visitors.

A request for anything else in Elementor's Theme Builder catalogue — Loop Item templates, Cookie Consent, Preferences Banner — is **still not implemented**, there's no tool for it. Say so plainly rather than approximating one by editing a single page's content, which would not behave like a real site-wide/conditional template and would mislead the user about what happened. See `ELEMENTOR_WIDGETS.md`'s "Theme Builder templates" section for the full list of what's been confirmed to fall in this bucket.

### Third-party plugin widgets (Fluent Forms, Smart Slider 3, JetSmartFilters, ...)

These belong to plugins other than Elementor/Elementor Pro — there's essentially no visibility into their settings schema, so don't guess a `widgetType` for them (a wrong slug silently renders nothing).

**Fluent Forms and Smart Slider 3 are verified exceptions** (see `ELEMENTOR_WIDGETS.md`): if the user wants an *existing* form/slider embedded and can give you its ID (Fluent Forms → All Forms, or Smart Slider 3, in WP-admin), use `fluent-form-widget`/`smartslider` directly — that part is well-defined.

For a **brand-new Fluent Form**, use the `form_createFluentForm` tool to actually build it (fields, submit button, settings, notifications — see `FLUENT_FORMS.md` in this skill for the shape), then embed the resulting form ID with `fluent-form-widget`. Only fall through to the placeholder procedure below if the fields needed aren't in `FLUENT_FORMS.md`'s known-`element` table (payment fields, multi-step, conditional logic aren't verified yet) — say so and ask, don't guess an unverified field type. Smart Slider 3 and everything else still has no creation path — that case always falls through to the steps below.

Before falling back to a placeholder for anything else, check whether the plugin has a plain WordPress **shortcode** for it (a lot of older plugins do, even without a dedicated Elementor widget) — a `shortcode` widget (`{ "widgetType": "shortcode", "settings": { "shortcode": "[...]" } }`) can embed that directly, see `ELEMENTOR_WIDGETS.md`.

If there's no shortcode either:

1. Add a plain placeholder where it belongs instead — a `heading` or `text-editor` widget saying something like "TODO: [Fluent Forms contact form] — add manually in the Elementor editor" (adjust wording to what's actually needed), via `page_addElementorWidget`.
2. Tell the user explicitly: this widget type isn't supported, a placeholder was left at the right spot, and ask whether they'd rather (a) build it themselves in the Elementor editor, or (b) have Claude add a *generic* Elementor equivalent instead where one reasonably exists (e.g. Elementor Pro's own `form` widget — see `ELEMENTOR_WIDGETS.md`'s Tier C).

Don't silently pick option (b) without asking — a generic substitute isn't necessarily what the user's site actually needs (e.g. if a form's submissions feed an existing integration, a different form widget breaks that).

## 5b. Custom code snippets (Code Snippets / codesnippets.pro)

For custom PHP/CSS/JS/HTML — not Elementor content — use `codeSnippet_create`/`codeSnippet_update`/`codeSnippet_list`/`codeSnippet_get`/`codeSnippet_delete`/`codeSnippet_activate`/`codeSnippet_deactivate`, not a page tool. Valid `scope` values: `global`, `admin`, `front-end`, `single-use`, `content`, `head-content`, `footer-content`, `admin-css`, `site-css`, `site-head-js`, `site-footer-js`, `condition` — the CSS/JS/content ones only actually execute with Code Snippets **Pro** active, though the free plugin still stores them. A new snippet is created inactive unless `active: true` is passed, and PHP snippets with a syntax error are forced back to inactive by the plugin itself — check the returned `codeError` field and tell the user if it's set rather than reporting success. `condition_id` (Pro's snippet-conditions feature) isn't supported.

## 5c. SEO metadata (Yoast, Rank Math, All in One SEO, SeoPress)

Per-plugin tools, not one generic one: `yoast_get`/`yoast_update`, `rankmath_get`/`rankmath_update`, `aioseo_get`/`aioseo_update`, `seopress_get`/`seopress_update` — all share the same field shape (`title`, `metaDescription`, `focusKeyword`, `canonical`, `noindex`, `nofollow`, `ogTitle`, `ogDescription`, `ogImage`, `twitterTitle`, `twitterDescription`, `twitterImage`). Check `site_healthCheck`'s `adapters` list for which one is actually active before calling any of them — calling the wrong plugin's tool 424s (dependency missing), it doesn't silently no-op.

## 5d. WooCommerce

`woocommerceProduct_list`/`_get`/`_create`/`_update`/`_delete` — simple products only. Variable products (with variations/attributes) aren't supported — if the user needs those, say so rather than creating a simple product that doesn't match what they asked for.

## 5e. Custom field plugins (ACF, Pods, Meta Box)

`acf_getAll`/`acf_get`/`acf_update`/`acf_updateAll` (ACF), `pods_get`/`pods_update`/`pods_updateAll` (Pods), `metaBox_get`/`metaBox_update`/`metaBox_updateAll` (Meta Box) — `selector` is the field name/key. Check `site_healthCheck`'s `adapters` list for which plugin is actually active before calling any of them. Pods and Meta Box have no "get all fields" tool (no stable API for that) — ask the user for the specific field name/key rather than guessing one.

## 5f. Form plugins with dedicated tools (Contact Form 7, WPForms, Ninja Forms, Formidable Forms)

For these four, use each plugin's own tools instead of an Elementor widget or a page tool: `cf7_list`/`_get`/`_create`/`_update`/`_delete` (Contact Form 7), `wpforms_list`/`_get`/`_create`/`_update`/`_delete` (WPForms), `ninjaForms_list`/`_get`/`_create`/`_update`/`_delete` (Ninja Forms), `formidable_list`/`_get`/`_create`/`_update`/`_delete` (Formidable Forms). Check `site_healthCheck`'s `adapters` list first for which one is actually active — calling the wrong plugin's tool 424s.

Each plugin's `fields`/`settings`/`mail`/`options` are passed through verbatim in that plugin's own shape — there's no shared/generic form-field schema across them:
- **Contact Form 7**: `form` is CF7's own shortcode-tag markup (e.g. `[text* your-name][submit "Submit"]`), not HTML. `mail`/`mail2` use CF7's field names (`subject`, `sender`, `body`, `recipient`, `additional_headers`, `attachments`, `use_html`). `messages` is a flat map of message keys (e.g. `mail_sent_ok`) to text.
- **WPForms**: `fields`/`settings` use WPForms's own JSON shape, the same shape you'd see in an exported form. Creating without `fields` produces an empty form. `_update`/`_delete` require the WP user mapped to the API key to hold WPForms's own capabilities — if a call fails with no detail, that's the likely cause.
- **Ninja Forms**: `fields`/`actions` use Ninja Forms's own settings-object shape. A default "Save Form" action is added automatically if `actions` is omitted on create. `ninjaForms_update` only changes the form's `title`/`settings` — fields/actions can't be edited after creation with this tool; recreate the form if they need to change.
- **Formidable Forms**: each field object has `type`/`name`/`fieldOptions` and, for choice-based types, `choices`. `options` is the form-level options object (before/after/submit HTML, etc.). `formidable_delete` trashes the form (recoverable) unless `permanent: true` is passed, which also removes its fields/entries/actions.

None of these four plugins' form-builder UIs were used to hand-verify a real created form's on-site rendering — say so if the user asks for confirmation beyond the API response.

## 5g. Navigation menus

`menu_list`/`_get`/`_create`/`_update`/`_delete` for the menu itself; `menuItem_list`/`_create`/`_update`/`_delete` for its items.

- A menu item is either a **custom link** (set `url`) or a **link to an existing page/post/category** (set `objectType` — e.g. `"page"`, `"post"`, `"category"` — and `objectId` to its ID; WordPress derives the real URL itself). Don't set both.
- `parentId` (another item's ID) nests an item as a submenu entry; `position` controls display order.
- There's no API for assigning a menu to a theme location (the actual header/footer nav slot) — after building the menu, tell the user it still needs assigning manually in WP-admin → Appearance → Menus → Manage Locations.
- `menu_create` only takes a `name` — it starts empty; add items afterward with `menuItem_create`.

## 5h. Custom (proprietary/self-hosted) fonts

`customFont_upload(filePath, family, weight?, style?)` uploads a local `.ttf`/`.otf`/`.woff`/`.woff2`/`.eot` file and registers a real `@font-face` for it, printed on every page load (frontend and Elementor's editor preview both hit it) — **not** via Elementor Pro's own Custom Fonts screen (that data model is closed-source, no API), but functionally equivalent from the browser's side: once uploaded, reference the same `family` name in `elementorKit_addFont`/`updateFont`'s `typography_font_family` and it renders correctly. It will **not** appear in Elementor's own Custom Fonts admin list/picker — that's cosmetic only, doesn't affect rendering.

- One upload per weight/style combination — call it again with the same `family` for a bold/italic variant.
- `customFont_list`/`customFont_delete` to see/remove what's registered.
- **Use this for every font, including Google Fonts** — never reference a Google Font by name/CDN directly (GDPR/DSGVO: the browser would load it live from Google's servers). Download the font file first, then upload it here, so it's fully self-hosted.
- **Elementor Pro's own Custom Fonts screen** (WP-admin → Elementor → Editor → Custom Elements → Fonts) is a separate, Pro-only capability — only available if the user has Elementor Pro installed, and something they'd do manually there (real TTF/WOFF upload through Elementor's own UI). A font uploaded that way *does* show up in Elementor's font-family picker dropdown, unlike one registered via `customFont_upload`. Both approaches make the font render correctly; only the admin-UI-visibility differs. If the user already has fonts set up that way (check `elementorKit_listFonts`'s `typography_font_family` values against what's visible in their Custom Fonts list), don't re-upload duplicates via `customFont_upload`.

## 6. Confirm what happened

End with a short, concrete confirmation: which site, which page (title + slug/URL), and whether it's published or still a draft.
