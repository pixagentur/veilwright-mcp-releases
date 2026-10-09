# Site operations: what happens to your writes on a live WordPress site

The other reference files describe *what* to send (widget shapes, form fields,
templates). This one describes what a real WordPress install does to it on the
way in, and how to work so that nothing gets duplicated, lost or quietly changed.
Every rule here cost real rework on a production site. Notes that depend on a
plugin version are marked **Stand 2026-10, prüfen** (as of 2026-10, verify): treat
them as a strong hint, check them once on the site at hand, and trust the live
system over this file when the two disagree.

## 1. WordPress rewrites content on the way in, often without any error

Elementor data and post content pass through WordPress's sanitizing (`wp_kses`
and friends) before they are stored. Some rewrites make the write verification
fail visibly, others leave content that still *looks* right. The only reliable
check is comparing what came back with what you sent.

| You send | Stored as | Visible? | What to do |
|---|---|---|---|
| `&` in a URL inside Elementor settings (`link.url`, query strings) | `&amp;` | yes, `… did not persist as written` | Encode as `&amp;` yourself before writing, or avoid query parameters in links. |
| Inline `<svg>` inside an `html` widget | removed completely, rest of the widget kept | yes, same error; frontend just shows no icons | Upload the SVG to the media library and reference it with `<img src="…">` (survives), or use the native `icon` widget with `selected_icon.library: "svg"`. An `<img>` SVG does not inherit `currentColor` — upload it in the colour you need. |
| `style="vertical-align: top;"` (trailing semicolon) | `style="vertical-align: top"` | yes, same error | Normalize inline styles before writing (`;"` → `"`). |
| `'` inside inline styles in a `text-editor` | `&apos;` | no | Harmless (browsers decode entities in attributes), but it happens on **every** `page_updateElementorWidget` call on that widget, even when you did not send `editor`. Byte-exact comparisons between two states of such a widget are worthless. |
| A backslash, e.g. the regex `/\.(js|css)$/` in a code sample | `/.(js|css)$/` | **no** — call succeeds, content stays plausible | Compare the stored version with the sent one character by character for anything containing code, backslashes, quotes or inline markup. Prefer code samples that do not need backslashes at all. |

The dangerous rewrites are not the ones that break something visibly, but the
ones after which the result still looks correct.

## 2. `… did not persist as written` usually means "written, possibly several times"

That error comes from the write-back verification, not from the write. In the
cases above the content **was** saved — and in observed cases the call was
retried internally and wrote the element **two or three times** (a whole
top-level section, or a complete header template, tripled).

- After this error, do not repeat the call. First read the current state
  (`page_getElementorData`, compare top-level ids, or count headings on the
  frontend), delete duplicates with `page_deleteElementorElement`, then fix the
  cause (table above) and write once.
- `page_addElementorWidget` has also duplicated an element **without** any
  error: one call with a 44-descendant container produced two copies; the
  response reported success and one element. The copies carried identical ids
  in all children, only the two top-level containers differed. After every
  Elementor write, check the top-level ids for duplicates before calling the
  step done. Cheapest check: count headings on the frontend.
- The response of `page_addElementorWidget` is not proof of what was stored in
  either direction: a container with `heading` + `text-editor` came back with
  only the `text-editor` in the response while both were saved. Read back with
  `page_getElementorData` or the frontend.
- A `409` means the write happened and only the confirmation read failed — same
  rule: read first, then decide.

## 3. Concurrency: per site, and per document

**Per site: at most four calls at a time.** Thirteen parallel `acf_updateAll`
calls hit `Rate-Limit überschritten` from the sixth on; after that the site's
circuit breaker opened and every further call failed with `Circuit breaker is
open for this site`. It took about six minutes to close again (150 seconds was
not enough). For more than a handful of writes, work in groups of at most four,
one group per message. After an abort, do not just resend everything: read the
current state through the site's WordPress REST API (costs no Veilwright quota)
and write only the records that are actually missing.

**Per document: strictly one write at a time.** Every Elementor write
(`page_updateElementorWidget`, `page_addElementorWidget`, delete/move/replace)
reads the whole `_elementor_data`, changes one element and writes the whole
document back. Two parallel writes to the same page or template are a
read-modify-write race and can silently drop each other's change; a read sent
in parallel with a write can show the state before the write. The four-calls
limit above is about the rate limiter and does **not** make this safe.
Parallelism runs along documents: different pages may be written in parallel,
several changes to the same page or template run in sequence, and the
verification read comes after the last write response. (Same rule as the Kit
settings in the workflow guide §3a, which are one document too.)

