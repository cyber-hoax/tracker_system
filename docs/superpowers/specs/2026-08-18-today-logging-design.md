# Today logging — Slot Check (hybrid)

**Date:** 2026-08-18
**Status:** Draft for user review (decisions locked in conversation; not yet implemented)
**Surface:** Today page only (`/`, `src/components/dashboard.tsx`)
**Visual reference:** `/Users/cyberhoax/.cursor/projects/Users-cyberhoax-Documents-tracker-system/assets/today-hybrid-v2b-glass-soft.png`

This spec rethinks Today logging. It is not an undo-only patch on the current three equal pills plus a parallel diary form.

## Goal

Make logging the current hour a single obvious tap, make the day’s list a status checklist, and make mistakes cheap: undo sits next to the control, deletes the session, and the same control can log again immediately.

Success looks like:

- During a study/break block, one opaque peach pill logs it (`Log DSA · 90m`, `Log decompression · 30m`).
- Walk and reading are daily checks, unique per `Asia/Kolkata` calendar day (the briefing timezone), not peer CTAs.
- The Today list shows exactly one chip per row: Logged / Now / Remaining / Missed. Missed means the block’s end has passed and no matching session exists. Every unlogged row is tappable (Missed, Now, or Remaining) — morning routine, commute, work, decompression, break, dinner, shutdown, DSA, walk, reading, and any other Today block. The list does not fade rows just because the clock moved.
- Undo is inline beside the control that created the session. No confirm dialog. After undo, the control is the log control again. Timeline Logged rows get the same inline Undo (DELETE), so a missed block can be logged, undone, and logged again.
- Extra time (notes, DSA problems, extra minutes) is a collapsed add-on, not a second logger for the current block.
- Week stats use four distinct tints. Today panels use softer glass (v2b). Sidebar chrome stays Today / Chat / Routine / Reports.

## Non-goals

- Do not add a unique database constraint on `extra.block_key`. Uniqueness stays client-side (`alreadyLogged` and the new helpers below), as it is today.
- Do not soft-delete sessions into `trash_snapshots`. Undo is a hard delete of that row.
- Do not skip any Today row kind from timeline logging. Dinner, commute, work, morning routine, and shutdown are loggable the same way as DSA. Remaining (not-yet) rows are also loggable when the user already did them or wants to check them off.
- Do not add server-side “already logged” rejection on POST. POST stays append-only. Duplicate-tab races can create two rows; undo removes one; the control stays in the done state until no matching session remains.
- Do not introduce a snackbar/toast stack. The now-card status line is the only log/undo feedback (optional backup to inline undo, not a replacement for it).
- Do not change Chat, Routine, Reports, Graph, Search, or Settings. Do not add a product, brand, or nav item.
- Do not add streak gamification, points, or weekly goal chrome beyond the existing week numbers.

## Current behavior (what this replaces)

Today’s now-card has three sibling pills: `Log this block` (peach), `Walk done`, `Reading done`. `alreadyLogged()` in `src/lib/dashboard-log.ts` is client-side only:

- Walk / reading: any session with that `subject` whose `ts` falls on `briefingDay(briefing)` (`ymdInZone` in `briefing.timezone`, which is `Asia/Kolkata`).
- Block: `extra.block_key === "${ymd}|${start}|${title}"`, or else same subject with `ts` inside the current window.

`POST /api/sessions` (`src/app/api/sessions/route.ts` → `addSession` in `src/lib/progress.ts`) always inserts. There is no DELETE. The diary form (`Log progress`) is a second peach `Save session` on the same page, so two filled CTAs compete. The Today list greys elapsed rows (`opacity-45`) by clock. Week cells are four identical `bg-ctp-base` tiles. Sessions are append-only; a mis-tap cannot be undone without a database edit.

`alreadyLogged("block")`’s in-window subject fallback is a trap for extra time: a DSA extra-time POST during a DSA block would lock the peach CTA. This spec removes that fallback.

## User flows

