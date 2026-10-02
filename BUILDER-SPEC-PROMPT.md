# Build brief — a Beaver Builder-class visual page editor for maryam-cms

You are extending an existing multi-tenant CMS + storefront. This document is the
full specification. Read the "What already exists" section before designing
anything: a large part of the foundation is built, and the job is to grow it, not
to start over.

---

## 1. Stack and ground truth

- **Next.js 16.2.1**, App Router, TypeScript, Tailwind CSS. Server Components by
  default; `'use client'` only where interactivity demands it.
- **PostgreSQL + Drizzle ORM**, multi-tenant: a master database lists tenants and
  their connection strings. Request-scoped helpers `getContextDb()` and
  `getContextCompany()` resolve the active tenant. Never bypass them.
- **@dnd-kit** (`core`, `sortable`, `utilities`) is already installed and in use.
- **Tiptap** for rich text.
- Media is uploaded to **Cloudinary**; the picker is
  `src/components/admin/MediaPickerModal.tsx`.
- Admin UI primitives live in `src/components/admin/ui.tsx`
  (`Button`, `Card`, `Select`, `inputClass`, `cn`, …). Reuse them.

### Key paths

| Path | Role |
| --- | --- |
| `src/app/cms/builder/blocks.ts` | Block registry: `BlockType`, `BlockDef`, `FieldDef`, `normalizeBlocks` |
| `src/app/cms/builder/PageBuilder.tsx` | The editor (client): library, canvas, settings panel |
| `src/app/cms/builder/BlockRenderer.tsx` | Renders a block for both the canvas (`mode="edit"`) and the storefront (`mode="live"`) |
| `src/app/cms/pages/**` | Pages CRUD; `PageForm` hosts the builder |
| `src/app/home/**` | The storefront. `/home` is the front page |
| `src/app/home/page.tsx` | Renders the `home` document's blocks; storefront sections are rendered here, not in `BlockRenderer` |
| `src/lib/theme/**` | Theme settings, `--cms-*` variables, storefront nav |
| `cms_pages` table | `blocks jsonb` holds the layout |

### What already exists — do not rebuild

- A **block registry** with a typed `FieldDef` system: `text`, `textarea`,
  `richtext`, `number`, `select`, `color`, `toggle`, `range`, `image`, `images`,
  `products`, `category`, `heading`, `alignment`, `columns`, `spacing`,
  `productSource`, and a nested `items` repeater.
- A **drag-and-drop editor**: blocks reorder via dnd-kit, repeater rows reorder
  via a drag handle, a grouped searchable block library, and a per-block settings
  panel driven by `BlockDef.fields`.
- A **full-screen mode** toggle with a top bar and a Done button.
- **Storefront section blocks** (`store_products`, `store_categories`,
  `store_stats`, `store_about`, `store_deal`, `store_story`, `store_mind`,
  `store_blog`, `store_widgets`) plus `hero`, `hero_carousel`, `product_grid`,
  `cta`, `faq`, `testimonial`, columns, spacer, heading, paragraph, button,
  html, image, gallery.
- The builder canvas already receives the storefront's `--cms-*` theme variables
  so previews match the live site.
- Pages persist blocks through `updatePage` / `createPage` / `saveBuilderBlocks`.

### Known constraints you must respect

- `BlockRenderer` is imported by a **client** component (`PageBuilder`), so it
  cannot import async Server Components. Anything needing live catalogue data or
  server-only work is rendered by `src/app/home/page.tsx` instead, and shows a
  labelled placeholder inside the canvas. Keep this split.
- `dnd-kit` needs an explicit `id` on every `DndContext`, otherwise its
  `aria-describedby` ids drift between server and client renders and React
  reports a hydration mismatch.
- Every mutation in the editor must notify the host form **synchronously**;
  deferring it to an effect caused saves to persist stale state once already.

---

## 2. Goal

Turn the current block editor into a visual builder with the ergonomics of
Beaver Builder or Elementor, and make both the **front page** and **catalogue
pages** fully composable by a non-technical shop owner.

Success means: the owner can build the whole storefront — hero, sections,
product grids, card design, catalogue filters — without a developer, seeing the
real result while editing.

---

## 3. Part A — The editing shell

Replace the current three-column panel with a Beaver-style shell.

1. **Full-viewport editing surface.** The page renders at real width, exactly as
   visitors see it. No admin chrome around the canvas.
