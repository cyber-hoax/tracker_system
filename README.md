# Daily Routine

Local **SDE-2 / SDE-3 prep tracker**: a daily coach, DSA Zettelkasten, reports, chat against your notes, and (on macOS) a native desktop window.

It is designed to run **only on your machine**. The web UI listens on [http://127.0.0.1:8765](http://127.0.0.1:8765). Nothing here is a hosted SaaS.

You can use **either**:

- **Web** — `npm run dev` then open the URL in a browser
- **macOS app** — `npm run app` opens **Daily Routine** in Electron (same server, same database)

You do **not** create the Postgres database or tables by hand. The first time the app (or `npm run dev`) starts, it creates `sde_tracker` if needed, applies migrations, and seeds property definitions.

## Requirements

| Tool | Why |
| --- | --- |
| **Node.js 20+** | Next.js 16 app and Electron |
| **Postgres 18** (or Docker) | Notes, chat, reports, routine logs |
| **npm** | Comes with Node |
| **macOS** (optional) | Desktop app, Apple Calendar, LaunchAgent |

You do **not** need API keys to try the tracker. Chat models, LeetCode ingest, and Obsidian write-through are optional.

## Secrets (read this before you clone)

This repo is public. **Never commit real keys.**

Already gitignored:

- `.env`, `.env.local`, `.env*.local`
- `*.pem`, `*.key`, cookie dumps, `secrets/`

Do **not** put any of these in git, screenshots of Settings, or PR descriptions:

- `LEETCODE_SESSION` (session cookie)
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, OmniRoute / Groq / OpenRouter keys
- Postgres passwords that are not the local Docker default
- Paths to a private Obsidian vault if you do not want them public

LLM keys you paste in **Settings → Models** are stored under:

- macOS: `~/Library/Application Support/SDERoutineTracker/settings.json`
- other OS: `~/.sde-routine-tracker/settings.json`

That file is outside the repo.

If you fork this project, keep `.env.local` local. The sample file [`.env.example`](.env.example) has **placeholder names only**.

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
3. It connects to Postgres, **creates database `sde_tracker` if it does not exist**
4. It applies every file in [`drizzle/`](drizzle/)
5. It seeds note property definitions and the default routine
6. Next.js starts on port **8765**

If Postgres is already installed locally (Homebrew, Postgres.app, etc.), skip Docker. The app will try:

1. `DATABASE_URL` from `.env.local` if you created one
2. `postgresql://<your-os-user>@127.0.0.1:5432/sde_tracker`
3. `postgresql://postgres:postgres@127.0.0.1:5432/sde_tracker` (Docker default)

### Docker already using port 5432

If something else owns `5432`, either stop it or point `DATABASE_URL` in `.env.local` at a free port after changing [`docker-compose.yml`](docker-compose.yml).

## Quick start (macOS desktop app)

Same clone and same database as the web UI. In a second terminal (or instead of the browser):

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

## Optional configuration

After first run you will have `.env.local`. Add only what you use:

| Variable | Required to try the app? | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Written automatically | Postgres URL for `sde_tracker` |
| `OBSIDIAN_VAULT` | No | Absolute path to an Obsidian vault |
| `OBSIDIAN_TRACKER_DIR` | No | Vault-relative folder for problem notes (default `Notion/tracker`) |
| `LEETCODE_USERNAME` | No | Public username for ingest |
| `LEETCODE_SESSION` | No | `LEETCODE_SESSION` cookie from leetcode.com — **secret** |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | No | Optional cloud keys; local OmniRoute / Ollama keys belong in Settings |

Timezone and the study plan come from [`config.yaml`](config.yaml) and [`data/routine.json`](data/routine.json) (default `Asia/Kolkata`). The human-readable plan is [`docs/sde2_sde3_learning_routine.md`](docs/sde2_sde3_learning_routine.md).

## What you can click through

| Path | Feature |
| --- | --- |
| `/` | **Today** — current block, logging, Sunday review, Calendar sync |
| `/chat` | Chat with local or routed models; `@` notes and `/` folders |
| `/routine` | Edit the weekly routine stored in Postgres |
| `/reports` | Day / week / month / calendar heatmap |
| `/graph` | Zettelkasten graph (problems, patterns, wikilinks) |
| `/search` | Full-text + fuzzy title search, property filters |
| `/settings` | Appearance, Obsidian, LeetCode, LLM providers |
| `/dsa`, `/patterns` | Problem notes and pattern hubs |

Themes include Catppuccin and Kanagawa. Code-block themes are independent of the app theme.

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
| `npm run install-agent` | macOS login LaunchAgent (web in the browser) |
| `npm run uninstall-agent` | Remove that agent |

## Obsidian, Calendar, LeetCode

All optional.

- **Obsidian** — set `OBSIDIAN_VAULT`; saving a note writes markdown. Pull vault edits from Settings or `npm run obsidian:import`.
- **Apple Calendar** — on Today, **Sync to Apple Calendar** creates calendar **SDE Prep** (macOS permission prompt).
- **LeetCode** — username + session cookie; sync from Settings. Never commit the cookie.

## Contributing and merge rules

The default branch is **`main`**. It is **protected**:

- Outsiders can **fork** and open a **pull request**
- Outsiders **cannot** push to `main` or merge their own PR
- **`CODEOWNERS`** is [@cyber-hoax](https://github.com/cyber-hoax); reviews from the owner are required
- Force-pushes and branch deletion on `main` are disabled
- Only the repository owner can land changes

Please:

1. Fork
2. Branch from `main`
3. Keep secrets out of the diff
4. Open a PR and wait for review

Do not assume a green CI check means the PR will merge.

## Troubleshooting

**`Could not reach Postgres`**  
Start Docker (`docker compose up -d`) or your local Postgres, then `npm run setup`.

**Port 8765 in use**  
Something else (or a previous `next dev`) is bound there. Quit it, or set `TRACKER_PORT` when using the desktop app.

**Electron says the binary is missing**  
`npm run app` runs `desktop/ensure-electron.cjs`. If npm skipped install scripts, that step downloads Electron.

**Chat has no models**  
Add a provider in Settings (Ollama, OmniRoute, etc.). Keys stay on disk, not in git.

## License

Private-use / source-available unless a `LICENSE` file is added later. Ask before you republish the routine content as your own product.