Timezone for every “today” comparison is `briefing.timezone` via `briefingDay(briefing)`. Do not use UTC calendar dates.

### Log the current block

1. `briefing.current` exists.
2. Peach CTA is enabled. Label is `Log {name} · {minutes}m` (see Visual).
3. Tap. Optimistic insert (existing `applyLoggedSession`), then `POST /api/sessions` with:
   - `subject`: `blockLogSubject(current)` (`dsa` / `lld` / `hld` / `ai` / `reading` / `walk` / `review`, else `other`)
   - `minutes`: `Math.max(5, Math.round(current.minutes / 5) * 5)` (full planned duration, not remaining)
   - `notes`: `current.title`
   - `extra.block_key`: `blockLogKey(current, briefingDay(briefing))`
   - `extra.block_start`, `extra.block_title`: current start and title (legacy-readable)
4. CTA becomes the green done pill labeled `Logged`. An `Undo` control appears immediately to its right.
5. Status line (green): `Logged this block.`
6. Matching Week cell flashes the existing 1.4s green ring (`dsa` / `walk` / `reading` / `study`).
7. Focus stays on the CTA (now the done pill).

If the current block is walk or reading, still render the peach CTA (`Log walk · 20m` / `Log reading · 30m`). That POST is also the daily habit: the Walk/Reading check shows done. Do not insert a second session.

### Undo the current block

1. Block is in the done state (`sessionForQuickLog("block", …)` found a real session id).
2. Tap `Undo` next to the CTA. No dialog.
3. Optimistic `applyUnloggedSession`, then `DELETE /api/sessions/{id}`.
4. CTA returns to the peach `Log {name} · {minutes}m` immediately. `Undo` hides.
5. Status line: `Block undone.`
6. Focus stays on the CTA (now the peach log control).
7. Tap peach again to re-log. Same uniqueness as the first log.

While the optimistic id is still `optimistic-*`, do not render Undo. Render it once the POST returns a real uuid.

### Log walk / reading (daily checks)

1. Checks live on the now-card, to the right of the peach cluster, visually quieter: empty circle + `Walk` / `Reading`, not peach pills.
2. Unique per calendar day. Tap when empty → POST `{ subject: "walk", minutes: 20, notes: "20-minute walk" }` or `{ subject: "reading", minutes: 30, notes: "Reading block" }`.
3. If `briefing.current` is that same habit, also set `extra.block_key` (and start/title) so the scheduled row is keyed. If current is some other block, omit `block_key`.
4. Control becomes green check + `Undo`. Status: `Walk logged.` / `Reading logged.`
5. When done, tapping the check again **or** tapping its sibling `Undo` does the same thing: DELETE that day’s matching session (`sessionForQuickLog("walk"|"reading")` = latest same-subject session on `briefingDay`). Control returns to empty. They can log again the same day.
6. Focus stays on the Walk or Reading check button (not the sibling Undo) after either path.

Walk/reading are not equal primary buttons. Only one peach fill exists on the now-card: the current-block CTA, and only when a current block exists and it is not yet logged.

### Re-log

After any successful undo, the same control is the log control. No cooldown. `alreadyLogged` is false because the session row is gone. POST is a new id.

### Add extra time

Not a parallel logger for the current hour.

