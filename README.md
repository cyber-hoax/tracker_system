# SDE Tracker

Local Next.js dashboard for an SDE-2 / SDE-3 prep routine, plus a DSA Zettelkasten that writes through to Obsidian, syncs recurring blocks to Apple Calendar, and ingests accepted LeetCode submissions.

The app is meant to run only on your machine at [http://127.0.0.1:8765](http://127.0.0.1:8765). The human-readable plan lives in [docs/sde2_sde3_learning_routine.md](docs/sde2_sde3_learning_routine.md); the schedule the dashboard uses is [data/routine.json](data/routine.json). Timezone defaults to `Asia/Kolkata` via [config.yaml](config.yaml).

## What it does

- **Today** — current routine block, remaining time, today’s timeline, session logging (DSA / LLD / HLD / AI, walks, reading, Sunday review), and Apple Calendar sync.
- **DSA Zettelkasten** — problem notes with typed properties (Difficulty, Status, Pattern, Key Insight, and more).
- **Pattern hubs** — pattern notes that problems link to; linking a Pattern on a problem can stub a hub.
- **Obsidian write-through** — saving a note rewrites the matching vault markdown; you can pull vault edits back in.
- **Apple Calendar** — recurring study / dinner / walk / reading events on a dedicated **SDE Prep** calendar (work hours omitted).
- **LeetCode ingest** — accepted submissions become Solved problem notes. Username and session cookie come from env; sync also lives on Settings.

The UI uses **Catppuccin Mocha** (mauve powerline nav, crust background, JetBrains Mono).

## Setup

You need **Node.js** and **Postgres 18** with a database named `sde_tracker`.

```bash
cd ~/Documents/tracker_system
createdb sde_tracker   # skip if it already exists
npm install
cp .env.example .env.local
```

Edit `.env.local` with your own values. Required variables (names only — do not commit cookies, passwords, or a LeetCode session JWT):

| Variable | Role |
| --- | --- |
| `DATABASE_URL` | Postgres connection string for `sde_tracker` |
| `OBSIDIAN_VAULT` | Absolute path to the Obsidian vault root |
| `OBSIDIAN_TRACKER_DIR` | Vault-relative folder for problem notes |
| `LEETCODE_USERNAME` | LeetCode profile used for ingest |
| `LEETCODE_SESSION` | `LEETCODE_SESSION` cookie from leetcode.com |

Then migrate, seed property definitions, and optionally import existing vault notes:

```bash
npm run db:migrate
npm run db:seed
npm run obsidian:import   # optional; needs OBSIDIAN_VAULT
npm run dev
```

Open [http://127.0.0.1:8765](http://127.0.0.1:8765).

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on `127.0.0.1:8765` |
| `npm run db:migrate` | Apply Drizzle migrations |
| `npm run db:seed` | Seed note property definitions |
| `npm run obsidian:import` | Pull vault markdown into Postgres |
| `npm run install-agent` | Install the macOS login LaunchAgent |
| `npm run uninstall-agent` | Remove the login LaunchAgent |

LeetCode sync is on **Settings** (manual run). With `LEETCODE_SESSION` set, the server also polls about hourly after boot.

Useful extras: `npm run db:studio`, `npm test`, `npm run build`.

## Pages

| Path | Page |
| --- | --- |
| `/` | **Today** — routine briefing, logging, Calendar sync |
| `/dsa` | **DSA** — problem notes, filters, new problems |
| `/patterns` | **Patterns** — pattern hubs |
| `/graph` | **Graph** — notes as nodes; Pattern / wikilink / manual edges |
| `/search` | **Search** — full-text plus property filters |
| `/settings` | **Settings** — Obsidian pull, LeetCode, property schema |

## Login LaunchAgent

`npm run install-agent` copies a production runtime to `~/Library/Application Support/SDERoutineTracker` (LaunchAgents should not depend on `~/Documents`), runs `npm ci` / `next build` there, and writes `~/Library/LaunchAgents/com.cyberhoax.sde-routine-tracker.plist`.

On login the agent runs `scripts/login-server.mjs`, which starts `next start` on `127.0.0.1:8765` (if that port is free) and opens the dashboard in the browser when `open_on_login` is true in `config.yaml`.

`npm run uninstall-agent` unloads the agent and removes the plist. Progress and app settings live under Application Support, not in git.

## Apple Calendar

On **Today**, **Sync to Apple Calendar** creates (or refreshes) a calendar named **SDE Prep** via AppleScript. macOS will prompt for **Calendar** permission the first time.

If AppleScript cannot write events (permission denied or timeout), the app writes an `.ics` and opens Calendar so you can import into **SDE Prep**.

## Obsidian write-through and wikilinks

With `OBSIDIAN_VAULT` set:

- Problem notes map to `{OBSIDIAN_TRACKER_DIR}/<Title>.md` (default `Notion/tracker`).
- Pattern hubs map to `Patterns/<name>.md`.
- Creating, editing, or deleting a note in the app **writes through** to that file (frontmatter from properties, body from the editor).
- Pattern names on a problem also get a `[[Patterns/name|name]]` hub block in the markdown so Obsidian graph/backlinks work.
- Wikilink and wikilink-list properties (especially **Pattern**) become `links` rows used by Graph. Other `[[wikilinks]]` resolve when the target note already exists.

Edits made in Obsidian are pulled with **Settings → sync from vault** or `npm run obsidian:import`. Conflicting files can get a `.conflict.md` sibling instead of silently overwriting.

## LeetCode ingest

Set `LEETCODE_USERNAME` and `LEETCODE_SESSION` in `.env.local` (never commit them). On Settings you can save the username and trigger a sync. The first run pulls recent submissions; later ticks are incremental. Accepted solutions become Solved DSA notes and are written through to the vault when Obsidian is configured.
