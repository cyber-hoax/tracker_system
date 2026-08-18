# Today Logging (Slot Check) Implementation Plan

> **For agentic workers:** User already approved the spec and said implement. Execute in this session. Do **not** commit. Skip the execution-choice gate.

**Goal:** Make Today a Slot Check: one peach CTA logs the current hour, walk/reading are daily checks, timeline chips replace clock-greying, inline undo DELETEs the session, extra time never locks the block.

**Architecture:** Keep `Dashboard` as the Today composer. Lock uniqueness and chip/CTA helpers in `src/lib/dashboard-log.ts` (client-side only). Add hard `deleteSession` + `DELETE /api/sessions/[id]`. Soften Today panels with `.today-glass`; tint Week wells. POST `/api/sessions` stays append-only.

**Tech Stack:** Next.js 16 App Router (`params: Promise<{ id: string }>`), React 19 client Dashboard, Drizzle/Postgres sessions, Vitest, Catppuccin Mocha + Phosphor.

## Global Constraints

- Today page only (`src/components/dashboard.tsx`). Do not restyle Reports, Chat, sidebar, or add nav.
- No unique DB constraint on `extra.block_key`. No soft delete. No snackbar. No streaks.
- Sentence-case labels. JetBrains Mono. Peach is the only filled CTA in a cluster.
- Extra time never sets `block_key`. `alreadyLogged("block")` has no in-window subject fallback.
- Calendar day is `briefingDay` (`Asia/Kolkata` via `briefing.timezone`), not UTC.
- Do not commit.

## File map

| File | Responsibility |
|---|---|
| `src/lib/dashboard-log.ts` | Uniqueness, undo stats, chips, CTA copy, session lookup |
| `src/lib/dashboard-log.test.ts` | Spec tests (undo, uniqueness, extra-time, chips, alreadyLogged) |
| `src/lib/progress.ts` | `deleteSession(id)` hard delete |
| `src/app/api/sessions/[id]/route.ts` | DELETE only (Next 16 `await params`) |
| `src/app/api/sessions/route.ts` | Unchanged GET/POST |
| `src/components/dashboard.tsx` | Slot Check UI |
| `src/app/globals.css` | `.today-glass` + week tint utilities |
| `DESIGN.md` | Today glass v2b + week tints; glass exception |

No schema/migration. Session `id` is already uuid.

---

### Task 1: dashboard-log helpers (TDD)

**Files:**
- Modify: `src/lib/dashboard-log.ts`
- Test: `src/lib/dashboard-log.test.ts`

**Produces:**
- `alreadyLogged(kind, briefing, recent)` — walk/reading day-unique; block matches `block_key` or legacy `block_start`+`block_title` on `briefingDay`; **not** same-subject+ts-in-window. If current is walk/reading, block is done if keyed **or** the daily habit session exists.
- `applyUnloggedSession({ briefing, recent, session })` — inverse of `applyLoggedSession`; floor at 0; keep zero buckets; decrement walk/reading days only if that local day has no remaining same-subject row; `walk_days` never below remaining distinct days in `recent`.
- `timelineChip(block, briefing, recent, nowMs): "Now" | "Logged" | "Remaining" | "Missed"`
- `blockCtaName(block): string`, `blockCtaMinutes(block): number`
- `sessionForQuickLog(kind, briefing, recent): SessionRecord | null` — latest match; prefer `block_key`; ignore extra-time DSA for `"block"`

- [ ] **Step 1: Write failing tests** in `src/lib/dashboard-log.test.ts` covering spec Testing §1–6. Change the existing in-window-other expectation from `true` to `false`.

- [ ] **Step 2: Run** `npx vitest run src/lib/dashboard-log.test.ts`

Expected: FAIL — extra-time still locks (old fallback), new helpers undefined.

- [ ] **Step 3: Implement helpers** in `src/lib/dashboard-log.ts`.

`alreadyLogged("block")` match:

```
extra.block_key === blockLogKey(current, ymd)
OR (extra.block_start === current.start AND extra.block_title === current.title AND dayOf(ts) === ymd)
OR (current is walk|reading AND alreadyLogged that habit)
```

`timelineChip` order vs live `nowMs`:
1. Now — `briefing.current` same start+title **or** `start_iso <= nowMs < end_iso`
2. Logged — `blockMatchesSession` (keyed/legacy; walk/reading also any same-subject on `briefingDay`)
3. Remaining — `nowMs < start`
4. Missed — `nowMs >= end`

`blockCtaName`: dsa→`DSA`, lld→`LLD`, hld→`HLD`, ai→`AI`, reading/walk/review lowercase names; else first word of title lowercased.

`blockCtaMinutes`: `Math.max(5, Math.round(block.minutes / 5) * 5)`

- [ ] **Step 4: Re-run tests** — all dashboard-log tests pass.
- [ ] **Step 5: Skip commit** (user constraint).

---

### Task 2: DELETE session API

**Files:**
- Modify: `src/lib/progress.ts` — add `deleteSession`
- Create: `src/app/api/sessions/[id]/route.ts`

**Next.js 16:** `params` is `Promise<{ id: string }>`. Match existing `runtime = "nodejs"` + `dynamic = "force-dynamic"`. DELETE only.

```ts
export async function deleteSession(id: string): Promise<SessionRecord | null> {
  const [row] = await db.delete(sessions).where(eq(sessions.id, id)).returning();
  return row ? serializeSession(row) : null;
}
```