1. Disclosure on the now-card, collapsed by default, labeled `Add extra time` (sentence case, caret, not a peach button).
2. Expanded fields: extra minutes (number, min 0, step 5, default empty → treat as 0 on submit), DSA problems (number, min 0, default 0), notes (textarea), subject (select: `dsa`, `lld`, `hld`, `ai`, `review`, `other` — **not** `walk` or `reading`). Default subject: if `briefing.current` exists and `blockLogSubject(current)` is one of `dsa` / `lld` / `hld` / `ai` / `review`, use that; otherwise `other`.
3. Submit peach pill: `Save extra time`. This is the cluster’s peach only while the disclosure is open **and** the current-block CTA is in the done state or there is no current block. If the current-block CTA is still the unlogged peach, extra-time submit is a ghost pill (`Save extra time`) so two peach fills never share the now-card. (One Action Rule.)
4. POST does **not** set `extra.block_key`. Extra time never satisfies block uniqueness and never flips a timeline row from Missed/Now to Logged.
5. Reject client-side if minutes is 0/empty **and** problems_count is 0 **and** notes are blank: status `Add minutes, problems, or notes.` No POST.
6. On success: status `Logged {n}m · {subject}.` (or `Logged notes · {subject}.` when minutes is 0). Clear notes. Keep disclosure open. Prepend the row in recent.
7. Recent sessions (up to 8) stay visible under the disclosure as proof, even when collapsed. Each row has inline `Undo` that DELETE-s that id.

### Empty / no current block

- Now-card title stays `Between blocks`.
- Subcopy: next block at `{time}` if `briefing.next`, else `No upcoming block`.
- Progress meter at 0%.
- **No peach log CTA.** Do not render a disabled `Log this block`.
- Walk and reading checks still work.
- Add extra time still works (its submit may be peach because there is no block CTA).
- Tapping nothing cannot produce `No current block to log.` That string is unused once the CTA is omitted. If a stale click arrives, ignore it.
- Timeline: no row gets the Now chip.

### Log any Today timeline block

Any Today row can be logged at any time by tapping its chip — Missed (past, not logged), Now (current hour), or Remaining (not yet started). That includes morning routine, commute, work, decompression, break, dinner, shutdown, DSA, walk, and reading. “Anytime” means they can backfill a missed block **or** check off a remaining block when they already did it (or want to mark it done). No modal.

Tap the chip (the row’s log control) to log that block the same way as the peach CTA: `POST /api/sessions` with that row’s `block_key`, title as notes, `blockCtaMinutes`, and `blockLogSubject` (`other` is fine for work / dinner / commute / morning / shutdown). Optimistic insert first; the chip becomes Logged immediately. While the request is in flight the row is pending/disabled. After the POST uuid arrives, inline `Undo` appears on the row. Undo DELETEs that session (same path as now-card undo). The chip returns to Missed, Now, or Remaining as the clock dictates. Tap again to re-log. No cooldown.

Uniqueness is **per block**, not “whatever `briefing.current` is.” Logging missed DSA while Now is HLD must not be blocked by HLD’s logged state, and must not mark HLD logged.

The peach now-card CTA still logs **the current block only**. Timeline taps log the **tapped row**. Extra time still cannot convert any row to Logged (`block_key` stays unset).

`canLogFromTimeline(block, chip)`:

- **Missed** — always loggable. Any kind, including `meal`, `maintenance`, `buffer`, `work`, `shutdown`, `study`, `walk`, `reading`, `break`, `review`.
- **Now** — loggable (same payload as the peach CTA for that row). Primary log control for the current hour stays the peach now-card CTA; the Now chip is an extra path to the same POST.
- **Remaining** — loggable. Future/not-yet rows can be checked off when the user already did them.
- **Logged** — not a log control; the sibling Undo DELETEs. After undo they can log again.

A walk/reading row that was Missed also becomes Logged if the daily check is completed later the same day (habit match, no `block_key` required for the chip). Tapping Missed/Now/Remaining walk/reading **does** set `block_key`.

## Visual

Reference mockup: `today-hybrid-v2b-glass-soft.png`. Identity stays Daily Routine / Catppuccin Mocha from `DESIGN.md` except where this section overrides the Hairline Rule for Today operate panels.

### Softer glass (v2b)

Apply to Today content panels only: now-card, Today list, Week, extra-time/recent well, Sunday review, Apple Calendar strip. Do **not** glass the sidebar, titlebar, menus, or Reports.

Recipe (bind to CSS variables, not one-off hex):

