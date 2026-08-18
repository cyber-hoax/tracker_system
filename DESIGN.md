---
name: Daily Routine
description: Local-first night desk for today's block, log, and week.
colors:
  peach: "#fab387"
  mauve: "#cba6f7"
  green: "#a6e3a1"
  blue: "#89b4fa"
  red: "#f38ba8"
  crust: "#11111b"
  mantle: "#181825"
  base: "#1e1e2e"
  surface0: "#313244"
  surface1: "#45475a"
  overlay0: "#6c7086"
  overlay1: "#7f849c"
  text: "#cdd6f4"
  subtext0: "#a6adc8"
  subtext1: "#bac2de"
typography:
  display:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "clamp(1.875rem, 4vw, 3rem)"
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "clamp(1.875rem, 3vw, 2.25rem)"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "1.25rem"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "normal"
  body:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
  clock:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "2.25rem"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-0.025em"
rounded:
  sm: "6px"
  md: "8px"
  xl: "12px"
  "2xl": "16px"
  full: "9999px"
spacing:
  xs: "8px"
  sm: "10px"
  md: "16px"
  lg: "20px"
  xl: "28px"
components:
  button-primary:
    backgroundColor: "{colors.peach}"
    textColor: "{colors.crust}"
    rounded: "{rounded.full}"
    padding: "10px 16px"
    typography: "{typography.label}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.full}"
    padding: "10px 16px"
  button-ghost-hover:
    backgroundColor: "{colors.surface0}"
    textColor: "{colors.text}"
    rounded: "{rounded.full}"
    padding: "10px 16px"
  button-done:
    backgroundColor: "color-mix(in srgb, #a6e3a1 10%, transparent)"
    textColor: "{colors.green}"
    rounded: "{rounded.full}"
    padding: "10px 16px"
  button-new:
    backgroundColor: "{colors.surface0}"
    textColor: "{colors.text}"
    rounded: "{rounded.full}"
    padding: "8px 12px"
  input-field:
    backgroundColor: "{colors.base}"
    textColor: "{colors.text}"
    rounded: "{rounded.xl}"
    padding: "10px 12px"
  panel:
    backgroundColor: "{colors.mantle}"
    textColor: "{colors.text}"
    rounded: "{rounded.2xl}"
    padding: "20px"
  stat-cell:
    backgroundColor: "{colors.base}"
    textColor: "{colors.text}"
    rounded: "{rounded.xl}"
    padding: "12px"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.subtext0}"
    rounded: "{rounded.sm}"
    padding: "6px 8px"
  nav-item-active:
    backgroundColor: "{colors.surface0}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "6px 8px"
---

# Design System: Daily Routine

## Overview

**Creative North Star: "The Night Briefing"**

This is a local operator desk after dark. The default scene is Catppuccin Mocha: crust canvas, mantle panels, a peach pill for the one action that commits a log. Type is JetBrains Mono end to end, so the clock, the block title, and the form share one face. Density is high because the job is to see *now*, log it, and get back to the block — not to market a product.

Personality is quiet and exact. Color is semantic, not decorative: peach starts work, mauve marks time and focus, green confirms, red names failure. Surfaces stay flat except Today operate panels, which use softer glass v2b (see Elevation). Chrome (sidebar, titlebar) stays mantle with a hairline; Today is not a different brand.

The world is themeable (Macchiato, Frappé, Latte, Kanagawa, One Dark, GitHub Dark), but Mocha is the shipped identity. New work binds to the semantic roles (`peach`, `mantle`, `surface0`), never to a one-off hex.

**Key Characteristics:**
- Mocha stack: crust page, mantle panel, base well
- Pill CTAs; peach fill is the only solid action
- JetBrains Mono for UI, display, and measurement
- Flat panels outside Today; Today operate panels use softer glass v2b
- 1080px operate column, 1.2 / 0.8 split on large screens

## Colors

Semantic Catppuccin roles on a near-black desk. Accents are scarce; neutrals do the layout.

### Primary
- **Peach** (`peach`): The commit color. Fills the primary pill (`Log this block`, `Save session`, `Add to Apple Calendar`). Paints the live timeline rail and its 10px pip. Never a page wash.

### Secondary
- **Mauve** (`mauve`): Clock numerals, in-page links, input focus border, DSA/study accent, sidebar resize hover. Time and attention, not the save action.

### Tertiary
- **Green** (`green`): Logged / done pills, success status copy, walk accent, the 1.4s stat flash ring. Confirmation only.
- **Blue** (`blue`): Reading accent on the now-card border and meter. Same scarcity as green.
- **Red** (`red`): Error status copy and meal accent. Never a decorative pink.

