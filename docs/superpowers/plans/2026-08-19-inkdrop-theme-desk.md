# Inkdrop Theme Desk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the user picks the Inkdrop color theme, restyle the existing three-pane shell into an Inkdrop-like notes desk (Inter, cyan selection, magenta title, list cards) without changing Mocha as the default or cloning a second AppShell.

**Architecture:** One React tree. `noteListExcerpt` / `formatNoteListTime` / `sortFolderNotes` are pure helpers. `loadWorkspaceTree` maps `body` → `excerpt` at the DB boundary so the client tree never holds full bodies. Inkdrop chrome is `[data-theme="inkdrop"]` CSS plus `colorTheme` passed from layout → AppShell → NoteListPane for sort and the Search placeholder. `appearanceForColorTheme("inkdrop")` also applies the Inter font preset.

**Tech Stack:** Next.js 16 App Router, React 19 client panes, Drizzle/Postgres notes (`body`, `updated_at`), Vitest, existing `--ctp-*` tokens.

## Global Constraints

- Default appearance stays `colorTheme: "mocha"`, `fontTheme: "jetbrains"`, `codeTheme: "mocha"`.
- Do not build a second AppShell. Do not mention “Inkdrop” in sidebar, list, or editor copy (Settings picker only).
- Do not copy traffic lights, Status/Tags, pin icons, sync footer, line numbers, or active-line highlight.
- Do not load full note bodies into `FolderTreeNote`. Only `excerpt`.
- Do not restyle Struck / Tensegrity chrome beyond existing palettes.
- Selecting a non-Inkdrop color theme does not revert the font.
- Properties rail stays; quieter heading under Inkdrop only.
- No hardcoded Inkdrop hex in components — tokens only.
- Do not commit unless the user explicitly asks.

## File map

| File | Responsibility |
|---|---|
| `src/lib/ui/notebook.ts` | `noteListExcerpt`, `formatNoteListTime`, `sortFolderNotes` |
| `src/lib/ui/notebook.test.ts` | Excerpt, time, sort, existing folder helpers |
| `src/lib/appearance.ts` | Pair Inter when color theme is Inkdrop |
| `src/lib/appearance.test.ts` | Inkdrop → Inter + inkdrop code; mocha from defaults unchanged |
| `src/lib/workspace/tree.ts` | `updatedAt` + `excerpt` on note types; pass-through in assemble |
| `src/lib/workspace/folders.ts` | Select `body` + `updatedAt`; map to excerpt before assemble |
| `src/lib/workspace/tree.test.ts` | Fixtures include the new fields |
| `src/app/layout.tsx` | Pass `colorTheme` into AppShell |
| `src/components/app-shell.tsx` | Forward `colorTheme` to NoteListPane |
| `src/components/note-list-pane.tsx` | Cards, Inkdrop sort, Search vs Filter |
| `src/components/app-sidebar.tsx` | `sidebar-new-note` + `sidebar-notebooks-kicker` classes |
| `src/app/components/note-editor.tsx` | `note-properties-heading` class on Properties button |
| `src/app/globals.css` | Inkdrop-only chrome |

Compute excerpt in `loadWorkspaceTree`, not inside `assembleFolderTree`, so `notebook.ts` does not import into `tree.ts` (cycle: notebook already imports tree types).

---

### Task 1: List text helpers

**Files:**
- Modify: `src/lib/ui/notebook.ts`
- Test: `src/lib/ui/notebook.test.ts`

**Interfaces:**
- Consumes: `FolderTreeNote` from `@/lib/workspace/tree` (will gain `updatedAt`/`excerpt` in Task 3; for this task add those fields on the type first if tests fail to compile, or use a local fixture type — **do Task 3 types in the same change as the first compile of `sortFolderNotes`**). Prefer: implement helpers that only need `string`/`Date` first (`noteListExcerpt`, `formatNoteListTime`), then add `sortFolderNotes` after Task 3. This task is excerpt + time only.
- Produces:
  - `noteListExcerpt(body: string): string`
  - `formatNoteListTime(updatedAt: Date, now: Date): string`

- [ ] **Step 1: Write failing tests** at the bottom of `src/lib/ui/notebook.test.ts`:

