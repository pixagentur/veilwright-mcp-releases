# Fluent Forms reference for `form_createFluentForm`

Use this when a request needs a **brand-new** Fluent Form built (a contact form, a request form, ...) — as opposed to embedding a form that already exists on the site, which is the `fluent-form-widget` Elementor widget (`{ "form_list": "<id>" }`, see `ELEMENTOR_WIDGETS.md`). Call `form_createFluentForm({ title, fields, ..., siteId })`.

**Learned from one real Fluent Forms export (2026-07-03)**, not from official docs — Fluent Forms doesn't publicly document this schema. After creating a form this way, **tell the user to open it in Fluent Forms' own editor and check it looks right**, same spirit as anything below Tier A in `ELEMENTOR_WIDGETS.md`. If the user provides another real form export later, use it to correct/expand this file.

## Shape

```json
{
  "title": "Contact",
  "fields": [ /* field nodes, see below */ ],
  "submitButton": { /* optional, same node shape, sensible default used if omitted */ },
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

A **container** (multi-column layout wrapper — every real form uses at least one at the top level, even for a single column):
```json
{ "element": "container", "columns": [
  { "width": "", "fields": [ /* field nodes for this column */ ] }
]}
```
Real exports always wrap top-level fields in at least one single-column container per row — don't put leaf fields directly at the top level of `fields`, wrap each row in a `container` first, even a one-column one.

## Known `element` types (✅ = seen in a real export, confidence otherwise from Fluent Forms' general conventions)

| element | Use | Notes |
|---|---|---|
| `container` ✅ | Layout row with 1+ columns | `columns[].fields[]` nested |
| `input_text` | Single-line text | |
| `input_name` ✅ | Combined first/last name | seen alongside `name-fields` variant |
| `input_email` ✅ | Email address | |
| `textarea` ✅ | Multi-line text | |
| `select` ✅ | Dropdown | `settings.advanced_options` = array of `{id, label, value, calc_value, image}` |
| `input_checkbox` ✅ | Checkbox group | same `advanced_options` shape as select |
| `input_radio` ✅ | Radio group | same `advanced_options` shape |
| `input_file` ✅ | File upload | `settings.btn_text` |
| `terms_and_condition` ✅ | Terms/GDPR checkbox | `settings.tnc_html`, `settings.has_checkbox` |
| `custom_html` ✅ | Raw HTML block | `settings.html_codes` |
| `button` ✅ | Submit button | used for `submitButton`, see below |

Fluent Forms has more built-in types (phone, number, date, rating, repeater, payment fields, ...) not yet confirmed via a real export — treat those as best-effort/Tier-C-equivalent and say so to the user, same discipline as unverified Elementor widgets.

## Submit button

```json
{ "element": "button", "attributes": { "type": "submit", "class": "btn-default" },
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

## Known limitations

- Payment fields, conditional logic (`conditional_logics` appears in every real field's `settings` but always empty/disabled in what's been seen so far), and multi-step forms haven't been verified — don't attempt them, tell the user instead.
- Created forms have no Fluent Forms revision history (the creation bypasses their own editor/save pipeline) — doesn't affect the form working, just its edit history in their UI.