```css
.today-glass {
  background: color-mix(in srgb, var(--ctp-mantle) 88%, transparent);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid color-mix(in srgb, var(--ctp-text) 12%, var(--ctp-surface0));
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--ctp-text) 14%, transparent),
    0 10px 28px color-mix(in srgb, var(--ctp-crust) 35%, transparent);
}
```

Meaning: higher panel opacity (88% mantle, not 40% frost), weak blur (10px, not 24px+), thin inner rim (inset highlight), light tinted shadow. Not heavy frost, not flat Mocha mantle, not neumorphism.

Peach CTA stays fully opaque: `background: var(--ctp-peach); color: var(--ctp-crust);` — no alpha, no blur on the pill.

Now-card keeps the subject accent hairline at 50% (`border-ctp-mauve/50` etc.) on top of `.today-glass`.

Add `.today-glass` in `src/app/globals.css`. Update `DESIGN.md` Elevation: Today operate panels use this recipe; other routes keep the Hairline Rule. The DESIGN.md “Don’t add glass blur” line becomes “Don’t add glass outside Today operate panels; Today uses softer glass v2b.”

### Tokens that stay

- Catppuccin Mocha roles: peach, mauve, green, blue, red, crust, mantle, base, surface0, overlay0, text, subtext0.
- Peach is the only filled CTA in a cluster.
- JetBrains Mono for UI, clock, chips, counts.
- Sentence-case labels and status (`Logged this block.`, not `LOGGED THIS BLOCK.`).
- `transition-colors duration-150` on pills and chips.
- 1080px operate column, 1.2 / 0.8 split, 8 / 10 / 16 / 20 / 28px rhythm, pill actions (`rounded-full`).
- Sidebar: same mantle chrome, same four primary links (Today, Chat, Routine, Reports). Graph / Search / Settings stay where they already are; this spec does not restyle them.

### Current-block CTA label

`minutes` = `Math.max(5, Math.round(block.minutes / 5) * 5)`.

`name`:

| `block.subject` | `name` |
|---|---|
| `dsa` | `DSA` |
| `lld` | `LLD` |
| `hld` | `HLD` |
| `ai` | `AI` |
| `reading` | `reading` |
| `walk` | `walk` |
| `review` | `review` |
| anything else | block title, first word, lowercased (e.g. title `Decompression` → `decompression`) |

Examples: `Log DSA · 90m`, `Log decompression · 30m`.

Busy label: `Logging…`. Done label: `Logged`. Undo: `Undo` (visible), accessible name `Undo {name}`.

### Timeline chips

Each Today row is the existing 148px range + title, plus a trailing chip. Remove `opacity-45` for elapsed rows. Status is the chip, not greying.

Exactly one chip, evaluated in this order against live `nowMs` (1s tick), not stale `briefing.now`:

1. **Now** — this row is `briefing.current` (same `start` + `title`), **or** `start_iso <= nowMs < end_iso` (covers a stale briefing while the clock is inside the window). Peach fill, crust text. Wins even if the block is already logged.
2. **Logged** — a matching session exists (see Data flow). Green 40% outline, green text, transparent fill.
3. **Remaining** — `nowMs < Date.parse(block.start_iso)`. Overlay0 outline and text.
4. **Missed** — `nowMs >= Date.parse(block.end_iso)` and no matching session. Red outline, red text.

These four cover every row: there is no in-window hole.

Logged chips stay non-interactive text; sibling Undo uses `Undo {name}`. Missed, Now, and Remaining chips are `<button type="button">` in the tab order; visible label stays `Missed` / `Now` / `Remaining` / `Logging…`. Accessible name for a loggable control: `Log {name}`. Do not set `aria-hidden`. Rail and pip stay: peach while Now, `surface0` / overlay pip otherwise. No new modal. Sentence-case. Softer glass / existing chrome unchanged.

### Week cards

Four nested wells, 2×2, each a distinct tint on `base` (not four identical dark tiles). Values come from `weekCardValues(briefing.stats)` in `src/lib/dashboard-log.ts` (optimistic `applyLoggedSession` / `applyUnloggedSession` plus briefing refetch — the same path walk days already use).

