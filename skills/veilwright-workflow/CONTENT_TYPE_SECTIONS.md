# Content-type-backed sections (jobs, listings, portfolio, team, events, …)

A site section that lists many entries of the same kind and gives each one a
detail page. The subject changes — job openings, property listings, case
studies, team members, products, events, vehicles, courses, locations — the
construction does not. Build it the same way every time, or every project turns
into a different one-off that nobody can maintain.

This document is about **how the entries render**, which is where these builds
go wrong. Registering the post type and writing entries is covered by rule 15 of
the server instructions and by the `acf_*`/`customPostType_*` tools.

## The five parts

1. A custom post type, registered by the site owner (ACF, Pods, Meta Box, CPT UI
   …), with its archive enabled.
2. One field group, one field per content block.
3. A **single** template — `elementorTemplate_create`, `type: "single-post"`,
   condition `include/<cpt-slug>`.
4. A **loop item** template — no condition; the loop grid references it by id.
5. An **archive** template — condition read from the site's live
   configuration (usually `include/archive/<cpt-slug>_archive`, see
   "Conditions" below) — holding a `loop-grid` whose `template_id` points at
   part 4.

Build the loop item before the archive: the archive needs its id.

## The rule this document exists for

**Field values are bound to native widgets, never printed by a shortcode and
never by a code snippet.**

A bound widget stays editable for the site owner: they open Elementor, click the
heading, change the size. A shortcode rendering the same text is a black box
they cannot touch, and it drags in a PHP snippet that outlives whoever wrote it.
A snippet whose only job is to output field values is proof the section was
built wrong.

```json
{
  "elType": "widget",
  "widgetType": "heading",
  "settings": {
    "_title": "Location",
    "__dynamic__": {
      "title": "[elementor-tag id=\"a1b2c3d\" name=\"acf-text\" settings=\"%7B%22key%22%3A%22field_xy%3Alocation%22%7D\"]"
    }
  }
}
```

- `heading` binds on `title`; `text-editor` binds on `editor`; `button` binds on
  `link`.
- ACF text, textarea and WYSIWYG fields all use `name="acf-text"`. An ACF URL
  field uses `name="acf-url"`.
- Non-ACF tags used constantly here: `post-title`, `post-url`,
  `post-featured-image`.
- `settings` is URL-encoded JSON: `{"key":"<field key>:<field name>"}`, with
  optional `before`, `after`, `fallback`.
- `id` is any 7-character hex string. It may repeat across elements.

Generate the encoded string, never hand-type it:

```python
import json, urllib.parse
urllib.parse.quote(json.dumps({"key": "field_xy:location"}, separators=(',', ':')), safe='')
```

ACF field **keys** are not returned by `acf_getAll` (that returns values). Read
them off the field group's own edit screen in a browser:

```js
[...document.querySelectorAll('.acf-field-object')]
  .map(el => el.dataset.key + ' ' + el.querySelector('input[name$="[name]"]').value + ' ' + el.dataset.type)
```

## Field group shape

- **Lists belong in a WYSIWYG field**, not a textarea with one item per line. A
  textarea forces code somewhere to turn lines into `<li>`, and that code
  becomes a snippet. This is the second most common reason these builds end up
  with PHP in them.
- **Section headings as their own fields** when the owner should be able to
  rename them per entry. If the outline is identical for every entry, leave the
  heading in the template. Decide deliberately and say which you chose.
- Short attributes that appear both on the card and in the detail header
  (location, type, period, price, area) get their own fields.
- One field per block. Not one large field holding everything.

## Settings every one of these builds needs

- **`_title`** on every widget — its label in Elementor's navigator
  (`"_title": "Requirements text"`). Without it the owner faces ten identical
  "Text Editor" rows.
- **`e_display_conditions`** hides an element when its field is empty:

```json
"e_display_conditions": ["[[{\"condition\":\"dynamic_tags\",\"dynamic_tag\":\"requirements\",\"comparator\":\"is_not_empty\",\"dynamic_tag_value\":\"\"}]]"]
```

  It references the field **name**, not the key. Put the content field's
  condition on its heading too, otherwise an empty section leaves a bare
  heading behind.