```ts
import { noteListExcerpt, formatNoteListTime } from "./notebook";

describe("noteListExcerpt", () => {
  it("returns empty for empty body", () => {
    expect(noteListExcerpt("")).toBe("");
    expect(noteListExcerpt("   \n")).toBe("");
  });

  it("strips a heading and keeps paragraph text", () => {
    expect(noteListExcerpt("# Heading\n\nBody text")).toBe("Heading Body text");
  });

  it("truncates at 100 characters with an ellipsis", () => {
    const body = "a".repeat(120);
    const next = noteListExcerpt(body);
    expect(next.length).toBe(101);
    expect(next.endsWith("…")).toBe(true);
    expect(next.slice(0, 100)).toBe("a".repeat(100));
  });

  it("unwraps wikilinks", () => {
    expect(noteListExcerpt("See [[Foo]] next")).toBe("See Foo next");
  });

  it("drops fenced code and markdown links", () => {
    expect(
      noteListExcerpt("Intro\n```\nsecret()\n```\n[click](https://x.test)"),
    ).toBe("Intro click");
  });
});

describe("formatNoteListTime", () => {
  const now = new Date("2026-08-19T12:00:00.000Z");

  it("uses just now under 60 seconds", () => {
    expect(
      formatNoteListTime(new Date("2026-08-19T11:59:30.000Z"), now),
    ).toBe("just now");
  });

  it("uses N min under 60 minutes", () => {
    expect(
      formatNoteListTime(new Date("2026-08-19T11:10:00.000Z"), now),
    ).toBe("50 min");
  });

  it("uses 1 hour or N hours under 24 hours", () => {
    expect(
      formatNoteListTime(new Date("2026-08-19T11:00:00.000Z"), now),
    ).toBe("1 hour");
    expect(
      formatNoteListTime(new Date("2026-08-19T09:00:00.000Z"), now),
    ).toBe("3 hours");
  });

  it("uses 1 day or N days under 7 days", () => {
    expect(
      formatNoteListTime(new Date("2026-08-18T12:00:00.000Z"), now),
    ).toBe("1 day");
    expect(
      formatNoteListTime(new Date("2026-08-16T12:00:00.000Z"), now),
    ).toBe("3 days");
  });

  it("uses local YYYY-MM-DD at 7 days or older", () => {
    const updatedAt = new Date("2026-08-01T12:00:00.000Z");
    const y = updatedAt.getFullYear();
    const m = String(updatedAt.getMonth() + 1).padStart(2, "0");
    const d = String(updatedAt.getDate()).padStart(2, "0");
    expect(formatNoteListTime(updatedAt, now)).toBe(`${y}-${m}-${d}`);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/lib/ui/notebook.test.ts`

Expected: FAIL — `noteListExcerpt` / `formatNoteListTime` are not exported.

- [ ] **Step 3: Implement** in `src/lib/ui/notebook.ts`:

```ts
export function noteListExcerpt(body: string): string {
  let text = body.replace(/```[\s\S]*?```/g, " ");
  text = text.replace(/^#{1,6}\s+/gm, "");
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  text = text.replace(/\[\[([^\]]+)\]\]/g, "$1");
  text = text.replace(/[*_~`]+/g, "");
  text = text.replace(/\s+/g, " ").trim();
  if (text.length <= 100) return text;
  return `${text.slice(0, 100)}…`;
}

export function formatNoteListTime(updatedAt: Date, now: Date): string {
  const ms = Math.max(0, now.getTime() - updatedAt.getTime());
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)} min`;
  if (ms < 86_400_000) {
    const hours = Math.floor(ms / 3_600_000);
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  if (ms < 7 * 86_400_000) {
    const days = Math.floor(ms / 86_400_000);
    return days === 1 ? "1 day" : `${days} days`;
  }
  const y = updatedAt.getFullYear();
  const m = String(updatedAt.getMonth() + 1).padStart(2, "0");
  const d = String(updatedAt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
```