| Key | Caption | Value | Tint |
|---|---|---|---|
| `dsa` (total) | DSA problems logged | Problem notes with `Last Solved Date` in the current week (zettelkasten / DSA page). Slot Check DSA block logs stay `problems_count` 0 and do not invent this number. Extra time with a problem count also does not invent it. | `color-mix(in srgb, var(--ctp-blue) 14%, var(--ctp-base))` |
| `dsa` (week) | DSA this week | Same source as Reports “Questions” for the briefing-day week: problem notes with `Last Solved Date` in the current week (`dsa_problems_week`). A Slot Check / extra-time DSA session does not count as a question. | `color-mix(in srgb, var(--ctp-teal) 14%, var(--ctp-base))` |
| `walk` | Walk days (`{n}/7`) | Unique `Asia/Kolkata` days with a walk session this week. Second walk the same day does not increment. | `color-mix(in srgb, var(--ctp-green) 14%, var(--ctp-base))` |
| `study` | Focus hours this week | `study_minutes_week / 60`. Minutes from `dsa` / `lld` / `hld` / `ai` only. A 90m DSA block log must move this card even when `problems_count` is 0. There are no separate LLD/HLD/AI wells. | `color-mix(in srgb, var(--ctp-mauve) 14%, var(--ctp-base))` |

Include a 16px Phosphor icon in overlay0 on each well: `ChartLine` (DSA total), `Target` (DSA week), `PersonSimpleWalk` (walk), `Clock` (focus). Number stays 1.25rem mono. Green flash ring on log unchanged. Both DSA wells flash when `subject === "dsa"` (existing `flashStat("dsa")`).

Footer under the grid:

1. Existing next-block sentence (`Up next: …` / `No further blocks today.`).
2. `Focus hours move only for DSA, LLD, HLD, and AI.`

### Layout after removing Log progress

- Header unchanged.
- Now-card: title, range/remaining, meter, guidance, peach CTA + undo, walk/reading checks, one status line, `Add extra time`, recent rows.
- Row: Today timeline (1.2) | Week (0.8).
- Next row: Sunday review (1.2) | Apple Calendar (0.8). Calendar moves from the full-width footer into this companion slot. Behavior of review and calendar sync does not change.

## Architecture / components

Keep `Dashboard` in `src/components/dashboard.tsx` as the Today composer. Do not split into a new package or route.

| File | Change |
|---|---|
| `src/components/dashboard.tsx` | Slot Check UI: CTA, daily checks, chips, extra time, recent-row undo, glass classes, tinted week cells, single status line, skip poll while `busy`. Remove the three-equal-pills row and the `Log progress` form panel. |
| `src/lib/dashboard-log.ts` | `alreadyLogged` block match without in-window subject fallback; add `applyUnloggedSession`, `sessionForQuickLog`, `sessionForBlock`, `alreadyLoggedBlock`, `timelineChip`, `blockCtaName`, `blockCtaMinutes`, `blockLogPayload`, `extraTimeLogBody`, `canLogFromTimeline`, `weekCardValues` (DSA this week = this week’s Last Solved Date notes, same as Reports Questions). |
| `src/lib/dashboard-log.test.ts` | Cover the new helpers, extra-time-does-not-lock-CTA, missed-row `block_key`, uniqueness per block, and undo restoring Missed. |
| `src/lib/progress.ts` | Add `deleteSession(id: string): Promise<SessionRecord \| null>` — `DELETE FROM sessions WHERE id = $id RETURNING *`. Hard delete. |
| `src/app/api/sessions/[id]/route.ts` | **New.** `DELETE` only. |
| `src/app/api/sessions/route.ts` | Unchanged GET/POST. |
| `src/app/globals.css` | `.today-glass` and week tint utilities. |
| `DESIGN.md` | Document Today glass v2b and week tints; keep remaining tokens. |
| `src/db/schema.ts` | Unchanged. No migration. Session `id` is already uuid. |