### Neutral
- **Crust** (`crust`): App shell and page background; also primary-button text on peach.
- **Mantle** (`mantle`): Sidebar and content panels.
- **Base** (`base`): Inputs, nested stat cells, menus.
- **Surface 0** (`surface0`): Default borders, progress track, nav active fill, ghost-hover fill, past timeline rail.
- **Surface 1** (`surface1`): Ghost-pill rest border.
- **Overlay 0** (`overlay0`): Form labels, timezone, time ranges, empty chrome icons at rest.
- **Overlay 1** (`overlay1`): Ghost-pill hover border; icon hover.
- **Text** (`text`): Headings and primary copy.
- **Subtext 0** (`subtext0`): Supporting sentences, inactive nav, week footer.
- **Subtext 1** (`subtext1`): Guidance bullets and recent-session rows.

### Named Rules
**The One Action Rule.** Peach fill appears on at most one primary pill per cluster. Sibling actions are ghost pills. Green is confirmation of a log, never a second CTA color.

**The Mocha Stack Rule.** Page is crust, panels are mantle, nested wells are base. Do not skip a step (mantle button on crust, base panel on crust) and do not invert it.

## Typography

**Display Font:** JetBrains Mono (with ui-monospace / Menlo)
**Body Font:** JetBrains Mono (same stack; `--font-ui` defaults to this)
**Label/Mono Font:** JetBrains Mono (clocks, durations, counts, subject tags)

**Character:** One monospaced family at medium weight for titles and regular for body. It reads as a briefing terminal, not as a marketing sans with a mono accent.

### Hierarchy
- **Display** (500, clamp 1.875rem–3rem, tight tracking): Now-card block title (`text-3xl` / `sm:text-5xl`). The current work, largest type on the page.
- **Headline** (500, clamp 1.875rem–2.25rem, tight tracking): Page date heading beside the clock.
- **Clock** (400, 2.25rem, mauve): Live time in the header. Measurement, not a hero metric for a marketing page.
- **Title** (500, 1.25rem): Panel names — Today, Week, Sunday review.
- **Body** (400, 1rem, 1.6): Guidance, supporting copy, timeline titles.
- **Label** (400, 13px, overlay0): Form labels and status lines. Sentence case. Status uses green or red instead of overlay0.

### Named Rules
**The Measurement Face Rule.** Clocks, `HH:MM–HH:MM` ranges, stat counts, and subject tags (`dsa`, `walk`) stay in this mono face. Do not introduce a second display family for Today.

**The Sentence-Case Label Rule.** Form labels and status copy are 13px overlay0 (or green/red for outcome). They sit beside or above fields, not as a tracked banner over a headline.

## Layout

Operate surfaces live in a max-width 1080px column (`px-5` / 20px gutters, `pt-6` / `pb-16`). The shell is a full-viewport row: resizable mantle sidebar (56px collapsed, 248px default, 200–480px) plus a scrolling crust canvas. Chat and note routes opt out of the 1080px column; Today does not.

Today stacks: header (space-between, items-end, 28px below) → now card (28px inner pad, 20px below) → two `1.2fr / 0.8fr` rows from `lg` (16px gaps): Today | Week, then Sunday review | Apple Calendar. Inner rhythm is 8 / 10 / 16 / 20 / 28px. Controls wrap at `gap-2.5` (10px). The Today list is a two-column grid: 148px mono range + title, plus a trailing chip.

### Named Rules
**The 1080 Rule.** New Today/operate blocks stay inside the 1080px column. Do not go full-bleed for a log widget.

**The Split Rule.** Pair a primary list (Today, Sunday review) with a shorter companion (Week, Apple Calendar) at 1.2 / 0.8. Do not make four equal cards the page structure.

## Elevation & Depth

Flat at rest on Chat, Routine, Reports, and chrome. Depth is a 1px `surface0` border plus a step on the Mocha stack.

Today operate panels (now-card, Today list, Week, extra-time/recent well, Sunday review, Apple Calendar strip) use **softer glass v2b** via `.today-glass`: 88% mantle over transparent, 10px blur, a thin `text`/`surface0` rim, an inset highlight, and a light crust-tinted shadow. Not heavy frost, not flat Mocha mantle, not neumorphism. The now card may tint that rim with a subject accent at 50% (mauve / green / blue / peach / red). Peach CTAs stay fully opaque (`peach` fill, `crust` text) — no alpha, no blur on the pill.

Shadows on other routes exist only on floating chrome: context menus and tooltips (`shadow-xl`), peeked collapsed sidebar (`shadow-2xl`). Logged-stat feedback is a 1.4s `ring-1 ring-green/80`, not a drop shadow. Skip that ring when `prefers-reduced-motion: reduce`.

### Shadow Vocabulary
- **Menu float** (`box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)`): Menus, slash palette, contribution tooltip.
- **Sidebar peek** (Tailwind `shadow-2xl`): Collapsed sidebar while hovered open.
- **Today glass** (`.today-glass`): inset 1px text highlight at 14%, then `0 10px 28px` crust at 35%. Today operate panels only.