## 4. Writing values into existing records

- **Read a neighbouring record first and copy its spelling.** Before writing a
  value into a field that already exists on other records (alt texts of an image
  series, a taxonomy name, an ACF field), read one of the existing records and
  match its conventions. Do not simplify characters pre-emptively (umlauts to
  `ae`/`oe`/`ue`, typographic quotes to straight ones) on a suspected encoding
  problem nobody has observed: the value lands correctly but is now the one
  record that differs from its neighbours, and that is only noticed after it is
  published. Replace characters only after a concrete failed write forced it.
- Where a one-off script needs a guard against running twice, pick the guard's
  option key so a later correction can reuse it, instead of leaving a second
  option row behind.

## 5. Media library

- **The upload filename becomes the permanent, search-engine-readable URL.**
  A working name that is unique inside a local folder structure
  (`post-07/cover.jpg`) is not unique in WordPress's flat uploads folder: it
  becomes `cover-1.jpg`, `cover-2.jpg`, … Derive a descriptive name before
  uploading (lowercase, no umlauts, matching the post's slug). Renaming later
  leaves either a duplicate or a dead URL, and this server has no tool to delete
  a media item.
- WordPress also rewrites filenames on upload (underscores become hyphens,
  counters are appended on collisions). Always take the URL from the
  `media_upload` response, never reconstruct it from the local filename.
- **Alt text at upload time:** `media_upload` takes it as `alt` (not
  `altText` — that one is silently dropped). Stand 2026-10, prüfen.
- **Alt text of an existing attachment** cannot be changed through this server:
  there is no media update tool, and `metaBox_update` only works with the Meta
  Box plugin active. If many existing alt texts must change and the user agrees
  to a one-off script: a front-end Code Snippet on `wp_loaded` that writes a
  fixed `attachment-id => text` list via `update_post_meta( $id,
  '_wp_attachment_image_alt', $text )`, guarded by an option so it runs once,
  printing nothing, triggered by an ordinary page view (no URL parameter, no
  endpoint, no `wp_set_current_user`, no capability workaround), and **deleted**
  afterwards. Verify in the rendered `alt` attributes. The guard option stays in
  `wp_options`; there is no tool to remove it. Otherwise the user edits the alt
  texts in the media library.

## 6. Previews that cost as much as the real thing

`page_deleteElementorElement` with `dryRun: true` returns the complete element
trees of everything it would remove, exactly like the real call. For large
text widgets the preview costs as much context as the deletion. Use it when the
id match is genuinely in doubt, not as a routine step.

## 7. After a domain change

WordPress derives attachment URLs from the site address at runtime, so the REST
API reports the new domain immediately. Elementor does not: every `image` widget
stores `image.url`, and every container `background_image.url`, as a full URL
string, which stays on the old domain even when `image.id` is set (tell-tale: the
`<img>` carries `wp-image-<id>`, so it was rendered by id, and still points at
the old host). After a domain change, check and rewrite:

- `image` widgets (`image.url`) and image lightbox links (`link.url` pointing at
  the same file),
- container backgrounds (`background_image`) and **`background_overlay_image`**
  (a separate key),
- gallery and carousel repeaters,
- outside Elementor: the SEO plugin's stored social image (Yoast keeps `og:image`
  in its own index table, which does **not** heal when the page is saved — set
  `ogImage` explicitly or run Yoast's "optimize SEO data"), fonts registered via
  `customFont_upload` (absolute URLs in the registry, no update tool — see the
  workflow guide §5h for the replacement order), and other plugins' settings.

## 8. Reading rendered Elementor HTML

`e-parent` on an element means "contains containers", not "top level". A page
with four sections easily yields sixteen `e-parent` matches because every
nested column with children carries it too. The top-level sections are the
direct children of `div.elementor[data-elementor-type="wp-page"]` (or the
template's own `data-elementor-type`). Using the class as a level filter writes
changes into columns instead of sections.

To find template ids that a listing tool does not return, read them off the
frontend: `data-elementor-type="…" data-elementor-id="…"` pairs on the
rendered page.
