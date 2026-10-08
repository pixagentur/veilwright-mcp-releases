# Fluent Forms reference for `form_createFluentForm`

Use this when a request needs a **brand-new** Fluent Form built (a contact form, a request form, ...) — as opposed to embedding a form that already exists on the site, which is the `fluent-form-widget` Elementor widget (`{ "form_list": "<id>" }`, see `ELEMENTOR_WIDGETS.md`). Call `form_createFluentForm({ title, fields, ..., siteId })`.

**Learned from one real Fluent Forms export (2026-07-03)**, not from official docs — Fluent Forms doesn't publicly document this schema. After creating a form this way, **tell the user to open it in Fluent Forms' own editor and check it looks right**, same spirit as anything below Tier A in `ELEMENTOR_WIDGETS.md`. If the user provides another real form export later, use it to correct/expand this file.

## Shape

```json
{
  "title": "Contact",
  "fields": [ /* field nodes, see below */ ],
  "submitButton": "Jetzt anfragen",
  "status": "published",
  "formSettings": { /* optional, merged over defaults */ },
  "notifications": [ /* optional, one object per email notification */ ]
}
```

## Field nodes

A **leaf field**:
```json
{ "element": "input_text", "attributes": { "name": "full_name" }, "settings": { "label": "Full name", "admin_field_label": "" } }
```