- **Attribute pills** are `heading` widgets using the Advanced-tab settings
  `_background_background`, `_background_color`, `_padding`, `_border_radius`
  and `_element_width: "auto"`, inside a container with `flex_direction: "row"`
  and `flex_wrap: "wrap"`. No custom CSS.
- **The card title** is `theme-post-title`, not a text widget containing a link.
  Through the API it needs explicit bindings, or it renders the placeholder
  heading text: `title` bound to `post-title` and, for the link, `link` bound to
  `post-url` — `link: "yes"` on its own does nothing:
  `"__dynamic__": {"title": "[elementor-tag id=\"a1b2c3d\" name=\"post-title\" settings=\"%7B%7D\"]", "link": "[elementor-tag id=\"a1b2c3d\" name=\"post-url\" settings=\"%7B%7D\"]"}`.
- **The card's button** takes its href from a dynamic tag, not a hardcoded URL:
  `"__dynamic__": {"link": "[elementor-tag id=\"a1b2c3d\" name=\"post-url\" settings=\"%7B%7D\"]"}`.

## Loop grid

```json
{
  "elType": "widget",
  "widgetType": "loop-grid",
  "settings": {
    "template_id": "245",
    "_skin": "post",
    "columns": "2",
    "post_query_post_type": "current_query",
    "posts_per_page": "12",
    "nothing_found_message": "yes",
    "nothing_found_message_text": "Nothing listed at the moment."
  }
}
```

`template_id` is the loop item template's post id, as a string.

The query key is **`post_query_post_type`**; `query_post_type` is stored and
ignored silently, and the grid falls back to ordinary posts. On an archive
template `"current_query"` is the right value (the grid follows the archive's
own query); elsewhere set the CPT slug. `nothing_found_message` is only the
switch, the text is `nothing_found_message_text`. `data-settings` in the HTML
does not prove anything (only `frontend_available` settings appear there) —
confirm on the rendered archive that the cards are the right post type.

## A form on the detail page

When an entry invites an action (apply, request a viewing, book), the form
belongs at the end of its detail page, not only on a separate page. Put an
anchor on the form's container (`_element_id`) and a button higher up that jumps
to it.

A hidden field carries the entry's title into the notification, so the recipient
knows what it is about:

```json
{"custom_id":"subject","field_type":"hidden","field_value":"",
 "__dynamic__":{"field_value":"[elementor-tag id=\"a1b2c3d\" name=\"post-title\" settings=\"%7B%7D\"]"}}
```

Which form plugin depends on the site. The hidden field above is the Elementor
Pro form's shape. With Fluent Forms, create the form with `form_createFluentForm`
(or in its own editor), place it with `fluent-form-widget` (`form_list`, not
`form_id`), and carry the entry's title with a hidden field whose value is the
smartcode `{embed_post.post_title}` — inside a single template it resolves to
the displayed entry. Fluent Forms free has no file upload; an application form
that needs one needs Pro. Details in `FLUENT_FORMS.md`.

## `loop-item` and `archive`, and their one real difference from every other type

