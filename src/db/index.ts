import { config } from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { supportDir } from "@/lib/paths";

for (const file of [
  path.join(process.cwd(), ".env.local"),
  path.join(supportDir(), ".env.local"),
]) {
  if (existsSync(file)) config({ path: file, quiet: true });
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

const globalForDb = globalThis as unknown as {
  postgres?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.postgres ??
  postgres(databaseUrl, {
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.postgres = client;
}

export const db = drizzle(client, { schema });
export { client };
