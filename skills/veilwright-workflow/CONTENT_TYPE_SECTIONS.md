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
5. An **archive** template — condition `include/<cpt-slug>_archive` — holding a
   `loop-grid` whose `template_id` points at part 4.

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
- **The card title** is `theme-post-title` with `link: "yes"`, not a text widget
  containing a link.
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
    "query_post_type": "listing",
    "posts_per_page": "12",
    "nothing_found_message": "Nothing listed at the moment."
  }
}
```

`template_id` is the loop item template's post id, as a string.

One thing to check rather than trust: the query control's prefix has differed
between Elementor Pro versions (`query_post_type` vs `post_query_post_type`).
Read it off an existing loop grid on that site, or confirm on the rendered
archive that the cards are the right post type, before calling the build done —
a wrong prefix is ignored silently and the grid falls back to posts.

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

Which form plugin depends on the site. If it is Fluent Forms, build the form in
its own editor and place it with `fluent-form-widget` — see `FLUENT_FORMS.md`
for why a form created through the API is no longer editable there.

## What these tools cannot do yet

`elementorTemplate_create` has no `archive` or `loop-item` type, and
`elementorTemplate_get`/`_delete`/`_updateConditions` reject those templates.
Tell the user those two templates have to be created in their Elementor editor,
and do not bend `_elementor_template_type` afterwards to fake it.

If a one-off script is genuinely the only way, it goes through Elementor's own
template source, and it is deleted afterwards:

```php
\Elementor\Plugin::$instance->templates_manager->get_source( 'local' )->save_item( array(
  'title'   => 'Listing card',
  'type'    => 'loop-item',   // or 'archive'
  'content' => $elements,     // same array shape as _elementor_data
  'status'  => 'publish',
) );
```

Make any such script idempotent — guard it with an option or a lookup for the
title it is about to create. A confirmation from a browser/navigation tool that
it "ran" is not proof, and a second run creates a second set of templates.

Valid document types:
`\Elementor\Plugin::$instance->documents->get_document_types()`.
Valid condition names:
`ThemeBuilder\Module::instance()->get_conditions_manager()->get_conditions_config()`.

## Conditions apply only after a Theme Builder save

Conditions written through the API land in post meta but not in Elementor's own
conditions cache. Verify on the real frontend — `elementor-location-single` and
`elementor-location-archive` must appear in the HTML — and if they do not, ask
the user to open each template in the Theme Builder and save it. Do not patch
the conditions option or its taxonomy from a snippet.

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
