import { existsSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { config } from "dotenv";

const DB_NAME = "sde_tracker";

function loadEnvFiles() {
  const home = os.homedir();
  const files = [
    path.join(process.cwd(), ".env.local"),
    path.join(home, "Library", "Application Support", "SDERoutineTracker", ".env.local"),
    path.join(home, ".sde-routine-tracker", ".env.local"),
  ];
  for (const file of files) {
    if (existsSync(file)) config({ path: file, quiet: true });
  }
}

function candidateUrls(): string[] {
  const user = os.userInfo().username;
  const seen = new Set<string>();
  const urls: string[] = [];
  const add = (url: string) => {
    if (!seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  };
  if (process.env.DATABASE_URL?.trim()) add(process.env.DATABASE_URL.trim());
  add(`postgresql://${encodeURIComponent(user)}@127.0.0.1:5432/${DB_NAME}`);
  add(`postgresql://postgres:postgres@127.0.0.1:5432/${DB_NAME}`);
  return urls;
}

function maintenanceUrl(databaseUrl: string, catalog: string): string {
  const parsed = new URL(databaseUrl);
  parsed.pathname = `/${catalog}`;
  return parsed.toString();
}

function databaseName(databaseUrl: string): string {
  const name = new URL(databaseUrl).pathname.replace(/^\//, "");
  return name || DB_NAME;
}

async function canQuery(url: string): Promise<boolean> {
  const sql = postgres(url, { max: 1, connect_timeout: 3 });
  try {
    await sql`select 1`;
    return true;
  } catch {
    return false;
  } finally {
    await sql.end({ timeout: 1 }).catch(() => undefined);
  }
}

async function ensureDatabaseExists(databaseUrl: string): Promise<void> {
  const name = databaseName(databaseUrl);
  const safeName = name.replaceAll('"', "");
  let lastError: unknown;
  for (const catalog of ["postgres", "template1"]) {
    const admin = postgres(maintenanceUrl(databaseUrl, catalog), {
      max: 1,
      connect_timeout: 5,
    });
    try {
      const found = await admin<{ exists: boolean }[]>`
        select exists(select 1 from pg_database where datname = ${safeName}) as exists
      `;
      if (!found[0]?.exists) {
        await admin.unsafe(`CREATE DATABASE "${safeName}"`);
        console.log(`Created Postgres database "${safeName}".`);
      }
      return;
    } catch (error) {
      lastError = error;
    } finally {
      await admin.end({ timeout: 1 }).catch(() => undefined);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Could not create the Postgres database.");
}

function writeDefaultEnv(databaseUrl: string): void {
  const dest = path.join(process.cwd(), ".env.local");
  if (existsSync(dest)) return;
  const body = `# Generated on first run. Do not commit this file.
# Add optional keys here (never push them): LEETCODE_SESSION, OPENAI_API_KEY, ANTHROPIC_API_KEY
DATABASE_URL=${databaseUrl}
`;
  writeFileSync(dest, body, { encoding: "utf8" });
  console.log(`Wrote ${dest}`);
}

export async function ensureLocalDatabase(): Promise<string> {
  loadEnvFiles();

  let selected: string | null = process.env.DATABASE_URL?.trim() || null;
  if (selected) {
    try {
      await ensureDatabaseExists(selected);
    } catch (error) {
      throw new Error(
        [
          "Could not reach Postgres using DATABASE_URL from .env.local.",
          error instanceof Error ? error.message : String(error),
          "Start Postgres, then run npm run setup again. Easiest path:",
          "  docker compose up -d",
        ].join("\n"),
      );
    }
  } else {
    for (const url of candidateUrls()) {
      try {
        await ensureDatabaseExists(url);
        if (await canQuery(url)) {
          selected = url;
          break;
        }
      } catch {
        // try the next candidate
      }
    }
  }

  if (!selected) {
    throw new Error(
      [
        "Could not reach Postgres, so Daily Routine cannot create its database.",
        "Start Postgres, then run npm run dev again. Easiest path:",
        "  docker compose up -d",
        "Or install Postgres 18 locally and leave it running on 127.0.0.1:5432.",
      ].join("\n"),
    );
  }

  process.env.DATABASE_URL = selected;
  writeDefaultEnv(selected);

  const migrator = postgres(selected, { max: 1 });
  try {
    await migrate(drizzle(migrator), {
      migrationsFolder: path.join(process.cwd(), "drizzle"),
    });
  } finally {
    await migrator.end({ timeout: 1 }).catch(() => undefined);
  }

  const { seedDatabase } = await import("./seed");
  await seedDatabase();
  return selected;
}

const startedDirectly =
  process.argv[1]?.includes(`${path.sep}ensure.ts`) ||
  process.argv[1]?.includes(`${path.sep}ensure.js`);

if (startedDirectly) {
  ensureLocalDatabase()
    .then((url) => {
      const safe = new URL(url);
      if (safe.password) safe.password = "****";
      console.log(`Database ready: ${safe.toString()}`);
      process.exit(0);
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