Do not throw on malformed fences (unclosed ` ``` ` simply does not match).

- [ ] **Step 4: Re-run** `npx vitest run src/lib/ui/notebook.test.ts`

Expected: PASS

- [ ] **Step 5: Skip commit** (user constraint).

---

### Task 2: Pair Inter when selecting Inkdrop

**Files:**
- Modify: `src/lib/appearance.ts` (`appearanceForColorTheme`)
- Test: `src/lib/appearance.test.ts`

**Interfaces:**
- Consumes: `appearanceForFontTheme`, `FONT_PRESETS.inter` (already in this file)
- Produces: `appearanceForColorTheme(current, "inkdrop")` sets `fontTheme: "inter"`, Inter font stacks, `codeTheme: "inkdrop"`. Mocha from `defaultAppearance()` stays jetbrains/mocha.

- [ ] **Step 1: Extend the existing `appearanceForColorTheme` describe** in `src/lib/appearance.test.ts`:

```ts
  it("pairs Inkdrop with Inter and the Inkdrop code theme", () => {
    const next = appearanceForColorTheme(defaultAppearance(), "inkdrop");
    expect(next.colorTheme).toBe("inkdrop");
    expect(next.fontTheme).toBe("inter");
    expect(next.codeTheme).toBe("inkdrop");
    expect(next.uiFont).toContain("--font-inter");
  });

  it("does not revert font when switching to mocha", () => {
    const inkdrop = appearanceForColorTheme(defaultAppearance(), "inkdrop");
    const mocha = appearanceForColorTheme(inkdrop, "mocha");
    expect(mocha.colorTheme).toBe("mocha");
    expect(mocha.fontTheme).toBe("inter");
    expect(mocha.uiFont).toContain("--font-inter");
  });
```

Keep the existing mocha-from-defaults assertion (`codeTheme` mocha). Add:

```ts
    expect(appearanceForColorTheme(defaultAppearance(), "mocha").fontTheme).toBe(
      "jetbrains",
    );
```

inside the existing "pairs studio palettes" test or as its own `it`.

- [ ] **Step 2: Run** `npx vitest run src/lib/appearance.test.ts`

Expected: FAIL — Inkdrop still leaves `fontTheme` as jetbrains.

- [ ] **Step 3: Change** `appearanceForColorTheme` in `src/lib/appearance.ts` to:

```ts
export function appearanceForColorTheme(
  current: AppearanceSettings,
  colorTheme: ColorTheme,
): AppearanceSettings {
  const codeTheme = COLOR_CODE[colorTheme];
  const withColor = {
    ...current,
    colorTheme,
    ...(codeTheme ? { codeTheme } : {}),
  };
  if (colorTheme === "inkdrop") {
    return appearanceForFontTheme(withColor, "inter");
  }
  return withColor;
}
```

- [ ] **Step 4: Re-run** `npx vitest run src/lib/appearance.test.ts`

Expected: PASS (including mocha-from-defaults still jetbrains).

- [ ] **Step 5: Skip commit**.

---

### Task 3: Tree notes carry `updatedAt` and `excerpt`

**Files:**
- Modify: `src/lib/workspace/tree.ts`
- Modify: `src/lib/workspace/folders.ts`
- Modify: `src/lib/workspace/tree.test.ts`
- Modify: `src/lib/ui/notebook.test.ts` (fixtures)
- Test: `src/lib/workspace/tree.test.ts`

**Interfaces:**
- Consumes: `noteListExcerpt(body: string): string` from `@/lib/ui/notebook`
- Produces:

```ts
export type FolderNoteRow = {
  id: string;
  title: string;
  slug: string;
  type: string;
  folderId: string | null;
  updatedAt: Date;
  excerpt: string;
};

export type FolderTreeNote = {
  id: string;
  title: string;
  slug: string;
  type: string;
  href: string;
  updatedAt: Date;
  excerpt: string;
};
```

`assembleFolderTree` copies `updatedAt` and `excerpt` onto each `FolderTreeNote`. It never stores `body`.

- [ ] **Step 1: Update fixtures** so existing tests compile after the type change. Use one shared timestamp:

```ts
const AT = new Date("2026-08-01T00:00:00.000Z");
```

Every `assembleFolderTree` note object in `src/lib/workspace/tree.test.ts` and `src/lib/ui/notebook.test.ts` gains `updatedAt: AT, excerpt: ""`.

Add assertion in `src/lib/workspace/tree.test.ts` inside the existing assemble test, after the Two Sum href check:

```ts
    expect(tree[0]?.notes[0]).toMatchObject({
      title: "Two Sum",
      href: "/dsa/two-sum",
      excerpt: "brute force then hash map",
      updatedAt: AT,
    });
```

Set that note’s fixture `excerpt: "brute force then hash map"` (assemble is pass-through; do not call `noteListExcerpt` inside assemble).

- [ ] **Step 2: Run** `npx vitest run src/lib/workspace/tree.test.ts src/lib/ui/notebook.test.ts`

Expected: FAIL — types missing `updatedAt`/`excerpt`, or pass-through not implemented.

- [ ] **Step 3: Extend types and mapping** in `src/lib/workspace/tree.ts`. In the `notesByFolder` loop, push:

```ts
    list.push({
      id: note.id,
      title: note.title,
      slug: note.slug,
      type: note.type,
      href: noteHref(note.type, note.slug),
      updatedAt: note.updatedAt,
      excerpt: note.excerpt,
    });
```

In `src/lib/workspace/folders.ts`:

```ts
import { noteListExcerpt } from "@/lib/ui/notebook";
```

Change the notes select + map:

```ts
    db
      .select({
        id: notes.id,
        title: notes.title,
        slug: notes.slug,
        type: notes.type,
        folderId: notes.folderId,
        updatedAt: notes.updatedAt,
        body: notes.body,
      })
      .from(notes)
      .orderBy(asc(notes.title)),
```

Then:

```ts
  return assembleFolderTree(
    folderRows,
    noteRows.map((row) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      type: row.type,
      folderId: row.folderId,
      updatedAt: row.updatedAt,
      excerpt: noteListExcerpt(row.body),
    })),
  );