Do not add uniqueness indexes. Do not touch `src/components/reports-view.tsx` or `src/components/app-sidebar.tsx` except that Today still renders inside the existing shell.

`src/app/page.tsx` stays: `buildBriefing()` + `recentSessions(30)` into `Dashboard`.

## Data flow

### Uniqueness (client)

`alreadyLogged(kind, briefing, recent)`:

- `walk` / `reading`: unchanged — any matching `subject` on `briefingDay`.
- `block`: `false` if `!briefing.current`. Else true iff some session has `extra.block_key === blockLogKey(current, ymd)` **or** (legacy) `extra.block_start === current.start && extra.block_title === current.title` on that day. **Do not** treat “same subject + ts in window” as logged. Extra time therefore cannot lock the CTA.

When `current.subject` or `current.kind` is `walk` or `reading`, treat the block as done if `alreadyLogged("block")` **or** `alreadyLogged("walk"|"reading")`. One habit session covers both the check and the CTA.

`timelineChip(block, briefing, recent, nowMs)` uses `blockMatchesSession`:

- Study/other: `extra.block_key` for that row’s key, or legacy start+title on that day.
- Walk/reading rows (`subject` or `kind` is walk/reading): that, **or** any same-subject session on `briefingDay`.

`sessionForQuickLog("block")` returns the latest matching current-block session (prefer `block_key`). Walk/reading: latest that calendar day. Extra-time row undo uses the row’s `id`.

`alreadyLoggedBlock(block, briefing, recent)` is `blockMatchesSession` for **that row**, not `briefing.current`. `sessionForBlock` is the same lookup for undo on a timeline row.

`blockLogPayload(block, ymd)` is the peach CTA body: subject, minutes, notes=`title`, `extra.block_key` / `block_start` / `block_title`. Timeline Missed / Now / Remaining taps use this helper so they cannot drift from the CTA. Work, dinner, commute, morning, and shutdown POST `subject: "other"` when they have no named log subject.

`extraTimeLogBody` never includes `extra` / `block_key`. Extra time must not silently convert Missed → Logged.

### POST log

Existing `POST /api/sessions`. Body unchanged. Optimistic path unchanged: prepend `optimistic-{timestamp}`, `applyLoggedSession`, replace id on response, `refresh()`. If `busy` is set, ignore a second tap.

`busy` union: `"block" | "walk" | "reading" | "form" | "undo" | "timeline"`. One in-flight mutation. Timeline Missed / Now / Remaining logs use `"timeline"` so the peach CTA does not switch to `Logging…` while another row is posting.

30s poll: `if (busy) return;` before `refresh()`, so a mid-flight undo is not overwritten by GET.

### DELETE undo

`DELETE /api/sessions/{id}` implemented as `src/app/api/sessions/[id]/route.ts`:

- Id not matching `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i` → `400` `{ error, detail: "Invalid session id" }`.
- `deleteSession` returns null → `404` `{ error, detail: "Session not found" }`.
- Success → `200` `{ ok: true, briefing }` after `buildBriefing()`.
- Throw → `500` as other session routes.

Optimistic: remove the row from `recent`, `applyUnloggedSession` (inverse of `applyLoggedSession`: subtract minutes/sessions/problems, floor at 0; decrement `walk_days` / `reading_days` only if no remaining same-subject session remains on that session’s local day; rewrite guidance). On success, `setBriefing(result.briefing)` and `refresh()`. On 404, treat as already gone: `refresh()`, status `Already removed.` (not an error color). On other errors, restore snapshot, red status.

`applyUnloggedSession` must not go negative. If `by_subject[subject].sessions` hits 0, leave the bucket at zeros rather than deleting the key (simpler equality in tests).

### Extra time vs block_key

