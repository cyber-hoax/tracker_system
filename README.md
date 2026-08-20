# Daily Routine

Local-first **SDE-2 / SDE-3** workspace: today's study block, a DSA Zettelkasten, reports, and chat against your notes. On macOS it also opens as a desktop window.

Runs **only on your machine**. Nothing here is a hosted SaaS.

<p align="center">
  <img src="docs/screenshots/inkdrop-light.png" alt="Daily Routine in the Inkdrop Light theme — notebooks rail, DSA note list, editor, and properties" width="920" />
</p>

<p align="center">
  <a href="https://github.com/cyber-hoax/tracker_system/fork">Fork it</a>
  ·
  <a href="#quick-start-web">Web</a>
  ·
  <a href="#quick-start-macos-app">macOS app</a>
  ·
  <a href="http://127.0.0.1:8765">http://127.0.0.1:8765</a>
</p>

Use either:

- **Web** — `npm run dev`, then open the URL in a browser
- **macOS app** — `npm run app` opens **Daily Routine** in Electron (same server, same database)

You do **not** create the Postgres database by hand. The first `npm run dev` or `npm run app` creates `sde_tracker`, applies migrations, and seeds property definitions.

The screenshot above is the three-pane notes desk in **Inkdrop Light**: notebooks on the left, the problem list in the middle, the markdown/code editor, and the properties rail.

---

## Features

| | |
| --- | --- |
| **LeetCode → notes** | Username + session cookie. New submissions become files. Existing problems **append** (with tags), they are not overwritten. Polls **every hour**. |
| **Reports** | Daily, weekly, monthly — plus heatmaps and a calendar. |
| **Routines + Calendar** | Multiple routines. Push to Apple Calendar (`SDE Prep`). |
| **Notes** | New problem, pattern, or free note whenever you need it. |
| **Extra properties** | Text, number, date, select, multi-select, checkbox, wikilink. |
| **Trash snapshots** | Latest **10 deletes** can be restored from Settings. |
| **Obsidian sync** | Two-way markdown with the vault you already have. |
| **Chat on your files** | Local models, API models, or OmniRoute. `@note` and `/folder`. |
| **Graph** | Problems, patterns, wikilinks — Obsidian-style. |
| **Postgres** | Notes, chat, routines, and snapshots persist. Created for you. |
| **Settings** | App theme, markdown / code theme, sync, properties, LLM config. |
| **Fuzzy search** | Titles, bodies, folders, property filters. |
| **Backlinks** | Every note shows what points at it. |

---

## Screenshots

<table>
  <tr>
    <td width="50%">
      <p align="center"><strong>DSA note</strong></p>
      <img src="docs/screenshots/note.png" alt="DSA note with syntax-highlighted C++ solution" />
    </td>
    <td width="50%">
      <p align="center"><strong>Chat on your notes</strong></p>
      <img src="docs/screenshots/chat.png" alt="Chat with OmniRoute, @notes and /folders" />
    </td>
  </tr>
  <tr>
    <td>
      <p align="center"><strong>Reports + heatmap</strong></p>
      <img src="docs/screenshots/reports.png" alt="Reports calendar heatmap for questions and routines" />
    </td>
    <td>
      <p align="center"><strong>Zettelkasten graph</strong></p>
      <img src="docs/screenshots/graph.png" alt="Graph of problems, patterns, and wikilinks" />
    </td>
  </tr>
  <tr>
    <td>
      <p align="center"><strong>Fuzzy search</strong></p>
      <img src="docs/screenshots/search.png" alt="Fuzzy search results with property facets" />
    </td>
    <td>
      <p align="center"><strong>Settings</strong></p>
      <img src="docs/screenshots/settings.png" alt="Appearance settings — app theme and code theme" />
    </td>
  </tr>
</table>

The hero is **Inkdrop Light**. The gallery below still shows Catppuccin / Kanagawa shots of the other pages. Code-block themes are independent of the app theme.

---

## Requirements

| Tool | Why |
| --- | --- |
| **Node.js 20+** | Next.js 16 app and Electron |
| **Postgres 18** (or Docker) | Notes, chat, reports, routine logs |
| **npm** | Comes with Node |
| **macOS** (optional) | Desktop app, Apple Calendar, LaunchAgent |

You do **not** need API keys to try the tracker. Chat, LeetCode ingest, and Obsidian write-through are optional.

---

## Secrets

This repo is public. **Never commit real keys.**

Already gitignored: `.env`, `.env.local`, `*.pem`, `*.key`, cookie dumps, `secrets/`.

Do **not** put any of these in git, screenshots of Settings, or PR descriptions:

- `LEETCODE_SESSION` (session cookie)
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, OmniRoute / Groq / OpenRouter keys
- Postgres passwords that are not the local Docker default
- Paths to a private Obsidian vault if you do not want them public

LLM keys you paste in **Settings → Models** live outside the repo:

- macOS: `~/Library/Application Support/SDERoutineTracker/settings.json`
- other OS: `~/.sde-routine-tracker/settings.json`

[`.env.example`](.env.example) has **placeholder names only**.

---

## Quick start (web)

Postgres must be reachable on `127.0.0.1:5432`. If you do not already run Postgres, use Docker:

```bash
git clone https://github.com/cyber-hoax/tracker_system.git
cd tracker_system
npm install
docker compose up -d
npm run dev
```

