# Inkdrop theme desk

**Date:** 2026-08-19
**Status:** Draft for user review (scope locked in conversation; not yet implemented)
**Surface:** Appearance theme `inkdrop` only. Three-pane shell already exists for every theme.
**Visual reference:** `.impeccable/mocks/decision/canon-inkdrop-ref.png` (Inkdrop Desktop demo screenshot — visual reference, not a product claim)

This spec turns the existing **Inkdrop color preset** into a full night-desk chrome: list cards, cyan selection, magenta titles, gothic UI type. Mocha remains the shipped default. Struck / Tensegrity keep today’s chrome and only swap palettes.

## Goal

When the user picks **Settings → Color theme → Inkdrop**, Daily Routine should read as an Inkdrop-like three-pane notes desk with Daily Routine flavor — not Mocha with cyan swapped in.

Success looks like:

- Mocha / Struck / Tensegrity / Latte / etc. still open as they do today (JetBrains + current list rows + current editor title color).
- Selecting Inkdrop pairs **Inter** + **Inkdrop code theme**, restyles the three panes, and shows note cards (title, relative time, type pill, snippet).
- Selected list row uses a cyan wash and a 2px cyan left hairline (`--ctp-sky`).
- Note title in the editor is magenta (`--ctp-pink`). Markdown headings and list markers already follow Inkdrop tokens.
- Flavor, not a clone: type pills replace Inkdrop’s Active / On Hold statuses; properties rail stays; no traffic lights, tags sidebar, or “Synced at”.

## Non-goals

- Do not change the default `colorTheme` / `fontTheme` / `codeTheme` (`mocha` / `jetbrains` / `mocha`).
- Do not build a second `AppShell`. One React tree; Inkdrop is CSS + list metadata + font pairing.
- Do not copy macOS window controls, Inkdrop Status/Tags sections, pin icons, or sync footer.
- Do not add editor line numbers or an active-line highlight in this pass.
- Do not hide or relocate the properties right rail. Quiet it under Inkdrop (no mauve shout), keep it.
- Do not restyle Struck / Tensegrity chrome beyond the palettes they already have.
- Do not load full note bodies into the workspace tree. Only a short excerpt string.
- Do not mention “Inkdrop” in the running UI copy (sidebar, list, editor). The name stays in Settings only.

## Current behavior (what this extends)

- `src/components/app-shell.tsx` is already nav | note list | page. Chat and Graph hide the list.
- `src/components/note-list-pane.tsx` shows title + a mono type label. Selected row uses `.note-list-row[aria-current="page"]` with `inset 2px` of `--ctp-mauve`.
- `[data-theme="inkdrop"]` in `src/app/globals.css` already sets charcoal surfaces, cyan mauve/peach/sky, pink headings, cyan list/link tokens.
- `appearanceForColorTheme` already pairs Inkdrop → `codeTheme: "inkdrop"`. It does **not** pair Inter.
- `loadWorkspaceTree` does not select `body` or `updatedAt`, so the list cannot show snippets or relative time.
- Root layout sets `data-theme` / `data-code-theme` from saved appearance.

## Approach

Theme-scoped restyle (locked): same components for every theme. Inkdrop-only look lives in:

1. `[data-theme="inkdrop"]` CSS for chrome, cards, title, selection, quieter properties heading.
2. `appearanceForColorTheme(..., "inkdrop")` also applying the Inter font preset.
3. Tree notes carrying `updatedAt` + `excerpt` so the list can render cards. Extra lines are **hidden unless** `data-theme="inkdrop"` so Mocha’s list stays a compact title + type row.

## Data

### Workspace tree

Extend `FolderNoteRow` / `FolderTreeNote` in `src/lib/workspace/tree.ts`:

- `updatedAt: Date` (from `notes.updated_at`)
- `excerpt: string` (computed, never the raw body)

`loadWorkspaceTree` (`src/lib/workspace/folders.ts`) selects `updatedAt` and `body`. `assembleFolderTree` stores only `excerpt: noteListExcerpt(body)`, not `body`.

`noteListExcerpt(body: string): string` in `src/lib/ui/notebook.ts` (pure):

1. Strip fenced code (` ``` ` … ` ``` `).
2. Strip markdown heading marks, emphasis, links (`[text](url)` → `text`), and wikilink punctuation.
3. Collapse whitespace to single spaces.
4. Trim to 100 characters; if truncated, end with `…`.
5. Empty body → `""`.

Tests in `src/lib/ui/notebook.test.ts` cover empty, heading + paragraph, and truncation.

`assembleFolderTree` tests gain `updatedAt` + `excerpt` (or `body` on the row input). Existing href assertions stay.

### List sort

- Default (every theme except Inkdrop): keep current title order (`collectFolderNotes` as assembled).
- Inkdrop: sort that list by `updatedAt` descending, then title.

`NoteListPane` receives `colorTheme` from `AppShell`. `AppShell` receives it from root layout (`loadAppearance().colorTheme`). Do not read `document.documentElement` (avoids SSR/hydration sort flicker).

### Relative time

Pure helper `formatNoteListTime(updatedAt: Date, now: Date): string` in `src/lib/ui/notebook.ts`:

- `< 60s` → `just now`
- `< 60m` → `N min`
- `< 24h` → `N hours` (or `1 hour`)
- `< 7d` → `N days` (or `1 day`)
- else → `YYYY-MM-DD` in local calendar (no extra timezone library)

Tests with a fixed `now`.

## Chrome (Inkdrop only)

All selectors below are under `[data-theme="inkdrop"]` unless noted. Use existing `--ctp-*` tokens. No hardcoded Inkdrop hex in components.

### Type pairing

