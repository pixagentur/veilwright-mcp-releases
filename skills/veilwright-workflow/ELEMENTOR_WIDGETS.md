# Elementor widget reference for `page_addElementorWidget`

Use this when a request needs a specific Elementor widget that `page_createFromHtml` has no native mapping for (it only understands headings, paragraphs, images, buttons, icon lists, and containers). Call `page_addElementorWidget({ id, element, siteId })` with `element` shaped like the examples below.

**None of this is verified against a live WordPress + Elementor install** — there is no way to test it in the environment this was written in. It's based on Elementor's long-documented, stable conventions, organized by how confident that is. After using anything below Tier A, **tell the user to open the page in the Elementor editor and check it looks right** — don't imply it's guaranteed correct.

Best way to actually verify/fix an entry: build the real widget in the Elementor editor, save it as a template, export it (Templates → Saved Templates → row menu → Export), and read the JSON — that's real ground truth, not a guess. If a user provides one of these, update the relevant entry below and note it's now verified.

**✅ VERIFIED** entries below came from real exported templates and can be trusted more than the rest — everything else is still best-effort from training knowledge. Eleven real exports verified on 2026-07-03 (2 popups, a 404 page, an archive, a single post, a search-results page, a WooCommerce product page, a footer template, a contact page, a privacy page, a homepage) already corrected one wrong guess (Tabs) and one wrong assumption (Fluent Forms) — see those entries, plus several new confirmed/added widgets below.

If a request is asking for something not on this list at all, say so rather than guessing a `widgetType` — a wrong slug just silently renders nothing in Elementor.

---

## ⚠️ Elementor "Atomic Elements" / Editor V4 format — do not use, confirmed off-limits by Elementor itself

One real export (a contact page) contained a handful of elements in a **completely different, newer format** mixed in among otherwise-classic widgets: `"elType": "e-flexbox"` / `"widgetType": "e-heading"` instead of `container`/`heading`, with settings wrapped as `{"$$type": "string", "value": "..."}` and a separate top-level `"styles"` object holding CSS-class-based responsive variants (breakpoints, states). Other known element types in this system: `e-paragraph`, `e-image`, `e-svg`, `e-div-block`, `e-tabs`, `e-youtube`. This is Elementor's newer "Atomic Elements" system, part of the in-progress Editor V4 rollout — not the classic widget model this whole reference is built on. The user who provided the export confirmed they've only built a handful of things with it so far — it's not in regular use on their sites.

**Don't construct `e-*` elements — this is now confirmed, not just a caution.** Checked Elementor's own developer channels directly (2026-07-03): a maintainer stated on GitHub (`github.com/orgs/elementor/discussions/32950`) that *"We are actively changing pretty much everything. Releasing any documentation or API now would literally break when we reach Beta status,"* and explicitly *"We do not recommend attempting to integrate with components and features for the new Atomic Editor"* — no JSON schema, no `$$type` spec, no styles/classes architecture is publicly documented, and none is expected before the 4.0 release. Building against it now means building against a format that's actively changing shape underneath.

Every element built via `page_addElementorWidget` keeps using the classic `elType: "widget"/"container"` shape documented here — every real export still uses it almost exclusively, including the rest of that same contact page, so it's the safe default and will remain so until Elementor ships a stable V4 API. Re-evaluate once that happens, not before.

---

## Global Colors & Fonts (the Kit) — `elementorKit.*` tools

Widgets across real exports reference site-wide colors via a `__globals__` object instead of an inline hex value — e.g. `"__globals__": {"title_color": "globals/colors?id=primary"}` for a system color slot, or `"globals/colors?id=ee9a5dd"` for a custom one. `primary`/`secondary`/`text`/`accent` are Elementor's 4 fixed system color (and font) slots; anything else is a custom entry's 7-char hex `_id`. This confirms the reference scheme, though not the Kit's own storage shape (see below).

Manage these with `elementorKit_listColors`/`addColor`/`updateColor`/`deleteColor` and the equivalent `elementorKit.*Font*` tools — see `veilwright-ai/docs/elementor-kit.md`. **This is more speculative than the rest of this file**: no real Kit template export exists yet, so the underlying `_elementor_page_settings` key names (`system_colors`, `custom_colors`, `system_typography`, `custom_typography`) are inferred from the `__globals__` reference scheme above plus Elementor's known, long-stable Global Colors/Fonts feature — not read from an export the way everything else here was. Verify a change actually appears in Elementor's Site Settings panel before telling the user it's done. If the user ever exports a Kit template, treat it like any other new export: read it, correct this section and `elementor-kit.md` if the real shape differs.