**Never set `editor_options` yourself** — veilwright-ai derives it automatically from `element` (real Fluent Forms defaults, checked against `fluentform.latest-stable`'s own source). Fixed 2026-08-13: a field written without it used to open as an empty grey tile with a blank settings panel in the Fluent Forms editor — worked on the frontend, just wasn't editable afterward. Only pass `editor_options` to override one specific key (e.g. a custom tile title); anything you don't set still comes from the derived default.

A **container** (multi-column layout wrapper — every real form uses at least one at the top level, even for a single column):
```json
{ "element": "container", "attributes": {}, "columns": [
  { "width": "", "fields": [ /* field nodes for this column */ ] }
]}
```
Real exports always wrap top-level fields in at least one single-column container per row — don't put leaf fields directly at the top level of `fields`, wrap each row in a `container` first, even a one-column one.

**`attributes` is required on every node and must be an object** — including `container` and `custom_html`, which have nothing to put in it. Send `{}`, never `[]` and never omit it: the tool's schema rejects the call otherwise (confirmed 2026-09-24).

## Known `element` types (✅ = seen in a real export, confidence otherwise from Fluent Forms' general conventions)

| element | Use | Notes |
|---|---|---|
| `container` ✅ | Layout row with 1+ columns | `columns[].fields[]` nested |
| `input_text` | Single-line text | |
| `input_name` ⛔ | Combined first/last name | **Not usable via this API.** `form_createFluentForm` drops the nested `fields` object (`first_name`/`middle_name`/`last_name`); the read-back shows a shell with `settings` and `editor_options` but no inputs, while the response still counts the field in `fieldCount`. Use two plain `input_text` fields (first name, last name) instead. Confirmed 2026-09-24. |
| `input_email` ✅ | Email address | |
| `textarea` ✅ | Multi-line text | |
| `select` ✅ | Dropdown | `settings.advanced_options` = array of `{id, label, value, calc_value, image}` |
| `input_checkbox` ✅ | Checkbox group | same `advanced_options` shape as select |
| `input_radio` ✅ | Radio group | same `advanced_options` shape |
| `input_file` ✅ | File upload | `settings.btn_text`. **Fluent Forms Pro only** — in the free plugin "File Upload"/"Image Upload" are greyed out in the editor. If a form needs uploads (job applications), check the licence first and tell the user, instead of shipping a form without the upload it used to have. |
| `terms_and_condition` ✅ | Terms/GDPR checkbox | `settings.tnc_html`; `settings.has_checkbox` **must be `true`** (same for `gdpr_agreement`). Without it only the text renders, no checkbox, and a required field makes the form impossible to submit. Confirmed 2026-09-23. |
| `custom_html` ✅ | Raw HTML block | `settings.html_codes` |
| `button` ✅ | Submit button | used for `submitButton`, see below |

Fluent Forms has more built-in types (phone, number, date, rating, repeater, payment fields, ...) not yet confirmed via a real export — treat those as best-effort/Tier-C-equivalent and say so to the user, same discipline as unverified Elementor widgets.

## Submit button

Usually just pass the button text as a plain string — `"submitButton": "Jetzt anfragen"`. Only build the full node if styling (color, size, alignment) needs to be non-default:
```json
{ "element": "button", "attributes": { "type": "submit", "class": "" },
  "settings": { "button_ui": { "type": "default", "text": "Send", "img_url": "" }, "align": "left", "button_size": "md" } }
```

## Form settings (confirmation message)

```json
{ "confirmation": {
  "redirectTo": "samePage",
  "messageToShow": "<p>Thank you for your submission.</p>",
  "samePageFormBehavior": "hide_form",
  "customPage": null,
  "customUrl": null
}}
```

## Notifications

One object per email notification — Fluent Forms stores each as its own row, not a single array field, so sending 2 emails means 2 objects in the `notifications` array of the request:
```json
{ "name": "New Submission",
  "sendTo": { "type": "email", "email": "office@example.com", "field": null, "routing": [] },
  "fromName": "Example GmbH",
  "fromEmail": "",
  "replyTo": "office@example.com",
  "bcc": "",
  "subject": "New submission: {inputs.subject}",
  "message": "<p>New form entry received.</p>",
  "active": true
}
```
`sendTo.type` can also be `"field"` with `sendTo.field` set to a field's `name` attribute — routes the notification to whatever email address the user typed into that field (seen in a real export routing to an `email` field, for auto-replying to the submitter).

## Hidden field carrying the page it is embedded in

An `input_hidden` with `value: "{embed_post.post_title}"` (a Fluent Forms smartcode) submits the title of the page the form is embedded in. Inside a Theme Builder single template it resolves to the displayed entry's title, not the template's name. One form can then serve every job opening / listing, and the notification still says which one the submission is about. Confirmed 2026-09-24.

## Embedding and styling in Elementor

The widget is `fluent-form-widget`; the form is selected with **`form_list`** (the form id as a string, `"0"` = none), not `form_id`. A wrong key is stored and echoed back, but the widget then renders nothing at all — no `data-widget_type="fluent-form-widget.default"` in the HTML — while Fluent's assets still load, so the page looks technically fine. Check `document.querySelector('form.frm-fluent-form')` on the frontend, not the write response. In the Elementor editor, `elementor.widgetsCache['fluent-form-widget'].controls.form_list.options` lists the selectable forms.

The submit button is styled on the widget, not in the form: `form_submit_button_bg_color_normal`/`_hover`, `form_submit_button_text_color_normal`/`_hover`, `form_submit_button_typography_*`, `form_submit_button_border_radius`, `form_submit_button_padding` (read from Fluent Forms 6.2.x's `FluentFormWidget.php`; Stand 2026-09, prüfen on other versions).

## There is no update or delete tool — check before creating, read back after

`form_createFluentForm` creates; nothing in this server edits or deletes a Fluent form afterwards. A form created with a wrong field list can only be repaired in the Fluent Forms editor or replaced by a new one, and the broken one stays behind. So: compare the planned field list against an existing form on the same site (`form_getFluentForm`) **before** creating, and after creating read it back with `form_getFluentForm` (every field still has its `editor_options`, nested `fields` objects are intact) and check every required checkbox renders as an `input[type=checkbox]` on the frontend.

The tool sets `fields`, `submitButton`, `formSettings` and `notifications` at creation time. To change notifications or settings later without the editor, Fluent Forms' own REST API is the route: in a logged-in wp-admin page, `window.fluent_forms_global_var.rest` carries `url` and `nonce` (send the nonce as `X-WP-Nonce`):

```
GET    {rest.url}/settings/{id}?meta_key=notifications
POST   {rest.url}/settings/{id}         {meta_key, value: JSON.stringify(obj), meta_id}
DELETE {rest.url}/settings/{id}?meta_id={metaId}
```

**`meta_id` is mandatory on the POST when changing an existing record** — without it Fluent Forms creates a second record instead of updating the first (a real case produced two duplicate notifications that had to be deleted again). Count the `meta_id`s after every write. The same applies to any other per-form settings record (`advancedValidationSettings`, ...).

## Known limitations

- Payment fields (the field type itself, not the `has_payment` flag below), conditional logic (`conditional_logics` appears in every real field's `settings` but always empty/disabled in what's been seen so far), and multi-step forms haven't been verified — don't attempt them, tell the user instead.
- **Fixed 2026-08-30**: form creation now goes through Fluent Forms' own real save pipeline (`FormService::store()`/`Updater::update()`/`SettingsService::store()`, verified against the real Fluent Forms source) instead of writing directly into its database tables. A created form now gets a real Fluent Forms edit-history entry, `has_payment` is computed correctly instead of always `0`, and third-party Fluent Forms addons that hook into form save now see these forms too. One user-visible change: `veilwright_validation` errors from `POST /fluentforms` can now also be Fluent Forms' own real validation messages (duplicate field `name` attributes, a malformed notification's `sendTo`/`subject`/`message`, ...), not just this plugin's own shape checks — pass those straight through to the user, they're accurate. This does **not** touch `editor_options` — that's a separate, already-fixed problem (below), and Fluent Forms' own save path doesn't compute it either.
- **Fixed 2026-08-13, was a real bug before this:** fields created without `editor_options` were unreadable/unbearable in the Fluent Forms editor (empty grey tile, blank settings panel) even though they rendered and worked fine on the frontend. Root cause: Fluent Forms' Vue editor loads a field's settings panel via `editor_options.template`, and `editor_options` wasn't being generated or passed through. Now derived automatically — see "Field nodes" above. Confirmed live 2026-09-24: a 13-field form (radio, two-column rows, select, number, upload, conditional containers, GDPR) read back with every `editor_options`/`uniqElKey` present, and the Fluent Forms editor showed every field with its label. Older notes saying API-created forms "cannot be edited in the Fluent editor" describe the state before this fix and no longer apply; still read the form back after creating it (see above). The one remaining exception is `input_name` (see the table).