`appearanceForColorTheme(current, "inkdrop")` returns Inter stacks via `appearanceForFontTheme` (or equivalent spread of `FONT_PRESETS.inter`) plus `codeTheme: "inkdrop"`.

Selecting a non-Inkdrop color theme does **not** revert the font. User can switch Font theme independently. Tests: Inkdrop → Inter + inkdrop code; mocha from default stays jetbrains/mocha.

### Left sidebar

Do not change sidebar JSX in a way that restyles Mocha. Target existing nodes with `[data-theme="inkdrop"]`.

- UI type is Inter (from appearance pairing).
- “Notebooks” kicker: 11px gothic, `text-ctp-overlay0`, normal case tracking — override the mono uppercase classes in CSS only.
- Selected nav / folder: surface wash. Current `bg-ctp-surface0` is enough once mauve is cyan.
- Footer **New** control: rectangular ghost (`background: transparent`, `border: 1px solid var(--ctp-surface0)`), not the filled rounded-full. Same `createNewFile` action. Add a stable class if the footer button is too generic to select (`sidebar-new-note`).
- Do not add Status / Tags blocks.
- Do not add a second New control in the list header.

### Middle list

Card markup in `note-list-pane.tsx` (all themes, visibility via CSS):

- Title (one line, truncate).
- Meta row (`.note-list-meta`): relative time · type pill.
- Snippet (`.note-list-excerpt`): excerpt or omit the node if empty.

CSS:

- Non-Inkdrop: `.note-list-meta` and `.note-list-excerpt` `display: none`. Keep today’s title + existing type line **or** restyle the existing type line as the only subtitle and hide the new meta. Pick one: **hide `.note-list-meta` and `.note-list-excerpt` outside Inkdrop; keep the current mono type subtitle for other themes** so Mocha does not lose its type label.
- Inkdrop: hide the old mono type subtitle (`.note-list-type`). Show meta + excerpt. Type pill colors:

  | type | label | token |
  |------|--------|--------|
  | problem | DSA | `--ctp-sky` |
  | pattern | Pattern | `--ctp-pink` |
  | lld | LLD | `--ctp-yellow` |
  | hld | HLD | `--ctp-green` |
  | ai | AI | `--ctp-lavender` |
  | note | Note | `--ctp-overlay0` |

  Pill: 2px colored dot + label, not a heavy filled chip.

- Inkdrop selected row: `background: color-mix(in srgb, var(--ctp-sky) 14%, var(--ctp-surface0))`; `box-shadow: inset 2px 0 0 var(--ctp-sky)`. Override the global mauve tick for this theme only.
- Hairline dividers between rows (`border-b border-ctp-surface0`).
- Header: notebook name + count (keep). Search stays rounded. Placeholder `Search` under Inkdrop; keep `Filter` on other themes (class or theme prop).
- List pane header: notebook name, count, search only. No second New button.

### Right editor

- `input[aria-label="Title"]` color `--ctp-pink` (already intended earlier; restore under Inkdrop only).
- Markdown tokens already set (`--md-h1-color` pink, list/link sky). Confirm `.markdown` list markers pick up `--md-list-color` in source mode if the block editor uses those classes; if source mode is a contenteditable without `.markdown`, do not invent a second highlighter in this pass.
- Properties heading: `text-ctp-overlay0` instead of `text-ctp-mauve` under Inkdrop (CSS or a shared class). Do not change properties behavior.

### Panes

- Separators stay 1px `surface0` value-shift, not heavy drop shadows.
- No fake rounded macOS window around the app.

## Error handling

- Missing `updatedAt`: treat as epoch and show `YYYY-MM-DD` from the helper (should not happen; column is `NOT NULL`).
- Excerpt helper must not throw on malformed fences; leftover text is fine.
- Tree select failure: unchanged (existing workspace load). Do not add a list-specific error UI.

## Testing

- `noteListExcerpt`: empty, `# Heading\n\nBody text`, truncation at 100, wikilink `[[Foo]]` → `Foo`.
- `formatNoteListTime`: the five buckets above with a frozen `now`.
- `assembleFolderTree`: passes through `excerpt` / `updatedAt`.
- `appearanceForColorTheme(..., "inkdrop")`: `fontTheme === "inter"`, `codeTheme === "inkdrop"`, `uiFont` contains `--font-inter`.
- `appearanceForColorTheme(..., "mocha")` from defaults: still `jetbrains` / `mocha`.
- Existing notebook, tree, and appearance tests updated for extra fields; no snapshot of CSS.

Manual check after implement: Settings → Inkdrop → open a DSA note → list card + cyan selection + magenta title. Settings → Mocha → compact list, JetBrains (if the user did not change font before switching back — if they picked Inkdrop then Mocha, font stays Inter until they change Font theme; that is specified).

## Files (expected)

- `src/lib/appearance.ts` — pair Inter on Inkdrop
- `src/lib/appearance.test.ts`
- `src/lib/workspace/tree.ts` — note fields
- `src/lib/workspace/folders.ts` — select body + updatedAt
- `src/lib/workspace/tree.test.ts` — extra fields on fixtures
- `src/lib/ui/notebook.ts` — excerpt + relative time
- `src/lib/ui/notebook.test.ts`
- `src/app/layout.tsx` / `src/components/app-shell.tsx` / `src/components/note-list-pane.tsx` — pass `colorTheme`, card markup, Inkdrop sort
- `src/components/app-sidebar.tsx` — `sidebar-new-note` class on the footer button only (no Mocha visual change)
- `src/app/globals.css` — Inkdrop chrome rules
- `src/app/components/appearance-settings.tsx` — no new picker; pairing already goes through `appearanceForColorTheme`

## Out of this spec

Chat, Graph, Today logging, Struck/Tensegrity as desks, DESIGN.md rewrite (`/impeccable document` later if asked).