Open [http://127.0.0.1:8765](http://127.0.0.1:8765).

What happens on `npm run dev`:

1. `predev` runs `src/db/ensure.ts`
2. If `.env.local` is missing, it writes one with `DATABASE_URL` (no API keys)
3. It connects to Postgres and **creates database `sde_tracker` if it does not exist**
4. It applies every file in [`drizzle/`](drizzle/)
5. It seeds note property definitions and the default routine
6. Next.js starts on port **8765**

If Postgres is already installed locally (Homebrew, Postgres.app, etc.), skip Docker. The app will try:

1. `DATABASE_URL` from `.env.local` if you created one
2. `postgresql://<your-os-user>@127.0.0.1:5432/sde_tracker`
3. `postgresql://postgres:postgres@127.0.0.1:5432/sde_tracker` (Docker default)

If something else owns `5432`, stop it or point `DATABASE_URL` in `.env.local` at a free port after changing [`docker-compose.yml`](docker-compose.yml).

---

## Quick start (macOS app)

Same clone and same database as the web UI:

```bash
cd tracker_system
npm install
docker compose up -d          # skip if Postgres is already up
npm run app
```

`npm run app` will:

1. Create / migrate / seed the database (same as web)
2. Download the Electron binary if npm skipped that postinstall
3. Open a native window (hidden title bar, traffic lights)
4. Attach to `http://127.0.0.1:8765` if `npm run dev` is already running, otherwise start Next itself

Quit with **Cmd+Q**. The red traffic light hides the window; the Dock icon brings it back.

Optional packagers (unsigned, local only):

```bash
npm run app:pack    # Daily Routine.app under release/
npm run app:dist    # .app + DMG
```

Stop `npm run dev` before packing; both use the `.next` folder.

---

## Optional configuration

After first run you will have `.env.local`. Add only what you use:

| Variable | Required to try the app? | Purpose |
| --- | --- |
| `DATABASE_URL` | Written automatically | Postgres URL for `sde_tracker` |
| `OBSIDIAN_VAULT` | No | Absolute path to an Obsidian vault |
| `OBSIDIAN_TRACKER_DIR` | No | Vault-relative folder for problem notes (default `Notion/tracker`) |
| `LEETCODE_USERNAME` | No | Public username for ingest |
| `LEETCODE_SESSION` | No | `LEETCODE_SESSION` cookie from leetcode.com — **secret** |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | No | Optional cloud keys; local OmniRoute / Ollama keys belong in Settings |

Timezone and the study plan come from [`config.yaml`](config.yaml) and [`data/routine.json`](data/routine.json) (default `Asia/Kolkata`). The human-readable plan is [`docs/sde2_sde3_learning_routine.md`](docs/sde2_sde3_learning_routine.md).

### Integrations

All optional.

- **Obsidian** — set `OBSIDIAN_VAULT`; saving a note writes markdown. Pull vault edits from Settings or `npm run obsidian:import`.
- **Apple Calendar** — on Today, **Sync to Apple Calendar** creates calendar **SDE Prep** (macOS permission prompt).
- **LeetCode** — username + session cookie; sync from Settings. Never commit the cookie.

---

## Pages

| Path | Feature |
| --- | --- |
| `/` | **Today** — current block, logging, Sunday review, Calendar sync |
| `/chat` | Chat with local or routed models; `@` notes and `/` folders |
| `/routine` | Edit weekly routines stored in Postgres |
| `/reports` | Day / week / month / calendar heatmap |
| `/graph` | Zettelkasten graph (problems, patterns, wikilinks) |
| `/search` | Full-text + fuzzy title search, property filters |
| `/settings` | Appearance, Obsidian, LeetCode, extra properties, trash restore, LLM |
| `/dsa`, `/patterns` | Problem notes and pattern hubs |

---

## Commands

| Command | What it does |
| --- | --- |
| `npm run setup` | Create DB, migrate, seed (also runs automatically) |
| `npm run dev` | Web UI at `127.0.0.1:8765` |
| `npm run app` | macOS desktop window |
| `npm run db:migrate` | Apply Drizzle migrations only |
| `npm run db:seed` | Re-seed property definitions |
| `npm run db:studio` | Drizzle Studio |
| `npm test` | Vitest |
| `npm run build` / `npm start` | Production Next server on 8765 |
| `npm run install-agent` | Does **not** enable login auto-start (unloads the agent if present) |
| `npm run uninstall-agent` | Remove that agent if present |

---

## Contributing

The default branch is **`main`**. It is **protected**:

- Fork and open a **pull request** — welcome
- You **cannot** push to `main` or merge your own PR
- **`CODEOWNERS`** is [@cyber-hoax](https://github.com/cyber-hoax); owner review is required
- Force-pushes and deleting `main` are disabled

Please:

1. Fork
2. Branch from `main`
3. Keep secrets out of the diff
4. Open a PR and wait for review

Happy to take feedback or feature requests.

---

## Troubleshooting

**`Could not reach Postgres`**  
Start Docker (`docker compose up -d`) or your local Postgres, then `npm run setup`.

**Port 8765 in use**  
Something else (or a previous `next dev`) is bound there. Quit it, or set `TRACKER_PORT` when using the desktop app.

**Electron says the binary is missing**  
`npm run app` runs `desktop/ensure-electron.cjs`. If npm skipped install scripts, that step downloads Electron.

**Chat has no models**  
Add a provider in Settings (Ollama, OmniRoute, etc.). Keys stay on disk, not in git.

---

## License

Private-use / source-available unless a `LICENSE` file is added later. Ask before you republish the routine content as your own product.
