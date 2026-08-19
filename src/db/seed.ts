import { config } from "dotenv";
import path from "node:path";

config({ path: ".env.local", quiet: true });

export async function seedDatabase(verbose = false) {
  const { db } = await import("./index");
  const { propertyDefs } = await import("./schema");

  const defs = [
    {
      key: "Difficulty",
      valueType: "select",
      options: ["easy", "medium", "hard"],
      isSystem: false,
    },
    {
      key: "Status",
      valueType: "select",
      options: ["Solved", "Partial", "Unsolved"],
      isSystem: false,
    },
    {
      key: "Pattern",
      valueType: "wikilink_list",
      options: null,
      isSystem: false,
    },
    {
      key: "Description",
      valueType: "text",
      options: null,
      isSystem: false,
    },
    {
      key: "Key Insight",
      valueType: "text",
      options: null,
      isSystem: false,
    },
    {
      key: "Mistake Type",
      valueType: "text",
      options: null,
      isSystem: false,
    },
    {
      key: "remarks",
      valueType: "text",
      options: null,
      isSystem: false,
    },
    {
      key: "Revision Count",
      valueType: "number",
      options: null,
      isSystem: false,
    },
    {
      key: "Last Solved Date",
      valueType: "date",
      options: null,
      isSystem: false,
    },
    {
      key: "Next Revision Date",
      valueType: "date",
      options: null,
      isSystem: false,
    },
    {
      key: "notion-id",
      valueType: "text",
      options: null,
      isSystem: true,
    },
    {
      key: "base",
      valueType: "wikilink",
      options: null,
      isSystem: true,
    },
  ];

  await db
    .insert(propertyDefs)
    .values(defs)
    .onConflictDoNothing({ target: propertyDefs.key });

  if (verbose) {
    const rows = await db.select().from(propertyDefs);
    console.log(`property_defs: ${rows.length} rows`);
    for (const row of rows.sort((a, b) => a.key.localeCompare(b.key))) {
      console.log(`  ${row.key} (${row.valueType}${row.isSystem ? ", system" : ""})`);
    }
  }

  const { loadRoutineRecord } = await import("../lib/routine");
  const { mergeAliasedPatternNotes } = await import("../lib/zettel/pattern-merge");
  await mergeAliasedPatternNotes();
  const routine = await loadRoutineRecord();
  if (verbose) {
    console.log(
      `routine: ${routine.name} (${Object.keys(routine.payload.days).length} days)`,
    );
  }
}

const startedDirectly =
  process.argv[1]?.includes(`${path.sep}seed.ts`) ||
  process.argv[1]?.includes(`${path.sep}seed.js`);

if (startedDirectly) {
  seedDatabase(true)
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error(error);
      process.exit(1);
    });
}