### Named Rules
**The Hairline Rule.** Surfaces outside Today are flat. If it needs to look like a panel, give it a 1px `surface0` border on mantle — do not add a shadow. Today operate panels use softer glass v2b instead.

## Shapes

Pills for actions (`rounded-full`). Sixteen-pixel corners for bordered panels (`rounded-2xl`; global `.border` also sets 1rem). Twelve-pixel corners for fields and nested stat cells (`rounded-xl`). Six-pixel corners for sidebar rows (`rounded-md`). Progress is a 6px-tall full-round track. Timeline pips are 10px circles on a 2px left rail.

Global CSS rounds generic `.border` to 16px and native controls to 12px; Today’s pills override that with `rounded-full`. Prefer the pill override for actions on this surface.

### Named Rules
**The Pill Action Rule.** Primary, ghost, done, and sidebar New are capsules. Do not ship a 6px-radius rectangle as a Today CTA.

## Components

### Buttons
- **Shape:** Capsule (`9999px`), 10×16px pad, 13–14px medium label.
- **Primary:** Peach fill, crust text. Disabled: wait cursor, 55% opacity. No rest-state hover fill in the shipped Today CSS — do not invent a hover wash.
- **Ghost:** Transparent, `surface1` hairline, text. Hover: `overlay1` border and `surface0` fill.
- **Done:** Green at 10% fill, 40% border, green text. This is a logged state, not a second primary.
- **Busy:** Same pill, label becomes `Logging…` / `Saving…`.
- **Focus:** Inputs already use a mauve border; keep keyboard focus inside that role. Do not add a glow.

### Cards / Containers
- **Corner Style:** 16px
- **Background:** Mantle (Today: `.today-glass`)
- **Shadow Strategy:** Today glass v2b on operate panels; none elsewhere (Hairline Rule)
- **Border:** 1px glass rim; now-card border may be subject-accent at 50%
- **Internal Padding:** 20px panels; 28px now card
- **Nested wells:** Stat cells are 12px-pad `base` at 12px radius — the only nested card. Do not nest further.

### Inputs / Fields
- **Style:** 12px corners, `surface0` hairline, `base` fill, 10×12px pad, 6px gap under the 13px label.
- **Focus:** Border to mauve; no outline, no glow.
- **Groups:** Subject / minutes / DSA problems sit in a wrapping row of equal flex children, min 120px.

### Navigation
- **Rail:** Mantle, right hairline `surface0`, Phosphor icons at 20px (bold rest, fill when active).
- **Item:** 13px, 6px radius, `subtext0`; hover `surface0/80`; active `surface0` + `text`.
- **New:** Full-width peach-less capsule in `surface0` at the rail foot — ghost-family, not primary.

### Status line
13px, `min-height: 1.2em`, `aria-live="polite"`. Green for success, red for error. Lives directly under the control that fired. This is the system’s toast: do not add a snackbar.

### Timeline (signature)
Today’s list is the signature. 2px left rail (`peach` while Now, `surface0` otherwise), 10px pip, 148px mono range, title, trailing status chip. Current row is peach text. Status is the chip (Now / Logged / Remaining / Missed), not greying. The rail is this list’s geometry, not a callout pattern for cards.

### Session row
Hairline `surface0` on top, 10px vertical pad, 14px `subtext1`. Subject is 11px mono, uppercase, wider tracking, peach — a data tag in a list, not a heading kicker.

### Stat cell
Nested well, 12px pad, 12px radius, 16px overlay0 Phosphor icon, 1.25rem mono number, 12px overlay0 caption. Week uses four distinct tints on `base`: blue 14% (DSA total), teal 14% (DSA week), green 14% (walk), mauve 14% (focus hours). On log, a green ring for 1.4s unless reduced motion. Belongs inside Week, not as the page hero.

## Do's and Don'ts

### Do:
- **Do** put the commit on a peach pill and secondary logs on ghost pills in the same 10px-gap row.
- **Do** confirm on a 13px green status line under the control; flash the matching Week cell with the green ring.
- **Do** keep new Today chrome on mantle panels with a `surface0` hairline and 16px corners.
- **Do** bind color to roles (`peach`, `mauve`, `green`) so Latte and Kanagawa still work.

### Don't:
- **Don't** add glass outside Today operate panels; Today uses softer glass v2b. Don't add a drop shadow or gradient to pills. The peach CTA stays opaque.
- **Don't** introduce a new accent (orange, indigo, yellow) for undo, error, or “smart” logging.
- **Don't** replace pills with icon-plus-label card grids or a floating toolbar.
- **Don't** use a modal or toast stack for log / undo; the status line and the pill state *are* the feedback.
- **Don't** nest a third card level under Week’s stat cells.