| Action | `block_key` | Counts as block logged | Counts as walk/reading day |
|---|---|---|---|
| Peach current-block log | yes | yes | yes if subject is walk/reading |
| Timeline Missed / Now / Remaining tap | yes | yes, that row only | yes if subject is walk/reading |
| Walk/reading check | only if current is that habit | only that habit row | yes |
| Extra time | never | never | never (walk/reading omitted from subject select) |
| Recent-row undo | n/a | no once that row is gone | no if it was the day’s last walk/reading |
| Timeline-row undo | n/a | chip returns to Missed once that row is gone | no if it was the day’s last walk/reading |

## Error handling

| Case | UI |
|---|---|
| POST/DELETE network or 500 | Rollback optimistic state. Status red, 13px, the thrown `detail`/`error` or `Request failed`. Control returns to pre-tap state. |
| POST while already logged (client) | No POST. Status (not error): `This block is already logged.` / `Walk already logged today.` / `Reading already logged today.` |
| DELETE 404 | Refresh. Status uses the success color (green), copy `Already removed.` Control shows logged=false if no matching session remains. |
| Extra time empty | No POST. Status (not error): `Add minutes, problems, or notes.` |
| Invalid extra minutes / problems | Browser `min`/`step`; also `Number(...)` clamp `>= 0` before POST. |
| Double tap | `if (busy) return`. |
| Poll vs in-flight | Skip poll `refresh` while `busy`. |
| Two tabs both POST the same block | Both rows persist. CTA stays done. Each Undo removes one row. After the last matching row is gone, CTA is peach again. |

Sunday review errors stay on the review status line (unchanged). They do not use the now-card live region.

## Accessibility

- **One `aria-live="polite"`** for session log/undo: the now-card status `<p>`. Remove the duplicate `logStatus` + `actionStatus` pair (today both are written on every log). Sunday review has visible status **without** `aria-live`, so a review save does not interrupt a log announcement.
- CTA accessible name = visible label (`Log DSA · 90m`, `Logged`, `Logging…`).
- Undo: `<button type="button">` with accessible name `Undo DSA` / `Undo walk` / `Undo reading` / `Undo session` (recent rows). Visible text may stay `Undo`.
- Walk/Reading: `<button type="button" aria-pressed={done}>`. Not a native checkbox (undo is a sibling when done; the whole control stays one focus target — when done, the check button remains focused; Undo is the next tab stop).
- Chips: text labels Logged / Now / Remaining / Missed. Color is not the only signal.
- **Focus stays on the control that was activated.** Do not `.focus()` the status line. After undo, the log button is the same DOM node (or take focus on the peach CTA if the undo button unmounts — move focus to the log button in that case so focus is not dumped to `body`).
- Keyboard: CTA, Undo, checks, extra-time submit, recent-row Undo, and loggable Missed/Now/Remaining chips are `<button type="button">` (submit is `type="submit"`). Extra time is a native `<details>` / `<summary>` labeled `Add extra time`.
- `prefers-reduced-motion: reduce`: skip the 1.4s week ring. Keep `transition-colors duration-150` (color, not motion).

## Testing

Vitest only (`npm test`, `src/**/*.test.ts`). No Playwright in this repo; do not add E2E for this spec.

In `src/lib/dashboard-log.test.ts`:

1. `alreadyLogged("block")` is true for `extra.block_key` and for legacy start+title; **false** for a same-subject extra-time session inside the window with no key.
2. Walk/reading still unique per `Asia/Kolkata` day; yesterday does not count.
3. `applyUnloggedSession` reverses `applyLoggedSession` for walk_days, reading_days, study minutes, DSA problems, and recent prepend; walk_days does not drop below the remaining distinct days.
4. `timelineChip`: current → Now; keyed past → Logged; future with no session → Remaining; ended with no session → Missed; current+keyed still Now; walk row Logged when a day-level walk exists without `block_key`.
5. `blockCtaName` / minutes: DSA → `Log DSA · 90m`; Decompression 30 → name `decompression` minutes 30.
6. `sessionForQuickLog` returns the latest matching row, ignores extra-time DSA for `"block"`.
7. `blockLogPayload` for a missed DSA row sets `extra.block_key` (and start/title) exactly as the peach CTA would.
8. `extraTimeLogBody` does not set `block_key`; applying that session leaves a missed DSA chip as Missed.
9. Uniqueness is per `block_key`: a keyed HLD session and a same-subject extra-time DSA session do not mark a missed DSA row logged.
10. After `applyLoggedSession` of a keyed missed DSA, chip is Logged; `applyUnloggedSession` restores Missed.
11. `canLogFromTimeline`: Missed DSA / decompression / work / dinner / commute / morning true; Remaining true; Logged false. Missed work `blockLogPayload` sets `block_key` and `subject: "other"`; extra time still does not.
12. Week cards via `weekCardValues`: a DSA block log with `problems_count` 0 increments focus hours and leaves **DSA this week** and **DSA problems logged** unchanged (both cards are this week's Last Solved Date problem notes, same as Reports Questions — not session count or `problems_count`). Walk/reading still unique days.

`deleteSession` talks to Postgres. Do not add a DB integration test in this spec. Route handler can stay untested at HTTP level; the helper behavior is what unit tests lock.

Manual check after implementation (not automated): log, undo, re-log; extra time does not change the chip; no current block hides peach CTA; week tints visible against the mockup.

## Out of scope

- Reports page, contribution graph, LeetCode ingest, chat, routine editor, calendar event generation, Sunday review fields, appearance themes beyond Today glass using existing CSS variables.
- Streaks, badges, weekly hour meters, notifications, undo history, redo stacks.
- Editing a session in place (undo + re-log is the edit). Remaining/future blocks **are** loggable from the timeline.
- Server uniqueness, migrations, new tables, soft delete.
- New nav items, renaming the app, restyling the sidebar.
- Replacing JetBrains Mono, adding a second typeface, or a marketing hero.
- Confirm modals for undo.
- Snackbar libraries.

## Spec self-review

Checked after the first draft and fixed in this file:

1. **Placeholders:** None after this pass (icons, disclosure markup, optimistic Undo, chip fallback, uuid pattern, extra-time default subject are locked). Minutes, chip order, CSS recipe, HTTP codes, file list, and CTA copy are explicit.
2. **Consistency:** Extra time must not lock the peach CTA — `alreadyLogged("block")` no longer uses the in-window subject fallback. Extra-time submit is ghost while the unlogged peach CTA is visible, so two peach fills never coexist. Walk/reading omitted from extra-time subjects so a diary POST cannot mark the daily check. Timeline Logged for habits still follows the daily session.
3. **Scope:** One page, one new DELETE route, helpers in `dashboard-log.ts`, glass CSS, DESIGN.md note. Fits a single implementation plan. Reports and sidebar chrome are untouched.
4. **Ambiguity resolved:**
   - Every Today row is loggable from the list (Missed, Now, or Remaining; same POST as the peach CTA, including work/dinner/commute/morning). Extra time still never sets `block_key`. The peach CTA still logs only `briefing.current`.
   - Current + logged chip is **Now** (current wins); CTA still shows **Logged** + Undo.
   - In-window row with a stale `briefing.current` still gets **Now** (no unlabeled hole).
   - Undo on an optimistic id is omitted until the POST uuid arrives.
   - Walk/reading check-when-done and sibling Undo are the same DELETE.
   - Extra-time subject default is `blockLogSubject(current)` when it is dsa/lld/hld/ai/review, else `other`.
   - Extra time uses `<details>`/`<summary>`. Week wells include the four Phosphor icons.
   - Undo target is the latest matching session; duplicate-tab extras require one undo per row.
   - No current block → CTA omitted, not disabled.
   - Calendar day is `briefingDay`, not UTC.
   - Backup “toast” = the existing 13px now-card status line, not a new component.
   - Glass applies to Today operate panels only; peach CTA stays opaque.
   - Focus: if Undo unmounts, move focus to the log button so it does not drop to `body`.
   - Reduced motion skips the ring only.