Route:
- id not `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i` → 400 `{ error, detail: "Invalid session id" }`
- `deleteSession` null → 404 `{ error, detail: "Session not found" }`
- success → 200 `{ ok: true, briefing }` after `buildBriefing()`
- throw → 500 `{ error, detail }`

No DB integration test (spec). GET/POST route unchanged.

---

### Task 3: Glass, week tints, DESIGN.md

**Files:** `src/app/globals.css`, `DESIGN.md`

Add `.today-glass` exactly as spec. Week utilities:

```css
.today-week-dsa-total { background: color-mix(in srgb, var(--ctp-blue) 14%, var(--ctp-base)); }
.today-week-dsa-week { background: color-mix(in srgb, var(--ctp-teal) 14%, var(--ctp-base)); }
.today-week-walk { background: color-mix(in srgb, var(--ctp-green) 14%, var(--ctp-base)); }
.today-week-study { background: color-mix(in srgb, var(--ctp-mauve) 14%, var(--ctp-base)); }
```

Now-card accent: `.today-glass[data-accent="mauve"|"green"|"blue"|"peach"|"red"]` sets `border-color` at 50% so Tailwind utilities cannot lose to `.today-glass` border.

DESIGN.md: Elevation — Today operate panels use softer glass v2b; other routes keep Hairline Rule. Replace “Don’t add glass blur” with “Don’t add glass outside Today operate panels; Today uses softer glass v2b.” Document week tints. Timeline: chips replace `opacity-45`. Peach CTA stays opaque.

---

### Task 4: Dashboard Slot Check UI

**Files:** `src/components/dashboard.tsx`

**Busy:** `"block" | "walk" | "reading" | "form" | "undo"`. `if (busy) return`. Poll: `if (busyRef.current) return` before `refresh()`.

**Now-card:**
- Peach CTA only if `briefing.current`. Label `Log {blockCtaName} · {blockCtaMinutes}m`. Busy `Logging…`. Done `Logged` + Undo (hidden while id is `optimistic-*`). Accessible undo name `Undo {name}`.
- Walk/reading: `aria-pressed` checks (circle + label), not peach pills. POST walk `20` / reading `30` with existing notes. If current is that habit, also set `block_key`/`block_start`/`block_title`. Done: green check; tap check **or** sibling Undo DELETEs `sessionForQuickLog`. Focus stays on the check.
- One `aria-live="polite"` status `<p>`. Drop `logStatus`/`actionStatus` pair. Success green / error red / 404 `Already removed.` green.
- Between blocks: no peach CTA; subcopy `Next block at {time}` or `No upcoming block`; ignore stale log clicks.
- `<details>` `Add extra time`. Fields: minutes (empty→0), problems (0), notes, subject `dsa|lld|hld|ai|review|other`. Default subject from `blockLogSubject(current)` if in that set else `other`. Submit peach only when details open **and** (block done or no current); else ghost. POST **omits** `block_key`. Empty → `Add minutes, problems, or notes.` Success `Logged {n}m · {subject}.` or `Logged notes · {subject}.` Clear notes, keep open.
- Recent (8) always under disclosure, each with Undo.

**Undo:** optimistic `applyUnloggedSession` + `DELETE /api/sessions/{id}`. No dialog. On success `setBriefing(result.briefing)` + `refresh()`. 404 → refresh, `Already removed.` Other errors → restore snapshot, red status. After block undo, focus the log CTA.

**Timeline:** remove `opacity-45`. One chip from `timelineChip(..., nowMs)`. Now peach fill / Logged green outline / Remaining overlay0 / Missed red. Chips not buttons. Rail peach while Now.

**Week:** 2×2 tinted wells + 16px Phosphor `ChartLine`, `Target`, `PersonSimpleWalk`, `Clock` in overlay0. Footer: next-block sentence + `Focus hours move only for DSA, LLD, HLD, and AI.` Flash ring skipped when `prefers-reduced-motion: reduce`. Both DSA wells still flash on `dsa`.

**Layout:** drop Log progress panel. Row 1: Today | Week. Row 2: Sunday review | Apple Calendar. Sunday review status stays **without** `aria-live`.

**Walk/reading covering CTA:** `alreadyLogged("block")` already ORs the daily habit when current is that habit.

---

### Task 5: Verify

- `npx vitest run src/lib/dashboard-log.test.ts`
- `npx vitest run` (full suite)
- Typecheck if available (`npx tsc --noEmit` or project script)

Manual (report, do not claim UI without noting it is manual): log → undo → re-log; extra time does not flip chip or lock peach; no current hides CTA; week tints.

## Spec coverage

| Spec | Task |
|---|---|
| Peach current-block CTA + labels | 4 |
| Walk/reading daily checks | 1 + 4 |
| Chips Now/Logged/Remaining/Missed, no greying | 1 + 4 |
| Inline undo DELETE, no confirm, re-log | 2 + 4 |
| Extra time collapsed, no block_key | 4 + 1 tests |
| alreadyLogged no in-window fallback | 1 |
| Softer glass, week tints, opaque peach | 3 + 4 |
| Calendar companion slot | 4 |
| Skip poll while busy, optimistic rollback | 4 |
| DESIGN.md glass exception | 3 |
| No Reports/sidebar/streaks/commit | constraints |