2. **Fixed top bar**: the page name, an undo/redo pair, a responsive-breakpoint
   switcher (desktop / tablet / mobile), a preview toggle that hides all editing
   affordances, and **Done**/**Publish**.
3. **A docked right panel** with tabs:
   - **Modules** — the block library as a two-column grid of labelled icons,
     grouped (Basic, Media, Layout, Actions, Info, Posts, Commerce, Storefront),
     with a group dropdown and a search box.
   - **Rows** — column-layout presets: 1–6 columns, Left Sidebar, Right Sidebar,
     Left & Right Sidebar, each as a visual thumbnail.
   - **Templates** — full page layouts that can be applied to the current page.
   - **Saved** — user-saved rows and modules, reusable across pages.
4. **Inline hover toolbars.** Hovering any row, column or module reveals a small
   floating toolbar pinned to its top-left corner, with: drag handle, settings
   (wrench), duplicate, move-to (or column actions), and delete. Rows, columns
   and modules each get their own colour so nesting is legible.
5. **Click-to-edit.** Clicking a module opens its settings in a panel (or a
   draggable floating window, Beaver-style) with tabs **General / Style /
   Advanced**. Text modules should also support editing directly on the canvas.
6. **Drag from the panel onto the canvas** with live drop indicators: a
   horizontal line between rows, a vertical line between columns, and a
   highlighted target column. Dragging must also work module → module,
   module → another column, and row → another position.
7. **Undo / redo** with a history stack (at least 50 steps) and keyboard
   shortcuts (`Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`, `Ctrl/Cmd+S` to save,
   `Delete` to remove the selection, `Esc` to deselect).
8. **Autosave drafts** on an interval and before navigation, separate from the
   published version, plus a **revision history** the owner can restore from.

---

## 4. Part B — Rows, columns, and free placement

The current model is a flat list of blocks with limited nesting. Move to a real
layout tree.

- A page is an ordered list of **rows**. A row contains **columns**. A column
  contains **modules** (and may contain nested rows).
- Every row has: content width (fixed / full width), height (auto / fixed /
  full screen), vertical alignment, background (colour, gradient, image, video),
  background overlay, padding, margin, border, border radius, shadow, and a
  visibility toggle per breakpoint.
- Every column has: width (percentage, resizable by dragging the divider between
  columns), vertical alignment, its own background and spacing, a responsive
  stacking order, and a reverse-on-mobile option.
- Column widths must be adjustable **by dragging the gutter**, snapping to
  sensible steps, with the sibling column absorbing the change.
- Modules inside a column stack vertically and reorder by drag.

This layout tree is what makes "each element can sit in a different place"
possible without free-floating absolute positioning, which breaks responsive
behaviour. If truly free placement is wanted for a specific block, support it as
an opt-in per-row mode: an absolute-positioning canvas with a snap grid, where
each child stores `x`, `y`, `width`, `height` **per breakpoint**.

---

## 5. Part C — Carousels where every slide is its own layout

Today `hero_carousel` renders each slide through one fixed template. Change this.

- A carousel block holds a list of **slides**, and **each slide is a full layout
  tree of its own** (rows → columns → modules), edited with the same tools as a
  page.
- The editor exposes a slide switcher (thumbnails or numbered tabs) so the owner
  edits one slide at a time, and a drag-to-reorder strip for slide order.
- A slide may therefore have: image left, image right, full-bleed background,
  text over image, two images side by side, no image at all, different button
  counts, different colours — with no shared template.
- Provide **starter layouts** for a new slide (the common arrangements), but they
  are only a starting point and are fully editable afterwards.
- Carousel-level settings: autoplay on/off, interval, transition (slide / fade),
  loop, arrows on/off and their style, dots on/off and their style, pause on
  hover, swipe on touch, and slides-per-view with a responsive override.
- Keep it accessible: real `<button>` controls, `aria-roledescription="carousel"`,
  slide labels, keyboard arrow navigation, and respect
  `prefers-reduced-motion` by disabling autoplay.

---

## 6. Part D — Images and cropping

Every image field must open an editor, not just a URL picker.

- **Crop** with a draggable, resizable crop box over the image.
- **Aspect ratio presets**: free, original, 1:1, 4:3, 3:2, 16:9, 3:4, 2:3, 9:16,
  plus a custom numeric ratio.
- **Zoom** slider, **rotate** in 90° steps, **flip** horizontal/vertical, and a
  **straighten** control for fine rotation.
- A **focal point** picker: the owner clicks the part of the image that must stay
  visible, and any `object-fit: cover` rendering uses it as `object-position`.
- **Non-destructive**: store the crop as `{ x, y, width, height, rotation, zoom,
  flipH, flipV, focalX, focalY }` alongside the source URL, so the original is
  never lost and the crop can be reopened and changed.
- Prefer rendering the crop through Cloudinary transformation parameters rather
  than re-uploading; fall back to a canvas-rendered derivative only when a
  transformation cannot express it.
- Also expose: alt text (required for accessibility, warn when empty), caption,
  link target, lazy-loading, and a responsive `sizes` hint.
- Show the resulting file size and dimensions so owners do not ship 4 MB heroes.

---

## 7. Part E — The product card designer

Product cards appear in grids, carousels and sections. Their design must be
authored once and reused.

- A **card template editor**: choose which elements appear and in what order —
  image, badge, category, title, author/brand, rating, price, compare-at price,
  short description, stock state, variant swatches, quantity input, primary
  button, wishlist button, compare button, quick-view button.
- **Layout variants**: image on top, image left, overlay (text on the image),
  minimal (image + title + price).
- **Image behaviour**: aspect ratio, fit (cover/contain), background, hover
  effect (zoom, swap to the second image, none).
- **Style controls**: alignment, spacing, typography per element, colours,
  border, radius, shadow, and hover states for the card and the button.
- **Badges**: sale, new, out of stock, low stock, custom text; with rules such as
  "New if created within N days" and "Low stock under N units".
- Templates are **saved and named**, then selected by any grid or carousel block.
  Editing a template updates every place that uses it.
- Provide 3–4 sensible presets out of the box.

---

## 8. Part F — Sections and choosing which products they show

Every product-bearing block shares one **data source** control.

- **Source modes**: entire catalogue, one category (or several), by tag or
  attribute, hand-picked products, newest, best selling, on sale, in stock only,
  featured, related to the current product, recently viewed.
- **Hand-picked** mode: a searchable list with checkboxes and — importantly —
  **drag-to-reorder**, because the chosen order is the display order.
- **Sorting** for non-manual modes: newest, oldest, price ascending/descending,
  name, best selling, random.
- **Limits**: how many to show, how many to skip, and a maximum.
- **Empty state**: what to render when the query returns nothing — hide the
  section, show a message, or fall back to another source.
- The picker must be fed by the live tenant catalogue, paginated and searchable,
  so it stays usable with thousands of products.

Grid presentation: columns per breakpoint, gap, rows, and a pagination mode —
numbered pages, load more, or infinite scroll.

---

## 9. Part G — Catalogue pages and a dynamic filter builder

Not only the front page. The owner must be able to build pages such as "All
books" and attach filters to them.

### The filter builder

A **Filters** block that the owner composes from filter widgets. Each widget
binds to a real catalogue property and is configured, not coded.

Widget types:

| Widget | Use |
| --- | --- |
| Search text | free-text match on title, author, description, SKU |
| Checkbox list | multi-select over categories, tags, attributes |
| Radio list | single-select |
| Dropdown | single or multi-select, searchable when long |
| Range slider | price, page count, year — with min/max/step and live numeric inputs |
| Rating filter | minimum star rating |
| Toggle / switch | in stock only, on sale, free shipping |
| Colour / swatch | attribute values rendered as swatches |
| Date range | publication date |
| Sort control | the sort dropdown as its own widget |
| Active-filter chips | shows what is applied, each removable, plus Clear all |

Per-widget configuration: label, which field it binds to, default value,
collapsed/expanded, show counts next to options, hide options with zero results,
limit visible options with a "show more", and visibility per breakpoint.

### Dynamic behaviour

- Option lists and slider bounds are **derived from the live catalogue**, never
  hardcoded — categories, attribute values and the real min/max price.
- Filters must be **combinable** and reflected in the **URL query string**, so a
  filtered view is shareable, bookmarkable and survives a refresh and the back
  button.
- Result counts update as filters change; show a skeleton while loading.
- Layout options: filters in a left sidebar, a right sidebar, a horizontal bar
  above the grid, or a slide-over drawer on mobile.
- The grid and the card template used on the results are chosen with the same
  controls as everywhere else.
- Server-side filtering with proper indexes. Do not ship the whole catalogue to
  the browser and filter it there.

---

## 10. Part H — Input fields

The owner must be able to place and configure input fields, with their
descriptive information.

- **Field types**: single-line text, multi-line text, email, phone, number,
  date, time, dropdown, radio group, checkbox group, single checkbox (consent),
  file upload, hidden field, rating, range.
- **Per-field configuration**: label, name/key, placeholder, help text shown
  under the field, default value, required flag, min/max length, min/max value,
  pattern, options list (label + value, reorderable by drag), and column width so
  fields can sit side by side.
- **Validation feedback**: per-field error message text, validated inline in the
  browser.
- **Style controls** consistent with the rest of the builder: label position,
  spacing, typography, borders, focus state.

**Explicitly out of scope for now:** submission handling — where the data goes,
email delivery, storage, spam protection, integrations. Build the fields and
their configuration only. Leave a clean seam (a documented payload shape and a
single submit entry point) so submission handling can be added later without
reworking the field model.

---

## 11. Part I — Responsive and style system

- Every spacing, size, alignment and visibility control accepts a **per-breakpoint
  override** (desktop / tablet / mobile), with values inheriting downward unless
  overridden, and a visible marker on any control that has an override.
- A shared style panel across rows, columns and modules: typography (family,
  size, weight, line height, letter spacing, transform), colours with theme
  palette swatches, background (colour, gradient, image with crop and focal
  point), border, radius, shadow, padding, margin, and hover states.
- Colour pickers must offer the tenant's **theme palette** first
  (the `--cms-*` variables) so pages stay consistent, with a custom colour as an
  escape hatch.
- Custom CSS class and ID fields per element, and an optional custom CSS box
  scoped to the element.

---

## 12. Data model guidance

- Keep layouts in `cms_pages.blocks` as JSON, but move from a flat block list to
  a nested `rows → columns → modules` tree. Write a **migration that lifts every
  existing flat block into a single-column row**, and keep `normalizeBlocks`
  tolerant so old documents never break.
- Every node: stable `id`, `type`, `props`, `children`, and `responsive`
  overrides keyed by breakpoint.
- Store reusable things in their own tables: card templates, saved rows/modules,
  page templates, and filter presets.
- Validate and normalise everything read from JSON. Unknown types are dropped,
  missing props fall back to `defaultProps()`. Treat stored JSON as untrusted.
- Add revisions: keep the last N versions of a page's layout with a timestamp and
  author, restorable from the editor.

---

## 13. Non-negotiables

- **Accessibility**: real semantic elements, keyboard operation for every
  editor action including drag (dnd-kit's keyboard sensor), visible focus,
  correct ARIA on carousels and drawers, and respect for
  `prefers-reduced-motion`.
- **Performance**: the storefront must stay server-rendered where possible;
  ship interactivity only where needed. Images responsive and lazy. The editor
  must stay responsive with 100+ modules on a page.
- **Multi-tenancy**: all data access through `getContextDb()` /
  `getContextCompany()`. Never leak one tenant's media, products or pages into
  another.
- **Security**: sanitise any HTML the owner authors before rendering it; never
  interpolate user input into SQL; validate uploads by type and size.
- **No regressions**: existing pages and the `/home` front page must keep
  rendering throughout. Ship behind a flag if needed.

---

## 14. Suggested phasing

1. Layout tree (rows/columns/modules) + migration + column resizing.
2. Editing shell: full-viewport canvas, top bar, right panel with Modules and
   Rows tabs, inline hover toolbars, undo/redo.
3. Image editor with cropping and focal point.
4. Product card designer + data-source control shared by all product blocks.
5. Catalogue pages and the dynamic filter builder with URL state.
6. Per-slide carousel layouts.
7. Input fields (configuration only).
8. Templates, saved modules, revisions, autosave.

---

## 15. Acceptance criteria

A shop owner, without touching code, can:

1. Build the front page from scratch: add rows, split them into columns, drop
   modules in, drag them between columns, and resize columns.
2. Create a hero carousel where slide 1 is image-left, slide 2 is a full-bleed
   background with centred text, and slide 3 has two images and no button.
3. Crop a product photo to 4:3, set its focal point, and see the same crop on the
   storefront without the original being altered.
4. Design a product card template, save it, and apply it to three different
   sections at once.
5. Build an "All books" page with a price range slider, a category checkbox list
   with result counts, an in-stock toggle, a search box and a sort dropdown —
   then share the filtered URL with a colleague who opens the same view.
6. Place a contact form's fields with labels, help text and validation rules
   (submission handling deliberately deferred).
7. Adjust any spacing or visibility for mobile only, and confirm it in the
   breakpoint preview.
8. Undo a mistake, restore a previous revision, and publish.