```

- [ ] **Step 4: Re-run** `npx vitest run src/lib/workspace/tree.test.ts src/lib/ui/notebook.test.ts src/lib/workspace/move.test.ts`

Expected: PASS (`move.test.ts` uses `assembleFolderTree(folders, [])` — still valid).

- [ ] **Step 5: Skip commit**.

---

### Task 4: Sort helper, cards, and `colorTheme` plumbing

**Files:**
- Modify: `src/lib/ui/notebook.ts`
- Modify: `src/lib/ui/notebook.test.ts`
- Modify: `src/app/layout.tsx`
- Modify: `src/components/app-shell.tsx`
- Modify: `src/components/note-list-pane.tsx`

**Interfaces:**
- Consumes: `FolderTreeNote.updatedAt` / `.excerpt`; `ColorTheme` from `@/lib/appearance`
- Produces:

```ts
export function sortFolderNotes(
  notes: FolderTreeNote[],
  colorTheme: ColorTheme,
): FolderTreeNote[]
```

- Mocha: return `notes` in the same order (do not copy-sort).
- Inkdrop: new array, `updatedAt` descending, then `title.localeCompare`.

`NoteListPane({ folder, pathname, colorTheme }: { folder: FolderTreeNode | null; pathname: string; colorTheme: ColorTheme })`

`AppShell` adds `colorTheme: ColorTheme` and passes it to `NoteListPane`.

Root layout: `<AppShell appName={appName} tree={tree} colorTheme={appearance.colorTheme}>`

- [ ] **Step 1: Failing sort tests** in `src/lib/ui/notebook.test.ts` (after Task 3 fixtures exist):

```ts
import { sortFolderNotes } from "./notebook";

