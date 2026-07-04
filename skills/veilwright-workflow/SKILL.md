---
name: veilwright-workflow
description: Use whenever the user asks to create, edit, or publish content on a WordPress site through Veilwright AI — especially when they name a domain (e.g. "on lustigebeispiel.de, create an Impressum page" or "add a page to waldbären.de"). Resolves the domain to the correct registered site and picks the right tool so work reliably lands on the right site with the right result.
---

# Veilwright site work

## 1. Resolve the domain to a site — every time, don't assume

Before calling any `page.*`/`media.*`/`job.*`/`audit.*` tool, call `site.list` and match the domain the user mentioned (strip `https://`, `http://`, `www.`; compare case-insensitively) against each returned site's `url`.

- No match: tell the user this site isn't registered yet and that they need to run `site.add` first (WP-admin → Veilwright AI → create an API key, then "add my site: <url>, key ID ..., secret ...").
- More than one plausible match: ask which one before doing anything.
- Never fall back to whichever site a previous `site.select` left active in this process. Claude Desktop connects to Veilwright's MCP server once at app startup and that one process is plausibly shared by every open conversation — a different, unrelated chat may have already changed the "selected" site. Always resolve the domain explicitly.

## 2. Pass `siteId` explicitly on every call for this request

Once resolved, pass that site's `id` as the `siteId` argument on every tool call for this task (`page.create`, `page.createFromHtml`, `page.update`, `media.upload`, `job.status`, ...). Don't rely on `site.select` alone — it's a convenience for a single ad-hoc call, not something to lean on across a multi-step task.

## 3. Pick the right page tool

- **Plain content, no design/layout described** ("create an Impressum page with this text") → `page.create` (title + content).
- **A design, layout, or HTML is given or implied** ("build this page to look like...", HTML pasted in, a screenshot/description of a layout) → `page.createFromHtml`. This builds a *native* Elementor page (real widgets), not a content dump.
  - It's async: it returns `{ jobId, status: "queued", postId }` immediately. Poll `job.status(jobId)` — wait a couple seconds between checks — until the status is `"completed"` or `"failed"`. Don't tell the user the page is done before that.
  - On `"failed"`, report the actual error to the user; don't silently retry or fall back to `page.create` without saying so.
- **A specific widget is named** ("add an accordion FAQ", "add a countdown", "add a testimonial") that `page.createFromHtml` wouldn't produce on its own → `page.addElementorWidget`, after the target page exists (create it first with either tool above if it doesn't yet). See `ELEMENTOR_WIDGETS.md` in this skill for `widgetType`/`settings` values and how confident each one is — it's not all equally reliable, and some (Loop Grid, Portfolio, Off-Canvas) have real limitations spelled out there. Say so to the user instead of presenting a best-effort result as finished.

## 4. Publishing

`page.createFromHtml` always leaves the resulting page as a **draft**, even after the conversion job completes — publishing is a separate step. Once the job is `"completed"`, call `page.update({ id: postId, status: "publish" })` unless the user explicitly asked to leave it as a draft for review first.

## 5. Theme Builder templates — footer, header, 404, search-results, single-post, product, popup

A request for a site-wide **footer**, **header**, custom **404 page**, **search-results page**, **single-post/single-[custom-post-type] template**, WooCommerce **product template**, or **popup** → `elementorTemplate.create({ title, type, elements, conditions?, pageSettings?, siteId })`. Build `elements` the same way as `page.addElementorWidget`'s `element` (see `ELEMENTOR_WIDGETS.md`), just as a top-level array — for single-post/product templates, use the context-only widgets documented there (`theme-post-title`, `theme-post-content`, `woocommerce-*`, ...).

- `type`: `"footer"`, `"header"`, `"error-404"`, `"search-results"`, `"single-post"`, `"product"`, or `"popup"`.
- `conditions`: only `footer`/`header` default to `["include/general"]` (entire site) if omitted. **Every other type requires an explicit condition** — see `elementor-templates.md`'s suggested-strings table (e.g. `["include/404"]`, `["include/singular/post-type/product"]`). Ask the user if it's unclear what the condition should be rather than guessing. None of these condition strings are verified against a live install — say so, and check the result in the Elementor editor.
- `pageSettings`: mainly for popups (width, close-button, background). **After creating a popup, always tell the user its trigger (on page load, on scroll, on exit intent, ...) still needs setting manually in the Elementor editor's Popup Settings → Triggers tab** — there's no ground truth for that config yet, so this tool can't set it, and an untriggered popup never shows to visitors.

A request for anything else in Elementor's Theme Builder catalogue — Loop Item templates, Cookie Consent, Preferences Banner — is **still not implemented**, there's no tool for it. Say so plainly rather than approximating one by editing a single page's content, which would not behave like a real site-wide/conditional template and would mislead the user about what happened. See `ELEMENTOR_WIDGETS.md`'s "Theme Builder templates" section for the full list of what's been confirmed to fall in this bucket.

### Third-party plugin widgets (Fluent Forms, Smart Slider 3, JetSmartFilters, ...)

These belong to plugins other than Elementor/Elementor Pro — there's essentially no visibility into their settings schema, so don't guess a `widgetType` for them (a wrong slug silently renders nothing).

**Fluent Forms and Smart Slider 3 are verified exceptions** (see `ELEMENTOR_WIDGETS.md`): if the user wants an *existing* form/slider embedded and can give you its ID (Fluent Forms → All Forms, or Smart Slider 3, in WP-admin), use `fluent-form-widget`/`smartslider` directly — that part is well-defined.

For a **brand-new Fluent Form**, use the `form.createFluentForm` tool to actually build it (fields, submit button, settings, notifications — see `FLUENT_FORMS.md` in this skill for the shape), then embed the resulting form ID with `fluent-form-widget`. Only fall through to the placeholder procedure below if the fields needed aren't in `FLUENT_FORMS.md`'s known-`element` table (payment fields, multi-step, conditional logic aren't verified yet) — say so and ask, don't guess an unverified field type. Smart Slider 3 and everything else still has no creation path — that case always falls through to the steps below.

Before falling back to a placeholder for anything else, check whether the plugin has a plain WordPress **shortcode** for it (a lot of older plugins do, even without a dedicated Elementor widget) — a `shortcode` widget (`{ "widgetType": "shortcode", "settings": { "shortcode": "[...]" } }`) can embed that directly, see `ELEMENTOR_WIDGETS.md`.

If there's no shortcode either:

1. Add a plain placeholder where it belongs instead — a `heading` or `text-editor` widget saying something like "TODO: [Fluent Forms contact form] — add manually in the Elementor editor" (adjust wording to what's actually needed), via `page.addElementorWidget`.
2. Tell the user explicitly: this widget type isn't supported, a placeholder was left at the right spot, and ask whether they'd rather (a) build it themselves in the Elementor editor, or (b) have Claude add a *generic* Elementor equivalent instead where one reasonably exists (e.g. Elementor Pro's own `form` widget — see `ELEMENTOR_WIDGETS.md`'s Tier C).

Don't silently pick option (b) without asking — a generic substitute isn't necessarily what the user's site actually needs (e.g. if a form's submissions feed an existing integration, a different form widget breaks that).

## 6. Confirm what happened

End with a short, concrete confirmation: which site, which page (title + slug/URL), and whether it's published or still a draft.
