import { config } from "dotenv";

config({ path: ".env.local" });

async function seed() {
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

  const rows = await db.select().from(propertyDefs);
  console.log(`property_defs: ${rows.length} rows`);
  for (const row of rows.sort((a, b) => a.key.localeCompare(b.key))) {
    console.log(`  ${row.key} (${row.valueType}${row.isSystem ? ", system" : ""})`);
  }

  const { loadRoutineRecord } = await import("../lib/routine");
  const routine = await loadRoutineRecord();
  console.log(`routine: ${routine.name} (${Object.keys(routine.payload.days).length} days)`);
}

seed()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