describe("sortFolderNotes", () => {
  const older = {
    id: "a",
    title: "Alpha",
    slug: "alpha",
    type: "note",
    href: "/notes/alpha",
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    excerpt: "",
  };
  const newer = {
    ...older,
    id: "b",
    title: "Beta",
    slug: "beta",
    href: "/notes/beta",
    updatedAt: new Date("2026-08-19T00:00:00.000Z"),
  };

  it("keeps given order for mocha", () => {
    const input = [older, newer];
    expect(sortFolderNotes(input, "mocha")).toBe(input);
    expect(sortFolderNotes(input, "mocha").map((n) => n.id)).toEqual(["a", "b"]);
  });

  it("sorts Inkdrop by updatedAt descending then title", () => {
    expect(
      sortFolderNotes([older, newer], "inkdrop").map((n) => n.id),
    ).toEqual(["b", "a"]);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/lib/ui/notebook.test.ts`

Expected: FAIL — `sortFolderNotes` not exported.

- [ ] **Step 3: Implement sort + wire UI.**

`src/lib/ui/notebook.ts`:

```ts
import type { ColorTheme } from "@/lib/appearance";

export function sortFolderNotes(
  notes: FolderTreeNote[],
  colorTheme: ColorTheme,
): FolderTreeNote[] {
  if (colorTheme !== "inkdrop") return notes;
  return [...notes].sort((a, b) => {
    const byTime = b.updatedAt.getTime() - a.updatedAt.getTime();
    if (byTime !== 0) return byTime;
    return a.title.localeCompare(b.title);
  });
}
```

`src/app/layout.tsx`: pass `colorTheme={appearance.colorTheme}`.

`src/components/app-shell.tsx`: add `colorTheme` to props (type `ColorTheme` from `@/lib/appearance`) and `<NoteListPane folder={selectedFolder} pathname={pathname} colorTheme={colorTheme} />`.

`src/components/note-list-pane.tsx` — replace the list body with:

```tsx
import type { ColorTheme } from "@/lib/appearance";
import {
  collectFolderNotes,
  formatNoteListTime,
  sortFolderNotes,
} from "@/lib/ui/notebook";

export function NoteListPane({
  folder,
  pathname,
  colorTheme,
}: {
  folder: FolderTreeNode | null;
  pathname: string;
  colorTheme: ColorTheme;
}) {
  const [query, setQuery] = useState("");
  const notes = useMemo(() => {
    if (!folder) return [];
    const all = sortFolderNotes(collectFolderNotes(folder), colorTheme);
    const needle = query.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((note) => note.title.toLowerCase().includes(needle));
  }, [folder, query, colorTheme]);

  // header placeholder:
  // placeholder={colorTheme === "inkdrop" ? "Search" : "Filter"}
  // sr-only: colorTheme === "inkdrop" ? "Search notes" : "Filter notes"
```

Each row `Link` keeps `className` including `note-list-row`. Inner markup:

```tsx
<span className="block truncate text-sm">{note.title}</span>
<span className="note-list-type mt-0.5 block font-mono text-[13px] text-ctp-overlay0">
  {TYPE_LABEL[note.type] ?? note.type}
</span>
<span className="note-list-meta mt-0.5 flex items-center gap-2 text-[12px] text-ctp-overlay0">
  <span>{formatNoteListTime(note.updatedAt, new Date())}</span>
  <span className="note-list-pill inline-flex items-center gap-1.5" data-note-type={note.type}>
    <span className="note-list-pill-dot h-1.5 w-1.5 rounded-full" aria-hidden="true" />
    {TYPE_LABEL[note.type] ?? note.type}
  </span>
</span>
{note.excerpt ? (
  <span className="note-list-excerpt mt-1 block truncate text-[12px] text-ctp-subtext0">
    {note.excerpt}
  </span>
) : null}
```

`li` gets `className="note-list-item"` for hairline borders in CSS.

Do not put hex colors in the component. `formatNoteListTime(..., new Date())` is correct at render; no timezone library.

- [ ] **Step 4: Run** `npx vitest run src/lib/ui/notebook.test.ts src/lib/workspace/tree.test.ts src/lib/appearance.test.ts`

Expected: PASS. `npx tsc --noEmit` (or the repo’s typecheck if different — use `npx tsc --noEmit` if no script) must succeed: AppShell callers all pass `colorTheme`.

- [ ] **Step 5: Skip commit**.

---

### Task 5: Inkdrop chrome CSS and hook classes

**Files:**
- Modify: `src/components/app-sidebar.tsx` (classes only)
- Modify: `src/app/components/note-editor.tsx` (class only)
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: `sidebar-new-note`, `sidebar-notebooks-kicker`, `note-properties-heading`, list classes from Task 4
- Produces: visual Inkdrop desk; Mocha unchanged

- [ ] **Step 1: Add stable classes** (no Mocha visual change).

Sidebar notebooks kicker (`src/components/app-sidebar.tsx`): add `sidebar-notebooks-kicker` to the existing `p` (`font-mono text-[10px] uppercase tracking-[0.16em] text-ctp-overlay0`).

Footer New button: add `sidebar-new-note` to the existing `className` string (keep `rounded-full bg-ctp-surface0`).

Properties button in `src/app/components/note-editor.tsx`: add `note-properties-heading` next to `font-mono text-xs uppercase tracking-wide text-ctp-mauve hover:text-ctp-lavender`.

- [ ] **Step 2: Append Inkdrop chrome** in `src/app/globals.css` immediately after the existing `[data-theme="inkdrop"] { … }` token block (before the tensegrity note-list override). Do not remove the token block.

```css
.note-list-meta,
.note-list-excerpt {
  display: none;
}

[data-theme="inkdrop"] .note-list-type {
  display: none;
}

[data-theme="inkdrop"] .note-list-meta,
[data-theme="inkdrop"] .note-list-excerpt {
  display: flex;
}

[data-theme="inkdrop"] .note-list-excerpt {
  display: block;
}

[data-theme="inkdrop"] .note-list-item + .note-list-item {
  border-top: 1px solid var(--ctp-surface0);
}

[data-theme="inkdrop"] .note-list-row[aria-current="page"] {
  background: color-mix(in srgb, var(--ctp-sky) 14%, var(--ctp-surface0));
  box-shadow: inset 2px 0 0 var(--ctp-sky);
}

[data-theme="inkdrop"] .note-list-pill-dot {
  background: var(--ctp-overlay0);
}

[data-theme="inkdrop"] .note-list-pill[data-note-type="problem"] .note-list-pill-dot {
  background: var(--ctp-sky);
}

[data-theme="inkdrop"] .note-list-pill[data-note-type="pattern"] .note-list-pill-dot {
  background: var(--ctp-pink);
}

[data-theme="inkdrop"] .note-list-pill[data-note-type="lld"] .note-list-pill-dot {
  background: var(--ctp-yellow);
}

[data-theme="inkdrop"] .note-list-pill[data-note-type="hld"] .note-list-pill-dot {
  background: var(--ctp-green);
}

[data-theme="inkdrop"] .note-list-pill[data-note-type="ai"] .note-list-pill-dot {
  background: var(--ctp-lavender);
}

[data-theme="inkdrop"] input[aria-label="Title"] {
  color: var(--ctp-pink);
}

[data-theme="inkdrop"] .note-properties-heading {
  color: var(--ctp-overlay0);
}

[data-theme="inkdrop"] .note-properties-heading:hover {
  color: var(--ctp-subtext0);
}

[data-theme="inkdrop"] .sidebar-notebooks-kicker {
  font-family: var(--font-ui), ui-sans-serif, system-ui, sans-serif;
  font-size: 11px;
  letter-spacing: 0;
  text-transform: none;
}

[data-theme="inkdrop"] .sidebar-new-note {
  border-radius: 0.5rem;
  border: 1px solid var(--ctp-surface0);
  background: transparent;
}

[data-theme="inkdrop"] .sidebar-new-note:hover {
  background: var(--ctp-surface0);
}
```

`.note-list-meta` default `display: none`; Inkdrop sets `display: flex` so the time + pill sit on one row. Excerpt is `display: block` under Inkdrop only.

- [ ] **Step 3: Run** `npx vitest run src/lib/appearance.test.ts src/lib/ui/notebook.test.ts src/lib/workspace/tree.test.ts`

Expected: PASS. Then `npx tsc --noEmit` — PASS.

- [ ] **Step 4: Manual check** at `http://127.0.0.1:8765`

1. Settings → Color theme → Inkdrop. Open a DSA note. List shows title, relative time, colored type dot, snippet; selected row cyan wash + left hairline; editor title magenta; UI is Inter; no “Inkdrop” string in chrome.
2. Settings → Mocha. Compact list (no snippet/meta), mauve tick, title not forced pink. Font stays Inter if you came from Inkdrop (spec). If you need Mocha’s JetBrains, Font theme → JetBrains Mono.

- [ ] **Step 5: Skip commit**.

---

## Spec coverage (self-review)

| Spec requirement | Task |
|---|---|
| Mocha default unchanged | Task 2 tests + Global Constraints |
| Inkdrop pairs Inter + inkdrop code | Task 2 |
| Non-Inkdrop does not revert font | Task 2 |
| `noteListExcerpt` rules + tests | Task 1 |
| `formatNoteListTime` buckets | Task 1 |
| Tree `updatedAt` + `excerpt`, no full body on client | Task 3 |
| Excerpt computed at load, not cycle in tree.ts | Task 3 (`folders.ts`) |
| Inkdrop sort by `updatedAt` desc | Task 4 |
| `colorTheme` from layout, not `document` | Task 4 |
| Cards + hide meta outside Inkdrop | Task 4 markup + Task 5 CSS |
| Type pill colors / cyan selected / magenta title | Task 5 |
| Notebooks kicker + ghost New via CSS | Task 5 |
| Properties heading quieter | Task 5 |
| Search vs Filter placeholder | Task 4 |
| No second New, no Status/Tags, no line numbers | omitted on purpose |
| No commit | every task Step 5 |