To make a widget *use* a global instead of a fixed value, reference it the same way real exports do — via `__globals__` in the widget's `settings`, e.g. `{ "settings": { "__globals__": { "title_color": "globals/colors?id=primary" } } }` — rather than inlining a hex color, whenever the user's intent is "use the site's brand color" rather than "use this exact color".

---

## Custom HTML attributes (title/aria-label/etc.) — any widget — ✅ VERIFIED (live site, 2026-07-10)

Elementor's Advanced tab → "Attributes" panel (adds a raw HTML attribute to a widget's wrapper element — a `title` tooltip, an `aria-label`, anything else) is an **Elementor Pro feature — use it whenever Pro is installed**, don't skip it just because the free plugin doesn't have it. Confirmed live on a real site (not guessed, not from training knowledge): the setting is a single string under the key **`_attributes`** (underscore-prefixed, Elementor's convention for Advanced-tab settings — same pattern as `_element_id`), format `key|value`, **one attribute per line** (multiple attributes are newline-separated within that one string, e.g. `"title|Veilwright Logo\naria-label|Zur Startseite"`) — not an array, not nested settings.

```json
{ "elType": "widget", "widgetType": "image", "settings": {
  "image": { "url": "...", "id": 240 },
  "_attributes": "title|Veilwright Logo"
}}
```

---

## Per-element custom CSS/ID/classes — any widget or container — round-trip confirmed live (2026-07-14)

**Use these instead of a Code Snippets CSS/JS snippet or theme-wide custom CSS whenever the styling is scoped to one specific element or a handful of related elements** — the user's own stated preference, matching Elementor's own Advanced-tab fields exactly (see screenshots referenced 2026-07-14): "Individuelles CSS" (Custom CSS), and under "Layout": "CSS ID" and "CSS-Klassen". Real, stable Elementor Advanced-tab setting keys (long-established in Elementor's own core/Pro codebase, same category of certainty as `_attributes`/`_element_id` above):

- **`_element_id`** *(Elementor core, free)* — the "CSS ID" field. A single string, becomes the wrapper element's HTML `id`.
- **`css_classes`** *(Elementor core, free, added Elementor 3.19)* — the "CSS-Klassen" field. A single space-separated string of extra classes on the wrapper element, e.g. `"my-class another-class"`.
- **`custom_css`** *(Elementor Pro only — same Pro-gating pattern as `_attributes`, use whenever Pro is installed)* — the "Individuelles CSS" field. A single string of real CSS. Elementor scopes it to the widget automatically: write selectors starting with `selector` (Elementor substitutes its own generated wrapper selector), e.g. `"selector { color: red; } selector:hover { color: blue; }"` — not a literal CSS class/ID you invent yourself.

Confirmed via a live create → read-back → delete round-trip against a real site (values persisted in `_elementor_data` exactly as sent) — not yet independently confirmed to visually render/populate the Elementor editor's own UI fields the way `_attributes` was, since that needs a live editor session. Treat as reliable but flag to the user if the rendered result looks off.

```json
{ "elType": "widget", "widgetType": "heading", "settings": {
  "title": "Example",
  "_element_id": "my-heading",
  "css_classes": "highlight",
  "custom_css": "selector { text-transform: uppercase; } selector:hover { opacity: 0.8; }"
}}
```

**Still prefer real widget settings over custom CSS whenever Elementor already exposes the same styling as a normal control** (color, spacing, typography, border, etc. — see the rest of this file and `SKILL.md` section 5's "widget-by-widget" rule) — custom CSS is for the exceptional case a control genuinely doesn't cover, not a shortcut around learning the right setting.

**Always set at least a `title` or `aria-label` on a meaningful non-decorative image** (a logo, an icon that's also a link) via `_attributes` — this is a real accessibility/SEO requirement, not optional polish. For the `image` widget specifically, its own dedicated `alt` setting (`settings.image.alt`) is the primary, simpler mechanism for alt text and should be set too; `_attributes`' `title`/`aria-label` is for cases `alt` alone doesn't cover (e.g. a logo that's also a clickable link needing its own accessible name) or for widgets with no dedicated alt-equivalent field at all.

---

## Tier A — high confidence (Elementor core, free, unchanged for years)

### Accordion — confidence lowered, re-verify before relying on it
```json
{ "elType": "widget", "widgetType": "accordion", "settings": {
  "tabs": [
    { "tab_title": "Question one", "tab_content": "Answer one" },
    { "tab_title": "Question two", "tab_content": "Answer two" }
  ]
}}
```
This is the *classic* Accordion widget's shape. Real exports proved the classic **Tabs** widget was actually replaced by a container-based `nested-tabs` widget in current Elementor (see the Tabs entry below) — Accordion may have been migrated the same way to `nested-accordion`, not confirmed either way yet. Try `accordion` first; if it renders as missing/unstyled, that migration is the likely reason. Ask the user for an Accordion template export to verify properly, same as was done for Tabs.

### Icon
```json
{ "elType": "widget", "widgetType": "icon", "settings": {
  "selected_icon": { "value": "fas fa-star", "library": "fa-solid" }
}}
```
**✅ VERIFIED shape** (via real export, 2026-07-03) — for a custom uploaded SVG instead of a Font Awesome icon, `selected_icon` looks like this instead:
```json
{ "selected_icon": { "value": { "url": "https://example.com/wp-content/uploads/icon.svg", "id": 12345 }, "library": "svg" } }
```
Use `media_upload` first to get the `url`/`id` if the SVG isn't already on the site.

### Icon Box
```json
{ "elType": "widget", "widgetType": "icon-box", "settings": {
  "title_text": "Fast delivery",
  "description_text": "Shipped within 24 hours.",
  "selected_icon": { "value": "fas fa-truck", "library": "fa-solid" }
}}
```

### Image Box
```json
{ "elType": "widget", "widgetType": "image-box", "settings": {
  "title_text": "Our office",
  "description_text": "Downtown, 3rd floor.",
  "image": { "url": "https://example.com/wp-content/uploads/office.jpg" }
}}
```
Use `media_upload` first if the image isn't already on the site, and use the URL it returns.

### Icon List
Already native via `page_createFromHtml` (maps from `<ul>`/`<nav>`), only use this widget directly for a list that isn't otherwise HTML-shaped:
```json
{ "elType": "widget", "widgetType": "icon-list", "settings": {
  "icon_list": [
    { "text": "Free shipping", "selected_icon": { "value": "fas fa-check", "library": "fa-solid" } },
    { "text": "30-day returns", "selected_icon": { "value": "fas fa-check", "library": "fa-solid" } }
  ]
}}
```

### Divider — ✅ VERIFIED (real export, 2026-07-03)
```json
{ "elType": "widget", "widgetType": "divider", "settings": { "style": "solid" } }
```
Can also carry a label in the middle of the line:
```json
{ "elType": "widget", "widgetType": "divider", "settings": { "text": "OR", "align": "center" } }
```

### Shortcode — ✅ VERIFIED (real export, 2026-07-03)
```json
{ "elType": "widget", "widgetType": "shortcode", "settings": { "shortcode": "[some_shortcode attr=\"value\"]" } }
```
Embeds any WordPress shortcode as-is — WordPress renders it, this widget is just a wrapper. Useful escape hatch for a third-party plugin's shortcode when it has one (many older plugins provide a shortcode even without a proper Elementor widget) — check whether the plugin in question has a documented shortcode before falling back to a placeholder.

### HTML — ✅ VERIFIED (real export, 2026-07-03)
```json
{ "elType": "widget", "widgetType": "html", "settings": { "html": "<div>Raw HTML here</div>" } }
```
This is what `page_createFromHtml` itself falls back to for content it can't map natively — same widget, usable directly too.

### Menu Anchor — ✅ VERIFIED (real export, 2026-07-03)
```json
{ "elType": "widget", "widgetType": "menu-anchor", "settings": { "anchor": "contact" } }
```
Creates a jump-link target — other elements can link to `#contact` and the page scrolls there.

### Breadcrumbs (Elementor Pro) — ✅ VERIFIED (real export, 2026-07-03; settings confirmed live 2026-07-10)
```json
{ "elType": "widget", "widgetType": "breadcrumbs", "settings": {} }
```
Fully dynamic (pulls from the page's actual position in the site), no content settings needed — only typography/color styling if wanted. This is Elementor's **own** breadcrumb generator — independent of whichever SEO plugin is active (Yoast, RankMath, ...). **Prefer this over a custom `[yoast_breadcrumb]`-style shortcode** for a footer/header breadcrumb trail: it gets full Elementor style controls (typography, color globals) instead of raw unstyled shortcode output. Real-world footer settings, wrapped in `nav` semantics and using Kit color globals:
```json
{ "elType": "widget", "widgetType": "breadcrumbs", "settings": {
  "align": "left",
  "html_tag": "nav",
  "__globals__": {
    "text_color": "globals/colors?id=secondary",
    "link_color": "globals/colors?id=accent",
    "link_hover_color": "globals/colors?id=primary"
  }
}}
```

### Polylang Language Switcher (Elementor Pro + Polylang) — ✅ VERIFIED (live site, 2026-07-10)
```json
{ "elType": "widget", "widgetType": "polylang-language-switcher", "settings": {
  "hide_current": "yes",
  "show_country_flag": "",
  "show_language_name": "",
  "show_language_code": "yes"
}}
```
Elementor Pro ships a **native** widget for Polylang's language switcher when Polylang is active — only appears in the widget panel if Polylang is installed. **Prefer this over a custom `[language_switcher]`-style shortcode**: same reasoning as Breadcrumbs above, full Elementor style controls instead of raw shortcode markup. `show_language_code`/`show_language_name`/`show_country_flag` are mutually-relevant toggles (pick one display style, e.g. code-only `"DE"`/`"EN"` vs. flag vs. full name); `hide_current: "yes"` omits the language currently being viewed from the list. Also carries its own typography/color/spacing settings (`typography_menu_item_*`, `color_menu_item*`, `padding_horizontal_menu_item`, ...) like any other Elementor widget.

Whenever a footer/header is built for a multilingual site (the site has more than one language in Polylang), include this widget somewhere in the layout — don't skip it just because it wasn't explicitly requested for that specific template.

### Spacer
```json
{ "elType": "widget", "widgetType": "spacer", "settings": { "space": { "size": 40, "unit": "px" } } }
```

### Button — ✅ VERIFIED (real export, 2026-07-03)
Already native via `page_createFromHtml` for a plain `<a class="button">`, but use directly when adding one standalone via `page_addElementorWidget`:
```json
{ "elType": "widget", "widgetType": "button", "settings": {
  "text": "Get in touch",
  "link": { "url": "https://example.com/contact", "is_external": "", "nofollow": "" }
}}
```
Can also carry a leading/trailing icon — confirmed across two real exports (footer, homepage):
```json
{ "elType": "widget", "widgetType": "button", "settings": {
  "text": "View all listings",
  "link": { "url": "/listings" },
  "selected_icon": { "value": "fas fa-long-arrow-alt-right", "library": "fa-solid" },
  "icon_align": "row-reverse",
  "icon_indent": { "unit": "px", "size": 15, "sizes": [] }
}}
```
`icon_align: "row-reverse"` puts the icon after the text; omit it (or use `"row"`) for icon-before-text.

### Heading — clickable variant ✅ VERIFIED (real export, 2026-07-03)
Already native via `page_createFromHtml` for plain `<h1>`–`<h6>`. Confirmed it can also carry a `link`, making the whole heading clickable (seen used for a phone number with a `tel:` link):
```json
{ "elType": "widget", "widgetType": "heading", "settings": {
  "title": "+49 3761 757280",
  "header_size": "h3",
  "link": { "url": "tel:+493761757280" }
}}
```

### Multi-column row (card grids, step rows, feature rows, footer columns) — ✅ VERIFIED (real reference section, hand-built in the Elementor editor, compared against on veilwright.one, 2026-07-14)

**This is the reliable, general-purpose pattern for putting several same-size boxes side by side — use this, not Container Grid mode (see the warning in the next section for why).** Verified against a real "3 steps" card row live-rendered at desktop (1280px: 3 columns, 372px/card), tablet (768px: still 3 columns, 218px/card), and mobile (stacks to 1 column, 20px gap) — plus a real hover state (pure CSS `:hover`, no JS).

**Parent container** — plain flex, not grid:
```json
{ "elType": "container", "settings": {
  "flex_direction": "row",
  "flex_wrap": "wrap",
  "flex_justify_content": "space-around",
  "width": { "unit": "px", "size": 1200 },
  "flex_gap": { "unit": "px", "size": 32, "column": 32 },
  "flex_gap_mobile": { "unit": "px", "size": 20, "column": "20", "row": "20", "isLinked": true }
}, "elements": [ /* one container per card, see below */ ] }
```

**Each child ("card") container — the critical, previously-wrong detail: width must be a PERCENTAGE, not a fixed pixel value:**
```json
{ "elType": "container", "settings": {
  "flex_direction": "column",
  "width": { "unit": "%", "size": 30 },
  "content_width": "full",
  "background_background": "classic",
  "background_color": "#ffffff",
  "border_border": "solid",
  "border_width": { "unit": "px", "top": "1", "right": "1", "bottom": "1", "left": "1", "isLinked": true },
  "border_color": "#e5e0d8",
  "border_radius": { "unit": "px", "top": "18", "right": "18", "bottom": "18", "left": "18", "isLinked": true },
  "padding": { "unit": "px", "top": "32", "right": "32", "bottom": "32", "left": "32", "isLinked": true },
  "border_hover_border": "solid",
  "border_hover_width": { "unit": "px", "top": "1", "right": "1", "bottom": "1", "left": "1", "isLinked": true },
  "__globals__": { "border_hover_color": "globals/colors?id=accent" },
  "box_shadow_hover_box_shadow_type": "yes",
  "box_shadow_hover_box_shadow": { "horizontal": 0, "vertical": 0, "blur": 20, "spread": 1, "color": "rgba(0, 0, 0, 0.17)" }
}, "elements": [ /* card content: heading, text-editor, ... */ ] }
```

**Why `width:{unit:"%"}` and not `width:{unit:"px"}` or `flex_grow`:** a real, independently confirmed prior test (2026-07-10, footer columns) already established that fixed **pixel** width or `flex_grow` on a flex child silently does nothing — children still compute to 100% width and wrap onto separate lines, despite round-tripping correctly through the API. The missing piece, only found by comparing against this real hand-built reference: a **percentage** width on the child *does* apply correctly. `content_width: "full"` on the child matters too — leaving it at the default (or setting `content_width: "custom"`, an earlier wrong guess) breaks the percentage width; `"full"` is the value the working reference actually used.

**Hover effect** (`border_hover_*`/`box_shadow_hover_*`) compiles to a real `:hover` CSS rule Elementor generates automatically — no motion-effects widget or JS needed, just set these Advanced-tab-style keys directly in `settings` like any other. To make one card visually "featured", also set the non-hover `box_shadow_box_shadow` to the same value as the hover one, so its shadow is always visible rather than only on hover — that's what the reference's middle card did.

**Responsive**: don't assume the *number* of columns needs to change per breakpoint — in the reference, the row stays 3-across down to tablet width (768px) purely because 3× a 30%-wide card plus gaps still fits; it only collapses to 1-per-row once `flex_wrap` actually has to wrap. The only breakpoint-specific setting used was `flex_gap_mobile` (a smaller, fixed 20px gap once stacked) — no `width_mobile`/`width_tablet` override was needed for this 3-card case. For a row with more columns that needs an earlier breakpoint change, add `width_tablet`/`width_mobile` overrides on the child the same way (Elementor's per-breakpoint `_<breakpoint>` suffix convention — `width_widescreen`/`width_laptop`/`width_tablet_extra`/`width_tablet`/`width_mobile_extra`/`width_mobile`).

### Container — Grid layout mode ✅ VERIFIED, but has a real bug — prefer the multi-column pattern above instead
Elementor's Container (used for every layout wrapper via `elType: "container"`) defaults to flexbox (`flex_direction`), but also supports a CSS-grid mode:
```json
{ "elType": "container", "settings": {
  "container_type": "grid",
  "grid_columns_grid": { "unit": "fr", "size": 4, "sizes": [] },
  "grid_rows_grid": { "unit": "fr", "size": 1, "sizes": [] },
  "content_width": "full"
}, "elements": [ /* child widgets/containers, placed into the grid cells in order */ ] }
```
**Confirmed real bug (live round-trip test, 2026-07-15): a grid-mode container collapses to a single ~1fr column if it's left at Elementor's default "boxed" content width.** Elementor's own base stylesheet ships a rule `.e-con-boxed.e-grid { grid-template-columns: 1fr; grid-template-rows: 1fr; }` that overrides whatever `grid_columns_grid` was set to, entirely regardless of its value — confirmed by reading the generated CSS directly, not guessed. **`content_width: "full"` on the grid container works around this** (as in the example above) — without it, grid mode silently renders one narrow column no matter what `grid_columns_grid` says. A 2026-07-03 real export used grid mode successfully for a 4-up "services" grid, so it does work when configured right; this `content_width` requirement just wasn't understood/documented until this bug was isolated. Given the multi-column pattern above needs no such workaround and is independently verified across three breakpoints, **prefer it for a straightforward N-up row of same-size boxes**; grid mode is still the right call for a genuinely grid-shaped layout (items spanning multiple cells/rows, masonry-like arrangements) that plain flex-wrap can't express.

### Tabs — ✅ VERIFIED (real export, 2026-07-03): use `nested-tabs`, NOT `tabs`
The classic `tabs` widget (inline `tab_content` text field) is **wrong for current Elementor** — real exports show it's been replaced by a container-based "Nested Tabs" widget. Each tab's content is a **separate sibling container** in `elements`, matched to the `tabs` array by position, not an inline text field:
```json
{ "elType": "widget", "widgetType": "nested-tabs", "settings": {
  "tabs": [
    { "tab_title": "Overview", "_id": "tab1id" },
    { "tab_title": "Details", "_id": "tab2id" }
  ]
}, "elements": [
  { "elType": "container", "settings": { "_title": "Tab #1" }, "elements": [ /* widgets for tab 1 go here */ ], "isInner": true },
  { "elType": "container", "settings": { "_title": "Tab #2" }, "elements": [ /* widgets for tab 2 go here */ ], "isInner": true }
]}
```
Put whatever widgets that tab should show (heading, text-editor, whatever) inside that tab's container's `elements` array.

### Counter
```json
{ "elType": "widget", "widgetType": "counter", "settings": {
  "starting_number": 0, "ending_number": 250, "title": "Happy customers"
}}
```

### Alert
```json
{ "elType": "widget", "widgetType": "alert", "settings": {
  "alert_type": "info", "alert_title": "Note", "alert_description": "Opening hours changed for the holidays."
}}
```

### Social Icons
```json
{ "elType": "widget", "widgetType": "social-icons", "settings": {
  "social_icon_list": [
    { "social_icon": { "value": "fab fa-facebook", "library": "fa-brands" }, "link": { "url": "https://facebook.com/example" } },
    { "social_icon": { "value": "fab fa-instagram", "library": "fa-brands" }, "link": { "url": "https://instagram.com/example" } }
  ]
}}
```

### Video
```json
{ "elType": "widget", "widgetType": "video", "settings": { "youtube_url": "https://www.youtube.com/watch?v=..." } }
```

### Read More
```json
{ "elType": "widget", "widgetType": "read-more", "settings": { "button_text": "Read more" } }
```
Only meaningful inside a post-content context (e.g. a Loop Item template) — not something to add to a regular static page.

---

## Tier B — moderate confidence (Elementor Pro, common/stable, minor field-naming risk)

### Testimonial
```json
{ "elType": "widget", "widgetType": "testimonial", "settings": {
  "testimonial_content": "Excellent service, highly recommended.",
  "testimonial_name": "Jane Doe",
  "testimonial_job": "CEO, Example GmbH",
  "testimonial_image": { "url": "https://example.com/wp-content/uploads/jane.jpg" }
}}
```

### Call to Action
```json
{ "elType": "widget", "widgetType": "call-to-action", "settings": {
  "title": "Ready to get started?",
  "description": "Join today and save 20%.",
  "button": "Sign up",
  "link": { "url": "https://example.com/signup" }
}}
```
Elementor Pro's CTA widget has several visual "skins" with slightly different field sets — this covers the common one. If it doesn't look right, that's the most likely reason.

### Countdown
```json
{ "elType": "widget", "widgetType": "countdown", "settings": {
  "due_date": "2026-12-31 23:59",
  "evergreen": ""
}}
```
`due_date` format is `YYYY-MM-DD HH:MM`.

### Progress Bar
```json
{ "elType": "widget", "widgetType": "progress", "settings": {
  "title": "Skill level",
  "percent": { "size": 80, "unit": "%" },
  "display_percentage": "show"
}}
```

### Blockquote
```json
{ "elType": "widget", "widgetType": "blockquote", "settings": {
  "blockquote_content": "The only way to do great work is to love what you do.",
  "blockquote_author": "Steve Jobs"
}}
```

### Rating
```json
{ "elType": "widget", "widgetType": "rating", "settings": {
  "rating_scale": "5",
  "rating_value": "4.5"
}}
```
Some Elementor versions call this widget `star-rating` instead of `rating` — if it renders as an unstyled/missing widget, that's the first thing to try switching.

### Login (Elementor Pro) — ✅ VERIFIED (real export, 2026-07-03)
```json
{ "elType": "widget", "widgetType": "login", "settings": {
  "button_text": "Log in",
  "custom_labels": "yes",
  "user_label": "Username or Email",
  "password_label": "Password",
  "redirect_after_logout": "yes",
  "redirect_logout_url": { "url": "/" }
}}
```
Uses WordPress's own login/auth — nothing else to configure. `custom_labels: "yes"` is required for `user_label`/`password_label` to take effect (otherwise Elementor's defaults are used).

---

## Tier C — best-effort, real limitations (Pro, complex or query-driven)

These are more likely to need manual touch-up in the Elementor editor. Say so to the user rather than presenting the result as finished.

### Form
```json
{ "elType": "widget", "widgetType": "form", "settings": {
  "form_name": "Contact",
  "form_fields": [
    { "field_type": "text", "field_label": "Name", "field_required": "true" },
    { "field_type": "email", "field_label": "Email", "field_required": "true" },
    { "field_type": "textarea", "field_label": "Message" }
  ],
  "button_text": "Send"
}}
```
Where submissions actually go (email, webhook, integration) is configured under the widget's "Actions After Submit" and isn't something this can set reliably — tell the user to check that in the editor.

### Nav Menu — ✅ VERIFIED (real export, 2026-07-03)
```json
{ "elType": "widget", "widgetType": "nav-menu", "settings": { "menu": "Main Menu" } }
```
`menu` is the **menu's name as registered in WordPress**, not an ID — confirmed via real exports (`"menu": "gesamtsortiment"`, matching a real WP menu's registered name). Make sure it already exists (create/check via the `menus.*` tools) before adding this widget — if the name doesn't match exactly, the widget renders empty. Real exports also carried `menu_id`/`menu_name` alongside `menu`, but those look like Elementor's own editor-UI bookkeeping rather than something required for rendering — `menu` is the field that matters.

### Posts (a query, not fixed content)
```json
{ "elType": "widget", "widgetType": "posts", "settings": {
  "posts_post_type": "post",
  "posts_per_page": 6,
  "pagination_type": "none"
}}
```
This pulls real posts from the site at render time — there's nothing else to configure content-wise. Fine as-is.

### Image Carousel
```json
{ "elType": "widget", "widgetType": "image-carousel", "settings": {
  "carousel": [
    { "url": "https://example.com/wp-content/uploads/1.jpg" },
    { "url": "https://example.com/wp-content/uploads/2.jpg" }
  ]
}}
```

### Loop Grid / Portfolio — likely won't fully work without manual setup
Both reference a separately-saved Elementor "Loop Item" template by ID (`template_id` in settings) that has to already exist — built visually in the Elementor editor, not creatable through this API. Without one, the widget renders empty even with correct settings. **Tell the user this needs a template created in the Elementor editor first** rather than attempting a full result. Real exports (Elementor Pro, WooCommerce product listings) confirm the shape once a template exists:
```json
{ "elType": "widget", "widgetType": "loop-grid", "settings": {
  "template_id": "367204",
  "posts_per_page": 12,
  "product_query_post_type": "current_query"
}}
```
`product_query_post_type` (or `post_query_post_type` in non-WooCommerce contexts) controls which posts feed the grid — `"current_query"` follows whatever archive/search context the page is in, or set a specific value to pull a fixed set.

### Search (Elementor Pro) — same limitation as Loop Grid
```json
{ "elType": "widget", "widgetType": "search", "settings": {
  "search_input_placeholder_text": "Search...",
  "search_query_post_type": "post",
  "template_id": "478326"
}}
```
Also references a pre-existing Loop template (`template_id`) to render results — same caveat as Loop Grid/Portfolio: tell the user this needs a template built in the editor first.

### Table of Contents (Elementor Pro)
```json
{ "elType": "widget", "widgetType": "table-of-contents", "settings": {
  "title": "Table of Contents",
  "html_tag": "div",
  "marker_view": "bullets",
  "minimize_box": "",
  "no_headings_message": "No headings were found on this page."
}}
```
Auto-generates its list from the page's actual `<h1>`–`<h6>` headings at render time — no fixed content to configure. Real export confirmed this shape on a page that also used `menu-anchor` widgets to give specific headings jump targets.

### Off-Canvas — not supported at all
This is a site-wide Elementor Theme Builder element (like a global footer/header), not a per-page widget — adding it to one page's `_elementor_data` wouldn't behave like a real off-canvas panel. Tell the user this isn't available yet.

---

## Theme Builder templates — footer/header/404/search/single-post/product/popup now supported

All real exports verified so far that carry a `"type"` field other than `"page"` turned out to be **Theme Builder templates**, not regular pages: `popup`, `error-404`, `search-results`, `single-post`, `product`, `footer`. These are site-wide/conditional templates with trigger/display conditions configured separately in Elementor (not part of the template's own `content` JSON).

**All of the above can now be created** via `elementorTemplate_create` (MCP tool) / `POST /elementor/templates` (API) — see `veilwright-ai/docs/elementor-templates.md` for the request shape and a suggested-`conditions`-string table per type. This reuses the exact widget knowledge in this file (the `elements` array is the same shape as `page_addElementorWidget`'s `element`). Real exports confirmed the template's `content` JSON uses the exact same shape as a regular page's `_elementor_data` — so the *content-building* half is solid across every type.

Two things are still best-effort, not verified against a live install:
- **`_elementor_conditions`** (controls *where* a template applies) — a template export doesn't capture conditions at all, they live in the site's Theme Builder config, not the portable template JSON. Only `footer`/`header` get a default (`["include/general"]`, entire site) applied automatically; every other type **requires** an explicit condition string from the caller (there's no sensible universal default for e.g. a product template) — see `elementor-templates.md`'s table.
- **Popup trigger timing** (on page load, on scroll, on exit intent, ...) — genuinely unverified, neither real popup export had trigger fields set. A popup created via `elementorTemplate_create` has content, conditions, and basic appearance (`pageSettings`: width/close-button/background, confirmed from the same exports), but **won't show to visitors until its trigger is set manually in the Elementor editor's Popup Settings → Triggers tab.** Always tell the user this after creating a popup — don't imply it'll pop up on its own.

Tell the user to check in the Elementor editor that a template actually applies/triggers where expected, same spirit as any other unverified shape in this file.

**Still not creatable**: Loop Item templates (needed for Loop Grid, see Tier C), Cookie Consent, Preferences Banner. Same limitation as Off-Canvas.

The widget-level knowledge extracted from all of them (Login, Icon, Fluent Forms, Nested Tabs, Shortcode, HTML, Menu Anchor, Breadcrumbs, Loop Grid, Search, ...) is reusable both on a **regular page** via `page_addElementorWidget`, and as the `elements` of an `elementorTemplate_create` call for the matching template type.

### Widgets that only make sense *inside* a Theme Builder template, not on a regular page
Spotted in the single-post/archive/product exports: `theme-post-title`, `theme-post-content`, `theme-archive-title`, `post-info` (Elementor Pro "dynamic" widgets — they pull from whatever post/archive context the *template* is currently rendering). Adding one of these to a normal static page (via `page_addElementorWidget`) renders nothing meaningful, since there's no post/archive context to pull from — but they're exactly the right widgets to put in a `single-post`-type `elementorTemplate_create` call, where that context does exist. If a request needs one of these on what's actually a regular page, that's the mismatch to flag — the fix isn't to skip the widget, it's to build a template instead.

### WooCommerce widgets — only meaningful inside a `product`-type template or an actual product page
Spotted in the product template: `woocommerce-product-images`, `woocommerce-product-price`, `woocommerce-product-content`, `wc-add-to-cart`. Like the Theme Builder widgets above, these need essentially no settings (they pull from "the current WooCommerce product" automatically) — use them as `elements` in an `elementorTemplate_create({ type: "product", ... })` call, not on an arbitrary regular page.

---

## Third-party plugin widgets — mostly not supported, two exceptions

Not Elementor/Elementor Pro — separate plugins with their own settings this has essentially zero visibility into. **Exceptions: Fluent Forms and Smart Slider 3**, corrected/added below via real exports. Everything else here still needs the placeholder + ask-the-user procedure in `SKILL.md` § 5.

### Fluent Forms — ✅ VERIFIED (real exports, 2026-07-03): both embedding an existing form and creating a new one now work
```json
{ "elType": "widget", "widgetType": "fluent-form-widget", "settings": { "form_list": "19" } }
```
`form_list` is the **numeric ID of a form already built in Fluent Forms**, as a string. Simple and reliable *if that form already exists*.

- User gives an existing Fluent Form's ID (ask them to check Fluent Forms → All Forms in WP-admin if they don't know it) → use `fluent-form-widget` directly, done.
- User wants a brand-new form → use the `form_createFluentForm` MCP tool to actually build it (see `FLUENT_FORMS.md` in this skill for the field-tree shape, learned from a real form export), then embed the resulting ID with `fluent-form-widget` as above. This is no longer a placeholder-only case — only fall back to asking the user to build it themselves if the field types they need aren't in `FLUENT_FORMS.md`'s known-`element` table (payment fields, multi-step, conditional logic are still unverified).

### Smart Slider 3 — ✅ VERIFIED (real export, 2026-07-03): embedding an *existing* slider works, building one doesn't
```json
{ "elType": "widget", "widgetType": "smartslider", "settings": { "smartsliderid": "3" } }
```
Same pattern as Fluent Forms: `smartsliderid` is the **numeric ID of a slider already built in Smart Slider 3**, as a string. Reliable if that slider already exists; building/editing the slider's slides is entirely inside Smart Slider's own editor.

- User gives an existing slider's ID (ask them to check Smart Slider 3 in WP-admin if they don't know it) → use `smartslider` directly, done.
- User wants a brand-new slider → placeholder + ask-the-user case, same as an unbuilt Fluent Form.

### Everything else (JetSmartFilters, ...)

Spotted so far: **JetSmartFilters** (Active Filters, Range Filter, Pagination, Sorting/Taxonomy/Visual Filter, ...). There will be others depending on what's installed on a given site — if a requested widget's plugin column in Elementor's Element Manager isn't "Elementor" or "Elementor Pro", treat it as third-party and unsupported unless it's been verified here like Fluent Forms/Smart Slider 3 were.

Don't guess a `widgetType` for these. Follow the placeholder + ask-the-user procedure in `SKILL.md` § 5.
