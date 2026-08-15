import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const { syncFromObsidian } = await import("./sync");
  const report = await syncFromObsidian();
  console.log(`imported: ${report.imported}`);
  console.log(`updated: ${report.updated}`);
  console.log(`written: ${report.written}`);
  console.log(`unchanged: ${report.unchanged}`);
  console.log(`problems: ${report.problems}`);
  console.log(`patterns: ${report.patterns}`);
  if (report.conflicts.length > 0) {
    console.log("conflicts:");
    for (const file of report.conflicts) {
      console.log(`  ${file}`);
    }
  }
  if (report.skipped.length > 0) {
    console.log("skipped:");
    for (const row of report.skipped) {
      console.log(`  ${row.path} (${row.reason})`);
    }
  }
  if (report.error) {
    console.error(report.error);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