Fixed: `elementorTemplate_create` accepts `type: "loop-item"` and `type: "archive"`
directly — build the loop item first (the archive's `loop-grid` needs its id),
same tool, same shape as any other template. Never reassign
`_elementor_template_type` on an existing template via a snippet to fake either
type after the fact — build it with the real type from the start.

`loop-item` never takes `conditions` — omit the field entirely, it has no
display-condition concept at all (referenced by id from `loop-grid`, never
matched by the Theme Builder's condition system). `archive` does need one, same
as every other non-footer/header type — see "Conditions" below for how to read
the right string instead of assuming one.

Version notes (Stand 2026-10, prüfen): `archive`/`loop-item` need veilwright-mcp
0.33.0 or later — an older server rejects them in its own schema. On such a
version the user creates an empty template of the right type in the Elementor
editor and the content goes in with `page_replaceElementorData` on its id;
don't try a snippet calling Elementor's `save_item()` instead (it checks
capabilities and fails for an anonymous request). `elementorTemplate_list` may
not return these two types; read their ids off the frontend with
`data-elementor-type="…" data-elementor-id="…"`.

If any one-off script is genuinely needed for something these tools still can't
do, make it idempotent — guard it with an option or a lookup for the title it's
about to create. A confirmation from a browser/navigation tool that it "ran" is
not proof, and a second run creates a second set of templates.

## Conditions

**If a Theme Builder template does not apply, the condition is wrong or not yet
in Elementor's cache — Elementor is not broken.** Never write the option
`elementor_pro_theme_builder_conditions` or the condition taxonomy from a
snippet: that hides the real error and stays behind as a liability. With a
correct `type` and condition, the template applies without any extra help.

**Read the strings, don't guess them.** In the Elementor editor of the template,
the complete condition configuration of that installation is in

    elementor.config.initial_document.theme_builder.conditions

Its `archive.sub_conditions` branch shows whether a name is a condition of its
own or a **sub**-condition. On the sites checked, the archive of a custom post
type was a sub-condition: `name: "archive"` plus `sub_name: "<slug>_archive"`,
as a string `include/archive/<slug>_archive`. The single view took the flat name
`include/<slug>`. Other strings seen: `include/general` (entire site),
`include/post_archive`, `include/not_found404`, `include/singular/page/<id>` for
one page. The prefixed forms some tool descriptions suggest
(`include/singular/post-type/<slug>`, `include/archive/post_type_archive/<slug>`)
were saved without error and never applied.

**Symptom of a wrong string:** the Theme Builder overview shows the condition
seemingly correctly, but in the conditions dialog the first select is empty and
has no options. Repair without clicking through, in the open template editor:
`$e.route('theme-builder-publish/conditions')`, then on
`elementorPro.modules.themeBuilder.conditionsModel.get('conditions').at(0)` set
`name` first and **then** `sub_name` (setting `name` clears `sub_name`), then
click `.dialog-publish`. That writes post meta and Elementor's condition cache
together.

**Correct condition, still not rendering:** conditions written through the API
(`elementorTemplate_create`, `elementorTemplate_updateConditions`) land in post
meta, not always in Elementor's conditions cache, and the tool reports success
either way. A plain "Update" in the editor does not help when the document is
not marked as changed. What helps: in the template's editor, the arrow next to
*Publish* → *Display Conditions* → *Save & Close*. The template then applies
immediately. (The Hello theme's "disable theme header and footer" setting was
checked in both positions and is not the cause.)

**Always verify on the frontend:** `elementor-location-single`,
`elementor-location-archive`, `elementor-location-header`/`-footer` must appear
in the HTML of a page the template should apply to.

## When the user names an existing site as the model

"Build it like we did on project X" means read **project X's configuration**,
not its rendered page. Rendered HTML says nothing about how it was produced: a
shortcode-driven build and a properly bound one look identical in a browser.
One command settles it:

```bash
grep -o '"widgetType": "[^"]*"' template.json | sort | uniq -c
```

If `shortcode` does not appear and `heading`/`text-editor` do, the reference is
bound, and the copy must be bound too.

## Before calling it done

- No `shortcode` widget, and no code snippet backing this section
- Every widget has `_title`
- An entry with deliberately empty fields shows no orphaned headings
- Card title links; card button points at the right entry
- An empty archive shows the fallback message
- The hidden form field really carries the title in the page source
- `elementor-location-single` and `elementor-location-archive` are in the HTML
- A newly created entry renders its single template. If that template's condition is bound to a term
  (`include/singular/in_<taxonomy>/<term-id>`), the entry needs that term, set with `terms` in the same
  `customPostType_create` call, along with `featuredMedia` and `excerpt` if the cards use them. Compare the
  response's `terms`/`featuredMedia` with an existing entry, not with what you sent
